-- Enforce that personal workspaces can only have one member.
-- This is a defense-in-depth measure that catches any bypass of application-level guards.
CREATE OR REPLACE FUNCTION public.enforce_personal_workspace_single_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF is_personal_workspace(NEW.ws_id) AND get_workspace_member_count(NEW.ws_id) >= 1 THEN
    RAISE EXCEPTION 'Personal workspaces can only have one member' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_personal_workspace_single_member
  BEFORE INSERT ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_personal_workspace_single_member();

-- Prevent manual deletion of personal workspaces.
-- Allows CASCADE from account deletion (auth.users record removed first).
CREATE OR REPLACE FUNCTION public.prevent_personal_workspace_deletion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.personal = true THEN
    -- Allow deletion if the creator's account no longer exists (account deletion cascade)
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.creator_id) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Personal workspaces cannot be deleted manually' USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_prevent_personal_workspace_deletion
  BEFORE DELETE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.prevent_personal_workspace_deletion();
