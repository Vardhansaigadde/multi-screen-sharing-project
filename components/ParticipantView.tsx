"use client";

import { LiveKitRoom, useConnectionState, useLocalParticipant } from "@livekit/components-react";
import { ConnectionState, ScreenSharePresets, type RoomOptions } from "livekit-client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
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
      setError(err instanceof Error ? err.message : "Could not join");
    } finally {
      setJoining(false);
    }
  }

  if (!connection) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <form
          onSubmit={join}
          className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6"
        >
          <p className="text-sm text-muted">Joining room</p>
          <p className="mt-1 font-mono text-3xl tracking-widest">{code}</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={32}
            autoFocus
            className="mt-6 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={joining || !name.trim()}
            className="mt-4 w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
          >
            {joining ? "Joining…" : "Join"}
          </button>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </form>
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
      onDisconnected={() => setConnection(null)}
      onError={(err) => setError(connectionErrorMessage(err))}
      className="flex flex-1 items-center justify-center px-4 py-12"
    >
      <ShareControls code={code} name={name.trim()} />
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
        setError(err instanceof Error ? err.message : "Could not share screen");
      }
    } finally {
      setBusy(false);
    }
  }

  const connected = state === ConnectionState.Connected;

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center">
      <p className="text-sm text-muted">
        Room <span className="font-mono tracking-widest text-foreground">{code}</span> · {name}
      </p>

      <div className="mt-6 flex items-center justify-center gap-2 text-sm">
        <span
          className={`size-2.5 rounded-full ${
            isScreenShareEnabled ? "bg-danger animate-pulse" : connected ? "bg-success" : "bg-muted"
          }`}
        />
        {isScreenShareEnabled
          ? "Your screen is being shared with the host"
          : connected
            ? "Connected"
            : state === ConnectionState.Reconnecting
              ? "Reconnecting…"
              : "Connecting…"}
      </div>

      {supported ? (
        <button
          onClick={toggleShare}
          disabled={!connected || busy}
          className={`mt-6 w-full rounded-lg px-4 py-3 font-medium text-white transition disabled:opacity-60 ${
            isScreenShareEnabled ? "bg-danger hover:opacity-90" : "bg-accent hover:bg-accent-hover"
          }`}
        >
          {isScreenShareEnabled ? "Stop sharing" : "Share my screen"}
        </button>
      ) : (
        <p className="mt-6 rounded-lg bg-surface-2 p-3 text-sm text-muted">
          This browser can&apos;t share its screen. Please join from a laptop using Chrome, Edge
          or Firefox.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <p className="mt-6 text-xs text-muted">Only the host can see your screen.</p>
      <Link href="/" className="mt-2 inline-block text-xs text-muted underline">
        Leave
      </Link>
    </div>
  );
}
