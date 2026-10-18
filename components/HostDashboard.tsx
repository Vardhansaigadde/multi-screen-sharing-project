"use client";

import {
  LiveKitRoom,
  useConnectionState,
  useParticipants,
  useTracks,
  VideoTrack,
  type TrackReference,
} from "@livekit/components-react";
import { ConnectionState, Track, type RoomOptions } from "livekit-client";
import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import { connectionErrorMessage, fetchToken, type TokenResponse } from "@/lib/api";
import InvitePanel from "./InvitePanel";

const PAGE_SIZE = 25;

// adaptiveStream sends each tile the quality that fits its size on screen and
// pauses video for tiles that are hidden (other pages, or behind full-size view).
const roomOptions: RoomOptions = { adaptiveStream: true, dynacast: true };

export default function HostDashboard({ code, hostKey }: { code: string; hostKey: string }) {
  const [connection, setConnection] = useState<TokenResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchToken({ room: code, role: "host", hostKey })
      .then((res) => !cancelled && setConnection(res))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [code, hostKey]);

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-danger">{error}</p>
        <Link href="/" className="text-sm text-muted underline">
          Back to home
        </Link>
      </main>
    );
  }

  if (!connection) {
    return (
      <main className="flex flex-1 items-center justify-center text-muted">
        Starting your room…
      </main>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={connection.url}
      token={connection.token}
      connect
      audio={false}
      video={false}
      options={roomOptions}
      onError={(err) => setError(connectionErrorMessage(err))}
      className="flex h-dvh flex-col"
    >
      <HostView code={code} />
    </LiveKitRoom>
  );
}

