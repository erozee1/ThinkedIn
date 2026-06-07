"use client";

import { useState } from "react";
import { ArrowUp, ChevronDown } from "lucide-react";

export default function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  };

  return (
    <div className="px-4 pb-8 md:pb-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-end gap-2 rounded-3xl glass-strong p-2 pl-4">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Ask your network anything…"
            className="max-h-40 flex-1 resize-none self-center bg-transparent py-2 text-[15px] text-foreground placeholder:text-muted/60 focus:outline-none"
          />
          <button
            onClick={submit}
            disabled={disabled || !value.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-blue text-white transition-all hover:brightness-110 active:scale-90 disabled:scale-100 disabled:opacity-30"
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-center gap-1 text-xs text-muted/70">
          {/* Cosmetic model selector */}
          <button className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition-all hover:text-foreground active:scale-95">
            Claude Sonnet 4
            <ChevronDown className="h-3 w-3" />
          </button>
          <span>· thinkedin can make mistakes. Verify important details.</span>
        </div>
      </div>
    </div>
  );
}
