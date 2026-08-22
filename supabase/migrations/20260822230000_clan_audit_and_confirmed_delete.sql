-- Owner-only audit trail for meaningful clan changes.
CREATE TABLE IF NOT EXISTS public.clan_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  actor_user_id uuid,
  actor_username text NOT NULL DEFAULT 'System',
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clan_action_logs_clan_created
  ON public.clan_action_logs(clan_id, created_at DESC);

ALTER TABLE public.clan_action_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clan owner can view action history" ON public.clan_action_logs;
CREATE POLICY "Clan owner can view action history" ON public.clan_action_logs FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.clans c WHERE c.id = clan_action_logs.clan_id AND c.owner_id = auth.uid()
));

CREATE OR REPLACE FUNCTION public.audit_clan_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_clan_id uuid;
  v_action text;
  v_actor uuid := auth.uid();
  v_username text;
  v_details jsonb := '{}'::jsonb;
BEGIN
  IF TG_TABLE_NAME = 'clans' THEN
    v_clan_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  ELSE
    v_clan_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.clan_id ELSE NEW.clan_id END;
  END IF;
  -- A cascading clan deletion must not attempt to create child audit rows.
  IF NOT EXISTS (SELECT 1 FROM public.clans WHERE id = v_clan_id) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  SELECT username INTO v_username FROM public.profiles WHERE user_id = v_actor;

  IF TG_TABLE_NAME = 'clans' THEN
    IF TG_OP <> 'UPDATE' OR (NEW.name, NEW.tag, NEW.emoji, NEW.description) IS NOT DISTINCT FROM (OLD.name, OLD.tag, OLD.emoji, OLD.description) THEN RETURN NEW; END IF;
    v_action := 'clan_updated';
    v_details := jsonb_build_object('old_name', OLD.name, 'new_name', NEW.name, 'old_tag', OLD.tag, 'new_tag', NEW.tag);
  ELSIF TG_TABLE_NAME = 'clan_members' THEN
    IF TG_OP = 'INSERT' THEN v_action := 'member_joined'; v_details := jsonb_build_object('user_id', NEW.user_id);
    ELSIF TG_OP = 'DELETE' THEN v_action := 'member_left'; v_details := jsonb_build_object('user_id', OLD.user_id);
    ELSIF NEW.role_id IS DISTINCT FROM OLD.role_id THEN v_action := 'member_role_changed'; v_details := jsonb_build_object('user_id', NEW.user_id, 'old_role_id', OLD.role_id, 'new_role_id', NEW.role_id);
    ELSE RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'clan_roles' THEN
    v_action := CASE TG_OP WHEN 'INSERT' THEN 'role_created' WHEN 'UPDATE' THEN 'role_updated' ELSE 'role_deleted' END;
    v_details := jsonb_build_object('role_name', CASE WHEN TG_OP = 'DELETE' THEN OLD.name ELSE NEW.name END);
  ELSE IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;

  INSERT INTO public.clan_action_logs(clan_id, actor_user_id, actor_username, action, details)
  VALUES (v_clan_id, v_actor, COALESCE(v_username, 'System'), v_action, v_details);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_clan_update ON public.clans;
CREATE TRIGGER trg_audit_clan_update AFTER UPDATE ON public.clans FOR EACH ROW EXECUTE FUNCTION public.audit_clan_change();
DROP TRIGGER IF EXISTS trg_audit_clan_member ON public.clan_members;
CREATE TRIGGER trg_audit_clan_member AFTER INSERT OR UPDATE OR DELETE ON public.clan_members FOR EACH ROW EXECUTE FUNCTION public.audit_clan_change();
DROP TRIGGER IF EXISTS trg_audit_clan_role ON public.clan_roles;
CREATE TRIGGER trg_audit_clan_role AFTER INSERT OR UPDATE OR DELETE ON public.clan_roles FOR EACH ROW EXECUTE FUNCTION public.audit_clan_change();

CREATE OR REPLACE FUNCTION public.delete_clan_confirmed(p_clan_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_clan public.clans%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_clan FROM public.clans WHERE owner_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not an owner'; END IF;
  IF p_clan_name IS DISTINCT FROM v_clan.name THEN RAISE EXCEPTION 'Clan name does not match'; END IF;
  IF v_clan.treasury > 0 THEN
    UPDATE public.game_saves SET pending_balance = pending_balance + v_clan.treasury WHERE user_id = v_uid;
  END IF;
  DELETE FROM public.clans WHERE id = v_clan.id;
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_clan_confirmed(text) TO authenticated;

-- Seven typed showcase slots plus room for future additions.
CREATE OR REPLACE FUNCTION public.update_profile_extras(p_avatar_url text, p_showcase jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_avatar_url IS NOT NULL AND length(p_avatar_url) > 500 THEN RAISE EXCEPTION 'avatar_url too long'; END IF;
  IF p_showcase IS NOT NULL AND jsonb_typeof(p_showcase) <> 'array' THEN RAISE EXCEPTION 'showcase must be array'; END IF;
  IF p_showcase IS NOT NULL AND jsonb_array_length(p_showcase) > 12 THEN RAISE EXCEPTION 'Max 12 showcase items'; END IF;
  UPDATE public.profiles SET avatar_url = COALESCE(p_avatar_url, avatar_url), showcase_items = COALESCE(p_showcase, showcase_items)
  WHERE user_id = v_uid;
  RETURN jsonb_build_object('success', true);
END; $$;
