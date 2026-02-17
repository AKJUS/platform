-- Migration to add byte-size (octet_length) constraints to all TEXT columns.
-- Complements the char_length constraints from 20260217120000.
-- This prevents emoji-heavy payloads from consuming excessive storage,
-- since each emoji is 1 char_length but 4+ bytes in UTF-8.

-- 1. Users table
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_display_name_bytes_check,
DROP CONSTRAINT IF EXISTS users_bio_bytes_check;

ALTER TABLE public.users
ADD CONSTRAINT users_display_name_bytes_check CHECK (octet_length(display_name) <= 400),
ADD CONSTRAINT users_bio_bytes_check CHECK (octet_length(bio) <= 4000);

-- 2. User Private Details table
ALTER TABLE public.user_private_details
DROP CONSTRAINT IF EXISTS user_private_details_email_bytes_check;

ALTER TABLE public.user_private_details
ADD CONSTRAINT user_private_details_email_bytes_check CHECK (octet_length(email) <= 1280);

-- 3. Workspaces table
ALTER TABLE public.workspaces
DROP CONSTRAINT IF EXISTS workspaces_name_bytes_check;

ALTER TABLE public.workspaces
ADD CONSTRAINT workspaces_name_bytes_check CHECK (octet_length(name) <= 400);

-- 4. Tasks table
ALTER TABLE public.tasks
DROP CONSTRAINT IF EXISTS tasks_name_bytes_check,
DROP CONSTRAINT IF EXISTS tasks_description_bytes_check;

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_name_bytes_check CHECK (octet_length(name) <= 1020),
ADD CONSTRAINT tasks_description_bytes_check CHECK (octet_length(description) <= 400000);

-- 5. AI Chat Messages table
ALTER TABLE public.ai_chat_messages
DROP CONSTRAINT IF EXISTS ai_chat_messages_content_bytes_check;

ALTER TABLE public.ai_chat_messages
ADD CONSTRAINT ai_chat_messages_content_bytes_check CHECK (octet_length(content) <= 40000);

-- 6. Workspace Calendar Events table
ALTER TABLE public.workspace_calendar_events
DROP CONSTRAINT IF EXISTS calendar_events_title_bytes_check,
DROP CONSTRAINT IF EXISTS calendar_events_description_bytes_check;

ALTER TABLE public.workspace_calendar_events
ADD CONSTRAINT calendar_events_title_bytes_check CHECK (octet_length(title) <= 1020),
ADD CONSTRAINT calendar_events_description_bytes_check CHECK (octet_length(description) <= 40000);

-- 7. Support Inquiries table
ALTER TABLE public.support_inquiries
DROP CONSTRAINT IF EXISTS support_inquiries_name_bytes_check,
DROP CONSTRAINT IF EXISTS support_inquiries_email_bytes_check,
DROP CONSTRAINT IF EXISTS support_inquiries_subject_bytes_check,
DROP CONSTRAINT IF EXISTS support_inquiries_message_bytes_check;

ALTER TABLE public.support_inquiries
ADD CONSTRAINT support_inquiries_name_bytes_check CHECK (octet_length(name) <= 400),
ADD CONSTRAINT support_inquiries_email_bytes_check CHECK (octet_length(email) <= 1280),
ADD CONSTRAINT support_inquiries_subject_bytes_check CHECK (octet_length(subject) <= 1020),
ADD CONSTRAINT support_inquiries_message_bytes_check CHECK (octet_length(message) <= 20000);

-- 8. Realtime Chat tables
ALTER TABLE public.workspace_chat_messages
DROP CONSTRAINT IF EXISTS workspace_chat_messages_content_bytes_check;

ALTER TABLE public.workspace_chat_messages
ADD CONSTRAINT workspace_chat_messages_content_bytes_check CHECK (octet_length(content) <= 40000);

ALTER TABLE public.workspace_chat_channels
DROP CONSTRAINT IF EXISTS workspace_chat_channels_name_bytes_check,
DROP CONSTRAINT IF EXISTS workspace_chat_channels_description_bytes_check;

ALTER TABLE public.workspace_chat_channels
ADD CONSTRAINT workspace_chat_channels_name_bytes_check CHECK (octet_length(name) <= 400),
ADD CONSTRAINT workspace_chat_channels_description_bytes_check CHECK (octet_length(description) <= 4000);

-- 9. Catch-all for other text fields across all base tables
-- Adds a 40KB byte-size limit to any TEXT column not covered above
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
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I_bytes_check', r.table_name, r.column_name);
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I_bytes_check CHECK (octet_length(%I) <= 40000)', r.table_name, r.column_name, r.column_name);
    END LOOP;
END $$;
