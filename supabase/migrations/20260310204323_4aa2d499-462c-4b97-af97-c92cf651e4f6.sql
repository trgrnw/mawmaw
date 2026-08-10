-- RPC function for atomic market buy transaction
CREATE OR REPLACE FUNCTION public.buy_market_listing(p_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing market_listings%ROWTYPE;
  v_buyer_id uuid;
BEGIN
  v_buyer_id := auth.uid();
  IF v_buyer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  
  SELECT * INTO v_listing FROM market_listings 
  WHERE id = p_listing_id AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found or already sold'; END IF;
  IF v_listing.seller_id = v_buyer_id THEN RAISE EXCEPTION 'Cannot buy own listing'; END IF;
  
  UPDATE market_listings 
  SET status = 'sold', buyer_id = v_buyer_id, sold_at = now()
  WHERE id = p_listing_id;
  
  UPDATE game_saves 
  SET game_state = jsonb_set(
    game_state, '{balance}', 
    to_jsonb(COALESCE((game_state->>'balance')::numeric, 0) + v_listing.price)
  )
  WHERE user_id = v_listing.seller_id;
  
  IF v_listing.item_type = 'username' THEN
    UPDATE player_usernames 
    SET user_id = v_buyer_id, is_active = false
    WHERE id = (v_listing.item_data->>'username_id')::uuid;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'price', v_listing.price, 'item_type', v_listing.item_type, 'item_data', v_listing.item_data);
END;
$$;