-- No releases are seeded. Visibility follows database time, including while staff are offline.
CREATE TABLE public.player_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 kind text NOT NULL, title text NOT NULL, message text NOT NULL, target text,
 dedupe_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz, archived_at timestamptz,
 UNIQUE(user_id,dedupe_key)
);
CREATE INDEX player_notifications_inbox ON public.player_notifications(user_id,created_at DESC);
CREATE INDEX player_notifications_unread ON public.player_notifications(user_id) WHERE read_at IS NULL;
ALTER TABLE public.player_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.player_notifications TO authenticated;
CREATE POLICY "Own notification inbox" ON public.player_notifications FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE FUNCTION public.notify_player(p_user_id uuid,p_kind text,p_title text,p_message text,p_key text,p_target text DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 INSERT INTO player_notifications(user_id,kind,title,message,dedupe_key,target)
 VALUES(p_user_id,p_kind,left(p_title,160),left(p_message,2000),p_key,p_target) ON CONFLICT(user_id,dedupe_key) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.notify_player(uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.sync_player_notifications() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 INSERT INTO player_notifications(user_id,kind,title,message,dedupe_key,target)
 SELECT auth.uid(),'announcement',title,message,'announcement:'||id,'announcements' FROM announcements WHERE is_active
 ON CONFLICT(user_id,dedupe_key) DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.sync_player_notifications() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_player_notifications() TO authenticated;
CREATE FUNCTION public.set_notification_state(p_id uuid,p_state text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR p_state NOT IN('read','unread','archive','read_all') THEN RAISE EXCEPTION 'Invalid notification action'; END IF;
 UPDATE player_notifications SET
 read_at=CASE WHEN p_state='unread' THEN NULL ELSE COALESCE(read_at,now()) END,
 archived_at=CASE WHEN p_state='unread' THEN NULL ELSE COALESCE(archived_at,now()) END
 WHERE user_id=auth.uid() AND ((p_state='read_all' AND read_at IS NULL) OR (p_state<>'read_all' AND id=p_id));
END; $$;
REVOKE ALL ON FUNCTION public.set_notification_state(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_notification_state(uuid,text) TO authenticated;
CREATE FUNCTION public.notify_support_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ticket support_tickets%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='ticket_messages' THEN
  IF NEW.is_staff_reply THEN
   SELECT * INTO ticket FROM support_tickets WHERE id=NEW.ticket_id;
   IF ticket.user_id<>NEW.author_user_id THEN PERFORM notify_player(ticket.user_id,'support','Поддержка ответила',NEW.message,'reply:'||NEW.id,'support:'||NEW.ticket_id); END IF;
  END IF;
 ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN('closed','in_progress') THEN
  PERFORM notify_player(NEW.user_id,'support',CASE WHEN NEW.status='closed' THEN 'Обращение закрыто' ELSE 'Обращение в работе' END,NEW.subject,'ticket-status:'||NEW.id||':'||NEW.status||':'||NEW.updated_at,'support:'||NEW.id);
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_support_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER notify_support_reply AFTER INSERT ON public.ticket_messages FOR EACH ROW EXECUTE FUNCTION public.notify_support_event();
CREATE TRIGGER notify_support_status AFTER UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.notify_support_event();

-- Confirmed licenses have a separate durable record. Never restore anything from client caches.
CREATE TABLE public.business_licenses(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,document jsonb NOT NULL,confirmed_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.business_licenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_licenses FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.business_licenses TO authenticated;
CREATE POLICY "Own permanent license" ON public.business_licenses FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
INSERT INTO business_licenses(user_id,document) SELECT user_id,game_state->'entrepreneurLicense' FROM game_saves WHERE jsonb_typeof(game_state->'entrepreneurLicense')='object';
CREATE FUNCTION public.preserve_business_license() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE document jsonb;
BEGIN
 IF TG_OP='UPDATE' AND jsonb_typeof(OLD.game_state->'entrepreneurLicense')='object' AND NEW.game_state->'entrepreneurLicense'=OLD.game_state->'entrepreneurLicense' THEN RETURN NEW; END IF;
 IF current_setting('game.allow_progress_reset',true)='true' AND admin_has_permission('economy') THEN
  DELETE FROM business_licenses WHERE user_id=NEW.user_id;
  RETURN NEW;
 END IF;
 IF jsonb_typeof(NEW.game_state->'entrepreneurLicense')='object' THEN
  INSERT INTO business_licenses(user_id,document) VALUES(NEW.user_id,NEW.game_state->'entrepreneurLicense') ON CONFLICT(user_id) DO NOTHING;
 END IF;
 SELECT b.document INTO document FROM business_licenses b WHERE b.user_id=NEW.user_id;
 IF document IS NOT NULL THEN NEW.game_state:=jsonb_set(NEW.game_state,'{entrepreneurLicense}',document); END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.preserve_business_license() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER aaa_preserve_business_license BEFORE INSERT OR UPDATE OF game_state ON game_saves FOR EACH ROW EXECUTE FUNCTION preserve_business_license();
CREATE FUNCTION public.notify_game_progress() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE item jsonb; previous jsonb:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE OLD.game_state END; key text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.game_state->'businesses' IS NOT DISTINCT FROM previous->'businesses' AND NEW.game_state->'purchasedShop' IS NOT DISTINCT FROM previous->'purchasedShop' AND NEW.game_state->'purchasedAccessories' IS NOT DISTINCT FROM previous->'purchasedAccessories' AND NEW.game_state->'unlockedAchievements' IS NOT DISTINCT FROM previous->'unlockedAchievements' AND NEW.game_state->'entrepreneurLicense' IS NOT DISTINCT FROM previous->'entrepreneurLicense' THEN RETURN NEW; END IF;
 IF jsonb_typeof(NEW.game_state->'entrepreneurLicense')='object' AND jsonb_typeof(previous->'entrepreneurLicense') IS DISTINCT FROM 'object' THEN
  PERFORM notify_player(NEW.user_id,'license','Лицензия подтверждена','Лицензия предпринимателя действует бессрочно. Документ сохранён в вашем аккаунте.','license:'||(NEW.game_state->'entrepreneurLicense'->>'id'),'business');
 END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(NEW.game_state->'businesses','[]')) LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(previous->'businesses','[]')) old_item WHERE old_item->>'id'=item->>'id') THEN
   PERFORM notify_player(NEW.user_id,'business','Предприятие зарегистрировано',item->>'name','business:'||(item->>'id'),'business');
  ELSIF item->>'status'='operating' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(previous->'businesses','[]')) old_item WHERE old_item->>'id'=item->>'id' AND old_item->>'status'='operating') THEN
   PERFORM notify_player(NEW.user_id,'business','Предприятие запущено',item->>'name','business-start:'||(item->>'id'),'business');
  END IF;
 END LOOP;
 FOREACH key IN ARRAY ARRAY['purchasedShop','purchasedAccessories'] LOOP
  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(NEW.game_state->key,'[]')) LOOP
   IF NOT COALESCE(previous->key,'[]') @> jsonb_build_array(item) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(previous->key,'[]')) x WHERE x->>'id'=item->>'id') THEN
    PERFORM notify_player(NEW.user_id,'purchase','Покупка подтверждена','Предмет: '||(item->>'id'),'purchase:'||key||':'||(item->>'id')||':'||NEW.revision,CASE WHEN key='purchasedShop' THEN 'shop' ELSE 'accessories' END);
   END IF;
  END LOOP;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(NEW.game_state->'unlockedAchievements','[]')) LOOP
  IF NOT COALESCE(previous->'unlockedAchievements','[]') @> jsonb_build_array(item) THEN
   PERFORM notify_player(NEW.user_id,'achievement','Получено достижение',item#>>'{}','achievement:'||(item#>>'{}'),'achievements');
  END IF;
 END LOOP;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_game_progress() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER notify_confirmed_progress AFTER INSERT OR UPDATE OF game_state ON game_saves FOR EACH ROW EXECUTE FUNCTION notify_game_progress();

CREATE TABLE public.limited_releases(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN('car','plate','username','nft','achievement')),
 title text NOT NULL CHECK(length(title) BETWEEN 3 AND 100), description text NOT NULL DEFAULT '' CHECK(length(description)<=2000),
 image_url text, icon text NOT NULL DEFAULT 'star', price numeric NOT NULL DEFAULT 0 CHECK(price>=0 AND price<=1e14),
 total_limit integer NOT NULL CHECK(total_limit BETWEEN 1 AND 1000000), issued_count integer NOT NULL DEFAULT 0 CHECK(issued_count>=0 AND issued_count<=total_limit),
 starts_at timestamptz NOT NULL, ends_at timestamptz, status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','scheduled','paused','archived')),
 payload jsonb NOT NULL DEFAULT '{}', created_by uuid REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at IS NULL OR ends_at>starts_at)
);
CREATE TABLE public.limited_claims(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), release_id uuid NOT NULL REFERENCES limited_releases(id), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 serial integer NOT NULL, item_snapshot jsonb NOT NULL, claimed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(release_id,user_id), UNIQUE(release_id,serial)
);
CREATE INDEX limited_claims_inventory ON limited_claims(user_id,claimed_at DESC);
ALTER TABLE public.limited_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.limited_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.limited_releases,public.limited_claims FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.limited_releases,public.limited_claims TO authenticated;
CREATE POLICY "View available releases or manage" ON limited_releases FOR SELECT TO authenticated USING(admin_has_permission('releases') OR (status='scheduled' AND starts_at<=now() AND (ends_at IS NULL OR now()<ends_at)));
CREATE POLICY "Own permanent limited collection" ON limited_claims FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR admin_has_permission('releases'));
CREATE FUNCTION public.release_metric(p_state jsonb,p_metric text) RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN p_metric='businessCount' THEN jsonb_array_length(COALESCE(p_state->'businesses','[]'))::numeric WHEN p_metric IN('balance','playerXp','totalEarnedClick','totalEarnedBusiness','totalEarnedRent','totalEarnedDividends','totalEarnedTrading','totalEarnedCrypto') THEN COALESCE((p_state->>p_metric)::numeric,0) ELSE -1 END;
$$;
REVOKE ALL ON FUNCTION public.release_metric(jsonb,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.admin_save_release(p_id uuid,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v limited_releases%ROWTYPE; v_id uuid:=p_id; v_payload jsonb:=COALESCE(p_data->'payload','{}'); v_kind text:=p_data->>'kind'; v_cap integer:=(p_data->>'total_limit')::integer; image text:=nullif(p_data->>'image_url',''); template text:=v_payload->>'text_template';
BEGIN
 IF NOT admin_has_permission('releases') THEN RAISE EXCEPTION 'No permission'; END IF;
 IF v_kind IS NULL OR v_kind NOT IN('car','plate','username','nft','achievement') OR v_cap IS NULL OR v_cap NOT BETWEEN 1 AND 1000000 THEN RAISE EXCEPTION 'Invalid v_kind or supply'; END IF;
 IF jsonb_typeof(v_payload)<>'object' THEN RAISE EXCEPTION 'Invalid payload'; END IF;
 IF image IS NOT NULL AND (image !~ '^https://' OR length(image)>2048) THEN RAISE EXCEPTION 'Use an uploaded image or HTTPS URL'; END IF;
 IF (p_data->>'price')::numeric IS NULL OR (p_data->>'price')::numeric<0 OR (p_data->>'price')::numeric>1e14 THEN RAISE EXCEPTION 'Invalid price'; END IF;
 IF p_data->>'icon' !~ '^[a-zA-Z0-9_-]{1,40}$' THEN RAISE EXCEPTION 'Invalid icon'; END IF;
 IF v_kind IN('username','plate') THEN
  IF template IS NULL OR length(template)>30 OR (v_cap>1 AND position('{serial}' IN template)=0) THEN RAISE EXCEPTION 'Use {serial} in a multi-edition username or plate'; END IF;
  IF v_kind='username' AND lower(replace(template,'{serial}',CASE WHEN v_cap<10000 THEN lpad(v_cap::text,4,'0') ELSE v_cap::text END)) !~ '^[a-z0-9_]{5,26}$' THEN RAISE EXCEPTION 'Username must contain 5–26 Latin letters, numbers or underscores'; END IF;
  IF v_kind='plate' AND (replace(template,'{serial}',CASE WHEN v_cap<10000 THEN lpad(v_cap::text,4,'0') ELSE v_cap::text END) !~ '^[A-Za-zА-Яа-я0-9 -]{2,16}$' OR COALESCE(v_payload->>'country','') NOT IN('RU','US','DE','GB','FR','JP','AE','KZ','AM')) THEN RAISE EXCEPTION 'Invalid plate template or country'; END IF;
 END IF;
 IF v_kind='achievement' AND (COALESCE(v_payload->>'metric','') NOT IN('balance','playerXp','totalEarnedClick','totalEarnedBusiness','totalEarnedRent','totalEarnedDividends','totalEarnedTrading','totalEarnedCrypto','businessCount') OR (v_payload->>'threshold')::numeric IS NULL OR (v_payload->>'threshold')::numeric<=0 OR (v_payload->>'threshold')::numeric>1e14) THEN RAISE EXCEPTION 'Invalid achievement condition'; END IF;
 IF p_id IS NOT NULL THEN
  SELECT * INTO v FROM limited_releases WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;
  IF v.issued_count>0 AND (v.kind<>v_kind OR v.payload<>v_payload OR v_cap<v.issued_count) THEN RAISE EXCEPTION 'Issued releases cannot change v_kind, condition or identifiers, or reduce supply below issued count'; END IF;
  UPDATE limited_releases SET title=trim(p_data->>'title'),description=COALESCE(p_data->>'description',''),kind=v_kind,image_url=image,icon=COALESCE(p_data->>'icon','star'),price=CASE WHEN v_kind='achievement' THEN 0 ELSE (p_data->>'price')::numeric END,total_limit=v_cap,starts_at=(p_data->>'starts_at')::timestamptz,ends_at=nullif(p_data->>'ends_at','')::timestamptz,status=p_data->>'status',payload=v_payload,updated_at=now() WHERE id=p_id;
 ELSE
  INSERT INTO limited_releases(kind,title,description,image_url,icon,price,total_limit,starts_at,ends_at,status,payload,created_by)
  VALUES(v_kind,trim(p_data->>'title'),COALESCE(p_data->>'description',''),image,COALESCE(p_data->>'icon','star'),CASE WHEN v_kind='achievement' THEN 0 ELSE (p_data->>'price')::numeric END,v_cap,(p_data->>'starts_at')::timestamptz,nullif(p_data->>'ends_at','')::timestamptz,p_data->>'status',v_payload,auth.uid()) RETURNING id INTO v_id;
 END IF;
 INSERT INTO admin_logs(admin_user_id,action,details) VALUES(auth.uid(),'save_limited_release',jsonb_build_object('release_id',v_id,'status',p_data->>'status'));
 RETURN jsonb_build_object('id',v_id);
END; $$;
REVOKE ALL ON FUNCTION public.admin_save_release(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_save_release(uuid,jsonb) TO authenticated;

CREATE FUNCTION public.claim_release_for_user(p_user_id uuid,p_release_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r limited_releases%ROWTYPE; c limited_claims%ROWTYPE; s game_saves%ROWTYPE; snapshot jsonb; serial integer; item_id uuid; text_value text; plate jsonb;
BEGIN
 IF p_user_id IS NULL OR is_user_banned(p_user_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('player-moderation:'||p_user_id::text));
 IF is_user_banned(p_user_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 SELECT * INTO r FROM limited_releases WHERE id=p_release_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;
 SELECT * INTO c FROM limited_claims WHERE release_id=p_release_id AND user_id=p_user_id;
 IF FOUND THEN RETURN to_jsonb(c); END IF;
 IF r.status<>'scheduled' OR r.starts_at>clock_timestamp() OR (r.ends_at IS NOT NULL AND clock_timestamp()>=r.ends_at) THEN RAISE EXCEPTION 'Выпуск сейчас недоступен'; END IF;
 IF r.issued_count>=r.total_limit THEN RAISE EXCEPTION 'Лимит выпуска исчерпан'; END IF;
 SELECT * INTO s FROM game_saves WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Сначала загрузите игру'; END IF;
 IF r.kind='achievement' THEN
  IF release_metric(s.game_state,r.payload->>'metric')<(r.payload->>'threshold')::numeric THEN RAISE EXCEPTION 'Условия достижения ещё не выполнены'; END IF;
 ELSE
  IF r.kind='plate' AND jsonb_array_length(COALESCE(s.game_state->'licensePlates','[]'))>=1000 THEN RAISE EXCEPTION 'Plate inventory is full'; END IF;
  IF r.kind='username' AND (SELECT count(*) FROM player_usernames WHERE user_id=p_user_id)>=25 THEN RAISE EXCEPTION 'Username inventory is full'; END IF;
  IF r.price>0 THEN PERFORM debit_player(p_user_id,r.price); END IF;
 END IF;
 serial:=r.issued_count+1; snapshot:=jsonb_build_object('kind',r.kind,'title',r.title,'description',r.description,'image_url',r.image_url,'icon',r.icon,'price',r.price,'edition_size',r.total_limit);
 IF r.kind IN('username','plate') THEN
  text_value:=replace(r.payload->>'text_template','{serial}',CASE WHEN serial<10000 THEN lpad(serial::text,4,'0') ELSE serial::text END);
  IF r.kind='username' THEN
   PERFORM set_config('game.release_claim',r.id::text,true);
   INSERT INTO player_usernames(user_id,username,is_active) VALUES(p_user_id,lower(text_value),false) RETURNING id INTO item_id;
   PERFORM set_config('game.release_claim','',true);
   snapshot:=snapshot||jsonb_build_object('asset_id',item_id,'text',lower(text_value));
  ELSE
   item_id:=gen_random_uuid();plate:=jsonb_build_object('id',item_id,'text',upper(text_value),'country',r.payload->>'country','assignedTo',NULL,'isCustom',true);
   INSERT INTO owned_license_plates(id,owner_id,data) VALUES(item_id::text,p_user_id,plate);
   UPDATE game_saves SET game_state=jsonb_set(game_state,'{licensePlates}',COALESCE(game_state->'licensePlates','[]')||jsonb_build_array(plate)) WHERE user_id=p_user_id;
   snapshot:=snapshot||jsonb_build_object('asset_id',item_id,'text',upper(text_value),'country',r.payload->>'country');
  END IF;
 END IF;
 INSERT INTO limited_claims(release_id,user_id,serial,item_snapshot) VALUES(r.id,p_user_id,serial,snapshot) RETURNING * INTO c;
 UPDATE limited_releases SET issued_count=serial,updated_at=now() WHERE id=r.id;
 IF r.kind IN('car','nft') THEN UPDATE game_saves SET game_state=game_state WHERE user_id=p_user_id; END IF;
 PERFORM notify_player(p_user_id,'limited',CASE WHEN r.kind='achievement' THEN 'Получено событийное достижение' ELSE 'Лимитированный предмет получен' END,r.title||' · экземпляр №'||serial,'limited:'||r.id,'limited');
 RETURN to_jsonb(c);
END; $$;
REVOKE ALL ON FUNCTION public.claim_release_for_user(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.claim_limited_release(p_release_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 RETURN claim_release_for_user(auth.uid(),p_release_id);
END; $$;
REVOKE ALL ON FUNCTION public.claim_limited_release(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_limited_release(uuid) TO authenticated;
CREATE FUNCTION public.award_limited_achievements(p_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r record;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF is_user_banned(p_user_id) THEN RETURN; END IF;
 FOR r IN SELECT l.id FROM limited_releases l JOIN game_saves g ON g.user_id=p_user_id WHERE l.kind='achievement' AND l.status='scheduled' AND l.starts_at<=now() AND (l.ends_at IS NULL OR now()<l.ends_at) AND l.issued_count<l.total_limit AND NOT EXISTS(SELECT 1 FROM limited_claims c WHERE c.user_id=p_user_id AND c.release_id=l.id) AND release_metric(g.game_state,l.payload->>'metric')>=(l.payload->>'threshold')::numeric ORDER BY l.id LIMIT 20 LOOP
  BEGIN PERFORM claim_release_for_user(p_user_id,r.id); EXCEPTION WHEN raise_exception THEN NULL; END;
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.award_limited_achievements(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.award_limited_achievements(uuid) TO service_role;
CREATE FUNCTION public.get_limited_collection(p_user_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'release_id',release_id,'serial',serial,'item_snapshot',item_snapshot,'claimed_at',claimed_at) ORDER BY claimed_at DESC),'[]') FROM limited_claims WHERE user_id=p_user_id;
$$;
REVOKE ALL ON FUNCTION public.get_limited_collection(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_limited_collection(uuid) TO anon,authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('release-media','release-media',true,5242880,ARRAY['image/png','image/jpeg','image/webp']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY "Staff upload release media" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='release-media' AND (storage.foldername(name))[1]=auth.uid()::text AND admin_has_permission('releases'));
CREATE POLICY "Staff inspect release media" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='release-media' AND admin_has_permission('releases'));

-- Database guards apply to RPCs and direct API writes, regardless of hidden UI controls.
CREATE FUNCTION public.reject_banned_actor() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NOT NULL THEN
  IF is_user_banned(actor) THEN RAISE EXCEPTION 'Account is banned'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.reject_banned_actor() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t record;
BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN('support_tickets','ticket_messages','player_notifications','game_request_buckets') LOOP
  EXECUTE format('CREATE TRIGGER aaa_reject_banned_actor BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.reject_banned_actor()',t.tablename);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.admin_has_permission(p_permission text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND NOT is_user_banned(auth.uid())
 AND COALESCE(auth.jwt()->>'aal','aal1')='aal2'
 AND EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND (
   role='owner' OR (role='admin' AND p_permission IN('players','economy','support','reports','bans','logs','casino','announcements','transactions','releases'))
   OR (role='moderator' AND p_permission IN('support','reports','bans','logs','casino'))));
$$;

CREATE OR REPLACE FUNCTION public.commit_verified_game_state(p_user_id uuid,p_revision bigint,p_state jsonb,p_net_worth numeric,p_action_ids text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_save game_saves%ROWTYPE;v_state jsonb;v_plate jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('player-moderation:'||p_user_id::text));
  IF is_user_banned(p_user_id) THEN RAISE EXCEPTION 'User is banned'; END IF;
  SELECT * INTO v_save FROM game_saves WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR v_save.revision<>p_revision THEN RETURN jsonb_build_object('committed',false); END IF;
  IF EXISTS(SELECT 1 FROM game_action_receipts WHERE user_id=p_user_id AND action_id=ANY(p_action_ids)) THEN RETURN jsonb_build_object('committed',false); END IF;
  -- The verified engine has already applied pending funds before validating spending.
  v_state:=jsonb_set(p_state,'{balance}',to_jsonb(LEAST(1e14::numeric,GREATEST(0,COALESCE((p_state->>'balance')::numeric,0)))));
  FOR v_plate IN SELECT value FROM jsonb_array_elements(COALESCE(v_state->'licensePlates','[]')) LOOP
    IF EXISTS(SELECT 1 FROM owned_license_plates WHERE id=v_plate->>'id' AND (owner_id<>p_user_id OR listing_id IS NOT NULL)) THEN RAISE EXCEPTION 'Plate ownership conflict'; END IF;
    INSERT INTO owned_license_plates(id,owner_id,data) VALUES(v_plate->>'id',p_user_id,v_plate)
    ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data;
  END LOOP;
  DELETE FROM owned_license_plates WHERE owner_id=p_user_id AND listing_id IS NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(v_state->'licensePlates','[]')) p WHERE p->>'id'=owned_license_plates.id);
  UPDATE game_saves SET game_state=v_state,net_worth=p_net_worth,pending_balance=0,last_seen_at=now() WHERE user_id=p_user_id RETURNING game_state INTO v_state;
  INSERT INTO game_action_receipts(user_id,action_id) SELECT p_user_id,unnest(p_action_ids);
  RETURN jsonb_build_object('committed',true,'state',v_state);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_reset_player(p_user_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 BEGIN
 IF auth.uid() IS NULL OR NOT admin_has_permission('economy') THEN RAISE EXCEPTION 'No permission'; END IF;
 PERFORM set_config('game.allow_progress_reset','true',true);
 PERFORM pg_advisory_xact_lock(hashtext('casino-economy'));PERFORM pg_advisory_xact_lock(hashtext('market-economy'));
 IF EXISTS(SELECT 1 FROM market_listings WHERE status='active' AND(seller_id=p_user_id OR current_bidder_id=p_user_id)) OR EXISTS(SELECT 1 FROM casino_bets WHERE user_id=p_user_id AND result='pending') OR EXISTS(SELECT 1 FROM casino_mines_games WHERE user_id=p_user_id AND status='active') THEN RAISE EXCEPTION 'Finish active trades and games first'; END IF;
 PERFORM 1 FROM game_saves WHERE user_id=p_user_id FOR UPDATE;
 DELETE FROM owned_license_plates WHERE owner_id=p_user_id AND listing_id IS NULL;
 UPDATE game_saves SET game_state='{}',net_worth=0,pending_balance=0,last_seen_at=now() WHERE user_id=p_user_id;
 PERFORM set_config('game.allow_progress_reset','false',true);
 INSERT INTO admin_logs(admin_user_id,action,target_user_id,details) VALUES(auth.uid(),'reset_progress',p_user_id,'{}');
 RETURN jsonb_build_object('success',true);
END; 
$$;

CREATE OR REPLACE FUNCTION public.ban_user(p_user_id uuid, p_reason text, p_duration_hours integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$

DECLARE v_uid uuid := auth.uid(); v_expires timestamptz; v_type text;
BEGIN
  IF v_uid IS NULL OR NOT admin_has_permission('bans') THEN RAISE EXCEPTION 'No permission'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('player-moderation:'||p_user_id::text));
  IF is_staff(p_user_id) THEN RAISE EXCEPTION 'Cannot ban staff member'; END IF;
  -- Deactivate previous active bans
  UPDATE public.user_bans SET is_active = false WHERE user_id = p_user_id AND is_active = true;
  IF p_duration_hours IS NULL OR p_duration_hours <= 0 THEN
    v_type := 'permanent';
    v_expires := NULL;
  ELSE
    v_type := 'temporary';
    v_expires := now() + (p_duration_hours || ' hours')::interval;
  END IF;
  INSERT INTO public.user_bans (user_id, banned_by, reason, ban_type, expires_at)
  VALUES (p_user_id, v_uid, COALESCE(p_reason,''), v_type, v_expires);
  INSERT INTO public.admin_logs (admin_user_id, action, target_user_id, details)
  VALUES (v_uid, 'ban_user', p_user_id, jsonb_build_object('reason', p_reason, 'type', v_type, 'expires_at', v_expires));
  RETURN jsonb_build_object('success', true);
END;

$$;

CREATE OR REPLACE FUNCTION casino_action(p_uid uuid,p_action text,p_body jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r casino_rocket_rounds%ROWTYPE;c casino_coinflip_rounds%ROWTYPE;g casino_mines_games%ROWTYPE;b casino_bets%ROWTYPE;
 v_request uuid;v_response jsonb;v_round uuid;v_bet numeric;v_auto numeric;v_choice text;v_name text;v_bombs int;v_pos int;v_positions int[];v_revealed int[];v_safe int;v_mult numeric;v_win numeric;v_crash numeric;v_r double precision;t timestamptz:=clock_timestamp();v_latest casino_coinflip_rounds%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('player-moderation:'||p_uid::text));
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_uid IS NULL OR is_user_banned(p_uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 IF p_action NOT IN('get_rocket_round','place_rocket_bet','cashout_rocket','get_coinflip_round','place_coinflip_bet','start_mines','reveal_mine','cashout_mines','get_mines_history','get_active_mines') THEN RAISE EXCEPTION 'Unknown action'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('casino-economy'));
 IF p_action NOT LIKE 'get_%' THEN
  v_request:=(p_body->>'request_id')::uuid;IF v_request IS NULL THEN RAISE EXCEPTION 'Missing request ID'; END IF;
  SELECT response INTO v_response FROM casino_requests WHERE user_id=p_uid AND request_id=v_request;IF FOUND THEN RETURN v_response; END IF;
 END IF;
 PERFORM settle_casino();
 SELECT COALESCE(username,'Player') INTO v_name FROM profiles WHERE user_id=p_uid;v_name:=COALESCE(v_name,'Player');
 IF p_action IN('place_rocket_bet','place_coinflip_bet','start_mines') THEN
  v_bet:=(p_body->>'bet_amount')::numeric;
  IF v_bet IS NULL OR v_bet<100 OR v_bet>1000000 OR v_bet<>trunc(v_bet) THEN RAISE EXCEPTION 'Invalid bet'; END IF;
 END IF;
 IF p_action IN('get_rocket_round','place_rocket_bet','cashout_rocket') THEN
  IF p_action='get_rocket_round' THEN
   SELECT * INTO r FROM casino_rocket_rounds ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
   IF NOT FOUND OR (r.status='crashed' AND t>=r.started_at+ln(r.crash_point::double precision)/.06*interval '1 second'+interval '3 seconds') THEN
    v_r:=casino_random();v_crash:=CASE WHEN v_r<.04 THEN 1 ELSE LEAST(100,GREATEST(1,floor(power((1-v_r)/.96,-.7)*100)/100)) END;
    INSERT INTO casino_rocket_rounds(crash_point,started_at) VALUES(v_crash,t+interval '10 seconds') RETURNING * INTO r;
   END IF;
   v_mult:=CASE WHEN r.status='flying' THEN floor(exp(.06*EXTRACT(epoch FROM t-r.started_at))*100)/100 WHEN r.status='crashed' THEN r.crash_point ELSE 1 END;
   v_response:=jsonb_build_object('round',jsonb_build_object('id',r.id,'status',r.status,'started_at',r.started_at,'current_multiplier',v_mult,'crash_point',CASE WHEN r.status='crashed' THEN r.crash_point ELSE NULL END),
    'bets',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM casino_bets x WHERE round_id=r.id AND game_type='rocket'),'[]'),
    'history',COALESCE((SELECT jsonb_agg(x.crash_point) FROM(SELECT crash_point FROM casino_rocket_rounds WHERE status='crashed' ORDER BY created_at DESC LIMIT 20)x),'[]'));
  ELSE
   v_round:=(p_body->>'round_id')::uuid;SELECT * INTO r FROM casino_rocket_rounds WHERE id=v_round FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Round not found'; END IF;
   SELECT * INTO b FROM casino_bets WHERE round_id=r.id AND user_id=p_uid AND game_type='rocket' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
   IF p_action='place_rocket_bet' THEN
    IF b.id IS NOT NULL THEN v_response:=jsonb_build_object('bet',to_jsonb(b));
    ELSE
     IF r.status<>'waiting' OR t>=r.started_at THEN RAISE EXCEPTION 'Round not accepting bets'; END IF;
     v_auto:=(p_body->>'auto_cashout')::numeric;IF v_auto IS NOT NULL AND (v_auto<1.1 OR v_auto>100) THEN RAISE EXCEPTION 'Invalid auto cashout'; END IF;
     PERFORM debit_player(p_uid,v_bet);
     INSERT INTO casino_bets(user_id,username,game_type,round_id,bet_amount,auto_cashout) VALUES(p_uid,v_name,'rocket',r.id,v_bet,v_auto) RETURNING * INTO b;
     v_response:=jsonb_build_object('bet',to_jsonb(b));
    END IF;
   ELSE
    IF b.id IS NULL OR b.result='lost' THEN RAISE EXCEPTION 'No pending bet'; END IF;
    IF b.result='pending' THEN
     IF r.status<>'flying' OR t>=r.started_at+ln(r.crash_point::double precision)/.06*interval '1 second' THEN RAISE EXCEPTION 'Already crashed'; END IF;
     v_mult:=floor(exp(.06*EXTRACT(epoch FROM t-r.started_at))*100)/100;
     UPDATE casino_bets SET result='won',cashout_multiplier=v_mult,profit=bet_amount*(v_mult-1) WHERE id=b.id;
     UPDATE game_saves SET pending_balance=pending_balance+b.bet_amount*v_mult WHERE user_id=p_uid;
    ELSE v_mult:=b.cashout_multiplier; END IF;
    v_response:=jsonb_build_object('success',true,'multiplier',v_mult,'win_amount',b.bet_amount*v_mult);
   END IF;
  END IF;
 ELSIF p_action IN('get_coinflip_round','place_coinflip_bet') THEN
  IF p_action='get_coinflip_round' THEN
   SELECT * INTO c FROM casino_coinflip_rounds WHERE status='waiting' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
   IF NOT FOUND THEN INSERT INTO casino_coinflip_rounds(started_at) VALUES(t+interval '10 seconds') RETURNING * INTO c; END IF;
   SELECT * INTO v_latest FROM casino_coinflip_rounds WHERE status='done' ORDER BY created_at DESC LIMIT 1;
   v_response:=jsonb_build_object('round',jsonb_build_object('id',c.id,'status',c.status,'started_at',c.started_at),
    'bets',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM casino_bets x WHERE round_id=c.id AND game_type='coinflip'),'[]'),
    'completed_round',CASE WHEN v_latest.id IS NULL THEN NULL ELSE jsonb_build_object('id',v_latest.id,'result',v_latest.result) END,
    'completed_bets',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM casino_bets x WHERE round_id=v_latest.id AND game_type='coinflip'),'[]'),
    'history',COALESCE((SELECT jsonb_agg(x.result) FROM(SELECT result FROM casino_coinflip_rounds WHERE status='done' ORDER BY created_at DESC LIMIT 20)x),'[]'));
  ELSE
   v_round:=(p_body->>'round_id')::uuid;SELECT * INTO c FROM casino_coinflip_rounds WHERE id=v_round FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Round not found'; END IF;
   SELECT * INTO b FROM casino_bets WHERE round_id=c.id AND user_id=p_uid AND game_type='coinflip' ORDER BY created_at DESC LIMIT 1;
   IF b.id IS NOT NULL THEN v_response:=jsonb_build_object('bet',to_jsonb(b));
   ELSE
    v_choice:=p_body->>'choice';IF v_choice IS NULL OR v_choice NOT IN('heads','tails') THEN RAISE EXCEPTION 'Invalid choice'; END IF;
    IF c.status<>'waiting' OR t>=c.started_at THEN RAISE EXCEPTION 'Round not accepting bets'; END IF;
    PERFORM debit_player(p_uid,v_bet);
    INSERT INTO casino_bets(user_id,username,game_type,round_id,bet_amount,choice) VALUES(p_uid,v_name,'coinflip',c.id,v_bet,v_choice) RETURNING * INTO b;
    v_response:=jsonb_build_object('bet',to_jsonb(b));
   END IF;
  END IF;
 ELSIF p_action='get_mines_history' THEN
  v_response:=jsonb_build_object('bets',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM(SELECT * FROM casino_bets WHERE game_type='mines' ORDER BY created_at DESC LIMIT 20)x),'[]'));
 ELSIF p_action='get_active_mines' THEN
  SELECT * INTO g FROM casino_mines_games WHERE user_id=p_uid AND status='active' ORDER BY created_at DESC LIMIT 1;
  v_response:=jsonb_build_object('game',CASE WHEN g.id IS NULL THEN NULL ELSE to_jsonb(g)-'bomb_positions' END);
 ELSE
  IF p_action='start_mines' THEN
   SELECT * INTO g FROM casino_mines_games WHERE user_id=p_uid AND status='active' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
   IF NOT FOUND THEN
    v_bombs:=(p_body->>'bomb_count')::int;
    IF v_bombs IS NULL OR v_bombs<2 OR v_bombs>24 OR (p_body->>'bomb_count')::numeric<>v_bombs THEN RAISE EXCEPTION 'Invalid bomb count'; END IF;
    SELECT array_agg(pos) INTO v_positions FROM(SELECT pos FROM generate_series(0,24)pos ORDER BY casino_random() LIMIT v_bombs)x;
    PERFORM debit_player(p_uid,v_bet);
    INSERT INTO casino_mines_games(user_id,bomb_positions,bomb_count,bet_amount) VALUES(p_uid,v_positions,v_bombs,v_bet) RETURNING * INTO g;
   END IF;
   v_response:=jsonb_build_object('game',to_jsonb(g)-'bomb_positions');
  ELSE
   SELECT * INTO g FROM casino_mines_games WHERE id=(p_body->>'game_id')::uuid AND user_id=p_uid FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
   v_mult:=g.current_multiplier;
   IF p_action='reveal_mine' THEN
    v_pos:=(p_body->>'position')::int;
    IF v_pos IS NULL OR v_pos<0 OR v_pos>24 OR (p_body->>'position')::numeric<>v_pos THEN RAISE EXCEPTION 'Invalid position'; END IF;
    IF g.status='active' AND NOT v_pos=ANY(g.revealed_positions) THEN
     v_revealed:=array_append(g.revealed_positions,v_pos);
     IF v_pos=ANY(g.bomb_positions) THEN
      UPDATE casino_mines_games SET status='lost',revealed_positions=v_revealed WHERE id=g.id RETURNING * INTO g;
      INSERT INTO casino_bets(user_id,username,game_type,bet_amount,profit,result,bomb_count) VALUES(p_uid,v_name,'mines',g.bet_amount,-g.bet_amount,'lost',g.bomb_count);
     ELSE
      v_safe:=cardinality(v_revealed);v_mult:=1;
      FOR i IN 0..v_safe-1 LOOP v_mult:=v_mult*(25-i)/(25-g.bomb_count-i); END LOOP;v_mult:=floor(v_mult*.97*100)/100;
      UPDATE casino_mines_games SET revealed_positions=v_revealed,current_multiplier=v_mult,status=CASE WHEN v_safe=25-bomb_count THEN 'won' ELSE 'active' END WHERE id=g.id RETURNING * INTO g;
      IF g.status='won' THEN
       UPDATE game_saves SET pending_balance=pending_balance+g.bet_amount*v_mult WHERE user_id=p_uid;
       INSERT INTO casino_bets(user_id,username,game_type,bet_amount,cashout_multiplier,profit,result,bomb_count) VALUES(p_uid,v_name,'mines',g.bet_amount,v_mult,g.bet_amount*(v_mult-1),'won',g.bomb_count);
      END IF;
     END IF;
    END IF;
    v_response:=jsonb_build_object('game',to_jsonb(g)-'bomb_positions','is_bomb',v_pos=ANY(g.bomb_positions),'multiplier',g.current_multiplier,'game_over',g.status<>'active','bomb_positions',CASE WHEN g.status<>'active' THEN to_jsonb(g.bomb_positions) ELSE NULL END);
   ELSE
    IF g.status='lost' OR cardinality(g.revealed_positions)=0 THEN RAISE EXCEPTION 'Reveal at least one safe cell'; END IF;
    IF g.status='active' THEN
     UPDATE casino_mines_games SET status='won' WHERE id=g.id;
     UPDATE game_saves SET pending_balance=pending_balance+g.bet_amount*g.current_multiplier WHERE user_id=p_uid;
     INSERT INTO casino_bets(user_id,username,game_type,bet_amount,cashout_multiplier,profit,result,bomb_count) VALUES(p_uid,v_name,'mines',g.bet_amount,g.current_multiplier,g.bet_amount*(g.current_multiplier-1),'won',g.bomb_count);
    END IF;
    v_response:=jsonb_build_object('success',true,'multiplier',g.current_multiplier,'win_amount',g.bet_amount*g.current_multiplier,'bomb_positions',g.bomb_positions);
   END IF;
  END IF;
 END IF;
 IF v_request IS NOT NULL THEN INSERT INTO casino_requests(user_id,request_id,response) VALUES(p_uid,v_request,v_response); END IF;
 RETURN v_response;
