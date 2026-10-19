"use client";

import { useConnectionQualityIndicator } from "@livekit/components-react";
import { ConnectionQuality, type Participant } from "livekit-client";
import { LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

export function displayName(p: Participant) {
  return p.name || p.identity;
}

export function Avatar({ name, className = "size-6" }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-medium text-accent ${className}`}
    >
      {initials}
    </span>
  );
}

const QUALITY = {
  [ConnectionQuality.Excellent]: { level: 3, color: "bg-success", label: "Excellent" },
  [ConnectionQuality.Good]: { level: 2, color: "bg-amber-400", label: "Good" },
  [ConnectionQuality.Poor]: { level: 1, color: "bg-danger", label: "Poor" },
  [ConnectionQuality.Lost]: { level: 0, color: "bg-danger", label: "Lost" },
  [ConnectionQuality.Unknown]: { level: 0, color: "bg-white/30", label: "Checking" },
};

// Three tiny bars, like a phone signal icon.
export function SignalBars({ participant }: { participant: Participant }) {
  const { quality } = useConnectionQualityIndicator({ participant });
  const { level, color, label } = QUALITY[quality] ?? QUALITY[ConnectionQuality.Unknown];
  return (
    <span
      title={`Connection: ${label}`}
      aria-label={`Connection: ${label}`}
      className="flex h-2.5 shrink-0 items-end gap-[2px]"
    >
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={`w-[3px] rounded-[1px] ${bar <= level ? color : "bg-white/25"}`}
          style={{ height: `${bar * 33.3}%` }}
        />
      ))}
    </span>
  );
}

export function ConfirmDialog({
  icon,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
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
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6"
      >
        <div className="flex size-10 items-center justify-center rounded-xl bg-danger-soft text-danger">
          {icon}
        </div>
        <h2 id="confirm-title" className="mt-4 text-lg font-medium">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted">{body}</p>
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
            onClick={confirm}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy && <LoaderCircle className="size-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export type Toast = { id: number; text: string; tone: "info" | "error" };

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-40 flex w-72 flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2 rounded-xl border bg-surface-2 px-3 py-2.5 text-sm shadow-lg shadow-black/40 ${
            t.tone === "error" ? "border-danger/50" : "border-border-strong"
          }`}
        >
          <span
            className={`mt-1.5 size-1.5 shrink-0 rounded-full ${t.tone === "error" ? "bg-danger" : "bg-amber-400"}`}
          />
          <span className="flex-1">{t.text}</span>
          <button
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
            className="text-muted transition hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
