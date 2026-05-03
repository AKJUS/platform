import {
  createAdminClient,
  createClient,
} from '@tuturuuu/supabase/next/server';
import type { UserGroup } from '@tuturuuu/types/primitives/UserGroup';
import type { WorkspaceUser } from '@tuturuuu/types/primitives/WorkspaceUser';
import { getPermissions } from '@tuturuuu/utils/workspace-helper';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import WorkspaceWrapper from '@/components/workspace-wrapper';
import {
  fetchRequireAttentionUserIds,
  withRequireAttentionFlag,
} from '@/lib/require-attention-users';
import GroupIndicatorsManager from './group-indicators-manager';
import type { GroupIndicator, MetricCategory } from './types';

export const metadata: Metadata = {
  title: 'Indicators',
  description:
    'Manage Indicators in the Group area of your Tuturuuu workspace.',
};

interface Props {
  params: Promise<{
    locale: string;
    wsId: string;
    groupId: string;
  }>;
}

export default async function UserGroupIndicatorsPage({ params }: Props) {
  return (
    <WorkspaceWrapper params={params}>
      {async ({ wsId, groupId }) => {
        const permissions = await getPermissions({
          wsId,
        });
        if (!permissions) notFound();
        const { containsPermission } = permissions;
        const canViewUserGroupsScores = containsPermission(
          'view_user_groups_scores'
        );
        if (!canViewUserGroupsScores) {
          notFound();
        }
        const canCreateUserGroupsScores = containsPermission(
          'create_user_groups_scores'
        );
        const canUpdateUserGroupsScores = containsPermission(
          'update_user_groups_scores'
        );
        const canDeleteUserGroupsScores = containsPermission(
          'delete_user_groups_scores'
        );

        const group = await getData(wsId, groupId);
        const indicators = await getIndicators(groupId);
        const groupIndicators = await getGroupIndicators(groupId);
        const metricCategories = await getMetricCategories(wsId);
        const { data: users } = await getUserData(wsId, groupId);

        return (
          <GroupIndicatorsManager
            wsId={wsId}
            groupId={groupId}
            groupName={group.name}
            users={users}
            initialGroupIndicators={groupIndicators}
            initialUserIndicators={indicators}
            initialMetricCategories={metricCategories}
            canCreateUserGroupsScores={canCreateUserGroupsScores}
            canUpdateUserGroupsScores={canUpdateUserGroupsScores}
            canDeleteUserGroupsScores={canDeleteUserGroupsScores}
          />
        );
      }}
    </WorkspaceWrapper>
  );
}

async function getData(wsId: string, groupId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('workspace_user_groups')
    .select('*')
    .eq('ws_id', wsId)
    .eq('id', groupId)
    .maybeSingle();

  if (error) throw error;
  if (!data) notFound();

  return data as UserGroup;
}

function mapMetricCategories(
  metricCategoryLinks:
    | {
        user_group_metric_categories: MetricCategory | MetricCategory[] | null;
      }[]
    | null
    | undefined
) {
  return (metricCategoryLinks ?? [])
    .flatMap((row) => row.user_group_metric_categories ?? [])
    .filter((category): category is MetricCategory => Boolean(category));
}

async function getGroupIndicators(groupId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_group_metrics')
    .select(`
      id,
      name,
      factor,
      unit,
      is_weighted,
      user_group_metric_category_links(
        user_group_metric_categories(id, name, description)
      )
    `)
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!data) return [];

  return data.map(
    (indicator): GroupIndicator => ({
      id: indicator.id,
      name: indicator.name,
      factor: indicator.factor,
      unit: indicator.unit,
      is_weighted: indicator.is_weighted,
      categories: mapMetricCategories(
        indicator.user_group_metric_category_links
      ),
    })
  );
}

async function getMetricCategories(wsId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_group_metric_categories')
    .select('id, name, description')
    .eq('ws_id', wsId)
    .order('name', { ascending: true });

  if (error) throw error;
  if (!data) return [];

  return data satisfies MetricCategory[];
}

async function getIndicators(groupId: string) {
  const supabase = await createClient();

  const { data: rawData, error } = await supabase
    .from('user_indicators')
    .select(`
    user_id,
    indicator_id,
    value,
    user_group_metrics!inner(group_id)
  `)
    .eq('user_group_metrics.group_id', groupId);

  if (error) throw error;
  if (!rawData) return [];

  const data = rawData.map((d) => ({
    user_id: d.user_id,
    indicator_id: d.indicator_id,
    value: d.value,
  }));

  return data;
}

async function getUserData(wsId: string, groupId: string) {
  const supabase = await createAdminClient();

  const queryBuilder = supabase
    .rpc(
      'get_workspace_users',
      {
        _ws_id: wsId,
        included_groups: [groupId],
        excluded_groups: [],
        search_query: '',
      },
      {
        count: 'exact',
      }
    )
    .select('*')
    .order('full_name', { ascending: true, nullsFirst: false });

  const { data, error, count } = await queryBuilder;
  if (error) throw error;

  const users = (data ?? []) as unknown as WorkspaceUser[];
  const requireAttentionUserIds = await fetchRequireAttentionUserIds(supabase, {
    wsId,
    userIds: users.map((user) => user.id),
    groupId,
  });

  return {
    data: withRequireAttentionFlag(users, requireAttentionUserIds),
    count,
  } as { data: WorkspaceUser[]; count: number };
}
