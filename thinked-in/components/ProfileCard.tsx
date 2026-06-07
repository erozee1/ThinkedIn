"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { ProfileCardData } from "@/lib/types";

interface ProfileCardProps {
  person: ProfileCardData;
  /** Compact horizontal variant (landing demo). */
  compact?: boolean;
  /** When false, renders a non-clickable card (landing preview). */
  asLink?: boolean;
}

/** Infer a probable company domain from the display name for logo lookup. */
function companyDomain(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(
        /\b(inc|llc|ltd|limited|corp|corporation|company|co|group|the|plc|uk|us|gmbh|ag|sa|global|international|consulting|technologies|technology|solutions|services|ventures|capital|partners|labs|lab)\b/g,
        "",
      )
      .trim()
      .replace(/\s+/g, "") + ".com"
  );
}

function Avatar({ src, name, size, className }: { src: string; name: string; size: number; className?: string }) {
  const fallback = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`;
  const [errored, setErrored] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={errored ? fallback : src}
      alt={name}
      width={size}
      height={size}
      className={className}
      onError={() => {
        if (!errored) setErrored(true);
      }}
    />
  );
}

function CompanyLogo({ company }: { company: string }) {
  const [errored, setErrored] = useState(false);
  const domain = companyDomain(company);

  if (errored) {
    return (
      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-[#0a66c2]">
        <span className="text-[7px] font-bold leading-none text-white">in</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={company}
      width={16}
      height={16}
      className="h-4 w-4 shrink-0 rounded-sm object-contain"
      onError={() => setErrored(true)}
    />
  );
}

export default function ProfileCard({
  person,
  compact = false,
  asLink = true,
}: ProfileCardProps) {
  if (compact) {
    const base = "flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2 shadow-sm";
    const inner = (
      <>
        <Avatar
          src={person.avatarUrl}
          name={person.name}
          size={36}
          className="shrink-0 rounded-full object-cover ring-2 ring-black/5"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{person.name}</p>
            {person.fromTeam ? (
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                Org
              </span>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted">
            {person.position}
            {person.company ? ` · ${person.company}` : ""}
          </p>
        </div>
      </>
    );

    if (!asLink) return <div className={base}>{inner}</div>;
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

  const card = (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow group-hover:shadow-md">
      <div className="relative h-6 bg-gradient-to-r from-[#0a66c2] to-[#004182]">
        {person.fromTeam && (
          <span className="absolute right-2 top-1 rounded-full bg-white/90 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-[#0a66c2]">
            Team
          </span>
        )}
      </div>

      <div className="relative z-10 px-2.5 pb-2.5">
        <div className="flex items-end justify-between">
          <Avatar
            src={person.avatarUrl}
            name={person.name}
            size={36}
            className="-mt-4 rounded-full object-cover ring-2 ring-white"
          />
          {asLink ? (
            <ExternalLink className="mb-0.5 h-3.5 w-3.5 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100" />
          ) : null}
        </div>

        <div className="mt-1">
          <p className="truncate text-[12px] font-semibold leading-tight text-zinc-900">{person.name}</p>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-zinc-500">
            {person.position}
          </p>
          {person.location ? (
            <p className="mt-0.5 truncate text-[10px] text-zinc-400">{person.location}</p>
          ) : null}
          {person.company ? (
            <div className="mt-1.5 flex items-center gap-1">
              <CompanyLogo company={person.company} />
              <span className="truncate text-[10px] text-zinc-600">{person.company}</span>
            </div>
          ) : null}
          {person.fromTeam ? (
            <p className="mt-1 truncate text-[10px] font-medium text-[#0a66c2]">
              From your organization network
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (!asLink) return card;

  return (
    <a
      href={person.linkedinUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block"
    >
      {card}
    </a>
  );
}
