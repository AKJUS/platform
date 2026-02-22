import type { MiraToolContext } from '../mira-tools';

// ── Workspace default currency ──

export async function executeSetDefaultCurrency(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const currency = (args.currency as string).toUpperCase();

  const { error } = await ctx.supabase.from('workspace_configs').upsert(
    {
      id: 'DEFAULT_CURRENCY',
      ws_id: ctx.wsId,
      value: currency,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'ws_id,id' }
  );

  if (error) return { error: error.message };
  return {
    success: true,
    message: `Default workspace currency set to ${currency}`,
    currency,
  };
}

export async function executeLogTransaction(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const amount = args.amount as number;
  let walletId = args.walletId as string | null;

  if (!walletId) {
    const { data: wallet } = await ctx.supabase
      .from('workspace_wallets')
      .select('id')
      .eq('ws_id', ctx.wsId)
      .limit(1)
      .single();

    if (!wallet) return { error: 'No wallet found in workspace' };
    walletId = wallet.id;
  }

  const { data: tx, error } = await ctx.supabase
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

export async function executeGetSpendingSummary(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const days = (args.days as number) || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: wallets } = await ctx.supabase
    .from('workspace_wallets')
    .select('id, name, currency, balance')
    .eq('ws_id', ctx.wsId);

  if (!wallets?.length)
    return { wallets: [], totalIncome: 0, totalExpenses: 0, net: 0 };

  type Wallet = { id: string; name: string; currency: string; balance: number };
  const walletIds = (wallets as Wallet[]).map((w) => w.id);

  const { data: transactions } = await ctx.supabase
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
    wallets: (wallets as Wallet[]).map((w) => ({
      id: w.id,
      name: w.name,
      currency: w.currency,
      balance: w.balance,
    })),
  };
}

// ── New CRUD tools ──

export async function executeListWallets(
  _args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const { data, error } = await ctx.supabase
    .from('workspace_wallets')
    .select('id, name, currency, balance, type, created_at')
    .eq('ws_id', ctx.wsId)
    .order('created_at', { ascending: true });

  if (error) return { error: error.message };
  return { count: data?.length ?? 0, wallets: data ?? [] };
}

export async function executeCreateWallet(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const insertData: Record<string, unknown> = {
    name: args.name as string,
    ws_id: ctx.wsId,
  };
  if (args.currency) insertData.currency = args.currency;
  if (args.balance !== undefined) insertData.balance = args.balance;
  if (args.type) insertData.type = args.type;

  const { data, error } = await ctx.supabase
    .from('workspace_wallets')
    .insert(insertData)
    .select('id, name, currency, balance')
    .single();

  if (error) return { error: error.message };
  return {
    success: true,
    message: `Wallet "${args.name}" created`,
    wallet: data,
  };
}

export async function executeUpdateWallet(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const walletId = args.walletId as string;
  const updates: Record<string, unknown> = {};

  if (args.name !== undefined) updates.name = args.name;
  if (args.currency !== undefined) updates.currency = args.currency;
  if (args.balance !== undefined) updates.balance = args.balance;

  if (Object.keys(updates).length === 0) {
    return { success: true, message: 'No fields to update' };
  }

  const { error } = await ctx.supabase
    .from('workspace_wallets')
    .update(updates)
    .eq('id', walletId)
    .eq('ws_id', ctx.wsId);

  if (error) return { error: error.message };
  return { success: true, message: `Wallet ${walletId} updated` };
}

export async function executeDeleteWallet(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const walletId = args.walletId as string;

  const { error } = await ctx.supabase
    .from('workspace_wallets')
    .delete()
    .eq('id', walletId)
    .eq('ws_id', ctx.wsId);

  if (error) return { error: error.message };
  return { success: true, message: `Wallet ${walletId} deleted` };
}

export async function executeListTransactions(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const limit = (args.limit as number) || 50;

  // Get all wallet IDs in workspace to scope query
  const { data: wallets } = await ctx.supabase
    .from('workspace_wallets')
    .select('id')
    .eq('ws_id', ctx.wsId);

  if (!wallets?.length) return { count: 0, transactions: [] };

  const walletIds = wallets.map((w: { id: string }) => w.id);

  let query = ctx.supabase
    .from('wallet_transactions')
    .select('id, amount, description, taken_at, wallet_id, category_id')
    .in('wallet_id', walletIds)
    .order('taken_at', { ascending: false })
    .limit(limit);

  if (args.walletId) query = query.eq('wallet_id', args.walletId as string);
  if (args.categoryId)
    query = query.eq('category_id', args.categoryId as string);
  if (args.days) {
    const since = new Date();
    since.setDate(since.getDate() - (args.days as number));
    query = query.gte('taken_at', since.toISOString());
  }

  const { data, error } = await query;

  if (error) return { error: error.message };
  return { count: data?.length ?? 0, transactions: data ?? [] };
}

