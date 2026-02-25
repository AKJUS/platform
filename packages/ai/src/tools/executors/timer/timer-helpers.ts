import type { MiraToolContext } from '../../mira-tools';

export const MIN_DURATION_SECONDS = 60;
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
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== trimmed
  ) {
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

export function normalizeCursor(cursor: unknown):
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

export async function shouldRequireApproval(
  startTime: Date,
  ctx: MiraToolContext
): Promise<{ requiresApproval: boolean; reason?: string }> {
  const { data: settings, error } = await ctx.supabase
    .from('workspace_settings')
    .select('missed_entry_date_threshold')
    .eq('ws_id', ctx.wsId)
    .maybeSingle();

  if (error) {
    return { requiresApproval: true };
  }

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

export function coerceOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
