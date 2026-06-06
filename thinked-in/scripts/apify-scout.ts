/**
 * Discover an Apify actor's input/output shape before wiring it in.
 *
 *   npx tsx --env-file=.env.local scripts/apify-scout.ts <actorId> [--run <profileUrl>]
 *
 * Without --run: prints the actor name, example input, and input-schema field names.
 * With --run: actually calls the actor on one profile URL and dumps the output keys.
 */
import { ApifyClient } from "apify-client";

const actorId = process.argv[2] ?? "2SyF0bVxmgGr8IVCZ";
const runIdx = process.argv.indexOf("--run");
const runUrl = runIdx >= 0 ? process.argv[runIdx + 1] : null;

const token = process.env.APIFY_TOKEN;
if (!token) {
  console.error("Missing APIFY_TOKEN in .env.local");
  process.exit(1);
}

async function main() {
  const meta = await (await fetch(`https://api.apify.com/v2/acts/${actorId}?token=${token}`)).json();
  const d = meta.data ?? meta;
  console.log("actor:", `${d.username}/${d.name}`, "—", d.title);
  console.log("exampleRunInput:", JSON.stringify(d.exampleRunInput?.body ?? d.exampleRunInput ?? null, null, 2));

  const buildId = d.taggedBuilds?.latest?.buildId;
  if (buildId) {
    const build = await (await fetch(`https://api.apify.com/v2/actor-builds/${buildId}?token=${token}`)).json();
    const schemaRaw = build.data?.inputSchema;
    if (schemaRaw) {
      const schema = typeof schemaRaw === "string" ? JSON.parse(schemaRaw) : schemaRaw;
      console.log("\ninput schema fields:");
      for (const [k, v] of Object.entries<Record<string, unknown>>(schema.properties ?? {})) {
        console.log(`  - ${k} (${v.type})${schema.required?.includes(k) ? " *required" : ""}: ${v.title ?? ""}`);
      }
    }
  }

  if (runUrl) {
    console.log(`\nRunning actor on ${runUrl} ...`);
    const client = new ApifyClient({ token });
    // Try the most common URL input shapes; the actor ignores unknown keys.
    const input = {
      profileUrls: [runUrl],
      urls: [runUrl],
      startUrls: [{ url: runUrl }],
      username: runUrl,
      profileUrl: runUrl,
    };
    const run = await client.actor(actorId).call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log(`\nreturned ${items.length} item(s)`);
    if (items[0]) {
      console.log("\noutput keys:", Object.keys(items[0]).join(", "));
      console.log("\nfirst item (truncated):");
      console.log(JSON.stringify(items[0], null, 2).slice(0, 2500));
    }
  }
}

main().catch((e) => {
  console.error("scout failed:", e.message);
  process.exit(1);
});
