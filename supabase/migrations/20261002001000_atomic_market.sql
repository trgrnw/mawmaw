REVOKE INSERT,UPDATE,DELETE ON public.market_listings FROM anon,authenticated;
DROP POLICY IF EXISTS "Users can update own listings" ON public.market_listings;
CREATE OR REPLACE FUNCTION public.create_market_listing(p_item_type text,p_item_data jsonb,p_price numeric,p_duration_hours integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid();v_id uuid;v_data jsonb;v_plate owned_license_plates%ROWTYPE;v_username player_usernames%ROWTYPE;BEGIN
 IF v_uid IS NULL OR is_user_banned(v_uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 IF p_price IS NULL OR p_price<=0 OR p_price>1e14 THEN RAISE EXCEPTION 'Invalid price'; END IF;
 IF p_duration_hours IS NOT NULL AND p_duration_hours NOT IN(1,6,12,24,48) THEN RAISE EXCEPTION 'Invalid duration'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('market-economy'));
 PERFORM 1 FROM game_saves WHERE user_id=v_uid FOR UPDATE;
 IF p_item_type='username' THEN
  SELECT * INTO v_username FROM player_usernames WHERE id=(p_item_data->>'username_id')::uuid AND user_id=v_uid FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Not your username'; END IF;
  IF EXISTS(SELECT 1 FROM market_listings WHERE status='active' AND item_type='username' AND item_data->>'username_id'=v_username.id::text) THEN RAISE EXCEPTION 'Already listed'; END IF;
  v_data:=jsonb_build_object('username_id',v_username.id,'username',v_username.username);
 ELSE
  IF p_item_type<>'license_plate' THEN RAISE EXCEPTION 'Invalid item'; END IF;
  SELECT * INTO v_plate FROM owned_license_plates WHERE id=p_item_data->>'plate_id' AND owner_id=v_uid AND listing_id IS NULL FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Not your plate'; END IF;
  v_data:=v_plate.data||jsonb_build_object('plate_id',v_plate.id);
 END IF;
 INSERT INTO market_listings(seller_id,item_type,item_data,price,listing_kind,auction_ends_at,min_bid)
 VALUES(v_uid,p_item_type,v_data,p_price,CASE WHEN p_duration_hours IS NULL THEN 'fixed' ELSE 'auction' END,CASE WHEN p_duration_hours IS NULL THEN NULL ELSE now()+p_duration_hours*interval '1 hour' END,CASE WHEN p_duration_hours IS NULL THEN NULL ELSE p_price END) RETURNING id INTO v_id;
 IF p_item_type='license_plate' THEN
  UPDATE owned_license_plates SET listing_id=v_id WHERE id=v_plate.id;
  UPDATE game_saves SET game_state=jsonb_set(game_state,'{licensePlates}',COALESCE((SELECT jsonb_agg(p) FROM jsonb_array_elements(COALESCE(game_state->'licensePlates','[]')) p WHERE p->>'id'<>v_plate.id),'[]')) WHERE user_id=v_uid;
 ELSE UPDATE player_usernames SET is_active=false WHERE id=v_username.id; END IF;
 RETURN jsonb_build_object('success',true,'listing_id',v_id);
END; $$;
CREATE OR REPLACE FUNCTION public.create_auction_listing(p_item_type text,p_item_data jsonb,p_min_bid numeric,p_duration_hours integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT create_market_listing(p_item_type,p_item_data,p_min_bid,p_duration_hours); $$;
CREATE OR REPLACE FUNCTION public.transfer_market_asset(p_listing_id uuid,p_buyer uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v market_listings%ROWTYPE;v_plate jsonb;BEGIN
 SELECT * INTO v FROM market_listings WHERE id=p_listing_id FOR UPDATE;
 IF v.item_type='username' THEN
  UPDATE player_usernames SET user_id=p_buyer,is_active=false WHERE id=(v.item_data->>'username_id')::uuid AND user_id=v.seller_id;IF NOT FOUND THEN RAISE EXCEPTION 'Ownership changed'; END IF;
 ELSE
  UPDATE owned_license_plates SET owner_id=p_buyer,listing_id=NULL,data=jsonb_set(data,'{assignedTo}','null') WHERE id=v.item_data->>'plate_id' AND owner_id=v.seller_id AND listing_id=v.id RETURNING data INTO v_plate;IF NOT FOUND THEN RAISE EXCEPTION 'Ownership changed'; END IF;
  UPDATE game_saves SET game_state=jsonb_set(game_state,'{licensePlates}',COALESCE(game_state->'licensePlates','[]')||jsonb_build_array(v_plate)) WHERE user_id=p_buyer;
 END IF;
END; $$;
REVOKE ALL ON FUNCTION transfer_market_asset(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.buy_market_listing(p_listing_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid();v market_listings%ROWTYPE;BEGIN
 IF v_uid IS NULL OR is_user_banned(v_uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('market-economy'));
 SELECT * INTO v FROM market_listings WHERE id=p_listing_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Listing unavailable'; END IF;
 IF v.status='sold' AND v.buyer_id=v_uid THEN RETURN jsonb_build_object('success',true,'already_bought',true); END IF;
 IF NOT FOUND OR v.status<>'active' OR v.listing_kind<>'fixed' OR v.seller_id=v_uid THEN RAISE EXCEPTION 'Listing unavailable'; END IF;
 PERFORM 1 FROM game_saves WHERE user_id IN(v_uid,v.seller_id) ORDER BY user_id FOR UPDATE;
 PERFORM debit_player(v_uid,v.price);PERFORM transfer_market_asset(v.id,v_uid);
 UPDATE game_saves SET pending_balance=pending_balance+v.price WHERE user_id=v.seller_id;
 UPDATE market_listings SET status='sold',buyer_id=v_uid,sold_at=now() WHERE id=v.id;
 RETURN jsonb_build_object('success',true);
END; $$;
CREATE OR REPLACE FUNCTION public.place_bid(p_listing_id uuid,p_amount numeric) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid();v market_listings%ROWTYPE;v_min numeric;v_name text;BEGIN
 IF v_uid IS NULL OR is_user_banned(v_uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount>1e14 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('market-economy'));
 SELECT * INTO v FROM market_listings WHERE id=p_listing_id FOR UPDATE;
 IF NOT FOUND OR v.status<>'active' OR v.listing_kind<>'auction' OR now()>=v.auction_ends_at OR v.seller_id=v_uid THEN RAISE EXCEPTION 'Auction unavailable'; END IF;
 IF v.current_bidder_id=v_uid AND v.current_bid=p_amount THEN RETURN jsonb_build_object('success',true); END IF;
 IF v.current_bidder_id=v_uid THEN RAISE EXCEPTION 'Already highest bidder'; END IF;
 v_min:=CASE WHEN v.current_bid IS NULL THEN v.min_bid ELSE v.current_bid+GREATEST(v.current_bid*.05,1) END;IF p_amount<v_min THEN RAISE EXCEPTION 'Bid too low'; END IF;
 PERFORM 1 FROM game_saves WHERE user_id IN(v_uid,v.current_bidder_id) ORDER BY user_id FOR UPDATE;
 PERFORM debit_player(v_uid,p_amount);
 IF v.current_bidder_id IS NOT NULL THEN UPDATE game_saves SET pending_balance=pending_balance+v.current_bid WHERE user_id=v.current_bidder_id;END IF;
 SELECT username INTO v_name FROM profiles WHERE user_id=v_uid;
 UPDATE market_listings SET current_bid=p_amount,current_bidder_id=v_uid,price=p_amount,bid_count=bid_count+1,auction_ends_at=CASE WHEN auction_ends_at-now()<interval '2 minutes' THEN now()+interval '2 minutes' ELSE auction_ends_at END WHERE id=v.id;
 INSERT INTO market_bids(listing_id,bidder_id,bidder_name,amount) VALUES(v.id,v_uid,v_name,p_amount);
 RETURN jsonb_build_object('success',true);
END; $$;
CREATE OR REPLACE FUNCTION public.cancel_auction(p_listing_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v market_listings%ROWTYPE;v_plate jsonb;BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('market-economy'));
 IF auth.uid() IS NULL OR is_user_banned(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 SELECT * INTO v FROM market_listings WHERE id=p_listing_id AND seller_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Not your listing'; END IF;
 IF v.status='cancelled' THEN RETURN jsonb_build_object('success',true); END IF;
 IF v.status<>'active' OR v.current_bidder_id IS NOT NULL THEN RAISE EXCEPTION 'Cannot cancel'; END IF;
 PERFORM 1 FROM game_saves WHERE user_id=v.seller_id FOR UPDATE;
 UPDATE market_listings SET status='cancelled' WHERE id=v.id;
 IF v.item_type='license_plate' THEN
  UPDATE owned_license_plates SET listing_id=NULL WHERE id=v.item_data->>'plate_id' RETURNING data INTO v_plate;
  UPDATE game_saves SET game_state=jsonb_set(game_state,'{licensePlates}',COALESCE(game_state->'licensePlates','[]')||jsonb_build_array(v_plate)) WHERE user_id=v.seller_id;
 END IF;
 RETURN jsonb_build_object('success',true);
END; $$;
CREATE OR REPLACE FUNCTION public.finalize_expired_auctions() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v market_listings%ROWTYPE;n integer:=0;BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('market-economy'));
 FOR v IN SELECT * FROM market_listings WHERE status='active' AND listing_kind='auction' AND auction_ends_at<=now() ORDER BY id FOR UPDATE LOOP
  PERFORM 1 FROM game_saves WHERE user_id IN(v.seller_id,v.current_bidder_id) ORDER BY user_id FOR UPDATE;
  IF v.current_bidder_id IS NOT NULL THEN
   PERFORM transfer_market_asset(v.id,v.current_bidder_id);
   UPDATE game_saves SET pending_balance=pending_balance+v.current_bid WHERE user_id=v.seller_id;
   UPDATE market_listings SET status='sold',buyer_id=v.current_bidder_id,sold_at=now() WHERE id=v.id;
  ELSE
   UPDATE market_listings SET status='cancelled' WHERE id=v.id;
   IF v.item_type='license_plate' THEN
    UPDATE owned_license_plates SET listing_id=NULL WHERE id=v.item_data->>'plate_id';
    UPDATE game_saves SET game_state=jsonb_set(game_state,'{licensePlates}',COALESCE(game_state->'licensePlates','[]')||jsonb_build_array((SELECT data FROM owned_license_plates WHERE id=v.item_data->>'plate_id'))) WHERE user_id=v.seller_id;
   END IF;
  END IF;n:=n+1;
 END LOOP;RETURN jsonb_build_object('finalized',n);
END; $$;
REVOKE ALL ON FUNCTION create_market_listing(text,jsonb,numeric,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_market_listing(text,jsonb,numeric,integer) TO authenticated;
-- The trigger must validate ownership on all asset transfers too.
CREATE OR REPLACE FUNCTION public.validate_market_listing_asset() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.item_type='username' AND NOT EXISTS(SELECT 1 FROM player_usernames WHERE id=(NEW.item_data->>'username_id')::uuid AND user_id=NEW.seller_id) THEN RAISE EXCEPTION 'Not your username'; END IF;
 IF NEW.item_type='license_plate' AND NOT EXISTS(SELECT 1 FROM owned_license_plates WHERE id=NEW.item_data->>'plate_id' AND owner_id=NEW.seller_id AND listing_id IS NULL) THEN RAISE EXCEPTION 'Not your plate'; END IF;
 RETURN NEW; END; $$;
