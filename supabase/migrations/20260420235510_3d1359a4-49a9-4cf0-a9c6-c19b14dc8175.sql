
-- Favorites
CREATE TABLE public.market_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_id)
);
ALTER TABLE public.market_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorites" ON public.market_favorites
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_market_favorites_user ON public.market_favorites(user_id);

-- Auction fields on market_listings
ALTER TABLE public.market_listings
  ADD COLUMN listing_kind text NOT NULL DEFAULT 'fixed', -- 'fixed' | 'auction'
  ADD COLUMN auction_ends_at timestamptz,
  ADD COLUMN min_bid numeric,
  ADD COLUMN current_bid numeric,
  ADD COLUMN current_bidder_id uuid,
  ADD COLUMN bid_count integer NOT NULL DEFAULT 0;

CREATE INDEX idx_market_listings_status ON public.market_listings(status, created_at DESC);
CREATE INDEX idx_market_listings_seller ON public.market_listings(seller_id);
CREATE INDEX idx_market_listings_buyer ON public.market_listings(buyer_id);
CREATE INDEX idx_market_listings_auction_end ON public.market_listings(auction_ends_at) WHERE listing_kind = 'auction' AND status = 'active';

-- Bids history
CREATE TABLE public.market_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  bidder_id uuid NOT NULL,
  bidder_name text NOT NULL DEFAULT 'Player',
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.market_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view bids" ON public.market_bids FOR SELECT USING (true);
CREATE INDEX idx_market_bids_listing ON public.market_bids(listing_id, created_at DESC);

-- Offline income tracking
ALTER TABLE public.game_saves
  ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now();

-- Place auction listing
CREATE OR REPLACE FUNCTION public.create_auction_listing(
  p_item_type text, p_item_data jsonb, p_min_bid numeric, p_duration_hours int
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_min_bid <= 0 THEN RAISE EXCEPTION 'Invalid min bid'; END IF;
  IF p_duration_hours NOT IN (1, 6, 12, 24, 48) THEN RAISE EXCEPTION 'Invalid duration'; END IF;
  INSERT INTO market_listings (seller_id, item_type, item_data, price, listing_kind, auction_ends_at, min_bid, current_bid)
  VALUES (v_uid, p_item_type, p_item_data, p_min_bid, 'auction', now() + (p_duration_hours || ' hours')::interval, p_min_bid, NULL)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'listing_id', v_id);
END;
$$;

-- Place a bid (escrow: deduct bidder pending_balance, refund previous bidder)
CREATE OR REPLACE FUNCTION public.place_bid(p_listing_id uuid, p_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_listing market_listings%ROWTYPE;
  v_uname text;
  v_min_next numeric;
  v_save game_saves%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_listing FROM market_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND OR v_listing.status <> 'active' OR v_listing.listing_kind <> 'auction' THEN
    RAISE EXCEPTION 'Auction not available';
  END IF;
  IF v_listing.seller_id = v_uid THEN RAISE EXCEPTION 'Cannot bid on own auction'; END IF;
  IF now() >= v_listing.auction_ends_at THEN RAISE EXCEPTION 'Auction ended'; END IF;
  IF v_listing.current_bidder_id = v_uid THEN RAISE EXCEPTION 'Already top bidder'; END IF;

  v_min_next := COALESCE(v_listing.current_bid, v_listing.min_bid - 1) + 
                CASE WHEN v_listing.current_bid IS NULL THEN 0 ELSE GREATEST(v_listing.current_bid * 0.05, 1) END;
  IF p_amount < GREATEST(v_listing.min_bid, v_min_next) THEN
    RAISE EXCEPTION 'Bid too low (need at least $%)', GREATEST(v_listing.min_bid, v_min_next);
  END IF;

  -- Check funds
  SELECT * INTO v_save FROM game_saves WHERE user_id = v_uid FOR UPDATE;
  IF (COALESCE((v_save.game_state->>'balance')::numeric, 0) + v_save.pending_balance) < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  -- Escrow: deduct from new bidder
  UPDATE game_saves SET pending_balance = pending_balance - p_amount WHERE user_id = v_uid;

  -- Refund previous bidder
  IF v_listing.current_bidder_id IS NOT NULL THEN
    UPDATE game_saves SET pending_balance = pending_balance + v_listing.current_bid
      WHERE user_id = v_listing.current_bidder_id;
  END IF;

  SELECT username INTO v_uname FROM profiles WHERE user_id = v_uid;
  UPDATE market_listings 
    SET current_bid = p_amount, current_bidder_id = v_uid, bid_count = bid_count + 1, price = p_amount
    WHERE id = p_listing_id;
  INSERT INTO market_bids (listing_id, bidder_id, bidder_name, amount)
    VALUES (p_listing_id, v_uid, COALESCE(v_uname,'Player'), p_amount);

  -- Anti-snipe: extend by 2 minutes if <2 min remain
  IF v_listing.auction_ends_at - now() < interval '2 minutes' THEN
    UPDATE market_listings SET auction_ends_at = auction_ends_at + interval '2 minutes' WHERE id = p_listing_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'new_bid', p_amount);
