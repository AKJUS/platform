import type { MiraToolContext } from '../../mira-tools';
import {
  coerceOptionalString,
  MIN_DURATION_SECONDS,
  parseFlexibleDateTime,
  shouldRequireApproval,
} from './timer-helpers';

export async function executeStartTimer(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const title = coerceOptionalString(args.title);
  if (!title) return { error: 'title is required' };

  await ctx.supabase
    .from('time_tracking_sessions')
    .update({ is_running: false, end_time: new Date().toISOString() })
    .eq('user_id', ctx.userId)
    .eq('ws_id', ctx.wsId)
    .eq('is_running', true);

  const now = new Date();

  const { data: session, error } = await ctx.supabase
    .from('time_tracking_sessions')
    .insert({
      title,
      description: coerceOptionalString(args.description),
      start_time: now.toISOString(),
      is_running: true,
      user_id: ctx.userId,
      ws_id: ctx.wsId,
    })
    .select('id, title, start_time')
    .single();

  if (error) return { error: error.message };
  return { success: true, message: `Timer started: "${title}"`, session };
}

export async function executeStopTimer(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const sessionId = args.sessionId as string | null;

  let query = ctx.supabase
    .from('time_tracking_sessions')
    .select('id, title, start_time')
    .eq('user_id', ctx.userId)
    .eq('ws_id', ctx.wsId)
    .eq('is_running', true);

  if (sessionId) query = query.eq('id', sessionId);

  const { data: session } = await query.limit(1).single();

  if (!session) return { error: 'No running timer found' };

  const endTime = new Date();
  const startTime = new Date(session.start_time);
  const durationSeconds = Math.round(
    (endTime.getTime() - startTime.getTime()) / 1000
  );

  const { error } = await ctx.supabase
    .from('time_tracking_sessions')
    .update({
      is_running: false,
      end_time: endTime.toISOString(),
      duration_seconds: durationSeconds,
    })
    .eq('id', session.id);

  if (error) return { error: error.message };

  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);

  return {
    success: true,
    message: `Timer stopped: "${session.title}" — ${hours}h ${minutes}m`,
    session: {
      id: session.id,
      title: session.title,
      durationSeconds,
      durationFormatted: `${hours}h ${minutes}m`,
    },
  };
}

export async function executeCreateTimeTrackingEntry(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const title = coerceOptionalString(args.title);
  if (!title) return { error: 'title is required' };

  const startParsed = parseFlexibleDateTime(args.startTime, 'startTime', {
    date: args.date,
  });
  if (!startParsed.ok) return { error: startParsed.error };
  const endParsed = parseFlexibleDateTime(args.endTime, 'endTime', {
    date: args.date,
  });
  if (!endParsed.ok) return { error: endParsed.error };

  const startTime = startParsed.value;
  const endTime = endParsed.value;
  if (endTime <= startTime) {
    return { error: 'endTime must be after startTime' };
  }

  const durationSeconds = Math.floor(
    (endTime.getTime() - startTime.getTime()) / 1000
  );
  if (durationSeconds < MIN_DURATION_SECONDS) {
    return { error: 'Session must be at least 1 minute long' };
  }

  const approvalCheck = await shouldRequireApproval(startTime, ctx);
  if (approvalCheck.requiresApproval) {
    const imagePaths = Array.isArray(args.imagePaths)
      ? args.imagePaths.filter(
          (value): value is string => typeof value === 'string'
        )
      : [];

    if (imagePaths.length > 0) {
      const requestResult = await executeCreateTimeTrackingRequest(args, ctx);
      if (
        typeof requestResult === 'object' &&
        requestResult !== null &&
        'error' in requestResult
      ) {
        return requestResult;
      }

      return {
        ...(typeof requestResult === 'object' && requestResult
          ? requestResult
          : {}),
        requiresApproval: true,
        requestCreated: true,
      };
    }

    return {
      success: true,
      requiresApproval: true,
      requestCreated: false,
      message:
        `${approvalCheck.reason ?? 'This missed entry requires approval.'} ` +
        'No request has been created yet.',
      nextStep:
        'Inform the user to upload proof images and submit a time tracking request to complete this entry.',
      approvalRequest: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        titleHint: title,
        descriptionHint: coerceOptionalString(args.description),
      },
    };
  }

  const { data, error } = await ctx.supabase
    .from('time_tracking_sessions')
    .insert({
      ws_id: ctx.wsId,
      user_id: ctx.userId,
      title,
      description: coerceOptionalString(args.description),
      category_id: coerceOptionalString(args.categoryId),
      task_id: coerceOptionalString(args.taskId),
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration_seconds: durationSeconds,
      is_running: false,
      pending_approval: false,
    })
    .select(
      `
      *,
      category:time_tracking_categories(*),
      task:tasks(*)
    `
    )
    .single();

  if (error) return { error: error.message };

  return {
    success: true,
    requiresApproval: false,
    message: 'Time tracking entry created.',
    session: data,
  };
}

