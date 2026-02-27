import { createAdminClient } from '@tuturuuu/supabase/next/server';
import { checkAiCredits } from '../../credits/check-credits';
import type { MiraToolContext } from '../mira-tools';

const MARKITDOWN_COST_CREDITS = 100;
const CREDIT_FEATURE = 'chat' as const;
const CREDIT_CHECK_MODEL = 'google/gemini-2.5-flash';
const MARKITDOWN_LEDGER_MODEL = 'markitdown/conversion';

function stripTimestampPrefix(name: string): string {
  const match = name.match(/^\d+_(.+)$/);
  return match?.[1] ?? name;
}

function resolveDiscordMarkitdownUrl(): string | null {
  const deploymentUrl = process.env.DISCORD_APP_DEPLOYMENT_URL?.trim();
  if (!deploymentUrl) return null;
  return `${deploymentUrl.replace(/\/$/, '')}/markitdown`;
}

function resolveDiscordMarkitdownSecret(): string | null {
  return (
    process.env.MARKITDOWN_ENDPOINT_SECRET?.trim() ||
    process.env.VERCEL_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    null
  );
}

async function deductFixedMarkitdownCredits(
  ctx: MiraToolContext,
  metadata: Record<string, unknown>
): Promise<
  { ok: true; remainingCredits: number } | { ok: false; error: string }
