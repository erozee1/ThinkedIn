import { clerkClient } from "@clerk/nextjs/server";
import { Users, TrendingUp, Clock } from "lucide-react";

function daysAgo(ms: number): string {
  const days = Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default async function ClerkStats() {
  const clerk = await clerkClient();

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const [totalCount, recent] = await Promise.all([
    clerk.users.getCount(),
    clerk.users.getUserList({
      limit: 8,
      orderBy: "-created_at",
    }),
  ]);

  const newThisMonth = recent.data.filter(
    (u) => u.createdAt > thirtyDaysAgo,
  ).length;

  // Rough weekly growth: users created in last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = recent.data.filter(
    (u) => u.createdAt > sevenDaysAgo,
  ).length;

  return (
    <div className="mt-16 ml-[88px] space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">
          Live Traction
        </p>

        {/* Stat pills */}
        <div className="flex flex-wrap gap-3 mb-8">
          <div className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <Users className="h-4 w-4 text-emerald-500 shrink-0" />
            <div>
              <p className="text-xl font-bold text-zinc-900 leading-none">{totalCount}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">total users</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <TrendingUp className="h-4 w-4 text-blue-500 shrink-0" />
            <div>
              <p className="text-xl font-bold text-zinc-900 leading-none">{newThisMonth}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">joined last 30 days</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <Clock className="h-4 w-4 text-violet-500 shrink-0" />
            <div>
              <p className="text-xl font-bold text-zinc-900 leading-none">{newThisWeek}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">joined last 7 days</p>
            </div>
          </div>
        </div>

        {/* Recent signups */}
        {recent.data.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-3">
              Recent signups
            </p>
            <div className="flex flex-col gap-2">
              {recent.data.map((user) => {
                const name =
                  [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                  user.emailAddresses[0]?.emailAddress?.split("@")[0] ||
                  "Anonymous";
                const email = user.emailAddresses[0]?.emailAddress ?? null;
                const avatar = user.imageUrl;

                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-white px-3 py-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatar}
                      alt={name}
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-zinc-800 truncate">{name}</p>
                      {email && (
                        <p className="text-[10px] text-zinc-400 truncate">{email}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 shrink-0">
                      {daysAgo(user.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