END; $$;

CREATE OR REPLACE FUNCTION public.sync_player_notifications() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 INSERT INTO player_notifications(user_id,kind,title,message,dedupe_key,target)
 SELECT auth.uid(),'announcement',title,message,'announcement:'||id,'announcements' FROM announcements WHERE is_active
 ON CONFLICT(user_id,dedupe_key) DO NOTHING;
 INSERT INTO player_notifications(user_id,kind,title,message,dedupe_key,target)
 SELECT auth.uid(),'release','Открыт лимитированный выпуск',title,'release:'||id,'limited' FROM limited_releases
 WHERE status='scheduled' AND starts_at<=now() AND (ends_at IS NULL OR now()<ends_at) AND issued_count<total_limit
 ON CONFLICT(user_id,dedupe_key) DO NOTHING;
END; $$;
CREATE FUNCTION public.notify_admin_action() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.target_user_id IS NOT NULL AND NEW.action IN('admin_adjust_balance','change_balance','reset_progress','unban_user','ban_user') THEN
  PERFORM notify_player(NEW.target_user_id,'account','Действие администрации',CASE NEW.action WHEN 'admin_adjust_balance' THEN 'Администратор скорректировал ваш баланс.' WHEN 'change_balance' THEN 'Администратор изменил ваш баланс.' WHEN 'reset_progress' THEN 'Администратор сбросил игровой прогресс.' WHEN 'unban_user' THEN 'Блокировка вашего аккаунта снята.' ELSE 'Ваш аккаунт заблокирован. Вы можете обратиться в поддержку.' END,'admin:'||NEW.id,'support');
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_admin_action() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER notify_account_action AFTER INSERT ON admin_logs FOR EACH ROW EXECUTE FUNCTION notify_admin_action();

