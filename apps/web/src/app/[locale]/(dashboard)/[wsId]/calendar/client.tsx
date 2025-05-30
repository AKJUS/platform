'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkspaceCalendarGoogleToken } from '@tuturuuu/types/db';
import type { Workspace } from '@tuturuuu/types/primitives/Workspace';
import { Calendar } from '@tuturuuu/ui/legacy/calendar/Calendar';
import { useLocale, useTranslations } from 'next-intl';

export default function CalendarClientPage({
  experimentalGoogleToken,
  workspace,
}: {
  experimentalGoogleToken?: WorkspaceCalendarGoogleToken;
  workspace: Workspace;
}) {
  const t = useTranslations('calendar');
  const locale = useLocale();

  return (
    <Calendar
      t={t}
      locale={locale}
      workspace={workspace}
      useQuery={useQuery}
      useQueryClient={useQueryClient}
      experimentalGoogleToken={
        experimentalGoogleToken?.ws_id === workspace.id
          ? experimentalGoogleToken
          : undefined
      }
    />
  );
}
