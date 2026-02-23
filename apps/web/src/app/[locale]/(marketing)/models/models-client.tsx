'use client';

import { LayoutGrid, LayoutList, Search } from '@tuturuuu/icons';
import { Badge } from '@tuturuuu/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@tuturuuu/ui/card';
import { Input } from '@tuturuuu/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tuturuuu/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@tuturuuu/ui/toggle-group';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { ProviderLogo } from '../../(dashboard)/[wsId]/(dashboard)/components/provider-logo';

// Using the same interface shape expected from ai_gateway_models
interface ModelData {
  id: string;
  name: string;
  provider: string;
  description: string | null;
  type: string;
  context_window: number | null;
  max_tokens: number | null;
  tags: string[] | null;
  input_price_per_token: number;
  output_price_per_token: number;
  image_gen_price: number | null;
}

export default function ModelsClient({
  initialModels,
}: {
  initialModels: ModelData[];
}) {
  const t = useTranslations('marketing-models');
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const providers = useMemo(() => {
    const set = new Set(initialModels.map((m) => m.provider));
    return Array.from(set).sort();
  }, [initialModels]);

  const types = useMemo(() => {
    const set = new Set(initialModels.map((m) => m.type));
    return Array.from(set).sort();
  }, [initialModels]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const model of initialModels) {
      for (const tag of model.tags ?? []) {
        set.add(tag);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [initialModels]);

  const filteredModels = useMemo(() => {
    return initialModels.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.id.toLowerCase().includes(search.toLowerCase()) ||
        (m.description?.toLowerCase() || '').includes(search.toLowerCase());
      const matchesProvider =
        providerFilter === 'all' || m.provider === providerFilter;
      const matchesType = typeFilter === 'all' || m.type === typeFilter;
      const matchesTag =
        tagFilter === 'all' || (m.tags ?? []).some((tag) => tag === tagFilter);

      return matchesSearch && matchesProvider && matchesType && matchesTag;
    });
  }, [initialModels, search, providerFilter, typeFilter, tagFilter]);

  const formatTokens = (tokens: number | null) => {
    if (!tokens) return 'N/A';
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(0)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
    return tokens.toString();
  };

  const formatPrice = (price: number) => {
    if (price === 0) return 'Free';
    // Format as price per 1M tokens
    return `$${(price * 1000000).toFixed(2)}/1M`;
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-16 md:py-24">
      <div className="mb-12 text-center">
        <h1 className="mb-4 font-bold text-4xl text-foreground tracking-tight sm:text-5xl md:text-6xl">
          {t('title')}
        </h1>
        <p className="mx-auto max-w-2xl text-muted-foreground text-xl">
          {t('subtitle')}
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-background pl-9"
          />
        </div>

        <Select value={providerFilter} onValueChange={setProviderFilter}>
          <SelectTrigger>
            <SelectValue placeholder={t('filter_provider')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all_providers')}</SelectItem>
            {providers.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
            <SelectValue placeholder={t('filter_type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all_types')}</SelectItem>
            {types.map((typeVal) => (
              <SelectItem key={typeVal} value={typeVal} className="capitalize">
                {typeVal}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger>
            <SelectValue placeholder={t('filter_tag')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all_tags')}</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {t('showing_count', { count: filteredModels.length })}
        </p>
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => {
            if (value === 'grid' || value === 'list') setViewMode(value);
          }}
          className="inline-flex gap-0.5 rounded-lg border bg-muted/40 p-0.5"
          aria-label={t('view_mode')}
        >
          <ToggleGroupItem
            value="grid"
            aria-label={t('view_grid')}
            className="h-8 rounded-md px-2.5 data-[state=on]:bg-background data-[state=on]:shadow-sm"
          >
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="list"
            aria-label={t('view_list')}
            className="h-8 rounded-md px-2.5 data-[state=on]:bg-background data-[state=on]:shadow-sm"
          >
            <LayoutList className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {filteredModels.length === 0 ? (
        <div className="rounded-xl border bg-muted/50 py-20 text-center">
          <p className="text-lg text-muted-foreground">{t('no_results')}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredModels.map((model) => (
            <Card
              key={model.id}
              className="flex h-full flex-col overflow-hidden transition-shadow duration-200 hover:shadow-lg"
            >
              <CardHeader className="pb-4">
                <div className="mb-2 flex items-start justify-between gap-4">
                  <Badge
                    variant="outline"
                    className="flex shrink-0 items-center gap-1.5 px-2 py-0.5 capitalize"
                  >
                    <ProviderLogo
                      provider={model.provider}
                      size={12}
                      className="opacity-70"
                    />
                    {model.provider}
                  </Badge>
                  <Badge className="shrink-0 bg-primary/10 text-primary capitalize hover:bg-primary/20 hover:text-primary">
                    {model.type}
                  </Badge>
                </div>
                <CardTitle
                  className="truncate text-left font-bold text-xl"
                  title={model.name}
                >
                  {model.name}
                </CardTitle>
                <div
                  className="truncate text-left font-mono text-muted-foreground text-sm"
                  title={model.id}
                >
                  {model.id}
                </div>
              </CardHeader>
              <CardContent className="flex grow flex-col">
                {model.description && (
                  <p className="mb-4 line-clamp-3 grow text-muted-foreground text-sm">
                    {model.description}
                  </p>
                )}

                {model.tags && model.tags.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {model.tags.slice(0, 3).map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="px-1.5 py-0 text-[10px] uppercase"
                      >
                        {tag}
                      </Badge>
                    ))}
                    {model.tags.length > 3 && (
                      <Badge
                        variant="secondary"
                        className="px-1.5 py-0 text-[10px]"
                      >
                        +{model.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 text-sm">
                  <div className="flex flex-col">
                    <span className="font-semibold text-muted-foreground text-xs uppercase">
                      {t('context_window_label')}
                    </span>
                    <span className="font-medium">
                      {formatTokens(model.context_window)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-muted-foreground text-xs uppercase">
                      {t('max_output_label')}
                    </span>
                    <span className="font-medium">
                      {formatTokens(model.max_tokens)}
                    </span>
                  </div>

                  {model.type === 'image' && model.image_gen_price !== null ? (
                    <div className="col-span-2 flex flex-col">
                      <span className="font-semibold text-muted-foreground text-xs uppercase">
                        {t('generation_price_label')}
                      </span>
                      <span className="font-medium">
                        ${Number(model.image_gen_price).toFixed(3)} / image
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col">
                        <span className="font-semibold text-muted-foreground text-xs uppercase">
                          {t('input_price_label')}
                        </span>
                        <span className="font-medium">
                          {formatPrice(Number(model.input_price_per_token))}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-muted-foreground text-xs uppercase">
                          {t('output_price_label')}
                        </span>
                        <span className="font-medium">
                          {formatPrice(Number(model.output_price_per_token))}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="divide-y rounded-xl border bg-background">
          {filteredModels.map((model) => (
            <div
              key={model.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="flex shrink-0 items-center gap-1.5 px-2 py-0.5 capitalize"
                  >
                    <ProviderLogo
                      provider={model.provider}
                      size={12}
                      className="opacity-70"
                    />
                    {model.provider}
                  </Badge>
                  <Badge className="shrink-0 bg-primary/10 text-primary capitalize hover:bg-primary/20 hover:text-primary">
                    {model.type}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-sm">
                    {model.name}
                  </span>
                  <span className="truncate font-mono text-muted-foreground text-xs">
                    {model.id}
                  </span>
                </div>
                {model.tags && model.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {model.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="px-1.5 py-0 text-[10px] uppercase"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {model.description && (
                  <p className="mt-1.5 line-clamp-2 grow text-muted-foreground text-xs leading-relaxed">
                    {model.description}
                  </p>
                )}
              </div>
              <div className="mt-2 flex items-end gap-6 sm:mt-0 sm:items-center">
                <div className="text-right text-xs">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-muted-foreground uppercase">
                      {t('context_window_label')}
                    </span>
                    <span className="font-medium">
                      {formatTokens(model.context_window)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-col">
                    <span className="text-[11px] text-muted-foreground uppercase">
                      {t('max_output_label')}
                    </span>
                    <span className="font-medium">
                      {formatTokens(model.max_tokens)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-col">
                    {model.type === 'image' &&
                    model.image_gen_price !== null ? (
                      <>
                        <span className="text-[11px] text-muted-foreground uppercase">
                          {t('generation_price_label')}
                        </span>
                        <span className="font-medium">
                          ${Number(model.image_gen_price).toFixed(3)} / image
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[11px] text-muted-foreground uppercase">
                          {t('input_price_label')}
                        </span>
                        <span className="font-medium">
                          {formatPrice(Number(model.input_price_per_token))}
                        </span>
                        <span className="mt-1 text-[11px] text-muted-foreground uppercase">
                          {t('output_price_label')}
                        </span>
                        <span className="font-medium">
                          {formatPrice(Number(model.output_price_per_token))}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
