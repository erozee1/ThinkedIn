"use client";

import Image from "next/image";
import Link from "next/link";
import { UserButton, useOrganization, useOrganizationList } from "@clerk/nextjs";
import logo from "@/public/thinkedinBACK.png";
import { Building2, ChevronDown, MessagesSquare, Plus, RotateCcw, Settings, Sparkles, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { ChatSession } from "@/lib/types";

function OrgPanel() {
  // useOrganizationList gives all orgs the user belongs to + setActive.
  const { userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: true, keepPreviousData: true },
  });
  // useOrganization gives the currently active org and its member list.
  const { organization, memberships } = useOrganization({
    memberships: { infinite: true, keepPreviousData: true },
  });
  const [open, setOpen] = useState(false);
  const [activating, setActivating] = useState(false);

  const firstMembership = userMemberships?.data?.[0];

  // Auto-activate the first org if the user is a member of one but none is active.
  if (!organization && firstMembership && setActive && !activating) {
    setActivating(true);
    void setActive({ organization: firstMembership.organization.id }).catch(() => {
      setActivating(false);
    });
  }

  if (!organization && !firstMembership) return null;

  const displayOrg = organization ?? firstMembership?.organization;
  if (!displayOrg) return null;

  const members = memberships?.data ?? [];

  return (
    <div className="border-t border-border px-3 pt-3 pb-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition-all hover:bg-black/[0.04] active:scale-[0.98]"
      >
        {displayOrg.imageUrl ? (
          <Image
            src={displayOrg.imageUrl}
            alt={displayOrg.name}
            width={20}
            height={20}
            className="rounded-md object-cover ring-1 ring-black/10"
            unoptimized
          />
        ) : (
          <Building2 className="h-4 w-4 shrink-0 text-muted" />
        )}
        <span className="min-w-0 flex-1 truncate text-left font-medium text-foreground">
          {displayOrg.name}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-1 mb-2 flex flex-col gap-0.5 px-1">
          {members.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted">No members yet</p>
          )}
          {members.map((m) => {
            const name = [m.publicUserData?.firstName, m.publicUserData?.lastName]
              .filter(Boolean)
              .join(" ") || "Team member";
            const avatar = m.publicUserData?.imageUrl;
            const initials = name
              .split(" ")
              .map((p) => p[0]?.toUpperCase() ?? "")
              .join("")
              .slice(0, 2);
            return (
              <div
                key={m.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5"
              >
                {avatar ? (
                  <Image
                    src={avatar}
                    alt={name}
                    width={24}
                    height={24}
                    className="rounded-full object-cover ring-1 ring-black/10"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0a66c2]/15 text-[10px] font-semibold text-[#0a66c2]">
                    {initials}
                  </div>
                )}
                <span className="truncate text-xs text-foreground/80">{name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
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
  onDelete,
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
            <div
              key={s.id}
              className={`group flex items-center gap-2 rounded-lg px-2 py-1 text-left text-sm transition-all ${
                s.id === activeId
                  ? "bg-[#0a66c2]/10 font-medium text-[#0a66c2]"
                  : "text-muted hover:bg-black/[0.04] hover:text-foreground"
              }`}
            >
              <button
                onClick={() => select(s.id)}
                className="flex min-w-0 flex-1 items-center gap-2 truncate rounded-md px-0.5 py-1 active:scale-[0.98]"
              >
                <MessagesSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="truncate">{s.title}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(s.id);
                }}
                aria-label={`Delete chat ${s.title}`}
                className="rounded-md p-1 text-muted opacity-0 transition hover:bg-black/[0.06] hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Org panel — only renders when user is in an organisation */}
      <OrgPanel />

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
          Update network
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
