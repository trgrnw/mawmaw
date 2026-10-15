REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
-- Server-enforced staff permissions. Owning the web Site is separate from a game role.
CREATE OR REPLACE FUNCTION public.admin_has_permission(p_permission text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND NOT is_user_banned(auth.uid())
 AND COALESCE(auth.jwt()->>'aal','aal1')='aal2'
 AND EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND (
   role='owner' OR (role='admin' AND p_permission IN('players','economy','support','reports','bans','logs','casino','announcements','transactions'))
   OR (role='moderator' AND p_permission IN('support','reports','bans','logs','casino'))));
$$;
GRANT EXECUTE ON FUNCTION public.admin_has_permission(text) TO anon,authenticated,service_role;

-- Narrow browser writes to identity, money, ownership, audit and support records.
REVOKE INSERT,UPDATE,DELETE ON public.user_roles,public.admin_logs,public.support_tickets,public.ticket_messages,
 public.announcements,public.player_reports,public.profile_reviews,public.profile_likes,
 public.market_bids,public.daily_wheel_spins,public.net_worth_history,public.profiles FROM PUBLIC,anon,authenticated;
GRANT UPDATE(avatar_emoji) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Staff can view all roles" ON user_roles;
CREATE POLICY "Own role or authorized owner" ON user_roles FOR SELECT TO authenticated
 USING(user_id=auth.uid() OR admin_has_permission('roles'));
CREATE POLICY "Economy staff read saves" ON game_saves FOR SELECT TO authenticated USING(admin_has_permission('players'));
DROP POLICY IF EXISTS "Staff can view logs" ON admin_logs;
CREATE POLICY "MFA staff read logs" ON admin_logs FOR SELECT TO authenticated USING(admin_has_permission('logs'));
DROP POLICY IF EXISTS "Users see own tickets, staff sees all" ON support_tickets;
CREATE POLICY "Ticket participant reads" ON support_tickets FOR SELECT TO authenticated USING(user_id=auth.uid() OR admin_has_permission('support'));
DROP POLICY IF EXISTS "Read messages of own/staff tickets" ON ticket_messages;
CREATE POLICY "Ticket participant reads messages" ON ticket_messages FOR SELECT TO authenticated
 USING(admin_has_permission('support') OR EXISTS(SELECT 1 FROM support_tickets t WHERE t.id=ticket_id AND t.user_id=auth.uid()));
DROP POLICY IF EXISTS "Anyone can view active announcements" ON announcements;
CREATE POLICY "Read active or authorized announcements" ON announcements FOR SELECT USING(is_active OR admin_has_permission('announcements'));
DROP POLICY IF EXISTS "Reporters see own, staff sees all" ON player_reports;
CREATE POLICY "Report participant reads" ON player_reports FOR SELECT TO authenticated USING(reporter_user_id=auth.uid() OR admin_has_permission('reports'));
DROP POLICY IF EXISTS "Users see own bans, staff sees all" ON user_bans;
CREATE POLICY "Own or authorized bans" ON user_bans FOR SELECT TO authenticated USING(user_id=auth.uid() OR admin_has_permission('bans'));
DROP POLICY IF EXISTS "Players read own bets and staff read history" ON casino_bets;
CREATE POLICY "Own or authorized casino history" ON casino_bets FOR SELECT TO authenticated USING(user_id=auth.uid() OR admin_has_permission('casino'));
CREATE POLICY "Authorized player history" ON net_worth_history FOR SELECT TO authenticated USING(admin_has_permission('transactions'));

