-- Extend abuse_event_type enum with API abuse tracking types
ALTER TYPE public.abuse_event_type ADD VALUE IF NOT EXISTS 'api_auth_failed';
ALTER TYPE public.abuse_event_type ADD VALUE IF NOT EXISTS 'api_rate_limited';
ALTER TYPE public.abuse_event_type ADD VALUE IF NOT EXISTS 'api_abuse';
