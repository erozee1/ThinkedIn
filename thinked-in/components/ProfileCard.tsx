import Image from "next/image";
import { ExternalLink } from "lucide-react";
import type { ProfileCardData } from "@/lib/types";

interface ProfileCardProps {
  person: ProfileCardData;
  /** Compact variant for tight rows (e.g. enrichment list). */
  compact?: boolean;
}

/**
 * Fake LinkedIn-style profile card. Reused in the landing demo and inline in
 * chat replies.
 */
export default function ProfileCard({ person, compact = false }: ProfileCardProps) {
  return (
    <a
      href={person.linkedinUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex items-center gap-3 rounded-2xl glass px-3 transition-colors hover:bg-white/10 ${
        compact ? "py-2" : "py-3"
      }`}
    >
      <Image
        src={person.avatarUrl}
        alt={person.name}
        width={compact ? 36 : 44}
        height={compact ? 36 : 44}
        className="rounded-full ring-2 ring-white/10 object-cover"
        unoptimized
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{person.name}</p>
        <p className="truncate text-sm text-muted">
          {person.position}
          {person.company ? ` · ${person.company}` : ""}
        </p>
        {!compact && person.location ? (
          <p className="truncate text-xs text-muted/70">{person.location}</p>
        ) : null}
      </div>
      <ExternalLink
        className="h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
    </a>
  );
}
