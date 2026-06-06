/**
 * Dev sanity-check for the Phase 1 data pipeline. Reads the raw CSV exports,
 * runs parse → normalize → infer → aggregate, and prints distributions.
 *
 *   npx tsx scripts/inspect-data.ts ../Connections.csv ../messages.csv
 */
import { readFileSync } from "node:fs";
import { parseConnections, fullName } from "../lib/data/connections";
import { parseMessages } from "../lib/data/messages";
import { aggregateRelationships } from "../lib/data/relationships";
import { inferSeniority } from "../lib/data/seniority";

const [connPath = "../Connections.csv", msgPath = "../messages.csv"] = process.argv.slice(2);

const tally = (items: (string | null)[]) => {
  const m = new Map<string, number>();
  for (const i of items) {
    const k = i ?? "(none)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const connections = parseConnections(readFileSync(connPath, "utf8"));
const { owner, messages } = parseMessages(readFileSync(msgPath, "utf8"));
const rel = aggregateRelationships(messages, connections, new Date());

console.log(`\nConnections: ${connections.length}`);
console.log(`Messages: ${messages.length}  (owner: ${owner.name})`);
console.log(
  `Matched: ${rel.matchedConnections} connections / ${rel.matchedMessages} messages ` +
    `(${rel.unmatchedMessages} unmatched)\n`,
);

console.log("Seniority:");
for (const [k, n] of tally(connections.map((c) => inferSeniority(c.position)))) {
  console.log(`  ${String(n).padStart(4)}  ${k}`);
}

// Note: country/city/industry only exist after Apify enrichment (Phase 3).

console.log("\nRelationship strength:");
for (const [k, n] of tally(rel.perConnection.map((a) => a.relationshipStrength))) {
  console.log(`  ${String(n).padStart(4)}  ${k}`);
}

console.log("\nTop 8 relationships by message volume:");
const ranked = connections
  .map((c, i) => ({ name: fullName(c), agg: rel.perConnection[i] }))
  .filter((x) => x.agg.messageCount > 0)
  .sort((a, b) => b.agg.messageCount - a.agg.messageCount)
  .slice(0, 8);
for (const r of ranked) {
  console.log(
    `  ${String(r.agg.messageCount).padStart(4)}  ${r.name.padEnd(28)} ` +
      `${r.agg.relationshipStrength}`,
  );
}
console.log();
