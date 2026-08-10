-- Accounts may predate the initial schema deployment. Backfill their missing game profiles.
INSERT INTO public.profiles (user_id, username, created_at)
SELECT
  u.id,
  COALESCE(NULLIF(trim(u.raw_user_meta_data->>'username'), ''), 'Player'),
  u.created_at
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

-- A narrow server-side entry point keeps username creation reliable and validates limits centrally.
CREATE OR REPLACE FUNCTION public.purchase_player_username(p_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_username text := lower(trim(leading '@' from COALESCE(p_username, '')));
  v_total integer;
  v_active integer;
  v_row public.player_usernames%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF v_username !~ '^[a-z0-9_]{5,26}$' THEN
    RAISE EXCEPTION 'Username must contain 5-26 latin letters, numbers or underscores';
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_active)
  INTO v_total, v_active
  FROM public.player_usernames
  WHERE user_id = v_uid;

  IF v_total >= 25 THEN RAISE EXCEPTION 'Username limit reached'; END IF;
  IF EXISTS (SELECT 1 FROM public.player_usernames WHERE lower(username) = v_username) THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;

  INSERT INTO public.player_usernames (user_id, username, is_active)
  VALUES (v_uid, v_username, v_active < 15)
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'username', v_row.username,
    'is_active', v_row.is_active
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_player_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_player_username(text) TO authenticated;
