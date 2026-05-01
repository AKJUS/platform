import { HardDrive } from '@tuturuuu/icons';
import { createAdminClient } from '@tuturuuu/supabase/next/server';
import { Button } from '@tuturuuu/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@tuturuuu/ui/sheet';
import { getPermissions } from '@tuturuuu/utils/workspace-helper';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { resolveRouteWorkspace } from '@/lib/resolve-route-workspace';
import { CourseBuilderClient } from '../../../../education/courses/[courseId]/builder/course-builder-client';
import GroupStorage from '../group-storage';

export const metadata: Metadata = {
  title: 'Group Content Builder',
  description: 'Build and publish course modules within your user group.',
};

interface Props {
  params: Promise<{
    groupId: string;
    wsId: string;
  }>;
}

export default async function GroupContentPage({ params }: Props) {
  const { wsId: routeWsId, groupId } = await params;
  const { resolvedWsId } = await resolveRouteWorkspace(routeWsId);
  const permissions = await getPermissions({ wsId: resolvedWsId });
  if (!permissions?.containsPermission('manage_users')) {
    notFound();
  }

  const canUpdateUserGroups =
    permissions.containsPermission('update_user_groups');
  const t = await getTranslations();

  const sbAdmin = await createAdminClient();

  const { data: group, error: groupError } = await sbAdmin
    .from('workspace_user_groups')
    .select('*')
    .eq('ws_id', resolvedWsId)
    .eq('id', groupId)
    .maybeSingle();

  if (groupError) throw groupError;
  if (!group) notFound();

  return (
    <CourseBuilderClient
      courseId={groupId}
      courseName={group.name}
      resolvedWsId={resolvedWsId}
      routeWsId={routeWsId}
      backHref={`/${routeWsId}/users/groups/${groupId}`}
      backLabel={t('common.back')}
      extraHeaderActions={
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="h-11 rounded-2xl px-4">
              <HardDrive className="mr-2 h-4 w-4" />
              {t('ws-user-group-details.storage') || 'Storage'}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
            <SheetHeader className="mb-6">
              <SheetTitle>
                {t('ws-user-group-details.storage') || 'Storage'}
              </SheetTitle>
            </SheetHeader>
            <GroupStorage
              wsId={resolvedWsId}
              groupId={groupId}
              canUpdateGroup={canUpdateUserGroups}
            />
          </SheetContent>
        </Sheet>
      }
    />
  );
}
