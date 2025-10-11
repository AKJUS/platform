import { useQuery } from '@tanstack/react-query';
import { createClient } from '@tuturuuu/supabase/next/client';
import type { Invoice } from '@tuturuuu/types/primitives/Invoice';
import type { PendingInvoice } from '@tuturuuu/types/primitives/PendingInvoice';
import { parseMonthsOwed } from '@tuturuuu/types/primitives/PendingInvoice';
import type { Transaction } from '@tuturuuu/types/primitives/Transaction';
import type { TransactionCategory } from '@tuturuuu/types/primitives/TransactionCategory';
import type { Wallet } from '@tuturuuu/types/primitives/Wallet';
import type { WorkspaceUser } from '@tuturuuu/types/primitives/WorkspaceUser';
import type { Product, Promotion, UserGroupProducts } from './types';

// React Query hooks for data fetching
export const useUsers = (wsId: string) => {
  return useQuery({
    queryKey: ['users', wsId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('workspace_users')
        .select('*')
        .eq('ws_id', wsId)
        .order('full_name', { ascending: true });

      if (error) throw error;
      return data as WorkspaceUser[];
    },
  });
};

// Users with selectable groups (groups where they have STUDENT role)
export const useUsersWithSelectableGroups = (wsId: string) => {
  return useQuery({
    queryKey: ['users-with-selectable-groups', wsId],
    queryFn: async () => {
      const supabase = createClient();

      // Single query using join to get users with STUDENT role groups
      const { data, error } = await supabase
        .from('workspace_users')
        .select(`
          *,
          workspace_user_groups_users!inner(role)
        `)
        .eq('ws_id', wsId)
        .eq('workspace_user_groups_users.role', 'STUDENT')
        .order('full_name', { ascending: true });

      if (error) throw error;
      return data as WorkspaceUser[];
    },
  });
};

