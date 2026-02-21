'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MiraMemory, MiraMemoryCategory } from '../types/mira';
import { miraKeys } from './use-mira';

interface MemoriesResponse {
  memories: MiraMemory[];
  grouped: Record<string, MiraMemory[]>;
  total: number;
}

interface CreateMemoryData {
  category: MiraMemoryCategory;
  key: string;
  value: string;
  source?: string;
  confidence?: number;
}

// Fetch memories
async function fetchMemories(category?: string): Promise<MemoriesResponse> {
  const url = category
    ? `/api/v1/mira/memories?category=${category}`
    : '/api/v1/mira/memories';
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Failed to fetch memories');
  }
  return res.json();
}

// Create/update memory
async function createMemory(
  data: CreateMemoryData
): Promise<{ memory: MiraMemory }> {
  const res = await fetch('/api/v1/mira/memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error('Failed to save memory');
  }
  return res.json();
}

// Delete memory
async function deleteMemory(memoryId: string): Promise<{ success: boolean }> {
  const res = await fetch('/api/v1/mira/memories', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memory_id: memoryId }),
  });
  if (!res.ok) {
    throw new Error('Failed to delete memory');
  }
  return res.json();
}

/**
 * Hook for fetching memories
 */
export function useMemories(category?: MiraMemoryCategory) {
  return useQuery({
    queryKey: miraKeys.memories(category),
    queryFn: () => fetchMemories(category),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook for creating/updating a memory
 */
export function useCreateMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMemory,
    onSuccess: (data, variables) => {
      // Optimistically update cache
      queryClient.setQueryData(
        miraKeys.memories(variables.category),
        (old: MemoriesResponse | undefined) => {
          if (!old) return old;

          const existingIndex = old.memories.findIndex(
            (m) => m.category === variables.category && m.key === variables.key
          );

          if (existingIndex >= 0) {
            // Update existing
            const newMemories = [...old.memories];
            newMemories[existingIndex] = data.memory;
            return {
              ...old,
              memories: newMemories,
            };
          }
          // Add new
          return {
            ...old,
            memories: [data.memory, ...old.memories],
            total: old.total + 1,
          };
        }
      );

      // Also invalidate the "all" memories query
      queryClient.invalidateQueries({ queryKey: miraKeys.memories() });
    },
  });
}

/**
 * Hook for deleting a memory
 */
export function useDeleteMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMemory,
    onSuccess: (_, memoryId) => {
      // Update all memory queries
      queryClient.setQueriesData(
        { queryKey: [...miraKeys.all, 'memories'] },
        (old: MemoriesResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            memories: old.memories.filter((m) => m.id !== memoryId),
            total: Math.max(0, old.total - 1),
          };
        }
      );
    },
  });
}

/**
 * Get memories by category
 */
export function useMemoriesByCategory() {
  const { data, ...rest } = useMemories();

  return {
    ...rest,
    data: data?.grouped ?? {},
    total: data?.total ?? 0,
  };
}
