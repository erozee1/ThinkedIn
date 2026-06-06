import Image from "next/image";
import { ExternalLink, BadgeCheck, AlertTriangle } from "lucide-react";
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
        <p className="flex items-center gap-1.5 truncate font-medium text-foreground">
          <span className="truncate">{person.name}</span>
          {person.verified?.status === "match" ? (
            <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-500" aria-label="Verified — role confirmed live" />
          ) : person.verified?.status === "stale" ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-label="Role may have changed since import" />
          ) : null}
        </p>
        <p className="truncate text-sm text-muted">
          {person.position}
          {person.company ? ` · ${person.company}` : ""}
        </p>
        {person.verified?.status === "stale" && (person.verified.currentPosition || person.verified.currentCompany) ? (
          <p className="truncate text-xs text-amber-600">
            Now: {[person.verified.currentPosition, person.verified.currentCompany].filter(Boolean).join(" · ")}
          </p>
        ) : !compact && person.location ? (
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
