
-- ── profile_likes ──
CREATE TABLE public.profile_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_user_id uuid NOT NULL,
  liker_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_user_id, liker_user_id),
  CHECK (profile_user_id <> liker_user_id)
);
CREATE INDEX idx_profile_likes_profile ON public.profile_likes(profile_user_id);
ALTER TABLE public.profile_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view likes" ON public.profile_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert own likes" ON public.profile_likes FOR INSERT
  WITH CHECK (auth.uid() = liker_user_id);
CREATE POLICY "Users can delete own likes" ON public.profile_likes FOR DELETE
  USING (auth.uid() = liker_user_id);

-- ── profile_reviews ──
CREATE TABLE public.profile_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_user_id uuid NOT NULL,
  author_user_id uuid NOT NULL,
  author_username text NOT NULL DEFAULT 'Player',
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text text NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_user_id, author_user_id),
  CHECK (profile_user_id <> author_user_id)
);
CREATE INDEX idx_profile_reviews_profile ON public.profile_reviews(profile_user_id, created_at DESC);
ALTER TABLE public.profile_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews" ON public.profile_reviews FOR SELECT USING (true);
CREATE POLICY "Users can manage own reviews" ON public.profile_reviews FOR ALL
  USING (auth.uid() = author_user_id) WITH CHECK (auth.uid() = author_user_id);
CREATE POLICY "Staff can delete reviews" ON public.profile_reviews FOR DELETE
  USING (is_staff(auth.uid()));

CREATE TRIGGER trg_review_updated_at BEFORE UPDATE ON public.profile_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── public stats view ──
CREATE OR REPLACE VIEW public.public_player_stats
WITH (security_invoker = true) AS
SELECT
  p.user_id,
  p.player_id,
  p.username,
  p.avatar_emoji,
  p.banner_url,
  p.frame_id,
  p.status_text,
  p.created_at AS joined_at,
  COALESCE(gs.net_worth, 0) AS net_worth,
  gs.last_seen_at,
  (SELECT count(*) FROM profile_likes pl WHERE pl.profile_user_id = p.user_id) AS likes_count,
  (SELECT count(*) FROM profile_reviews pr WHERE pr.profile_user_id = p.user_id) AS reviews_count,
  (SELECT round(avg(rating)::numeric, 2) FROM profile_reviews pr WHERE pr.profile_user_id = p.user_id) AS avg_rating
FROM public.profiles p
LEFT JOIN public.game_saves gs ON gs.user_id = p.user_id;

-- ── RPC: toggle like ──
CREATE OR REPLACE FUNCTION public.toggle_profile_like(p_profile_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_existed boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_uid = p_profile_user_id THEN RAISE EXCEPTION 'Cannot like own profile'; END IF;
  DELETE FROM profile_likes WHERE profile_user_id = p_profile_user_id AND liker_user_id = v_uid
    RETURNING true INTO v_existed;
  IF v_existed THEN
    RETURN jsonb_build_object('liked', false);
  ELSE
    INSERT INTO profile_likes (profile_user_id, liker_user_id) VALUES (p_profile_user_id, v_uid);
    RETURN jsonb_build_object('liked', true);
  END IF;
END;
$$;

-- ── RPC: post review ──
CREATE OR REPLACE FUNCTION public.post_profile_review(p_profile_user_id uuid, p_rating int, p_text text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_uname text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_uid = p_profile_user_id THEN RAISE EXCEPTION 'Cannot review own profile'; END IF;
  IF p_rating < 1 OR p_rating > 5 THEN RAISE EXCEPTION 'Rating must be 1..5'; END IF;
  IF length(trim(p_text)) = 0 OR length(p_text) > 500 THEN RAISE EXCEPTION 'Invalid text length'; END IF;
  SELECT username INTO v_uname FROM profiles WHERE user_id = v_uid;
  INSERT INTO profile_reviews (profile_user_id, author_user_id, author_username, rating, text)
  VALUES (p_profile_user_id, v_uid, COALESCE(v_uname, 'Player'), p_rating, trim(p_text))
  ON CONFLICT (profile_user_id, author_user_id)
  DO UPDATE SET rating = EXCLUDED.rating, text = EXCLUDED.text, updated_at = now(),
    author_username = EXCLUDED.author_username;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── RPC: delete review ──
CREATE OR REPLACE FUNCTION public.delete_profile_review(p_review_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_review profile_reviews%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_review FROM profile_reviews WHERE id = p_review_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF v_review.author_user_id <> v_uid AND NOT is_staff(v_uid) THEN
    RAISE EXCEPTION 'No permission';
  END IF;
  DELETE FROM profile_reviews WHERE id = p_review_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── RPC: full public profile ──
CREATE OR REPLACE FUNCTION public.get_player_public_profile(p_profile_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
$$;
