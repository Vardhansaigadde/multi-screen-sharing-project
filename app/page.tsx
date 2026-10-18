"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createRoom, normalizeRoomCode } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  async function handleCreate() {
    setCreating(true);
    setCreateError("");
    try {
      const room = await createRoom();
      router.push(`/host/${room.code}?key=${room.hostKey}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create room");
      setCreating(false);
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const roomCode = normalizeRoomCode(code);
    if (!roomCode || !name.trim()) return;
    router.push(`/room/${roomCode}?name=${encodeURIComponent(name.trim())}`);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">ScreenHub</h1>
        <p className="mt-3 text-muted">
          Every shared screen, live, in one place. Click any screen to see it full size.
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        <section className="flex flex-col rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-lg font-medium">Host a session</h2>
          <p className="mt-1 flex-1 text-sm text-muted">
            Create a room and watch everyone&apos;s screen from your dashboard.
          </p>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="mt-6 rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
          >
            {creating ? "Creating…" : "Create room"}
          </button>
          {createError && <p className="mt-3 text-sm text-danger">{createError}</p>}
        </section>

        <form
          onSubmit={handleJoin}
          className="flex flex-col rounded-2xl border border-border bg-surface p-6"
        >
          <h2 className="text-lg font-medium">Join a session</h2>
          <p className="mt-1 text-sm text-muted">Enter the room code from your host.</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={32}
            className="mt-4 rounded-lg border border-border bg-surface-2 px-3 py-2.5 outline-none focus:border-accent"
          />
          <input
            value={code}
            onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
            placeholder="Room code"
            maxLength={6}
            className="mt-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 font-mono tracking-widest uppercase outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!name.trim() || code.length !== 6}
            className="mt-4 rounded-lg border border-border bg-surface-2 px-4 py-2.5 font-medium transition hover:border-accent disabled:opacity-50"
          >
            Join room
          </button>
        </form>
      </div>
    </main>
  );
}
