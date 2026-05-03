-- Add income/expense transaction type filtering to transaction list RPCs.

DROP FUNCTION IF EXISTS public.get_transaction_stats(
  uuid,
  uuid,
  uuid[],
  uuid[],
  uuid[],
  uuid[],
  text,
  timestamp with time zone,
  timestamp with time zone
);

CREATE OR REPLACE FUNCTION public.get_transaction_stats(
  p_ws_id uuid,
  p_user_id uuid DEFAULT auth.uid(),
  p_wallet_ids uuid[] DEFAULT NULL,
  p_category_ids uuid[] DEFAULT NULL,
  p_creator_ids uuid[] DEFAULT NULL,
  p_tag_ids uuid[] DEFAULT NULL,
  p_transaction_type text DEFAULT NULL,
  p_search_query text DEFAULT NULL,
  p_start_date timestamp with time zone DEFAULT NULL,
  p_end_date timestamp with time zone DEFAULT NULL
)
RETURNS TABLE (
  total_transactions bigint,
  total_income numeric,
  total_expense numeric,
  net_total numeric,
  has_redacted_amounts boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_can_view_transactions boolean;
  v_can_view_expenses boolean;
  v_can_view_incomes boolean;
  v_can_view_amount boolean;
  v_has_manage_finance boolean;
  v_has_granular_permissions boolean;
  v_allowed_wallet_ids uuid[];
BEGIN
  IF p_transaction_type NOT IN ('income', 'expense') THEN
    p_transaction_type := NULL;
  END IF;

  v_can_view_transactions := public.has_workspace_permission(p_ws_id, p_user_id, 'view_transactions');
  v_can_view_expenses := public.has_workspace_permission(p_ws_id, p_user_id, 'view_expenses');
  v_can_view_incomes := public.has_workspace_permission(p_ws_id, p_user_id, 'view_incomes');
  v_can_view_amount := public.has_workspace_permission(p_ws_id, p_user_id, 'view_confidential_amount');
  v_has_manage_finance := public.has_workspace_permission(p_ws_id, p_user_id, 'manage_finance');
  v_has_granular_permissions := v_can_view_expenses OR v_can_view_incomes;

  IF NOT v_has_manage_finance THEN
    SELECT array_agg(DISTINCT wrww.wallet_id)
    INTO v_allowed_wallet_ids
    FROM public.workspace_role_wallet_whitelist wrww
    JOIN public.workspace_role_members wrm ON wrm.role_id = wrww.role_id
    JOIN public.workspace_roles wr ON wr.id = wrww.role_id
    WHERE wr.ws_id = p_ws_id AND wrm.user_id = p_user_id;

    IF v_allowed_wallet_ids IS NULL THEN
      RETURN QUERY SELECT 0::bigint, 0::numeric, 0::numeric, 0::numeric, false;
      RETURN;
    END IF;

    IF p_wallet_ids IS NOT NULL THEN
      p_wallet_ids := (
        SELECT array_agg(u)
        FROM unnest(p_wallet_ids) AS u
        WHERE u = ANY(v_allowed_wallet_ids)
      );
      IF p_wallet_ids IS NULL OR array_length(p_wallet_ids, 1) IS NULL THEN
        RETURN QUERY SELECT 0::bigint, 0::numeric, 0::numeric, 0::numeric, false;
        RETURN;
      END IF;
    ELSE
      p_wallet_ids := v_allowed_wallet_ids;
    END IF;
  END IF;

  RETURN QUERY
  WITH filtered_data AS (
    SELECT
      wt.amount,
      wt.is_amount_confidential
    FROM public.wallet_transactions wt
    JOIN public.workspace_wallets ww ON wt.wallet_id = ww.id
    WHERE ww.ws_id = p_ws_id
      AND (v_has_manage_finance OR wt.wallet_id = ANY(v_allowed_wallet_ids))
      AND (
        (NOT v_has_granular_permissions AND v_can_view_transactions)
        OR (v_can_view_expenses AND wt.amount < 0)
        OR (v_can_view_incomes AND wt.amount > 0)
      )
      AND (
        p_transaction_type IS NULL
        OR (p_transaction_type = 'income' AND wt.amount > 0)
        OR (p_transaction_type = 'expense' AND wt.amount < 0)
      )
      AND (p_wallet_ids IS NULL OR wt.wallet_id = ANY(p_wallet_ids))
      AND (p_category_ids IS NULL OR wt.category_id = ANY(p_category_ids))
      AND (p_creator_ids IS NULL OR (wt.creator_id = ANY(p_creator_ids) OR wt.platform_creator_id = ANY(p_creator_ids)))
      AND (p_start_date IS NULL OR wt.taken_at >= p_start_date)
      AND (p_end_date IS NULL OR wt.taken_at <= p_end_date)
      AND (p_search_query IS NULL OR wt.description ILIKE '%' || p_search_query || '%')
      AND (p_tag_ids IS NULL OR EXISTS (
        SELECT 1 FROM public.wallet_transaction_tags wtt
        WHERE wtt.transaction_id = wt.id AND wtt.tag_id = ANY(p_tag_ids)
      ))
  )
  SELECT
    COUNT(*) as total_transactions,
    COALESCE(SUM(CASE WHEN amount > 0 AND (NOT is_amount_confidential OR v_can_view_amount) THEN amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN amount < 0 AND (NOT is_amount_confidential OR v_can_view_amount) THEN amount ELSE 0 END), 0) as total_expense,
    COALESCE(SUM(CASE WHEN NOT is_amount_confidential OR v_can_view_amount THEN amount ELSE 0 END), 0) as net_total,
    EXISTS (SELECT 1 FROM filtered_data WHERE is_amount_confidential AND NOT v_can_view_amount) as has_redacted_amounts
  FROM filtered_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_transaction_stats(
  uuid,
  uuid,
  uuid[],
  uuid[],
  uuid[],
  uuid[],
  text,
  text,
  timestamp with time zone,
  timestamp with time zone
) TO authenticated;

DROP FUNCTION IF EXISTS public.get_wallet_transactions_with_permissions(
  uuid,
  uuid,
  uuid[],
  uuid[],
  uuid[],
  uuid[],
  uuid[],
  text,
  timestamp with time zone,
  timestamp with time zone,
  text,
  text,
  integer,
  integer,
  timestamp with time zone,
  timestamp with time zone,
  boolean
);

CREATE OR REPLACE FUNCTION public.get_wallet_transactions_with_permissions(
  p_ws_id uuid,
  p_user_id uuid DEFAULT auth.uid(),
  p_transaction_ids uuid[] DEFAULT NULL,
  p_wallet_ids uuid[] DEFAULT NULL,
  p_category_ids uuid[] DEFAULT NULL,
  p_creator_ids uuid[] DEFAULT NULL,
  p_tag_ids uuid[] DEFAULT NULL,
  p_transaction_type text DEFAULT NULL,
  p_search_query text DEFAULT NULL,
  p_start_date timestamp with time zone DEFAULT NULL,
  p_end_date timestamp with time zone DEFAULT NULL,
  p_order_by text DEFAULT 'taken_at',
  p_order_direction text DEFAULT 'DESC',
  p_limit integer DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_cursor_taken_at timestamp with time zone DEFAULT NULL,
  p_cursor_created_at timestamp with time zone DEFAULT NULL,
  p_include_count boolean DEFAULT FALSE
)
RETURNS TABLE (
  id uuid,
  amount numeric,
  category_id uuid,
  category_name text,
  category_icon text,
  category_color text,
  created_at timestamp with time zone,
  creator_id uuid,
  platform_creator_id uuid,
  description text,
  invoice_id uuid,
  report_opt_in boolean,
  taken_at timestamp with time zone,
  wallet_id uuid,
  wallet_name text,
  creator_full_name text,
  creator_email text,
  creator_avatar_url text,
  is_amount_confidential boolean,
  is_description_confidential boolean,
  is_category_confidential boolean,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  can_view_transactions boolean;
  can_view_expenses boolean;
  can_view_incomes boolean;
  can_view_amount boolean;
  can_view_description boolean;
  can_view_category boolean;
  has_manage_finance boolean;
  has_granular_permissions boolean;
  v_total_count bigint := NULL;
  v_order_clause text;
  v_allowed_wallet_ids uuid[];
  v_wallet_windows JSONB := '{}';
  v_filter_cte text;
BEGIN
  IF p_transaction_type NOT IN ('income', 'expense') THEN
    p_transaction_type := NULL;
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id != auth.uid() THEN
    IF NOT public.has_workspace_permission(p_ws_id, auth.uid(), 'manage_workspace_roles') THEN
      RAISE EXCEPTION 'Permission denied';
    END IF;
  END IF;

  can_view_transactions := public.has_workspace_permission(p_ws_id, p_user_id, 'view_transactions');
  can_view_expenses := public.has_workspace_permission(p_ws_id, p_user_id, 'view_expenses');
  can_view_incomes := public.has_workspace_permission(p_ws_id, p_user_id, 'view_incomes');
  can_view_amount := public.has_workspace_permission(p_ws_id, p_user_id, 'view_confidential_amount');
  can_view_description := public.has_workspace_permission(p_ws_id, p_user_id, 'view_confidential_description');
  can_view_category := public.has_workspace_permission(p_ws_id, p_user_id, 'view_confidential_category');
  has_manage_finance := public.has_workspace_permission(p_ws_id, p_user_id, 'manage_finance');
  has_granular_permissions := can_view_expenses OR can_view_incomes;

  IF NOT has_manage_finance THEN
    SELECT
      array_agg(ww.id),
      jsonb_object_agg(ww.id::text, access_data.window_start_date)
    INTO v_allowed_wallet_ids, v_wallet_windows
    FROM public.workspace_wallets ww
    JOIN (
      SELECT
        wrww.wallet_id,
        MIN(now() - (public.get_wallet_viewing_window_days(wrww.viewing_window, wrww.custom_days) || ' days')::interval) as window_start_date
      FROM public.workspace_roles wr
      JOIN public.workspace_role_members wrm ON wr.id = wrm.role_id
      JOIN public.workspace_role_wallet_whitelist wrww ON wr.id = wrww.role_id
      WHERE wr.ws_id = p_ws_id AND wrm.user_id = p_user_id
      GROUP BY wrww.wallet_id
    ) access_data ON ww.id = access_data.wallet_id
    WHERE ww.ws_id = p_ws_id;

    IF v_allowed_wallet_ids IS NULL THEN
      RETURN;
    END IF;

    IF p_wallet_ids IS NOT NULL THEN
      p_wallet_ids := (
        SELECT array_agg(u)
        FROM unnest(p_wallet_ids) AS u
        WHERE u = ANY(v_allowed_wallet_ids)
      );

      IF p_wallet_ids IS NULL OR array_length(p_wallet_ids, 1) IS NULL THEN
        RETURN;
      END IF;
    ELSE
      p_wallet_ids := v_allowed_wallet_ids;
    END IF;
  END IF;

  IF p_order_by NOT IN ('taken_at', 'created_at', 'amount') THEN
    p_order_by := 'taken_at';
  END IF;

  IF p_order_direction NOT IN ('ASC', 'DESC') THEN
    p_order_direction := 'DESC';
  END IF;

  IF p_order_by = 'taken_at' THEN
    v_order_clause := format('wt.taken_at %s, wt.created_at %s', p_order_direction, p_order_direction);
  ELSIF p_order_by = 'created_at' THEN
    v_order_clause := format('wt.created_at %s', p_order_direction);
  ELSIF p_order_by = 'amount' THEN
    v_order_clause := format('wt.amount %s, wt.taken_at %s', p_order_direction, p_order_direction);
  END IF;

  v_filter_cte := '
    WITH filtered_transactions AS (
      SELECT
        wt.id,
        wt.amount,
        wt.category_id,
        wt.created_at,
        wt.creator_id,
        wt.platform_creator_id,
        wt.description,
        wt.invoice_id,
        wt.report_opt_in,
        wt.taken_at,
        wt.wallet_id,
        wt.is_amount_confidential,
        wt.is_description_confidential,
        wt.is_category_confidential,
        ww.name as wallet_name,
        tc.name as category_name,
        tc.icon as category_icon,
        tc.color as category_color
      FROM public.wallet_transactions wt
      JOIN public.workspace_wallets ww ON wt.wallet_id = ww.id
      LEFT JOIN public.transaction_categories tc ON wt.category_id = tc.id
      WHERE ww.ws_id = $5
        AND ($18 OR (wt.wallet_id = ANY($7) AND wt.taken_at >= COALESCE(($19->>wt.wallet_id::text)::timestamptz, ''-infinity''::timestamptz)))
        AND (
          (NOT $22 AND $21)
          OR ($20 AND wt.amount < 0)
          OR ($23 AND wt.amount > 0)
        )
        AND ($6::uuid[] IS NULL OR wt.id = ANY($6))
        AND ($7::uuid[] IS NULL OR wt.wallet_id = ANY($7))
        AND ($8::uuid[] IS NULL OR wt.category_id = ANY($8))
        AND ($9::uuid[] IS NULL OR (wt.creator_id = ANY($9) OR wt.platform_creator_id = ANY($9)))
        AND ($11::timestamp with time zone IS NULL OR wt.taken_at >= $11)
        AND ($12::timestamp with time zone IS NULL OR wt.taken_at <= $12)
        AND (
          $13::text IS NULL
          OR wt.description ILIKE ''%%'' || $13 || ''%%''
        )
        AND ($10::uuid[] IS NULL OR EXISTS (
          SELECT 1 FROM public.wallet_transaction_tags wtt
          WHERE wtt.transaction_id = wt.id AND wtt.tag_id = ANY($10)
        ))
        AND (
          $24::text IS NULL
          OR ($24 = ''income'' AND wt.amount > 0)
          OR ($24 = ''expense'' AND wt.amount < 0)
        )';

  IF p_order_by = 'taken_at' THEN
    v_filter_cte := v_filter_cte || '
        AND (
          $14::timestamp with time zone IS NULL
          OR $15::timestamp with time zone IS NULL
          OR (
            wt.taken_at < $14
            OR (wt.taken_at = $14 AND wt.created_at < $15)
          )
        )';
  END IF;

  v_filter_cte := v_filter_cte || '
    )';

  IF p_include_count THEN
    EXECUTE v_filter_cte || ' SELECT COUNT(*) FROM filtered_transactions'
    INTO v_total_count
    USING
      can_view_amount,
      can_view_category,
      can_view_description,
      v_total_count,
      p_ws_id,
      p_transaction_ids,
      p_wallet_ids,
      p_category_ids,
      p_creator_ids,
      p_tag_ids,
      p_start_date,
      p_end_date,
      p_search_query,
      p_cursor_taken_at,
      p_cursor_created_at,
      p_limit,
      p_offset,
      has_manage_finance,
      v_wallet_windows,
      can_view_expenses,
      can_view_transactions,
      has_granular_permissions,
      can_view_incomes,
      p_transaction_type;
  END IF;

  RETURN QUERY EXECUTE format(v_filter_cte || '
    SELECT
      wt.id,
      CASE
        WHEN wt.is_amount_confidential AND NOT $1 THEN NULL
        ELSE wt.amount
      END AS amount,
      CASE
        WHEN wt.is_category_confidential AND NOT $2 THEN NULL
        ELSE wt.category_id
      END AS category_id,
      CASE
        WHEN wt.is_category_confidential AND NOT $2 THEN NULL
        ELSE wt.category_name
      END AS category_name,
      CASE
        WHEN wt.is_category_confidential AND NOT $2 THEN NULL
        ELSE wt.category_icon
      END AS category_icon,
      CASE
        WHEN wt.is_category_confidential AND NOT $2 THEN NULL
        ELSE wt.category_color
      END AS category_color,
      wt.created_at,
      wt.creator_id,
      wt.platform_creator_id,
      CASE
        WHEN wt.is_description_confidential AND NOT $3 THEN ''[CONFIDENTIAL]''
        ELSE wt.description
      END AS description,
      wt.invoice_id,
      wt.report_opt_in,
      wt.taken_at,
      wt.wallet_id,
      wt.wallet_name,
      COALESCE(
        u.display_name,
        upd.full_name,
        upd.email,
        wu.full_name,
        wu.email,
        u_inv.display_name,
        upd_inv.full_name,
        upd_inv.email,
        wu_inv.full_name,
        wu_inv.email
      ) as creator_full_name,
      COALESCE(
        upd.email,
        wu.email,
        upd_inv.email,
        wu_inv.email
      ) as creator_email,
      COALESCE(
        u.avatar_url,
        wu.avatar_url,
        u_inv.avatar_url,
        wu_inv.avatar_url
      ) as creator_avatar_url,
      wt.is_amount_confidential,
      wt.is_description_confidential,
      wt.is_category_confidential,
      $4::bigint AS total_count
    FROM filtered_transactions wt
    LEFT JOIN public.users u ON wt.platform_creator_id = u.id
    LEFT JOIN public.user_private_details upd ON wt.platform_creator_id = upd.user_id
    LEFT JOIN public.workspace_users wu ON wt.creator_id = wu.id
    LEFT JOIN public.finance_invoices fi ON wt.invoice_id = fi.id
    LEFT JOIN public.users u_inv ON fi.platform_creator_id = u_inv.id
    LEFT JOIN public.user_private_details upd_inv ON fi.platform_creator_id = upd_inv.user_id
    LEFT JOIN public.workspace_users wu_inv ON fi.creator_id = wu_inv.id
    ORDER BY %s
    LIMIT $16
    OFFSET $17
  ', v_order_clause)
  USING
    can_view_amount,
    can_view_category,
    can_view_description,
    v_total_count,
    p_ws_id,
    p_transaction_ids,
    p_wallet_ids,
    p_category_ids,
    p_creator_ids,
    p_tag_ids,
    p_start_date,
    p_end_date,
    p_search_query,
    p_cursor_taken_at,
    p_cursor_created_at,
    p_limit,
    p_offset,
    has_manage_finance,
    v_wallet_windows,
    can_view_expenses,
    can_view_transactions,
    has_granular_permissions,
    can_view_incomes,
    p_transaction_type;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_transactions_with_permissions(
  uuid,
  uuid,
  uuid[],
  uuid[],
  uuid[],
  uuid[],
  uuid[],
  text,
  text,
  timestamp with time zone,
  timestamp with time zone,
  text,
  text,
  integer,
  integer,
  timestamp with time zone,
  timestamp with time zone,
  boolean
) TO authenticated;

DROP FUNCTION IF EXISTS public.get_transactions_by_period(
  uuid,
  text,
  uuid,
  uuid[],
  uuid[],
  uuid[],
  uuid[],
  text,
  timestamp with time zone,
  timestamp with time zone,
  timestamp with time zone,
  integer,
  text
);

CREATE OR REPLACE FUNCTION public.get_transactions_by_period(
  p_ws_id uuid,
  p_interval text DEFAULT 'daily',
  p_user_id uuid DEFAULT auth.uid(),
  p_wallet_ids uuid[] DEFAULT NULL,
  p_category_ids uuid[] DEFAULT NULL,
  p_creator_ids uuid[] DEFAULT NULL,
  p_tag_ids uuid[] DEFAULT NULL,
  p_transaction_type text DEFAULT NULL,
  p_search_query text DEFAULT NULL,
  p_start_date timestamp with time zone DEFAULT NULL,
  p_end_date timestamp with time zone DEFAULT NULL,
  p_cursor_period_start timestamp with time zone DEFAULT NULL,
  p_limit integer DEFAULT 10,
  p_timezone text DEFAULT 'UTC'
)
RETURNS TABLE (
  period_start timestamp with time zone,
  period_end timestamp with time zone,
  total_income numeric,
  total_expense numeric,
  net_total numeric,
  transaction_count bigint,
  has_redacted_amounts boolean,
  transactions jsonb,
  has_more boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_can_view_transactions boolean;
  v_can_view_expenses boolean;
  v_can_view_incomes boolean;
  v_can_view_amount boolean;
  v_can_view_description boolean;
  v_can_view_category boolean;
  v_has_manage_finance boolean;
  v_has_granular_permissions boolean;
  v_allowed_wallet_ids uuid[];
  v_wallet_windows JSONB := '{}';
  v_trunc_interval text;
  v_interval_text text;
  v_validated_timezone text;
BEGIN
  IF p_transaction_type NOT IN ('income', 'expense') THEN
    p_transaction_type := NULL;
  END IF;

  IF p_interval NOT IN ('daily', 'weekly', 'monthly', 'yearly') THEN
    p_interval := 'daily';
  END IF;

  BEGIN
    PERFORM now() AT TIME ZONE p_timezone;
    v_validated_timezone := p_timezone;
  EXCEPTION WHEN OTHERS THEN
    v_validated_timezone := 'UTC';
  END;

  CASE p_interval
    WHEN 'daily' THEN
      v_trunc_interval := 'day';
      v_interval_text := '1 day';
    WHEN 'weekly' THEN
      v_trunc_interval := 'week';
      v_interval_text := '1 week';
    WHEN 'monthly' THEN
      v_trunc_interval := 'month';
      v_interval_text := '1 month';
    WHEN 'yearly' THEN
      v_trunc_interval := 'year';
      v_interval_text := '1 year';
  END CASE;

  IF p_user_id IS NOT NULL AND p_user_id != auth.uid() THEN
    IF NOT public.has_workspace_permission(p_ws_id, auth.uid(), 'manage_workspace_roles') THEN
      RAISE EXCEPTION 'Permission denied';
    END IF;
  END IF;

  v_can_view_transactions := public.has_workspace_permission(p_ws_id, p_user_id, 'view_transactions');
  v_can_view_expenses := public.has_workspace_permission(p_ws_id, p_user_id, 'view_expenses');
  v_can_view_incomes := public.has_workspace_permission(p_ws_id, p_user_id, 'view_incomes');
  v_can_view_amount := public.has_workspace_permission(p_ws_id, p_user_id, 'view_confidential_amount');
  v_can_view_description := public.has_workspace_permission(p_ws_id, p_user_id, 'view_confidential_description');
  v_can_view_category := public.has_workspace_permission(p_ws_id, p_user_id, 'view_confidential_category');
  v_has_manage_finance := public.has_workspace_permission(p_ws_id, p_user_id, 'manage_finance');
  v_has_granular_permissions := v_can_view_expenses OR v_can_view_incomes;

  IF NOT v_has_manage_finance THEN
    SELECT
      array_agg(ww.id),
      jsonb_object_agg(ww.id::text, access_data.window_start_date)
    INTO v_allowed_wallet_ids, v_wallet_windows
    FROM public.workspace_wallets ww
    JOIN (
      SELECT
        wrww.wallet_id,
        MIN(now() - (public.get_wallet_viewing_window_days(wrww.viewing_window, wrww.custom_days) || ' days')::interval) as window_start_date
      FROM public.workspace_roles wr
      JOIN public.workspace_role_members wrm ON wr.id = wrm.role_id
      JOIN public.workspace_role_wallet_whitelist wrww ON wr.id = wrww.role_id
      WHERE wr.ws_id = p_ws_id AND wrm.user_id = p_user_id
      GROUP BY wrww.wallet_id
    ) access_data ON ww.id = access_data.wallet_id
    WHERE ww.ws_id = p_ws_id;

    IF v_allowed_wallet_ids IS NULL THEN
      RETURN;
    END IF;

    IF p_wallet_ids IS NOT NULL THEN
      p_wallet_ids := (
        SELECT array_agg(u)
        FROM unnest(p_wallet_ids) AS u
        WHERE u = ANY(v_allowed_wallet_ids)
      );
      IF p_wallet_ids IS NULL OR array_length(p_wallet_ids, 1) IS NULL THEN
        RETURN;
      END IF;
    ELSE
      p_wallet_ids := v_allowed_wallet_ids;
    END IF;
  END IF;

  RETURN QUERY
  WITH filtered_transactions AS (
    SELECT
      wt.id,
      wt.amount,
      wt.category_id,
      wt.created_at,
      wt.creator_id,
      wt.platform_creator_id,
      wt.description,
      wt.invoice_id,
      wt.report_opt_in,
      wt.taken_at,
      wt.wallet_id,
      wt.is_amount_confidential,
      wt.is_description_confidential,
      wt.is_category_confidential,
      ww.name as wallet_name,
      tc.name as category_name,
      tc.icon as category_icon,
      tc.color as category_color,
      date_trunc(v_trunc_interval, wt.taken_at AT TIME ZONE v_validated_timezone) as period_bucket
    FROM public.wallet_transactions wt
    JOIN public.workspace_wallets ww ON wt.wallet_id = ww.id
    LEFT JOIN public.transaction_categories tc ON wt.category_id = tc.id
    WHERE ww.ws_id = p_ws_id
      AND (v_has_manage_finance OR (
        wt.wallet_id = ANY(v_allowed_wallet_ids)
        AND wt.taken_at >= COALESCE((v_wallet_windows->>wt.wallet_id::text)::timestamptz, '-infinity'::timestamptz)
      ))
      AND (
        (NOT v_has_granular_permissions AND v_can_view_transactions)
        OR (v_can_view_expenses AND wt.amount < 0)
        OR (v_can_view_incomes AND wt.amount > 0)
      )
      AND (
        p_transaction_type IS NULL
        OR (p_transaction_type = 'income' AND wt.amount > 0)
        OR (p_transaction_type = 'expense' AND wt.amount < 0)
      )
      AND (p_wallet_ids IS NULL OR wt.wallet_id = ANY(p_wallet_ids))
      AND (p_category_ids IS NULL OR wt.category_id = ANY(p_category_ids))
      AND (p_creator_ids IS NULL OR (wt.creator_id = ANY(p_creator_ids) OR wt.platform_creator_id = ANY(p_creator_ids)))
      AND (p_start_date IS NULL OR wt.taken_at >= p_start_date)
      AND (p_end_date IS NULL OR wt.taken_at <= p_end_date)
      AND (p_search_query IS NULL OR wt.description ILIKE '%' || p_search_query || '%')
      AND (p_tag_ids IS NULL OR EXISTS (
        SELECT 1 FROM public.wallet_transaction_tags wtt
        WHERE wtt.transaction_id = wt.id AND wtt.tag_id = ANY(p_tag_ids)
      ))
  ),
  period_aggregates AS (
    SELECT
      ft.period_bucket,
      (ft.period_bucket AT TIME ZONE v_validated_timezone) + (v_interval_text)::interval as period_end_calc,
      COUNT(*) as tx_count,
      COALESCE(SUM(CASE WHEN ft.amount > 0 AND (NOT ft.is_amount_confidential OR v_can_view_amount) THEN ft.amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN ft.amount < 0 AND (NOT ft.is_amount_confidential OR v_can_view_amount) THEN ft.amount ELSE 0 END), 0) as expense,
      COALESCE(SUM(CASE WHEN NOT ft.is_amount_confidential OR v_can_view_amount THEN ft.amount ELSE 0 END), 0) as net,
      bool_or(ft.is_amount_confidential AND NOT v_can_view_amount) as has_redacted,
      jsonb_agg(
        jsonb_build_object(
          'id', ft.id,
          'amount', CASE WHEN ft.is_amount_confidential AND NOT v_can_view_amount THEN NULL ELSE ft.amount END,
          'category_id', CASE WHEN ft.is_category_confidential AND NOT v_can_view_category THEN NULL ELSE ft.category_id END,
          'category', CASE WHEN ft.is_category_confidential AND NOT v_can_view_category THEN NULL ELSE ft.category_name END,
          'category_icon', CASE WHEN ft.is_category_confidential AND NOT v_can_view_category THEN NULL ELSE ft.category_icon END,
          'category_color', CASE WHEN ft.is_category_confidential AND NOT v_can_view_category THEN NULL ELSE ft.category_color END,
          'wallet_id', ft.wallet_id,
          'wallet', ft.wallet_name,
          'description', CASE WHEN ft.is_description_confidential AND NOT v_can_view_description THEN '[CONFIDENTIAL]' ELSE ft.description END,
          'taken_at', ft.taken_at,
          'created_at', ft.created_at,
          'creator_id', ft.creator_id,
          'platform_creator_id', ft.platform_creator_id,
          'invoice_id', ft.invoice_id,
          'report_opt_in', ft.report_opt_in,
          'is_amount_confidential', ft.is_amount_confidential,
          'is_description_confidential', ft.is_description_confidential,
          'is_category_confidential', ft.is_category_confidential
        ) ORDER BY ft.taken_at DESC, ft.created_at DESC
      ) as tx_array
    FROM filtered_transactions ft
    GROUP BY ft.period_bucket
  ),
  paginated_periods AS (
    SELECT
      pa.*,
      ROW_NUMBER() OVER (ORDER BY pa.period_bucket DESC) as rn
    FROM period_aggregates pa
    WHERE p_cursor_period_start IS NULL
      OR (pa.period_bucket AT TIME ZONE v_validated_timezone) < p_cursor_period_start
    ORDER BY pa.period_bucket DESC
    LIMIT p_limit + 1
  )
  SELECT
    pp.period_bucket AT TIME ZONE v_validated_timezone as period_start,
    pp.period_end_calc as period_end,
    pp.income as total_income,
    pp.expense as total_expense,
    pp.net as net_total,
    pp.tx_count as transaction_count,
    pp.has_redacted as has_redacted_amounts,
    pp.tx_array as transactions,
    (SELECT COUNT(*) > p_limit FROM paginated_periods) as has_more
  FROM paginated_periods pp
  WHERE pp.rn <= p_limit
  ORDER BY pp.period_bucket DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_transactions_by_period(
  uuid,
  text,
  uuid,
  uuid[],
  uuid[],
  uuid[],
  uuid[],
  text,
  text,
  timestamp with time zone,
  timestamp with time zone,
  timestamp with time zone,
  integer,
  text
) TO authenticated;

COMMENT ON FUNCTION public.get_transactions_by_period(
  uuid,
  text,
  uuid,
  uuid[],
  uuid[],
  uuid[],
  uuid[],
  text,
  text,
  timestamp with time zone,
  timestamp with time zone,
  timestamp with time zone,
  integer,
  text
) IS
'Returns transactions grouped by period with optional transaction type and timezone-aware period grouping.';