export const useProducts = (wsId: string) => {
  return useQuery({
    queryKey: ['products', wsId],
    queryFn: async () => {
      const supabase = createClient();
      const { data: rawData, error } = await supabase
        .from('workspace_products')
        .select(
          '*, product_categories(name), inventory_products!inventory_products_product_id_fkey(amount, min_amount, price, unit_id, warehouse_id, inventory_warehouses!inventory_products_warehouse_id_fkey(name), inventory_units!inventory_products_unit_id_fkey(name))'
        )
        .eq('ws_id', wsId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const data = rawData.map((item) => ({
        id: item.id,
        name: item.name,
        manufacturer: item.manufacturer,
        description: item.description,
        usage: item.usage,
        category: item.product_categories?.name,
        category_id: item.category_id,
        ws_id: item.ws_id,
        created_at: item.created_at,
        inventory: (item.inventory_products || []).map((inventory) => ({
          unit_id: inventory.unit_id,
          warehouse_id: inventory.warehouse_id,
          amount: inventory.amount,
          min_amount: inventory.min_amount || 0,
          price: inventory.price || 0,
          unit_name: inventory.inventory_units?.name || null,
          warehouse_name: inventory.inventory_warehouses?.name || null,
        })),
      }));

      return data as Product[];
    },
  });
};

export const usePromotions = (wsId: string) => {
  return useQuery({
    queryKey: ['promotions', wsId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('workspace_promotions')
        .select('*')
        .eq('ws_id', wsId)
        .neq('promo_type', 'REFERRAL')
        .order('code', { ascending: true });

      if (error) throw error;
      return data as Promotion[];
    },
  });
};

export const useWallets = (wsId: string) => {
  return useQuery({
    queryKey: ['wallets', wsId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('workspace_wallets')
        .select('*')
        .eq('ws_id', wsId)
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Wallet[];
    },
  });
};

export const useCategories = (wsId: string) => {
  return useQuery({
    queryKey: ['categories', wsId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('transaction_categories')
        .select('*')
        .eq('ws_id', wsId)
        .order('name', { ascending: true });

      if (error) throw error;
      return data as TransactionCategory[];
    },
  });
};

export const useUserTransactions = (wsId: string, userId: string) => {
  return useQuery({
    queryKey: ['user-transactions', wsId, userId],
    queryFn: async () => {
      const supabase = createClient();
      const { data: rawData, error } = await supabase
        .from('wallet_transactions')
        .select(
          `*, workspace_wallets!inner(name, ws_id), transaction_categories(name)`
        )
        .eq('workspace_wallets.ws_id', wsId)
        .eq('creator_id', userId)
        .order('taken_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const data =
        rawData?.map(
          ({ workspace_wallets, transaction_categories, ...rest }) => ({
            ...rest,
            wallet: workspace_wallets?.name,
            category: transaction_categories?.name,
          })
        ) || [];

      return data as Transaction[];
    },
    enabled: !!userId,
  });
};

export const useUserInvoices = (wsId: string, userId: string) => {
  return useQuery({
    queryKey: ['user-invoices', wsId, userId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('finance_invoices')
        .select('*')
        .eq('ws_id', wsId)
        .eq('customer_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!userId,
  });
};

// Subscription-specific hooks
export const useUserGroups = (userId: string) => {
  return useQuery({
    queryKey: ['user-groups', userId],
    queryFn: async () => {
      if (!userId) return [];

      const supabase = createClient();
      const { data, error } = await supabase
        .from('workspace_user_groups_users')
        .select('workspace_user_groups(*)')
        .eq('role', 'STUDENT')
        .eq('user_id', userId);

      if (error) {
        console.error('❌ User groups fetch error:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 3,
  });
};

export const useUserAttendance = (
  groupId: string,
  userId: string,
  month: string
) => {
  return useQuery({
    queryKey: ['user-attendance', groupId, userId, month],
    queryFn: async () => {
      const supabase = createClient();

      // Parse the month to get start and end dates
      const startOfMonth = new Date(month + '-01');
      const nextMonth = new Date(startOfMonth);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const { data, error } = await supabase
        .from('user_group_attendance')
        .select('date, status')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .gte('date', startOfMonth.toISOString().split('T')[0])
        .lt('date', nextMonth.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) {
        console.error('❌ User attendance fetch error:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!groupId && !!userId && !!month,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 3,
  });
};

// Get User's Group Products with improved caching
export const useUserGroupProducts = (groupId: string) => {
  return useQuery({
    queryKey: ['user-group-products', groupId],
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('user_group_linked_products')
        .select(
          'workspace_products(id, name, product_categories(name)), inventory_units(name, id), warehouse_id'
        )
        .eq('group_id', groupId);

      if (error) {
        console.error('❌ Group products fetch error:', error);
        throw error;
      }
      return data as UserGroupProducts[];
    },
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 3,
  });
};

// Get User's Latest Subscription Invoice
export const useUserLatestSubscriptionInvoice = (
  userId: string,
  groupId: string
) => {
  return useQuery({
    queryKey: ['user-latest-subscription-invoice', userId, groupId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('finance_invoices')
        .select('valid_until')
        .eq('customer_id', userId)
        .eq('user_group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error(
          '❌ User latest subscription invoice fetch error:',
          error
        );
        throw error;
      }

      return data || [];
    },
    enabled: !!userId && !!groupId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 3,
  });
};

// Get User's Linked Promotion
export const useUserLinkedPromotions = (userId: string) => {
  return useQuery({
    queryKey: ['user-linked-promotions', userId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('user_linked_promotions')
        .select('promo_id, workspace_promotions(name, code, value, use_ratio)')
        .eq('user_id', userId);

      if (error) {
        console.error('❌ User linked promotions fetch error:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 3,
  });
};

// Per-user referral discounts (percent) from view
export const useUserReferralDiscounts = (wsId: string, userId: string) => {
  return useQuery({
    queryKey: ['user-referral-discounts', wsId, userId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('v_user_referral_discounts')
        .select('promo_id, calculated_discount_value')
        .eq('ws_id', wsId)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ User referral discounts fetch error:', error);
        throw error;
      }

      return (
        (data || []).map((row) => ({
          promo_id: row.promo_id as string | null,
          calculated_discount_value: row.calculated_discount_value as
            | number
            | null,
        })) || []
      );
    },
    enabled: !!wsId && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 3,
  });
};

// Combined promotions list: all regular promos + only user's linked referral promos
export type AvailablePromotion = {
  id: string;
  name: string | null;
  code: string | null;
  value: number;
  use_ratio: boolean;
  is_referral: boolean;
};

export const useAvailablePromotions = (wsId: string, userId: string) => {
  return useQuery({
    queryKey: ['available-promotions', wsId, userId],
    queryFn: async () => {
      const supabase = createClient();

      // Regular (non-referral) promotions
      const { data: regular, error: regularErr } = await supabase
        .from('workspace_promotions')
        .select('id, name, code, value, use_ratio')
        .eq('ws_id', wsId)
        .neq('promo_type', 'REFERRAL')
        .order('code', { ascending: true });
      if (regularErr) throw regularErr;

      // User-linked promotions (could include referral)
      const { data: linked, error: linkedErr } = await supabase
        .from('user_linked_promotions')
        .select(
          'promo_id, workspace_promotions(id, name, code, value, use_ratio, promo_type)'
        )
        .eq('user_id', userId);
      if (linkedErr) throw linkedErr;

      // Build result: include all regular + only linked where promo_type == 'REFERRAL'
      const resultMap = new Map<string, AvailablePromotion>();
      for (const p of regular || []) {
        resultMap.set(p.id, {
          id: p.id,
          name: p.name,
          code: p.code,
          value: Number(p.value ?? 0),
          use_ratio: !!p.use_ratio,
          is_referral: false,
        });
      }

      for (const row of linked || []) {
        const p = row.workspace_promotions;
        if (p?.promo_type === 'REFERRAL' && p?.id) {
          resultMap.set(p.id, {
            id: p.id,
            name: p.name ?? null,
            code: p.code ?? null,
            value: Number(p.value ?? 0),
            use_ratio: !!p.use_ratio,
            is_referral: true,
          });
        }
      }

      return Array.from(resultMap.values()) as AvailablePromotion[];
    },
    enabled: !!wsId && !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 3,
  });
};

// Get Pending Invoices for a workspace
export const usePendingInvoices = (
  wsId: string,
  page?: string,
  pageSize?: string
) => {
  return useQuery({
    queryKey: ['pending-invoices', wsId, page, pageSize],
    queryFn: async () => {
      const supabase = createClient();

      // Calculate limit and offset
      const parsedPage = page ? parseInt(page) : 1;
      const parsedSize = pageSize ? parseInt(pageSize) : 10;
      const offset = (parsedPage - 1) * parsedSize;

      // Fetch data with pagination
      const { data, error } = await supabase.rpc('get_pending_invoices', {
        p_ws_id: wsId,
        p_limit: parsedSize,
        p_offset: offset,
      });

      if (error) {
        console.error('❌ Pending invoices fetch error:', error);
        throw error;
      }

      // Fetch total count
      const { data: countData, error: countError } = await supabase.rpc(
        'get_pending_invoices_count',
        {
          p_ws_id: wsId,
        }
      );

      if (countError) {
        console.error('❌ Pending invoices count error:', countError);
        throw countError;
      }

      // Transform months_owed from CSV string to array
      const transformedData = (data || []).map((invoice: any) => ({
        ...invoice,
        months_owed:
          typeof invoice.months_owed === 'string'
            ? parseMonthsOwed(invoice.months_owed)
            : invoice.months_owed,
      })) as PendingInvoice[];

      return {
        data: transformedData,
        count: (countData as number) || 0,
      };
    },
    enabled: !!wsId,
    staleTime: 2 * 60 * 1000, // 2 minutes - more frequent refresh for pending data
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus
    retry: 3,
  });
};
