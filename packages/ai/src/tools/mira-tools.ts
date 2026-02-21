import type { SupabaseClient } from '@tuturuuu/supabase';
import type { Tool, ToolSet } from 'ai';
import { z } from 'zod';
import { tool } from './core';

// ── Tool Definitions (schemas only, passed to streamText) ──

export const miraToolDefinitions = {
  // Tasks
  get_my_tasks: tool({
    description:
      "Get the current user's tasks organized by status. Returns overdue, due today, and upcoming tasks with priority and dates.",
    inputSchema: z.object({
      category: z
        .enum(['all', 'overdue', 'today', 'upcoming'])
        .describe(
          'Filter tasks by time category. Use "all" to get everything.'
        ),
    }),
  }),

  create_task: tool({
    description:
      "Create a new task in the user's workspace. By default the task is assigned to the current user. Returns the created task with its ID.",
    inputSchema: z.object({
      name: z.string().describe('Task title'),
      description: z
        .string()
        .nullable()
        .describe('Task description (plain text), or null'),
      priority: z
        .enum(['low', 'normal', 'high', 'critical'])
        .nullable()
        .describe('Task priority level, or null for no priority'),
      assignToSelf: z
        .boolean()
        .optional()
        .describe(
          'Whether to assign the task to the current user. Defaults to true. Set false only if the user explicitly says not to assign it.'
        ),
    }),
  }),

  complete_task: tool({
    description:
      'Mark a task as completed by its ID. The task must belong to the current workspace.',
    inputSchema: z.object({
      taskId: z.string().describe('UUID of the task to complete'),
    }),
  }),

  // Calendar
  get_upcoming_events: tool({
    description:
      'Get upcoming calendar events for the next N days. Returns title, start/end times, and location.',
    inputSchema: z.object({
      days: z
        .number()
        .int()
        .min(1)
        .max(30)
        .describe('Number of days to look ahead (e.g. 7 for a week)'),
    }),
  }),

  create_event: tool({
    description:
      'Create a new calendar event. Requires title, start time, and end time in ISO 8601 format.',
    inputSchema: z.object({
      title: z.string().describe('Event title'),
      startAt: z
        .string()
        .describe('Start time in ISO 8601 (e.g. 2026-02-20T09:00:00Z)'),
      endAt: z
        .string()
        .describe('End time in ISO 8601 (e.g. 2026-02-20T10:00:00Z)'),
      description: z.string().nullable().describe('Event description, or null'),
      location: z.string().nullable().describe('Event location, or null'),
    }),
  }),

  // Finance
  log_transaction: tool({
    description:
      'Log a financial transaction (expense or income). Positive amount = income, negative = expense.',
    inputSchema: z.object({
      amount: z
        .number()
        .describe('Transaction amount (positive=income, negative=expense)'),
      description: z.string().nullable().describe('What was this for?'),
      walletId: z
        .string()
        .nullable()
        .describe('Wallet UUID. If null, uses the first wallet.'),
    }),
  }),

  get_spending_summary: tool({
    description:
      'Get a summary of spending and income for a given number of past days. Shows total income, expenses, and net balance.',
    inputSchema: z.object({
      days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .describe('Number of past days to summarize (e.g. 30 for a month)'),
    }),
  }),

  // Time tracking
  start_timer: tool({
    description:
      'Start a new time tracking session. Stops any currently running timer first.',
    inputSchema: z.object({
      title: z.string().describe('What are you working on?'),
      description: z
        .string()
        .nullable()
        .describe('Additional details, or null'),
    }),
  }),

  stop_timer: tool({
    description:
      'Stop the currently running time tracking session. Returns the elapsed duration.',
    inputSchema: z.object({
      sessionId: z
        .string()
        .nullable()
        .describe('Session UUID to stop. If null, stops the active session.'),
    }),
  }),

  // Memory
  remember: tool({
    description:
      'Save a memory or fact about the user for future reference. Use when the user shares preferences, goals, important facts, or asks to remember something. IMPORTANT: Store rich, contextual values — don\'t split related facts into separate entries. For people, use a single entry per person with all known details (e.g. key: "person_quoc", value: "Quoc — friend from university at RMIT, co-founder at Zeus/Olympia HQ"). For topics, include relationships and context in the value.',
    inputSchema: z.object({
      key: z
        .string()
        .describe(
          'Short label for the memory. For people use "person_<name>" (e.g. "person_quoc"). For user facts use descriptive keys (e.g. "user_birthday", "favorite_color", "project_deadline").'
        ),
      value: z
        .string()
        .describe(
          'The content to remember. Be detailed and contextual — include relationships, context, and connections to other facts. Avoid single-word values.'
        ),
      category: z
        .enum(['preference', 'fact', 'conversation_topic', 'event', 'person'])
        .describe('Category of the memory'),
    }),
  }),

  // Image generation
  create_image: tool({
    description:
      'Generate an image from a text description. Returns a URL to the generated image saved in workspace storage.',
    inputSchema: z.object({
      prompt: z
        .string()
        .describe('Detailed description of the image to generate'),
      aspectRatio: z
        .enum(['1:1', '3:4', '4:3', '9:16', '16:9'])
        .optional()
        .describe('Aspect ratio for the image. Defaults to 1:1.'),
      model: z
        .enum([
          'google/imagen-4.0-fast-generate-001',
          'google/imagen-4.0-generate-001',
          'google/gemini-2.5-flash-image',
        ])
        .optional()
        .describe(
          'Image model to use. Default: free plan uses Imagen 4 Fast; paid plans use Imagen 4.'
        ),
    }),
  }),

  recall: tool({
    description:
      'Search the user\'s saved memories for relevant context. Use to recall preferences, facts, or past conversations. To get ALL memories (e.g. "tell me everything you know about me"), pass query as null with a high maxResults. Use a single recall call with broad query instead of many narrow calls.',
    inputSchema: z.object({
      query: z
        .string()
        .nullish()
        .describe(
          'What to search for in memories (keywords or natural language). Pass null or omit to get ALL memories without filtering.'
        ),
      category: z
        .enum(['preference', 'fact', 'conversation_topic', 'event', 'person'])
        .nullable()
        .describe('Filter by memory category, or null for all'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(50)
        .describe(
          'Max results to return. Use 20-50 for broad "everything" queries, 5-10 for specific lookups.'
        ),
    }),
  }),

  // Self-configuration
  update_my_settings: tool({
    description:
      'Update YOUR OWN (the assistant\'s) personality settings. IMPORTANT: The `name` field is YOUR name (the AI assistant), NOT the user\'s name. If the user says "call me X" or "my name is X", that is the USER\'s name — use the `remember` tool instead. Only use this tool\'s `name` field when the user says "call yourself X", "your name is X", or "rename yourself to X". Proactively use this for behavior changes like "be warmer", "keep it short". Only set fields that need changing.',
    inputSchema: z.object({
      name: z
        .string()
        .max(50)
        .nullish()
        .describe(
          'New name for YOU (the AI assistant). NEVER set this to the user\'s name. Only change when the user explicitly renames the assistant (e.g. "call yourself Mira").'
        ),
      tone: z
        .enum([
          'balanced',
          'casual',
          'formal',
          'friendly',
          'playful',
          'professional',
          'warm',
        ])
        .nullish()
        .describe('New communication tone, or omit to keep current'),
      personality: z
        .string()
        .max(2000)
        .nullish()
        .describe(
          'New personality description. Use this for freeform behavioral preferences too (e.g. "use emojis", "include code examples"). Append to existing personality if updating — don\'t overwrite unless the user wants a fresh start. Omit to keep current.'
        ),
      boundaries: z
        .string()
        .max(2000)
        .nullish()
        .describe('New boundaries, or omit to keep current'),
      vibe: z
        .enum([
          'calm',
          'energetic',
          'friendly',
          'neutral',
          'playful',
          'warm',
          'witty',
        ])
        .nullish()
        .describe('New energy/vibe, or omit to keep current'),
      chat_tone: z
        .enum(['thorough', 'concise', 'detailed', 'brief'])
        .nullish()
        .describe('New chat response style, or omit to keep current'),
    }),
  }),

  // Escape-hatch: lets the model skip real tools for conversational messages
  // while still satisfying `toolChoice: 'required'`.
  no_action_needed: tool({
    description:
      'Call this ONLY when the user message is purely conversational and requires NO real action — e.g. greetings ("hi", "thanks"), follow-up questions, or casual chat. For ANY request that involves tasks, calendar, finance, timers, memory, settings, or images you MUST call the appropriate tool instead.',
    inputSchema: z.object({
      reason: z
        .string()
        .describe(
          'Brief reason why no action tool is needed (e.g. "user said thanks")'
        ),
    }),
  }),
};

// ── Stream Tools Factory (returns tools with execute bound to context) ──

export type MiraToolContext = {
  userId: string;
  wsId: string;
  supabase: SupabaseClient;
};

/**
 * Creates tools with `execute` functions bound to the given context.
 * Pass the result directly to `streamText({ tools })` for server-side
 * multi-turn tool execution with `maxSteps`.
 */
export function createMiraStreamTools(ctx: MiraToolContext): ToolSet {
  const tools: ToolSet = {};
  for (const [name, def] of Object.entries(miraToolDefinitions)) {
    tools[name] = {
      ...def,
      execute: async (args: Record<string, unknown>) =>
        executeMiraTool(name, args, ctx),
    } as Tool;
  }
  return tools;
}

// ── Tool Executors (called from chat route when tools are invoked) ──

/**
 * Executes a Mira tool call by name with the given arguments.
 * Called from the chat route's tool call handling logic.
 */
export async function executeMiraTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: MiraToolContext
): Promise<unknown> {
  const { userId, wsId, supabase } = ctx;

  switch (toolName) {
    case 'get_my_tasks':
      return executeGetMyTasks(args, userId, wsId, supabase);
    case 'create_task':
      return executeCreateTask(args, userId, wsId, supabase);
    case 'complete_task':
      return executeCompleteTask(args, supabase);
    case 'get_upcoming_events':
      return executeGetUpcomingEvents(args, wsId, supabase);
    case 'create_event':
      return executeCreateEvent(args, wsId, supabase);
    case 'log_transaction':
      return executeLogTransaction(args, wsId, supabase);
    case 'get_spending_summary':
      return executeGetSpendingSummary(args, wsId, supabase);
    case 'start_timer':
      return executeStartTimer(args, userId, wsId, supabase);
    case 'stop_timer':
      return executeStopTimer(args, userId, wsId, supabase);
    case 'create_image':
      return executeGenerateImage(args, ctx);
    case 'remember':
      return executeRemember(args, userId, supabase);
    case 'recall':
      return executeRecall(args, userId, supabase);
    case 'update_my_settings':
      return executeUpdateMySettings(args, userId, supabase);
    case 'no_action_needed':
      return { ok: true };
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ── Executor Implementations ──

async function executeGetMyTasks(
  args: Record<string, unknown>,
  userId: string,
  wsId: string,
  supabase: SupabaseClient
) {
  const category = (args.category as string) || 'all';

  const { data: tasks, error } = await supabase.rpc(
    'get_user_accessible_tasks',
    {
      p_user_id: userId,
      p_ws_id: wsId,
      p_include_deleted: false,
      p_list_statuses: ['not_started', 'active', 'done'],
    }
  );

  if (error) return { error: error.message };

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  type RpcTask = {
    task_id: string;
    task_name: string;
    task_priority: string | null;
    task_end_date: string | null;
    task_completed_at: string | null;
    task_closed_at: string | null;
  };

  const active = ((tasks as RpcTask[]) || []).filter(
    (t) => !t.task_completed_at && !t.task_closed_at
  );

  const mapTask = (t: RpcTask) => ({
    id: t.task_id,
    name: t.task_name,
    priority: t.task_priority,
    dueDate: t.task_end_date,
  });

  const overdue = active
    .filter((t) => t.task_end_date && t.task_end_date < now.toISOString())
    .map(mapTask)
    .slice(0, 30);

  const today = active
    .filter(
      (t) =>
        t.task_end_date &&
        t.task_end_date >= todayStart.toISOString() &&
        t.task_end_date <= todayEnd.toISOString() &&
        t.task_end_date >= now.toISOString()
    )
    .map(mapTask)
    .slice(0, 30);

  const upcoming = active
    .filter((t) => !t.task_end_date || t.task_end_date > todayEnd.toISOString())
    .map(mapTask)
    .slice(0, 30);

  const result: Record<string, unknown> = { totalActive: active.length };
  if (category === 'all' || category === 'overdue')
    result.overdue = { count: overdue.length, tasks: overdue };
  if (category === 'all' || category === 'today')
    result.today = { count: today.length, tasks: today };
  if (category === 'all' || category === 'upcoming')
    result.upcoming = { count: upcoming.length, tasks: upcoming };
  return result;
}

async function executeCreateTask(
  args: Record<string, unknown>,
  userId: string,
  wsId: string,
  supabase: SupabaseClient
) {
  const name = args.name as string;
  const description = args.description as string | null;
  const priority = args.priority as string | null;
  const assignToSelf = (args.assignToSelf as boolean | undefined) !== false;

  // Find an existing board, or auto-create one named "Tasks"
  let { data: board } = await supabase
    .from('workspace_boards')
    .select('id')
    .eq('ws_id', wsId)
    .limit(1)
    .single();

  if (!board) {
    const { data: newBoard, error: boardErr } = await supabase
      .from('workspace_boards')
      .insert({ name: 'Tasks', ws_id: wsId })
      .select('id')
      .single();
    if (boardErr || !newBoard)
      return {
        error: `Failed to create board: ${boardErr?.message ?? 'Unknown error'}`,
      };
    board = newBoard;
  }

  // Find an existing list, or auto-create one named "To Do"
  let { data: list } = await supabase
    .from('task_lists')
    .select('id')
    .eq('board_id', board.id)
    .eq('is_archived', false)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (!list) {
    const { data: newList, error: listErr } = await supabase
      .from('task_lists')
      .insert({ name: 'To Do', board_id: board.id })
      .select('id')
      .single();
    if (listErr || !newList)
      return {
        error: `Failed to create list: ${listErr?.message ?? 'Unknown error'}`,
      };
    list = newList;
  }

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      name,
      description: description
        ? JSON.stringify({
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: description }],
              },
            ],
          })
        : null,
      list_id: list.id,
      priority,
      completed: false,
    })
    .select('id, name, priority, created_at')
    .single();

  if (error) return { error: error.message };

  // Auto-assign the task to the current user unless opted out
  if (assignToSelf && task) {
    const { error: assignErr } = await supabase
      .from('task_assignees')
      .insert({ task_id: task.id, user_id: userId });
    if (assignErr) {
      // Non-fatal — task is created, just assignment failed
      return {
        success: true,
        message: `Task "${name}" created, but auto-assignment failed: ${assignErr.message}`,
        task,
      };
    }
    return {
      success: true,
      message: `Task "${name}" created and assigned to you`,
      task,
    };
  }

  return {
    success: true,
    message: `Task "${name}" created (unassigned)`,
    task,
  };
}

