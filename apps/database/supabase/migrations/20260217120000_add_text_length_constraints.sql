-- Migration to add text length constraints to prevent abuse
-- Limits are based on central constants defined in packages/utils/src/constants.ts
--
-- Strategy: Truncate any existing data that exceeds the limit BEFORE adding the
-- constraint, so the migration succeeds even on databases with legacy long values.

-- 1. Users table
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_display_name_length_check,
DROP CONSTRAINT IF EXISTS users_bio_length_check;

UPDATE public.users SET display_name = left(display_name, 100) WHERE char_length(display_name) > 100;
UPDATE public.users SET bio = left(bio, 1000) WHERE char_length(bio) > 1000;

ALTER TABLE public.users
ADD CONSTRAINT users_display_name_length_check CHECK (char_length(display_name) <= 100),
ADD CONSTRAINT users_bio_length_check CHECK (char_length(bio) <= 1000);

-- 2. User Private Details table (for email)
ALTER TABLE public.user_private_details
DROP CONSTRAINT IF EXISTS user_private_details_email_length_check;

UPDATE public.user_private_details SET email = left(email, 320) WHERE char_length(email) > 320;

ALTER TABLE public.user_private_details
ADD CONSTRAINT user_private_details_email_length_check CHECK (char_length(email) <= 320);

-- 3. Workspaces table
ALTER TABLE public.workspaces
DROP CONSTRAINT IF EXISTS workspaces_name_length_check;

UPDATE public.workspaces SET name = left(name, 100) WHERE char_length(name) > 100;

ALTER TABLE public.workspaces
ADD CONSTRAINT workspaces_name_length_check CHECK (char_length(name) <= 100);

-- 4. Tasks table
ALTER TABLE public.tasks
DROP CONSTRAINT IF EXISTS tasks_name_length_check,
DROP CONSTRAINT IF EXISTS tasks_description_length_check;

UPDATE public.tasks SET name = left(name, 255) WHERE char_length(name) > 255;
UPDATE public.tasks SET description = left(description, 100000) WHERE char_length(description) > 100000;

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_name_length_check CHECK (char_length(name) <= 255),
ADD CONSTRAINT tasks_description_length_check CHECK (char_length(description) <= 100000);

-- 5. AI Chat Messages table
ALTER TABLE public.ai_chat_messages
DROP CONSTRAINT IF EXISTS ai_chat_messages_content_length_check;

UPDATE public.ai_chat_messages SET content = left(content, 10000) WHERE char_length(content) > 10000;

ALTER TABLE public.ai_chat_messages
ADD CONSTRAINT ai_chat_messages_content_length_check CHECK (char_length(content) <= 10000);

-- 6. Workspace Calendar Events table
ALTER TABLE public.workspace_calendar_events
DROP CONSTRAINT IF EXISTS calendar_events_title_length_check,
DROP CONSTRAINT IF EXISTS calendar_events_description_length_check;

UPDATE public.workspace_calendar_events SET title = left(title, 255) WHERE char_length(title) > 255;
UPDATE public.workspace_calendar_events SET description = left(description, 10000) WHERE char_length(description) > 10000;

ALTER TABLE public.workspace_calendar_events
ADD CONSTRAINT calendar_events_title_length_check CHECK (char_length(title) <= 255),
ADD CONSTRAINT calendar_events_description_length_check CHECK (char_length(description) <= 10000);

-- 7. Support Inquiries table
ALTER TABLE public.support_inquiries
DROP CONSTRAINT IF EXISTS support_inquiries_name_length_check,
DROP CONSTRAINT IF EXISTS support_inquiries_email_length_check,
DROP CONSTRAINT IF EXISTS support_inquiries_subject_length_check,
DROP CONSTRAINT IF EXISTS support_inquiries_message_length_check;

UPDATE public.support_inquiries SET name = left(name, 100) WHERE char_length(name) > 100;
UPDATE public.support_inquiries SET email = left(email, 320) WHERE char_length(email) > 320;
UPDATE public.support_inquiries SET subject = left(subject, 255) WHERE char_length(subject) > 255;
UPDATE public.support_inquiries SET message = left(message, 5000) WHERE char_length(message) > 5000;

ALTER TABLE public.support_inquiries
ADD CONSTRAINT support_inquiries_name_length_check CHECK (char_length(name) <= 100),
ADD CONSTRAINT support_inquiries_email_length_check CHECK (char_length(email) <= 320),
ADD CONSTRAINT support_inquiries_subject_length_check CHECK (char_length(subject) <= 255),
ADD CONSTRAINT support_inquiries_message_length_check CHECK (char_length(message) <= 5000);

-- 8. Realtime Chat tables
ALTER TABLE public.workspace_chat_messages
DROP CONSTRAINT IF EXISTS workspace_chat_messages_content_length_check;

UPDATE public.workspace_chat_messages SET content = left(content, 10000) WHERE char_length(content) > 10000;

ALTER TABLE public.workspace_chat_messages
ADD CONSTRAINT workspace_chat_messages_content_length_check CHECK (char_length(content) <= 10000);

ALTER TABLE public.workspace_chat_channels
DROP CONSTRAINT IF EXISTS workspace_chat_channels_name_length_check,
DROP CONSTRAINT IF EXISTS workspace_chat_channels_description_length_check;

UPDATE public.workspace_chat_channels SET name = left(name, 100) WHERE char_length(name) > 100;
UPDATE public.workspace_chat_channels SET description = left(description, 1000) WHERE char_length(description) > 1000;

ALTER TABLE public.workspace_chat_channels
ADD CONSTRAINT workspace_chat_channels_name_length_check CHECK (char_length(name) <= 100),
ADD CONSTRAINT workspace_chat_channels_description_length_check CHECK (char_length(description) <= 1000);

-- 9. Catch-all for other text fields across all tables
-- This dynamically adds a 10,000 character limit to any TEXT column in the public schema
-- that doesn't already have a more specific constraint. This is a safety net.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT c.table_name, c.column_name
        FROM information_schema.columns c
        JOIN information_schema.tables t ON c.table_schema = t.table_schema AND c.table_name = t.table_name
        WHERE c.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND c.data_type = 'text'
        AND c.table_name NOT IN ('users', 'user_private_details', 'workspaces', 'tasks', 'ai_chat_messages', 'workspace_calendar_events', 'support_inquiries', 'workspace_chat_messages', 'workspace_chat_channels')
    LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I_length_check', r.table_name, r.column_name);
        EXECUTE format('UPDATE public.%I SET %I = left(%I, 10000) WHERE char_length(%I) > 10000', r.table_name, r.column_name, r.column_name, r.column_name);
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I_length_check CHECK (char_length(%I) <= 10000)', r.table_name, r.column_name, r.column_name);
    END LOOP;
END $$;

-- 10. Catch-all for JSONB fields across all tables
-- Limits JSONB fields to 1,000,000 characters (approx 1MB)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT c.table_name, c.column_name
        FROM information_schema.columns c
        JOIN information_schema.tables t ON c.table_schema = t.table_schema AND c.table_name = t.table_name
        WHERE c.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND c.data_type = 'jsonb'
    LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I_payload_size_check', r.table_name, r.column_name);
        -- Using pg_column_size or length of text representation
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I_payload_size_check CHECK (octet_length(%I::text) <= 1048576)', r.table_name, r.column_name, r.column_name);
    END LOOP;
END $$;
