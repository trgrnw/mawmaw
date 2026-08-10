-- ============ CLANS ============
CREATE TABLE public.clans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  tag text NOT NULL UNIQUE CHECK (length(tag) BETWEEN 2 AND 5),
  description text DEFAULT '',
  emoji text NOT NULL DEFAULT '🏛️',
  treasury numeric NOT NULL DEFAULT 0 CHECK (treasury >= 0),
  owner_id uuid NOT NULL,
  total_net_worth numeric NOT NULL DEFAULT 0,
  member_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clan_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#9CA3AF',
  rank integer NOT NULL DEFAULT 0,
  is_owner_role boolean NOT NULL DEFAULT false,
  perm_invite boolean NOT NULL DEFAULT false,
  perm_kick boolean NOT NULL DEFAULT false,
  perm_treasury boolean NOT NULL DEFAULT false,
  perm_edit_clan boolean NOT NULL DEFAULT false,
  perm_manage_roles boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clan_id, name)
);

CREATE TABLE public.clan_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE,
  role_id uuid NOT NULL REFERENCES public.clan_roles(id) ON DELETE RESTRICT,
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clan_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL,
  invitee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE(clan_id, invitee_id, status)
);

CREATE TABLE public.clan_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  username text NOT NULL DEFAULT 'Player',
  message text NOT NULL CHECK (length(message) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clan_treasury_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  username text NOT NULL DEFAULT 'Player',
  action text NOT NULL CHECK (action IN ('deposit','withdraw')),
  amount numeric NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clan_members_clan ON public.clan_members(clan_id);
CREATE INDEX idx_clan_chat_clan ON public.clan_chat_messages(clan_id, created_at DESC);
CREATE INDEX idx_clan_treasury_clan ON public.clan_treasury_logs(clan_id, created_at DESC);
CREATE INDEX idx_clan_invites_invitee ON public.clan_invites(invitee_id, status);

-- ============ NET_WORTH HISTORY ============
CREATE TABLE public.net_worth_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  net_worth numeric NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_net_worth_history_user ON public.net_worth_history(user_id, recorded_at DESC);

-- ============ HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.get_user_clan_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT clan_id FROM public.clan_members WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_has_clan_perm(_user_id uuid, _clan_id uuid, _perm text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_has boolean;
BEGIN
  SELECT CASE _perm
    WHEN 'invite' THEN r.perm_invite
    WHEN 'kick' THEN r.perm_kick
    WHEN 'treasury' THEN r.perm_treasury
    WHEN 'edit_clan' THEN r.perm_edit_clan
    WHEN 'manage_roles' THEN r.perm_manage_roles
    ELSE false
  END INTO v_has
  FROM public.clan_members m
  JOIN public.clan_roles r ON r.id = m.role_id
  WHERE m.user_id = _user_id AND m.clan_id = _clan_id;
  RETURN COALESCE(v_has, false);
END;
$$;

-- ============ CLAN OPERATIONS ============
CREATE OR REPLACE FUNCTION public.create_clan(p_name text, p_tag text, p_emoji text, p_description text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clan_id uuid;
  v_owner_role_id uuid;
  v_member_role_id uuid;
  v_save game_saves%ROWTYPE;
  v_cost numeric := 50000;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM clan_members WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Already in a clan';
  END IF;
  IF length(trim(p_name)) < 3 OR length(p_name) > 30 THEN RAISE EXCEPTION 'Invalid name'; END IF;
  IF length(p_tag) < 2 OR length(p_tag) > 5 THEN RAISE EXCEPTION 'Invalid tag'; END IF;

  SELECT * INTO v_save FROM game_saves WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No game save'; END IF;
  IF (v_save.game_state->>'money')::numeric < v_cost THEN
    RAISE EXCEPTION 'Insufficient funds (need $%)', v_cost;
  END IF;

  UPDATE game_saves SET pending_balance = pending_balance - v_cost WHERE user_id = v_uid;

  INSERT INTO clans (name, tag, emoji, description, owner_id)
  VALUES (trim(p_name), upper(trim(p_tag)), COALESCE(p_emoji,'🏛️'), COALESCE(p_description,''), v_uid)
  RETURNING id INTO v_clan_id;

  INSERT INTO clan_roles (clan_id, name, color, rank, is_owner_role, perm_invite, perm_kick, perm_treasury, perm_edit_clan, perm_manage_roles)
  VALUES (v_clan_id, 'Владелец', '#FBBF24', 100, true, true, true, true, true, true)
  RETURNING id INTO v_owner_role_id;

  INSERT INTO clan_roles (clan_id, name, color, rank, perm_invite, perm_kick, perm_treasury, perm_edit_clan, perm_manage_roles)
  VALUES (v_clan_id, 'Участник', '#9CA3AF', 0, false, false, false, false, false)
  RETURNING id INTO v_member_role_id;

  INSERT INTO clan_members (clan_id, user_id, role_id) VALUES (v_clan_id, v_uid, v_owner_role_id);

  RETURN jsonb_build_object('success', true, 'clan_id', v_clan_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_to_clan(p_invitee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_clan_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_clan_id := get_user_clan_id(v_uid);
  IF v_clan_id IS NULL THEN RAISE EXCEPTION 'Not in a clan'; END IF;
  IF NOT user_has_clan_perm(v_uid, v_clan_id, 'invite') THEN RAISE EXCEPTION 'No permission'; END IF;
  IF EXISTS (SELECT 1 FROM clan_members WHERE user_id = p_invitee_id) THEN RAISE EXCEPTION 'User already in a clan'; END IF;
  IF EXISTS (SELECT 1 FROM clan_invites WHERE clan_id = v_clan_id AND invitee_id = p_invitee_id AND status='pending') THEN
    RAISE EXCEPTION 'Already invited';
  END IF;
  INSERT INTO clan_invites (clan_id, inviter_id, invitee_id) VALUES (v_clan_id, v_uid, p_invitee_id);
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_clan_invite(p_invite_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_invite clan_invites%ROWTYPE;
  v_member_role_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_invite FROM clan_invites WHERE id = p_invite_id AND invitee_id = v_uid AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF p_accept THEN
    IF EXISTS (SELECT 1 FROM clan_members WHERE user_id = v_uid) THEN RAISE EXCEPTION 'Already in clan'; END IF;
    SELECT id INTO v_member_role_id FROM clan_roles WHERE clan_id = v_invite.clan_id AND is_owner_role=false ORDER BY rank ASC LIMIT 1;
    INSERT INTO clan_members (clan_id, user_id, role_id) VALUES (v_invite.clan_id, v_uid, v_member_role_id);
    UPDATE clans SET member_count = member_count + 1 WHERE id = v_invite.clan_id;
    UPDATE clan_invites SET status='accepted', responded_at=now() WHERE id = p_invite_id;
  ELSE
    UPDATE clan_invites SET status='declined', responded_at=now() WHERE id = p_invite_id;
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.kick_clan_member(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_clan_id uuid; v_target_clan uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_clan_id := get_user_clan_id(v_uid);
  v_target_clan := get_user_clan_id(p_user_id);
  IF v_clan_id IS NULL OR v_clan_id <> v_target_clan THEN RAISE EXCEPTION 'Not same clan'; END IF;
  IF EXISTS (SELECT 1 FROM clans WHERE id = v_clan_id AND owner_id = p_user_id) THEN RAISE EXCEPTION 'Cannot kick owner'; END IF;
  IF NOT user_has_clan_perm(v_uid, v_clan_id, 'kick') THEN RAISE EXCEPTION 'No permission'; END IF;
  DELETE FROM clan_members WHERE user_id = p_user_id;
  UPDATE clans SET member_count = GREATEST(member_count - 1, 0) WHERE id = v_clan_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_clan()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_clan_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_clan_id := get_user_clan_id(v_uid);
  IF v_clan_id IS NULL THEN RAISE EXCEPTION 'Not in a clan'; END IF;
  IF EXISTS (SELECT 1 FROM clans WHERE id = v_clan_id AND owner_id = v_uid) THEN
    RAISE EXCEPTION 'Owner cannot leave - delete clan or transfer ownership';
  END IF;
  DELETE FROM clan_members WHERE user_id = v_uid;
  UPDATE clans SET member_count = GREATEST(member_count - 1, 0) WHERE id = v_clan_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_clan()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_clan clans%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_clan FROM clans WHERE owner_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not an owner'; END IF;
  IF v_clan.treasury > 0 THEN
    UPDATE game_saves SET pending_balance = pending_balance + v_clan.treasury WHERE user_id = v_uid;
  END IF;
  DELETE FROM clans WHERE id = v_clan.id;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_clan_info(p_name text, p_tag text, p_emoji text, p_description text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid(); v_clan_id uuid; v_save game_saves%ROWTYPE;
  v_cost_name numeric := 10000; v_cost_tag numeric := 10000; v_total numeric := 0;
  v_clan clans%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_clan_id := get_user_clan_id(v_uid);
  IF v_clan_id IS NULL THEN RAISE EXCEPTION 'Not in a clan'; END IF;
  IF NOT user_has_clan_perm(v_uid, v_clan_id, 'edit_clan') THEN RAISE EXCEPTION 'No permission'; END IF;
  SELECT * INTO v_clan FROM clans WHERE id = v_clan_id FOR UPDATE;

  IF p_name IS NOT NULL AND trim(p_name) <> v_clan.name THEN v_total := v_total + v_cost_name; END IF;
  IF p_tag IS NOT NULL AND upper(trim(p_tag)) <> v_clan.tag THEN v_total := v_total + v_cost_tag; END IF;

  IF v_total > 0 THEN
    SELECT * INTO v_save FROM game_saves WHERE user_id = v_uid FOR UPDATE;
    IF (v_save.game_state->>'money')::numeric < v_total THEN RAISE EXCEPTION 'Insufficient funds (need $%)', v_total; END IF;
    UPDATE game_saves SET pending_balance = pending_balance - v_total WHERE user_id = v_uid;
  END IF;

  UPDATE clans SET
    name = COALESCE(NULLIF(trim(p_name),''), name),
    tag = COALESCE(NULLIF(upper(trim(p_tag)),''), tag),
    emoji = COALESCE(NULLIF(p_emoji,''), emoji),
    description = COALESCE(p_description, description),
    updated_at = now()
  WHERE id = v_clan_id;
  RETURN jsonb_build_object('success', true, 'cost', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.clan_treasury_op(p_action text, p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_clan_id uuid; v_save game_saves%ROWTYPE; v_uname text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  v_clan_id := get_user_clan_id(v_uid);
  IF v_clan_id IS NULL THEN RAISE EXCEPTION 'Not in a clan'; END IF;

  SELECT username INTO v_uname FROM profiles WHERE user_id = v_uid;

  IF p_action = 'deposit' THEN
    SELECT * INTO v_save FROM game_saves WHERE user_id = v_uid FOR UPDATE;
    IF (v_save.game_state->>'money')::numeric < p_amount THEN RAISE EXCEPTION 'Insufficient funds'; END IF;
    UPDATE game_saves SET pending_balance = pending_balance - p_amount WHERE user_id = v_uid;
    UPDATE clans SET treasury = treasury + p_amount WHERE id = v_clan_id;
  ELSIF p_action = 'withdraw' THEN
    IF NOT user_has_clan_perm(v_uid, v_clan_id, 'treasury') THEN RAISE EXCEPTION 'No permission'; END IF;
    UPDATE clans SET treasury = treasury - p_amount WHERE id = v_clan_id AND treasury >= p_amount;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient treasury'; END IF;
    UPDATE game_saves SET pending_balance = pending_balance + p_amount WHERE user_id = v_uid;
  ELSE
    RAISE EXCEPTION 'Invalid action';
  END IF;

  INSERT INTO clan_treasury_logs (clan_id, user_id, username, action, amount)
  VALUES (v_clan_id, v_uid, COALESCE(v_uname,'Player'), p_action, p_amount);

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_clan_role(p_name text, p_color text, p_invite boolean, p_kick boolean, p_treasury boolean, p_edit_clan boolean, p_manage_roles boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_clan_id uuid; v_role_id uuid; v_max_rank int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_clan_id := get_user_clan_id(v_uid);
  IF v_clan_id IS NULL OR NOT user_has_clan_perm(v_uid, v_clan_id, 'manage_roles') THEN RAISE EXCEPTION 'No permission'; END IF;
  SELECT COALESCE(MAX(rank),0) INTO v_max_rank FROM clan_roles WHERE clan_id = v_clan_id AND is_owner_role=false;
  INSERT INTO clan_roles (clan_id, name, color, rank, perm_invite, perm_kick, perm_treasury, perm_edit_clan, perm_manage_roles)
  VALUES (v_clan_id, p_name, COALESCE(p_color,'#9CA3AF'), v_max_rank+1, p_invite, p_kick, p_treasury, p_edit_clan, p_manage_roles)
  RETURNING id INTO v_role_id;
  RETURN jsonb_build_object('success', true, 'role_id', v_role_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_clan_role(p_role_id uuid, p_name text, p_color text, p_invite boolean, p_kick boolean, p_treasury boolean, p_edit_clan boolean, p_manage_roles boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_clan_id uuid; v_role clan_roles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_role FROM clan_roles WHERE id = p_role_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Role not found'; END IF;
  IF v_role.is_owner_role THEN RAISE EXCEPTION 'Cannot edit owner role'; END IF;
  v_clan_id := v_role.clan_id;
  IF NOT user_has_clan_perm(v_uid, v_clan_id, 'manage_roles') THEN RAISE EXCEPTION 'No permission'; END IF;
  UPDATE clan_roles SET name=COALESCE(p_name,name), color=COALESCE(p_color,color),
    perm_invite=COALESCE(p_invite,perm_invite), perm_kick=COALESCE(p_kick,perm_kick),
    perm_treasury=COALESCE(p_treasury,perm_treasury), perm_edit_clan=COALESCE(p_edit_clan,perm_edit_clan),
    perm_manage_roles=COALESCE(p_manage_roles,perm_manage_roles)
  WHERE id = p_role_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_clan_role(p_role_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_role clan_roles%ROWTYPE; v_default_role_id uuid;
BEGIN
  SELECT * INTO v_role FROM clan_roles WHERE id = p_role_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF v_role.is_owner_role THEN RAISE EXCEPTION 'Cannot delete owner role'; END IF;
  IF NOT user_has_clan_perm(v_uid, v_role.clan_id, 'manage_roles') THEN RAISE EXCEPTION 'No permission'; END IF;
  SELECT id INTO v_default_role_id FROM clan_roles WHERE clan_id=v_role.clan_id AND is_owner_role=false AND id<>p_role_id ORDER BY rank ASC LIMIT 1;
  IF v_default_role_id IS NULL THEN RAISE EXCEPTION 'Need at least one non-owner role'; END IF;
  UPDATE clan_members SET role_id = v_default_role_id WHERE role_id = p_role_id;
  DELETE FROM clan_roles WHERE id = p_role_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_clan_role(p_user_id uuid, p_role_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_clan_id uuid; v_role clan_roles%ROWTYPE;
BEGIN
  v_clan_id := get_user_clan_id(v_uid);
  IF v_clan_id IS NULL OR v_clan_id <> get_user_clan_id(p_user_id) THEN RAISE EXCEPTION 'Not same clan'; END IF;
  IF NOT user_has_clan_perm(v_uid, v_clan_id, 'manage_roles') THEN RAISE EXCEPTION 'No permission'; END IF;
  SELECT * INTO v_role FROM clan_roles WHERE id = p_role_id;
  IF v_role.clan_id <> v_clan_id THEN RAISE EXCEPTION 'Role not in clan'; END IF;
  IF v_role.is_owner_role THEN RAISE EXCEPTION 'Cannot assign owner role'; END IF;
  IF EXISTS (SELECT 1 FROM clans WHERE id = v_clan_id AND owner_id = p_user_id) THEN RAISE EXCEPTION 'Cannot change owner role'; END IF;
  UPDATE clan_members SET role_id = p_role_id WHERE user_id = p_user_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.send_clan_message(p_message text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_clan_id uuid; v_uname text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_clan_id := get_user_clan_id(v_uid);
  IF v_clan_id IS NULL THEN RAISE EXCEPTION 'Not in a clan'; END IF;
  IF length(trim(p_message)) = 0 OR length(p_message) > 500 THEN RAISE EXCEPTION 'Invalid message'; END IF;
  SELECT username INTO v_uname FROM profiles WHERE user_id = v_uid;
  INSERT INTO clan_chat_messages (clan_id, user_id, username, message)
  VALUES (v_clan_id, v_uid, COALESCE(v_uname,'Player'), p_message);
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============ ENABLE RLS ============
ALTER TABLE public.clans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clan_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clan_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clan_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clan_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clan_treasury_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.net_worth_history ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
CREATE POLICY "Anyone can view clans" ON public.clans FOR SELECT USING (true);
CREATE POLICY "Anyone can view clan roles" ON public.clan_roles FOR SELECT USING (true);
CREATE POLICY "Anyone can view clan members" ON public.clan_members FOR SELECT USING (true);

CREATE POLICY "Users see own invites or own clan" ON public.clan_invites FOR SELECT
  USING (invitee_id = auth.uid() OR inviter_id = auth.uid() OR clan_id = get_user_clan_id(auth.uid()));

CREATE POLICY "Members can view clan chat" ON public.clan_chat_messages FOR SELECT
  USING (clan_id = get_user_clan_id(auth.uid()));

CREATE POLICY "Members can view treasury logs" ON public.clan_treasury_logs FOR SELECT
  USING (clan_id = get_user_clan_id(auth.uid()));

CREATE POLICY "Staff can view net worth history" ON public.net_worth_history FOR SELECT
  USING (is_staff(auth.uid()) OR user_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.clans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clan_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clan_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clan_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clan_treasury_logs;

-- View for clan leaderboard
CREATE OR REPLACE VIEW public.clan_leaderboard AS
SELECT 
  c.id, c.name, c.tag, c.emoji, c.description, c.treasury, c.member_count, c.created_at,
  COALESCE(SUM(gs.net_worth), 0) + c.treasury AS total_net_worth,
  c.owner_id,
  p.username AS owner_name
FROM clans c
LEFT JOIN clan_members cm ON cm.clan_id = c.id
LEFT JOIN game_saves gs ON gs.user_id = cm.user_id
LEFT JOIN profiles p ON p.user_id = c.owner_id
GROUP BY c.id, p.username;