async function executeCompleteTask(
  args: Record<string, unknown>,
  supabase: SupabaseClient
) {
  const taskId = args.taskId as string;

  const { error } = await supabase
    .from('tasks')
    .update({ completed: true, completed_at: new Date().toISOString() })
    .eq('id', taskId);

  if (error) return { error: error.message };
  return { success: true, message: 'Task marked as completed' };
}

async function executeGetUpcomingEvents(
  args: Record<string, unknown>,
  wsId: string,
  supabase: SupabaseClient
) {
  const days = (args.days as number) || 7;
  const now = new Date();
  const future = new Date(now);
  future.setDate(future.getDate() + days);

  const { data: events, error } = await supabase
    .from('workspace_calendar_events')
    .select('id, title, description, start_at, end_at, location')
    .eq('ws_id', wsId)
    .gte('start_at', now.toISOString())
    .lte('start_at', future.toISOString())
    .order('start_at', { ascending: true })
    .limit(50);

  if (error) return { error: error.message };

  return {
    count: events?.length ?? 0,
    events: (events || []).map(
      (e: {
        id: string;
        title: string;
        start_at: string;
        end_at: string;
        location: string | null;
      }) => ({
        id: e.id,
        title: e.title,
        start: e.start_at,
        end: e.end_at,
        location: e.location,
      })
    ),
  };
}

