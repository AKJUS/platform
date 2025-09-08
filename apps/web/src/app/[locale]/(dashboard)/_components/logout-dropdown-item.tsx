'use client';

import { DropdownMenuItem } from '@tuturuuu/ui/dropdown-menu';
import { LogOut } from '@tuturuuu/ui/icons';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export function LogoutDropdownItem() {
  const t = useTranslations('common');
  const router = useRouter();

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
    });
    router.refresh();
  };

  return (
    <DropdownMenuItem onClick={logout} className="cursor-pointer">
      <LogOut className="h-4 w-4" />
      <span>{t('logout')}</span>
    </DropdownMenuItem>
  );
}
