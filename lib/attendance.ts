import {
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type Room,
} from "livekit-client";

export type AttendanceRecord = {
  identity: string;
  name: string;
  joinedAt: Date;
  leftAt: Date | null;
  // Total time spent sharing in finished shares; add the current share separately.
  sharedMs: number;
  sharingSince: Date | null;
};

// Keeps a log of who joined, when they left and how long they shared, from
// the host's point of view. Exposed as an external store for useSyncExternalStore.
export class AttendanceTracker {
  private records = new Map<string, AttendanceRecord>();
  private snapshot: AttendanceRecord[] = [];
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  attach(room: Room) {
    const sync = () => {
      for (const p of room.remoteParticipants.values()) this.join(p);
      this.emit();
    };
    const onJoin = (p: RemoteParticipant) => {
      this.join(p);
      this.emit();
    };
    const onLeave = (p: RemoteParticipant) => {
      this.update(p.identity, (r) => {
        stopSharing(r);
        r.leftAt = new Date();
      });
    };
    const onPublish = (pub: RemoteTrackPublication, p: RemoteParticipant) => {
      if (pub.source !== Track.Source.ScreenShare) return;
      this.join(p);
      this.update(p.identity, (r) => {
        r.sharingSince ??= new Date();
      });
    };
    const onUnpublish = (pub: RemoteTrackPublication, p: RemoteParticipant) => {
      if (pub.source !== Track.Source.ScreenShare) return;
      this.update(p.identity, stopSharing);
    };

    room
      .on(RoomEvent.Connected, sync)
      .on(RoomEvent.ParticipantConnected, onJoin)
      .on(RoomEvent.ParticipantDisconnected, onLeave)
      .on(RoomEvent.TrackPublished, onPublish)
      .on(RoomEvent.TrackUnpublished, onUnpublish);
    sync();

    return () => {
      room
        .off(RoomEvent.Connected, sync)
        .off(RoomEvent.ParticipantConnected, onJoin)
        .off(RoomEvent.ParticipantDisconnected, onLeave)
        .off(RoomEvent.TrackPublished, onPublish)
        .off(RoomEvent.TrackUnpublished, onUnpublish);
    };
  }

  private join(p: RemoteParticipant) {
    if (this.records.has(p.identity)) return;
    const sharing = p.getTrackPublication(Track.Source.ScreenShare) !== undefined;
    this.records.set(p.identity, {
      identity: p.identity,
      name: p.name || p.identity,
      joinedAt: p.joinedAt ?? new Date(),
      leftAt: null,
      sharedMs: 0,
      sharingSince: sharing ? new Date() : null,
    });
  }

  private update(identity: string, change: (r: AttendanceRecord) => void) {
    const current = this.records.get(identity);
    if (!current) return;
    const next = { ...current };
    change(next);
    this.records.set(identity, next);
    this.emit();
  }

  private emit() {
    this.snapshot = [...this.records.values()].sort(
      (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime(),
    );
    for (const listener of this.listeners) listener();
  }
}

function stopSharing(r: AttendanceRecord) {
  if (r.sharingSince) {
    r.sharedMs += Date.now() - r.sharingSince.getTime();
    r.sharingSince = null;
  }
}

export function totalSharedMs(r: AttendanceRecord, now = Date.now()) {
  return r.sharedMs + (r.sharingSince ? now - r.sharingSince.getTime() : 0);
}

function minutes(ms: number) {
  return (ms / 60000).toFixed(1);
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function attendanceCsv(records: AttendanceRecord[], now = new Date()) {
  const time = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const header = [
    "Name",
    "Status",
    "Joined at",
    "Left at",
    "Minutes in session",
    "Minutes sharing",
  ];
  const rows = records.map((r) => {
    const end = r.leftAt ?? now;
    const status = r.leftAt ? "Left" : r.sharingSince ? "Sharing" : "Joined, not sharing";
    return [
      r.name,
      status,
      time(r.joinedAt),
      r.leftAt ? time(r.leftAt) : "",
      minutes(end.getTime() - r.joinedAt.getTime()),
      minutes(totalSharedMs(r, now.getTime())),
    ];
  });
  // The byte-order mark makes Excel read names with non-English letters correctly.
  return "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
