'use client';

import { CategoryFilterWrapper } from '@tuturuuu/ui/finance/transactions/category-filter-wrapper';
import { InfiniteTransactionsList } from '@tuturuuu/ui/finance/transactions/infinite-transactions-list';
import { UserFilterWrapper } from '@tuturuuu/ui/finance/transactions/user-filter-wrapper';
import { WalletFilterWrapper } from '@tuturuuu/ui/finance/transactions/wallet-filter-wrapper';
import MoneyLoverImportDialog from '@tuturuuu/ui/finance/transactions/money-lover-import-dialog';
import { Button } from '@tuturuuu/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@tuturuuu/ui/dialog';
import SearchBar from '@tuturuuu/ui/custom/search-bar';
import { Download, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@tuturuuu/ui/skeleton';

interface TransactionsInfinitePageProps {
  wsId: string;
  canExport?: boolean;
  exportContent?: React.ReactNode;
  canUpdateTransactions?: boolean;
  canDeleteTransactions?: boolean;
}

export function TransactionsInfinitePage({
  wsId,
  canExport,
  exportContent,
  canUpdateTransactions,
  canDeleteTransactions,
}: TransactionsInfinitePageProps) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSearch = (query: string) => {
    const params = new URLSearchParams(searchParams);
    if (query) {
      params.set('q', query);
    } else {
      params.delete('q');
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col items-start justify-between gap-2 md:flex-row">
        <div className="grid w-full flex-1 flex-wrap items-center gap-2 md:flex">
          <SearchBar
            t={t}
            defaultValue={searchParams.get('q') || ''}
            onSearch={handleSearch}
            className="col-span-full w-full bg-background md:col-span-1 md:max-w-xs"
          />
          <Suspense fallback={<Skeleton className="h-8 w-32" />}>
            <UserFilterWrapper wsId={wsId} />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-8 w-32" />}>
            <CategoryFilterWrapper wsId={wsId} />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-8 w-32" />}>
            <WalletFilterWrapper wsId={wsId} />
          </Suspense>
        </div>

        <div className="flex w-full gap-2 md:w-auto">
          {/* Import button */}
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full md:w-fit"
              >
                <Download className="h-4 w-4" />
                {t('common.import')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <MoneyLoverImportDialog wsId={wsId} />
            </DialogContent>
          </Dialog>

          {/* Export button */}
          {canExport && exportContent && (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full md:w-fit"
                >
                  <Upload className="h-4 w-4" />
                  {t('common.export')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                {exportContent}
              </DialogContent>
            </Dialog>
          )}

          {/* Create button */}
        </div>
      </div>

      {/* Transaction list */}
      <Suspense
        fallback={
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        }
      >
        <InfiniteTransactionsList
          wsId={wsId}
          canUpdateTransactions={canUpdateTransactions}
          canDeleteTransactions={canDeleteTransactions}
        />
      </Suspense>
    </div>
  );
}
