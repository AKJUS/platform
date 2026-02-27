import type { Subscription } from '@tuturuuu/payment/polar';
import type { TypedSupabaseClient } from '@tuturuuu/supabase/next/client';
import { addDays, addMonths, addWeeks, addYears } from 'date-fns';
import {
  isAiCreditPackProduct,
  parseCreditPackTokens,
} from '@/utils/polar-product-metadata';

async function upsertSubscription(
  supabase: TypedSupabaseClient,
  wsId: string,
  subscription: Subscription
) {
  const { data: product } = await supabase
    .from('workspace_subscription_products')
    .select('pricing_model, price_per_seat')
    .eq('id', subscription.product.id)
    .single();

  const isSeatBased = product?.pricing_model === 'seat_based';
  const seatCount = isSeatBased ? (subscription.seats ?? 1) : null;

  const subscriptionData = {
    ws_id: wsId,
    status: subscription.status as any,
    polar_subscription_id: subscription.id,
    product_id: subscription.product.id,
    current_period_start: new Date(
      subscription.currentPeriodStart
    ).toISOString(),
    current_period_end: subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd).toISOString()
      : null,
    cancel_at_period_end: subscription.cancelAtPeriodEnd,
    created_at: new Date(subscription.createdAt).toISOString(),
    updated_at: subscription.modifiedAt
      ? new Date(subscription.modifiedAt).toISOString()
      : null,
    seat_count: seatCount,
  };

  const { error: dbError } = await supabase
    .from('workspace_subscriptions')
    .upsert([subscriptionData], {
      onConflict: 'polar_subscription_id',
      ignoreDuplicates: false,
    });

  if (dbError) {
    throw new Error(`Subscription upsert error: ${dbError.message}`);
  }

  return { subscriptionData, isSeatBased };
}

async function upsertCreditPackPurchase(
  supabase: TypedSupabaseClient,
  wsId: string,
  subscription: Subscription
) {
  const tokens = parseCreditPackTokens(subscription.product.metadata);
  if (!tokens) {
    throw new Error(
      `Credit pack ${subscription.product.id} is missing metadata tokens`
    );
  }

  // Get recurring interval from subscription product
  const recurringInterval = subscription.product.recurringInterval ?? 'month';
  const recurringIntervalCount =
    subscription.product.recurringIntervalCount ?? 1;

  const expiresAt = calculateExpiryDate(
    subscription.currentPeriodStart,
    recurringInterval,
    recurringIntervalCount
  );
  const expiresAtIso = expiresAt.toISOString();

  // Store the actual Polar status for audit trail
  const status = subscription.status;

  const shouldRetainCredits = [
    'active',
    'trialing',
    'past_due',
    'incomplete',
  ].includes(status);

  const { data: existingPurchase, error: existingError } = await supabase
    .from('workspace_credit_pack_purchases')
    .select('id, tokens_remaining, granted_at, expires_at')
    .eq('polar_subscription_id', subscription.id)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `Credit pack purchase lookup error: ${existingError.message}`
    );
  }

  let tokensRemaining = 0;

  if (!existingPurchase) {
    tokensRemaining = tokens;
  } else if (shouldRetainCredits) {
    tokensRemaining = existingPurchase.tokens_remaining;
  }

  const purchaseData = {
    ws_id: wsId,
    credit_pack_id: subscription.product.id,
    polar_subscription_id: subscription.id,
    tokens_granted: tokens,
    tokens_remaining: tokensRemaining,
    granted_at: subscription.currentPeriodStart.toISOString(),
    expires_at: expiresAtIso,
    status: status as any,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from('workspace_credit_pack_purchases')
    .upsert(purchaseData, {
      onConflict: 'polar_subscription_id',
      ignoreDuplicates: false,
    });

  if (upsertError) {
    throw new Error(
      `Credit pack purchase upsert error: ${upsertError.message}`
    );
  }

  return purchaseData;
}

export async function syncSubscriptionToDatabase(
  supabase: TypedSupabaseClient,
  subscription: Subscription
) {
  const wsId = subscription.metadata?.wsId;
  if (!wsId || typeof wsId !== 'string') {
    console.error('Subscription sync error: Workspace ID not found.');
    throw new Error('Workspace ID not found.');
  }

  if (isAiCreditPackProduct(subscription.product.metadata)) {
    const purchaseData = await upsertCreditPackPurchase(
      supabase,
      wsId,
      subscription
    );

    return { purchaseData };
  }

  const { subscriptionData, isSeatBased } = await upsertSubscription(
    supabase,
    wsId,
    subscription
  );

  return { subscriptionData, isSeatBased };
}

function calculateExpiryDate(
  baseDate: Date,
  recurringInterval: string,
  recurringIntervalCount: number
): Date {
  switch (recurringInterval) {
    case 'day':
      return addDays(baseDate, recurringIntervalCount);

    case 'week':
      return addWeeks(baseDate, recurringIntervalCount);

    case 'month':
      return addMonths(baseDate, recurringIntervalCount);

    case 'year':
      return addYears(baseDate, recurringIntervalCount);

    default:
      throw new Error(`Unsupported recurring interval: ${recurringInterval}`);
  }
}
