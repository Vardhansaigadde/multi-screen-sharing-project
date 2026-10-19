"use client";

import { Check, Copy } from "lucide-react";
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
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const joinUrl = origin ? `${origin}/room/${code}` : "";
  const siteName = origin.replace(/^https?:\/\//, "");
  const isLocalhost = /\/\/(localhost|127\.0\.0\.1)/.test(origin);

  async function copy(what: "code" | "link") {
    await navigator.clipboard.writeText(what === "code" ? code : joinUrl);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-5 overflow-y-auto border-l border-border bg-surface p-5 md:flex">
      <div>
        <p className="text-sm font-medium">Invite people</p>
        <p className="mt-0.5 text-xs text-muted">
          Ask everyone to open <span className="text-foreground">{siteName}</span> and enter this
          code.
        </p>
      </div>

      <button
        onClick={() => copy("code")}
        title="Copy room code"
        className="group rounded-xl border border-border bg-surface-2 p-4 text-center transition hover:border-border-strong"
      >
        <p className="text-[11px] tracking-wide text-muted uppercase">Room code</p>
        <p className="mt-1 font-mono text-4xl tracking-[0.25em]">{code}</p>
        <p className="mt-2 flex items-center justify-center gap-1 text-xs text-muted">
          {copied === "code" ? (
            <>
              <Check className="size-3.5 text-success" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" /> Click to copy
            </>
          )}
        </p>
      </button>

      <div>
        <p className="mb-1.5 text-xs text-muted">Or send them the direct link</p>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 py-1.5 pr-1.5 pl-3">
          <span className="min-w-0 flex-1 truncate font-mono text-xs">{joinUrl}</span>
          <button
            onClick={() => copy("link")}
            disabled={!joinUrl}
            aria-label="Copy join link"
            className="flex items-center gap-1 rounded-md bg-surface-3 px-2 py-1 text-xs transition hover:bg-border-strong"
          >
            {copied === "link" ? (
              <Check className="size-3.5 text-success" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied === "link" ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {isLocalhost && (
        <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted">
          This link uses localhost, so it only works on this computer. Use the deployed site so
          other devices can join.
        </p>
      )}
    </aside>
  );
}
