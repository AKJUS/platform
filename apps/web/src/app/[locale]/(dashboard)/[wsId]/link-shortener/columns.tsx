'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { Tables } from '@tuturuuu/types/supabase';
import { Avatar, AvatarFallback, AvatarImage } from '@tuturuuu/ui/avatar';
import { Badge } from '@tuturuuu/ui/badge';
import { Button } from '@tuturuuu/ui/button';
import { DataTableColumnHeader } from '@tuturuuu/ui/custom/tables/data-table-column-header';
import { toast } from '@tuturuuu/ui/hooks/use-toast';
import {
  BarChart3,
  Copy,
  ExternalLink,
  MousePointerClick,
  User,
} from '@tuturuuu/ui/icons';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tuturuuu/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type ShortenedLink = Tables<'shortened_links'> & {
  creator?: {
    id: string;
    email: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  href?: string;
  click_count?: number;
};

// biome-ignore lint/suspicious/noExplicitAny: <translation function is not typed>
const copyToClipboard = async (text: string, t: any) => {
  try {
    await navigator.clipboard.writeText(text);
    toast({
      title: t('link-shortener.copied_to_clipboard'),
      description: t('link-shortener.copied_description'),
    });
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    toast({
      title: t('link-shortener.copy_failed'),
      description: t('link-shortener.copy_failed_description'),
      variant: 'destructive',
    });
  }
};

// Component to handle the short URL display and avoid hydration mismatch
// biome-ignore lint/suspicious/noExplicitAny: <translation function is not typed>
function ShortUrlDisplay({ slug, t }: { slug: string; t: any }) {
  const [shortUrl, setShortUrl] = useState('');

  useEffect(() => {
    const url =
      process.env.NODE_ENV === 'development'
        ? `http://localhost:3002/${slug}`
        : `${process.env.NEXT_PUBLIC_SHORTENER_URL || ''}/${slug}`;
    setShortUrl(url);
  }, [slug]);

  if (!shortUrl) return null; // Or a loading skeleton

  return (
    <div className="group flex items-center gap-3">
      <Link
        href={shortUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 truncate font-mono text-sm text-dynamic-blue transition-colors hover:text-dynamic-blue/80 hover:underline"
      >
        {shortUrl}
      </Link>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(shortUrl, t)}
              className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('link-shortener.copy_to_clipboard')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

// Creator display component
function CreatorDisplay({
  creator,
  t,
}: {
  creator?: ShortenedLink['creator'];
  // biome-ignore lint/suspicious/noExplicitAny: <translation function is not typed>
  t: any;
}) {
  if (!creator) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <User className="h-4 w-4" />
        <span className="text-sm">{t('link-shortener.unknown_creator')}</span>
      </div>
    );
  }

  const displayName =
    creator.display_name || creator.email?.split('@')[0] || 'Unknown';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex cursor-help items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage
                src={creator.avatar_url || undefined}
                alt={displayName}
              />
              <AvatarFallback className="bg-dynamic-blue/10 text-xs text-dynamic-blue">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="max-w-32 truncate text-sm font-medium">
              {displayName}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{displayName}</p>
            {creator.email && (
              <p className="text-xs text-muted-foreground">{creator.email}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export const linkShortenerColumns = (
  // biome-ignore lint/suspicious/noExplicitAny: <translation function is not typed>
  t: any,
  namespace: string | undefined
): ColumnDef<ShortenedLink>[] => [
  {
    accessorKey: 'slug',
    header: ({ column }) => (
      <DataTableColumnHeader
        t={t}
        column={column}
        title={t(`${namespace}.short_url`)}
      />
    ),
    cell: ({ row }) => <ShortUrlDisplay slug={row.getValue('slug')} t={t} />,
  },
  {
    accessorKey: 'link',
    header: ({ column }) => (
      <DataTableColumnHeader
        t={t}
        column={column}
        title={t(`${namespace}.original_url`)}
      />
    ),
    cell: ({ row }) => (
      <div className="group flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div
            className="max-w-96 truncate text-sm font-medium"
            title={row.getValue('link')}
          >
            {row.getValue('link')}
          </div>
          <div className="text-xs text-muted-foreground">
            {new URL(row.getValue('link')).hostname}
          </div>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={row.getValue('link')}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('link-shortener.visit_original')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    ),
  },
  {
    accessorKey: 'creator',
    header: ({ column }) => (
      <DataTableColumnHeader
        t={t}
        column={column}
        title={t(`${namespace}.creator`)}
      />
    ),
    cell: ({ row }) => (
      <CreatorDisplay creator={row.getValue('creator')} t={t} />
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader
        t={t}
        column={column}
        title={t(`${namespace}.created_at`)}
      />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue('created_at'));
      const isRecent = Date.now() - date.getTime() < 24 * 60 * 60 * 1000; // Less than 24 hours

      return (
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">
            {formatDistanceToNow(date, { addSuffix: true })}
          </div>
          {isRecent && (
            <Badge
              variant="secondary"
              className="border-dynamic-green/20 bg-dynamic-green/10 px-2 py-0.5 text-xs text-dynamic-green"
            >
              {t('link-shortener.new')}
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'click_count',
    header: ({ column }) => (
      <DataTableColumnHeader
        t={t}
        column={column}
        title={t(`${namespace}.clicks`)}
      />
    ),
    cell: ({ row }) => {
      const clickCount = row.getValue('click_count') as number | undefined;

      return (
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-dynamic-purple/10 p-1">
            <MousePointerClick className="h-3 w-3 text-dynamic-purple" />
          </div>
          <span className="text-sm font-medium">
            {clickCount?.toLocaleString() || '0'}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: 'href',
    header: ({ column }) => (
      <DataTableColumnHeader
        t={t}
        column={column}
        title={t(`${namespace}.analytics`)}
      />
    ),
    cell: ({ row }) => {
      const href = row.getValue('href') as string;

      return (
        <Link href={`${href}/analytics`}>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-dynamic-blue/10"
          >
            <BarChart3 className="h-4 w-4 text-dynamic-blue" />
          </Button>
        </Link>
      );
    },
    enableSorting: false,
  },
];
