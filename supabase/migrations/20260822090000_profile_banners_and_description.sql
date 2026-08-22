-- Public profile banners. Files are normalized by the client to 1500x500.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-banners', 'profile-banners', true, 8388608, ARRAY['image/jpeg','image/png'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public profile banners are readable" ON storage.objects;
CREATE POLICY "Public profile banners are readable" ON storage.objects FOR SELECT
USING (bucket_id = 'profile-banners');

DROP POLICY IF EXISTS "Players upload own profile banners" ON storage.objects;
CREATE POLICY "Players upload own profile banners" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Players update own profile banners" ON storage.objects;
CREATE POLICY "Players update own profile banners" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Players delete own profile banners" ON storage.objects;
CREATE POLICY "Players delete own profile banners" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE OR REPLACE FUNCTION public.update_profile_customization(p_banner text, p_frame text, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF char_length(coalesce(p_status, '')) > 360 THEN RAISE EXCEPTION 'Description is limited to 360 characters'; END IF;
  UPDATE public.profiles
  SET banner_url = nullif(trim(p_banner), ''),
      frame_id = nullif(trim(p_frame), ''),
      status_text = nullif(trim(p_status), '')
  WHERE user_id = auth.uid();
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_profile_customization(text, text, text) TO authenticated;
