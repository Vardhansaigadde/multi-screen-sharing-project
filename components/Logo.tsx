import Link from "next/link";
import { APP_NAME } from "@/lib/brand";

// Four screens in a grid, with the top-right one "live".
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <rect x="7" y="8" width="8" height="6" rx="1.5" fill="white" opacity="0.55" />
      <rect x="17" y="8" width="8" height="6" rx="1.5" fill="white" />
      <rect x="7" y="18" width="8" height="6" rx="1.5" fill="white" opacity="0.55" />
      <rect x="17" y="18" width="8" height="6" rx="1.5" fill="white" opacity="0.55" />
    </svg>
  );
}

export default function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const large = size === "lg";
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <LogoMark className={large ? "size-10" : "size-7"} />
      <span className={`font-semibold tracking-tight ${large ? "text-3xl" : "text-base"}`}>
        {APP_NAME}
      </span>
    </Link>
  );
}
