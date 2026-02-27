import type { TypedSupabaseClient } from '@tuturuuu/supabase/next/client';

export type WorkspaceOrderProductKind =
  | 'subscription_product'
  | 'credit_pack'
  | 'unknown';

export async function resolveWorkspaceOrderProduct(
  sbAdmin: TypedSupabaseClient,
  polarProductId?: string | null
): Promise<{
  productKind: WorkspaceOrderProductKind;
  productId: string | null;
  creditPackId: string | null;
}> {
  if (!polarProductId) {
    return {
      productKind: 'unknown',
      productId: null,
      creditPackId: null,
    };
  }

  const { data: creditPack } = await sbAdmin
    .from('workspace_credit_packs')
    .select('id')
    .eq('id', polarProductId)
    .maybeSingle();

  if (creditPack?.id) {
    return {
      productKind: 'credit_pack',
      productId: null,
      creditPackId: creditPack.id,
    };
  }

  const { data: subscriptionProduct } = await sbAdmin
    .from('workspace_subscription_products')
    .select('id')
    .eq('id', polarProductId)
    .maybeSingle();

  if (subscriptionProduct?.id) {
    return {
      productKind: 'subscription_product',
      productId: subscriptionProduct.id,
      creditPackId: null,
    };
  }

  return {
    productKind: 'unknown',
    productId: null,
    creditPackId: null,
  };
}
