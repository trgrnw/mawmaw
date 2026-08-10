
-- Casino Rocket Rounds
CREATE TABLE casino_rocket_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crash_point numeric NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  started_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE casino_rocket_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view rocket rounds" ON casino_rocket_rounds FOR SELECT TO authenticated USING (true);

-- Casino Bets
CREATE TABLE casino_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL DEFAULT 'Player',
  game_type text NOT NULL,
  round_id uuid,
  bet_amount numeric NOT NULL,
  auto_cashout numeric,
  cashout_multiplier numeric,
  profit numeric DEFAULT 0,
  result text NOT NULL DEFAULT 'pending',
  choice text,
  bomb_count integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE casino_bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view bets" ON casino_bets FOR SELECT TO authenticated USING (true);

-- Casino Mines Games
CREATE TABLE casino_mines_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bomb_positions integer[] NOT NULL,
  bomb_count integer NOT NULL,
  revealed_positions integer[] NOT NULL DEFAULT '{}',
  bet_amount numeric NOT NULL,
  current_multiplier numeric NOT NULL DEFAULT 1.0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE casino_mines_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own mines" ON casino_mines_games FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Coinflip Rounds
CREATE TABLE casino_coinflip_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result text,
  status text NOT NULL DEFAULT 'waiting',
  started_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE casino_coinflip_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view coinflip rounds" ON casino_coinflip_rounds FOR SELECT TO authenticated USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE casino_rocket_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE casino_bets;
ALTER PUBLICATION supabase_realtime ADD TABLE casino_coinflip_rounds;
