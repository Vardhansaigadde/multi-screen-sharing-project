"use client";

import { VideoTrack, type TrackReference } from "@livekit/components-react";
import { Cast, Maximize2, MoreVertical, Pin, PinOff, UserX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { displayName, SignalBars } from "./ui";

export type TileActions = {
  onEnlarge: () => void;
  onTogglePin: () => void;
  onToggleSpotlight: () => void;
  onRemove: () => void;
};

export default function ScreenTile({
  screen,
  pinned,
  spotlighted,
  actions,
}: {
  screen: TrackReference;
  pinned: boolean;
  spotlighted: boolean;
  actions: TileActions;
}) {
  const name = displayName(screen.participant);
  return (
    <div
      className={`group relative aspect-video overflow-hidden rounded-xl border bg-black transition ${
        spotlighted ? "border-accent ring-2 ring-accent/40" : "border-border hover:border-accent"
      }`}
    >
      <button
        onClick={actions.onEnlarge}
        aria-label={`Enlarge ${name}'s screen`}
        className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
      >
        <VideoTrack trackRef={screen} className="size-full object-contain" />
      </button>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pt-6 pb-2">
        <SignalBars participant={screen.participant} />
        <span className="truncate text-xs font-medium text-white">{name}</span>
        {pinned && <Pin className="size-3 shrink-0 fill-white text-white" aria-label="Pinned" />}
      </div>

      {spotlighted && (
        <span className="pointer-events-none absolute top-2 left-2 flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium text-white">
          <Cast className="size-3" /> Shown to all
        </span>
      )}

      <div className="absolute top-2 right-2">
        <TileMenu name={name} pinned={pinned} spotlighted={spotlighted} actions={actions} />
      </div>
    </div>
  );
}

// "⋮" button with the tile's actions. The menu renders in a portal so small
// tiles don't clip it.
function TileMenu({
  name,
  pinned,
  spotlighted,
  actions,
}: {
  name: string;
  pinned: boolean;
  spotlighted: boolean;
  actions: TileActions;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const open = position !== null;

  function toggle() {
    if (open) {
      setPosition(null);
      return;
    }
    const rect = buttonRef.current!.getBoundingClientRect();
    setPosition({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setPosition(null);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  function run(action: () => void) {
    setPosition(null);
    action();
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-label={`Options for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex size-7 items-center justify-center rounded-md text-white transition ${
          open
            ? "bg-black/90 opacity-100"
            : "bg-black/60 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-black/90 [@media(hover:none)]:opacity-100"
        }`}
      >
        <MoreVertical className="size-4" />
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPosition(null)} />
            <div
              role="menu"
              style={{ top: position.top, right: position.right }}
              className="fixed z-50 w-52 overflow-hidden rounded-xl border border-border-strong bg-surface-2 py-1 text-sm shadow-xl shadow-black/50"
            >
              <MenuItem icon={<Maximize2 className="size-4" />} onClick={() => run(actions.onEnlarge)}>
                Enlarge
              </MenuItem>
              <MenuItem
                icon={pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                onClick={() => run(actions.onTogglePin)}
              >
                {pinned ? "Unpin" : "Pin to top"}
              </MenuItem>
              <MenuItem icon={<Cast className="size-4" />} onClick={() => run(actions.onToggleSpotlight)}>
                {spotlighted ? "Stop showing to everyone" : "Show to everyone"}
              </MenuItem>
              <div className="my-1 h-px bg-border" />
              <MenuItem icon={<UserX className="size-4" />} onClick={() => run(actions.onRemove)} danger>
                Remove {name}
              </MenuItem>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

function MenuItem({
  icon,
  onClick,
  danger,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-surface-3 ${
        danger ? "text-danger" : ""
      }`}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}
