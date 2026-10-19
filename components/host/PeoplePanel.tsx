"use client";

import { Download, UserX } from "lucide-react";
import { attendanceCsv, downloadCsv, type AttendanceRecord } from "@/lib/attendance";
import { Avatar } from "./ui";

const time = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// Live list of everyone who joined this session, with CSV export.
export default function PeoplePanel({
  code,
  records,
  search,
  onRemove,
}: {
  code: string;
  records: AttendanceRecord[];
  search: string;
  onRemove: (record: AttendanceRecord) => void;
}) {
  const here = records.filter((r) => !r.leftAt);
  const left = records.filter((r) => r.leftAt);
  const query = search.trim().toLowerCase();
  const matches = (r: AttendanceRecord) => !query || r.name.toLowerCase().includes(query);
  const visible = [...here, ...left].filter(matches);

  function exportCsv() {
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`omniscreen-attendance-${code}-${date}.csv`, attendanceCsv(records));
  }

  return (
    <aside className="hidden w-80 shrink-0 flex-col border-l border-border bg-surface md:flex">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="flex-1">
          <p className="text-sm font-medium">People</p>
          <p className="text-xs text-muted">
            {here.length} here{left.length > 0 && ` · ${left.length} left`}
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={records.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs transition hover:border-border-strong disabled:opacity-40"
        >
          <Download className="size-3.5" /> Export CSV
        </button>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {visible.length === 0 && (
          <li className="px-2 py-8 text-center text-sm text-muted">
            {records.length === 0 ? "No one has joined yet." : "No one matches your search."}
          </li>
        )}
        {visible.map((r) => (
          <li
            key={r.identity}
            className={`group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2 ${r.leftAt ? "opacity-50" : ""}`}
          >
            <Avatar name={r.name} className="size-8" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{r.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <span
                  className={`size-1.5 rounded-full ${
                    r.leftAt ? "bg-muted" : r.sharingSince ? "bg-danger" : "bg-success"
                  }`}
                />
                {r.leftAt
                  ? `Left at ${time(r.leftAt)}`
                  : r.sharingSince
                    ? `Sharing · joined ${time(r.joinedAt)}`
                    : `Not sharing · joined ${time(r.joinedAt)}`}
              </p>
            </div>
            {!r.leftAt && (
              <button
                onClick={() => onRemove(r)}
                title={`Remove ${r.name}`}
                aria-label={`Remove ${r.name}`}
                className="rounded-md p-1.5 text-muted opacity-0 transition group-hover:opacity-100 hover:bg-danger-soft hover:text-danger focus:opacity-100"
              >
                <UserX className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