function HostView({ code }: { code: string }) {
  const state = useConnectionState();
  const participants = useParticipants().filter((p) => !p.isLocal);
  const screens = useTracks([Track.Source.ScreenShare]).filter((t) => !t.participant.isLocal);
  const [page, setPage] = useState(0);
  const [maximizedSid, setMaximizedSid] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(true);

  const pageCount = Math.max(1, Math.ceil(screens.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageScreens = screens.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const maximizedIndex = screens.findIndex((t) => t.publication.trackSid === maximizedSid);
  const maximized = maximizedIndex >= 0 ? screens[maximizedIndex] : null;

  const sharingIds = new Set(screens.map((t) => t.participant.identity));
  const waiting = participants.filter((p) => !sharingIds.has(p.identity));

  function step(delta: number) {
    if (maximizedIndex < 0 || screens.length === 0) return;
    const next = (maximizedIndex + delta + screens.length) % screens.length;
    setMaximizedSid(screens[next].publication.trackSid);
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") setMaximizedSid(null);
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
  });

  const isMaximized = maximized !== null;
  useEffect(() => {
    if (!isMaximized) return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMaximized]);

  return (
    <>
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border bg-surface px-4 py-3">
        <Link href="/" className="font-semibold">
          ScreenHub
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Room</span>
          <span className="font-mono text-base tracking-widest">{code}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted">
          <span>
            <strong className="text-foreground">{participants.length}</strong> joined
          </span>
          <span>
            <strong className="text-foreground">{screens.length}</strong> sharing
          </span>
          <ConnectionBadge state={state} />
        </div>
        <button
          onClick={() => setShowInvite((v) => !v)}
          className="ml-auto rounded-lg border border-border px-3 py-1.5 text-sm transition hover:border-accent"
        >
          {showInvite ? "Hide invite" : "Invite people"}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className={`min-h-0 flex-1 overflow-y-auto p-4 ${maximized ? "hidden" : ""}`}>
          {screens.length === 0 ? (
            <EmptyState waitingCount={participants.length} />
          ) : (
            <ScreenGrid screens={pageScreens} onSelect={setMaximizedSid} />
          )}

          {pageCount > 1 && (
            <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
          )}

          {waiting.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-xs uppercase tracking-wide text-muted">
                Joined, not sharing yet ({waiting.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {waiting.map((p) => (
                  <span
                    key={p.identity}
                    className="rounded-full border border-border bg-surface px-3 py-1 text-sm"
                  >
                    {p.name || p.identity}
                  </span>
                ))}
              </div>
            </div>
          )}
        </main>

        {maximized && (
          <MaximizedView
            screen={maximized}
            position={maximizedIndex + 1}
            total={screens.length}
            onClose={() => setMaximizedSid(null)}
            onStep={step}
          />
        )}

        {showInvite && !maximized && <InvitePanel code={code} />}
      </div>
    </>
  );
}

function gridColumns(count: number) {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  if (count <= 16) return 4;
  return 5;
}

function ScreenGrid({
  screens,
  onSelect,
}: {
  screens: TrackReference[];
  onSelect: (sid: string) => void;
}) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${gridColumns(screens.length)}, minmax(0, 1fr))` }}
    >
      {screens.map((screen) => (
        <button
          key={screen.publication.trackSid}
          onClick={() => onSelect(screen.publication.trackSid)}
          className="group relative aspect-video overflow-hidden rounded-xl border border-border bg-black text-left transition hover:border-accent"
        >
          <VideoTrack trackRef={screen} className="size-full object-contain" />
          <span className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-md bg-black/70 px-2 py-0.5 text-xs">
            {screen.participant.name || screen.participant.identity}
          </span>
          <span className="absolute top-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-xs opacity-0 transition group-hover:opacity-100">
            Click to enlarge
          </span>
        </button>
      ))}
    </div>
  );
}

function MaximizedView({
  screen,
  position,
  total,
  onClose,
  onStep,
}: {
  screen: TrackReference;
  position: number;
  total: number;
  onClose: () => void;
  onStep: (delta: number) => void;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-black">
      <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2 text-sm">
        <span className="font-medium">{screen.participant.name || screen.participant.identity}</span>
        <span className="text-muted">
          {position} of {total}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => onStep(-1)}
            disabled={total < 2}
            className="rounded-lg border border-border px-3 py-1 hover:border-accent disabled:opacity-40"
            aria-label="Previous screen"
          >
            ←
          </button>
          <button
            onClick={() => onStep(1)}
            disabled={total < 2}
            className="rounded-lg border border-border px-3 py-1 hover:border-accent disabled:opacity-40"
            aria-label="Next screen"
          >
            →
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-accent px-3 py-1 font-medium text-white hover:bg-accent-hover"
          >
            Back to grid
          </button>
        </div>
      </div>
      <button onClick={onClose} className="min-h-0 flex-1" aria-label="Back to grid">
        <VideoTrack trackRef={screen} className="size-full object-contain" />
      </button>
    </section>
  );
}

function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
        className="rounded-lg border border-border px-3 py-1.5 hover:border-accent disabled:opacity-40"
      >
        Previous
      </button>
      <span className="text-muted">
        Page {page + 1} of {pageCount}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount - 1}
        className="rounded-lg border border-border px-3 py-1.5 hover:border-accent disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}

function EmptyState({ waitingCount }: { waitingCount: number }) {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
      <p className="text-lg font-medium">No screens shared yet</p>
      <p className="mt-2 max-w-sm text-sm text-muted">
        {waitingCount === 0
          ? "Share the room code or QR code. Screens appear here as soon as people start sharing."
          : `${waitingCount} joined. Their screens will appear here when they click “Share my screen”.`}
      </p>
    </div>
  );
}

function ConnectionBadge({ state }: { state: ConnectionState }) {
  const label =
    state === ConnectionState.Connected
      ? "Live"
      : state === ConnectionState.Reconnecting
        ? "Reconnecting…"
        : state === ConnectionState.Disconnected
          ? "Disconnected"
          : "Connecting…";
  const color =
    state === ConnectionState.Connected
      ? "bg-success"
      : state === ConnectionState.Disconnected
        ? "bg-danger"
        : "bg-muted";
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
