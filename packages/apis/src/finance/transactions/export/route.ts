import { resolveAuthenticatedSessionUser } from '@tuturuuu/supabase/next/auth-session-user';
import {
  createAdminClient,
  createClient,
} from '@tuturuuu/supabase/next/server';
import {
  getPermissions,
  normalizeWorkspaceId,
} from '@tuturuuu/utils/workspace-helper';
import { NextResponse } from 'next/server';

interface Params {
  params: Promise<{
    wsId: string;
  }>;
}

type ExportTransactionRow = {
  id: string;
  amount: number | null;
  description: string | null;
  category_name: string | null;
  created_at: string | null;
  creator_email: string | null;
  creator_full_name: string | null;
  invoice_id: string | null;
  report_opt_in: boolean | null;
  taken_at: string | null;
  total_count: number | null;
  wallet_name: string | null;
};

type ExportTransactionTagRow = {
  transaction_id: string;
  transaction_tags: { name: string | null } | { name: string | null }[] | null;
};

type ExportInvoiceCustomerRow = {
  id: string;
  transaction_id: string | null;
  workspace_users:
    | {
        display_name: string | null;
        full_name: string | null;
        email: string | null;
      }
    | {
        display_name: string | null;
        full_name: string | null;
        email: string | null;
      }[]
    | null;
};

function getStringArray(searchParams: URLSearchParams, key: string) {
  return searchParams
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

function getPositiveInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function firstOrNull<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function getTransactionType(amount: number | null) {
  if (amount === null) {
    return null;
  }

  return amount < 0 ? 'expense' : 'income';
}

export async function GET(req: Request, { params }: Params) {
  const { wsId } = await params;
  const supabase = await createClient(req);
  const normalizedWsId = await normalizeWorkspaceId(wsId, supabase);

  const permissions = await getPermissions({
    wsId,
    request: req,
  });

  if (!permissions) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { withoutPermission } = permissions;

  if (
    withoutPermission('view_transactions') ||
    withoutPermission('export_finance_data')
  ) {
    return NextResponse.json(
      { message: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  const { user } = await resolveAuthenticatedSessionUser(supabase);

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = getPositiveInteger(searchParams.get('page'), 1);
  const pageSize = Math.min(
    getPositiveInteger(searchParams.get('pageSize'), 1000),
    1000
  );
  const offset = (page - 1) * pageSize;

  const walletIds = getStringArray(searchParams, 'walletIds');
  const categoryIds = getStringArray(searchParams, 'categoryIds');
  const userIds = getStringArray(searchParams, 'userIds');
  const tagIds = getStringArray(searchParams, 'tagIds');
  const q = searchParams.get('q')?.trim();
  const start = searchParams.get('start')?.trim();
  const end = searchParams.get('end')?.trim();

  const { data: rawTransactions, error } = await supabase.rpc(
    'get_wallet_transactions_with_permissions',
    {
      p_ws_id: normalizedWsId,
      p_user_id: user.id,
      p_wallet_ids: walletIds.length > 0 ? walletIds : undefined,
      p_category_ids: categoryIds.length > 0 ? categoryIds : undefined,
      p_creator_ids: userIds.length > 0 ? userIds : undefined,
      p_tag_ids: tagIds.length > 0 ? tagIds : undefined,
      p_search_query: q || undefined,
      p_start_date: start || undefined,
      p_end_date: end || undefined,
      p_order_by: 'taken_at',
      p_order_direction: 'DESC',
      p_limit: pageSize,
      p_offset: offset,
      p_include_count: true,
    }
  );

  if (error) {
    console.error('Error fetching transaction export rows:', error);
    return NextResponse.json(
      { message: 'Error fetching transaction export rows' },
      { status: 500 }
    );
  }

  const transactions = (rawTransactions ?? []) as ExportTransactionRow[];
  const transactionIds = transactions.map((transaction) => transaction.id);
  const invoiceIds = [
    ...new Set(
      transactions
        .map((transaction) => transaction.invoice_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const sbAdmin = await createAdminClient();
  const [tagResult, invoiceResult] = await Promise.all([
    transactionIds.length > 0
      ? sbAdmin
          .from('wallet_transaction_tags')
          .select('transaction_id, transaction_tags(name)')
          .in('transaction_id', transactionIds)
          .returns<ExportTransactionTagRow[]>()
      : Promise.resolve({ data: [], error: null }),
    invoiceIds.length > 0
      ? sbAdmin
          .from('finance_invoices')
          .select(
            'id, transaction_id, workspace_users!finance_invoices_customer_id_fkey(display_name, full_name, email)'
          )
          .eq('ws_id', normalizedWsId)
          .in('id', invoiceIds)
          .returns<ExportInvoiceCustomerRow[]>()
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (tagResult.error) {
    console.error('Error fetching transaction export tags:', tagResult.error);
    return NextResponse.json(
      { message: 'Error fetching transaction export tags' },
      { status: 500 }
    );
  }

  if (invoiceResult.error) {
    console.error(
      'Error fetching transaction export invoice customers:',
      invoiceResult.error
    );
    return NextResponse.json(
      { message: 'Error fetching transaction export invoice customers' },
      { status: 500 }
    );
  }

  const tagNamesByTransactionId = new Map<string, string[]>();

  for (const row of tagResult.data ?? []) {
    const relatedTags = Array.isArray(row.transaction_tags)
      ? row.transaction_tags
      : [row.transaction_tags];
    const tagNames = relatedTags
      .map((tag) => tag?.name)
      .filter((name): name is string => Boolean(name));

    if (tagNames.length === 0) {
      continue;
    }

    const existing = tagNamesByTransactionId.get(row.transaction_id) ?? [];
    tagNamesByTransactionId.set(row.transaction_id, [...existing, ...tagNames]);
  }

  const invoicesById = new Map<string, ExportInvoiceCustomerRow>();
  const invoicesByTransactionId = new Map<string, ExportInvoiceCustomerRow>();

  for (const invoice of invoiceResult.data ?? []) {
    invoicesById.set(invoice.id, invoice);

    if (invoice.transaction_id) {
      invoicesByTransactionId.set(invoice.transaction_id, invoice);
    }
  }

  const data = transactions.map((transaction) => {
    const invoice =
      (transaction.invoice_id
        ? invoicesById.get(transaction.invoice_id)
        : undefined) ?? invoicesByTransactionId.get(transaction.id);
    const invoiceCustomer = firstOrNull(invoice?.workspace_users);
    const tagNames = tagNamesByTransactionId.get(transaction.id) ?? [];

    return {
      amount: transaction.amount ?? null,
      description: transaction.description ?? null,
      category: transaction.category_name ?? null,
      transaction_type: getTransactionType(transaction.amount),
      wallet: transaction.wallet_name ?? null,
      tags: tagNames.length > 0 ? tagNames.join(', ') : null,
      taken_at: transaction.taken_at ?? null,
      created_at: transaction.created_at ?? null,
      report_opt_in: transaction.report_opt_in ?? null,
      creator_name: transaction.creator_full_name ?? null,
      creator_email: transaction.creator_email ?? null,
      invoice_for_name:
        invoiceCustomer?.display_name || invoiceCustomer?.full_name || null,
      invoice_for_email: invoiceCustomer?.email ?? null,
    };
  });

  return NextResponse.json({
    data,
    count: transactions[0]?.total_count ?? 0,
  });
}
