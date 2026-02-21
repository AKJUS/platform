--------------------------------------------------------------------------------
-- Image generation daily limits (FREE 2, PLUS 20, PRO 50) and plan monthly
-- totals (FREE 10, PLUS 100, PRO 500). ENTERPRISE unchanged.
--------------------------------------------------------------------------------

-- 1. Update image_generation feature access: daily request limits per tier
UPDATE public.ai_credit_feature_access
SET max_requests_per_day = 2
WHERE tier = 'FREE' AND feature = 'image_generation';

UPDATE public.ai_credit_feature_access
SET max_requests_per_day = 20
WHERE tier = 'PLUS' AND feature = 'image_generation';

UPDATE public.ai_credit_feature_access
SET max_requests_per_day = 50
WHERE tier = 'PRO' AND feature = 'image_generation';
