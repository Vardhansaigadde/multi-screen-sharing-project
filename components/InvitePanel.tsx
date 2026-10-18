"use client";

import { Check, Copy, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState, useSyncExternalStore } from "react";

function useOrigin() {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
}

export default function InvitePanel({ code }: { code: string }) {
  const origin = useOrigin();
  const [copied, setCopied] = useState(false);
  const joinUrl = origin ? `${origin}/room/${code}` : "";
  const isLocalhost = /\/\/(localhost|127\.0\.0\.1)/.test(origin);

  async function copy() {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-5 overflow-y-auto border-l border-border bg-surface p-5 md:flex">
      <div>
        <p className="text-sm font-medium">Invite people</p>
        <p className="mt-0.5 text-xs text-muted">Scan with a phone camera, then open on a laptop.</p>
      </div>

      <div className="self-center rounded-2xl bg-white p-3">
        {joinUrl ? (
          <QRCodeSVG value={joinUrl} size={200} />
        ) : (
          <div className="size-[200px]" />
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface-2 p-3 text-center">
        <p className="text-[11px] tracking-wide text-muted uppercase">Room code</p>
        <p className="mt-1 font-mono text-3xl tracking-[0.3em]">{code}</p>
      </div>

      <button
        onClick={copy}
        disabled={!joinUrl}
        className="flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition hover:border-border-strong"
      >
        {copied ? (
          <>
            <Check className="size-4 text-success" /> Link copied
          </>
        ) : (
          <>
            <Copy className="size-4" /> Copy join link
          </>
        )}
      </button>

      <p className="flex gap-2 text-xs text-muted">
        <Smartphone className="mt-0.5 size-3.5 shrink-0" />
        Phones can join, but screen sharing works from laptops.
      </p>

      {isLocalhost && (
        <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted">
          This link uses localhost, so it only works on this computer. Use the deployed site so
          other devices can join.
        </p>
      )}
    </aside>
  );
}
