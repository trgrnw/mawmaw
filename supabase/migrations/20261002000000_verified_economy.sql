-- Apply with the matching game-sync/casino functions and generated domain bundle.
-- Existing snapshots are preserved; all future player changes pass the verified engine.
ALTER TABLE public.game_saves ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0;
CREATE TABLE public.game_action_receipts(user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, action_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,action_id));
ALTER TABLE public.game_action_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own action receipts" ON public.game_action_receipts FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.game_saves FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.save_game_state(jsonb,numeric) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.bump_game_revision() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.game_state IS DISTINCT FROM OLD.game_state OR NEW.pending_balance IS DISTINCT FROM OLD.pending_balance THEN NEW.revision:=OLD.revision+1; END IF; RETURN NEW; END; $$;
CREATE TRIGGER trg_game_revision BEFORE UPDATE ON public.game_saves FOR EACH ROW EXECUTE FUNCTION public.bump_game_revision();
CREATE TABLE public.owned_license_plates(id text PRIMARY KEY, owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, data jsonb NOT NULL, listing_id uuid REFERENCES public.market_listings(id));
ALTER TABLE public.owned_license_plates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own plates" ON public.owned_license_plates FOR SELECT TO authenticated USING(owner_id=auth.uid());
INSERT INTO public.owned_license_plates(id,owner_id,data)
SELECT plate->>'id',g.user_id,plate FROM public.game_saves g CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(g.game_state->'licensePlates')='array' THEN g.game_state->'licensePlates' ELSE '[]'::jsonb END) plate
WHERE nullif(plate->>'id','') IS NOT NULL ON CONFLICT(id) DO NOTHING;
-- Keep the earliest live escrow for an asset and refund duplicate auction holds.
DO $$ DECLARE v market_listings%ROWTYPE; BEGIN
 FOR v IN SELECT m.* FROM market_listings m JOIN (SELECT id,row_number() OVER(PARTITION BY item_type,CASE WHEN item_type='username' THEN item_data->>'username_id' ELSE item_data->>'plate_id' END ORDER BY created_at,id) AS n FROM market_listings WHERE status='active') r ON r.id=m.id WHERE r.n>1 LOOP
  IF v.current_bidder_id IS NOT NULL THEN UPDATE game_saves SET pending_balance=pending_balance+v.current_bid WHERE user_id=v.current_bidder_id; END IF;
  UPDATE market_listings SET status='cancelled' WHERE id=v.id;
 END LOOP;
