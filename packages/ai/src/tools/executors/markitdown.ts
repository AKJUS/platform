import { createAdminClient } from '@tuturuuu/supabase/next/server';
import { checkAiCredits } from '../../credits/check-credits';
import type { MiraToolContext } from '../mira-tools';

const MARKITDOWN_COST_CREDITS = 100;
const CREDIT_FEATURE = 'chat' as const;
const CREDIT_CHECK_MODEL = 'google/gemini-2.5-flash';
const MARKITDOWN_LEDGER_MODEL = 'markitdown/conversion';

type BalanceRow = {
  id: string;
  ws_id: string | null;
  user_id: string | null;
  total_allocated: number | string | null;
  total_used: number | string | null;
  bonus_credits: number | string | null;
};

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

  const { data: balanceRows, error: balanceError } = await sbAdmin.rpc(
    'get_or_create_credit_balance',
    { p_ws_id: ctx.wsId, p_user_id: ctx.userId }
  );

  if (balanceError) {
    console.error('MarkItDown: failed to load credit balance:', balanceError);
    return { ok: false, error: 'Failed to load AI credit balance.' };
  }

  const balance = (
    Array.isArray(balanceRows) ? balanceRows[0] : balanceRows
  ) as BalanceRow | null;

  if (!balance) {
    return { ok: false, error: 'No AI credit balance available.' };
  }

  const totalAllocated = Number(balance.total_allocated ?? 0);
  const totalUsed = Number(balance.total_used ?? 0);
  const bonusCredits = Number(balance.bonus_credits ?? 0);
  const remainingBefore = totalAllocated + bonusCredits - totalUsed;

  if (remainingBefore < MARKITDOWN_COST_CREDITS) {
    return {
      ok: false,
      error: `Insufficient credits. This conversion needs ${MARKITDOWN_COST_CREDITS} credits.`,
    };
  }

  const newTotalUsed = totalUsed + MARKITDOWN_COST_CREDITS;

  const { error: updateError } = await sbAdmin
    .from('workspace_ai_credit_balances')
    .update({
      total_used: newTotalUsed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', balance.id);

  if (updateError) {
    console.error('MarkItDown: failed to update credit balance:', updateError);
    return { ok: false, error: 'Failed to deduct AI credits.' };
  }

  const { error: txError } = await sbAdmin
    .from('ai_credit_transactions')
    .insert({
      ws_id: balance.ws_id ? ctx.wsId : null,
      user_id: ctx.userId,
      balance_id: balance.id,
      transaction_type: 'deduction',
      amount: -MARKITDOWN_COST_CREDITS,
      model_id: MARKITDOWN_LEDGER_MODEL,
      feature: CREDIT_FEATURE,
      metadata: {
        ...metadata,
        fixedCredits: MARKITDOWN_COST_CREDITS,
        source: 'markitdown_tool',
      },
    });

  if (txError) {
    console.error('MarkItDown: failed to insert credit transaction:', txError);

    // Best-effort rollback.
    await sbAdmin
      .from('workspace_ai_credit_balances')
      .update({
        total_used: totalUsed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', balance.id);

    return { ok: false, error: 'Failed to record AI credit deduction.' };
  }

  return {
    ok: true,
    remainingCredits: totalAllocated + bonusCredits - newTotalUsed,
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

  const conversionResponse = await fetch(markitdownUrl, {
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
  });

  if (!conversionResponse.ok) {
    const body = await conversionResponse.text().catch(() => '');
    return {
      ok: false,
      error:
        body ||
        `MarkItDown conversion failed with status ${conversionResponse.status}.`,
    };
  }

  const payload = (await conversionResponse.json()) as {
    ok?: boolean;
    markdown?: unknown;
    title?: unknown;
  };
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
