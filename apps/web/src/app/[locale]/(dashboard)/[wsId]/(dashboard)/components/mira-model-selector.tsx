'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  defaultModel,
  type Model,
  models as staticModels,
} from '@tuturuuu/ai/models';
import {
  ArrowBigUpDash,
  Check,
  ChevronDown,
  Loader2,
  Lock,
  Search,
  Star,
} from '@tuturuuu/icons';
import { createClient } from '@tuturuuu/supabase/next/client';
import { Button } from '@tuturuuu/ui/button';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@tuturuuu/ui/command';
import { useAiCredits } from '@tuturuuu/ui/hooks/use-ai-credits';
import { Input } from '@tuturuuu/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@tuturuuu/ui/popover';
import { ScrollArea } from '@tuturuuu/ui/scroll-area';
import { toast } from '@tuturuuu/ui/sonner';
import { Switch } from '@tuturuuu/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tuturuuu/ui/tooltip';
import { cn } from '@tuturuuu/utils/format';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ProviderLogo } from './provider-logo';

const EMPTY_FAVORITES = new Set<string>();
const EMPTY_GROUPED_MODELS: Record<string, Model[]> = {};
interface RenderedGroup {
  provider: string;
  models: Model[];
  isFavoritesGroup?: boolean;
}

const EMPTY_RENDERED_GROUPS: RenderedGroup[] = [];

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
    .select('id, name, provider, description, context_window, type, is_enabled')
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
    disabled: !m.is_enabled,
  }));
}

async function fetchFavorites(wsId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ai_model_favorites')
    .select('model_id')
    .eq('ws_id', wsId);

  if (error || !data?.length) return new Set();
  return new Set(data.map((r) => r.model_id));
}

async function toggleFavorite(
  wsId: string,
  modelId: string,
  isFavorited: boolean
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Authentication required');
  }

  if (isFavorited) {
    const { error } = await supabase
      .from('ai_model_favorites')
      .delete()
      .eq('ws_id', wsId)
      .eq('user_id', user.id)
      .eq('model_id', modelId);

    if (error) {
      throw new Error(error.message || 'Failed to update favorites');
    }
  } else {
    const { error } = await supabase.from('ai_model_favorites').insert({
      ws_id: wsId,
      user_id: user.id,
      model_id: modelId,
    });

    if (error) {
      throw new Error(error.message || 'Failed to update favorites');
    }
  }
}

