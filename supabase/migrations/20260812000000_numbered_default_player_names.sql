-- Give accounts without a chosen nickname a stable, readable player name.
-- The numeric suffix comes from profiles.player_id, so it is unique and does
-- not change when the player later chooses a custom nickname.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id bigint;
  v_requested_username text := NULLIF(btrim(NEW.raw_user_meta_data->>'username'), '');
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, COALESCE(v_requested_username, 'Player'))
  RETURNING player_id INTO v_player_id;

  IF v_requested_username IS NULL OR lower(v_requested_username) = 'player' THEN
    UPDATE public.profiles
    SET username = 'Player' || lpad(v_player_id::text, 7, '0')
    WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Repair old generic names while keeping all custom nicknames untouched.
UPDATE public.profiles
SET username = 'Player' || lpad(player_id::text, 7, '0')
WHERE player_id IS NOT NULL
  AND (btrim(username) = '' OR lower(btrim(username)) = 'player');
