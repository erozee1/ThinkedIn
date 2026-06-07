"use client";

import { useState } from "react";
import { ExternalLink, Globe } from "lucide-react";
import type { WebResultData } from "@/lib/types";

const LINKEDIN_BLUE = "bg-[#0a66c2]";

function isLinkedIn(domain: string) {
  return domain === "linkedin.com" || domain.endsWith(".linkedin.com");
}

function FaviconImg({ src, domain }: { src: string; domain: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-zinc-200">
        <Globe className="h-2.5 w-2.5 text-zinc-400" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={domain}
      width={16}
      height={16}
      className="h-4 w-4 shrink-0 rounded-sm object-contain"
      onError={() => setErrored(true)}
    />
  );
}

function SourceChip({ result }: { result: WebResultData }) {
  const li = isLinkedIn(result.domain);
  return (
    <a
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-w-0 shrink-0 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 shadow-sm transition hover:border-zinc-300 hover:shadow-md active:scale-[0.98]"
      style={{ maxWidth: 200 }}
    >
      {li ? (
        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm ${LINKEDIN_BLUE}`}>
          <span className="text-[8px] font-bold leading-none text-white">in</span>
        </span>
      ) : (
        <FaviconImg src={result.faviconUrl} domain={result.domain} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium text-zinc-700 leading-tight">
          {result.title.length > 36 ? result.title.slice(0, 35) + "…" : result.title}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-zinc-400 leading-tight">
          <span className={li ? "text-[#0a66c2] font-medium" : ""}>{result.domain}</span>
          {result.pageAge ? <span>· {result.pageAge}</span> : null}
        </span>
      </span>
      <ExternalLink className="h-3 w-3 shrink-0 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100" />
    </a>
  );
}

export default function WebResultsStrip({ results }: { results: WebResultData[] }) {
  if (!results.length) return null;
  return (
    <div className="mt-2 flex max-w-[88%] min-w-0 flex-col gap-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {results.length} source{results.length !== 1 ? "s" : ""} found
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#d1d5db transparent" }}>
        {results.map((r) => (
          <SourceChip key={r.url} result={r} />
        ))}
      </div>
    </div>
  );
}
