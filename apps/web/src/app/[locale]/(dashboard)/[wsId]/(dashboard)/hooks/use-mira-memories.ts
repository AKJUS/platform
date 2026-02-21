'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface MiraMemory {
  id: string;
  user_id: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  source?: string | null;
  last_referenced_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface MiraMemoriesResponse {
  memories: MiraMemory[];
  grouped: Record<string, MiraMemory[]>;
  total: number;
}

const miraMemoriesKeys = {
  all: ['mira-memories'] as const,
  list: () => [...miraMemoriesKeys.all, 'list'] as const,
};

async function fetchMiraMemories(): Promise<MiraMemoriesResponse> {
  const res = await fetch('/api/v1/mira/memories', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch memories');
  return res.json();
}

async function deleteMiraMemory(memoryId: string): Promise<void> {
  const res = await fetch('/api/v1/mira/memories', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memory_id: memoryId }),
  });
  if (!res.ok) throw new Error('Failed to delete memory');
}

export function useMiraMemories() {
  return useQuery({
    queryKey: miraMemoriesKeys.list(),
    queryFn: fetchMiraMemories,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useDeleteMiraMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMiraMemory,
    onMutate: async (memoryId) => {
      await queryClient.cancelQueries({
        queryKey: miraMemoriesKeys.list(),
      });

      const previous = queryClient.getQueryData<MiraMemoriesResponse>(
        miraMemoriesKeys.list()
      );

      // Optimistic removal
      queryClient.setQueryData<MiraMemoriesResponse>(
        miraMemoriesKeys.list(),
        (old) => {
          if (!old) return old;
          const filtered = old.memories.filter((m) => m.id !== memoryId);
          const grouped = filtered.reduce(
            (acc, m) => {
              const cat = m.category;
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(m);
              return acc;
            },
            {} as Record<string, MiraMemory[]>
          );
          return { memories: filtered, grouped, total: filtered.length };
        }
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(miraMemoriesKeys.list(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: miraMemoriesKeys.list() });
    },
  });
}
