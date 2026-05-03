import { createAdminClient } from '@tuturuuu/supabase/next/server';
import type { TypedSupabaseClient } from '@tuturuuu/supabase/types';
import { getPermissions } from '@tuturuuu/utils/workspace-helper';
import { NextResponse } from 'next/server';
import type { MetricCategory } from '@/app/[locale]/(dashboard)/[wsId]/users/groups/[groupId]/indicators/types';

interface Params {
  params: Promise<{
    wsId: string;
    groupId: string;
  }>;
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

async function getValidMetricCategoryIds(
  sbAdmin: TypedSupabaseClient,
  wsId: string,
  categoryIds: string[]
) {
  if (!categoryIds.length) return [];

  const uniqueCategoryIds = [...new Set(categoryIds)];
  const { data, error } = await sbAdmin
    .from('user_group_metric_categories')
    .select('id')
    .eq('ws_id', wsId)
    .in('id', uniqueCategoryIds);

  if (error) throw error;

  const validCategoryIds = (data ?? []).map((category) => category.id);
  if (validCategoryIds.length !== uniqueCategoryIds.length) {
    throw new Error('Invalid metric category');
  }

  return validCategoryIds;
}

export async function GET(req: Request, { params }: Params) {
  const { wsId, groupId } = await params;

  // Check permissions
  const permissions = await getPermissions({ wsId, request: req });
  if (!permissions) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const { withoutPermission } = permissions;
  if (withoutPermission('view_user_groups')) {
    return NextResponse.json(
      { message: 'Insufficient permissions to view user groups' },
      { status: 403 }
    );
  }

  const sbAdmin = await createAdminClient();

  // Fetch group indicators
  const { data: groupIndicators, error: indicatorsError } = await sbAdmin
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

  if (indicatorsError) {
    console.error(indicatorsError);
    return NextResponse.json(
      { message: 'Error fetching group indicators' },
      { status: 500 }
    );
  }

  const { data: metricCategories, error: metricCategoriesError } = await sbAdmin
    .from('user_group_metric_categories')
    .select('id, name, description')
    .eq('ws_id', wsId)
    .order('name', { ascending: true });

  if (metricCategoriesError) {
    console.error(metricCategoriesError);
    return NextResponse.json(
      { message: 'Error fetching metric categories' },
      { status: 500 }
    );
  }

  // Fetch user indicators
  const { data: userIndicators, error: userIndicatorsError } = await sbAdmin
    .from('user_indicators')
    .select(`
      user_id,
      indicator_id,
      value,
      user_group_metrics!inner(group_id)
    `)
    .eq('user_group_metrics.group_id', groupId);

  if (userIndicatorsError) {
    console.error(userIndicatorsError);
    return NextResponse.json(
      { message: 'Error fetching user indicators' },
      { status: 500 }
    );
  }

  // Fetch manager IDs
  const { data: managers, error: managersError } = await sbAdmin
    .from('workspace_user_groups_users')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('role', 'TEACHER');

  if (managersError) {
    console.error(managersError);
    return NextResponse.json(
      { message: 'Error fetching group managers' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    groupIndicators: (groupIndicators || []).map((indicator) => ({
      id: indicator.id,
      name: indicator.name,
      factor: indicator.factor,
      unit: indicator.unit,
      is_weighted: indicator.is_weighted,
      categories: mapMetricCategories(
        indicator.user_group_metric_category_links
      ),
    })),
    metricCategories: metricCategories || [],
    userIndicators: (userIndicators || []).map((ui) => ({
      user_id: ui.user_id,
      indicator_id: ui.indicator_id,
      value: ui.value,
    })),
    managerUserIds: (managers || []).map((m) => m.user_id),
  });
}

export async function POST(req: Request, { params }: Params) {
  const { wsId, groupId } = await params;

  // Check permissions
  const permissions = await getPermissions({ wsId, request: req });
  if (!permissions) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const { containsPermission } = permissions;
  if (!containsPermission('create_user_groups_scores')) {
    return NextResponse.json(
      { message: 'Insufficient permissions to manage indicators' },
      { status: 403 }
    );
  }

  const {
    name,
    unit,
    factor,
    categoryIds = [],
    isWeighted = true,
  } = await req.json();

  if (!name) {
    return NextResponse.json({ message: 'Name is required' }, { status: 400 });
  }

  const sbAdmin = await createAdminClient();

  let validCategoryIds: string[];
  try {
    validCategoryIds = await getValidMetricCategoryIds(
      sbAdmin,
      wsId,
      Array.isArray(categoryIds) ? categoryIds : []
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: 'Invalid metric category' },
      { status: 400 }
    );
  }

  const { data, error } = await sbAdmin
    .from('user_group_metrics')
    .insert({
      name,
      unit: unit?.trim() || '',
      factor: factor || 1,
      is_weighted: isWeighted !== false,
      ws_id: wsId,
      group_id: groupId,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json(
      { message: 'Error creating indicator' },
      { status: 500 }
    );
  }

  if (validCategoryIds.length) {
    const { error: categoryLinkError } = await sbAdmin
      .from('user_group_metric_category_links')
      .insert(
        validCategoryIds.map((categoryId) => ({
          category_id: categoryId,
          metric_id: data.id,
        }))
      );

    if (categoryLinkError) {
      console.error(categoryLinkError);
      return NextResponse.json(
        { message: 'Error assigning metric categories' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(data);
}

export async function PATCH(req: Request, { params }: Params) {
  const { wsId } = await params;

  // Check permissions
  const permissions = await getPermissions({ wsId, request: req });
  if (!permissions) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const values = (await req.json()) as {
    user_id: string;
    indicator_id: string;
    value: number | null;
  }[];

  if (!Array.isArray(values)) {
    return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
  }

  const sbAdmin = await createAdminClient();

  const { error } = await sbAdmin.from('user_indicators').upsert(
    values.map(({ user_id, indicator_id, value }) => ({
      user_id,
      indicator_id,
      value,
    }))
  );

  if (error) {
    console.error(error);
    return NextResponse.json(
      { message: 'Error updating indicator values' },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: 'success' });
}