async function executeCreateEvent(
  args: Record<string, unknown>,
  wsId: string,
  supabase: SupabaseClient
) {
  const { data: event, error } = await supabase
    .from('workspace_calendar_events')
    .insert({
      title: args.title as string,
      start_at: args.startAt as string,
      end_at: args.endAt as string,
      description: (args.description as string) ?? '',
      location: (args.location as string) ?? null,
      ws_id: wsId,
    })
    .select('id, title, start_at, end_at')
    .single();

  if (error) return { error: error.message };
  return {
    success: true,
    message: `Event "${args.title}" created`,
    event,
  };
}

async function executeLogTransaction(
  args: Record<string, unknown>,
  wsId: string,
  supabase: SupabaseClient
) {
  const amount = args.amount as number;
  let walletId = args.walletId as string | null;

  if (!walletId) {
    const { data: wallet } = await supabase
      .from('workspace_wallets')
      .select('id')
      .eq('ws_id', wsId)
      .limit(1)
      .single();

    if (!wallet) return { error: 'No wallet found in workspace' };
    walletId = wallet.id;
  }

  const { data: tx, error } = await supabase
    .from('wallet_transactions')
    .insert({
      amount,
      description: (args.description as string) ?? null,
      wallet_id: walletId,
      taken_at: new Date().toISOString(),
    })
    .select('id, amount, description, taken_at')
    .single();

  if (error) return { error: error.message };
  return {
    success: true,
    message: `Transaction of ${amount} logged`,
    transaction: tx,
  };
}

