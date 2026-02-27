import type { WorkspaceProductTier } from '@tuturuuu/types';

const VALID_TIERS: WorkspaceProductTier[] = [
  'FREE',
  'PLUS',
  'PRO',
  'ENTERPRISE',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = Math.trunc(value);
    return parsed > 0 ? parsed : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

export function parseWorkspaceProductTier(
  metadata: unknown
): WorkspaceProductTier | null {
  const record = asRecord(metadata);
  const tierRaw = record?.product_tier;

  if (typeof tierRaw !== 'string') {
    return null;
  }

  const tierValue = tierRaw.trim().toUpperCase();
  return VALID_TIERS.includes(tierValue as WorkspaceProductTier)
    ? (tierValue as WorkspaceProductTier)
    : null;
}

export function isAiCreditPackProduct(metadata: unknown): boolean {
  const record = asRecord(metadata);
  const productType = record?.product_type;
  return (
    typeof productType === 'string' &&
    productType.trim().toLowerCase() === 'ai_credit_pack'
  );
}

export function parseCreditPackConfig(metadata: unknown): {
  tokens: number;
  expiryDays: number;
} | null {
  const record = asRecord(metadata);
  if (!record) return null;

  const tokens = parsePositiveInteger(record.tokens ?? record.credits);
  const expiryDays = parsePositiveInteger(
    record.expiry_days ?? record.expiration_days
  );

  if (!tokens || !expiryDays) {
    return null;
  }

  return { tokens, expiryDays };
}
