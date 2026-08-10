-- Update public_player_stats view to expose avatar_url and showcase_items for public profile display
DROP VIEW IF EXISTS public.public_player_stats CASCADE;
CREATE VIEW public.public_player_stats
WITH (security_invoker = true)
AS
SELECT p.user_id,
    p.player_id,
    p.username,
    p.avatar_emoji,
    p.avatar_url,
    p.banner_url,
    p.frame_id,
    p.status_text,
    p.showcase_items,
    p.created_at AS joined_at,
    COALESCE(gs.net_worth, 0::numeric) AS net_worth,
    gs.last_seen_at,
    (SELECT count(*) FROM profile_likes pl WHERE pl.profile_user_id = p.user_id) AS likes_count,
    (SELECT count(*) FROM profile_reviews pr WHERE pr.profile_user_id = p.user_id) AS reviews_count,
    (SELECT round(avg(pr.rating), 2) FROM profile_reviews pr WHERE pr.profile_user_id = p.user_id) AS avg_rating
FROM profiles p
LEFT JOIN game_saves gs ON gs.user_id = p.user_id;

-- Recreate get_player_public_profile to use the new view (definition unchanged but rebinds to new view shape)
CREATE OR REPLACE FUNCTION public.get_player_public_profile(p_profile_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'profile', to_jsonb(s.*),
    'usernames', COALESCE((SELECT jsonb_agg(username ORDER BY created_at)
                            FROM player_usernames WHERE user_id = p_profile_user_id AND is_active = true), '[]'::jsonb),
    'reviews', COALESCE((SELECT jsonb_agg(to_jsonb(r.*) ORDER BY r.created_at DESC)
                          FROM (SELECT id, author_user_id, author_username, rating, text, created_at, updated_at
                                FROM profile_reviews WHERE profile_user_id = p_profile_user_id
                                ORDER BY created_at DESC LIMIT 20) r), '[]'::jsonb),
    'i_liked', EXISTS(SELECT 1 FROM profile_likes WHERE profile_user_id = p_profile_user_id AND liker_user_id = v_uid),
    'my_review', (SELECT to_jsonb(r.*) FROM profile_reviews r
                   WHERE profile_user_id = p_profile_user_id AND author_user_id = v_uid)
  ) INTO v_result
  FROM public.public_player_stats s
  WHERE s.user_id = p_profile_user_id;
  RETURN v_result;
END;
$function$;

-- Admin RPC: adjust player balance via pending_balance (safe from autosave overwrite). Positive or negative delta.
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(p_user_id uuid, p_delta numeric, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT is_staff(v_uid) THEN RAISE EXCEPTION 'No permission'; END IF;
  IF p_delta = 0 THEN RAISE EXCEPTION 'Delta cannot be zero'; END IF;
  UPDATE game_saves SET pending_balance = pending_balance + p_delta WHERE user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Player save not found'; END IF;
  INSERT INTO admin_logs (admin_user_id, action, target_user_id, details)
  VALUES (v_uid, 'admin_adjust_balance', p_user_id,
    jsonb_build_object('delta', p_delta, 'reason', COALESCE(p_reason, '')));
  RETURN jsonb_build_object('success', true);
END;
$$;