async function executeGetSpendingSummary(
  args: Record<string, unknown>,
  wsId: string,
  supabase: SupabaseClient
) {
  const days = (args.days as number) || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: wallets } = await supabase
    .from('workspace_wallets')
    .select('id, name, currency, balance')
    .eq('ws_id', wsId);

  if (!wallets?.length)
    return { wallets: [], totalIncome: 0, totalExpenses: 0, net: 0 };

  const walletIds = wallets.map(
    (w: { id: string; name: string; currency: string; balance: number }) => w.id
  );

  const { data: transactions } = await supabase
    .from('wallet_transactions')
    .select('amount, wallet_id')
    .in('wallet_id', walletIds)
    .gte('taken_at', since.toISOString());

  let totalIncome = 0;
  let totalExpenses = 0;

  for (const tx of transactions || []) {
    if (tx.amount && tx.amount > 0) totalIncome += tx.amount;
    else if (tx.amount && tx.amount < 0) totalExpenses += Math.abs(tx.amount);
  }

  return {
    period: `Last ${days} days`,
    totalIncome,
    totalExpenses,
    net: totalIncome - totalExpenses,
    wallets: wallets.map(
      (w: { id: string; name: string; currency: string; balance: number }) => ({
        id: w.id,
        name: w.name,
        currency: w.currency,
        balance: w.balance,
      })
    ),
  };
}

