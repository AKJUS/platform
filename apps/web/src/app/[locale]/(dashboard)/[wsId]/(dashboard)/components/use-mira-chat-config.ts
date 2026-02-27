'use client';

import { useQuery } from '@tanstack/react-query';
import { DefaultChatTransport } from '@tuturuuu/ai/core';
import { getGatewayModelId, type Model } from '@tuturuuu/ai/models';
import { useAiCredits } from '@tuturuuu/ui/hooks/use-ai-credits';
import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveTimezone } from '@/lib/calendar-settings-resolver';
import {
  CREDIT_SOURCE_STORAGE_KEY_PREFIX,
  type CreditSource,
  INITIAL_MODEL,
  THINKING_MODE_STORAGE_KEY_PREFIX,
  type ThinkingMode,
  WORKSPACE_CONTEXT_EVENT,
  WORKSPACE_CONTEXT_STORAGE_KEY_PREFIX,
} from './mira-chat-constants';

interface UseMiraChatConfigParams {
  wsId: string;
}

export function useMiraChatConfig({ wsId }: UseMiraChatConfigParams) {
  const [model, setModel] = useState<Model>(INITIAL_MODEL);
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>('fast');
  const [creditSource, setCreditSource] = useState<CreditSource>('workspace');
  const [workspaceContextId, setWorkspaceContextId] =
    useState<string>('personal');

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

  const { data: contextCredits } = useAiCredits(wsId);

  const { data: personalWorkspaceId } = useQuery<string | null>({
    queryKey: ['personal-workspace-id'],
    queryFn: async () => {
      const res = await fetch('/api/v1/infrastructure/resolve-workspace-id', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wsId: 'personal' }),
      });

      if (!res.ok) return null;
      const payload = (await res.json()) as { workspaceId?: string };
      return payload.workspaceId ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const isPersonalDashboardWorkspace =
    !!personalWorkspaceId && personalWorkspaceId === wsId;
  const workspaceCreditLocked =
    isPersonalDashboardWorkspace || contextCredits?.tier === 'FREE';

  const activeCreditSource: CreditSource = workspaceCreditLocked
    ? 'personal'
    : creditSource;
  const creditWsId =
    activeCreditSource === 'personal'
      ? (personalWorkspaceId ?? undefined)
      : wsId;

  const chatRequestBody = useMemo(
    () => ({
      wsId,
      workspaceContextId,
      model: gatewayModelId,
      isMiraMode: true,
      timezone: timezoneForChat,
      thinkingMode,
      creditSource: activeCreditSource,
      ...(creditWsId ? { creditWsId } : {}),
    }),
    [
      activeCreditSource,
      creditWsId,
      gatewayModelId,
      thinkingMode,
      timezoneForChat,
      workspaceContextId,
      wsId,
    ]
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

  useEffect(() => {
    const key = `${CREDIT_SOURCE_STORAGE_KEY_PREFIX}${wsId}`;
    const stored = localStorage.getItem(key);
    if (stored === 'workspace' || stored === 'personal') {
      setCreditSource(stored);
      return;
    }
    setCreditSource('workspace');
  }, [wsId]);

  useEffect(() => {
    localStorage.setItem(
      `${CREDIT_SOURCE_STORAGE_KEY_PREFIX}${wsId}`,
      creditSource
    );
  }, [creditSource, wsId]);

  useEffect(() => {
    if (!workspaceCreditLocked) return;
    if (creditSource !== 'personal') {
      setCreditSource('personal');
    }
  }, [creditSource, workspaceCreditLocked]);

  useEffect(() => {
    const key = `${WORKSPACE_CONTEXT_STORAGE_KEY_PREFIX}${wsId}`;
    const stored = localStorage.getItem(key)?.trim();
    setWorkspaceContextId(stored || 'personal');
  }, [wsId]);

  useEffect(() => {
    const nextWorkspaceContextId = workspaceContextId || 'personal';
    localStorage.setItem(
      `${WORKSPACE_CONTEXT_STORAGE_KEY_PREFIX}${wsId}`,
      nextWorkspaceContextId
    );
    window.dispatchEvent(
      new CustomEvent(WORKSPACE_CONTEXT_EVENT, {
        detail: { wsId, workspaceContextId: nextWorkspaceContextId },
      })
    );
  }, [workspaceContextId, wsId]);

  return {
    activeCreditSource,
    chatRequestBody,
    creditWsId,
    gatewayModelId,
    model,
    setCreditSource,
    setModel,
    supportsFileInput,
    thinkingMode,
    setThinkingMode,
    workspaceContextId,
    setWorkspaceContextId,
    transport,
    workspaceCreditLocked,
  };
}
