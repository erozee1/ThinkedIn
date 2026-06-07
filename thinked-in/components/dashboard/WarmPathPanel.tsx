"use client";

import { useState } from "react";
import { X, ExternalLink } from "lucide-react";
import type { ProfileCardData } from "@/lib/types";

const STRENGTH_STYLE: Record<string, { label: string; pill: string; line: string }> = {
  close:   { label: "Close",   pill: "bg-green-100 text-green-700 border-green-200",  line: "border-green-400" },
  active:  { label: "Active",  pill: "bg-blue-100 text-blue-700 border-blue-200",     line: "border-blue-400" },
  warm:    { label: "Warm",    pill: "bg-amber-100 text-amber-700 border-amber-200",  line: "border-amber-400" },
  dormant: { label: "Dormant", pill: "bg-zinc-100 text-zinc-500 border-zinc-200",     line: "border-zinc-300" },
  none:    { label: "None",    pill: "bg-zinc-100 text-zinc-400 border-zinc-200",     line: "border-zinc-200" },
};

function monthsAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const months = Math.round(diff / (1000 * 60 * 60 * 24 * 30));
  if (months === 0) return "this month";
  if (months === 1) return "1 month ago";
  if (months < 12) return `${months} months ago`;
  const years = Math.round(months / 12);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

function PathAvatar({ src, name, fallback }: { src?: string | null; name: string; fallback?: string }) {
  const dicebear = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0a66c2&textColor=ffffff&fontSize=40`;
  const [errored, setErrored] = useState(false);
  const imgSrc = errored ? (fallback ?? dicebear) : (src ?? dicebear);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imgSrc}
      alt={name}
      width={48}
      height={48}
      className="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow-sm"
      onError={() => { if (!errored) setErrored(true); }}
    />
  );
}

function PathNode({ avatarSrc, name, subtitle }: { avatarSrc?: string | null; name: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0" style={{ width: 80 }}>
      <PathAvatar src={avatarSrc} name={name} />
      <p className="w-full truncate text-center text-[11px] font-medium text-zinc-800 leading-tight">{name}</p>
      {subtitle ? <p className="w-full truncate text-center text-[10px] text-zinc-400 leading-tight">{subtitle}</p> : null}
    </div>
  );
}

function Connector({ strength }: { strength?: string }) {
  const s = strength && STRENGTH_STYLE[strength];
  return (
    <div className="relative flex flex-1 items-center mx-1" style={{ minWidth: 32 }}>
      <div className={`w-full border-t ${s ? s.line : "border-zinc-200"}`} />
      {s ? (
        <span className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap ${s.pill} bg-white`}>
          {s.label}
        </span>
      ) : null}
    </div>
  );
}

interface WarmPathPanelProps {
  person: ProfileCardData;
  currentUser: { name: string; avatarUrl: string | null };
  onClose: () => void;
}

export default function WarmPathPanel({ person, currentUser, onClose }: WarmPathPanelProps) {
  const [width, setWidth] = useState(340);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = width;
    const onMove = (ev: PointerEvent) =>
      setWidth(Math.max(280, Math.min(600, startWidth + startX - ev.clientX)));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const strength = person.relationshipStrength;
  const strengthStyle = strength ? STRENGTH_STYLE[strength] : undefined;

  return (
    <div
      className="absolute right-0 top-0 bottom-0 z-20 flex shadow-xl"
      style={{ width }}
    >
      {/* Drag handle */}
      <div
        className="w-1.5 cursor-col-resize bg-transparent hover:bg-[#0a66c2]/20 transition-colors flex-shrink-0 select-none"
        onPointerDown={handlePointerDown}
      />

      <div className="flex flex-1 flex-col overflow-hidden rounded-tl-2xl rounded-bl-2xl border-l border-zinc-200 bg-white/95 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Warm Path</p>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Path chain */}
        <div className="flex flex-col gap-6 overflow-y-auto px-4 py-6">
          <div className="flex items-center justify-center">
            {person.fromTeam && person.viaName ? (
              <>
                <PathNode avatarSrc={currentUser.avatarUrl} name={currentUser.name || "You"} subtitle="You" />
                <Connector />
                <PathNode avatarSrc={person.viaAvatarUrl} name={person.viaName} subtitle="Team member" />
                <Connector strength={strength} />
                <PathNode avatarSrc={person.avatarUrl} name={person.name} subtitle={person.position || undefined} />
              </>
            ) : (
              <>
                <PathNode avatarSrc={currentUser.avatarUrl} name={currentUser.name || "You"} subtitle="You" />
                <Connector strength={strength} />
                <PathNode avatarSrc={person.avatarUrl} name={person.name} subtitle={person.position || undefined} />
              </>
            )}
          </div>

          {/* Metadata */}
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-zinc-700">{person.name}</p>
            {person.position ? <p className="text-[11px] text-zinc-500">{person.position}{person.company ? ` · ${person.company}` : ""}</p> : null}
            {person.location ? <p className="text-[11px] text-zinc-400">{person.location}</p> : null}

            {strengthStyle ? (
              <div className="flex items-center gap-1.5 pt-1">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${strengthStyle.pill}`}>
                  {strengthStyle.label}
                </span>
                <span className="text-[11px] text-zinc-400">relationship</span>
              </div>
            ) : null}

            {person.lastContacted ? (
              <p className="text-[11px] text-zinc-400">
                Last contact: {monthsAgo(person.lastContacted)}
              </p>
            ) : null}

            {person.fromTeam && person.viaName ? (
              <p className="text-[11px] text-zinc-500 pt-1">
                Via <span className="font-medium text-zinc-700">{person.viaName}</span> on your team
              </p>
            ) : null}
          </div>

          {/* CTA */}
          {person.linkedinUrl ? (
            <a
              href={person.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#0a66c2] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#004182] active:scale-[0.98]"
            >
              <ExternalLink className="h-4 w-4" />
              View on LinkedIn
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
