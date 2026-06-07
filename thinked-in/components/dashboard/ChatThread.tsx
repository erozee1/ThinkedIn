"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Search, Filter, Globe, Hash, Users, BarChart2, Loader2, MessageSquare, ScanSearch, Target } from "lucide-react";
import type { ChatMessage, ToolCallInfo } from "@/lib/types";
import ProfileCard from "@/components/ProfileCard";
import PostCard from "@/components/dashboard/PostCard";
import ThinkingDots from "@/components/ThinkingDots";

export default function ChatThread({ messages }: { messages: ChatMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="scroll-slim flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-6">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const hasText = message.content.trim().length > 0;
  const hasMatches = Boolean(message.matches?.length);
  const hasToolCalls = Boolean(message.toolCalls?.length || message.toolNames?.length);
  const hasPost = Boolean(message.post);

  if (message.role === "user") {
    return (
      <motion.div
        className="flex justify-end"
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        <div className="max-w-[80%] rounded-3xl rounded-br-lg bg-gradient-blue px-5 py-3 text-[15px] text-white shadow-sm">
          {message.content}
        </div>
      </motion.div>
    );
  }

  if (!message.pending && !hasText && !hasMatches && !hasToolCalls && !hasPost) {
    return null;
  }

  if (message.pending && !hasText && !message.kind) {
    return <ThinkingStep message={message} />;
  }

  if (message.kind === "thinking") {
    return (
      <div className="flex flex-col gap-1.5">
        {hasText ? (
          <motion.div
            className="inline-block max-w-[88%] rounded-3xl rounded-tl-md glass-strong px-4 py-3 text-[13px] leading-relaxed text-foreground/70"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <RichText text={message.content} />
          </motion.div>
        ) : null}
        <ThinkingStep message={message} />
      </div>
    );
  }

  return (
    <motion.div
      className="flex items-start gap-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <div className="min-w-0 flex-1">
        {message.pending && !hasText ? (
          <ThinkingDots label="thinkedin is thinking…" />
        ) : hasText ? (
          <div className="inline-block max-w-[88%] rounded-3xl rounded-tl-md glass-strong px-4 py-3 text-[13px] leading-relaxed text-foreground">
            <RichText text={message.content} />
          </div>
        ) : null}

        {message.matches?.length ? (
          <div className="mt-3 grid max-w-xs grid-cols-2 gap-2">
            {message.matches.map((person, i) => (
              <motion.div
                key={person.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <ProfileCard person={person} />
              </motion.div>
            ))}
          </div>
        ) : null}

        {message.post ? (
          <motion.div
            className="mt-3 sm:max-w-md"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <PostCard post={message.post} />
          </motion.div>
        ) : null}
      </div>
    </motion.div>
  );
}

const TOOL_ICON: Record<string, React.ElementType> = {
  search_by_meaning: Search,
  query_by_filter: Filter,
  keyword_search: Hash,
  present_connections: Users,
  get_network_stats: BarChart2,
  save_goal: Target,
  web_search: Globe,
  search_messages: MessageSquare,
  research_person: ScanSearch,
};

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function formatToolCall(call: ToolCallInfo): { primary: string; count?: string } {
  const { name, input, resultCount } = call;

  switch (name) {
    case "search_by_meaning":
    case "search_messages":
    case "web_search": {
      const q = String(input.query ?? "").trim();
      return {
        primary: q ? `"${trunc(q, 35)}"` : name,
        count: resultCount != null ? `${resultCount} found` : undefined,
      };
    }
    case "keyword_search": {
      const terms = (input.terms as string[] ?? []);
      const label = terms.length
        ? trunc(terms.slice(0, 3).join(", ") + (terms.length > 3 ? ` +${terms.length - 3}` : ""), 40)
        : "keywords";
      return { primary: label, count: resultCount != null ? `${resultCount} found` : undefined };
    }
    case "query_by_filter": {
      const f = (input.filters as Record<string, string | undefined> ?? {});
      const parts = [f.company, f.country, f.seniority, f.industry]
        .filter((v): v is string => Boolean(v))
        .slice(0, 3);
      return {
        primary: parts.length ? parts.join(" · ") : "network",
        count: resultCount != null ? String(resultCount) : undefined,
      };
    }
    case "get_network_stats": {
      const dim = String(input.group_by ?? "").replace(/_/g, " ");
      return { primary: dim ? `by ${dim}` : "stats" };
    }
    case "present_connections": {
      const n = Array.isArray(input.linkedin_urls) ? input.linkedin_urls.length : (resultCount ?? 0);
      return { primary: `${n} selected` };
    }
    case "save_goal": {
      const goal = String(input.goal ?? "").trim();
      return { primary: goal ? `"${trunc(goal, 35)}"` : "goal" };
    }
    case "research_person": {
      const personName = String(input.name ?? "").trim();
      const company = String(input.company ?? "").trim();
      const label = personName ? (company ? `${personName} · ${company}` : personName) : "person";
      return { primary: trunc(label, 40) };
    }
    default:
      return { primary: name.replace(/_/g, " ") };
  }
}

function ThinkingStep({ message }: { message: ChatMessage }) {
  const isPending = message.pending;
  const toolCalls: ToolCallInfo[] =
    message.toolCalls ??
    (message.toolNames ?? []).map((name) => ({
      name,
      input: {},
      resultCount: null,
    }));

  return (
    <motion.div
      className="flex items-center gap-2"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-zinc-200/60 bg-white/60 px-3.5 py-2 text-xs text-zinc-500 backdrop-blur-sm">
        {toolCalls.length > 0 ? (
          toolCalls.map((call, i) => {
            const Icon = TOOL_ICON[call.name] ?? Search;
            const { primary, count } = formatToolCall(call);
            return (
              <span key={`${call.name}-${i}`} className="flex items-center gap-1">
                {call.loading ? (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[#0a66c2]" />
                ) : (
                  <Icon className="h-3 w-3 shrink-0 text-zinc-400" />
                )}
                <span className={call.loading ? "text-[#0a66c2]" : undefined}>{primary}</span>
                {!call.loading && count ? <span className="text-zinc-400">· {count}</span> : null}
              </span>
            );
          })
        ) : isPending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0a66c2]" />
            <span className="text-[#0a66c2]">Searching your network…</span>
          </>
        ) : (
          <span>Searched your network</span>
        )}
      </div>
    </motion.div>
  );
}

function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <p key={i} className={line.trim() === "" ? "h-2" : ""}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={j} className="font-semibold text-foreground">
                {part.slice(2, -2)}
              </strong>
            ) : (
              <span key={j}>{part}</span>
            ),
          )}
        </p>
      ))}
    </>
  );
}