END $$;
-- Recover the final buyer of previously sold plates before restoring active escrow.
INSERT INTO owned_license_plates(id,owner_id,data)
SELECT DISTINCT ON (item_data->>'plate_id') item_data->>'plate_id',buyer_id,jsonb_build_object('id',item_data->>'plate_id','text',item_data->>'text','country',item_data->>'country','assignedTo',NULL,'isCustom',COALESCE((item_data->>'isCustom')::boolean,false))
FROM market_listings m WHERE status='sold' AND item_type='license_plate' AND buyer_id IS NOT NULL AND nullif(item_data->>'plate_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM market_listings a WHERE a.status='active' AND a.item_type='license_plate' AND a.item_data->>'plate_id'=m.item_data->>'plate_id')
ORDER BY item_data->>'plate_id',sold_at DESC NULLS LAST,created_at DESC
ON CONFLICT(id) DO UPDATE SET owner_id=EXCLUDED.owner_id,data=EXCLUDED.data;
-- Recover plates held in old market escrow (they were removed from snapshots).
INSERT INTO owned_license_plates(id,owner_id,data,listing_id)
SELECT item_data->>'plate_id',seller_id,jsonb_build_object('id',item_data->>'plate_id','text',item_data->>'text','country',item_data->>'country','assignedTo',NULL,'isCustom',COALESCE((item_data->>'isCustom')::boolean,false)),id
FROM market_listings WHERE status='active' AND item_type='license_plate' AND nullif(item_data->>'plate_id','') IS NOT NULL
ON CONFLICT(id) DO UPDATE SET owner_id=EXCLUDED.owner_id,data=EXCLUDED.data,listing_id=EXCLUDED.listing_id;
-- Remove escrow copies from inventory; the exact same ID is returned on cancellation.
UPDATE game_saves g SET game_state=jsonb_set(g.game_state,'{licensePlates}',COALESCE((SELECT jsonb_agg(p) FROM jsonb_array_elements(COALESCE(g.game_state->'licensePlates','[]')) p WHERE NOT EXISTS(SELECT 1 FROM owned_license_plates o WHERE o.id=p->>'id' AND(o.owner_id<>g.user_id OR o.listing_id IS NOT NULL))),'[]'));
-- Add missing canonical copies to their current owner, never from client history.
UPDATE game_saves g SET game_state=jsonb_set(g.game_state,'{licensePlates}',COALESCE(g.game_state->'licensePlates','[]')||COALESCE((SELECT jsonb_agg(o.data) FROM owned_license_plates o WHERE o.owner_id=g.user_id AND o.listing_id IS NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(g.game_state->'licensePlates','[]')) p WHERE p->>'id'=o.id)),'[]'));
-- Old clients sometimes created a random ID and a second canonical ID for one purchase.
UPDATE game_saves g SET game_state=jsonb_set(g.game_state,'{licensePlates}',COALESCE((SELECT jsonb_agg(p) FROM (SELECT DISTINCT ON(p->>'country',p->>'text') p FROM jsonb_array_elements(COALESCE(g.game_state->'licensePlates','[]')) p ORDER BY p->>'country',p->>'text',EXISTS(SELECT 1 FROM owned_license_plates o WHERE o.id=p->>'id' AND o.owner_id=g.user_id) DESC) unique_plates),'[]'));
CREATE OR REPLACE FUNCTION public.commit_verified_game_state(p_user_id uuid,p_revision bigint,p_state jsonb,p_net_worth numeric,p_action_ids text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_save game_saves%ROWTYPE;v_state jsonb;v_plate jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
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
  UPDATE game_saves SET game_state=v_state,net_worth=p_net_worth,pending_balance=0,last_seen_at=now() WHERE user_id=p_user_id;
  INSERT INTO game_action_receipts(user_id,action_id) SELECT p_user_id,unnest(p_action_ids);
  RETURN jsonb_build_object('committed',true,'state',v_state);
END; $$;
REVOKE ALL ON FUNCTION public.commit_verified_game_state(uuid,bigint,jsonb,numeric,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_verified_game_state(uuid,bigint,jsonb,numeric,text[]) TO service_role;
-- Legacy income claims cannot accept a client-provided rate.
REVOKE ALL ON FUNCTION public.claim_offline_income(numeric) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.claim_pending_balance() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v game_saves%ROWTYPE;v_state jsonb;BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 SELECT * INTO v FROM game_saves WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('amount',0); END IF;
 v_state:=jsonb_set(v.game_state,'{balance}',to_jsonb(GREATEST(0,COALESCE((v.game_state->>'balance')::numeric,0)+v.pending_balance)));
 UPDATE game_saves SET game_state=v_state,pending_balance=0 WHERE user_id=auth.uid();
 RETURN jsonb_build_object('amount',v.pending_balance,'balance',(v_state->>'balance')::numeric,'state',v_state);
END; $$;
CREATE OR REPLACE FUNCTION public.get_active_ban(_user_id uuid)
RETURNS TABLE(id uuid,reason text,ban_type text,expires_at timestamptz,created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT b.id,b.reason,b.ban_type,b.expires_at,b.created_at FROM user_bans b WHERE b.user_id=_user_id AND b.is_active AND (b.ban_type='permanent' OR b.expires_at>now()) AND (_user_id=auth.uid() OR is_staff(auth.uid())) ORDER BY b.created_at DESC LIMIT 1;
$$;
-- Only narrow RPCs may move player funds or ownership.
CREATE OR REPLACE FUNCTION public.debit_player(p_uid uuid,p_amount numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v game_saves%ROWTYPE;v_balance numeric;BEGIN
 IF p_amount IS NULL OR p_amount<=0 OR p_amount>1e14 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
 SELECT * INTO v FROM game_saves WHERE user_id=p_uid FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'No save'; END IF;
 v_balance:=COALESCE((v.game_state->>'balance')::numeric,0)+v.pending_balance;
 IF v_balance<p_amount THEN RAISE EXCEPTION 'Insufficient funds'; END IF;
 UPDATE game_saves SET game_state=jsonb_set(game_state,'{balance}',to_jsonb(v_balance-p_amount)),pending_balance=0 WHERE user_id=p_uid;
END; $$;
REVOKE ALL ON FUNCTION public.debit_player(uuid,numeric) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.purchase_player_username(p_username text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid();v_name text:=lower(trim(leading '@' from coalesce(p_username,'')));v_row player_usernames%ROWTYPE;BEGIN
 IF v_uid IS NULL OR is_user_banned(v_uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(v_uid::text));
 IF v_name !~ '^[a-z0-9_]{5,26}$' THEN RAISE EXCEPTION 'Invalid username'; END IF;
 SELECT * INTO v_row FROM player_usernames WHERE user_id=v_uid AND lower(username)=v_name;IF FOUND THEN RETURN to_jsonb(v_row); END IF;
 IF (SELECT count(*) FROM player_usernames WHERE user_id=v_uid)>=25 THEN RAISE EXCEPTION 'Username limit reached'; END IF;
 PERFORM debit_player(v_uid,100);
 INSERT INTO player_usernames(user_id,username,is_active) VALUES(v_uid,v_name,(SELECT count(*) FROM player_usernames WHERE user_id=v_uid AND is_active)<15) RETURNING * INTO v_row;
 RETURN to_jsonb(v_row);
END; $$;
REVOKE INSERT,UPDATE,DELETE ON player_usernames FROM anon,authenticated;
GRANT UPDATE(is_active) ON player_usernames TO authenticated;
-- A player's public clan ranking must aggregate all members, without exposing saves.
CREATE OR REPLACE FUNCTION public.get_clan_leaderboard() RETURNS TABLE(id uuid,name text,tag text,emoji text,member_count integer,total_net_worth numeric,owner_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.id,c.name,c.tag,c.emoji,c.member_count,COALESCE(sum(g.net_worth),0)+c.treasury,p.username FROM clans c LEFT JOIN clan_members m ON m.clan_id=c.id LEFT JOIN game_saves g ON g.user_id=m.user_id LEFT JOIN profiles p ON p.user_id=c.owner_id GROUP BY c.id,p.username ORDER BY COALESCE(sum(g.net_worth),0)+c.treasury DESC LIMIT 100;
$$;
REVOKE ALL ON FUNCTION get_clan_leaderboard() FROM PUBLIC;GRANT EXECUTE ON FUNCTION get_clan_leaderboard() TO anon,authenticated;
