DROP VIEW IF EXISTS public.forbes_leaderboard CASCADE;
DROP VIEW IF EXISTS public.clan_leaderboard CASCADE;

CREATE VIEW public.forbes_leaderboard
WITH (security_invoker = true) AS
SELECT 
  p.username,
  p.avatar_emoji,
  p.player_id,
  COALESCE(gs.net_worth, 0) AS net_worth,
  gs.updated_at
FROM public.profiles p
LEFT JOIN public.game_saves gs ON gs.user_id = p.user_id;

CREATE VIEW public.clan_leaderboard
WITH (security_invoker = true) AS
SELECT 
  c.id, c.name, c.tag, c.emoji, c.description, c.treasury, c.member_count, c.created_at,
  COALESCE(SUM(gs.net_worth), 0) + c.treasury AS total_net_worth,
  c.owner_id,
  p.username AS owner_name
FROM public.clans c
LEFT JOIN public.clan_members cm ON cm.clan_id = c.id
LEFT JOIN public.game_saves gs ON gs.user_id = cm.user_id
LEFT JOIN public.profiles p ON p.user_id = c.owner_id
GROUP BY c.id, p.username;