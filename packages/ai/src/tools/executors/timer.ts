import type { MiraToolContext } from '../mira-tools';

const MIN_DURATION_SECONDS = 60;
const ENABLE_APPROVAL_BYPASS_CHECK = false;

function parseDateOnly(
  value: unknown,
  fieldName: string
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, error: `${fieldName} is required` };
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { ok: false, error: `${fieldName} must use YYYY-MM-DD format` };
  }

  const parsed = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: `${fieldName} must be a valid date` };
  }

  return { ok: true, value: trimmed };
}

export function parseFlexibleDateTime(
  value: unknown,
  fieldName: string,
  options?: { date?: unknown }
): { ok: true; value: Date } | { ok: false; error: string } {
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, error: `${fieldName} is required` };
  }

  const trimmed = value.trim();
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    const dateTimeWithSpaceMatch = trimmed.match(
      /^(\d{4}-\d{2}-\d{2})\s+([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/
    );
    if (dateTimeWithSpaceMatch) {
      const [, datePart, hours, minutes, seconds = '00'] =
        dateTimeWithSpaceMatch;
      const combined = new Date(`${datePart}T${hours}:${minutes}:${seconds}`);
      if (!Number.isNaN(combined.getTime())) {
        return { ok: true, value: combined };
      }
    }

    const timeOnlyMatch = trimmed.match(
      /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/
    );
    if (timeOnlyMatch) {
      const dateParsed = parseDateOnly(options?.date, 'date');
      if (!dateParsed.ok) {
        return {
          ok: false,
          error: `${fieldName} must be a valid ISO datetime, or HH:mm/HH:mm:ss when date is provided in YYYY-MM-DD format`,
        };
      }

      const [, hours, minutes, seconds = '00'] = timeOnlyMatch;
      const combined = new Date(
        `${dateParsed.value}T${hours}:${minutes}:${seconds}`
      );
      if (!Number.isNaN(combined.getTime())) {
        return { ok: true, value: combined };
      }
    }

    return {
      ok: false,
      error:
        `${fieldName} must be a valid ISO datetime, YYYY-MM-DD HH:mm, ` +
        `or HH:mm/HH:mm:ss when date is provided in YYYY-MM-DD format`,
    };
  }

  return { ok: true, value: parsed };
}

function normalizeCursor(cursor: unknown):
  | {
      ok: true;
      lastStartTime: string;
      lastId: string;
    }
  | {
      ok: false;
      error: string;
    } {
  if (typeof cursor !== 'string' || !cursor.includes('|')) {
    return { ok: false, error: 'Invalid cursor format' };
  }

  const [lastStartTime, lastId] = cursor.split('|');
  if (!lastStartTime || !lastId) {
    return { ok: false, error: 'Invalid cursor format' };
  }

  return { ok: true, lastStartTime, lastId };
}

async function hasBypassApprovalPermission(
  ctx: MiraToolContext
): Promise<boolean> {
  const { data: workspace } = await ctx.supabase
    .from('workspaces')
    .select('creator_id')
    .eq('id', ctx.wsId)
    .maybeSingle();

  if (workspace?.creator_id === ctx.userId) return true;

  const { data: defaults } = await ctx.supabase
    .from('workspace_default_permissions')
    .select('permission')
    .eq('ws_id', ctx.wsId)
    .eq('enabled', true)
    .eq('permission', 'bypass_time_tracking_request_approval')
    .limit(1);

  if (defaults?.length) return true;

  const { data: rolePermissions } = await ctx.supabase
    .from('workspace_role_members')
    .select(
      'workspace_roles!inner(ws_id, workspace_role_permissions(permission, enabled))'
    )
    .eq('user_id', ctx.userId)
    .eq('workspace_roles.ws_id', ctx.wsId);

  if (!rolePermissions?.length) return false;

  return rolePermissions.some((membership) =>
    (membership.workspace_roles?.workspace_role_permissions || []).some(
      (permission) =>
        permission.enabled &&
        permission.permission === 'bypass_time_tracking_request_approval'
    )
  );
}

async function shouldRequireApproval(
  startTime: Date,
  ctx: MiraToolContext
): Promise<{ requiresApproval: boolean; reason?: string }> {
  const { data: settings } = await ctx.supabase
    .from('workspace_settings')
    .select('missed_entry_date_threshold')
    .eq('ws_id', ctx.wsId)
    .maybeSingle();

  const thresholdDays = settings?.missed_entry_date_threshold;
  if (thresholdDays === null || thresholdDays === undefined) {
    return { requiresApproval: false };
  }

  if (ENABLE_APPROVAL_BYPASS_CHECK) {
    const bypassAllowed = await hasBypassApprovalPermission(ctx);
    if (bypassAllowed) return { requiresApproval: false };
  }

  if (thresholdDays === 0) {
    return {
      requiresApproval: true,
      reason: 'Workspace requires approval for all missed entries.',
    };
  }

  const thresholdAgo = new Date();
  thresholdAgo.setDate(thresholdAgo.getDate() - thresholdDays);

  if (startTime < thresholdAgo) {
    return {
      requiresApproval: true,
      reason: `Entry is older than ${thresholdDays} day${thresholdDays === 1 ? '' : 's'} threshold.`,
    };
  }

  return { requiresApproval: false };
}

function coerceOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function executeStartTimer(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const title = args.title as string;

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
      description: (args.description as string) ?? null,
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

export async function executeListTimeTrackingSessions(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const includePending = Boolean(args.includePending);
  const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 50);
  const cursor = args.cursor;

  let query = ctx.supabase
    .from('time_tracking_sessions')
    .select(
      `
      id, title, description, start_time, end_time, duration_seconds,
      is_running, category_id, task_id, pending_approval, ws_id,
      category:time_tracking_categories(id, name, color),
      task:tasks(id, name)
    `
    )
    .eq('ws_id', ctx.wsId)
    .eq('user_id', ctx.userId)
    .order('start_time', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (!includePending) {
    query = query.eq('pending_approval', false);
  }

  if (cursor !== undefined) {
    const normalized = normalizeCursor(cursor);
    if (!normalized.ok) return { error: normalized.error };

    const esc = (value: string) =>
      value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    query = query.or(
      `start_time.lt."${esc(normalized.lastStartTime)}",and(start_time.eq."${esc(normalized.lastStartTime)}",id.lt."${esc(normalized.lastId)}")`
    );
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const sessions = hasMore ? rows.slice(0, limit) : rows;
  const last = sessions[sessions.length - 1];

  return {
    success: true,
    count: sessions.length,
    sessions,
    hasMore,
    nextCursor: last ? `${last.start_time}|${last.id}` : null,
  };
}

export async function executeGetTimeTrackingSession(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const sessionId = (args.sessionId as string) ?? (args.id as string);
  if (!sessionId) return { error: 'sessionId is required' };

  const { data, error } = await ctx.supabase
    .from('time_tracking_sessions')
    .select(
      `
      *,
      category:time_tracking_categories(*),
      task:tasks(*)
    `
    )
    .eq('id', sessionId)
    .eq('ws_id', ctx.wsId)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: 'Session not found' };

  return { success: true, session: data };
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
