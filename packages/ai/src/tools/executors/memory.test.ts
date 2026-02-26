import { embed } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MiraToolContext } from '../mira-tools';
import { executeRecall, executeRemember } from './memory';

vi.mock('ai', () => ({
  embed: vi.fn(),
  tool: vi.fn((definition) => definition),
}));

function createContextWithSupabase(supabase: unknown): MiraToolContext {
  return {
    userId: 'user-1',
    wsId: 'ws-1',
    timezone: 'Asia/Saigon',
    supabase: supabase as MiraToolContext['supabase'],
  };
}

describe('memory executor embeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('remember requests 3072-d retrieval-document embeddings', async () => {
    const embedMock = vi.mocked(embed);
    embedMock.mockResolvedValue({
      embedding: Array.from({ length: 3072 }, (_, i) => i / 1000),
    } as Awaited<ReturnType<typeof embed>>);

    const insert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const eq = vi.fn();
    eq.mockReturnValue({ eq, maybeSingle });
    const select = vi.fn().mockReturnValue({ eq, maybeSingle });
    const from = vi.fn().mockImplementation(() => ({
      select,
      insert,
    }));

    const result = await executeRemember(
      {
        key: 'favorite_music',
        value: 'listens to synthwave',
        category: 'preference',
      },
      createContextWithSupabase({ from })
    );

    expect(result).toMatchObject({ success: true });
    expect(embedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 'favorite_music: listens to synthwave',
        providerOptions: {
          google: {
            outputDimensionality: 3072,
            taskType: 'RETRIEVAL_DOCUMENT',
          },
        },
      })
    );
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('recall requests 3072-d retrieval-query embeddings', async () => {
    const embedMock = vi.mocked(embed);
    embedMock.mockResolvedValue({
      embedding: Array.from({ length: 3072 }, (_, i) => i / 1000),
    } as Awaited<ReturnType<typeof embed>>);

    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const missingEmbeddingsQuery = {
      eq: vi.fn(),
      is: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    } as const;
    missingEmbeddingsQuery.eq.mockReturnValue(missingEmbeddingsQuery);
    missingEmbeddingsQuery.is.mockReturnValue(missingEmbeddingsQuery);
    missingEmbeddingsQuery.order.mockReturnValue(missingEmbeddingsQuery);
    missingEmbeddingsQuery.limit.mockResolvedValue({ data: [], error: null });

    const updateChain = {
      eq: vi.fn(),
      in: vi.fn(),
    } as const;
    updateChain.eq.mockReturnValue(updateChain);
    updateChain.in.mockResolvedValue({ error: null });

    const from = vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnValue(missingEmbeddingsQuery),
      update: vi.fn().mockReturnValue(updateChain),
    }));

    const result = await executeRecall(
      {
        query: 'favorite music',
        maxResults: 5,
      },
      createContextWithSupabase({ from, rpc })
    );

    expect(result).toMatchObject({ count: 0 });
    expect(embedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 'favorite music',
        providerOptions: {
          google: {
            outputDimensionality: 3072,
            taskType: 'RETRIEVAL_QUERY',
          },
        },
      })
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('recall regenerates missing memory embeddings and retries semantic search', async () => {
    const embedMock = vi.mocked(embed);
    embedMock
      .mockResolvedValueOnce({
        embedding: Array.from({ length: 3072 }, (_, i) => i / 1000),
      } as Awaited<ReturnType<typeof embed>>)
      .mockResolvedValueOnce({
        embedding: Array.from({ length: 3072 }, (_, i) => i / 1000),
      } as Awaited<ReturnType<typeof embed>>);

    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'memory-1',
            key: 'favorite_music',
            value: 'synthwave',
            category: 'preference',
            similarity: 0.9,
            updated_at: new Date().toISOString(),
          },
        ],
        error: null,
      });

    const missingEmbeddingsQuery = {
      eq: vi.fn(),
      is: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    } as const;
    missingEmbeddingsQuery.eq.mockReturnValue(missingEmbeddingsQuery);
    missingEmbeddingsQuery.is.mockReturnValue(missingEmbeddingsQuery);
    missingEmbeddingsQuery.order.mockReturnValue(missingEmbeddingsQuery);
    missingEmbeddingsQuery.limit.mockResolvedValue({
      data: [{ id: 'memory-1', key: 'favorite_music', value: 'synthwave' }],
      error: null,
    });

    const updateChain = {
      eq: vi.fn(),
      in: vi.fn(),
    } as const;
    updateChain.eq.mockReturnValue(updateChain);
    updateChain.in.mockResolvedValue({ error: null });

    const update = vi.fn().mockReturnValue(updateChain);
    const from = vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnValue(missingEmbeddingsQuery),
      update,
    }));

    const result = await executeRecall(
      {
        query: 'favorite music',
        maxResults: 5,
      },
      createContextWithSupabase({ from, rpc })
    );

    expect(result).toMatchObject({ count: 1 });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(embedMock).toHaveBeenCalledTimes(2);
    expect(embedMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        value: 'favorite_music: synthwave',
        providerOptions: {
          google: {
            outputDimensionality: 3072,
            taskType: 'RETRIEVAL_DOCUMENT',
          },
        },
      })
    );
    expect(update).toHaveBeenCalled();
  });
});
