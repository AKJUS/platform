import type { TypedSupabaseClient } from '@tuturuuu/supabase';
import { createAdminClient } from '@tuturuuu/supabase/next/server';
import type { Json } from '@tuturuuu/types';
import dayjs from 'dayjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export interface ChainSummary {
  sessions: Array<{
    id: string;
    title: string | null;
    description: string | null;
    start_time: string;
    end_time: string | null;
    duration_seconds: number;
    category_id: string | null;
    task_id: string | null;
    chain_position: number;
  }>;
  breaks: Array<{
    id: string;
    session_id: string;
    break_type_name: string;
    break_start: string;
    break_end: string | null;
    break_duration_seconds: number;
  }>;
  total_sessions: number;
  total_duration_seconds: number;
  first_start_time: string;
  last_end_time: string | null;
}

export const pauseActionSchema = z.object({
  action: z.literal('pause'),
  breakTypeId: z.string().nullable().optional(),
  breakTypeName: z.string().nullable().optional(),
  pendingApproval: z.boolean().optional(),
});

export const editActionSchema = z.object({
  action: z.literal('edit'),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

export const patchSessionBodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('stop') }),
  pauseActionSchema,
  z.object({ action: z.literal('resume') }),
  editActionSchema,
]);

export type PatchSessionBody = z.infer<typeof patchSessionBodySchema>;
export type PauseActionBody = z.infer<typeof pauseActionSchema>;
export type EditActionBody = z.infer<typeof editActionSchema>;

export type SessionRecord = {
  id: string;
  ws_id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  category_id: string | null;
  task_id: string | null;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  is_running: boolean;
  pending_approval: boolean | null;
};

export async function getSessionChainRoot(
  sessionId: string
): Promise<{ rootSessionId: string }> {
  const sbAdmin = await createAdminClient();

  const { data, error } = await sbAdmin
    .rpc('get_session_chain_root', {
      session_id_input: sessionId,
    })
    .single();

  if (error || !data) {
    return { rootSessionId: sessionId };
  }

  return {
    rootSessionId: (data as { root_session_id: string }).root_session_id,
  };
}

export async function checkSessionThreshold(
  wsId: string,
  sessionStartTime: string,
  options?: {
    sessionId?: string;
    returnChainDetails?: boolean;
  }
): Promise<{
  exceeds: boolean;
  thresholdDays: number | null;
  message?: string;
  chainSummary?: ChainSummary;
}> {
  const sbAdmin = await createAdminClient();

  const { data: workspaceSettings } = await sbAdmin
    .from('workspace_settings')
    .select('missed_entry_date_threshold')
    .eq('ws_id', wsId)
    .single();

  const thresholdDays = workspaceSettings?.missed_entry_date_threshold;

  if (thresholdDays === null || thresholdDays === undefined) {
    return { exceeds: false, thresholdDays: null };
  }

  let startTimeToCheck = sessionStartTime;
  let chainSummary: ChainSummary | undefined;

  if (options?.sessionId) {
    const { rootSessionId } = await getSessionChainRoot(options.sessionId);

    const { data: rootSession } = await sbAdmin
      .from('time_tracking_sessions')
      .select('start_time')
      .eq('id', rootSessionId)
      .single();

    if (rootSession) {
      startTimeToCheck = rootSession.start_time;
    }

    if (options.returnChainDetails) {
      const { data: summary } = await sbAdmin.rpc('get_session_chain_summary', {
        session_id_input: options.sessionId,
      });
      chainSummary = summary as unknown as ChainSummary | undefined;
    }
  }

  if (thresholdDays === 0) {
    return {
      exceeds: true,
      thresholdDays: 0,
      message: 'All missed entries must be submitted as requests',
      chainSummary,
    };
  }

  const now = dayjs();
  const startTime = dayjs(startTimeToCheck);
  const thresholdAgo = now.subtract(thresholdDays, 'day');

  if (startTime.isBefore(thresholdAgo)) {
    return {
      exceeds: true,
      thresholdDays,
      message: `Cannot complete sessions older than ${thresholdDays} day${thresholdDays !== 1 ? 's' : ''}. Please submit a missed entry request instead.`,
      chainSummary,
    };
  }

  return { exceeds: false, thresholdDays, chainSummary };
}