async function executeStartTimer(
  args: Record<string, unknown>,
  userId: string,
  wsId: string,
  supabase: SupabaseClient
) {
  const title = args.title as string;

  // Stop any currently running session
  await supabase
    .from('time_tracking_sessions')
    .update({ is_running: false, end_time: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('ws_id', wsId)
    .eq('is_running', true);

  const now = new Date();

  const { data: session, error } = await supabase
    .from('time_tracking_sessions')
    .insert({
      title,
      description: (args.description as string) ?? null,
      start_time: now.toISOString(),
      is_running: true,
      user_id: userId,
      ws_id: wsId,
      date: now.toISOString().split('T')[0],
    })
    .select('id, title, start_time')
    .single();

  if (error) return { error: error.message };
  return { success: true, message: `Timer started: "${title}"`, session };
}

async function executeStopTimer(
  args: Record<string, unknown>,
  userId: string,
  wsId: string,
  supabase: SupabaseClient
) {
  const sessionId = args.sessionId as string | null;

  let query = supabase
    .from('time_tracking_sessions')
    .select('id, title, start_time')
    .eq('user_id', userId)
    .eq('ws_id', wsId)
    .eq('is_running', true);

  if (sessionId) query = query.eq('id', sessionId);

  const { data: session } = await query.limit(1).single();

  if (!session) return { error: 'No running timer found' };

  const endTime = new Date();
  const startTime = new Date(session.start_time);
  const durationSeconds = Math.round(
    (endTime.getTime() - startTime.getTime()) / 1000
  );

  const { error } = await supabase
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

const IMAGEN_4_FAST = 'google/imagen-4.0-fast-generate-001';
const IMAGEN_4 = 'google/imagen-4.0-generate-001';

async function executeGenerateImage(
  args: Record<string, unknown>,
  ctx: MiraToolContext
): Promise<unknown> {
  const prompt = args.prompt as string;
  const aspectRatio = (args.aspectRatio as string) ?? '1:1';

  // Default model: FREE plan uses fast (cheaper); paid plans use standard Imagen 4
  const resolvedModel =
    (args.model as string) ??
    (await (async () => {
      const { getWorkspaceTier } = await import(
        '@tuturuuu/utils/workspace-helper'
      );
      const tier = await getWorkspaceTier(ctx.wsId, { useAdmin: true });
      return tier === 'FREE' ? IMAGEN_4_FAST : IMAGEN_4;
    })());
  const selectedModel = resolvedModel;

  // Pre-flight credit check before generating
  const { checkAiCredits } = await import('../credits/check-credits');
  const creditCheck = await checkAiCredits(
    ctx.wsId,
    selectedModel,
    'image_generation',
    {
      userId: ctx.userId,
    }
  );

  if (!creditCheck.allowed) {
    const errorMessages: Record<string, string> = {
      FEATURE_NOT_ALLOWED:
        'Image generation is not available on your current plan.',
      MODEL_NOT_ALLOWED: `The model ${selectedModel} is not enabled for your workspace.`,
      CREDITS_EXHAUSTED: 'You have run out of AI credits for image generation.',
      NO_ALLOCATION: 'Image generation is not configured for your workspace.',
    };
    return {
      success: false,
      error:
        errorMessages[creditCheck.errorCode ?? ''] ??
        'Image generation is not available. Please check your AI credit settings.',
    };
  }

  const { generateImage, gateway } = await import('ai');
  const { createAdminClient } = await import('@tuturuuu/supabase/next/server');

  // Generate image via AI Gateway (uses AI_GATEWAY_API_KEY from env)
  const { image } = await generateImage({
    model: gateway.image(selectedModel),
    prompt,
    aspectRatio: aspectRatio as `${number}:${number}`,
  });

  // Upload to workspace storage
  const sbAdmin = await createAdminClient();
  const imageId = crypto.randomUUID();
  const storagePath = `${ctx.wsId}/mira/images/${imageId}.png`;

  const { error: uploadError } = await sbAdmin.storage
    .from('workspaces')
    .upload(storagePath, image.uint8Array, {
      contentType: 'image/png',
      upsert: false,
    });

  if (uploadError) {
    return { success: false, error: `Upload failed: ${uploadError.message}` };
  }

  // Generate signed URL (30 days — long-lived for chat history persistence)
  const { data: urlData, error: urlError } = await sbAdmin.storage
    .from('workspaces')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 30);

  if (urlError || !urlData) {
    return {
      success: false,
      error: `Signed URL failed: ${urlError?.message ?? 'No data returned'}`,
    };
  }

  // Deduct credits for image generation (fire-and-forget)
  const { deductAiCredits } = await import('../credits/check-credits');
  void deductAiCredits({
    wsId: ctx.wsId,
    userId: ctx.userId,
    modelId: selectedModel,
    inputTokens: 0,
    outputTokens: 0,
    imageCount: 1,
    feature: 'image_generation',
    metadata: {
      prompt,
      aspectRatio,
      storagePath,
      model: selectedModel,
    },
  }).catch((err: unknown) =>
    console.error('Image credit deduction failed:', err)
  );

  return {
    success: true,
    imageUrl: urlData.signedUrl,
    storagePath,
    prompt,
  };
}

async function executeRemember(
  args: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient
) {
  const key = args.key as string;
  const value = args.value as string;
  const category = args.category as string;

  // Upsert: update if same key exists
  const { data: existing } = await supabase
    .from('mira_memories')
    .select('id')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('mira_memories')
      .update({
        value,
        category,
        updated_at: new Date().toISOString(),
        last_referenced_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) return { error: error.message };
    return {
      success: true,
      message: `Memory "${key}" updated`,
      action: 'updated',
    };
  }

  const { error } = await supabase.from('mira_memories').insert({
    user_id: userId,
    key,
    value,
    category,
    source: 'mira_chat',
  });

  if (error) return { error: error.message };
  return { success: true, message: `Remembered: "${key}"`, action: 'created' };
}

async function executeRecall(
  args: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient
) {
  const query = (args.query as string | null | undefined) ?? null;
  const category = args.category as string | null;
  const maxResults = (args.maxResults as number) || 10;

  let dbQuery = supabase
    .from('mira_memories')
    .select('key, value, category, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(maxResults);

  if (category) dbQuery = dbQuery.eq('category', category);

  // Only filter by query when a specific search term is provided.
  // Null/empty query returns all memories (for "tell me everything" requests).
  if (query?.trim()) {
    dbQuery = dbQuery.or(`key.ilike.%${query}%,value.ilike.%${query}%`);
  }

  const { data: memories, error } = await dbQuery;

  if (error) return { error: error.message };

  // Touch last_referenced_at for relevance tracking
  if (memories?.length) {
    void supabase
      .from('mira_memories')
      .update({ last_referenced_at: new Date().toISOString() })
      .eq('user_id', userId)
      .in(
        'key',
        memories.map((m: { key: string }) => m.key)
      );
  }

  return {
    count: memories?.length ?? 0,
    memories: (memories || []).map(
      (m: {
        key: string;
        value: string;
        category: string;
        updated_at: string;
      }) => ({
        key: m.key,
        value: m.value,
        category: m.category,
        updatedAt: m.updated_at,
      })
    ),
  };
}

async function executeUpdateMySettings(
  args: Record<string, unknown>,
  userId: string,
  supabase: SupabaseClient
) {
  // Build update payload — only include non-null fields
  const updates: Record<string, string> = {};
  const fields = [
    'name',
    'tone',
    'personality',
    'boundaries',
    'vibe',
    'chat_tone',
  ] as const;

  for (const field of fields) {
    const value = args[field];
    if (typeof value === 'string') {
      updates[field] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return { success: true, message: 'No settings to update' };
  }

  // Upsert: create if not exists, update if exists
  const { error } = await supabase
    .from('mira_soul')
    .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' });

  if (error) return { error: error.message };

  const changedFields = Object.keys(updates).join(', ');
  return {
    success: true,
    message: `Settings updated: ${changedFields}`,
    updated: updates,
  };
}