export async function executeCreateTimeTrackingRequest(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const title = coerceOptionalString(args.title);
  if (!title) return { error: 'title is required' };

  const startParsed = parseFlexibleDateTime(args.startTime, 'startTime', {
    date: args.date,
  });
  if (!startParsed.ok) return { error: startParsed.error };
  const endParsed = parseFlexibleDateTime(args.endTime, 'endTime', {
    date: args.date,
  });
  if (!endParsed.ok) return { error: endParsed.error };

  const startTime = startParsed.value;
  const endTime = endParsed.value;
  if (endTime <= startTime) {
    return { error: 'endTime must be after startTime' };
  }

  const imagePaths = Array.isArray(args.imagePaths)
    ? args.imagePaths.filter(
        (value): value is string => typeof value === 'string'
      )
    : [];

  if (imagePaths.length === 0) {
    return {
      error:
        'This request requires proof images. Upload image evidence and include imagePaths.',
    };
  }

  if (imagePaths.length > 5) {
    return { error: 'A maximum of 5 image references is allowed' };
  }

  const requestId =
    (typeof args.requestId === 'string' && args.requestId) ||
    crypto.randomUUID();

  const pathPrefix = `${requestId}/`;
  const hasInvalidPath = imagePaths.some(
    (path) => !path.startsWith(pathPrefix) || path.includes('..')
  );
  if (hasInvalidPath) {
    return {
      error:
        'Invalid image path detected. Every path must start with "<requestId>/".',
    };
  }

  const { data, error } = await ctx.supabase
    .from('time_tracking_requests')
    .insert({
      id: requestId,
      workspace_id: ctx.wsId,
      user_id: ctx.userId,
      title,
      description: coerceOptionalString(args.description),
      category_id: coerceOptionalString(args.categoryId),
      task_id: coerceOptionalString(args.taskId),
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      break_type_id: coerceOptionalString(args.breakTypeId),
      break_type_name: coerceOptionalString(args.breakTypeName),
      linked_session_id: coerceOptionalString(args.linkedSessionId),
      images: imagePaths,
      approval_status: 'PENDING',
    })
    .select('*')
    .single();

  if (error) return { error: error.message };

  return {
    success: true,
    message: 'Time tracking request submitted for approval.',
    request: data,
  };
}

