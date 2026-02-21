'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface MiraSoul {
  id?: string;
  user_id?: string;
  name: string;
  tone?: string | null;
  personality?: string | null;
  boundaries?: string | null;
  vibe?: string | null;
  push_tone?: string | null;
  chat_tone?: string | null;
}

interface MiraSoulResponse {
  soul: MiraSoul;
}

const miraSoulKeys = {
  all: ['mira-soul'] as const,
  detail: () => [...miraSoulKeys.all, 'detail'] as const,
};

async function fetchMiraSoul(): Promise<MiraSoulResponse> {
  const res = await fetch('/api/v1/mira/soul', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch soul');
  return res.json();
}

async function updateMiraSoul(
  data: Partial<MiraSoul>
): Promise<MiraSoulResponse> {
  const res = await fetch('/api/v1/mira/soul', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update soul');
  return res.json();
}

export function useMiraSoul() {
  return useQuery({
    queryKey: miraSoulKeys.detail(),
    queryFn: fetchMiraSoul,
    staleTime: 1000 * 60 * 5, // 5 minutes
    select: (data) => data.soul,
  });
}

export function useUpdateMiraSoul() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMiraSoul,
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: miraSoulKeys.detail() });
      const previous = queryClient.getQueryData<MiraSoulResponse>(
        miraSoulKeys.detail()
      );

      queryClient.setQueryData<MiraSoulResponse>(
        miraSoulKeys.detail(),
        (old) => (old ? { soul: { ...old.soul, ...newData } } : old)
      );

      return { previous };
    },
    onError: (_err, _newData, context) => {
      if (context?.previous) {
        queryClient.setQueryData(miraSoulKeys.detail(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: miraSoulKeys.detail() });
    },
  });
}