> {
  const sbAdmin = await createAdminClient();
  const { data, error } = await (
    sbAdmin.rpc as unknown as (
      fn: string,
      params: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  )('deduct_fixed_ai_credits', {
    p_ws_id: ctx.wsId,
    p_user_id: ctx.userId,
    p_amount: MARKITDOWN_COST_CREDITS,
    p_model_id: MARKITDOWN_LEDGER_MODEL,
    p_feature: CREDIT_FEATURE,
    p_metadata: {
      ...metadata,
      fixedCredits: MARKITDOWN_COST_CREDITS,
      source: 'markitdown_tool',
    },
  });

  if (error) {
    console.error('MarkItDown: failed to deduct credits atomically:', error);
    return { ok: false, error: 'Failed to deduct AI credits.' };
  }

  const row = (Array.isArray(data) ? data[0] : data) as {
    success?: boolean;
    remaining_credits?: number | string;
    error_code?: string | null;
  } | null;

  if (!row?.success) {
    if (row?.error_code === 'INSUFFICIENT_CREDITS') {
      return {
        ok: false,
        error: `Insufficient credits. This conversion needs ${MARKITDOWN_COST_CREDITS} credits.`,
      };
    }
    return { ok: false, error: 'Failed to deduct AI credits.' };
  }

  return {
    ok: true,
    remainingCredits: Number(row.remaining_credits ?? 0),
  };
}

export async function executeConvertFileToMarkdown(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const markitdownUrl = resolveDiscordMarkitdownUrl();
  const markitdownSecret = resolveDiscordMarkitdownSecret();

  if (!markitdownUrl) {
    return {
      ok: false,
      error:
        'MarkItDown endpoint is not configured. Missing DISCORD_APP_DEPLOYMENT_URL.',
    };
  }

  if (!markitdownSecret) {
    return {
      ok: false,
      error:
        'MarkItDown endpoint secret is not configured. Set MARKITDOWN_ENDPOINT_SECRET or CRON secret.',
    };
  }

  const storagePathArg =
    typeof args.storagePath === 'string' ? args.storagePath.trim() : '';
  const fileNameArg =
    typeof args.fileName === 'string' ? args.fileName.trim() : '';
  const maxCharactersRaw =
    typeof args.maxCharacters === 'number' &&
    Number.isFinite(args.maxCharacters)
      ? Math.floor(args.maxCharacters)
      : 120_000;
  const maxCharacters = Math.min(Math.max(maxCharactersRaw, 2_000), 300_000);

  const expectedPrefix = `${ctx.wsId}/chats/ai/resources/`;
  let targetPath = storagePathArg;
  let selectedFileName = '';

  const sbAdmin = await createAdminClient();

  if (targetPath) {
    if (!targetPath.startsWith(expectedPrefix) || targetPath.includes('..')) {
      return { ok: false, error: 'Invalid storagePath for current workspace.' };
    }
    selectedFileName = targetPath.split('/').pop() ?? targetPath;
  } else {
    if (!ctx.chatId) {
      return {
        ok: false,
        error:
          'No file specified and chat context is missing. Provide `storagePath`.',
      };
    }

    const chatFolder = `${ctx.wsId}/chats/ai/resources/${ctx.chatId}`;
    const { data: listedFiles, error: listError } = await sbAdmin.storage
      .from('workspaces')
      .list(chatFolder, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (listError) {
      return {
        ok: false,
        error: `Failed to list chat files: ${listError.message}`,
      };
    }

    const realFiles = (listedFiles ?? []).filter(
      (entry) => entry.id != null && entry.name !== '.emptyFolderPlaceholder'
    );

    if (realFiles.length === 0) {
      return { ok: false, error: 'No files found in this chat.' };
    }

    const pickedFile = fileNameArg
      ? realFiles.find(
          (entry) =>
            entry.name.toLowerCase() === fileNameArg.toLowerCase() ||
            stripTimestampPrefix(entry.name).toLowerCase() ===
              fileNameArg.toLowerCase()
        )
      : realFiles[0];

    if (!pickedFile) {
      return {
        ok: false,
        error: `File "${fileNameArg}" was not found in this chat.`,
      };
    }

    selectedFileName = pickedFile.name;
    targetPath = `${chatFolder}/${pickedFile.name}`;
  }

  const creditCheck = await checkAiCredits(
    ctx.wsId,
    CREDIT_CHECK_MODEL,
    CREDIT_FEATURE,
    { userId: ctx.userId }
  );

  if (!creditCheck.allowed) {
    return {
      ok: false,
      error:
        creditCheck.errorMessage ??
        'AI credits are not available for this conversion.',
    };
  }

  if (creditCheck.remainingCredits < MARKITDOWN_COST_CREDITS) {
    return {
      ok: false,
      error: `Insufficient credits. This conversion needs ${MARKITDOWN_COST_CREDITS} credits.`,
    };
  }

  const { data: signedReadData, error: signedReadError } = await sbAdmin.storage
    .from('workspaces')
    .createSignedUrl(targetPath, 120);

  const signedReadUrl = signedReadData?.signedUrl;

  if (signedReadError || !signedReadUrl) {
    return {
      ok: false,
      error: `Failed to create signed download URL: ${signedReadError?.message ?? 'No URL returned'}`,
    };
  }

  const markitdownTimeoutMs = Number(
    process.env.MARKITDOWN_TIMEOUT_MS ?? 30000
  );
  const abortController = new AbortController();
  const timeoutId = setTimeout(
    () => abortController.abort(),
    markitdownTimeoutMs
  );

  let conversionResponse: Response;
  try {
    conversionResponse = await fetch(markitdownUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${markitdownSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signed_url: signedReadUrl,
        filename: stripTimestampPrefix(selectedFileName),
        enable_plugins: true,
      }),
      signal: abortController.signal,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? `MarkItDown conversion timed out after ${markitdownTimeoutMs}ms.`
        : 'Failed to reach MarkItDown conversion service.';
    console.error('MarkItDown conversion request failed:', error);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeoutId);
  }

  if (!conversionResponse.ok) {
    const rawBody = await conversionResponse.text().catch(() => '');
    const safeMessage = rawBody.replace(/\s+/g, ' ').trim().slice(0, 300);
    console.error('MarkItDown conversion failed:', {
      status: conversionResponse.status,
      body: safeMessage,
    });
    return {
      ok: false,
      error: `MarkItDown conversion failed (status ${conversionResponse.status}).`,
    };
  }

  let payload: { ok?: boolean; markdown?: unknown; title?: unknown };
  try {
    payload = (await conversionResponse.json()) as {
      ok?: boolean;
      markdown?: unknown;
      title?: unknown;
    };
  } catch (error) {
    console.error('MarkItDown returned invalid JSON response:', error);
    return { ok: false, error: 'MarkItDown conversion failed.' };
  }
  const markdown =
    typeof payload.markdown === 'string' ? payload.markdown.trim() : '';

  if (!markdown) {
    return { ok: false, error: 'MarkItDown returned empty markdown.' };
  }

  const wasTruncated = markdown.length > maxCharacters;
  const finalMarkdown = wasTruncated
    ? `${markdown.slice(0, maxCharacters)}\n\n[...truncated for token safety...]`
    : markdown;

  const deduction = await deductFixedMarkitdownCredits(ctx, {
    targetPath,
    selectedFileName: stripTimestampPrefix(selectedFileName),
    markdownLength: markdown.length,
    maxCharacters,
    truncated: wasTruncated,
  });

  if (!deduction.ok) {
    return { ok: false, error: deduction.error };
  }

  return {
    ok: true,
    markdown: finalMarkdown,
    title: typeof payload.title === 'string' ? payload.title : null,
    fileName: stripTimestampPrefix(selectedFileName),
    storagePath: targetPath,
    creditsCharged: MARKITDOWN_COST_CREDITS,
    remainingCredits: deduction.remainingCredits,
    truncated: wasTruncated,
  };
}
