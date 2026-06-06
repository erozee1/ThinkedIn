import OpenAI from "openai";
import { requireEnv } from "./supabase/env";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIM = 1536;

let client: OpenAI | null = null;
function openai(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  return client;
}

/** pgvector wants a string literal like "[0.1,0.2,...]". */
export function toVectorLiteral(values: number[]): string {
  return "[" + values.join(",") + "]";
}

/**
 * Embed many texts, batched. Returns vectors index-aligned with the input.
 * Empty/whitespace inputs get a null so callers can skip storing them.
 */
export async function embedTexts(
  texts: string[],
  batchSize = 96,
): Promise<(number[] | null)[]> {
  const out: (number[] | null)[] = new Array(texts.length).fill(null);

  // Collect indices of non-empty inputs; only those are sent to the API.
  const todo = texts
    .map((t, i) => ({ t: t?.trim() ?? "", i }))
    .filter((x) => x.t.length > 0);

  for (let b = 0; b < todo.length; b += batchSize) {
    const slice = todo.slice(b, b + batchSize);
    const res = await openai().embeddings.create({
      model: EMBEDDING_MODEL,
      input: slice.map((s) => s.t),
    });
    res.data.forEach((d, k) => {
      out[slice[k].i] = d.embedding;
    });
  }
  return out;
}

/** Convenience for a single embedding (e.g. a search query). */
export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  if (!v) throw new Error("embedOne: empty input produced no embedding");
  return v;
}
