-- Public game directory endpoints expose only the fields intentionally shown in the UI.
-- SECURITY DEFINER lets leaderboards/search work without opening private profile/save tables.

CREATE OR REPLACE FUNCTION public.get_forbes_players()
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_emoji text,
  player_id bigint,
  net_worth numeric,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.username, p.avatar_emoji, p.player_id,
         COALESCE(gs.net_worth, 0), gs.updated_at
  FROM public.profiles p
  LEFT JOIN public.game_saves gs ON gs.user_id = p.user_id
  ORDER BY COALESCE(gs.net_worth, 0) DESC, p.created_at ASC
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.get_forbes_players() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_forbes_players() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.search_public_players(p_query text)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_emoji text,
  avatar_url text,
  player_id bigint,
  net_worth numeric,
  likes_count bigint,
  avg_rating numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.username, p.avatar_emoji, p.avatar_url, p.player_id,
         COALESCE(gs.net_worth, 0),
         (SELECT COUNT(*) FROM public.profile_likes pl WHERE pl.profile_user_id = p.user_id),
         (SELECT ROUND(AVG(pr.rating), 2) FROM public.profile_reviews pr WHERE pr.profile_user_id = p.user_id)
  FROM public.profiles p
  LEFT JOIN public.game_saves gs ON gs.user_id = p.user_id
  WHERE auth.uid() IS NOT NULL
    AND length(trim(COALESCE(p_query, ''))) BETWEEN 1 AND 40
    AND (
      p.player_id::text = trim(p_query)
      OR position(lower(trim(leading '@' from p_query)) IN lower(COALESCE(p.username, ''))) > 0
      OR EXISTS (
        SELECT 1 FROM public.player_usernames pu
        WHERE pu.user_id = p.user_id
          AND position(lower(trim(leading '@' from p_query)) IN lower(pu.username)) > 0
      )
    )
  ORDER BY COALESCE(gs.net_worth, 0) DESC
  LIMIT 30;
$$;

REVOKE ALL ON FUNCTION public.search_public_players(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_players(text) TO authenticated;
