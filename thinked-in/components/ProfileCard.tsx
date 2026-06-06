import Image from "next/image";
import { ExternalLink } from "lucide-react";
import type { ProfileCardData } from "@/lib/types";

interface ProfileCardProps {
  person: ProfileCardData;
  /** Compact variant for tight rows (e.g. enrichment list). */
  compact?: boolean;
  /** When false, renders a non-clickable card (e.g. the landing preview). */
  asLink?: boolean;
}

/**
 * Fake LinkedIn-style profile card. Reused in the landing demo and inline in
 * chat replies.
 */
export default function ProfileCard({
  person,
  compact = false,
  asLink = true,
}: ProfileCardProps) {
  const base = `flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 shadow-sm ${
    compact ? "py-2" : "py-3"
  }`;

  const inner = (
    <>
      <Image
        src={person.avatarUrl}
        alt={person.name}
        width={compact ? 36 : 44}
        height={compact ? 36 : 44}
        className="rounded-full ring-2 ring-black/5 object-cover"
        unoptimized
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-foreground">{person.name}</p>
          {person.fromTeam ? (
            <span className="shrink-0 rounded-full bg-[#0a66c2]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0a66c2]">
              Team
            </span>
          ) : null}
        </div>
        <p className="truncate text-sm text-muted">
          {person.position}
          {person.company ? ` · ${person.company}` : ""}
        </p>
        {!compact && person.location ? (
          <p className="truncate text-xs text-muted/70">{person.location}</p>
        ) : null}
      </div>
      {asLink ? (
        <ExternalLink
          className="h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      ) : null}
    </>
  );

  if (!asLink) {
    return <div className={base}>{inner}</div>;
  }

  return (
    <a
      href={person.linkedinUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`group transition-colors hover:bg-black/[0.03] ${base}`}
    >
      {inner}
    </a>
  );
}
