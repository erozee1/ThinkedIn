// Targeted web research for a specific person.
// Uses Tavily Search API (TAVILY_API_KEY env var). Returns empty gracefully when key is absent.

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

async function tavilySearch(query: string, maxResults = 4): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        search_depth: "basic",
        include_raw_content: false,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json() as { results?: { title: string; url: string; content?: string }[] };
    return (data.results ?? []).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: (r.content ?? "").slice(0, 400),
    }));
  } catch {
    return [];
  }
}

export interface ResearchBrief {
  /** False when TAVILY_API_KEY is not set — agent should fall back to web_search. */
  available: boolean;
  name: string;
  recent_news: SearchResult[];
  technical_work: SearchResult[];
  talks_and_media: SearchResult[];
}

export async function researchPerson(params: {
  name: string;
  company?: string;
  role?: string;
}): Promise<ResearchBrief> {
  if (!process.env.TAVILY_API_KEY) {
    return { available: false, name: params.name, recent_news: [], technical_work: [], talks_and_media: [] };
  }

  const { name, company, role } = params;
  const base = [name, company].filter(Boolean).join(" ");

  const [recent_news, technical_work, talks_and_media] = await Promise.all([
    tavilySearch(`"${name}" ${company ?? ""} news article interview 2024 2025`.trim()),
    tavilySearch(`"${name}" ${company ?? ""} GitHub open source blog post technical`.trim()),
    tavilySearch(`"${name}" ${role ?? company ?? ""} talk keynote podcast speaker`.trim()),
  ]);

  return { available: true, name: base, recent_news, technical_work, talks_and_media };
}
