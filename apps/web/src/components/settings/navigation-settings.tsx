'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from '@tuturuuu/icons';
import {
  getUserWorkspaceConfig,
  listWorkspaceBoards,
  normalizeRootNavigationConfig,
  type RootNavigationTarget,
  updateUserWorkspaceConfig,
} from '@tuturuuu/internal-api';
import type { WorkspaceUser } from '@tuturuuu/types/primitives/WorkspaceUser';
import { Button } from '@tuturuuu/ui/button';
import { Label } from '@tuturuuu/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tuturuuu/ui/select';
import { Separator } from '@tuturuuu/ui/separator';
import { toast } from '@tuturuuu/ui/sonner';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import DefaultWorkspaceSetting from './workspace/default-workspace-setting';

const ROOT_DEFAULT_NAVIGATION_CONFIG_ID = 'ROOT_DEFAULT_NAVIGATION';

const TARGET_VALUES: RootNavigationTarget[] = [
  'workspace_home',
  'tasks',
  'calendar',
  'finance',
];

const TASK_SUBMODULES = ['home', 'boards'] as const;
const FINANCE_SUBMODULES = [
  'home',
  'transactions',
  'wallets',
  'invoices',
] as const;

function serializeNavigationConfig(config: {
  target: RootNavigationTarget;
  submodule: string;
  boardId: string;
}) {
  const payload: {
    target: RootNavigationTarget;
    submodule?: string;
    boardId?: string;
  } = { target: config.target };

  if (config.target === 'tasks') {
    payload.submodule = config.submodule;
    if (config.submodule === 'boards' && config.boardId !== 'none') {
      payload.boardId = config.boardId;
    }
  }

  if (config.target === 'finance') {
    payload.submodule = config.submodule;
  }

  return JSON.stringify(payload);
}

interface NavigationSettingsProps {
  wsId?: string;
  user: WorkspaceUser | null;
}

