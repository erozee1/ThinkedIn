/**
 * CLI harness to test the chat agent on loaded data WITHOUT needing Clerk login.
 * Uses the service-role client (bypasses RLS) so it sees whichever user's data
 * is loaded — fine for a single-user test database.
 *
 *   npx tsx --env-file=.env.local scripts/test-agent.ts --user <id> "your question"
 *   npx tsx --env-file=.env.local scripts/test-agent.ts --user <id>   # runs a default suite
 *
 * Requires: data loaded (enrich.ts), functions.sql applied, OPENAI + ANTHROPIC keys.
 */
import { createAdminClient } from "../lib/supabase/admin";
import { runAgent } from "../lib/agent/run";
import type { MessagesMode } from "../lib/agent/tools";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const userIdArg = arg("--user");
if (!userIdArg) {
  console.error('Missing --user <id>. Example: --user demo "how many founders do I know?"');
  process.exit(1);
}
const userId: string = userIdArg;
const question = process.argv.slice(2).find((a) => !a.startsWith("--") && a !== userId);

const DEFAULT_SUITE = [
  "How many founders do I know?",
  "Find me someone who owns a software company",
  "Who should I reconnect with?",
  "What industries is my network strongest in?",
];

async function ask(supa: ReturnType<typeof createAdminClient>, mode: MessagesMode, q: string) {
  console.log(`\n\x1b[36m? ${q}\x1b[0m`);
  let answer = "";
  const matchNames: string[] = [];
  await runAgent({
    supa,
    userId,
    mode,
    message: q,
    onText: (t) => {
      answer += t;
      process.stdout.write(t);
    },
    onMatches: (m) => {
      matchNames.length = 0;
      matchNames.push(...m.map((c) => c.name));
    },
  });
  if (matchNames.length) console.log(`\n\x1b[90m  cards: ${matchNames.slice(0, 8).join(", ")}${matchNames.length > 8 ? "…" : ""}\x1b[0m`);
  console.log();
}

async function main() {
  const supa = createAdminClient();

  // Sanity: is there data + what mode is recorded?
  const { count } = await supa.from("connections").select("id", { count: "exact", head: true }).eq("user_id", userId);
  const { data: settings } = await supa.from("user_settings").select("messages_mode").eq("user_id", userId).maybeSingle();
  const mode = (settings?.messages_mode ?? "none") as MessagesMode;
  console.log(`Data: ${count ?? 0} connections for ${userId} | messages_mode=${mode}`);
  if (!count) {
    console.error("No connections — run enrich.ts first.");
    process.exit(1);
  }

  const questions = question ? [question] : DEFAULT_SUITE;
  for (const q of questions) await ask(supa, mode, q);
}

main().catch((e) => {
  console.error("\n❌ test-agent failed:", e.message);
  process.exit(1);
});
