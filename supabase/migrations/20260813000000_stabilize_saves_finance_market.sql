-- Stable saves, atomic pending claims, corrected clan balance checks and
-- authoritative fixed-price market purchases.

CREATE OR REPLACE FUNCTION public.save_game_state(p_state jsonb, p_net_worth numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_incoming_saved_at numeric := COALESCE((p_state->>'savedAt')::numeric, 0);
  v_current_saved_at numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_net_worth < 0 THEN RAISE EXCEPTION 'Invalid net worth'; END IF;

  SELECT COALESCE((game_state->>'savedAt')::numeric, 0)
    INTO v_current_saved_at
    FROM public.game_saves
    WHERE user_id = v_uid
    FOR UPDATE;

  IF FOUND AND v_incoming_saved_at < v_current_saved_at THEN
    RETURN jsonb_build_object('saved', false, 'reason', 'stale');
  END IF;

  INSERT INTO public.game_saves (user_id, game_state, net_worth)
  VALUES (v_uid, p_state, p_net_worth)
  ON CONFLICT (user_id) DO UPDATE
    SET game_state = EXCLUDED.game_state,
        net_worth = EXCLUDED.net_worth,
        updated_at = now();

  RETURN jsonb_build_object('saved', true);
END;
$$;

REVOKE ALL ON FUNCTION public.save_game_state(jsonb, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_game_state(jsonb, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_pending_balance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pending numeric := 0;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('amount', 0); END IF;

  SELECT pending_balance INTO v_pending
  FROM public.game_saves
  WHERE user_id = v_uid
  FOR UPDATE;

  v_pending := COALESCE(v_pending, 0);
  IF v_pending <> 0 THEN
    UPDATE public.game_saves SET pending_balance = 0 WHERE user_id = v_uid;
  END IF;

  RETURN jsonb_build_object('amount', v_pending);
END;
$$;

-- Older clan functions used the obsolete `money` JSON key. Redefine the
-- affected operations against balance + pending_balance.
CREATE OR REPLACE FUNCTION public.create_clan(p_name text, p_tag text, p_emoji text, p_description text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid(); v_clan_id uuid; v_owner_role_id uuid; v_member_role_id uuid;
  v_save game_saves%ROWTYPE; v_cost numeric := 50000;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM clan_members WHERE user_id = v_uid) THEN RAISE EXCEPTION 'Already in a clan'; END IF;
  IF length(trim(p_name)) < 3 OR length(p_name) > 30 THEN RAISE EXCEPTION 'Invalid name'; END IF;
  IF length(trim(p_tag)) < 2 OR length(trim(p_tag)) > 5 THEN RAISE EXCEPTION 'Invalid tag'; END IF;
  SELECT * INTO v_save FROM game_saves WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No game save'; END IF;
  IF COALESCE((v_save.game_state->>'balance')::numeric, 0) + v_save.pending_balance < v_cost THEN RAISE EXCEPTION 'Insufficient funds'; END IF;
  UPDATE game_saves SET pending_balance = pending_balance - v_cost WHERE user_id = v_uid;
  INSERT INTO clans (name, tag, emoji, description, owner_id)
    VALUES (trim(p_name), upper(trim(p_tag)), COALESCE(NULLIF(p_emoji,''),'🏛️'), COALESCE(p_description,''), v_uid)
    RETURNING id INTO v_clan_id;
  INSERT INTO clan_roles (clan_id, name, color, rank, is_owner_role, perm_invite, perm_kick, perm_treasury, perm_edit_clan, perm_manage_roles)
    VALUES (v_clan_id, 'Владелец', '#FBBF24', 100, true, true, true, true, true, true) RETURNING id INTO v_owner_role_id;
  INSERT INTO clan_roles (clan_id, name, color, rank, perm_invite, perm_kick, perm_treasury, perm_edit_clan, perm_manage_roles)
    VALUES (v_clan_id, 'Участник', '#9CA3AF', 0, false, false, false, false, false) RETURNING id INTO v_member_role_id;
  INSERT INTO clan_members (clan_id, user_id, role_id) VALUES (v_clan_id, v_uid, v_owner_role_id);
  RETURN jsonb_build_object('success', true, 'clan_id', v_clan_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.clan_treasury_op(p_action text, p_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_clan_id uuid; v_save game_saves%ROWTYPE; v_uname text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  v_clan_id := get_user_clan_id(v_uid);
  IF v_clan_id IS NULL THEN RAISE EXCEPTION 'Not in a clan'; END IF;
  SELECT username INTO v_uname FROM profiles WHERE user_id = v_uid;
  IF p_action = 'deposit' THEN
    SELECT * INTO v_save FROM game_saves WHERE user_id = v_uid FOR UPDATE;
    IF COALESCE((v_save.game_state->>'balance')::numeric, 0) + v_save.pending_balance < p_amount THEN RAISE EXCEPTION 'Insufficient funds'; END IF;
    UPDATE game_saves SET pending_balance = pending_balance - p_amount WHERE user_id = v_uid;
    UPDATE clans SET treasury = treasury + p_amount WHERE id = v_clan_id;
  ELSIF p_action = 'withdraw' THEN
    IF NOT user_has_clan_perm(v_uid, v_clan_id, 'treasury') THEN RAISE EXCEPTION 'No permission'; END IF;
    UPDATE clans SET treasury = treasury - p_amount WHERE id = v_clan_id AND treasury >= p_amount;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient treasury'; END IF;
    UPDATE game_saves SET pending_balance = pending_balance + p_amount WHERE user_id = v_uid;
  ELSE RAISE EXCEPTION 'Invalid action'; END IF;
  INSERT INTO clan_treasury_logs (clan_id, user_id, username, action, amount)
    VALUES (v_clan_id, v_uid, COALESCE(v_uname,'Player'), p_action, p_amount);
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.buy_market_listing(p_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_listing market_listings%ROWTYPE; v_save game_saves%ROWTYPE;
  v_available numeric; v_new_balance numeric; v_saved_at numeric := floor(extract(epoch FROM clock_timestamp()) * 1000);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_listing FROM market_listings WHERE id = p_listing_id AND status = 'active' AND listing_kind = 'fixed' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found or already sold'; END IF;
  IF v_listing.seller_id = v_uid THEN RAISE EXCEPTION 'Cannot buy own listing'; END IF;
  SELECT * INTO v_save FROM game_saves WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No game save'; END IF;
  v_available := COALESCE((v_save.game_state->>'balance')::numeric, 0) + v_save.pending_balance;
  IF v_available < v_listing.price THEN RAISE EXCEPTION 'Insufficient funds'; END IF;
  v_new_balance := v_available - v_listing.price;

  UPDATE game_saves SET
    game_state = jsonb_set(jsonb_set(game_state, '{balance}', to_jsonb(v_new_balance)), '{savedAt}', to_jsonb(v_saved_at)),
    pending_balance = 0
  WHERE user_id = v_uid;
  UPDATE game_saves SET pending_balance = pending_balance + v_listing.price WHERE user_id = v_listing.seller_id;
  UPDATE market_listings SET status = 'sold', buyer_id = v_uid, sold_at = now() WHERE id = p_listing_id;
  IF v_listing.item_type = 'username' THEN
    UPDATE player_usernames SET user_id = v_uid, is_active = false
      WHERE id = (v_listing.item_data->>'username_id')::uuid AND user_id = v_listing.seller_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Seller no longer owns this username'; END IF;
  END IF;
  RETURN jsonb_build_object('success', true, 'price', v_listing.price, 'item_type', v_listing.item_type,
    'item_data', v_listing.item_data, 'new_balance', v_new_balance, 'saved_at', v_saved_at);
END;
$$;

WITH duplicates AS (
  SELECT id, row_number() OVER (
    PARTITION BY item_type, COALESCE(item_data->>'username_id', item_data->>'plate_id')
    ORDER BY created_at, id
  ) AS duplicate_number
  FROM public.market_listings
  WHERE status = 'active'
)
UPDATE public.market_listings listing
SET status = 'cancelled'
FROM duplicates
WHERE listing.id = duplicates.id AND duplicates.duplicate_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_market_asset
ON public.market_listings (item_type, (COALESCE(item_data->>'username_id', item_data->>'plate_id')))
WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.validate_market_listing_asset()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.item_type NOT IN ('username', 'license_plate') THEN RAISE EXCEPTION 'Invalid item type'; END IF;
  IF NEW.item_type = 'username' AND NOT EXISTS (
    SELECT 1 FROM player_usernames
    WHERE id = (NEW.item_data->>'username_id')::uuid AND user_id = NEW.seller_id
  ) THEN RAISE EXCEPTION 'Seller does not own this username'; END IF;
  IF NEW.item_type = 'license_plate' AND NULLIF(NEW.item_data->>'plate_id', '') IS NULL THEN
    RAISE EXCEPTION 'Invalid license plate';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_market_listing_asset ON public.market_listings;
CREATE TRIGGER trg_validate_market_listing_asset
BEFORE INSERT OR UPDATE OF item_type, item_data, seller_id ON public.market_listings
FOR EACH ROW EXECUTE FUNCTION public.validate_market_listing_asset();

CREATE OR REPLACE FUNCTION public.update_clan_info(p_name text, p_tag text, p_emoji text, p_description text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_clan_id uuid; v_save game_saves%ROWTYPE;
  v_cost_name numeric := 10000; v_cost_tag numeric := 10000; v_total numeric := 0; v_clan clans%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_clan_id := get_user_clan_id(v_uid);
  IF v_clan_id IS NULL THEN RAISE EXCEPTION 'Not in a clan'; END IF;
  IF NOT user_has_clan_perm(v_uid, v_clan_id, 'edit_clan') THEN RAISE EXCEPTION 'No permission'; END IF;
  SELECT * INTO v_clan FROM clans WHERE id = v_clan_id FOR UPDATE;
  IF p_name IS NOT NULL AND trim(p_name) <> v_clan.name THEN v_total := v_total + v_cost_name; END IF;
  IF p_tag IS NOT NULL AND upper(trim(p_tag)) <> v_clan.tag THEN v_total := v_total + v_cost_tag; END IF;
  IF v_total > 0 THEN
    SELECT * INTO v_save FROM game_saves WHERE user_id = v_uid FOR UPDATE;
    IF COALESCE((v_save.game_state->>'balance')::numeric, 0) + v_save.pending_balance < v_total THEN RAISE EXCEPTION 'Insufficient funds'; END IF;
    UPDATE game_saves SET pending_balance = pending_balance - v_total WHERE user_id = v_uid;
  END IF;
  UPDATE clans SET name = COALESCE(NULLIF(trim(p_name),''), name), tag = COALESCE(NULLIF(upper(trim(p_tag)),''), tag),
    emoji = COALESCE(NULLIF(p_emoji,''), emoji), description = COALESCE(p_description, description), updated_at = now()
  WHERE id = v_clan_id;
  RETURN jsonb_build_object('success', true, 'cost', v_total);
END;
$$;
