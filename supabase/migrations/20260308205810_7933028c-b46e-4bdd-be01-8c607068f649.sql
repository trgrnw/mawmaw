
CREATE TABLE public.market_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('username', 'license_plate')),
  item_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  price numeric NOT NULL CHECK (price > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
  buyer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  sold_at timestamptz
);

ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;

-- Anyone can view active listings
CREATE POLICY "Anyone can view active listings"
  ON public.market_listings FOR SELECT
  USING (status = 'active' OR seller_id = auth.uid() OR buyer_id = auth.uid());

-- Authenticated users can create listings
CREATE POLICY "Users can create own listings"
  ON public.market_listings FOR INSERT
  TO authenticated
  WITH CHECK (seller_id = auth.uid());

-- Sellers can update own active listings (cancel)
CREATE POLICY "Users can update own listings"
  ON public.market_listings FOR UPDATE
  TO authenticated
  USING (seller_id = auth.uid() OR status = 'active');

-- Sellers can delete own listings
CREATE POLICY "Users can delete own listings"
  ON public.market_listings FOR DELETE
  TO authenticated
  USING (seller_id = auth.uid() AND status != 'sold');
