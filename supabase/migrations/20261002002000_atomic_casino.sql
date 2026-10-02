-- Public clients may not inspect unrevealed bombs or future crash points.
REVOKE ALL ON casino_rocket_rounds,casino_coinflip_rounds,casino_mines_games,casino_bets FROM anon,authenticated;
ALTER PUBLICATION supabase_realtime DROP TABLE casino_rocket_rounds;
ALTER PUBLICATION supabase_realtime DROP TABLE casino_coinflip_rounds;
ALTER PUBLICATION supabase_realtime DROP TABLE casino_bets;
-- Legacy stakes were never debited on the server. Do not pay them as verified bets.
UPDATE casino_bets SET result='lost',profit=-bet_amount WHERE result='pending';
UPDATE casino_mines_games SET status='lost' WHERE status='active';
UPDATE casino_rocket_rounds SET status='crashed' WHERE status IN('waiting','flying');
UPDATE casino_coinflip_rounds SET status='done',result=COALESCE(result,'heads') WHERE status IN('waiting','flipping');
CREATE TABLE casino_requests(user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,request_id uuid NOT NULL,response jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,request_id));
ALTER TABLE casino_requests ENABLE ROW LEVEL SECURITY;

-- Use cryptographic bytes instead of a client or predictable PRNG for outcomes.
CREATE OR REPLACE FUNCTION casino_random() RETURNS double precision LANGUAGE sql VOLATILE SET search_path=public,extensions AS $$
 SELECT ('x'||encode(gen_random_bytes(4),'hex'))::bit(32)::bigint::double precision/4294967296.0;
$$;
REVOKE ALL ON FUNCTION casino_random() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION settle_casino() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r casino_rocket_rounds%ROWTYPE;c casino_coinflip_rounds%ROWTYPE;b casino_bets%ROWTYPE;t timestamptz:=clock_timestamp();m numeric;crash_at timestamptz;v_result text;BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('casino-economy'));
 FOR r IN SELECT * FROM casino_rocket_rounds WHERE status IN('waiting','flying') ORDER BY id FOR UPDATE LOOP
  IF t<r.started_at THEN CONTINUE; END IF;
  crash_at:=r.started_at+ln(r.crash_point::double precision)/.06*interval '1 second';
  m:=exp(.06*GREATEST(0,EXTRACT(epoch FROM LEAST(t,crash_at)-r.started_at)));
  FOR b IN SELECT * FROM casino_bets WHERE round_id=r.id AND game_type='rocket' AND result='pending' AND auto_cashout IS NOT NULL AND auto_cashout<r.crash_point AND auto_cashout<=m ORDER BY id FOR UPDATE LOOP
   UPDATE casino_bets SET result='won',cashout_multiplier=b.auto_cashout,profit=b.bet_amount*(b.auto_cashout-1) WHERE id=b.id;
   UPDATE game_saves SET pending_balance=pending_balance+b.bet_amount*b.auto_cashout WHERE user_id=b.user_id;
  END LOOP;
  IF t>=crash_at THEN
   UPDATE casino_rocket_rounds SET status='crashed' WHERE id=r.id;
   UPDATE casino_bets SET result='lost',profit=-bet_amount WHERE round_id=r.id AND game_type='rocket' AND result='pending';
  ELSE UPDATE casino_rocket_rounds SET status='flying' WHERE id=r.id; END IF;
 END LOOP;
 FOR c IN SELECT * FROM casino_coinflip_rounds WHERE status IN('waiting','flipping') AND started_at<=t ORDER BY id FOR UPDATE LOOP
  v_result:=CASE WHEN casino_random()<.5 THEN 'heads' ELSE 'tails' END;
  UPDATE casino_coinflip_rounds SET status='done',result=v_result WHERE id=c.id;
  FOR b IN SELECT * FROM casino_bets WHERE round_id=c.id AND game_type='coinflip' AND result='pending' ORDER BY id FOR UPDATE LOOP
   UPDATE casino_bets SET result=CASE WHEN b.choice=v_result THEN 'won' ELSE 'lost' END,cashout_multiplier=CASE WHEN b.choice=v_result THEN 1.94 ELSE 0 END,profit=CASE WHEN b.choice=v_result THEN b.bet_amount*.94 ELSE -b.bet_amount END WHERE id=b.id;
   IF b.choice=v_result THEN UPDATE game_saves SET pending_balance=pending_balance+b.bet_amount*1.94 WHERE user_id=b.user_id; END IF;
  END LOOP;
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION settle_casino() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION settle_casino() TO service_role;

CREATE OR REPLACE FUNCTION casino_action(p_uid uuid,p_action text,p_body jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r casino_rocket_rounds%ROWTYPE;c casino_coinflip_rounds%ROWTYPE;g casino_mines_games%ROWTYPE;b casino_bets%ROWTYPE;
 v_request uuid;v_response jsonb;v_round uuid;v_bet numeric;v_auto numeric;v_choice text;v_name text;v_bombs int;v_pos int;v_positions int[];v_revealed int[];v_safe int;v_mult numeric;v_win numeric;v_crash numeric;v_r double precision;t timestamptz:=clock_timestamp();v_latest casino_coinflip_rounds%ROWTYPE;
BEGIN
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
REVOKE ALL ON FUNCTION casino_action(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION casino_action(uuid,text,jsonb) TO service_role;

-- Settlement runs when any player reconnects, plus scheduled jobs when available.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
  PERFORM cron.schedule('financial-clicker-casino-settlement','* * * * *','SELECT public.settle_casino();');
  PERFORM cron.schedule('financial-clicker-auction-settlement','* * * * *','SELECT public.finalize_expired_auctions();');
 END IF;
END $$;
