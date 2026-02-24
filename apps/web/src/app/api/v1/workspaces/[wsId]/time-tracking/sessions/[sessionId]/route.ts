import {
  createAdminClient,
  createClient,
} from '@tuturuuu/supabase/next/server';
import {
  getPermissions,
  normalizeWorkspaceId,
} from '@tuturuuu/utils/workspace-helper';
import { type NextRequest, NextResponse } from 'next/server';
import {
  handleEditAction,
  handlePauseAction,
  handleResumeAction,
  handleStopAction,
  type PatchSessionBody,
  patchSessionBodySchema,
  type SessionRecord,
} from './helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wsId: string; sessionId: string }> }
) {
  try {
    const { wsId, sessionId } = await params;
    const supabase = await createClient(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: memberCheck } = await supabase
      .from('workspace_members')
      .select('id:user_id')
      .eq('ws_id', wsId)
      .eq('user_id', user.id)
      .single();

    if (!memberCheck) {
      return NextResponse.json(
        { error: 'Workspace access denied' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('time_tracking_sessions')
      .select(
        `
        *,
        category:time_tracking_categories(*),
        task:tasks(*)
      `
      )
      .eq('id', sessionId)
      .eq('ws_id', wsId)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ session: data });
  } catch (error) {
    console.error('Error fetching time tracking session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ wsId: string; sessionId: string }> }
) {
  try {
    const { wsId, sessionId } = await params;
    const supabase = await createClient(request);

    let normalizedWsId: string;
    try {
      normalizedWsId = await normalizeWorkspaceId(wsId, supabase);
    } catch {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: memberCheck } = await supabase
      .from('workspace_members')
      .select('id:user_id')
      .eq('ws_id', normalizedWsId)
      .eq('user_id', user.id)
      .single();

    if (!memberCheck) {
      return NextResponse.json(
        { error: 'Workspace access denied' },
        { status: 403 }
      );
    }

    const bodyResult = patchSessionBodySchema.safeParse(await request.json());
    if (!bodyResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: bodyResult.error.flatten(),
        },
        { status: 400 }
      );
    }
    const body: PatchSessionBody = bodyResult.data;

    const { data: session, error: sessionError } = await supabase
      .from('time_tracking_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('ws_id', normalizedWsId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sbAdmin = await createAdminClient();
    const permissions = await getPermissions({ wsId: normalizedWsId, request });
    if (!permissions) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    const canBypass = permissions.containsPermission(
      'bypass_time_tracking_request_approval'
    );

    const sessionRecord = session as SessionRecord;
    switch (body.action) {
      case 'stop':
        return await handleStopAction({
          sbAdmin,
          supabase,
          session: sessionRecord,
          sessionId,
          normalizedWsId,
          canBypass,
        });
      case 'pause':
        return await handlePauseAction({
          sbAdmin,
          session: sessionRecord,
          sessionId,
          normalizedWsId,
          userId: user.id,
          canBypass,
          requestBody: body,
        });
      case 'resume':
        return await handleResumeAction({
          sbAdmin,
          session: sessionRecord,
          sessionId,
          normalizedWsId,
          userId: user.id,
        });
      case 'edit':
        return await handleEditAction({
          sbAdmin,
          session: sessionRecord,
          sessionId,
          normalizedWsId,
          canBypass,
          requestBody: body,
        });
    }
  } catch (error) {
    console.error('Error updating time tracking session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ wsId: string; sessionId: string }> }
) {
  try {
    const { wsId, sessionId } = await params;
    const supabase = await createClient(request);

    let normalizedWsId: string;
    try {
      normalizedWsId = await normalizeWorkspaceId(wsId, supabase);
    } catch {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: memberCheck } = await supabase
      .from('workspace_members')
      .select('id:user_id')
      .eq('ws_id', normalizedWsId)
      .eq('user_id', user.id)
      .single();

    if (!memberCheck) {
      return NextResponse.json(
        { error: 'Workspace access denied' },
        { status: 403 }
      );
    }

    const { data: session } = await supabase
      .from('time_tracking_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('ws_id', normalizedWsId)
      .eq('user_id', user.id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sbAdmin = await createAdminClient();
    const { error } = await sbAdmin
      .from('time_tracking_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting time tracking session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
