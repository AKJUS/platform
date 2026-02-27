import { createPolarClient } from '@tuturuuu/payment/polar/server';
import { createAdminClient } from '@tuturuuu/supabase/next/server';
import { DEV_MODE } from '@tuturuuu/utils/constants';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  isAiCreditPackProduct,
  parseCreditPackConfig,
  parseWorkspaceProductTier,
} from '@/utils/polar-product-metadata';

/**
 * Cron job to sync products from Polar.sh to database
 * Runs periodically to ensure all products are up-to-date
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret =
      process.env.CRON_SECRET ?? process.env.VERCEL_CRON_SECRET ?? '';

    if (!DEV_MODE && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const polar = createPolarClient();
    const sbAdmin = await createAdminClient();

    let processedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Fetch all products from Polar (paginated)
    let hasMore = true;
    let page = 1;
    const limit = 100;

    while (hasMore) {
      try {
        const response = await polar.products.list({
          limit,
          page,
        });

        const products = response.result?.items ?? [];

        if (products.length === 0) {
          hasMore = false;
          break;
        }

        // Process each product
        for (const product of products) {
          try {
            const isCreditPack = isAiCreditPackProduct(product.metadata);

            let dbError: { message: string } | null = null;

            if (isCreditPack) {
              const config = parseCreditPackConfig(product.metadata);
              if (!config) {
                throw new Error(
                  'Missing or invalid tokens/expiry_days in credit pack metadata'
                );
              }

              const firstPrice = product.prices.find((p) => 'amountType' in p);
              const price =
                firstPrice?.amountType === 'fixed' ? firstPrice.priceAmount : 0;
              const currency =
                typeof firstPrice?.priceCurrency === 'string'
                  ? firstPrice.priceCurrency.toLowerCase()
                  : 'usd';

              const upsertResult = await sbAdmin
                .from('workspace_credit_packs')
                .upsert(
                  {
                    id: product.id,
                    name: product.name,
                    description: product.description || '',
                    price,
                    currency,
                    tokens: config.tokens,
                    expiry_days: config.expiryDays,
                    archived: product.isArchived ?? false,
                  },
                  {
                    onConflict: 'id',
                    ignoreDuplicates: false,
                  }
                );

              dbError = upsertResult.error;
            } else {
              const tier = parseWorkspaceProductTier(product.metadata);
              if (!tier) {
                throw new Error('Missing or invalid product_tier in metadata');
              }

              const firstPrice = product.prices.find((p) => 'amountType' in p);
              const isSeatBased = firstPrice?.amountType === 'seat_based';
              const isFixed = firstPrice?.amountType === 'fixed';

              const price = isFixed ? firstPrice.priceAmount : null;
              const pricePerSeat = isSeatBased
                ? (firstPrice?.seatTiers?.tiers?.[0]?.pricePerSeat ?? null)
                : null;
              const minSeats = isSeatBased
                ? firstPrice?.seatTiers?.minimumSeats
                : null;
              const maxSeats = isSeatBased
                ? firstPrice?.seatTiers?.maximumSeats
                : null;

              const upsertResult = await sbAdmin
                .from('workspace_subscription_products')
                .upsert(
                  {
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
                  },
                  {
                    onConflict: 'id',
                    ignoreDuplicates: false,
                  }
                );

              dbError = upsertResult.error;
            }

            if (dbError) {
              failedCount++;
              errors.push(`Product ${product.id}: ${dbError.message}`);
            } else {
              processedCount++;
            }
          } catch (error) {
            failedCount++;
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Product ${product.id}: ${errorMessage}`);
          }
        }

        // Check if there are more pages
        if (products.length < limit) {
          hasMore = false;
        } else {
          page++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to fetch page ${page}: ${errorMessage}`);
        hasMore = false;
      }
    }

    return NextResponse.json({
      message: 'Product sync completed',
      processed: processedCount,
      failed: failedCount,
      errors: errors.slice(0, 20), // Limit error messages
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const maxDuration = 300; // 5 minutes