CREATE OR REPLACE FUNCTION public.admin_manage_role(p_user_id uuid,p_role text,p_remove boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT admin_has_permission('roles') THEN RAISE EXCEPTION 'Owner with two-factor authentication required'; END IF;
 IF p_role IS NULL OR p_role NOT IN('owner','admin','moderator') OR p_remove IS NULL THEN RAISE EXCEPTION 'Invalid role'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('game-admin-roles'));
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN RAISE EXCEPTION 'Account not found'; END IF;
 IF p_remove THEN
  IF p_role='owner' AND p_user_id=auth.uid() THEN RAISE EXCEPTION 'Cannot remove your own owner role'; END IF;
  IF p_role='owner' AND (SELECT count(*) FROM user_roles WHERE role='owner')<=1 THEN RAISE EXCEPTION 'Cannot remove the last owner'; END IF;
  DELETE FROM user_roles WHERE user_id=p_user_id AND role=p_role::app_role;
 ELSE
  INSERT INTO user_roles(user_id,role) VALUES(p_user_id,p_role::app_role) ON CONFLICT(user_id,role) DO NOTHING;
 END IF;
 INSERT INTO admin_logs(admin_user_id,action,target_user_id,details) VALUES(auth.uid(),CASE WHEN p_remove THEN 'remove_role' ELSE 'assign_role' END,p_user_id,jsonb_build_object('role',p_role));
 RETURN jsonb_build_object('success',true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(p_user_id uuid,p_delta numeric,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v game_saves%ROWTYPE;v_balance numeric;
BEGIN
 IF NOT admin_has_permission('economy') THEN RAISE EXCEPTION 'Economy administrator with two-factor authentication required'; END IF;
 IF p_delta IS NULL OR p_delta=0 OR abs(p_delta)>1e14 OR length(COALESCE(p_reason,''))>500 THEN RAISE EXCEPTION 'Invalid amount or reason'; END IF;
 SELECT * INTO v FROM game_saves WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Player save not found'; END IF;
 v_balance:=COALESCE((v.game_state->>'balance')::numeric,0)+v.pending_balance+p_delta;
 IF v_balance<0 OR v_balance>1e14 THEN RAISE EXCEPTION 'Balance outside allowed range'; END IF;
 UPDATE game_saves SET game_state=jsonb_set(game_state,'{balance}',to_jsonb(v_balance)),pending_balance=0 WHERE user_id=p_user_id;
 INSERT INTO admin_logs(admin_user_id,action,target_user_id,details) VALUES(auth.uid(),'admin_adjust_balance',p_user_id,jsonb_build_object('delta',p_delta,'reason',COALESCE(p_reason,'')));
 RETURN jsonb_build_object('success',true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_save_announcement(p_id uuid,p_title text,p_message text,p_active boolean,p_delete boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid:=p_id;
BEGIN
 IF NOT admin_has_permission('announcements') THEN RAISE EXCEPTION 'No permission'; END IF;
 IF p_delete THEN
  DELETE FROM announcements WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Announcement not found'; END IF;
 ELSIF p_id IS NULL THEN
  IF length(trim(COALESCE(p_title,''))) NOT BETWEEN 3 AND 120 OR length(trim(COALESCE(p_message,''))) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Invalid announcement'; END IF;
  INSERT INTO announcements(title,message,is_active,created_by) VALUES(trim(p_title),trim(p_message),COALESCE(p_active,true),auth.uid()) RETURNING id INTO v_id;
 ELSE
  UPDATE announcements SET is_active=COALESCE(p_active,is_active) WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Announcement not found'; END IF;
 END IF;
 INSERT INTO admin_logs(admin_user_id,action,details) VALUES(auth.uid(),'save_announcement',jsonb_build_object('id',v_id,'deleted',COALESCE(p_delete,false),'active',p_active));
 RETURN jsonb_build_object('success',true,'id',v_id);
END; $$;

-- Support identity and staff badges always come from the session, never request fields.
CREATE OR REPLACE FUNCTION public.create_support_ticket(p_category text,p_subject text,p_message text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_uid uuid:=auth.uid();v_id uuid;v_name text;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 IF p_category IS NULL OR p_category NOT IN('ban_appeal','complaint','bug','other') THEN RAISE EXCEPTION 'Invalid category'; END IF;
 IF length(trim(COALESCE(p_subject,''))) NOT BETWEEN 3 AND 120 OR length(trim(COALESCE(p_message,''))) NOT BETWEEN 5 AND 2000 THEN RAISE EXCEPTION 'Invalid subject or message'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('support:'||v_uid::text));
 IF (SELECT count(*) FROM support_tickets WHERE user_id=v_uid AND status<>'closed')>=5 THEN RAISE EXCEPTION 'Сначала дождитесь ответа или закройте одно из 5 активных обращений'; END IF;
 IF (SELECT count(*) FROM support_tickets WHERE user_id=v_uid AND created_at>now()-interval '1 hour')>=5 THEN RAISE EXCEPTION 'Не более 5 новых обращений в час'; END IF;
 SELECT username INTO v_name FROM profiles WHERE user_id=v_uid;
 INSERT INTO support_tickets(user_id,category,subject) VALUES(v_uid,p_category,trim(p_subject)) RETURNING id INTO v_id;
 INSERT INTO ticket_messages(ticket_id,author_user_id,author_username,is_staff_reply,message) VALUES(v_id,v_uid,COALESCE(v_name,'Player'),false,trim(p_message));
 RETURN jsonb_build_object('success',true,'ticket_id',v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.post_ticket_message(p_ticket_id uuid,p_message text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_uid uuid:=auth.uid();v_ticket support_tickets%ROWTYPE;v_staff boolean;v_name text;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 IF length(trim(COALESCE(p_message,''))) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Invalid message'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('support:'||v_uid::text));
 SELECT * INTO v_ticket FROM support_tickets WHERE id=p_ticket_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found'; END IF;
 v_staff:=admin_has_permission('support');
 IF v_ticket.user_id<>v_uid AND NOT v_staff THEN RAISE EXCEPTION 'No access'; END IF;
 IF v_ticket.status='closed' THEN RAISE EXCEPTION 'Тикет закрыт. Администратор может открыть его повторно'; END IF;
 IF (SELECT count(*) FROM ticket_messages WHERE author_user_id=v_uid AND created_at>now()-interval '1 minute')>=20 THEN RAISE EXCEPTION 'Слишком много сообщений, подождите минуту'; END IF;
 SELECT username INTO v_name FROM profiles WHERE user_id=v_uid;
 INSERT INTO ticket_messages(ticket_id,author_user_id,author_username,is_staff_reply,message) VALUES(p_ticket_id,v_uid,COALESCE(v_name,'Player'),v_staff,trim(p_message));
 UPDATE support_tickets SET status=CASE WHEN v_staff THEN 'in_progress' ELSE status END,updated_at=now() WHERE id=p_ticket_id;
 RETURN jsonb_build_object('success',true);
END; $$;

CREATE OR REPLACE FUNCTION public.close_ticket(p_ticket_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_ticket support_tickets%ROWTYPE;v_uid uuid:=auth.uid();
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 SELECT * INTO v_ticket FROM support_tickets WHERE id=p_ticket_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found'; END IF;
 IF v_ticket.user_id<>v_uid AND NOT admin_has_permission('support') THEN RAISE EXCEPTION 'No access'; END IF;
 IF v_ticket.status<>'closed' THEN
  UPDATE support_tickets SET status='closed',closed_at=now(),closed_by=v_uid WHERE id=p_ticket_id;
  IF admin_has_permission('support') THEN INSERT INTO admin_logs(admin_user_id,action,target_user_id,details) VALUES(v_uid,'close_ticket',v_ticket.user_id,jsonb_build_object('ticket_id',p_ticket_id)); END IF;
 END IF;
 RETURN jsonb_build_object('success',true);
END; $$;
CREATE OR REPLACE FUNCTION public.reopen_ticket(p_ticket_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_target uuid;
BEGIN
 IF NOT admin_has_permission('support') THEN RAISE EXCEPTION 'No permission'; END IF;
 UPDATE support_tickets SET status='in_progress',closed_at=NULL,closed_by=NULL WHERE id=p_ticket_id RETURNING user_id INTO v_target;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found'; END IF;
 INSERT INTO admin_logs(admin_user_id,action,target_user_id,details) VALUES(auth.uid(),'reopen_ticket',v_target,jsonb_build_object('ticket_id',p_ticket_id));
 RETURN jsonb_build_object('success',true);
END; $$;

-- Serialize treasury updates and reject banned accounts/non-finite and excessive amounts.
CREATE OR REPLACE FUNCTION public.clan_treasury_op(p_action text,p_amount numeric) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_uid uuid:=auth.uid();v_clan uuid;v_name text;v_save game_saves%ROWTYPE;v_balance numeric;
BEGIN
 IF v_uid IS NULL OR is_user_banned(v_uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount>1e14 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('clan-economy'));
 v_clan:=get_user_clan_id(v_uid);
 IF v_clan IS NULL THEN RAISE EXCEPTION 'Not in a clan'; END IF;
 PERFORM 1 FROM clans WHERE id=v_clan FOR UPDATE;
 SELECT * INTO v_save FROM game_saves WHERE user_id=v_uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'No save'; END IF;
 IF p_action='deposit' THEN
  PERFORM debit_player(v_uid,p_amount);
  UPDATE clans SET treasury=treasury+p_amount WHERE id=v_clan AND treasury+p_amount<=1e14;
  IF NOT FOUND THEN RAISE EXCEPTION 'Treasury limit reached'; END IF;
 ELSIF p_action='withdraw' THEN
  IF NOT user_has_clan_perm(v_uid,v_clan,'treasury') THEN RAISE EXCEPTION 'No permission'; END IF;
  v_balance:=COALESCE((v_save.game_state->>'balance')::numeric,0)+v_save.pending_balance;
  IF v_balance+p_amount>1e14 THEN RAISE EXCEPTION 'Balance limit reached'; END IF;
  UPDATE clans SET treasury=treasury-p_amount WHERE id=v_clan AND treasury>=p_amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient treasury'; END IF;
  UPDATE game_saves SET pending_balance=pending_balance+p_amount WHERE user_id=v_uid;
 ELSE RAISE EXCEPTION 'Invalid action'; END IF;
 SELECT username INTO v_name FROM profiles WHERE user_id=v_uid;
 INSERT INTO clan_treasury_logs(clan_id,user_id,username,action,amount) VALUES(v_clan,v_uid,COALESCE(v_name,'Player'),p_action,p_amount);
 RETURN jsonb_build_object('success',true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_player_balance(p_user_id uuid, p_balance numeric) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 BEGIN
 IF auth.uid() IS NULL OR NOT admin_has_permission('economy') THEN RAISE EXCEPTION 'No permission'; END IF;
 IF p_balance IS NULL OR p_balance<0 OR p_balance>1e14 THEN RAISE EXCEPTION 'Invalid balance'; END IF;
 UPDATE game_saves SET game_state=jsonb_set(game_state,'{balance}',to_jsonb(p_balance)),pending_balance=0 WHERE user_id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Player save not found'; END IF;
 INSERT INTO admin_logs(admin_user_id,action,target_user_id,details) VALUES(auth.uid(),'change_balance',p_user_id,jsonb_build_object('new_balance',p_balance));
 RETURN jsonb_build_object('success',true);
END; 
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_player(p_user_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 BEGIN
 IF auth.uid() IS NULL OR NOT admin_has_permission('economy') THEN RAISE EXCEPTION 'No permission'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('casino-economy'));PERFORM pg_advisory_xact_lock(hashtext('market-economy'));
 IF EXISTS(SELECT 1 FROM market_listings WHERE status='active' AND(seller_id=p_user_id OR current_bidder_id=p_user_id)) OR EXISTS(SELECT 1 FROM casino_bets WHERE user_id=p_user_id AND result='pending') OR EXISTS(SELECT 1 FROM casino_mines_games WHERE user_id=p_user_id AND status='active') THEN RAISE EXCEPTION 'Finish active trades and games first'; END IF;
 PERFORM 1 FROM game_saves WHERE user_id=p_user_id FOR UPDATE;
 DELETE FROM owned_license_plates WHERE owner_id=p_user_id AND listing_id IS NULL;
 UPDATE game_saves SET game_state='{}',net_worth=0,pending_balance=0,last_seen_at=now() WHERE user_id=p_user_id;
 INSERT INTO admin_logs(admin_user_id,action,target_user_id,details) VALUES(auth.uid(),'reset_progress',p_user_id,'{}');
 RETURN jsonb_build_object('success',true);
END; 
$$;

CREATE OR REPLACE FUNCTION public.ban_user(p_user_id uuid, p_reason text, p_duration_hours integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$

DECLARE v_uid uuid := auth.uid(); v_expires timestamptz; v_type text;
BEGIN
  IF v_uid IS NULL OR NOT admin_has_permission('bans') THEN RAISE EXCEPTION 'No permission'; END IF;
  IF is_staff(p_user_id) THEN RAISE EXCEPTION 'Cannot ban staff member'; END IF;
  -- Deactivate previous active bans
  UPDATE public.user_bans SET is_active = false WHERE user_id = p_user_id AND is_active = true;
  IF p_duration_hours IS NULL OR p_duration_hours <= 0 THEN
    v_type := 'permanent';
    v_expires := NULL;
  ELSE
    v_type := 'temporary';
    v_expires := now() + (p_duration_hours || ' hours')::interval;
  END IF;
  INSERT INTO public.user_bans (user_id, banned_by, reason, ban_type, expires_at)
  VALUES (p_user_id, v_uid, COALESCE(p_reason,''), v_type, v_expires);
  INSERT INTO public.admin_logs (admin_user_id, action, target_user_id, details)
  VALUES (v_uid, 'ban_user', p_user_id, jsonb_build_object('reason', p_reason, 'type', v_type, 'expires_at', v_expires));
  RETURN jsonb_build_object('success', true);
END;

$$;

CREATE OR REPLACE FUNCTION public.unban_user(p_user_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$

DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT admin_has_permission('bans') THEN RAISE EXCEPTION 'No permission'; END IF;
  UPDATE public.user_bans
    SET is_active = false, unbanned_by = v_uid, unbanned_at = now()
    WHERE user_id = p_user_id AND is_active = true;
  INSERT INTO public.admin_logs (admin_user_id, action, target_user_id, details)
  VALUES (v_uid, 'unban_user', p_user_id, '{}'::jsonb);
  RETURN jsonb_build_object('success', true);
END;

$$;

CREATE OR REPLACE FUNCTION public.update_report_status(p_report_id uuid, p_status text, p_note text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$

DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT admin_has_permission('reports') THEN RAISE EXCEPTION 'No permission'; END IF;
  IF p_status NOT IN ('pending','reviewed','accepted','rejected') THEN RAISE EXCEPTION 'Bad status'; END IF;
  UPDATE player_reports SET status = p_status, reviewed_by = v_uid, reviewed_at = now(),
    staff_note = COALESCE(p_note, staff_note)
    WHERE id = p_report_id;
  RETURN jsonb_build_object('success', true);
END; 
$$;

DO $$ DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure signature,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon',f.signature);
  IF f.proname NOT IN('commit_verified_game_state','debit_player','transfer_market_asset','spin_daily_wheel_internal','settle_casino','casino_action','casino_random','save_game_state','claim_offline_income') THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
  END IF;
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.get_forbes_players(),public.get_clan_leaderboard(),public.admin_has_permission(text),public.is_staff(uuid),public.has_role(uuid,app_role) TO anon;
REVOKE EXECUTE ON FUNCTION public.finalize_expired_auctions() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_expired_auctions() TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated;

DROP POLICY IF EXISTS "Staff can view net worth history" ON net_worth_history;
CREATE POLICY "Own net worth history" ON net_worth_history FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.game_request_buckets (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 scope text NOT NULL,window_start timestamptz NOT NULL DEFAULT now(),requests integer NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,scope)
);
ALTER TABLE public.game_request_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_request_buckets FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.consume_game_request(p_user_id uuid,p_scope text,p_limit integer,p_window_seconds integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v game_request_buckets%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF p_user_id IS NULL OR p_scope NOT IN('sync','casino') OR p_limit NOT BETWEEN 1 AND 300 OR p_window_seconds NOT BETWEEN 1 AND 3600 THEN RAISE EXCEPTION 'Invalid limiter configuration'; END IF;
 INSERT INTO game_request_buckets(user_id,scope) VALUES(p_user_id,p_scope) ON CONFLICT DO NOTHING;
 SELECT * INTO v FROM game_request_buckets WHERE user_id=p_user_id AND scope=p_scope FOR UPDATE;
 IF v.window_start<=clock_timestamp()-p_window_seconds*interval '1 second' THEN
  UPDATE game_request_buckets SET window_start=clock_timestamp(),requests=1 WHERE user_id=p_user_id AND scope=p_scope; RETURN true;
 END IF;
 IF v.requests>=p_limit THEN RETURN false; END IF;
 UPDATE game_request_buckets SET requests=requests+1 WHERE user_id=p_user_id AND scope=p_scope;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.consume_game_request(uuid,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_game_request(uuid,text,integer,integer) TO service_role;
