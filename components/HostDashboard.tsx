"use client";

import {
  LiveKitRoom,
  useConnectionState,
  useParticipants,
  useTracks,
  VideoTrack,
  type TrackReference,
} from "@livekit/components-react";
import {
  ConnectionState,
  DisconnectReason,
  Track,
  type Participant,
  type RoomOptions,
} from "livekit-client";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  LayoutGrid,
  LoaderCircle,
  Maximize2,
  Plus,
  Power,
  QrCode,
  ScreenShare,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import Logo from "@/components/Logo";
import { connectionErrorMessage, endRoom, fetchToken, type TokenResponse } from "@/lib/api";
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
      onDisconnected={(reason) => reason === DisconnectReason.ROOM_DELETED && setEnded(true)}
      className="flex h-dvh flex-col"
    >
      <HostView code={code} hostKey={hostKey} onEnded={() => setEnded(true)} />
    </LiveKitRoom>
  );
}

function displayName(p: Participant) {
  return p.name || p.identity;
}

function HostView({
  code,
  hostKey,
  onEnded,
}: {
  code: string;
  hostKey: string;
  onEnded: () => void;
}) {
  const state = useConnectionState();
  const participants = useParticipants().filter((p) => !p.isLocal);
  const screens = useTracks([Track.Source.ScreenShare]).filter((t) => !t.participant.isLocal);
  const [page, setPage] = useState(0);
  const [maximizedSid, setMaximizedSid] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(true);
  const [confirmingEnd, setConfirmingEnd] = useState(false);

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
    if (confirmingEnd) return;
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
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border bg-surface px-4 py-3 sm:px-5">
        <Logo />
        <span className="hidden h-6 w-px bg-border sm:block" />
        <RoomCodeChip code={code} />
        <div className="flex items-center gap-2">
          <Stat icon={<Users className="size-3.5" />} value={participants.length} label="joined" />
          <Stat icon={<ScreenShare className="size-3.5" />} value={screens.length} label="sharing" />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <ConnectionBadge state={state} />
          <button
            onClick={() => setShowInvite((v) => !v)}
            className={`hidden items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition md:flex ${
              showInvite
                ? "border-accent bg-accent-soft text-accent"
                : "border-border hover:border-border-strong"
            }`}
          >
            <QrCode className="size-4" /> Invite
          </button>
          <button
            onClick={() => setConfirmingEnd(true)}
            className="flex items-center gap-2 rounded-lg border border-danger/40 px-3 py-1.5 text-sm text-danger transition hover:bg-danger-soft"
          >
            <Power className="size-4" /> End session
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ${maximized ? "hidden" : ""}`}>
          {screens.length === 0 ? (
            <EmptyState joinedCount={participants.length} />
          ) : (
            <ScreenGrid screens={pageScreens} onSelect={setMaximizedSid} />
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
            onClose={() => setMaximizedSid(null)}
            onStep={step}
          />
        )}

        {showInvite && !maximized && <InvitePanel code={code} />}
      </div>

      {confirmingEnd && (
        <EndSessionDialog
          code={code}
          hostKey={hostKey}
          joinedCount={participants.length}
          onCancel={() => setConfirmingEnd(false)}
          onEnded={onEnded}
        />
      )}
    </>
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

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-medium text-accent">
      {initials}
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
  onSelect,
}: {
  screens: TrackReference[];
  onSelect: (sid: string) => void;
}) {
  const single = screens.length === 1;
  return (
    <div
      className={`grid gap-3 ${single ? "mx-auto max-w-5xl" : ""}`}
      style={{ gridTemplateColumns: `repeat(${gridColumns(screens.length)}, minmax(0, 1fr))` }}
    >
      {screens.map((screen) => (
        <button
          key={screen.publication.trackSid}
          onClick={() => onSelect(screen.publication.trackSid)}
          className="group relative aspect-video overflow-hidden rounded-xl border border-border bg-black text-left ring-accent transition outline-none hover:border-accent focus-visible:ring-2"
        >
          <VideoTrack trackRef={screen} className="size-full object-contain" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pt-6 pb-2">
            <span className="size-1.5 shrink-0 rounded-full bg-danger" />
            <span className="truncate text-xs font-medium text-white">
              {displayName(screen.participant)}
            </span>
          </div>
          <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition group-hover:opacity-100">
            <Maximize2 className="size-3.5" />
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
  const name = displayName(screen.participant);
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-black">
      <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2">
        <Avatar name={name} />
        <span className="truncate font-medium">{name}</span>
        <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted tabular-nums">
          {position} / {total}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => onStep(-1)}
            disabled={total < 2}
            className="flex size-8 items-center justify-center rounded-lg border border-border transition hover:border-border-strong disabled:opacity-40"
            aria-label="Previous screen"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => onStep(1)}
            disabled={total < 2}
            className="flex size-8 items-center justify-center rounded-lg border border-border transition hover:border-border-strong disabled:opacity-40"
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
          ? "Share the room code or QR code. Screens appear here as soon as people start sharing."
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

function EndSessionDialog({
  code,
  hostKey,
  joinedCount,
  onCancel,
  onEnded,
}: {
  code: string;
  hostKey: string;
  joinedCount: number;
  onCancel: () => void;
  onEnded: () => void;
}) {
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function end() {
    setEnding(true);
    setError("");
    try {
      await endRoom({ room: code, hostKey });
      onEnded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't end the session. Try again.");
      setEnding(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="end-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6"
      >
        <div className="flex size-10 items-center justify-center rounded-xl bg-danger-soft text-danger">
          <Power className="size-5" />
        </div>
        <h2 id="end-title" className="mt-4 text-lg font-medium">
          End this session for everyone?
        </h2>
        <p className="mt-1 text-sm text-muted">
          {joinedCount === 0
            ? "The room will close and the code will stop working."
            : `${joinedCount} ${joinedCount === 1 ? "person" : "people"} will be disconnected and their screen sharing will stop.`}
        </p>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            autoFocus
            className="rounded-lg border border-border px-4 py-2 text-sm transition hover:border-border-strong"
          >
            Cancel
          </button>
          <button
            onClick={end}
            disabled={ending}
            className="flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {ending && <LoaderCircle className="size-4 animate-spin" />}
            End for everyone
          </button>
        </div>
      </div>
    </div>
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