export async function executeGetTransaction(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const transactionId = args.transactionId as string;

  const { data, error } = await ctx.supabase
    .from('wallet_transactions')
    .select('id, amount, description, taken_at, wallet_id, category_id')
    .eq('id', transactionId)
    .single();

  if (error) return { error: error.message };
  return { transaction: data };
}

export async function executeUpdateTransaction(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const transactionId = args.transactionId as string;
  const updates: Record<string, unknown> = {};

  if (args.amount !== undefined) updates.amount = args.amount;
  if (args.description !== undefined) updates.description = args.description;
  if (args.categoryId !== undefined) updates.category_id = args.categoryId;

  if (Object.keys(updates).length === 0) {
    return { success: true, message: 'No fields to update' };
  }

  const { error } = await ctx.supabase
    .from('wallet_transactions')
    .update(updates)
    .eq('id', transactionId);

  if (error) return { error: error.message };
  return { success: true, message: `Transaction ${transactionId} updated` };
}

export async function executeDeleteTransaction(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const transactionId = args.transactionId as string;

  const { error } = await ctx.supabase
    .from('wallet_transactions')
    .delete()
    .eq('id', transactionId);

  if (error) return { error: error.message };
  return { success: true, message: `Transaction ${transactionId} deleted` };
}

export async function executeListTransactionCategories(
  _args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const { data, error } = await ctx.supabase
    .from('transaction_categories')
    .select('id, name, is_expense, ws_id')
    .eq('ws_id', ctx.wsId);

  if (error) return { error: error.message };
  return { count: data?.length ?? 0, categories: data ?? [] };
}

export async function executeCreateTransactionCategory(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const { data, error } = await ctx.supabase
    .from('transaction_categories')
    .insert({
      name: args.name as string,
      is_expense: (args.isExpense as boolean) ?? true,
      ws_id: ctx.wsId,
    })
    .select('id, name, is_expense')
    .single();

  if (error) return { error: error.message };
  return {
    success: true,
    message: `Category "${args.name}" created`,
    category: data,
  };
}

export async function executeUpdateTransactionCategory(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const categoryId = args.categoryId as string;
  const updates: Record<string, unknown> = {};

  if (args.name !== undefined) updates.name = args.name;
  if (args.isExpense !== undefined) updates.is_expense = args.isExpense;

  if (Object.keys(updates).length === 0) {
    return { success: true, message: 'No fields to update' };
  }

  const { error } = await ctx.supabase
    .from('transaction_categories')
    .update(updates)
    .eq('id', categoryId)
    .eq('ws_id', ctx.wsId);

  if (error) return { error: error.message };
  return { success: true, message: `Category ${categoryId} updated` };
}

export async function executeDeleteTransactionCategory(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const categoryId = args.categoryId as string;

  const { error } = await ctx.supabase
    .from('transaction_categories')
    .delete()
    .eq('id', categoryId)
    .eq('ws_id', ctx.wsId);

  if (error) return { error: error.message };
  return { success: true, message: `Category ${categoryId} deleted` };
}

export async function executeListTransactionTags(
  _args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const { data, error } = await ctx.supabase
    .from('transaction_tags')
    .select('id, name, color, description, ws_id')
    .eq('ws_id', ctx.wsId);

  if (error) return { error: error.message };
  return { count: data?.length ?? 0, tags: data ?? [] };
}

export async function executeCreateTransactionTag(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const insertData: Record<string, unknown> = {
    name: args.name as string,
    ws_id: ctx.wsId,
  };
  if (args.color) insertData.color = args.color;
  if (args.description) insertData.description = args.description;

  const { data, error } = await ctx.supabase
    .from('transaction_tags')
    .insert(insertData)
    .select('id, name, color')
    .single();

  if (error) return { error: error.message };
  return { success: true, message: `Tag "${args.name}" created`, tag: data };
}

export async function executeUpdateTransactionTag(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const tagId = args.tagId as string;
  const updates: Record<string, unknown> = {};

  if (args.name !== undefined) updates.name = args.name;
  if (args.color !== undefined) updates.color = args.color;
  if (args.description !== undefined) updates.description = args.description;

  if (Object.keys(updates).length === 0) {
    return { success: true, message: 'No fields to update' };
  }

  const { error } = await ctx.supabase
    .from('transaction_tags')
    .update(updates)
    .eq('id', tagId)
    .eq('ws_id', ctx.wsId);

  if (error) return { error: error.message };
  return { success: true, message: `Tag ${tagId} updated` };
}

export async function executeDeleteTransactionTag(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const tagId = args.tagId as string;

  const { error } = await ctx.supabase
    .from('transaction_tags')
    .delete()
    .eq('id', tagId)
    .eq('ws_id', ctx.wsId);

  if (error) return { error: error.message };
  return { success: true, message: `Tag ${tagId} deleted` };
}
