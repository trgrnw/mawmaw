-- ============= 1. DAILY WHEEL =============
CREATE TABLE public.daily_wheel_spins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prize_type text NOT NULL,
  prize_amount numeric NOT NULL DEFAULT 0,
  prize_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_daily_wheel_user ON public.daily_wheel_spins(user_id, created_at DESC);
ALTER TABLE public.daily_wheel_spins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own spins" ON public.daily_wheel_spins
  FOR SELECT USING (auth.uid() = user_id OR is_staff(auth.uid()));

-- ============= 2. PROFILE CUSTOMIZATION =============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS frame_id text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS status_text text DEFAULT '';

-- ============= 3. BANS =============
CREATE TABLE public.user_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  banned_by uuid,
  reason text NOT NULL DEFAULT '',
  ban_type text NOT NULL DEFAULT 'temporary', -- 'temporary' | 'permanent'
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  unbanned_by uuid,
  unbanned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_bans_active ON public.user_bans(user_id, is_active);
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own bans, staff sees all" ON public.user_bans
  FOR SELECT USING (user_id = auth.uid() OR is_staff(auth.uid()));

-- ============= FUNCTIONS =============

-- Check if user is currently banned
CREATE OR REPLACE FUNCTION public.is_user_banned(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_bans
    WHERE user_id = _user_id
      AND is_active = true
      AND (ban_type = 'permanent' OR (expires_at IS NOT NULL AND expires_at > now()))
  );
$$;

-- Auto-expire old temporary bans (called on read)
CREATE OR REPLACE FUNCTION public.get_active_ban(_user_id uuid)
RETURNS TABLE(id uuid, reason text, ban_type text, expires_at timestamptz, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Auto-deactivate expired temp bans
  UPDATE public.user_bans
    SET is_active = false
    WHERE user_id = _user_id AND is_active = true AND ban_type = 'temporary'
      AND expires_at IS NOT NULL AND expires_at <= now();
  RETURN QUERY
    SELECT b.id, b.reason, b.ban_type, b.expires_at, b.created_at
    FROM public.user_bans b
    WHERE b.user_id = _user_id AND b.is_active = true
    ORDER BY b.created_at DESC LIMIT 1;
END;
$$;

-- Ban a user (staff only)
CREATE OR REPLACE FUNCTION public.ban_user(p_user_id uuid, p_reason text, p_duration_hours integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_expires timestamptz; v_type text;
BEGIN
  IF v_uid IS NULL OR NOT is_staff(v_uid) THEN RAISE EXCEPTION 'No permission'; END IF;
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

-- Unban a user
CREATE OR REPLACE FUNCTION public.unban_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT is_staff(v_uid) THEN RAISE EXCEPTION 'No permission'; END IF;
  UPDATE public.user_bans
    SET is_active = false, unbanned_by = v_uid, unbanned_at = now()
    WHERE user_id = p_user_id AND is_active = true;
  INSERT INTO public.admin_logs (admin_user_id, action, target_user_id, details)
  VALUES (v_uid, 'unban_user', p_user_id, '{}'::jsonb);
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Block bans from saving game state
CREATE OR REPLACE FUNCTION public.block_banned_save()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF is_user_banned(NEW.user_id) THEN
    RAISE EXCEPTION 'User is banned';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_banned_save ON public.game_saves;
CREATE TRIGGER trg_block_banned_save
  BEFORE UPDATE ON public.game_saves
  FOR EACH ROW EXECUTE FUNCTION public.block_banned_save();

-- ============= DAILY WHEEL FUNCTION =============
CREATE OR REPLACE FUNCTION public.spin_daily_wheel()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_last timestamptz;
  v_save game_saves%ROWTYPE;
  v_roll numeric;
  v_prize_type text;
  v_prize_amount numeric := 0;
  v_prize_label text;
  v_segment int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF is_user_banned(v_uid) THEN RAISE EXCEPTION 'User is banned'; END IF;

  SELECT created_at INTO v_last FROM daily_wheel_spins
    WHERE user_id = v_uid ORDER BY created_at DESC LIMIT 1;
  IF v_last IS NOT NULL AND now() - v_last < interval '24 hours' THEN
    RAISE EXCEPTION 'Already spun today. Next spin available in % hours',
      EXTRACT(EPOCH FROM (interval '24 hours' - (now() - v_last))) / 3600;
  END IF;

  SELECT * INTO v_save FROM game_saves WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No game save'; END IF;

  -- Weighted prize selection (8 segments matching frontend wheel)
  -- 0: $1k (25%)  1: $5k (20%)  2: $10k (15%)  3: $50k (12%)
  -- 4: $100k (10%) 5: $250k (8%) 6: $1M (6%)   7: $10M (4%)
  v_roll := random() * 100;
  IF v_roll < 25 THEN v_segment := 0; v_prize_amount := 1000;
  ELSIF v_roll < 45 THEN v_segment := 1; v_prize_amount := 5000;
  ELSIF v_roll < 60 THEN v_segment := 2; v_prize_amount := 10000;
  ELSIF v_roll < 72 THEN v_segment := 3; v_prize_amount := 50000;
  ELSIF v_roll < 82 THEN v_segment := 4; v_prize_amount := 100000;
  ELSIF v_roll < 90 THEN v_segment := 5; v_prize_amount := 250000;
  ELSIF v_roll < 96 THEN v_segment := 6; v_prize_amount := 1000000;
  ELSE v_segment := 7; v_prize_amount := 10000000;
  END IF;

  v_prize_type := 'money';
  v_prize_label := '$' || v_prize_amount::text;

  UPDATE game_saves SET pending_balance = pending_balance + v_prize_amount WHERE user_id = v_uid;
  INSERT INTO daily_wheel_spins (user_id, prize_type, prize_amount, prize_label)
    VALUES (v_uid, v_prize_type, v_prize_amount, v_prize_label);

  RETURN jsonb_build_object(
    'success', true, 'segment', v_segment,
    'amount', v_prize_amount, 'label', v_prize_label
  );
END;
$$;

-- Profile update for customization (keeps existing update policy)
CREATE OR REPLACE FUNCTION public.update_profile_customization(p_banner text, p_frame text, p_status text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_status IS NOT NULL AND length(p_status) > 100 THEN RAISE EXCEPTION 'Status too long'; END IF;
  UPDATE public.profiles SET
    banner_url = COALESCE(p_banner, banner_url),
    frame_id = COALESCE(p_frame, frame_id),
    status_text = COALESCE(p_status, status_text)
  WHERE user_id = v_uid;
  RETURN jsonb_build_object('success', true);
END;
$$;