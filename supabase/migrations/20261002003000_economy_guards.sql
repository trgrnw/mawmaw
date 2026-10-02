-- A banned account may still receive settlement/refunds from other players.
-- Player initiated mutations are checked in each RPC; direct writes are revoked.
CREATE OR REPLACE FUNCTION block_banned_save() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.role()<>'service_role' AND auth.uid()=NEW.user_id AND is_user_banned(NEW.user_id) THEN RAISE EXCEPTION 'User is banned'; END IF;RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION guard_username_activation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.is_active AND (TG_OP='INSERT' OR OLD.is_active IS DISTINCT FROM NEW.is_active OR OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));
  IF (SELECT count(*) FROM player_usernames WHERE user_id=NEW.user_id AND is_active AND id<>NEW.id)>=15 THEN RAISE EXCEPTION 'Active username limit reached'; END IF;
  IF EXISTS(SELECT 1 FROM market_listings WHERE status='active' AND item_type='username' AND item_data->>'username_id'=NEW.id::text) THEN RAISE EXCEPTION 'Username is listed'; END IF;
 END IF;RETURN NEW;
END; $$;
CREATE TRIGGER trg_username_activation BEFORE INSERT OR UPDATE ON player_usernames FOR EACH ROW EXECUTE FUNCTION guard_username_activation();
CREATE OR REPLACE FUNCTION delete_player_username(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL OR is_user_banned(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('market-economy'));
 IF EXISTS(SELECT 1 FROM market_listings WHERE status='active' AND item_type='username' AND item_data->>'username_id'=p_id::text) THEN RAISE EXCEPTION 'Cancel the listing first'; END IF;
 DELETE FROM player_usernames WHERE id=p_id AND user_id=auth.uid();
 RETURN jsonb_build_object('success',true);
END; $$;
REVOKE ALL ON FUNCTION delete_player_username(uuid),purchase_player_username(text),claim_pending_balance(),create_auction_listing(text,jsonb,numeric,integer),buy_market_listing(uuid),place_bid(uuid,numeric),cancel_auction(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION delete_player_username(uuid),purchase_player_username(text),claim_pending_balance(),create_auction_listing(text,jsonb,numeric,integer),buy_market_listing(uuid),place_bid(uuid,numeric),cancel_auction(uuid) TO authenticated;
-- Serialize the eligibility check and the spin itself for a given account.
ALTER FUNCTION spin_daily_wheel() RENAME TO spin_daily_wheel_internal;
REVOKE ALL ON FUNCTION spin_daily_wheel_internal() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION spin_daily_wheel() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text));
 RETURN spin_daily_wheel_internal();
END; $$;
REVOKE ALL ON FUNCTION spin_daily_wheel() FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION spin_daily_wheel() TO authenticated;
-- Keep staff history available without exposing hidden outcomes to players.
DROP POLICY IF EXISTS "Anyone can view bets" ON casino_bets;
CREATE POLICY "Players read own bets and staff read history" ON casino_bets FOR SELECT TO authenticated USING(user_id=auth.uid() OR is_staff(auth.uid()));
GRANT SELECT ON casino_bets TO authenticated;
CREATE OR REPLACE FUNCTION admin_set_player_balance(p_user_id uuid,p_balance numeric) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL OR NOT is_staff(auth.uid()) THEN RAISE EXCEPTION 'No permission'; END IF;
 IF p_balance IS NULL OR p_balance<0 OR p_balance>1e14 THEN RAISE EXCEPTION 'Invalid balance'; END IF;
 UPDATE game_saves SET game_state=jsonb_set(game_state,'{balance}',to_jsonb(p_balance)),pending_balance=0 WHERE user_id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Player save not found'; END IF;
 INSERT INTO admin_logs(admin_user_id,action,target_user_id,details) VALUES(auth.uid(),'change_balance',p_user_id,jsonb_build_object('new_balance',p_balance));
 RETURN jsonb_build_object('success',true);
END; $$;
CREATE OR REPLACE FUNCTION admin_reset_player(p_user_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL OR NOT is_staff(auth.uid()) THEN RAISE EXCEPTION 'No permission'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('casino-economy'));PERFORM pg_advisory_xact_lock(hashtext('market-economy'));
 IF EXISTS(SELECT 1 FROM market_listings WHERE status='active' AND(seller_id=p_user_id OR current_bidder_id=p_user_id)) OR EXISTS(SELECT 1 FROM casino_bets WHERE user_id=p_user_id AND result='pending') OR EXISTS(SELECT 1 FROM casino_mines_games WHERE user_id=p_user_id AND status='active') THEN RAISE EXCEPTION 'Finish active trades and games first'; END IF;
 PERFORM 1 FROM game_saves WHERE user_id=p_user_id FOR UPDATE;
 DELETE FROM owned_license_plates WHERE owner_id=p_user_id AND listing_id IS NULL;
 UPDATE game_saves SET game_state='{}',net_worth=0,pending_balance=0,last_seen_at=now() WHERE user_id=p_user_id;
 INSERT INTO admin_logs(admin_user_id,action,target_user_id,details) VALUES(auth.uid(),'reset_progress',p_user_id,'{}');
 RETURN jsonb_build_object('success',true);
END; $$;
REVOKE ALL ON FUNCTION admin_set_player_balance(uuid,numeric),admin_reset_player(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION admin_set_player_balance(uuid,numeric),admin_reset_player(uuid) TO authenticated;
