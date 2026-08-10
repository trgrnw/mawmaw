
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL DEFAULT '',
  avatar_emoji TEXT NOT NULL DEFAULT '👤',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'Player'));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Game saves table (stores full game state as JSON)
CREATE TABLE public.game_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  game_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  net_worth NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.game_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own save" ON public.game_saves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own save" ON public.game_saves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own save" ON public.game_saves FOR UPDATE USING (auth.uid() = user_id);

-- Forbes leaderboard view (public, read-only)
CREATE VIEW public.forbes_leaderboard
WITH (security_invoker = on) AS
  SELECT
    p.username,
    p.avatar_emoji,
    gs.net_worth,
    gs.updated_at
  FROM public.game_saves gs
  JOIN public.profiles p ON p.user_id = gs.user_id
  WHERE gs.net_worth > 0
  ORDER BY gs.net_worth DESC
  LIMIT 100;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_game_saves_updated_at BEFORE UPDATE ON public.game_saves FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
