import type { Product } from '@tuturuuu/payment/polar';
import type { TypedSupabaseClient } from '@tuturuuu/supabase/next/client';
import {
  isAiCreditPackProduct,
  parseCreditPackConfig,
  parseWorkspaceProductTier,
} from '@/utils/polar-product-metadata';

export type WorkspaceOrderProductKind =
  | 'subscription_product'
  | 'credit_pack'
  | 'unknown';

export async function resolveWorkspaceOrderProduct(
  supabase: TypedSupabaseClient,
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

  const { data: creditPack } = await supabase
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

  const { data: subscriptionProduct } = await supabase
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

async function upsertSubscriptionProduct(
  supabase: TypedSupabaseClient,
  product: Product
) {
  const tier = parseWorkspaceProductTier(product.metadata);
  if (!tier) {
    throw new Error(
      `Subscription product ${product.id} is missing valid product_tier metadata`
    );
  }

  const firstPrice = product.prices.find((p: any) => 'amountType' in p);
  const isSeatBased = firstPrice?.amountType === 'seat_based';
  const isFixed = firstPrice?.amountType === 'fixed';

  const price = isFixed ? firstPrice.priceAmount : null;
  const pricePerSeat = isSeatBased
    ? (firstPrice?.seatTiers?.tiers?.[0]?.pricePerSeat ?? null)
    : null;
  const minSeats = isSeatBased ? firstPrice?.seatTiers?.minimumSeats : null;
  const maxSeats = isSeatBased ? firstPrice?.seatTiers?.maximumSeats : null;

  const productData = {
    id: product.id,
    name: product.name,
    description: product.description || '',
    price,
    recurring_interval: product.recurringInterval || 'month',
    tier,
    archived: product.isArchived ?? false,
    pricing_model: firstPrice?.amountType,
    price_per_seat: pricePerSeat,
    min_seats: minSeats,
    max_seats: maxSeats,
  };

  const { error: upsertError } = await supabase
    .from('workspace_subscription_products')
    .upsert(productData, {
      onConflict: 'id',
      ignoreDuplicates: false,
    });

  if (upsertError) {
    throw new Error(
      `Subscription product upsert error: ${upsertError.message}`
    );
  }

  return productData;
}

async function upsertCreditPackProduct(
  supabase: TypedSupabaseClient,
  product: Product
) {
  const config = parseCreditPackConfig(product.metadata);
  if (!config) {
    throw new Error(
      `Credit pack ${product.id} is missing metadata tokens/expiry_days`
    );
  }

  const firstPrice = product.prices.find((p: any) => 'amountType' in p);
  const isFixed = firstPrice?.amountType === 'fixed';
  const price = isFixed ? firstPrice.priceAmount : 0;
  const currency =
    typeof firstPrice?.priceCurrency === 'string'
      ? firstPrice.priceCurrency.toLowerCase()
      : 'usd';

  const creditPackData = {
    id: product.id,
    name: product.name,
    description: product.description || '',
    price,
    currency,
    tokens: config.tokens,
    expiry_days: config.expiryDays,
    archived: product.isArchived ?? false,
  };

  const { error: upsertError } = await supabase
    .from('workspace_credit_packs')
    .upsert([creditPackData], {
      onConflict: 'id',
      ignoreDuplicates: false,
    });

  if (upsertError) {
    throw new Error(`Credit pack upsert error: ${upsertError.message}`);
  }

  return creditPackData;
}

export async function syncProductToDatabase(
  supabase: TypedSupabaseClient,
  product: Product
) {
  if (isAiCreditPackProduct(product.metadata)) {
    const creditPackData = await upsertCreditPackProduct(supabase, product);
    return creditPackData;
  }

  const subscriptionProductData = await upsertSubscriptionProduct(
    supabase,
    product
  );

  return subscriptionProductData;
}
