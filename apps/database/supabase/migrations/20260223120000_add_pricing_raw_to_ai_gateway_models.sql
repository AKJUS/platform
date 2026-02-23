-- Add pricing_raw column to store full gateway pricing payload
-- This is used for display and inspection; cost calculations continue
-- to rely on the scalar and tier columns defined previously.

ALTER TABLE public.ai_gateway_models
  ADD COLUMN IF NOT EXISTS pricing_raw JSONB;

