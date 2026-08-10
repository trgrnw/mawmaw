
-- ============ SUPPORT TICKETS ============
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('ban_appeal','complaint','bug','other')),
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by uuid
);
CREATE INDEX idx_tickets_user ON public.support_tickets(user_id);
CREATE INDEX idx_tickets_status ON public.support_tickets(status);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own tickets, staff sees all" ON public.support_tickets
  FOR SELECT USING (user_id = auth.uid() OR is_staff(auth.uid()));
CREATE POLICY "Users create own tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Staff updates tickets" ON public.support_tickets
  FOR UPDATE USING (is_staff(auth.uid()) OR user_id = auth.uid());

CREATE TRIGGER trg_tickets_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TICKET MESSAGES ============
CREATE TABLE public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL,
  author_username text NOT NULL DEFAULT 'Player',
  is_staff_reply boolean NOT NULL DEFAULT false,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_msgs_ticket ON public.ticket_messages(ticket_id, created_at);
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read messages of own/staff tickets" ON public.ticket_messages
  FOR SELECT USING (
    is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Author can insert message" ON public.ticket_messages
  FOR INSERT WITH CHECK (
    author_user_id = auth.uid()
    AND (
      is_staff(auth.uid())
      OR EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid() AND t.status <> 'closed')
    )
  );