export default function NavigationSettings({
  wsId,
  user,
}: NavigationSettingsProps) {
  const t = useTranslations('settings.preferences.navigation');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();

  const { data: savedConfig, isLoading: isConfigLoading } = useQuery({
    queryKey: [
      'user-workspace-config',
      wsId,
      ROOT_DEFAULT_NAVIGATION_CONFIG_ID,
    ],
    queryFn: async () => {
      if (!wsId) {
        return null;
      }

      const response = await getUserWorkspaceConfig(
        wsId,
        ROOT_DEFAULT_NAVIGATION_CONFIG_ID
      );
      return response.value;
    },
    enabled: Boolean(wsId),
  });

  const normalizedSavedConfig = useMemo(
    () => normalizeRootNavigationConfig(savedConfig ?? null),
    [savedConfig]
  );

  const [draftConfig, setDraftConfig] = useState(normalizedSavedConfig);
  const [lastHydratedValue, setLastHydratedValue] = useState<string>('');

  useEffect(() => {
    const currentSavedValue = savedConfig ?? '';
    if (currentSavedValue !== lastHydratedValue) {
      setDraftConfig(normalizedSavedConfig);
      setLastHydratedValue(currentSavedValue);
    }
  }, [lastHydratedValue, normalizedSavedConfig, savedConfig]);

  const safeTarget: RootNavigationTarget = TARGET_VALUES.includes(
    draftConfig.target
  )
    ? draftConfig.target
    : 'workspace_home';
  const safeSubmoduleForTasks = (TASK_SUBMODULES as readonly string[]).includes(
    draftConfig.submodule
  )
    ? draftConfig.submodule
    : 'home';

  const shouldFetchBoards =
    Boolean(wsId) &&
    safeTarget === 'tasks' &&
    safeSubmoduleForTasks === 'boards';

  const { data: boardsPayload, isFetched: areBoardsFetched } = useQuery({
    queryKey: ['navigation-settings-boards', wsId],
    queryFn: () => listWorkspaceBoards(wsId!),
    enabled: shouldFetchBoards,
    staleTime: 60 * 1000,
  });

  const boards = useMemo(() => {
    return (boardsPayload?.boards ?? []).filter(
      (board) => !board.deleted_at && !board.archived_at
    );
  }, [boardsPayload]);

  const safeSubmoduleForFinance = (
    FINANCE_SUBMODULES as readonly string[]
  ).includes(draftConfig.submodule)
    ? draftConfig.submodule
    : 'home';
  const hasBoardOptions = shouldFetchBoards && areBoardsFetched;
  const selectedBoardExists =
    draftConfig.boardId === 'none' ||
    !hasBoardOptions ||
    boards.some((board) => board.id === draftConfig.boardId);
  const safeBoardId =
    draftConfig.boardId === 'none' || selectedBoardExists
      ? draftConfig.boardId
      : 'none';

  useEffect(() => {
    if (!hasBoardOptions) {
      return;
    }

    if (safeBoardId === draftConfig.boardId) {
      return;
    }

    setDraftConfig((previous) => ({
      ...previous,
      boardId: safeBoardId,
    }));
  }, [draftConfig.boardId, hasBoardOptions, safeBoardId]);

  const normalizedDraftConfig = useMemo(
    () => ({
      ...draftConfig,
      boardId: safeBoardId,
    }),
    [draftConfig, safeBoardId]
  );

  const serializedCurrentConfig = useMemo(
    () => serializeNavigationConfig(normalizedDraftConfig),
    [normalizedDraftConfig]
  );
  const serializedSavedConfig = useMemo(
    () => serializeNavigationConfig(normalizedSavedConfig),
    [normalizedSavedConfig]
  );

  const isDirty = serializedCurrentConfig !== serializedSavedConfig;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!wsId) {
        throw new Error('Workspace ID is required');
      }

      return updateUserWorkspaceConfig(
        wsId,
        ROOT_DEFAULT_NAVIGATION_CONFIG_ID,
        serializedCurrentConfig
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [
          'user-workspace-config',
          wsId,
          ROOT_DEFAULT_NAVIGATION_CONFIG_ID,
        ],
      });
      toast.success(t('save_success'));
    },
    onError: () => {
      toast.error(t('save_error'));
    },
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h3 className="font-medium text-lg">{t('title')}</h3>
        <p className="text-muted-foreground text-sm">{t('description')}</p>
      </div>

      <div className="rounded-lg border p-4">
        <div className="space-y-3">
          <Label>{t('default_workspace_label')}</Label>
          <DefaultWorkspaceSetting
            defaultWorkspaceId={user?.default_workspace_id}
            user={user}
          />
          <p className="text-muted-foreground text-xs">
            {t('default_workspace_help')}
          </p>
        </div>
      </div>

      <Separator />

      {!wsId ? (
        <p className="text-muted-foreground text-sm">
          {t('workspace_required')}
        </p>
      ) : isConfigLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          <div className="grid gap-2">
            <Label>{t('root_target_label')}</Label>
            <Select
              value={safeTarget}
              onValueChange={(value) => {
                if (!TARGET_VALUES.includes(value as RootNavigationTarget)) {
                  return;
                }

                const nextTarget = value as RootNavigationTarget;
                setDraftConfig({
                  target: nextTarget,
                  submodule: 'home',
                  boardId: 'none',
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workspace_home">
                  {t('targets.workspace_home')}
                </SelectItem>
                <SelectItem value="tasks">{t('targets.tasks')}</SelectItem>
                <SelectItem value="calendar">
                  {t('targets.calendar')}
                </SelectItem>
                <SelectItem value="finance">{t('targets.finance')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {t('root_target_help')}
            </p>
          </div>

          {safeTarget === 'tasks' && (
            <div className="grid gap-2">
              <Label>{t('tasks_submodule_label')}</Label>
              <Select
                value={safeSubmoduleForTasks}
                onValueChange={(value) => {
                  if ((TASK_SUBMODULES as readonly string[]).includes(value)) {
                    setDraftConfig((previous) => ({
                      ...previous,
                      submodule: value,
                      boardId: value === 'boards' ? previous.boardId : 'none',
                    }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">
                    {t('tasks_submodules.home')}
                  </SelectItem>
                  <SelectItem value="boards">
                    {t('tasks_submodules.boards')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {safeTarget === 'tasks' && safeSubmoduleForTasks === 'boards' && (
            <div className="grid gap-2">
              <Label>{t('tasks_board_label')}</Label>
              <Select
                value={safeBoardId}
                onValueChange={(value) =>
                  setDraftConfig((previous) => ({
                    ...previous,
                    boardId: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('tasks_board_any')}</SelectItem>
                  {boards.map((board) => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.name || t('unnamed_board')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedBoardExists && (
                <p className="text-amber-600 text-xs">
                  {t('stale_board_warning')}
                </p>
              )}
            </div>
          )}

          {safeTarget === 'finance' && (
            <div className="grid gap-2">
              <Label>{t('finance_submodule_label')}</Label>
              <Select
                value={safeSubmoduleForFinance}
                onValueChange={(value) => {
                  if (
                    (FINANCE_SUBMODULES as readonly string[]).includes(value)
                  ) {
                    setDraftConfig((previous) => ({
                      ...previous,
                      submodule: value,
                    }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">
                    {t('finance_submodules.home')}
                  </SelectItem>
                  <SelectItem value="transactions">
                    {t('finance_submodules.transactions')}
                  </SelectItem>
                  <SelectItem value="wallets">
                    {t('finance_submodules.wallets')}
                  </SelectItem>
                  <SelectItem value="invoices">
                    {t('finance_submodules.invoices')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="submit" disabled={!isDirty || saveMutation.isPending}>
            {saveMutation.isPending
              ? tCommon('saving')
              : tCommon('save_changes')}
          </Button>
        </form>
      )}
    </div>
  );
}
