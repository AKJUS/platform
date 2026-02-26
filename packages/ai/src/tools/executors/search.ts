import { google } from '@ai-sdk/google';
import { gateway, generateText, stepCountIs } from 'ai';

const SEARCH_WRAPPER_MODEL = 'google/gemini-2.5-flash-lite';

type SearchSource = {
  sourceId?: string;
  title?: string;
  url?: string;
};

function normalizeSources(value: unknown): SearchSource[] {
  if (!Array.isArray(value)) return [];

  const normalized: SearchSource[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;

    const source = item as Record<string, unknown>;
    const sourceId =
      typeof source.sourceId === 'string' ? source.sourceId : undefined;
    const title = typeof source.title === 'string' ? source.title : undefined;
    const url = typeof source.url === 'string' ? source.url : undefined;

    if (!sourceId && !title && !url) continue;

    normalized.push({ sourceId, title, url });
  }

  return normalized;
}

export async function executeGoogleSearch(args: Record<string, unknown>) {
  const query =
    typeof args.query === 'string' ? args.query.trim().slice(0, 500) : '';

  if (!query) {
    return { ok: false, error: 'Missing required `query`.' };
  }

  const result = await generateText({
    model: gateway(SEARCH_WRAPPER_MODEL),
    tools: {
      google_search: google.tools.googleSearch({}),
    },
    prompt: `Search the web for the query below and provide an accurate, concise answer with key points and cited sources.\n\nQuery: ${query}`,
    stopWhen: stepCountIs(3),
  });

  const sources = normalizeSources((result as { sources?: unknown }).sources);

  return {
    ok: true,
    query,
    answer: result.text,
    sources,
    sourceCount: sources.length,
  };
}