END;
$$;

-- Finalize all expired auctions (called periodically by clients; idempotent)
CREATE OR REPLACE FUNCTION public.finalize_expired_auctions()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int := 0; v_listing market_listings%ROWTYPE;
BEGIN
  FOR v_listing IN 
    SELECT * FROM market_listings 
    WHERE listing_kind = 'auction' AND status = 'active' AND auction_ends_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    IF v_listing.current_bidder_id IS NULL THEN
      -- No bids: cancel
      UPDATE market_listings SET status = 'cancelled' WHERE id = v_listing.id;
      -- Reactivate username if applicable
      IF v_listing.item_type = 'username' THEN
        UPDATE player_usernames SET is_active = false WHERE id = (v_listing.item_data->>'username_id')::uuid;
      END IF;
    ELSE
      -- Sold to top bidder. Money already escrowed: credit seller from system.
      UPDATE market_listings 
        SET status = 'sold', buyer_id = v_listing.current_bidder_id, sold_at = now()
        WHERE id = v_listing.id;
      UPDATE game_saves SET pending_balance = pending_balance + v_listing.current_bid
        WHERE user_id = v_listing.seller_id;
      IF v_listing.item_type = 'username' THEN
        UPDATE player_usernames SET user_id = v_listing.current_bidder_id, is_active = false
          WHERE id = (v_listing.item_data->>'username_id')::uuid;
      END IF;
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('finalized', v_count);
END;
$$;

-- Cancel auction with no bids (seller only)
CREATE OR REPLACE FUNCTION public.cancel_auction(p_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_listing market_listings%ROWTYPE;
BEGIN
  SELECT * INTO v_listing FROM market_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND OR v_listing.seller_id <> v_uid THEN RAISE EXCEPTION 'Not your listing'; END IF;
  IF v_listing.status <> 'active' THEN RAISE EXCEPTION 'Not active'; END IF;
  IF v_listing.listing_kind = 'auction' AND v_listing.current_bidder_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot cancel auction with bids';
  END IF;
  UPDATE market_listings SET status = 'cancelled' WHERE id = p_listing_id;
  IF v_listing.item_type = 'username' THEN
    UPDATE player_usernames SET is_active = false WHERE id = (v_listing.item_data->>'username_id')::uuid;
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Offline income claim (max 12h)
CREATE OR REPLACE FUNCTION public.claim_offline_income(p_hourly_income numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_save game_saves%ROWTYPE;
  v_seconds numeric;
  v_max_seconds constant numeric := 12 * 3600;
  v_amount numeric := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_hourly_income IS NULL OR p_hourly_income <= 0 THEN
    UPDATE game_saves SET last_seen_at = now() WHERE user_id = v_uid;
    RETURN jsonb_build_object('amount', 0, 'seconds', 0);
  END IF;
  SELECT * INTO v_save FROM game_saves WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('amount', 0, 'seconds', 0); END IF;
  v_seconds := EXTRACT(EPOCH FROM (now() - v_save.last_seen_at));
  -- Only count if absent at least 60 seconds (avoid grinding small amounts on quick reloads)
  IF v_seconds < 60 THEN
    UPDATE game_saves SET last_seen_at = now() WHERE user_id = v_uid;
    RETURN jsonb_build_object('amount', 0, 'seconds', v_seconds);
  END IF;
  v_seconds := LEAST(v_seconds, v_max_seconds);
  v_amount := (p_hourly_income / 3600.0) * v_seconds;
  UPDATE game_saves SET pending_balance = pending_balance + v_amount, last_seen_at = now() WHERE user_id = v_uid;
  RETURN jsonb_build_object('amount', v_amount, 'seconds', v_seconds);
END;
$$;

-- Heartbeat for last_seen_at (called periodically when online)
CREATE OR REPLACE FUNCTION public.heartbeat_presence()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE game_saves SET last_seen_at = now() WHERE user_id = auth.uid();
END;
$$;
