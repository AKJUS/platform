import { createClient } from '@tuturuuu/supabase/next/server';
import { getPermissions } from '@tuturuuu/utils/workspace-helper';
import { NextResponse } from 'next/server';
import { z } from 'zod';

interface Params {
  params: Promise<{
    wsId: string;
    groupId: string;
    postId: string;
  }>;
}

export async function PUT(req: Request, { params }: Params) {
  const supabase = await createClient();
  const data = await req.json();
  const { wsId, groupId, postId } = await params;

  // Check permissions
  const { withoutPermission } = await getPermissions({ wsId });
  const canUpdateUserGroupsPosts = !withoutPermission(
    'update_user_groups_posts'
  );
  if (!canUpdateUserGroupsPosts) {
    return NextResponse.json(
      { message: 'Insufficient permissions to update user group posts' },
      { status: 403 }
    );
  }

  // Ensure resource belongs to this workspace and group
  const { data: post, error: postErr } = await supabase
    .from('user_group_posts')
    .select(`
      id,
      group_id,
      workspace_user_groups!inner(ws_id)
    `)
    .eq('id', postId)
    .eq('workspace_user_groups.ws_id', wsId)
    .eq('group_id', groupId)
    .maybeSingle();
  if (postErr || !post) {
    return NextResponse.json({ message: 'Post not found' }, { status: 404 });
  }

  // Validate payload
  const SingleSchema = z.object({
    user_id: z.uuid(),
    is_completed: z.boolean(),
    notes: z.string().max(2000).nullable().optional(),
    // created_at is server-managed; do not accept from client
  });
  const MultipleSchema = z.array(SingleSchema);
  const isArray = Array.isArray(data);
  const parse = isArray
    ? MultipleSchema.safeParse(data)
    : SingleSchema.safeParse(data);
  if (!parse.success) {
    return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
  }

  const multiple = isArray;
  const validatedData = parse.data;

  if (multiple) {
    const { error } = await supabase
      .from('user_group_post_checks')
      .upsert(
        (
          validatedData as Array<{
            user_id: string;
            is_completed: boolean;
            notes?: string | null;
          }>
        ).map((item) => ({
          post_id: postId,
          user_id: item.user_id,
          notes: item.notes ?? null,
          is_completed: item.is_completed,
        }))
      )
      .eq('post_id', postId);

    if (error) {
      console.error('Error updating user_group_post_checks:', error.message);
      return NextResponse.json(
        {
          message: 'Error updating user_group_post_checks',
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Data updated successfully' });
  } else {
    const singleData = validatedData as {
      user_id: string;
      is_completed: boolean;
      notes?: string | null;
    };

    const { error } = await supabase
      .from('user_group_post_checks')
      .upsert({
        post_id: postId,
        user_id: singleData.user_id,
        notes: singleData.notes ?? null,
        is_completed: singleData.is_completed,
      })
      .eq('post_id', postId)
      .eq('user_id', singleData.user_id);

    if (error) {
      console.error('Error updating user_group_post_checks:', error.message);
      return NextResponse.json(
        {
          message: 'Error updating user_group_post_checks',
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Data updated successfully' });
  }
}
