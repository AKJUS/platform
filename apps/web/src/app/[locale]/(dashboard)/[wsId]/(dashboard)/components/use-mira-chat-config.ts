'use client';

import { useQuery } from '@tanstack/react-query';
import { DefaultChatTransport } from '@tuturuuu/ai/core';
import { getGatewayModelId, type Model } from '@tuturuuu/ai/models';
import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveTimezone } from '@/lib/calendar-settings-resolver';
import {
  INITIAL_MODEL,
  THINKING_MODE_STORAGE_KEY_PREFIX,
  type ThinkingMode,
} from './mira-chat-constants';

interface UseMiraChatConfigParams {
  wsId: string;
}

export function useMiraChatConfig({ wsId }: UseMiraChatConfigParams) {
  const [model, setModel] = useState<Model>(INITIAL_MODEL);
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>('fast');

  const supportsFileInput = useMemo(() => {
    const tags = model.tags;
    return Array.isArray(tags) && tags.includes('file-input');
  }, [model]);

  const gatewayModelId = useMemo(
    () => getGatewayModelId(model.value, model.provider),
    [model]
  );

  const { data: userCalendarSettings } = useQuery({
    queryKey: ['users', 'calendar-settings'],
    queryFn: async () => {
      const res = await fetch('/api/v1/users/calendar-settings', {
        cache: 'no-store',
      });
      if (!res.ok) return null;
      return (await res.json()) as { timezone?: string | null };
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: workspaceCalendarSettings } = useQuery({
    queryKey: ['workspace-calendar-settings', wsId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/workspaces/${wsId}/calendar-settings`, {
        cache: 'no-store',
      });
      if (!res.ok) return null;
      return (await res.json()) as { timezone?: string | null };
    },
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
  });

  const timezoneForChat = useMemo(
    () =>
      resolveTimezone(
        userCalendarSettings ?? null,
        workspaceCalendarSettings ?? null
      ),
    [userCalendarSettings, workspaceCalendarSettings]
  );

  const chatRequestBody = useMemo(
    () => ({
      wsId,
      model: gatewayModelId,
      isMiraMode: true,
      timezone: timezoneForChat,
      thinkingMode,
    }),
    [gatewayModelId, thinkingMode, timezoneForChat, wsId]
  );
  const chatRequestBodyRef = useRef(chatRequestBody);
  chatRequestBodyRef.current = chatRequestBody;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai/chat',
        credentials: 'include',
        body: () => chatRequestBodyRef.current,
      }),
    []
  );

  useEffect(() => {
    const key = `${THINKING_MODE_STORAGE_KEY_PREFIX}${wsId}`;
    const stored = localStorage.getItem(key);
    if (stored === 'fast' || stored === 'thinking') {
      setThinkingMode(stored);
      return;
    }
    setThinkingMode('fast');
  }, [wsId]);

  useEffect(() => {
    localStorage.setItem(
      `${THINKING_MODE_STORAGE_KEY_PREFIX}${wsId}`,
      thinkingMode
    );
  }, [thinkingMode, wsId]);

  return {
    chatRequestBody,
    gatewayModelId,
    model,
    setModel,
    supportsFileInput,
    thinkingMode,
    setThinkingMode,
    transport,
  };
}
