"use client";

import { useEffect, useState } from "react";
import { FileText, Image as ImageIcon, X } from "lucide-react";

export interface DocItem {
  /** Public URL, e.g. "/proofdocs/enterprise-agreement.pdf". */
  url: string;
  /** Short button label, e.g. "Signed contract". */
  label: string;
  type: "pdf" | "image";
}

/** Pressable preview chips that open an integrated in-page viewer (PDF / image). */
export default function DocPreview({ docs }: { docs: DocItem[] }) {
  const [open, setOpen] = useState<DocItem | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {docs.map((d) => (
        <button
          key={d.url}
          type="button"
          onClick={() => setOpen(d)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#0a66c2]/30 bg-[#0a66c2]/[0.06] px-2.5 py-0.5 text-xs font-medium text-[#0a66c2] transition-colors hover:bg-[#0a66c2]/[0.12]"
        >
          {d.type === "pdf" ? <FileText className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
          {d.label}
        </button>
      ))}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setOpen(null)}
          role="dialog"
          aria-modal="true"
          aria-label={open.label}
        >
          <div
            className="relative flex h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5">
              <p className="truncate text-sm font-medium text-zinc-800">{open.label}</p>
              <div className="flex items-center gap-3">
                <a
                  href={open.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-zinc-500 transition-colors hover:text-zinc-900"
                >
                  Open ↗
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(null)}
                  aria-label="Close"
                  className="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-zinc-50">
              {open.type === "pdf" ? (
                <iframe src={open.url} title={open.label} className="h-full w-full" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={open.url} alt={open.label} className="mx-auto h-auto w-full object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
