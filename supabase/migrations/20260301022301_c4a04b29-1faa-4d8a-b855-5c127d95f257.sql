
-- Drop existing view and recreate WITHOUT security_invoker so it bypasses RLS
DROP VIEW IF EXISTS public.forbes_leaderboard;

CREATE VIEW public.forbes_leaderboard
WITH (security_invoker = false)
AS
SELECT
  p.username,
  p.avatar_emoji,
  gs.net_worth,
  gs.updated_at
FROM game_saves gs
JOIN profiles p ON p.user_id = gs.user_id
WHERE gs.net_worth > 0
ORDER BY gs.net_worth DESC
LIMIT 100;

-- Grant SELECT on the view to anon and authenticated roles
GRANT SELECT ON public.forbes_leaderboard TO anon, authenticated;