export async function executeUpdateTimeTrackingSession(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const sessionId = (args.sessionId as string) ?? (args.id as string);
  if (!sessionId) return { error: 'sessionId is required' };

  const { data: existing, error: existingError } = await ctx.supabase
    .from('time_tracking_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('ws_id', ctx.wsId)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (existingError) return { error: existingError.message };
  if (!existing) return { error: 'Session not found' };

  const updates: Record<string, unknown> = {};
  if (args.title !== undefined)
    updates.title = coerceOptionalString(args.title);
  if (args.description !== undefined) {
    updates.description = coerceOptionalString(args.description);
  }
  if (args.categoryId !== undefined) {
    updates.category_id = coerceOptionalString(args.categoryId);
  }
  if (args.taskId !== undefined) {
    updates.task_id = coerceOptionalString(args.taskId);
  }

  let nextStartTime = existing.start_time;
  let nextEndTime = existing.end_time;

  if (args.startTime !== undefined) {
    const parsed = parseFlexibleDateTime(args.startTime, 'startTime', {
      date: args.date,
    });
    if (!parsed.ok) return { error: parsed.error };
    nextStartTime = parsed.value.toISOString();
    updates.start_time = nextStartTime;
  }

  if (args.endTime !== undefined) {
    const parsed = parseFlexibleDateTime(args.endTime, 'endTime', {
      date: args.date,
    });
    if (!parsed.ok) return { error: parsed.error };
    nextEndTime = parsed.value.toISOString();
    updates.end_time = nextEndTime;
  }

  if (args.startTime !== undefined || args.endTime !== undefined) {
    if (!nextEndTime) {
      return { error: 'Cannot compute duration without endTime' };
    }

    const start = new Date(nextStartTime);
    const end = new Date(nextEndTime);
    if (end <= start) {
      return { error: 'endTime must be after startTime' };
    }

    const durationSeconds = Math.floor(
      (end.getTime() - start.getTime()) / 1000
    );
    if (durationSeconds < MIN_DURATION_SECONDS) {
      return { error: 'Session must be at least 1 minute long' };
    }
    updates.duration_seconds = durationSeconds;
  }

  if (Object.keys(updates).length === 0) {
    return { success: true, message: 'No fields to update' };
  }

  const { data, error } = await ctx.supabase
    .from('time_tracking_sessions')
    .update(updates)
    .eq('id', sessionId)
    .eq('ws_id', ctx.wsId)
    .eq('user_id', ctx.userId)
    .select(
      `
      *,
      category:time_tracking_categories(*),
      task:tasks(*)
    `
    )
    .single();

  if (error) return { error: error.message };
  return { success: true, message: 'Session updated', session: data };
}

export async function executeDeleteTimeTrackingSession(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const sessionId = (args.sessionId as string) ?? (args.id as string);
  if (!sessionId) return { error: 'sessionId is required' };

  const { error } = await ctx.supabase
    .from('time_tracking_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('ws_id', ctx.wsId)
    .eq('user_id', ctx.userId);

  if (error) return { error: error.message };
  return { success: true, message: 'Session deleted' };
}

export async function executeMoveTimeTrackingSession(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const sessionId = (args.sessionId as string) ?? (args.id as string);
  const targetWorkspaceId = coerceOptionalString(args.targetWorkspaceId);

  if (!sessionId) return { error: 'sessionId is required' };
  if (!targetWorkspaceId) return { error: 'targetWorkspaceId is required' };

  const { data: sourceMembership } = await ctx.supabase
    .from('workspace_members')
    .select('user_id')
    .eq('ws_id', ctx.wsId)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!sourceMembership) {
    return { error: 'Source workspace access denied' };
  }

  const { data: targetMembership } = await ctx.supabase
    .from('workspace_members')
    .select('user_id')
    .eq('ws_id', targetWorkspaceId)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!targetMembership) {
    return { error: 'Target workspace access denied' };
  }

  const { data: session, error: sessionError } = await ctx.supabase
    .from('time_tracking_sessions')
    .select(
      `
      *,
      category:time_tracking_categories(id, name),
      task:tasks(id, name)
    `
    )
    .eq('id', sessionId)
    .eq('ws_id', ctx.wsId)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (sessionError) return { error: sessionError.message };
  if (!session) return { error: 'Session not found' };
  if (session.is_running) {
    return {
      error: 'Cannot move running sessions. Please stop the session first.',
    };
  }

  let targetCategoryId: string | null = null;
  if (session.category?.name) {
    const { data: targetCategory } = await ctx.supabase
      .from('time_tracking_categories')
      .select('id')
      .eq('ws_id', targetWorkspaceId)
      .eq('name', session.category.name)
      .maybeSingle();
    targetCategoryId = targetCategory?.id ?? null;
  }

  let targetTaskId: string | null = null;
  if (session.task?.name) {
    const { data: targetTask } = await ctx.supabase
      .from('tasks')
      .select('id, list:task_lists!inner(board:workspace_boards!inner(ws_id))')
      .eq('list.board.ws_id', targetWorkspaceId)
      .eq('name', session.task.name)
      .maybeSingle();
    targetTaskId = targetTask?.id ?? null;
  }

  const { data: movedSession, error: moveError } = await ctx.supabase
    .from('time_tracking_sessions')
    .update({
      ws_id: targetWorkspaceId,
      category_id: targetCategoryId,
      task_id: targetTaskId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('user_id', ctx.userId)
    .select(
      `
      *,
      category:time_tracking_categories(*),
      task:tasks(*)
    `
    )
    .single();

  if (moveError) return { error: moveError.message };

  return {
    success: true,
    message: 'Session moved successfully',
    session: movedSession,
  };
}
