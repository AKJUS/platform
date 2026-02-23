import type { SupabaseClient } from '@tuturuuu/supabase';

interface GatewayPricingTier {
  cost: string;
  min: number;
  max?: number;
}

interface GatewayVideoDurationPricing {
  resolution?: string;
  cost_per_second: string;
  audio?: boolean;
  mode?: string;
}

interface GatewayModelPricing {
  // Vercel AI Gateway uses these field names (values are strings)
  input?: string;
  output?: string;
  input_cache_read?: string;
  input_cache_write?: string;
  web_search?: string;
  image?: string;
  input_tiers?: GatewayPricingTier[];
  output_tiers?: GatewayPricingTier[];
  input_cache_read_tiers?: GatewayPricingTier[];
  input_cache_write_tiers?: GatewayPricingTier[];
  video_duration_pricing?: GatewayVideoDurationPricing[];
}

interface GatewayModel {
  id: string;
  object: string;
  created: number;
  released?: number;
  owned_by: string;
  name: string;
  description?: string;
  context_window?: number;
  max_tokens?: number;
  type: 'language' | 'embedding' | 'image' | 'video' | string;
  tags?: string[];
  pricing?: GatewayModelPricing;
}

interface GatewayModelsResponse {
  object: string;
  data: GatewayModel[];
}

interface SyncResult {
  synced: number;
  new: number;
  updated: number;
  errors: string[];
}

const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/models';

function isImageGenModelId(id: string): boolean {
  return (
    id.startsWith('google/imagen-') || id === 'google/gemini-2.5-flash-image'
  );
}

/**
 * Fetches model data from the Vercel AI Gateway and upserts into ai_gateway_models.
 * Does NOT auto-enable models — admin must explicitly enable via is_enabled.
 */
export async function syncGatewayModels(
  sbAdmin: SupabaseClient
): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, new: 0, updated: 0, errors: [] };

  const response = await fetch(GATEWAY_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch gateway models: ${response.status} ${response.statusText}`
    );
  }

  const json = (await response.json()) as unknown;

  const models: GatewayModel[] = Array.isArray(json)
    ? (json as GatewayModel[])
    : ((json as GatewayModelsResponse | undefined)?.data ?? []);

  if (models.length === 0) {
    result.errors.push('No models returned from gateway');
    return result;
  }

  // Count existing models for new vs updated detection
  const { data: existingIds } = await sbAdmin
    .from('ai_gateway_models')
    .select('id');
  const existingIdSet = new Set(
    (existingIds ?? []).map((row: { id: string }) => row.id)
  );

  const rows = models.map((m) => {
    const provider = m.owned_by || m.id.split('/')[0] || 'unknown';
    const modelName = m.id.split('/').slice(1).join('/') || m.id;

    return {
      id: m.id,
      name: m.name || modelName,
      provider,
      description: m.description || null,
      type: m.type || 'language',
      context_window: m.context_window ?? null,
      max_tokens: m.max_tokens ?? null,
      tags: m.tags ?? [],
      input_price_per_token: parseFloat(m.pricing?.input ?? '0'),
      output_price_per_token: parseFloat(m.pricing?.output ?? '0'),
      input_tiers: m.pricing?.input_tiers ?? null,
      output_tiers: m.pricing?.output_tiers ?? null,
      cache_read_price_per_token: m.pricing?.input_cache_read
        ? parseFloat(m.pricing.input_cache_read)
        : null,
      cache_write_price_per_token: m.pricing?.input_cache_write
        ? parseFloat(m.pricing.input_cache_write)
        : null,
      web_search_price: m.pricing?.web_search
        ? parseFloat(m.pricing.web_search)
        : null,
      // Use gateway image price when present; fallback for known image models so credit deduction stays correct
      image_gen_price: m.pricing?.image
        ? parseFloat(m.pricing.image)
        : isImageGenModelId(m.id)
          ? 0.0001
          : null,
      released_at: m.released
        ? new Date(m.released * 1000).toISOString()
        : null,
      pricing_raw: m.pricing ?? null,
      synced_at: new Date().toISOString(),
    };
  });

  // Upsert in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await sbAdmin
      .from('ai_gateway_models')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      result.errors.push(`Batch ${i / BATCH_SIZE}: ${error.message}`);
    } else {
      for (const row of batch) {
        result.synced++;
        if (existingIdSet.has(row.id)) {
          result.updated++;
        } else {
          result.new++;
        }
      }
    }
  }

  return result;
}
