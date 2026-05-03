import { createAdminClient } from '@tuturuuu/supabase/next/server';
import type { TypedSupabaseClient } from '@tuturuuu/supabase/types';
import { getPermissions } from '@tuturuuu/utils/workspace-helper';
import { NextResponse } from 'next/server';

interface Params {
  params: Promise<{
    wsId: string;
    groupId: string;
    indicatorId: string;
  }>;
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

export async function PUT(req: Request, { params }: Params) {
  const { wsId, indicatorId } = await params;

  // Check permissions
  const permissions = await getPermissions({ wsId, request: req });
  if (!permissions) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const { containsPermission } = permissions;
  if (!containsPermission('update_user_groups_scores')) {
    return NextResponse.json(
      { message: 'Insufficient permissions to manage indicators' },
      { status: 403 }
    );
  }

  const {
    name,
    factor,
    unit,
    categoryIds,
    isWeighted = true,
  } = await req.json();

  const sbAdmin = await createAdminClient();

  let validCategoryIds: string[] | null = null;
  if (Array.isArray(categoryIds)) {
    try {
      validCategoryIds = await getValidMetricCategoryIds(
        sbAdmin,
        wsId,
        categoryIds
      );
    } catch (error) {
      console.error(error);
      return NextResponse.json(
        { message: 'Invalid metric category' },
        { status: 400 }
      );
    }
  }

  const { data, error } = await sbAdmin
    .from('user_group_metrics')
    .update({ name, factor, unit, is_weighted: isWeighted !== false })
    .eq('id', indicatorId)
    .eq('ws_id', wsId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error(error);
    return NextResponse.json(
      { message: 'Error updating indicator' },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { message: 'Indicator not found' },
      { status: 404 }
    );
  }

  if (validCategoryIds) {
    const { error: deleteError } = await sbAdmin
      .from('user_group_metric_category_links')
      .delete()
      .eq('metric_id', indicatorId);

    if (deleteError) {
      console.error(deleteError);
      return NextResponse.json(
        { message: 'Error updating metric categories' },
        { status: 500 }
      );
    }

    if (validCategoryIds.length) {
      const { error: insertError } = await sbAdmin
        .from('user_group_metric_category_links')
        .insert(
          validCategoryIds.map((categoryId) => ({
            category_id: categoryId,
            metric_id: indicatorId,
          }))
        );

      if (insertError) {
        console.error(insertError);
        return NextResponse.json(
          { message: 'Error updating metric categories' },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ message: 'success' });
}

export async function DELETE(req: Request, { params }: Params) {
  const { wsId, indicatorId } = await params;

  // Check permissions
  const permissions = await getPermissions({ wsId, request: req });
  if (!permissions) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const { containsPermission } = permissions;
  if (!containsPermission('delete_user_groups_scores')) {
    return NextResponse.json(
      { message: 'Insufficient permissions to manage indicators' },
      { status: 403 }
    );
  }

  const sbAdmin = await createAdminClient();

  // Instead of deleting, we set group_id to null as per original logic
  const { error } = await sbAdmin
    .from('user_group_metrics')
    .update({ group_id: null })
    .eq('id', indicatorId)
    .eq('ws_id', wsId);

  if (error) {
    console.error(error);
    return NextResponse.json(
      { message: 'Error deleting indicator' },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: 'success' });
}
