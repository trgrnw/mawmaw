
-- Add numeric player_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS player_id BIGSERIAL;

-- Create unique index on player_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_player_id ON public.profiles(player_id);

-- Table for player usernames
CREATE TABLE public.player_usernames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Username must be unique globally
CREATE UNIQUE INDEX idx_player_usernames_username ON public.player_usernames(LOWER(username));

-- Index for user lookups
CREATE INDEX idx_player_usernames_user_id ON public.player_usernames(user_id);

-- Enable RLS
ALTER TABLE public.player_usernames ENABLE ROW LEVEL SECURITY;

-- Everyone can read usernames (for search)
CREATE POLICY "Anyone can view usernames"
  ON public.player_usernames FOR SELECT
  USING (true);

-- Users can insert their own usernames
CREATE POLICY "Users can create own usernames"
  ON public.player_usernames FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own usernames (toggle active)
CREATE POLICY "Users can update own usernames"
  ON public.player_usernames FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own usernames
CREATE POLICY "Users can delete own usernames"
  ON public.player_usernames FOR DELETE
  USING (auth.uid() = user_id);

-- Update forbes_leaderboard view to include player_id
DROP VIEW IF EXISTS public.forbes_leaderboard;
CREATE VIEW public.forbes_leaderboard
WITH (security_invoker = false) AS
SELECT
  p.username,
  p.avatar_emoji,
  p.player_id,
  g.net_worth,
  g.updated_at
FROM public.game_saves g
JOIN public.profiles p ON p.user_id = g.user_id
WHERE g.net_worth > 0
ORDER BY g.net_worth DESC
LIMIT 100;

GRANT SELECT ON public.forbes_leaderboard TO anon, authenticated;

-- Enable realtime for player_usernames for availability checks
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_usernames;
