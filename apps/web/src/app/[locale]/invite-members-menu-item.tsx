'use client';

import { UserPlus } from '@tuturuuu/icons';
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@tuturuuu/ui/dropdown-menu';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

export default function InviteMembersMenuItem() {
  const t = useTranslations('common');
  const pathname = usePathname();
  const params = useParams();

  const { wsId } = params;
  if (!wsId) return null;

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        {pathname === `/${wsId}/members` ? (
          <DropdownMenuItem disabled>
            <UserPlus className="h-4 w-4 text-dynamic-sky" />
            <span>{t('invite_users')}</span>
          </DropdownMenuItem>
        ) : (
          <Link href={`/${wsId}/members`}>
            <DropdownMenuItem className="cursor-pointer">
              <UserPlus className="h-4 w-4 text-dynamic-sky" />
              <span>{t('invite_users')}</span>
            </DropdownMenuItem>
          </Link>
        )}
      </DropdownMenuGroup>
    </>
  );
}
