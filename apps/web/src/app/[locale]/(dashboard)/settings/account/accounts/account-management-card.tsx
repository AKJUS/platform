'use client';

import { AddAccountButton } from '@/components/account-switcher';
import { useAccountSwitcher } from '@/context/account-switcher-context';
import { Loader2, Trash2 } from '@tuturuuu/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@tuturuuu/ui/avatar';
import { Badge } from '@tuturuuu/ui/badge';
import { Button } from '@tuturuuu/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tuturuuu/ui/card';
import { Separator } from '@tuturuuu/ui/separator';
import { getInitials } from '@tuturuuu/utils/name-helper';
import { formatDistanceToNow } from 'date-fns';
import { useTranslations } from 'next-intl';
import { type JSX, useState } from 'react';
import { RemoveAccountDialog } from './remove-account-dialog';

export function AccountManagementCard(): JSX.Element {
  const t = useTranslations();
  const { accounts, activeAccountId, isLoading, refreshAccounts } =
    useAccountSwitcher();
  const [accountToRemove, setAccountToRemove] = useState<string | null>(null);

  const sortedAccounts = [...accounts].sort(
    (a, b) =>
      (b.metadata.lastActiveAt ?? 0) - (a.metadata.lastActiveAt ?? 0)
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('account_switcher.manage_accounts')}</CardTitle>
          <CardDescription>
            {t('account_switcher.manage_accounts_description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {!isLoading && accounts.length === 0 && (
            <div className="space-y-4 p-8 text-center">
              <p className="text-sm text-foreground/60">
                {t('account_switcher.no_accounts_found')}
              </p>
              <AddAccountButton />
            </div>
          )}

          {!isLoading && accounts.length > 0 && (
            <div className="space-y-4">
              {sortedAccounts.map((account, index) => {
                const isActive = account.id === activeAccountId;
                const displayName =
                  account.metadata.displayName ||
                  account.email ||
                  'Unknown User';
                const initials = getInitials(displayName);
                const lastActive =
                  account.metadata.lastActiveAt != null
                    ? formatDistanceToNow(account.metadata.lastActiveAt, {
                        addSuffix: true,
                      })
                    : 'Never';

                return (
                  <div key={account.id}>
                    {index > 0 && <Separator />}
                    <div className="flex items-start gap-4 py-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage
                          src={account.metadata.avatarUrl}
                          alt={displayName}
                        />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{displayName}</p>
                          {isActive && (
                            <Badge variant="secondary">
                              {t('account_switcher.active')}
                            </Badge>
                          )}
                        </div>
                        {account.email && (
                          <p className="text-sm text-foreground/60">
                            {account.email}
                          </p>
                        )}
                        <p className="text-xs text-foreground/40">
                          {t('account_switcher.last_active')}: {lastActive}
                        </p>
                        {account.metadata.lastWorkspaceId && (
                          <p className="text-xs text-foreground/40">
                            {t('account_switcher.last_workspace')}:{' '}
                            {account.metadata.lastWorkspaceId}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!isActive && accounts.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAccountToRemove(account.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('account_switcher.remove')}
                          </Button>
                        )}
                        {isActive && (
                          <span className="text-xs text-foreground/40">
                            {t('account_switcher.cannot_remove_active')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <Separator />

              <div className="pt-2">
                <AddAccountButton />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <RemoveAccountDialog
        accountId={accountToRemove}
        onClose={() => setAccountToRemove(null)}
        onSuccess={refreshAccounts}
      />
    </>
  );
}
