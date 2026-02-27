'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Clock, Package, Zap } from '@tuturuuu/icons';
import { PolarEmbedCheckout } from '@tuturuuu/payment/polar/checkout/embed';
import { Badge } from '@tuturuuu/ui/badge';
import { Button } from '@tuturuuu/ui/button';
import { toast } from '@tuturuuu/ui/sonner';
import { cn } from '@tuturuuu/utils/format';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState } from 'react';
import type { CreditPackListItem } from '@/utils/billing-helper';
import { centToDollar } from '@/utils/price-helper';

interface CreditStatusResponse {
  totalAllocated: number;
  totalUsed: number;
  remaining: number;
  bonusCredits: number;
  percentUsed: number;
  included: {
    totalAllocated: number;
    totalUsed: number;
    bonusCredits: number;
    remaining: number;
  };
  payg: {
    totalGranted: number;
    totalUsed: number;
    remaining: number;
    nextExpiry: string | null;
  };
}

interface AiCreditBillingCardProps {
  wsId: string;
  packs: CreditPackListItem[];
  canPurchase: boolean;
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));
}

function barWidth(used: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (used / total) * 100));
}

function formatPrice(currency: string, cents: number): string {
  if (currency === 'usd') {
    return `$${centToDollar(cents)}`;
  }
  return `${currency.toUpperCase()} ${centToDollar(cents)}`;
}

export function AiCreditBillingCard({
  wsId,
  packs,
  canPurchase,
}: AiCreditBillingCardProps) {
  const t = useTranslations('billing');
  const { resolvedTheme } = useTheme();
  const [checkoutInstance, setCheckoutInstance] =
    useState<PolarEmbedCheckout | null>(null);

  const creditsQuery = useQuery<CreditStatusResponse>({
    queryKey: ['billing-ai-credits', wsId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/workspaces/${wsId}/ai/credits`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch credit status');
      }

      return response.json();
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (creditPackId: string) => {
      const response = await fetch('/api/payment/credit-packs/checkouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wsId,
          creditPackId,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'Failed to create checkout session');
      }

      return response.json() as Promise<{ url: string }>;
    },
    onSuccess: async (payload) => {
      const checkout = await PolarEmbedCheckout.create(payload.url, {
        theme: resolvedTheme === 'dark' ? 'dark' : 'light',
      });
      setCheckoutInstance(checkout);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t('credit-pack-checkout-failed-description')
      );
    },
  });

  useEffect(() => {
    return () => {
      if (checkoutInstance) {
        setCheckoutInstance(null);
      }
    };
  }, [checkoutInstance]);

  const creditData = creditsQuery.data;

  const includedTotal = useMemo(
    () =>
      (creditData?.included.totalAllocated ?? 0) +
      (creditData?.included.bonusCredits ?? 0),
    [creditData]
  );
  const paygTotal = creditData?.payg.totalGranted ?? 0;

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-border/50 bg-card p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-xl">{t('ai-credits-title')}</h2>
          <p className="text-muted-foreground text-sm">
            {t('ai-credits-description')}
          </p>
        </div>
        <Badge variant="outline" className="border-dynamic-blue/30">
          <Zap className="mr-1 h-3 w-3" />
          {t('ai-credits-wallet')}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/50 bg-background/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-sm">{t('included-credits')}</span>
            <span className="text-muted-foreground text-xs">
              {formatAmount(creditData?.included.remaining ?? 0)} /{' '}
              {formatAmount(includedTotal)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-dynamic-blue transition-all"
              style={{
                width: `${barWidth(
                  creditData?.included.totalUsed ?? 0,
                  includedTotal
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-background/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-sm">{t('payg-credits')}</span>
            <span className="text-muted-foreground text-xs">
              {formatAmount(creditData?.payg.remaining ?? 0)} /{' '}
              {formatAmount(paygTotal)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-dynamic-green transition-all"
              style={{
                width: `${barWidth(creditData?.payg.totalUsed ?? 0, paygTotal)}%`,
              }}
            />
          </div>
          {creditData?.payg.nextExpiry && (
            <p className="mt-2 flex items-center gap-1 text-muted-foreground text-xs">
              <Clock className="h-3 w-3" />
              {t('payg-next-expiry', {
                date: new Date(creditData.payg.nextExpiry).toLocaleDateString(),
              })}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 font-semibold text-base">
          {t('buy-credit-packs')}
        </h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {packs.map((pack) => (
            <div
              key={pack.id}
              className="rounded-xl border border-border/50 bg-background/50 p-4"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{pack.name}</p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    {pack.description ||
                      t('credit-pack-description-fallback', {
                        tokens: formatAmount(pack.tokens),
                      })}
                  </p>
                </div>
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="mb-3 space-y-1">
                <p className="font-bold text-lg">
                  {formatPrice(pack.currency, pack.price)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t('credit-pack-validity', { days: pack.expiryDays })}
                </p>
              </div>

              <Button
                size="sm"
                className={cn('w-full')}
                disabled={!canPurchase || purchaseMutation.isPending}
                onClick={() => purchaseMutation.mutate(pack.id)}
              >
                {purchaseMutation.isPending
                  ? t('credit-pack-processing')
                  : t('buy-now')}
              </Button>
            </div>
          ))}
        </div>

        {!canPurchase && (
          <p className="mt-3 text-muted-foreground text-xs">
            {t('subscription-management-restricted')}
          </p>
        )}
      </div>
    </div>
  );
}
