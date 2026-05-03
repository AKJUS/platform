-- Reuse workspace-specific user profiles when platform users join later.
--
-- Workspace admins can create a workspace_users row before a platform user
-- accepts an invite. When that user joins, link to the existing profile if
-- there is exactly one unlinked profile with the same email in the workspace.

CREATE OR REPLACE FUNCTION public.create_workspace_user_linked_user()
RETURNS TRIGGER AS $$
DECLARE
  new_workspace_user_id uuid;
  matching_workspace_user_count integer := 0;
  matching_workspace_user_id uuid;
  user_display_name text;
  user_email text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.workspace_user_linked_users wul
    WHERE wul.platform_user_id = NEW.user_id
      AND wul.ws_id = NEW.ws_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT u.display_name, NULLIF(TRIM(COALESCE(upd.email, '')), '')
  INTO user_display_name, user_email
  FROM public.users u
  LEFT JOIN public.user_private_details upd ON upd.user_id = u.id
  WHERE u.id = NEW.user_id;

  IF user_display_name IS NULL THEN
    RETURN NEW;
  END IF;

  IF user_email IS NOT NULL THEN
    SELECT COUNT(*), (ARRAY_AGG(wu.id ORDER BY wu.id::text))[1]
    INTO matching_workspace_user_count, matching_workspace_user_id
    FROM public.workspace_users wu
    WHERE wu.ws_id = NEW.ws_id
      AND wu.email IS NOT NULL
      AND LOWER(TRIM(wu.email)) = LOWER(user_email)
      AND NOT EXISTS (
        SELECT 1
        FROM public.workspace_user_linked_users wul
        WHERE wul.virtual_user_id = wu.id
      );
  END IF;

  IF matching_workspace_user_count = 1 AND matching_workspace_user_id IS NOT NULL THEN
    new_workspace_user_id := matching_workspace_user_id;
  ELSE
    new_workspace_user_id := gen_random_uuid();

    INSERT INTO public.workspace_users (id, ws_id, display_name, email)
    VALUES (new_workspace_user_id, NEW.ws_id, user_display_name, COALESCE(user_email, ''));
  END IF;

  INSERT INTO public.workspace_user_linked_users (platform_user_id, virtual_user_id, ws_id)
  VALUES (NEW.user_id, new_workspace_user_id, NEW.ws_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.consolidate_workspace_user_links(target_ws_id uuid DEFAULT NULL)
RETURNS TABLE(
  platform_user_id uuid,
  ws_id uuid,
  action text
) AS $$
DECLARE
  rec RECORD;
  new_workspace_user_id uuid;
  matching_workspace_user_count integer := 0;
  matching_workspace_user_id uuid;
  user_display_name text;
  user_email text;
BEGIN
  FOR rec IN
    SELECT wm.user_id, wm.ws_id
    FROM public.workspace_members wm
    WHERE (target_ws_id IS NULL OR wm.ws_id = target_ws_id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.workspace_user_linked_users wul
        WHERE wul.platform_user_id = wm.user_id
          AND wul.ws_id = wm.ws_id
      )
  LOOP
    matching_workspace_user_count := 0;
    matching_workspace_user_id := NULL;
    new_workspace_user_id := NULL;

    SELECT u.display_name, NULLIF(TRIM(COALESCE(upd.email, '')), '')
    INTO user_display_name, user_email
    FROM public.users u
    LEFT JOIN public.user_private_details upd ON upd.user_id = u.id
    WHERE u.id = rec.user_id;

    IF user_display_name IS NULL THEN
      CONTINUE;
    END IF;

    IF user_email IS NOT NULL THEN
      SELECT COUNT(*), (ARRAY_AGG(wu.id ORDER BY wu.id::text))[1]
      INTO matching_workspace_user_count, matching_workspace_user_id
      FROM public.workspace_users wu
      WHERE wu.ws_id = rec.ws_id
        AND wu.email IS NOT NULL
        AND LOWER(TRIM(wu.email)) = LOWER(user_email)
        AND NOT EXISTS (
          SELECT 1
          FROM public.workspace_user_linked_users wul
          WHERE wul.virtual_user_id = wu.id
        );
    END IF;

    IF matching_workspace_user_count = 1 AND matching_workspace_user_id IS NOT NULL THEN
      new_workspace_user_id := matching_workspace_user_id;
      action := 'linked_existing';
    ELSE
      new_workspace_user_id := gen_random_uuid();
      action := 'created';

      INSERT INTO public.workspace_users (id, ws_id, display_name, email)
      VALUES (new_workspace_user_id, rec.ws_id, user_display_name, COALESCE(user_email, ''));
    END IF;

    INSERT INTO public.workspace_user_linked_users (platform_user_id, virtual_user_id, ws_id)
    VALUES (rec.user_id, new_workspace_user_id, rec.ws_id);

    platform_user_id := rec.user_id;
    ws_id := rec.ws_id;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.ensure_workspace_user_link(
  target_user_id uuid,
  target_ws_id uuid
)
RETURNS uuid AS $$
DECLARE
  existing_virtual_user_id uuid;
  matching_workspace_user_count integer := 0;
  matching_workspace_user_id uuid;
  new_workspace_user_id uuid;
  user_display_name text;
  user_email text;
BEGIN
  SELECT virtual_user_id INTO existing_virtual_user_id
  FROM public.workspace_user_linked_users
  WHERE platform_user_id = target_user_id
    AND ws_id = target_ws_id;

  IF existing_virtual_user_id IS NOT NULL THEN
    RETURN existing_virtual_user_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE user_id = target_user_id
      AND ws_id = target_ws_id
  ) THEN
    RAISE EXCEPTION 'User % is not a member of workspace %', target_user_id, target_ws_id;
  END IF;

  SELECT u.display_name, NULLIF(TRIM(COALESCE(upd.email, '')), '')
  INTO user_display_name, user_email
  FROM public.users u
  LEFT JOIN public.user_private_details upd ON upd.user_id = u.id
  WHERE u.id = target_user_id;

  IF user_display_name IS NULL THEN
    RAISE EXCEPTION 'User % not found', target_user_id;
  END IF;

  IF user_email IS NOT NULL THEN
    SELECT COUNT(*), (ARRAY_AGG(wu.id ORDER BY wu.id::text))[1]
    INTO matching_workspace_user_count, matching_workspace_user_id
    FROM public.workspace_users wu
    WHERE wu.ws_id = target_ws_id
      AND wu.email IS NOT NULL
      AND LOWER(TRIM(wu.email)) = LOWER(user_email)
      AND NOT EXISTS (
        SELECT 1
        FROM public.workspace_user_linked_users wul
        WHERE wul.virtual_user_id = wu.id
      );
  END IF;

  IF matching_workspace_user_count = 1 AND matching_workspace_user_id IS NOT NULL THEN
    new_workspace_user_id := matching_workspace_user_id;
  ELSE
    new_workspace_user_id := gen_random_uuid();

    INSERT INTO public.workspace_users (id, ws_id, display_name, email)
    VALUES (new_workspace_user_id, target_ws_id, user_display_name, COALESCE(user_email, ''));
  END IF;

  INSERT INTO public.workspace_user_linked_users (platform_user_id, virtual_user_id, ws_id)
  VALUES (target_user_id, new_workspace_user_id, target_ws_id);

  RETURN new_workspace_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.consolidate_workspace_user_links(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_workspace_user_link(uuid, uuid) TO authenticated;