/** Capitalize first letter of each word for display */
function formatProvider(provider: string): string {
  return provider
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function modelMatchesSearch(m: Model, search: string): boolean {
  if (!search.trim()) return true;
  const q = search.toLowerCase().trim();
  return (
    m.label.toLowerCase().includes(q) ||
    m.provider.toLowerCase().includes(q) ||
    m.value.toLowerCase().includes(q) ||
    (m.description?.toLowerCase().includes(q) ?? false)
  );
}

export default function MiraModelSelector({
  wsId,
  model,
  onChange,
  disabled,
}: MiraModelSelectorProps) {
  const t = useTranslations('dashboard.mira_chat');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [hideLockedModels, setHideLockedModels] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [pendingModelId, setPendingModelId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const deferredOpen = useDeferredValue(open);
  const hasAppliedInitialFavoritesView = useRef(false);

  const { data: gatewayModels, isLoading: modelsLoading } = useQuery({
    queryKey: ['ai-gateway-models', 'enabled'],
    queryFn: fetchGatewayModels,
    staleTime: 5 * 60 * 1000,
  });

  const { data: favoriteIds, isLoading: favoritesLoading } = useQuery({
    queryKey: ['ai-model-favorites', wsId],
    queryFn: () => fetchFavorites(wsId),
    enabled: !!wsId,
    staleTime: 60 * 1000,
  });

  const hasFavorites =
    !favoritesLoading && !!favoriteIds && favoriteIds.size > 0;

  useEffect(() => {
    if (!deferredOpen) {
      hasAppliedInitialFavoritesView.current = false;
      return;
    }
    if (hasAppliedInitialFavoritesView.current) return;
    if (favoritesLoading) return;

    setFavoritesOnly(hasFavorites);
    hasAppliedInitialFavoritesView.current = true;
  }, [deferredOpen, favoritesLoading, hasFavorites]);

  const toggleFavoriteMutation = useMutation({
    mutationFn: ({
      modelId,
      isFavorited,
    }: {
      modelId: string;
      modelLabel: string;
      isFavorited: boolean;
    }) => toggleFavorite(wsId, modelId, isFavorited),
    onSuccess: (_, { modelLabel, isFavorited }) => {
      queryClient.invalidateQueries({ queryKey: ['ai-model-favorites', wsId] });
      const message = isFavorited
        ? t('model_removed_from_favorites', { model: modelLabel })
        : t('model_added_to_favorites', { model: modelLabel });
      toast.success(message);
    },
    onError: (error, { modelId, modelLabel, isFavorited }) => {
      queryClient.invalidateQueries({ queryKey: ['ai-model-favorites', wsId] });
      const action = isFavorited ? t('model_unfavorite') : t('model_favorite');
      const fallbackMessage = `${t('error')} (${action}: ${modelLabel} - ${modelId})`;
      const details = error instanceof Error ? error.message : '';
      toast.error(details ? `${fallbackMessage}: ${details}` : fallbackMessage);
    },
  });

  const isFavorited = useCallback(
    (modelId: string) => (favoriteIds ?? EMPTY_FAVORITES).has(modelId),
    [favoriteIds]
  );

  const handleToggleFavorite = useCallback(
    (e: React.MouseEvent, modelId: string, modelLabel: string) => {
      e.stopPropagation();
      const favorited = isFavorited(modelId);
      setPendingModelId(modelId);
      toggleFavoriteMutation.mutate(
        {
          modelId,
          modelLabel,
          isFavorited: favorited,
        },
        {
          onSuccess: () => setPendingModelId(null),
          onError: () => setPendingModelId(null),
        }
      );
    },
    [isFavorited, toggleFavoriteMutation]
  );

  const availableModels = useMemo(() => {
    if (gatewayModels?.length) return gatewayModels;
    return staticModels.filter((m) => !m.disabled);
  }, [gatewayModels]);

  const { data: credits } = useAiCredits(wsId);
  const showUpgradeCta = credits?.tier === 'FREE';

  const allowedModelIds = useMemo(() => {
    if (!credits?.allowedModels?.length) return null;
    return new Set(credits.allowedModels);
  }, [credits?.allowedModels]);

  const modelById = useMemo(() => {
    return new Map(availableModels.map((m) => [m.value, m] as const));
  }, [availableModels]);

  const allowedModelLookup = useMemo(() => {
    if (!allowedModelIds) return null;
    const lookup = new Set<string>();
    for (const id of allowedModelIds) {
      lookup.add(id);
      const bare = id.includes('/') ? id.split('/').pop() : id;
      if (bare) lookup.add(bare);
    }
    return lookup;
  }, [allowedModelIds]);

  const isModelAllowed = useCallback(
    (modelId: string) => {
      const m = modelById.get(modelId);
      if (m?.disabled) return false;

      if (!allowedModelLookup) return true;
      if (allowedModelLookup.has(modelId)) return true;
      const bare = modelId.includes('/') ? modelId.split('/').pop() : modelId;
      return bare ? allowedModelLookup.has(bare) : false;
    },
    [allowedModelLookup, modelById]
  );

  const groupedModels = useMemo(() => {
    if (!deferredOpen) return EMPTY_GROUPED_MODELS;

    const groups: Record<string, Model[]> = {};
    for (const m of availableModels) {
      const key = m.provider;
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }

    for (const key in groups) {
      groups[key]?.sort((a, b) => {
        const aAllowed = isModelAllowed(a.value);
        const bAllowed = isModelAllowed(b.value);

        if (aAllowed !== bAllowed) return aAllowed ? -1 : 1;

        const aFav = isFavorited(a.value);
        const bFav = isFavorited(b.value);
        if (aFav !== bFav) return aFav ? -1 : 1;

        return a.label.localeCompare(b.label);
      });
    }

    return groups;
  }, [availableModels, deferredOpen, isModelAllowed, isFavorited]);

  const providerList = useMemo(() => {
    return Object.keys(groupedModels).sort((a, b) => {
      const aHasAllowed = groupedModels[a]?.some((m) =>
        isModelAllowed(m.value)
      );
      const bHasAllowed = groupedModels[b]?.some((m) =>
        isModelAllowed(m.value)
      );

      if (aHasAllowed !== bHasAllowed) return aHasAllowed ? -1 : 1;
      return a.localeCompare(b);
    });
  }, [groupedModels, isModelAllowed]);

  const filteredProviderList = useMemo(() => {
    if (!hideLockedModels) return providerList;
    return providerList.filter((provider) =>
      groupedModels[provider]?.some((m) => isModelAllowed(m.value))
    );
  }, [groupedModels, hideLockedModels, isModelAllowed, providerList]);

  const providersToShow = useMemo(() => {
    if (selectedProvider) return [selectedProvider];
    return filteredProviderList;
  }, [selectedProvider, filteredProviderList]);

  const modelsToRender = useMemo(() => {
    if (!deferredOpen) return EMPTY_RENDERED_GROUPS;

    const result: RenderedGroup[] = [];

    if (favoritesOnly) {
      // Favorites: show ALL favorited models across all providers in one group
      let models = Object.keys(groupedModels)
        .flatMap((key) => groupedModels[key] ?? [])
        .filter((m) => isFavorited(m.value));

      if (hideLockedModels) {
        models = models.filter((m) => isModelAllowed(m.value));
      }

      models = models.filter((m) => modelMatchesSearch(m, search));

      models.sort((a, b) => {
        const providerOrder = a.provider.localeCompare(b.provider);
        if (providerOrder !== 0) return providerOrder;
        return a.label.localeCompare(b.label);
      });

      if (models.length > 0) {
        result.push({
          provider: 'favorites',
          models,
          isFavoritesGroup: true,
        });
      }
      return result;
    }

    // Normal view: group by provider (respecting selectedProvider)
    for (const provider of providersToShow) {
      let models = groupedModels[provider] ?? [];

      if (hideLockedModels) {
        models = models.filter((m) => isModelAllowed(m.value));
      }

      models = models.filter((m) => modelMatchesSearch(m, search));

      if (models.length > 0) {
        result.push({ provider, models });
      }
    }

    return result;
  }, [
    deferredOpen,
    providersToShow,
    groupedModels,
    hideLockedModels,
    favoritesOnly,
    search,
    isModelAllowed,
    isFavorited,
  ]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 min-w-0 max-w-full gap-2 rounded-full px-3 font-mono text-muted-foreground text-sm"
          disabled={disabled}
        >
          <ProviderLogo provider={model.provider} size={16} />
          <span className="min-w-0 truncate">{model.label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="flex h-[min(480px,85vh)] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden p-0"
        align="start"
        sideOffset={4}
      >
        <TooltipProvider delayDuration={200}>
          {showUpgradeCta && (
            <div className="m-2 mb-0 rounded-xl border border-dynamic-primary/25 bg-linear-to-r from-dynamic-primary/20 via-dynamic-secondary/15 to-dynamic-purple/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm">
                    {t('model_unlock_more_title')}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-muted-foreground text-xs">
                    {t('model_unlock_more_description')}
                  </p>
                </div>
                <Link
                  href={`/${wsId}/billing`}
                  className={cn(
                    'group flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg transition-all duration-200',
                    'border border-dynamic-purple/20 bg-linear-to-r from-dynamic-purple/10 to-dynamic-indigo/8',
                    'text-dynamic-purple hover:border-dynamic-purple/35',
                    'hover:[box-shadow:0_0_20px_-5px_oklch(var(--dynamic-purple)/0.3)]',
                    'px-3 font-medium text-sm'
                  )}
                >
                  <ArrowBigUpDash className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  {t('model_upgrade_cta')}
                </Link>
              </div>
            </div>
          )}
          <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              placeholder={t('model_selector_search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent py-1.5 text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-0"
            />
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full min-h-0 shrink-0 border-r">
              <div className="flex flex-col gap-1 py-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'mx-1 h-8 w-8',
                        favoritesOnly && 'bg-muted'
                      )}
                      onClick={() => {
                        setFavoritesOnly((v) => !v);
                        setSelectedProvider(null);
                      }}
                      aria-label={t('model_show_favorites')}
                    >
                      <Star
                        className={cn(
                          'h-4 w-4',
                          favoritesOnly && 'fill-current'
                        )}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="text-xs">{t('model_show_favorites')}</p>
                  </TooltipContent>
                </Tooltip>
                {filteredProviderList.map((provider) => (
                  <Tooltip key={provider}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'mx-1 h-8 w-8',
                          selectedProvider === provider && 'bg-muted'
                        )}
                        onClick={() => {
                          const next =
                            selectedProvider === provider ? null : provider;
                          setSelectedProvider(next);
                          if (next) setFavoritesOnly(false);
                        }}
                        aria-label={formatProvider(provider)}
                      >
                        <ProviderLogo provider={provider} size={18} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="text-xs">{formatProvider(provider)}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </ScrollArea>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
                <span className="text-muted-foreground text-xs">
                  {t('model_hide_locked')}
                </span>
                <Switch
                  checked={hideLockedModels}
                  onCheckedChange={setHideLockedModels}
                  aria-label={t('model_hide_locked')}
                />
              </div>

              <ScrollArea className="min-h-0 flex-1">
                {!deferredOpen || modelsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : modelsToRender.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    {t('model_selector_empty')}
                  </div>
                ) : (
                  <Command shouldFilter={false}>
                    <CommandList className="max-h-none border-0">
                      {modelsToRender.map(
                        ({ provider, models, isFavoritesGroup }) => (
                          <CommandGroup
                            key={provider}
                            heading={
                              isFavoritesGroup
                                ? t('model_favorites_heading')
                                : formatProvider(provider)
                            }
                            className="capitalize"
                          >
                            {models.map((m) => {
                              const allowed = isModelAllowed(m.value);
                              const favorited = isFavorited(m.value);
                              const item = (
                                <CommandItem
                                  key={m.value}
                                  value={`${m.provider} ${m.label} ${m.value} ${m.description ?? ''}`}
                                  onSelect={() => {
                                    if (!allowed) return;
                                    onChange(m);
                                    setOpen(false);
                                  }}
                                  className={cn(
                                    'flex items-start gap-2 py-2',
                                    !allowed && 'cursor-not-allowed opacity-50'
                                  )}
                                  aria-disabled={!allowed}
                                >
                                  <ProviderLogo
                                    provider={m.provider}
                                    size={18}
                                    className="mt-0.5 shrink-0"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      {allowed ? (
                                        <Check
                                          className={cn(
                                            'h-3.5 w-3.5 shrink-0',
                                            model.value === m.value
                                              ? 'opacity-100'
                                              : 'opacity-0'
                                          )}
                                        />
                                      ) : (
                                        <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                      )}
                                      <span className="font-medium font-mono text-xs">
                                        {m.label}
                                      </span>
                                      <button
                                        type="button"
                                        className="group ml-auto flex shrink-0 rounded p-0.5 hover:bg-muted"
                                        onClick={(e) =>
                                          handleToggleFavorite(
                                            e,
                                            m.value,
                                            m.label
                                          )
                                        }
                                        disabled={pendingModelId === m.value}
                                        aria-label={
                                          favorited
                                            ? t('model_unfavorite')
                                            : t('model_favorite')
                                        }
                                        title={
                                          favorited
                                            ? t('model_unfavorite')
                                            : t('model_favorite')
                                        }
                                      >
                                        <Star
                                          className={cn(
                                            'h-3.5 w-3.5 transition-[fill]',
                                            favorited && 'fill-current',
                                            !favorited &&
                                              'fill-transparent group-hover:fill-current'
                                          )}
                                        />
                                      </button>
                                    </div>
                                    {m.description && (
                                      <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                                        {m.description}
                                      </p>
                                    )}
                                  </div>
                                  {m.context && (
                                    <span className="shrink-0 text-[10px] text-muted-foreground">
                                      {m.context >= 1000000
                                        ? `${(m.context / 1000000).toFixed(0)}M`
                                        : `${(m.context / 1000).toFixed(0)}K`}
                                    </span>
                                  )}
                                </CommandItem>
                              );

                              if (allowed) return item;

                              return (
                                <Tooltip key={m.value}>
                                  <TooltipTrigger asChild>
                                    {item}
                                  </TooltipTrigger>
                                  <TooltipContent side="right">
                                    <p className="text-xs">
                                      {t('model_upgrade_required')}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </CommandGroup>
                        )
                      )}
                    </CommandList>
                  </Command>
                )}
              </ScrollArea>
            </div>
          </div>
        </TooltipProvider>
      </PopoverContent>
    </Popover>
  );
}

export { defaultModel };
