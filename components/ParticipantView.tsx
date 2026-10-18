"use client";

import { LiveKitRoom, useConnectionState, useLocalParticipant } from "@livekit/components-react";
import { ConnectionState, ScreenSharePresets, type RoomOptions } from "livekit-client";
import {
  ArrowRight,
  LoaderCircle,
  LogOut,
  MonitorOff,
  ScreenShare,
  ScreenShareOff,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import Logo from "@/components/Logo";
import { connectionErrorMessage, fetchToken, type TokenResponse } from "@/lib/api";

const roomOptions: RoomOptions = { dynacast: true };

// Grid tiles on the host dashboard use the small 360p layer; the full-size
// view uses the 1080p one. Dynacast stops sending a layer nobody is watching.
const screenSharePublishOptions = {
  screenShareEncoding: ScreenSharePresets.h1080fps15.encoding,
  screenShareSimulcastLayers: [ScreenSharePresets.h360fps15],
};

function canShareScreen() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
}

function useCanShareScreen() {
  return useSyncExternalStore(
    () => () => {},
    canShareScreen,
    () => true,
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center px-4 py-4 sm:px-6">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">{children}</main>
    </div>
  );
}

export default function ParticipantView({
  code,
  initialName,
}: {
  code: string;
  initialName: string;
}) {
  const [name, setName] = useState(initialName);
  const [connection, setConnection] = useState<TokenResponse | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  async function join(e?: React.FormEvent) {
    e?.preventDefault();
    if (!name.trim()) return;
    setJoining(true);
    setError("");
    try {
      setConnection(await fetchToken({ room: code, role: "participant", name: name.trim() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join. Try again.");
    } finally {
      setJoining(false);
    }
  }

  if (!connection) {
    return (
      <PageShell>
        <form
          onSubmit={join}
          className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6"
        >
          <p className="text-sm text-muted">You&apos;re joining room</p>
          <p className="mt-1 font-mono text-3xl tracking-[0.3em]">{code}</p>
          <label className="mt-6 block text-sm text-muted" htmlFor="name">
            Your name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Asha Reddy"
            maxLength={32}
            autoFocus
            className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 outline-none transition placeholder:text-muted focus:border-accent"
          />
          <button
            type="submit"
            disabled={joining || !name.trim()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
          >
            {joining ? (
              <>
                <LoaderCircle className="size-4 animate-spin" /> Joining…
              </>
            ) : (
              <>
                Join room <ArrowRight className="size-4" />
              </>
            )}
          </button>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </form>
      </PageShell>
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
      onDisconnected={() => setConnection(null)}
      onError={(err) => setError(connectionErrorMessage(err))}
      className="flex flex-1 flex-col"
    >
      <PageShell>
        <ShareControls code={code} name={name.trim()} />
      </PageShell>
    </LiveKitRoom>
  );
}

function ShareControls({ code, name }: { code: string; name: string }) {
  const state = useConnectionState();
  const { localParticipant, isScreenShareEnabled } = useLocalParticipant();
  const supported = useCanShareScreen();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggleShare() {
    setBusy(true);
    setError("");
    try {
      await localParticipant.setScreenShareEnabled(
        !isScreenShareEnabled,
        { audio: false, contentHint: "detail", selfBrowserSurface: "exclude" },
        screenSharePublishOptions,
      );
    } catch (err) {
      // Closing the browser's picker without choosing a screen is not an error.
      if (!(err instanceof Error && err.name === "NotAllowedError")) {
        setError(err instanceof Error ? err.message : "Couldn't share your screen. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  const connected = state === ConnectionState.Connected;
  const sharing = isScreenShareEnabled;

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate text-muted">{name}</span>
        <span className="font-mono tracking-widest text-muted">{code}</span>
      </div>

      <div className="mt-8 flex flex-col items-center text-center">
        <div className="relative">
          {sharing && (
            <span className="absolute inset-0 animate-ping rounded-full bg-danger/30" />
          )}
          <div
            className={`relative flex size-20 items-center justify-center rounded-full ${
              sharing ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent"
            }`}
          >
            {supported ? (
              <ScreenShare className="size-9" />
            ) : (
              <MonitorOff className="size-9" />
            )}
          </div>
        </div>

        <StatusPill state={state} sharing={sharing} />

        <p className="mt-3 text-lg font-medium">
          {!supported
            ? "Screen sharing isn't available here"
            : sharing
              ? "Your screen is live"
              : "Ready to share"}
        </p>
        <p className="mt-1 text-sm text-muted">
          {!supported
            ? "Join from a laptop using Chrome, Edge or Firefox."
            : sharing
              ? "The host can see your screen now."
              : "Choose a screen or window to show the host."}
        </p>
      </div>

      {supported && (
        <button
          onClick={toggleShare}
          disabled={!connected || busy}
          className={`mt-8 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium text-white transition disabled:opacity-60 ${
            sharing ? "bg-danger hover:opacity-90" : "bg-accent hover:bg-accent-hover"
          }`}
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : sharing ? (
            <ScreenShareOff className="size-4" />
          ) : (
            <ScreenShare className="size-4" />
          )}
          {sharing ? "Stop sharing" : "Share my screen"}
        </button>
      )}

      {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <Shield className="size-3.5" /> Only the host can see your screen
        </span>
        <Link href="/" className="flex items-center gap-1 transition hover:text-foreground">
          <LogOut className="size-3.5" /> Leave
        </Link>
      </div>
    </div>
  );
}

function StatusPill({ state, sharing }: { state: ConnectionState; sharing: boolean }) {
  const connected = state === ConnectionState.Connected;
  const label = sharing
    ? "Sharing"
    : connected
      ? "Connected"
      : state === ConnectionState.Reconnecting
        ? "Reconnecting…"
        : "Connecting…";
  const tone = sharing
    ? "bg-danger-soft text-danger"
    : connected
      ? "bg-success-soft text-success"
      : "bg-surface-3 text-muted";
  return (
    <span
      className={`mt-6 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