CREATE FUNCTION public.guard_reserved_release_username() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.username=OLD.username THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM limited_releases r WHERE r.kind='username' AND r.status IN('scheduled','paused') AND (r.ends_at IS NULL OR now()<r.ends_at) AND lower(NEW.username) ~ ('^'||replace(lower(r.payload->>'text_template'),'{serial}','[0-9]{4,7}')||'$') AND current_setting('game.release_claim',true) IS DISTINCT FROM r.id::text) THEN RAISE EXCEPTION 'Username reserved for a limited release'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_reserved_release_username() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_release_username BEFORE INSERT OR UPDATE OF username ON player_usernames FOR EACH ROW EXECUTE FUNCTION guard_reserved_release_username();
GRANT ALL ON public.limited_releases,public.limited_claims,public.player_notifications,public.business_licenses TO service_role;

CREATE FUNCTION public.mark_ticket_notifications(p_ticket_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 UPDATE player_notifications SET read_at=COALESCE(read_at,now()),archived_at=COALESCE(archived_at,now()) WHERE user_id=auth.uid() AND kind='support' AND target='support:'||p_ticket_id AND read_at IS NULL;
END; $$;
REVOKE ALL ON FUNCTION public.mark_ticket_notifications(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mark_ticket_notifications(uuid) TO authenticated;

CREATE FUNCTION public.stamp_limited_asset_worth() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE worth numeric;
BEGIN
 SELECT LEAST(1e14::numeric,COALESCE(sum((item_snapshot->>'price')::numeric),0)) INTO worth FROM limited_claims WHERE user_id=NEW.user_id AND item_snapshot->>'kind' IN('car','nft');
 NEW.net_worth:=LEAST(1e14::numeric,GREATEST(0,NEW.net_worth+worth-COALESCE((NEW.game_state->>'limitedAssetWorth')::numeric,0)));
 NEW.game_state:=jsonb_set(NEW.game_state,'{limitedAssetWorth}',to_jsonb(worth));
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.stamp_limited_asset_worth() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER aab_stamp_limited_worth BEFORE INSERT OR UPDATE OF game_state ON game_saves FOR EACH ROW EXECUTE FUNCTION public.stamp_limited_asset_worth();

CREATE FUNCTION public.plate_available_for_purchase(p_text text,p_country text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
 RETURN NOT EXISTS(SELECT 1 FROM owned_license_plates WHERE data->>'text'=p_text AND data->>'country'=p_country)
 AND NOT EXISTS(SELECT 1 FROM limited_releases r WHERE r.kind='plate' AND r.status IN('scheduled','paused') AND (r.ends_at IS NULL OR now()<r.ends_at) AND r.payload->>'country'=p_country AND upper(p_text) ~ ('^'||replace(upper(r.payload->>'text_template'),'{SERIAL}','[0-9]{4,7}')||'$'));
END; $$;
REVOKE ALL ON FUNCTION public.plate_available_for_purchase(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.plate_available_for_purchase(text,text) TO service_role;
