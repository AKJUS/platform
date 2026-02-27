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
import type { ThinkingMode } from './mira-chat-constants';
import MiraCreditBar from './mira-credit-bar';
import MiraModelSelector from './mira-model-selector';

interface MiraChatHeaderProps {
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
  onExportChat: () => void;
  onModelChange: (model: Model) => void;
  onNewConversation: () => void;
  onThinkingModeChange: (mode: ThinkingMode) => void;
  onToggleFullscreen?: () => void;
  onToggleViewOnly: () => void;
  t: (...args: any[]) => string;
  thinkingMode: ThinkingMode;
  viewOnly: boolean;
}

export function MiraChatHeader({
  wsId,
  hasMessages,
  hotkeyLabels,
  insightsDock,
  isFullscreen,
  model,
  modelPickerHotkeySignal,
  onExportChat,
  onModelChange,
  onNewConversation,
  onThinkingModeChange,
  onToggleFullscreen,
  onToggleViewOnly,
  t,
  thinkingMode,
  viewOnly,
}: MiraChatHeaderProps) {
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
          <MiraCreditBar wsId={wsId} />
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
