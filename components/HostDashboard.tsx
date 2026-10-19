"use client";

import {
  LiveKitRoom,
  useConnectionState,
  useParticipants,
  useRoomContext,
  useRoomInfo,
  useTracks,
  VideoTrack,
  type TrackReference,
} from "@livekit/components-react";
import {
  ConnectionState,
  DisconnectReason,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type RoomOptions,
} from "livekit-client";
import {
  Bell,
  BellOff,
  Cast,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  LayoutGrid,
  LoaderCircle,
  Pin,
  PinOff,
  Plus,
  Power,
  ScreenShare,
  Search,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import Logo from "@/components/Logo";
import {
  connectionErrorMessage,
  endRoom,
  fetchToken,
  removeParticipant,
  setSpotlight,
  type TokenResponse,
} from "@/lib/api";
import { AttendanceTracker } from "@/lib/attendance";
import { parseRoomState } from "@/lib/room-state";
import PeoplePanel from "./host/PeoplePanel";
import ScreenTile from "./host/ScreenTile";
import { Avatar, ConfirmDialog, displayName, SignalBars, Toasts, type Toast } from "./host/ui";
import InvitePanel from "./InvitePanel";

const PAGE_SIZE = 25;

// adaptiveStream sends each tile the quality that fits its size on screen and
// pauses video for tiles that are hidden (other pages, or behind full-size view).
const roomOptions: RoomOptions = { adaptiveStream: true, dynacast: true };

export default function HostDashboard({ code, hostKey }: { code: string; hostKey: string }) {
  const [connection, setConnection] = useState<TokenResponse | null>(null);
  const [error, setError] = useState("");
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchToken({ room: code, role: "host", hostKey })
      .then((res) => !cancelled && setConnection(res))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [code, hostKey]);

  function handleDisconnected(reason?: DisconnectReason) {
    if (reason === DisconnectReason.ROOM_DELETED) setEnded(true);
    if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
      setError("This room was opened as host in another tab or device.");
    }
  }

  if (ended) {
    return <SessionEnded code={code} />;
  }

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="max-w-md text-danger">{error}</p>
        <Link href="/" className="text-sm text-muted underline">
          Back to home
        </Link>
      </main>
    );
  }

  if (!connection) {
    return (
      <main className="flex flex-1 items-center justify-center gap-2 text-muted">
        <LoaderCircle className="size-4 animate-spin" /> Starting your room…
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
      onDisconnected={handleDisconnected}
      className="flex h-dvh flex-col"
    >
      <HostView code={code} hostKey={hostKey} onEnded={() => setEnded(true)} />
    </LiveKitRoom>
  );
}

type Panel = "people" | "invite" | null;
type Confirm = { kind: "end" } | { kind: "remove"; identity: string; name: string } | null;