export async function handleStopAction({
  sbAdmin,
  supabase,
  session,
  sessionId,
  normalizedWsId,
  canBypass,
}: {
  sbAdmin: TypedSupabaseClient;
  supabase: TypedSupabaseClient;
  session: SessionRecord;
  sessionId: string;
  normalizedWsId: string;
  canBypass: boolean;
}): Promise<NextResponse> {
  const hasPendingApproval = session.pending_approval === true;
  if (!hasPendingApproval && !canBypass) {
    const thresholdCheck = await checkSessionThreshold(
      normalizedWsId,
      session.start_time,
      {
        sessionId: sessionId,
        returnChainDetails: true,
      }
    );

    if (thresholdCheck.exceeds) {
      return NextResponse.json(
        {
          error:
            thresholdCheck.message || 'Session exceeds workspace threshold',
          code: 'THRESHOLD_EXCEEDED',
          thresholdDays: thresholdCheck.thresholdDays,
          chainSummary: thresholdCheck.chainSummary,
          sessionId: sessionId,
        },
        { status: 400 }
      );
    }
  }

  const isPaused = !session.is_running;
  const endTime = new Date().toISOString();

  const { data: activeBreak } = await sbAdmin
    .from('time_tracking_breaks')
    .select('*')
    .eq('session_id', sessionId)
    .is('break_end', null)
    .order('break_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeBreak) {
    const { error: updateError } = await sbAdmin
      .from('time_tracking_breaks')
      .update({
        break_end: endTime,
      })
      .eq('id', activeBreak.id);

    if (updateError) {
      console.error('Failed to close active break on stop:', updateError);
    }
  }

  if (isPaused) {
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
      .single();

    if (error) throw error;
    return NextResponse.json({ session: data });
  }

  const startTime = new Date(session.start_time);
  const durationSeconds = Math.floor(
    (new Date(endTime).getTime() - startTime.getTime()) / 1000
  );

  const { data, error } = await sbAdmin
    .from('time_tracking_sessions')
    .update({
      end_time: endTime,
      duration_seconds: durationSeconds,
      is_running: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select(
      `
          *,
          category:time_tracking_categories(*),
          task:tasks(*)
        `
    )
    .single();

  if (error) throw error;
  return NextResponse.json({ session: data });
}

export async function handlePauseAction({
  sbAdmin,
  session,
  sessionId,
  normalizedWsId,
  userId,
  canBypass,
  requestBody,
}: {
  sbAdmin: TypedSupabaseClient;
  session: SessionRecord;
  sessionId: string;
  normalizedWsId: string;
  userId: string;
  canBypass: boolean;
  requestBody: PauseActionBody;
}): Promise<NextResponse> {
  const { breakTypeId, breakTypeName, pendingApproval } = requestBody;
  const isBreakPause = breakTypeId || breakTypeName;

  if (!isBreakPause && !canBypass) {
    const thresholdCheck = await checkSessionThreshold(
      normalizedWsId,
      session.start_time,
      {
        sessionId: sessionId,
        returnChainDetails: true,
      }
    );

    if (thresholdCheck.exceeds) {
      return NextResponse.json(
        {
          error:
            thresholdCheck.message || 'Session exceeds workspace threshold',
          code: 'THRESHOLD_EXCEEDED',
          thresholdDays: thresholdCheck.thresholdDays,
          chainSummary: thresholdCheck.chainSummary,
          sessionId: sessionId,
        },
        { status: 400 }
      );
    }
  }

  const endTime = new Date().toISOString();
  const startTime = new Date(session.start_time);
  const durationSeconds = Math.floor((Date.now() - startTime.getTime()) / 1000);

  if (isBreakPause) {
    let finalBreakTypeId = breakTypeId;
    let finalBreakTypeName = breakTypeName;

    if (!finalBreakTypeId) {
      const { data: defaultBreakType } = await sbAdmin
        .from('workspace_break_types')
        .select('*')
        .eq('ws_id', normalizedWsId)
        .eq('is_default', true)
        .maybeSingle();

      if (defaultBreakType) {
        finalBreakTypeId = defaultBreakType.id;
        finalBreakTypeName = defaultBreakType.name;
      }
    }

    const { error: breakError } = await sbAdmin
      .from('time_tracking_breaks')
      .insert({
        session_id: sessionId,
        break_type_id: finalBreakTypeId || null,
        break_type_name: finalBreakTypeName || 'Break',
        break_start: endTime,
        break_end: null,
        created_by: userId,
      });

    if (breakError) {
      console.error('Failed to create break record:', breakError);
      await sbAdmin
        .from('time_tracking_sessions')
        .update({
          end_time: null,
          duration_seconds: null,
          is_running: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
      return NextResponse.json(
        { error: 'Failed to create break record' },
        { status: 500 }
      );
    }

    const { error: rpcError } = await sbAdmin.rpc('pause_session_for_break', {
      p_session_id: sessionId,
      p_end_time: endTime,
      p_duration_seconds: durationSeconds,
      p_pending_approval: pendingApproval || false,
    });

    if (rpcError) {
      console.error('RPC pause_session_for_break failed:', rpcError);
      throw rpcError;
    }

    const { data: fullSession, error: fetchError } = await sbAdmin
      .from('time_tracking_sessions')
      .select(`
            *,
            category:time_tracking_categories(*),
            task:tasks(*)
          `)
      .eq('id', sessionId)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json({ session: fullSession });
  }

  const { data, error } = await sbAdmin
    .from('time_tracking_sessions')
    .update({
      end_time: endTime,
      duration_seconds: durationSeconds,
      is_running: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select(
      `
          *,
          category:time_tracking_categories(*),
          task:tasks(*)
        `
    )
    .single();

  if (error) throw error;

  return NextResponse.json({ session: data });
}

export async function handleResumeAction({
  sbAdmin,
  session,
  sessionId,
  normalizedWsId,
  userId,
}: {
  sbAdmin: TypedSupabaseClient;
  session: SessionRecord;
  sessionId: string;
  normalizedWsId: string;
  userId: string;
}): Promise<NextResponse> {
  const resumeTime = new Date().toISOString();

  const { data: activeBreak } = await sbAdmin
    .from('time_tracking_breaks')
    .select('*')
    .eq('session_id', sessionId)
    .is('break_end', null)
    .order('break_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeBreak) {
    const { error: updateError } = await sbAdmin
      .from('time_tracking_breaks')
      .update({
        break_end: resumeTime,
      })
      .eq('id', activeBreak.id);

    if (updateError) {
      console.error('Failed to close break on resume:', updateError);
    }
  }

  const { data, error } = await sbAdmin
    .from('time_tracking_sessions')
    .insert([
      {
        ws_id: normalizedWsId,
        user_id: userId,
        title: session.title ?? 'Work session',
        description: session.description,
        category_id: session.category_id,
        task_id: session.task_id,
        start_time: resumeTime,
        is_running: true,
        was_resumed: true,
        parent_session_id: sessionId,
        created_at: resumeTime,
        updated_at: resumeTime,
      },
    ])
    .select(
      `
          *,
          category:time_tracking_categories(*),
          task:tasks(*)
        `
    )
    .single();

  if (error) throw error;

  return NextResponse.json({
    session: data,
    breakDuration: activeBreak
      ? Math.floor(
          (new Date(resumeTime).getTime() -
            new Date(activeBreak.break_start).getTime()) /
            1000
        )
      : null,
  });
}

export async function handleEditAction({
  sbAdmin,
  session,
  sessionId,
  normalizedWsId,
  canBypass,
  requestBody,
}: {
  sbAdmin: TypedSupabaseClient;
  session: SessionRecord;
  sessionId: string;
  normalizedWsId: string;
  canBypass: boolean;
  requestBody: EditActionBody;
}): Promise<NextResponse> {
  const { title, description, categoryId, taskId, startTime, endTime } =
    requestBody;

  const now = new Date();
  if (startTime !== undefined) {
    const start = new Date(startTime);
    if (start > now) {
      return NextResponse.json(
        {
          error:
            'Cannot update a time tracking session to have a start time in the future.',
        },
        { status: 400 }
      );
    }
  }

  if (endTime !== undefined) {
    const end = new Date(endTime);
    if (end > now) {
      return NextResponse.json(
        {
          error:
            'Cannot update a time tracking session to have an end time in the future.',
        },
        { status: 400 }
      );
    }
  }

  const updateData: {
    updated_at: string;
    title?: string;
    description?: string | null;
    category_id?: string | null;
    task_id?: string | null;
    start_time?: string;
    end_time?: string;
    duration_seconds?: number;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (title !== undefined) updateData.title = title.trim();
  if (description !== undefined)
    updateData.description = description?.trim() || null;
  if (categoryId !== undefined) updateData.category_id = categoryId || null;
  if (taskId !== undefined) updateData.task_id = taskId || null;

  if (!session.is_running) {
    const isEditingTime = startTime !== undefined || endTime !== undefined;
    if (isEditingTime && !canBypass) {
      const { data: workspaceSettings } = await sbAdmin
        .from('workspace_settings')
        .select('missed_entry_date_threshold')
        .eq('ws_id', normalizedWsId)
        .maybeSingle();

      const thresholdDays = workspaceSettings?.missed_entry_date_threshold;
      if (thresholdDays !== null && thresholdDays !== undefined) {
        if (thresholdDays === 0) {
          return NextResponse.json(
            {
              error:
                'All time edits must be submitted as requests for approval',
            },
            { status: 400 }
          );
        }

        const sessionStartTime = new Date(session.start_time);
        const thresholdAgo = new Date();
        thresholdAgo.setDate(thresholdAgo.getDate() - thresholdDays);

        if (sessionStartTime < thresholdAgo) {
          return NextResponse.json(
            {
              error: `Cannot edit start time or end time for sessions older than ${thresholdDays} day${thresholdDays !== 1 ? 's' : ''}`,
            },
            { status: 400 }
          );
        }

        if (startTime) {
          const newStartTime = new Date(startTime);
          if (newStartTime < thresholdAgo) {
            return NextResponse.json(
              {
                error: `Cannot update session to a start time more than ${thresholdDays} day${thresholdDays !== 1 ? 's' : ''} ago`,
              },
              { status: 400 }
            );
          }
        }
      }
    }

    if (startTime) updateData.start_time = new Date(startTime).toISOString();
    if (endTime) {
      updateData.end_time = new Date(endTime).toISOString();
      if (startTime && endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        updateData.duration_seconds = Math.floor(
          (end.getTime() - start.getTime()) / 1000
        );
      }
    }
  }

  const hasTimeFieldUpdates =
    updateData.start_time !== undefined ||
    updateData.end_time !== undefined ||
    updateData.duration_seconds !== undefined;

  if (canBypass && hasTimeFieldUpdates) {
    const fields: Record<string, unknown> = {};
    if (updateData.title !== undefined) fields.title = updateData.title;
    if (updateData.description !== undefined)
      fields.description = updateData.description;
    if (updateData.category_id !== undefined)
      fields.category_id = updateData.category_id;
    if (updateData.task_id !== undefined) fields.task_id = updateData.task_id;
    if (updateData.start_time !== undefined)
      fields.start_time = updateData.start_time;
    if (updateData.end_time !== undefined)
      fields.end_time = updateData.end_time;
    if (updateData.duration_seconds !== undefined)
      fields.duration_seconds = updateData.duration_seconds;

    const { error: rpcError } = await sbAdmin.rpc(
      'update_time_tracking_session_with_bypass',
      {
        p_session_id: sessionId,
        p_fields: fields as Json,
      }
    );

    if (rpcError) {
      if (rpcError.code === 'P0001') {
        return NextResponse.json({ error: rpcError.message }, { status: 400 });
      }
      throw rpcError;
    }

    const { data, error: fetchError } = await sbAdmin
      .from('time_tracking_sessions')
      .select(
        `
            *,
            category:time_tracking_categories(*),
            task:tasks(*)
          `
      )
      .eq('id', sessionId)
      .single();

    if (fetchError) throw fetchError;
    return NextResponse.json({ session: data });
  }

  const { data, error } = await sbAdmin
    .from('time_tracking_sessions')
    .update(updateData)
    .eq('id', sessionId)
    .select(
      `
          *,
          category:time_tracking_categories(*),
          task:tasks(*)
        `
    )
    .single();

  if (error) {
    if (
      error.message?.includes('older than') ||
      error.message?.includes('must be submitted as requests') ||
      error.code === 'P0001'
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  return NextResponse.json({ session: data });
}
