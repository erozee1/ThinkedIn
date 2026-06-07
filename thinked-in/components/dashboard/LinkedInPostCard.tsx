"use client";

import { useState } from "react";
import { ThumbsUp, MessageSquare, Repeat2, Send, Globe } from "lucide-react";
import type { LinkedInPostData } from "@/lib/types";

const MAX_CONTENT = 280;

function AuthorAvatar({ src, name }: { src?: string; name: string }) {
  const fallback = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0a66c2&textColor=ffffff&fontSize=40`;
  const [errored, setErrored] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={errored || !src ? fallback : src}
      alt={name}
      width={48}
      height={48}
      className="h-12 w-12 rounded-full object-cover ring-2 ring-white"
      onError={() => { if (!errored) setErrored(true); }}
    />
  );
}

function PostImage({ src, alt }: { src: string; alt: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="mt-3 w-full rounded-lg object-cover"
      style={{ maxHeight: 320 }}
      onError={() => setErrored(true)}
    />
  );
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

interface LinkedInPostCardProps {
  post: LinkedInPostData;
}

export default function LinkedInPostCard({ post }: LinkedInPostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const truncated = !expanded && post.content.length > MAX_CONTENT;
  const displayContent = truncated ? post.content.slice(0, MAX_CONTENT) : post.content;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <AuthorAvatar src={post.authorAvatarUrl} name={post.authorName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-[14px] font-semibold leading-tight text-zinc-900">
                <span className="truncate">{post.authorName}</span>
                {/* decorative verified badge */}
                <span className="shrink-0 text-[#0a66c2]" title="Verified">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0l1.8 2.6L13 2l.6 3.4L16 7.2 14 10l2 2.8-3.4.6L12 16l-4-1.6L4 16l-.6-3.6L0 11.8 2 10 0 7.2 2.6 5.4 3 2l3.2.6L8 0z" opacity=".3"/>
                    <path d="M6.9 10.5L4.5 8.1 5.6 7l1.3 1.3 3.5-3.5 1.1 1.1-4.6 4.6z"/>
                  </svg>
                </span>
                <span className="shrink-0 text-[12px] font-normal text-zinc-400">· 2nd</span>
              </p>
              {post.authorTitle ? (
                <p className="mt-0.5 truncate text-[12px] text-zinc-500 leading-tight">{post.authorTitle}</p>
              ) : null}
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-400 leading-tight">
                {post.timeAgo ? <span>{post.timeAgo}</span> : null}
                {post.timeAgo ? <span>·</span> : null}
                <Globe className="h-3 w-3" />
              </p>
            </div>
            {post.sourceUrl ? (
              <a
                href={post.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-full border border-[#0a66c2] px-3 py-1 text-[12px] font-semibold text-[#0a66c2] transition hover:bg-[#0a66c2]/5"
              >
                + Follow
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4">
        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-zinc-800">
          {displayContent}
          {truncated ? (
            <>
              {"… "}
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="font-semibold text-zinc-600 hover:underline"
              >
                more
              </button>
            </>
          ) : null}
        </p>
      </div>

      {/* Image */}
      {post.imageUrl ? (
        <div className="mt-3 px-0">
          <PostImage src={post.imageUrl} alt={`Post by ${post.authorName}`} />
        </div>
      ) : null}

      {/* Engagement */}
      {(post.likesCount != null || post.commentsCount != null) ? (
        <div className="flex items-center justify-between px-4 py-2 text-[12px] text-zinc-400">
          {post.likesCount != null ? (
            <span className="flex items-center gap-1">
              <span className="flex -space-x-0.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0a66c2] text-[9px]">👍</span>
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#e34d41] text-[9px]">❤️</span>
              </span>
              <span>{formatCount(post.likesCount)}</span>
            </span>
          ) : <span />}
          {post.commentsCount != null ? (
            <span>{formatCount(post.commentsCount)} comments</span>
          ) : null}
        </div>
      ) : null}

      {/* Divider */}
      <div className="mx-4 border-t border-zinc-100" />

      {/* Actions */}
      <div className="flex items-center justify-around px-2 py-1">
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageSquare, label: "Comment" },
          { icon: Repeat2, label: "Repost" },
          { icon: Send, label: "Send" },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[12px] font-semibold text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-700"
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
