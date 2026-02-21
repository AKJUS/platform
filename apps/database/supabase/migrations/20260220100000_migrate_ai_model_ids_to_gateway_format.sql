-- Migrate ai_chats.model and ai_chat_messages.model to use AI Gateway format IDs
-- (e.g., "google/gemini-2.5-flash" instead of just "gemini-2.5-flash")
-- This makes ai_gateway_models the single source of truth for model identification.

-- Step 1: Drop FK constraints referencing the legacy ai_models table
ALTER TABLE public.ai_chats DROP CONSTRAINT IF EXISTS public_ai_chats_model_fkey;
ALTER TABLE public.ai_chat_messages DROP CONSTRAINT IF EXISTS public_ai_chat_messages_model_fkey;

-- Step 2: Migrate existing bare model names to gateway format (provider/model)
-- Uses ai_models.provider → lowercase mapping: GOOGLE → google, OPENAI → openai, ANTHROPIC → anthropic
UPDATE public.ai_chats c
SET model = LOWER(m.provider) || '/' || c.model
FROM public.ai_models m
WHERE c.model = m.id
  AND c.model IS NOT NULL
  AND c.model NOT LIKE '%/%';

-- Fallback for any models not found in ai_models: assume google
UPDATE public.ai_chats
SET model = 'google/' || model
WHERE model IS NOT NULL
  AND model NOT LIKE '%/%';

UPDATE public.ai_chat_messages cm
SET model = LOWER(m.provider) || '/' || cm.model
FROM public.ai_models m
WHERE cm.model = m.id
  AND cm.model IS NOT NULL
  AND cm.model NOT LIKE '%/%';

-- Fallback for any messages not found in ai_models: assume google
UPDATE public.ai_chat_messages
SET model = 'google/' || model
WHERE model IS NOT NULL
  AND model NOT LIKE '%/%';

-- Step 3: Update create_ai_chat function to accept gateway-format model IDs
CREATE OR REPLACE FUNCTION public.create_ai_chat(title text, message text, model text)
RETURNS uuid AS $$
DECLARE generated_chat_id uuid;
BEGIN
  generated_chat_id := gen_random_uuid();
  INSERT INTO ai_chats (id, title, creator_id, model)
  VALUES (generated_chat_id, title, auth.uid(), model);
  INSERT INTO ai_chat_messages (chat_id, content, creator_id, role)
  VALUES (generated_chat_id, message, auth.uid(), 'USER');
  RETURN generated_chat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
