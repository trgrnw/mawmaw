-- Repair historical clan counters. The trigger keeps future rows correct.
UPDATE public.clans c
SET member_count = (
  SELECT COUNT(*)::integer FROM public.clan_members cm WHERE cm.clan_id = c.id
);

-- game_saves.net_worth is refreshed by the client from the complete asset
-- snapshot (shop, accessories, businesses, stocks and crypto) on next save.