-- RPC: post a ticket message and bump ticket
CREATE OR REPLACE FUNCTION public.post_ticket_message(p_ticket_id uuid, p_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_uname text; v_is_staff boolean; v_ticket support_tickets%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(trim(p_message)) = 0 OR length(p_message) > 2000 THEN RAISE EXCEPTION 'Invalid message'; END IF;
  SELECT * INTO v_ticket FROM support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found'; END IF;
  v_is_staff := is_staff(v_uid);
  IF NOT v_is_staff AND v_ticket.user_id <> v_uid THEN RAISE EXCEPTION 'No access'; END IF;
  IF v_ticket.status = 'closed' AND NOT v_is_staff THEN RAISE EXCEPTION 'Ticket closed'; END IF;
  SELECT username INTO v_uname FROM profiles WHERE user_id = v_uid;
  INSERT INTO ticket_messages (ticket_id, author_user_id, author_username, is_staff_reply, message)
  VALUES (p_ticket_id, v_uid, COALESCE(v_uname, CASE WHEN v_is_staff THEN 'Support' ELSE 'Player' END), v_is_staff, trim(p_message));
  IF v_is_staff AND v_ticket.status = 'open' THEN
    UPDATE support_tickets SET status = 'in_progress' WHERE id = p_ticket_id;
  ELSE
    UPDATE support_tickets SET updated_at = now() WHERE id = p_ticket_id;
  END IF;
  RETURN jsonb_build_object('success', true);
END; $$;

-- RPC: create a ticket with first message
CREATE OR REPLACE FUNCTION public.create_support_ticket(p_category text, p_subject text, p_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_uname text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_category NOT IN ('ban_appeal','complaint','bug','other') THEN RAISE EXCEPTION 'Bad category'; END IF;
  IF length(trim(p_subject)) < 3 OR length(p_subject) > 120 THEN RAISE EXCEPTION 'Bad subject'; END IF;
  IF length(trim(p_message)) < 5 OR length(p_message) > 2000 THEN RAISE EXCEPTION 'Bad message'; END IF;
  SELECT username INTO v_uname FROM profiles WHERE user_id = v_uid;
  INSERT INTO support_tickets (user_id, category, subject) VALUES (v_uid, p_category, trim(p_subject)) RETURNING id INTO v_id;
  INSERT INTO ticket_messages (ticket_id, author_user_id, author_username, message)
    VALUES (v_id, v_uid, COALESCE(v_uname,'Player'), trim(p_message));
  RETURN jsonb_build_object('success', true, 'ticket_id', v_id);
END; $$;

-- RPC: close a ticket (staff or owner)
CREATE OR REPLACE FUNCTION public.close_ticket(p_ticket_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_t support_tickets%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_t FROM support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF NOT is_staff(v_uid) AND v_t.user_id <> v_uid THEN RAISE EXCEPTION 'No access'; END IF;
  UPDATE support_tickets SET status = 'closed', closed_at = now(), closed_by = v_uid WHERE id = p_ticket_id;
  RETURN jsonb_build_object('success', true);
END; $$;

-- RPC: reopen ticket (staff only)
CREATE OR REPLACE FUNCTION public.reopen_ticket(p_ticket_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT is_staff(v_uid) THEN RAISE EXCEPTION 'No permission'; END IF;
  UPDATE support_tickets SET status = 'in_progress', closed_at = NULL, closed_by = NULL WHERE id = p_ticket_id;
  RETURN jsonb_build_object('success', true);
END; $$;

-- ============ PLAYER REPORTS ============
CREATE TABLE public.player_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL,
  reported_user_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('cheating','insults','spam','multi','other')),
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','accepted','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  staff_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reports_reported ON public.player_reports(reported_user_id);
CREATE INDEX idx_reports_status ON public.player_reports(status);
ALTER TABLE public.player_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters see own, staff sees all" ON public.player_reports
  FOR SELECT USING (reporter_user_id = auth.uid() OR is_staff(auth.uid()));
CREATE POLICY "Users create reports" ON public.player_reports
  FOR INSERT WITH CHECK (reporter_user_id = auth.uid() AND reporter_user_id <> reported_user_id);
CREATE POLICY "Staff updates reports" ON public.player_reports
  FOR UPDATE USING (is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.submit_player_report(p_reported_user_id uuid, p_category text, p_description text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_uid = p_reported_user_id THEN RAISE EXCEPTION 'Cannot report yourself'; END IF;
  IF p_category NOT IN ('cheating','insults','spam','multi','other') THEN RAISE EXCEPTION 'Bad category'; END IF;
  IF length(p_description) > 1000 THEN RAISE EXCEPTION 'Description too long'; END IF;
  INSERT INTO player_reports (reporter_user_id, reported_user_id, category, description)
  VALUES (v_uid, p_reported_user_id, p_category, COALESCE(p_description,''));
  RETURN jsonb_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public.update_report_status(p_report_id uuid, p_status text, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT is_staff(v_uid) THEN RAISE EXCEPTION 'No permission'; END IF;
  IF p_status NOT IN ('pending','reviewed','accepted','rejected') THEN RAISE EXCEPTION 'Bad status'; END IF;
  UPDATE player_reports SET status = p_status, reviewed_by = v_uid, reviewed_at = now(),
    staff_note = COALESCE(p_note, staff_note)
    WHERE id = p_report_id;
  RETURN jsonb_build_object('success', true);
END; $$;

-- ============ PROFILE: avatar_url + showcase_items ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS showcase_items jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Allow updating avatar/showcase via RPC (extends existing customization)
CREATE OR REPLACE FUNCTION public.update_profile_extras(p_avatar_url text, p_showcase jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_avatar_url IS NOT NULL AND length(p_avatar_url) > 500 THEN RAISE EXCEPTION 'avatar_url too long'; END IF;
  IF p_showcase IS NOT NULL AND jsonb_typeof(p_showcase) <> 'array' THEN RAISE EXCEPTION 'showcase must be array'; END IF;
  IF p_showcase IS NOT NULL AND jsonb_array_length(p_showcase) > 6 THEN RAISE EXCEPTION 'Max 6 showcase items'; END IF;
  UPDATE profiles SET
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    showcase_items = COALESCE(p_showcase, showcase_items)
  WHERE user_id = v_uid;
  RETURN jsonb_build_object('success', true);
END; $$;

-- ============ AVATARS BUCKET ============
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars','avatars', true, 2097152, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============ BUGFIX: claim pending_balance during play ============
-- Periodic safe claim of server-accumulated pending (market sales, offline income, wheel)
CREATE OR REPLACE FUNCTION public.claim_pending_balance()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_pending numeric;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('amount', 0); END IF;
  UPDATE game_saves SET pending_balance = 0
    WHERE user_id = v_uid AND pending_balance <> 0
    RETURNING pending_balance + (SELECT pending_balance FROM game_saves WHERE user_id = v_uid) INTO v_pending;
  -- Simpler: select-then-update
  SELECT pending_balance INTO v_pending FROM game_saves WHERE user_id = v_uid FOR UPDATE;
  IF v_pending IS NULL OR v_pending = 0 THEN RETURN jsonb_build_object('amount', 0); END IF;
  UPDATE game_saves SET pending_balance = 0 WHERE user_id = v_uid;
  RETURN jsonb_build_object('amount', v_pending);
END; $$;

-- ============ BUGFIX: clan cascade delete ============
-- Add foreign keys with cascade for clan-related tables (drop existing if any first)
DO $$ BEGIN
  ALTER TABLE public.clan_members DROP CONSTRAINT IF EXISTS clan_members_clan_id_fkey;
  ALTER TABLE public.clan_roles DROP CONSTRAINT IF EXISTS clan_roles_clan_id_fkey;
  ALTER TABLE public.clan_chat_messages DROP CONSTRAINT IF EXISTS clan_chat_messages_clan_id_fkey;
  ALTER TABLE public.clan_treasury_logs DROP CONSTRAINT IF EXISTS clan_treasury_logs_clan_id_fkey;
  ALTER TABLE public.clan_invites DROP CONSTRAINT IF EXISTS clan_invites_clan_id_fkey;
END $$;

ALTER TABLE public.clan_members
  ADD CONSTRAINT clan_members_clan_id_fkey FOREIGN KEY (clan_id) REFERENCES public.clans(id) ON DELETE CASCADE;
ALTER TABLE public.clan_roles
  ADD CONSTRAINT clan_roles_clan_id_fkey FOREIGN KEY (clan_id) REFERENCES public.clans(id) ON DELETE CASCADE;
ALTER TABLE public.clan_chat_messages
  ADD CONSTRAINT clan_chat_messages_clan_id_fkey FOREIGN KEY (clan_id) REFERENCES public.clans(id) ON DELETE CASCADE;
ALTER TABLE public.clan_treasury_logs
  ADD CONSTRAINT clan_treasury_logs_clan_id_fkey FOREIGN KEY (clan_id) REFERENCES public.clans(id) ON DELETE CASCADE;
ALTER TABLE public.clan_invites
  ADD CONSTRAINT clan_invites_clan_id_fkey FOREIGN KEY (clan_id) REFERENCES public.clans(id) ON DELETE CASCADE;

-- ============ BUGFIX: atomic member_count via trigger ============
CREATE OR REPLACE FUNCTION public.recalc_clan_member_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE clans SET member_count = (SELECT COUNT(*) FROM clan_members WHERE clan_id = NEW.clan_id) WHERE id = NEW.clan_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE clans SET member_count = (SELECT COUNT(*) FROM clan_members WHERE clan_id = OLD.clan_id) WHERE id = OLD.clan_id;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_clan_member_count ON public.clan_members;
CREATE TRIGGER trg_clan_member_count
  AFTER INSERT OR DELETE ON public.clan_members
  FOR EACH ROW EXECUTE FUNCTION public.recalc_clan_member_count();

-- Recompute existing counts now
UPDATE public.clans c SET member_count = (SELECT COUNT(*) FROM clan_members m WHERE m.clan_id = c.id);
