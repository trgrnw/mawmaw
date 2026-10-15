-- Run only in the trusted Supabase SQL editor after identifying the intended
-- account in Authentication > Users. Replace the placeholder with that UUID.
-- This file is deliberately NOT a migration and never runs on player input.
DO $$
DECLARE target_user uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
 IF current_user NOT IN('postgres','supabase_admin') THEN RAISE EXCEPTION 'Use the trusted project SQL editor'; END IF;
 IF target_user='00000000-0000-0000-0000-000000000000'::uuid THEN RAISE EXCEPTION 'Replace the placeholder with the verified game account UUID'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=target_user) THEN RAISE EXCEPTION 'Account not found'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('game-admin-roles'));
 INSERT INTO public.user_roles(user_id,role) VALUES(target_user,'owner') ON CONFLICT(user_id,role) DO NOTHING;
 INSERT INTO public.admin_logs(admin_user_id,action,target_user_id,details)
 VALUES(target_user,'bootstrap_owner',target_user,jsonb_build_object('source','trusted SQL editor'));
END $$;
