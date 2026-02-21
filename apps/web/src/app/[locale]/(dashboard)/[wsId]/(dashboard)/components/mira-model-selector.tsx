'use client';

import { useQuery } from '@tanstack/react-query';
import {
  defaultModel,
  type Model,
  models as staticModels,
} from '@tuturuuu/ai/models';
import { Check, ChevronDown, Loader2, Lock } from '@tuturuuu/icons';
import { createClient } from '@tuturuuu/supabase/next/client';
import { Button } from '@tuturuuu/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@tuturuuu/ui/command';
import { useAiCredits } from '@tuturuuu/ui/hooks/use-ai-credits';
import { Popover, PopoverContent, PopoverTrigger } from '@tuturuuu/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tuturuuu/ui/tooltip';
import { cn } from '@tuturuuu/utils/format';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface MiraModelSelectorProps {
  wsId: string;
  model: Model;
  onChange: (model: Model) => void;
  disabled?: boolean;
}

/** Fetches enabled models from the ai_gateway_models table */
async function fetchGatewayModels(): Promise<Model[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ai_gateway_models')
    .select('id, name, provider, description, context_window, type')
    .eq('is_enabled', true)
    .eq('type', 'language')
    .order('provider')
    .order('name');

  if (error || !data?.length) return [];

  return data.map((m) => ({
    value: m.id,
    label: m.name,
    provider: m.provider,
    description: m.description ?? undefined,
    context: m.context_window ?? undefined,
  }));
}

/** Capitalize first letter of each word for display */
function formatProvider(provider: string): string {
  return provider
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function MiraModelSelector({
  wsId,
  model,
  onChange,
  disabled,
}: MiraModelSelectorProps) {
  const t = useTranslations('dashboard.mira_chat');
  const [open, setOpen] = useState(false);

  const { data: gatewayModels, isLoading: modelsLoading } = useQuery({
    queryKey: ['ai-gateway-models', 'enabled'],
    queryFn: fetchGatewayModels,
    staleTime: 5 * 60 * 1000,
  });

  // Fall back to static models list when gateway table is empty
  const availableModels = useMemo(() => {
    if (gatewayModels?.length) return gatewayModels;
    return staticModels.filter((m) => !m.disabled);
  }, [gatewayModels]);

  const { data: credits } = useAiCredits(wsId);

  // Determine which models the user can access based on their plan
  const allowedModelIds = useMemo(() => {
    if (!credits?.allowedModels?.length) return null; // null = all allowed
    return new Set(credits.allowedModels);
  }, [credits?.allowedModels]);

  const isModelAllowed = useMemo(() => {
    if (!allowedModelIds) return () => true; // All allowed
    return (modelId: string) => {
      if (allowedModelIds.has(modelId)) return true;
      // Also check bare model name (strip provider prefix)
      const bare = modelId.includes('/') ? modelId.split('/').pop()! : modelId;
      return allowedModelIds.has(bare);
    };
  }, [allowedModelIds]);

  const groupedModels = useMemo(() => {
    const groups: Record<string, Model[]> = {};
    for (const m of availableModels) {
      const key = m.provider;
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }
    return groups;
  }, [availableModels]);

  const providerList = useMemo(
    () => Object.keys(groupedModels).sort(),
    [groupedModels]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 rounded-full px-2.5 font-mono text-muted-foreground text-xs"
          disabled={disabled}
        >
          {model.provider?.toLowerCase().includes('google') && (
            <Image
              src="/media/logos/google.svg"
              alt=""
              width={14}
              height={14}
              className="shrink-0"
            />
          )}
          {model.label}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start" sideOffset={4}>
        <Command>
          <CommandInput placeholder={t('model_selector_search')} />
          <CommandEmpty>{t('model_selector_empty')}</CommandEmpty>
          <CommandList>
            {modelsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              providerList.map((provider) => (
                <CommandGroup key={provider} heading={formatProvider(provider)}>
                  {groupedModels[provider]?.map((m) => {
                    const allowed = isModelAllowed(m.value);
                    return (
                      <TooltipProvider key={m.value} delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <CommandItem
                              value={`${m.provider}/${m.label}`}
                              onSelect={() => {
                                if (!allowed) return;
                                onChange(m);
                                setOpen(false);
                              }}
                              className={cn(
                                !allowed && 'cursor-not-allowed opacity-50'
                              )}
                              disabled={!allowed}
                            >
                              {allowed ? (
                                <Check
                                  className={cn(
                                    'mr-2 h-3.5 w-3.5',
                                    model.value === m.value
                                      ? 'opacity-100'
                                      : 'opacity-0'
                                  )}
                                />
                              ) : (
                                <Lock className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <span className="font-mono text-xs">
                                {m.label}
                              </span>
                              {m.context && (
                                <span className="ml-auto text-[10px] text-muted-foreground">
                                  {m.context >= 1000000
                                    ? `${(m.context / 1000000).toFixed(0)}M`
                                    : `${(m.context / 1000).toFixed(0)}K`}
                                </span>
                              )}
                            </CommandItem>
                          </TooltipTrigger>
                          {!allowed && (
                            <TooltipContent side="right">
                              <p className="text-xs">
                                {t('model_upgrade_required')}
                              </p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </CommandGroup>
              ))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export { defaultModel };
