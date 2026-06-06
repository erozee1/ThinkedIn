"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Search, Filter, Globe, Hash, Users, BarChart2, Loader2, Target } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
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

  // Pending with no content yet and no kind assigned — show spinner.
  if (message.pending && !message.content && !message.kind) {
    return <ThinkingStep message={message} />;
  }

  // Thinking step: muted caption + compact tool pill. Visually subordinate to the final answer.
  if (message.kind === "thinking") {
    return (
      <div className="flex flex-col gap-1.5">
        {message.content ? (
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
        {message.pending && !message.content ? (
          <ThinkingDots label="thinkedin is thinking…" />
        ) : (
          <div className="inline-block max-w-[88%] rounded-3xl rounded-tl-md glass-strong px-4 py-3 text-[15px] leading-relaxed text-foreground">
            <RichText text={message.content} />
          </div>
        )}

        {message.matches && message.matches.length > 0 && (
          <div className="mt-3 flex flex-col gap-2 sm:max-w-md">
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
        )}

        {message.post && (
          <motion.div
            className="mt-3 sm:max-w-md"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <PostCard post={message.post} />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

const TOOL_META: Record<string, { label: string; Icon: React.ElementType }> = {
  search_by_meaning:   { label: "Semantic search",      Icon: Search },
  query_by_filter:     { label: "Filtered network",     Icon: Filter },
  keyword_search:      { label: "Keyword search",       Icon: Hash },
  present_connections: { label: "Selected connections", Icon: Users },
  get_network_stats:   { label: "Analysed network",     Icon: BarChart2 },
  save_goal:           { label: "Goal saved",            Icon: Target },
  web_search:          { label: "Web search",            Icon: Globe },
};

function ThinkingStep({ message }: { message: ChatMessage }) {
  const tools = message.toolNames ?? [];
  const isPending = message.pending;

  // Deduplicate tools and count repetitions (e.g. two search_by_meaning calls → "Semantic search ×2")
  const toolCounts = tools.reduce<Record<string, number>>((acc, name) => {
    acc[name] = (acc[name] ?? 0) + 1;
    return acc;
  }, {});
  const uniqueTools = Object.entries(toolCounts);

  return (
    <motion.div
      className="flex items-center gap-2"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200/60 bg-white/60 px-3.5 py-2 text-xs text-zinc-500 backdrop-blur-sm">
        {isPending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0a66c2]" />
            <span className="text-[#0a66c2]">Searching your network…</span>
          </>
        ) : uniqueTools.length > 0 ? (
          uniqueTools.map(([name, count]) => {
            const meta = TOOL_META[name] ?? { label: name, Icon: Search };
            return (
              <span key={name} className="flex items-center gap-1">
                <meta.Icon className="h-3 w-3" />
                {meta.label}
                {count > 1 && <span className="text-zinc-400">×{count}</span>}
              </span>
            );
          })
        ) : (
          <span>Searched your network</span>
        )}
      </div>
    </motion.div>
  );
}

// Minimal renderer: paragraph breaks + **bold**. Enough for the stubbed replies.
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