function HostView({
  code,
  hostKey,
  onEnded,
}: {
  code: string;
  hostKey: string;
  onEnded: () => void;
}) {
  const room = useRoomContext();
  const state = useConnectionState();
  const participants = useParticipants().filter((p) => !p.isLocal);
  const allScreens = useTracks([Track.Source.ScreenShare]).filter((t) => !t.participant.isLocal);
  const { metadata } = useRoomInfo();
  const { spotlight } = parseRoomState(metadata);

  const [tracker] = useState(() => new AttendanceTracker());
  useEffect(() => tracker.attach(room), [room, tracker]);
  const records = useSyncExternalStore(tracker.subscribe, tracker.getSnapshot, tracker.getSnapshot);

  const [search, setSearch] = useState("");
  const [pinned, setPinned] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [maximizedSid, setMaximizedSid] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("invite");
  const [alertsOn, setAlertsOn] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  function notify(text: string, tone: Toast["tone"] = "info") {
    const id = ++toastId.current;
    setToasts((list) => [...list.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 6000);
  }

  useStopSharingAlerts(alertsOn, notify);

  // Pinned screens first, then everyone else in join order; search filters both.
  const query = search.trim().toLowerCase();
  const matches = (name: string) => !query || name.toLowerCase().includes(query);
  const screens = allScreens
    .filter((t) => matches(displayName(t.participant)))
    .sort(
      (a, b) =>
        Number(pinned.includes(b.participant.identity)) -
        Number(pinned.includes(a.participant.identity)),
    );

  const pageCount = Math.max(1, Math.ceil(screens.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageScreens = screens.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const maximizedIndex = screens.findIndex((t) => t.publication.trackSid === maximizedSid);
  const maximized = maximizedIndex >= 0 ? screens[maximizedIndex] : null;

  const sharingIds = new Set(allScreens.map((t) => t.participant.identity));
  const waiting = participants.filter(
    (p) => !sharingIds.has(p.identity) && matches(displayName(p)),
  );
  const spotlightName = spotlight
    ? (participants.find((p) => p.identity === spotlight)?.name ?? "Someone")
    : null;

  function togglePin(identity: string) {
    setPinned((list) =>
      list.includes(identity) ? list.filter((id) => id !== identity) : [...list, identity],
    );
  }

  async function changeSpotlight(identity: string | null) {
    try {
      await setSpotlight({ room: code, hostKey, identity });
    } catch (err) {
      notify(err instanceof Error ? err.message : "Couldn't update. Try again.", "error");
    }
  }

  function actionsFor(screen: TrackReference) {
    const { identity } = screen.participant;
    return {
      onEnlarge: () => setMaximizedSid(screen.publication.trackSid),
      onTogglePin: () => togglePin(identity),
      onToggleSpotlight: () => changeSpotlight(spotlight === identity ? null : identity),
      onRemove: () =>
        setConfirm({ kind: "remove", identity, name: displayName(screen.participant) }),
    };
  }

  async function confirmRemove(identity: string, name: string) {
    if (spotlight === identity) await setSpotlight({ room: code, hostKey, identity: null });
    await removeParticipant({ room: code, hostKey, identity });
    setConfirm(null);
    notify(`${name} was removed`);
  }

  async function confirmEnd() {
    await endRoom({ room: code, hostKey });
    onEnded();
  }

  function step(delta: number) {
    if (maximizedIndex < 0 || screens.length === 0) return;
    const next = (maximizedIndex + delta + screens.length) % screens.length;
    setMaximizedSid(screens[next].publication.trackSid);
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (confirm) return;
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

  const hereCount = records.filter((r) => !r.leftAt).length;

  return (
    <>
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border bg-surface px-4 py-3 sm:px-5">
        <Logo />
        <span className="hidden h-6 w-px bg-border sm:block" />
        <RoomCodeChip code={code} />
        <div className="flex items-center gap-2">
          <Stat icon={<Users className="size-3.5" />} value={participants.length} label="joined" />
          <Stat icon={<ScreenShare className="size-3.5" />} value={allScreens.length} label="sharing" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ConnectionBadge state={state} />
          <PanelButton
            active={panel === "people"}
            onClick={() => setPanel((p) => (p === "people" ? null : "people"))}
          >
            <Users className="size-4" /> People
            <span className="rounded bg-surface-3 px-1.5 text-xs tabular-nums">{hereCount}</span>
          </PanelButton>
          <PanelButton
            active={panel === "invite"}
            onClick={() => setPanel((p) => (p === "invite" ? null : "invite"))}
          >
            <UserPlus className="size-4" /> Invite
          </PanelButton>
          <button
            onClick={() => setConfirm({ kind: "end" })}
            className="flex items-center gap-2 rounded-lg border border-danger/40 px-3 py-1.5 text-sm text-danger transition hover:bg-danger-soft"
          >
            <Power className="size-4" /> End session
          </button>
        </div>
      </header>

      {spotlight && (
        <div className="flex items-center gap-3 border-b border-accent/40 bg-accent-soft px-4 py-2 text-sm sm:px-5">
          <Cast className="size-4 text-accent" />
          <span>
            Showing <strong className="font-medium">{spotlightName}</strong>&apos;s screen to
            everyone
            {!sharingIds.has(spotlight) && (
              <span className="text-muted"> · not sharing right now</span>
            )}
          </span>
          <button
            onClick={() => changeSpotlight(null)}
            className="ml-auto rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white transition hover:bg-accent-hover"
          >
            Stop showing
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <main className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ${maximized ? "hidden" : ""}`}>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name"
                aria-label="Search by name"
                className="w-full rounded-lg border border-border bg-surface py-2 pr-8 pl-9 text-sm outline-none transition placeholder:text-muted focus:border-accent"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </label>
            <button
              onClick={() => setAlertsOn((on) => !on)}
              aria-pressed={alertsOn}
              title={alertsOn ? "Alerts on: you'll see when someone stops sharing" : "Alerts off"}
              className={`ml-auto flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                alertsOn
                  ? "border-success bg-success text-white hover:opacity-90"
                  : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground"
              }`}
            >
              {alertsOn ? <Bell className="size-4" /> : <BellOff className="size-4" />}
              Alerts
            </button>
          </div>

          {allScreens.length === 0 ? (
            <EmptyState joinedCount={participants.length} />
          ) : screens.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">
              No one sharing matches &ldquo;{search}&rdquo;.
            </p>
          ) : (
            <ScreenGrid
              screens={pageScreens}
              pinned={pinned}
              spotlight={spotlight}
              actionsFor={actionsFor}
            />
          )}

          {pageCount > 1 && (
            <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
          )}

          {waiting.length > 0 && (
            <section className="mt-8">
              <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">
                Joined, not sharing yet · {waiting.length}
              </p>
              <div className="flex flex-wrap gap-2">
                {waiting.map((p) => (
                  <span
                    key={p.identity}
                    className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pr-3 pl-1 text-sm"
                  >
                    <Avatar name={displayName(p)} />
                    {displayName(p)}
                  </span>
                ))}
              </div>
            </section>
          )}
        </main>

        {maximized && (
          <MaximizedView
            screen={maximized}
            position={maximizedIndex + 1}
            total={screens.length}
            pinned={pinned.includes(maximized.participant.identity)}
            spotlighted={spotlight === maximized.participant.identity}
            actions={actionsFor(maximized)}
            onClose={() => setMaximizedSid(null)}
            onStep={step}
          />
        )}

        {!maximized && panel === "invite" && <InvitePanel code={code} />}
        {!maximized && panel === "people" && (
          <PeoplePanel
            code={code}
            records={records}
            search={search}
            onRemove={(r) => setConfirm({ kind: "remove", identity: r.identity, name: r.name })}
          />
        )}
      </div>

      {confirm?.kind === "end" && (
        <ConfirmDialog
          icon={<Power className="size-5" />}
          title="End this session for everyone?"
          body={
            participants.length === 0
              ? "The room will close and the code will stop working."
              : `${participants.length} ${participants.length === 1 ? "person" : "people"} will be disconnected and their screen sharing will stop. Export attendance first if you need it.`
          }
          confirmLabel="End for everyone"
          onConfirm={confirmEnd}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === "remove" && (
        <ConfirmDialog
          icon={<UserX className="size-5" />}
          title={`Remove ${confirm.name}?`}
          body="They'll be disconnected and their screen sharing will stop. They can join again with the room code."
          confirmLabel="Remove"
          onConfirm={() => confirmRemove(confirm.identity, confirm.name)}
          onCancel={() => setConfirm(null)}
        />
      )}

      <Toasts toasts={toasts} onDismiss={(id) => setToasts((l) => l.filter((t) => t.id !== id))} />
    </>
  );
}

// Pops up "Ravi stopped sharing" (or "left") while alerts are switched on.
function useStopSharingAlerts(enabled: boolean, notify: (text: string) => void) {
  const room = useRoomContext();
  const onNotify = useEffectEvent(notify);

  useEffect(() => {
    if (!enabled) return;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    function onUnpublish(pub: RemoteTrackPublication, p: RemoteParticipant) {
      if (pub.source !== Track.Source.ScreenShare) return;
      const name = displayName(p);
      // Leaving also unpublishes, so wait a moment to tell the two apart.
      const timer = setTimeout(() => {
        timers.delete(timer);
        onNotify(
          room.remoteParticipants.has(p.identity)
            ? `${name} stopped sharing`
            : `${name} left while sharing`,
        );
      }, 500);
      timers.add(timer);
    }
    room.on(RoomEvent.TrackUnpublished, onUnpublish);
    return () => {
      room.off(RoomEvent.TrackUnpublished, onUnpublish);
      timers.forEach(clearTimeout);
    };
  }, [enabled, room]);
}

function PanelButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`hidden items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition md:flex ${
        active ? "border-accent bg-accent-soft text-accent" : "border-border hover:border-border-strong"
      }`}
    >
      {children}
    </button>
  );
}

function RoomCodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={copy}
      title="Copy room code"
      className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-1 transition hover:border-border-strong"
    >
      <span className="text-xs text-muted">Room</span>
      <span className="font-mono text-sm tracking-[0.2em]">{code}</span>
      {copied ? (
        <Check className="size-3.5 text-success" />
      ) : (
        <Copy className="size-3.5 text-muted" />
      )}
    </button>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-sm text-muted">
      {icon}
      <strong className="font-medium text-foreground tabular-nums">{value}</strong> {label}
    </span>
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
  pinned,
  spotlight,
  actionsFor,
}: {
  screens: TrackReference[];
  pinned: string[];
  spotlight: string | null;
  actionsFor: (screen: TrackReference) => React.ComponentProps<typeof ScreenTile>["actions"];
}) {
  const single = screens.length === 1;
  return (
    <div
      className={`grid gap-3 ${single ? "mx-auto max-w-5xl" : ""}`}
      style={{ gridTemplateColumns: `repeat(${gridColumns(screens.length)}, minmax(0, 1fr))` }}
    >
      {screens.map((screen) => (
        <ScreenTile
          key={screen.publication.trackSid}
          screen={screen}
          pinned={pinned.includes(screen.participant.identity)}
          spotlighted={spotlight === screen.participant.identity}
          actions={actionsFor(screen)}
        />
      ))}
    </div>
  );
}

function MaximizedView({
  screen,
  position,
  total,
  pinned,
  spotlighted,
  actions,
  onClose,
  onStep,
}: {
  screen: TrackReference;
  position: number;
  total: number;
  pinned: boolean;
  spotlighted: boolean;
  actions: React.ComponentProps<typeof ScreenTile>["actions"];
  onClose: () => void;
  onStep: (delta: number) => void;
}) {
  const name = displayName(screen.participant);
  const iconButton =
    "flex size-8 items-center justify-center rounded-lg border border-border transition hover:border-border-strong disabled:opacity-40";
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-black">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-2">
        <Avatar name={name} />
        <span className="truncate font-medium">{name}</span>
        <SignalBars participant={screen.participant} />
        <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted tabular-nums">
          {position} / {total}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={actions.onTogglePin} className={iconButton} title={pinned ? "Unpin" : "Pin to top"}>
            {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
          </button>
          <button
            onClick={actions.onToggleSpotlight}
            className={`flex h-8 items-center gap-2 rounded-lg border px-3 text-sm transition ${
              spotlighted
                ? "border-accent bg-accent-soft text-accent"
                : "border-border hover:border-border-strong"
            }`}
          >
            <Cast className="size-4" />
            {spotlighted ? "Stop showing" : "Show to everyone"}
          </button>
          <button
            onClick={actions.onRemove}
            className={`${iconButton} hover:border-danger/50 hover:text-danger`}
            title={`Remove ${name}`}
          >
            <UserX className="size-4" />
          </button>
          <span className="mx-1 h-6 w-px bg-border" />
          <button
            onClick={() => onStep(-1)}
            disabled={total < 2}
            className={iconButton}
            aria-label="Previous screen"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => onStep(1)}
            disabled={total < 2}
            className={iconButton}
            aria-label="Next screen"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            <LayoutGrid className="size-4" /> Back to grid
          </button>
        </div>
      </div>
      <button onClick={onClose} className="min-h-0 flex-1" aria-label="Back to grid">
        <VideoTrack trackRef={screen} className="size-full object-contain" />
      </button>
      <p className="hidden bg-surface py-1.5 text-center text-xs text-muted sm:block">
        Use ← → to switch screens · Esc to go back
      </p>
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
    <div className="mt-5 flex items-center justify-center gap-3 text-sm">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
        className="flex size-8 items-center justify-center rounded-lg border border-border transition hover:border-border-strong disabled:opacity-40"
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="text-muted tabular-nums">
        Page {page + 1} of {pageCount}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount - 1}
        className="flex size-8 items-center justify-center rounded-lg border border-border transition hover:border-border-strong disabled:opacity-40"
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

function EmptyState({ joinedCount }: { joinedCount: number }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="grid grid-cols-2 gap-2" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-10 w-16 rounded-md border border-dashed border-border-strong bg-surface"
          />
        ))}
      </div>
      <p className="mt-6 text-lg font-medium">Waiting for screens</p>
      <p className="mt-2 max-w-sm text-sm text-muted">
        {joinedCount === 0
          ? "Share the room code. Screens appear here as soon as people start sharing."
          : `${joinedCount} joined. Their screens appear here when they click “Share my screen”.`}
      </p>
    </div>
  );
}

function ConnectionBadge({ state }: { state: ConnectionState }) {
  if (state === ConnectionState.Connected) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold tracking-wide text-danger">
        <span className="size-1.5 animate-pulse rounded-full bg-danger" /> LIVE
      </span>
    );
  }
  const label =
    state === ConnectionState.Reconnecting
      ? "Reconnecting…"
      : state === ConnectionState.Disconnected
        ? "Disconnected"
        : "Connecting…";
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-1 text-xs text-muted">
      <span className="size-1.5 rounded-full bg-current" /> {label}
    </span>
  );
}

function SessionEnded({ code }: { code: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-surface-3 text-muted">
        <Power className="size-6" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold">Session ended</h1>
      <p className="mt-2 text-sm text-muted">
        Room <span className="font-mono tracking-widest">{code}</span> is closed and everyone has
        been disconnected.
      </p>
      <Link
        href="/"
        className="mt-6 flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition hover:bg-accent-hover"
      >
        <Plus className="size-4" /> Start a new session
      </Link>
    </main>
  );
}
