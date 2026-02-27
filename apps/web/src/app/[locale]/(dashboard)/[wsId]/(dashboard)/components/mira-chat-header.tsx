'use client';

import type { Model } from '@tuturuuu/ai/models';
import {
  Brain,
  Download,
  Ellipsis,
  Eye,
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  PanelBottomOpen,
  Zap,
} from '@tuturuuu/icons';
import { Button } from '@tuturuuu/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@tuturuuu/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@tuturuuu/ui/tooltip';
import type { ReactNode } from 'react';
import { useState } from 'react';
import type { CreditSource, ThinkingMode } from './mira-chat-constants';
import MiraCreditBar from './mira-credit-bar';
import MiraModelSelector from './mira-model-selector';

interface MiraChatHeaderProps {
  activeCreditSource: CreditSource;
  creditWsId?: string;
  wsId: string;
  hasMessages: boolean;
  hotkeyLabels: {
    export: string;
    fastMode: string;
    fullscreen: string;
    modelPicker: string;
    newChat: string;
    thinkingMode: string;
    viewOnly: string;
  };
  insightsDock?: ReactNode;
  isFullscreen?: boolean;
  model: Model;
  modelPickerHotkeySignal: number;
  onCreditSourceChange: (source: CreditSource) => void;
  onExportChat: () => void;
  onModelChange: (model: Model) => void;
  onNewConversation: () => void;
  onThinkingModeChange: (mode: ThinkingMode) => void;
  onToggleFullscreen?: () => void;
  onToggleViewOnly: () => void;
  t: (...args: any[]) => string;
  thinkingMode: ThinkingMode;
  viewOnly: boolean;
  workspaceCreditLocked: boolean;
}

export function MiraChatHeader({
  activeCreditSource,
  creditWsId,
  wsId,
  hasMessages,
  hotkeyLabels,
  insightsDock,
  isFullscreen,
  model,
  modelPickerHotkeySignal,
  onCreditSourceChange,
  onExportChat,
  onModelChange,
  onNewConversation,
  onThinkingModeChange,
  onToggleFullscreen,
  onToggleViewOnly,
  t,
  thinkingMode,
  viewOnly,
  workspaceCreditLocked,
}: MiraChatHeaderProps) {
  const [isCreditSourceMenuOpen, setIsCreditSourceMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isThinkingMenuOpen, setIsThinkingMenuOpen] = useState(false);

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 pb-2">
      <div className="w-full min-w-0 max-w-md">
        <MiraModelSelector
          wsId={wsId}
          model={model}
          onChange={onModelChange}
          disabled={false}
          hotkeySignal={modelPickerHotkeySignal}
          shortcutLabel={hotkeyLabels.modelPicker}
        />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <DropdownMenu
          open={isCreditSourceMenuOpen}
          onOpenChange={setIsCreditSourceMenuOpen}
        >
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-2 text-xs"
              title={t('credit_source_label')}
              aria-label={t('credit_source_label')}
            >
              {activeCreditSource === 'personal'
                ? t('credit_source_personal')
                : t('credit_source_workspace')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem
              className="items-start"
              disabled={workspaceCreditLocked}
              onSelect={() => {
                onCreditSourceChange('workspace');
                setIsCreditSourceMenuOpen(false);
              }}
              title={
                workspaceCreditLocked
                  ? t('credit_source_workspace_locked_free')
                  : t('credit_source_workspace_desc')
              }
            >
              <div className="flex flex-col gap-0.5">
                <span>{t('credit_source_workspace')}</span>
                <span className="text-muted-foreground text-xs">
                  {workspaceCreditLocked
                    ? t('credit_source_workspace_locked_free')
                    : t('credit_source_workspace_desc')}
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="items-start"
              onSelect={() => {
                onCreditSourceChange('personal');
                setIsCreditSourceMenuOpen(false);
              }}
              title={t('credit_source_personal_desc')}
            >
              <div className="flex flex-col gap-0.5">
                <span>{t('credit_source_personal')}</span>
                <span className="text-muted-foreground text-xs">
                  {t('credit_source_personal_desc')}
                </span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu
          open={isThinkingMenuOpen}
          onOpenChange={setIsThinkingMenuOpen}
        >
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 px-2 text-xs"
              title={t('thinking_mode_label')}
              aria-label={t('thinking_mode_label')}
            >
              {thinkingMode === 'thinking' ? (
                <Brain className="h-3.5 w-3.5" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              {thinkingMode === 'thinking'
                ? t('thinking_mode_thinking')
                : t('thinking_mode_fast')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onSelect={() => {
                onThinkingModeChange('fast');
                setIsThinkingMenuOpen(false);
              }}
              title={t('thinking_mode_fast_desc')}
              className="gap-2"
            >
              <Zap className="h-3.5 w-3.5" />
              {t('thinking_mode_fast')}
              <span className="ml-auto text-muted-foreground text-xs">
                {hotkeyLabels.fastMode}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                onThinkingModeChange('thinking');
                setIsThinkingMenuOpen(false);
              }}
              title={t('thinking_mode_thinking_desc')}
              className="gap-2"
            >
              <Brain className="h-3.5 w-3.5" />
              {t('thinking_mode_thinking')}
              <span className="ml-auto text-muted-foreground text-xs">
                {hotkeyLabels.thinkingMode}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-2">
          <MiraCreditBar wsId={creditWsId} />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onNewConversation}
              aria-label={t('new_conversation')}
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {`${t('new_conversation')} (${hotkeyLabels.newChat})`}
          </TooltipContent>
        </Tooltip>
        <DropdownMenu open={isMoreMenuOpen} onOpenChange={setIsMoreMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2"
              title={t('more_actions')}
            >
              <Ellipsis className="h-4 w-4" />
              <span className="text-xs">{t('more_actions')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {hasMessages && (
              <DropdownMenuItem
                onSelect={() => {
                  onExportChat();
                  setIsMoreMenuOpen(false);
                }}
              >
                <Download className="h-4 w-4" />
                {t('export_chat')}
                <span className="ml-auto text-muted-foreground text-xs">
                  {hotkeyLabels.export}
                </span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={!hasMessages}
              onSelect={() => {
                if (!hasMessages) return;
                onToggleViewOnly();
                setIsMoreMenuOpen(false);
              }}
            >
              {viewOnly ? (
                <PanelBottomOpen className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {viewOnly ? t('show_input_panel') : t('view_only')}
              <span className="ml-auto text-muted-foreground text-xs">
                {hotkeyLabels.viewOnly}
              </span>
            </DropdownMenuItem>
            {onToggleFullscreen && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    onToggleFullscreen();
                    setIsMoreMenuOpen(false);
                  }}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                  {isFullscreen ? t('exit_fullscreen') : t('fullscreen')}
                  <span className="ml-auto text-muted-foreground text-xs">
                    {hotkeyLabels.fullscreen}
                  </span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {insightsDock && <div className="shrink-0">{insightsDock}</div>}
      </div>
    </div>
  );
}
