-- Validated entry point for changing the public in-game nickname.
CREATE OR REPLACE FUNCTION public.change_profile_nickname(p_nickname text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nickname text := regexp_replace(trim(COALESCE(p_nickname, '')), '\s+', ' ', 'g');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF char_length(v_nickname) < 3 OR char_length(v_nickname) > 24 THEN
    RAISE EXCEPTION 'Nickname must contain 3-24 characters';
  END IF;
  IF v_nickname ~ '[[:cntrl:]<>]' THEN
    RAISE EXCEPTION 'Nickname contains forbidden characters';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id <> v_uid AND lower(username) = lower(v_nickname)
  ) THEN
    RAISE EXCEPTION 'Nickname already taken';
  END IF;

  UPDATE public.profiles
  SET username = v_nickname
  WHERE user_id = v_uid;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (user_id, username)
    VALUES (v_uid, v_nickname);
  END IF;
  RETURN v_nickname;
END;
$$;

REVOKE ALL ON FUNCTION public.change_profile_nickname(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_profile_nickname(text) TO authenticated;
