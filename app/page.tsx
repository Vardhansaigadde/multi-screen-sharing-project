"use client";

import { ArrowRight, LoaderCircle, Monitor, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "@/components/Logo";
import { createRoom, normalizeRoomCode } from "@/lib/api";
import { APP_NAME } from "@/lib/brand";

const steps = [
  { title: "Create a room", text: "You get a room code and QR code." },
  { title: "Everyone shares", text: "People join from their laptops and share." },
  { title: "Watch every screen", text: "See them all live. Click one to enlarge it." },
];

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
      setCreateError(err instanceof Error ? err.message : "Couldn't create a room. Try again.");
      setCreating(false);
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const roomCode = normalizeRoomCode(code);
    if (!roomCode || !name.trim()) return;
    router.push(`/room/${roomCode}?name=${encodeURIComponent(name.trim())}`);
  }

  const canJoin = name.trim().length > 0 && code.length === 6;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />

      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="mb-12 flex flex-col items-center gap-4">
          <LogoMark className="size-14" />
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{APP_NAME}</h1>
        </div>

        <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
          <section className="flex flex-col rounded-2xl border border-border bg-surface/90 p-6 backdrop-blur">
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Monitor className="size-5" />
            </div>
            <h2 className="mt-4 text-lg font-medium">Host a session</h2>
            <p className="mt-1 flex-1 text-sm text-muted">
              Start a room and monitor everyone&apos;s screen from one dashboard.
            </p>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
            >
              {creating ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" /> Creating room…
                </>
              ) : (
                <>
                  Create room <ArrowRight className="size-4" />
                </>
              )}
            </button>
            {createError && <p className="mt-3 text-sm text-danger">{createError}</p>}
          </section>

          <form
            onSubmit={handleJoin}
            className="flex flex-col rounded-2xl border border-border bg-surface/90 p-6 backdrop-blur"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-surface-3 text-foreground">
              <Users className="size-5" />
            </div>
            <h2 className="mt-4 text-lg font-medium">Join a session</h2>
            <p className="mt-1 text-sm text-muted">Enter the code your host shared.</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              aria-label="Your name"
              maxLength={32}
              className="mt-4 rounded-lg border border-border bg-surface-2 px-3 py-2.5 outline-none transition placeholder:text-muted focus:border-accent"
            />
            <input
              value={code}
              onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
              placeholder="ROOM CODE"
              aria-label="Room code"
              maxLength={6}
              className="mt-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 font-mono tracking-[0.3em] uppercase outline-none transition placeholder:tracking-[0.2em] placeholder:text-muted focus:border-accent"
            />
            <button
              type="submit"
              disabled={!canJoin}
              className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface-3 px-4 py-2.5 font-medium transition hover:border-accent disabled:opacity-50"
            >
              Join room <ArrowRight className="size-4" />
            </button>
          </form>
        </div>

        <ol className="mt-12 grid w-full max-w-3xl gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong font-mono text-xs text-muted">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium">{step.title}</p>
                <p className="mt-0.5 text-sm text-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
