import type { Order } from '@tuturuuu/payment/polar';
import type { TypedSupabaseClient } from '@tuturuuu/supabase/next/client';
import { resolveWorkspaceOrderProduct } from '@/utils/polar-product-helper';

export async function syncOrderToDatabase(
  supabase: TypedSupabaseClient,
  order: Order
) {
  const wsId = order.metadata?.wsId;

  if (!wsId || typeof wsId !== 'string') {
    console.error('Order sync error: Workspace ID not found.');
    throw new Error('Workspace ID not found.');
  }

  const productResolution = await resolveWorkspaceOrderProduct(
    supabase,
    order.productId
  );

  const orderData = {
    ws_id: wsId,
    polar_order_id: order.id,
    status: order.status as any,
    polar_subscription_id: order.subscriptionId,
    product_id: productResolution.productId,
    credit_pack_id: productResolution.creditPackId,
    product_kind: productResolution.productKind,
    total_amount: order.totalAmount,
    currency: order.currency,
    billing_reason: order.billingReason as any,
    created_at: order.createdAt.toISOString(),
    updated_at: order.modifiedAt ? order.modifiedAt.toISOString() : null,
  };

  const { error: dbError } = await supabase
    .from('workspace_orders')
    .upsert([orderData], {
      onConflict: 'polar_order_id',
      ignoreDuplicates: false,
    });

  if (dbError) {
    throw new Error(`Order upsert error: ${dbError.message}`);
  }

  return orderData;
}
