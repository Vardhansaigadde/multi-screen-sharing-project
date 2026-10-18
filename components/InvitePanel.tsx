"use client";

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
    <aside className="hidden w-72 shrink-0 flex-col items-center gap-4 overflow-y-auto border-l border-border bg-surface p-5 text-center md:flex">
      <p className="text-sm text-muted">Scan to join</p>
      <div className="rounded-xl bg-white p-3">
        {joinUrl && <QRCodeSVG value={joinUrl} size={196} />}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Room code</p>
        <p className="font-mono text-3xl tracking-widest">{code}</p>
      </div>
      <button
        onClick={copy}
        disabled={!joinUrl}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm transition hover:border-accent"
      >
        {copied ? "Copied!" : "Copy join link"}
      </button>
      {isLocalhost && (
        <p className="text-xs text-muted">
          This link uses localhost, so it only works on this computer. Open the app from your
          network address or the deployed site so other devices can join.
        </p>
      )}
    </aside>
  );
}
