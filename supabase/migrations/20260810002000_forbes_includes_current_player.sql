-- Keep the global top 100, but always return the signed-in player as well.
-- This makes the leaderboard useful to new players without exposing extra fields.
DROP FUNCTION IF EXISTS public.get_forbes_players();

CREATE FUNCTION public.get_forbes_players()
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_emoji text,
  player_id bigint,
  net_worth numeric,
  updated_at timestamptz,
  rank bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      p.user_id,
      p.username,
      p.avatar_emoji,
      p.player_id,
      COALESCE(gs.net_worth, 0)::numeric AS net_worth,
      gs.updated_at,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(gs.net_worth, 0) DESC, p.created_at ASC
      ) AS rank
    FROM public.profiles p
    LEFT JOIN public.game_saves gs ON gs.user_id = p.user_id
  )
  SELECT r.*
  FROM ranked r
  WHERE r.rank <= 100 OR r.user_id = auth.uid()
  ORDER BY r.rank;
$$;

REVOKE ALL ON FUNCTION public.get_forbes_players() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_forbes_players() TO anon, authenticated;
