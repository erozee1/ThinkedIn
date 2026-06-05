"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import ProfileCard from "@/components/ProfileCard";
import ThinkingDots from "@/components/ThinkingDots";

export default function ChatThread({ messages }: { messages: ChatMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="scroll-slim flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
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
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-3xl rounded-br-lg bg-indigo-500/40 px-5 py-3 text-[15px] text-white/90 ring-1 ring-white/10">
          {message.content}
        </div>
      </div>
    );
  }

  const showThinking = message.pending && !message.content;

  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-glow to-indigo-glow">
        <Sparkles className="h-4 w-4 text-white" />
      </span>
      <div className="min-w-0 flex-1">
        {showThinking ? (
          <ThinkingDots label="thinkedin is searching your network" />
        ) : (
          <div className="text-[15px] leading-relaxed text-foreground">
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
      </div>
    </div>
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
              <strong key={j} className="font-semibold text-white">
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
