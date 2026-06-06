"use client";

import Image from "next/image";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import logo from "@/public/thinkedinBACK.png";
import { MessagesSquare, Plus, RotateCcw, Settings, Sparkles, X } from "lucide-react";
import type { ChatSession } from "@/lib/types";

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onReimport: () => void;
  /** Mobile drawer open state. */
  open: boolean;
  onClose: () => void;
}

export default function ChatSidebar({
  sessions,
  activeId,
  onSelect,
  onNewChat,
  onReimport,
  open,
  onClose,
}: ChatSidebarProps) {
  // Wrap actions so they also close the drawer on mobile.
  const select = (id: string) => {
    onSelect(id);
    onClose();
  };
  const newChat = () => {
    onNewChat();
    onClose();
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface transition-transform duration-300 ease-out md:static md:z-auto md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Brand — links back to the landing page (+ mobile close) */}
      <div className="flex items-center justify-between px-4 py-4">
        <Link
          href="/"
          aria-label="thinkedin — home"
          className="transition-transform hover:scale-[1.03] active:scale-95"
        >
          <Image src={logo} alt="thinkedin" className="h-6 w-auto" />
        </Link>
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="rounded-lg p-1 text-muted transition hover:bg-black/[0.05] active:scale-90 md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* New chat */}
      <div className="px-3">
        <button
          onClick={newChat}
          className="flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-black/[0.04] hover:shadow-sm active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      {/* Sessions */}
      <div className="scroll-slim mt-4 flex-1 overflow-y-auto px-3">
        <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Chats
        </p>
        <div className="flex flex-col gap-0.5">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => select(s.id)}
              className={`flex items-center gap-2 truncate rounded-lg px-2.5 py-2 text-left text-sm transition-all active:scale-[0.98] ${
                s.id === activeId
                  ? "bg-[#0a66c2]/10 font-medium text-[#0a66c2]"
                  : "text-muted hover:bg-black/[0.04] hover:text-foreground"
              }`}
            >
              <MessagesSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="truncate">{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer: re-import, settings, user */}
      <div className="border-t border-border p-3">
        <button
          onClick={() => {
            onReimport();
            onClose();
          }}
          className="mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted transition-all hover:bg-black/[0.04] hover:text-foreground active:scale-[0.98]"
        >
          <RotateCcw className="h-4 w-4" />
          Re-import network
        </button>
        <Link
          href="/billing"
          className="mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted transition-all hover:bg-black/[0.04] hover:text-foreground active:scale-[0.98]"
        >
          <Settings className="h-4 w-4" />
          Billing & plan
        </Link>
        <Link
          href="/pricing"
          className="mb-2 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[#0a66c2] transition-all hover:bg-[#0a66c2]/[0.06] active:scale-[0.98]"
        >
          <Sparkles className="h-4 w-4" />
          Upgrade
        </Link>
        <div className="flex items-center gap-2 rounded-lg px-1 py-1">
          <UserButton appearance={{ elements: { userButtonAvatarBox: "h-8 w-8" } }} />
          <span className="text-sm text-muted">Account</span>
        </div>
      </div>
    </aside>
  );
}
