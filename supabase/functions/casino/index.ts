import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GROWTH_RATE = 0.06;

function generateCrashPoint(): number {
  const r = Math.random();
  // House edge ~4%. Steeper curve: most rounds crash 1.0-3.0x
  // ~60% crash below 2x, ~85% below 5x, ~97% below 20x, ~99.5% below 50x
  const houseEdge = 0.04;
  if (r < houseEdge) {
    // Instant crash (house wins)
    return 1.0;
  }
  // Use a power function for steeper falloff
  const adjusted = (r - houseEdge) / (1 - houseEdge); // 0..1
  const crash = 1 / (1 - adjusted);
  // Apply a sqrt to compress high values, making big multipliers much rarer
  const compressed = Math.pow(crash, 0.7);
  return Math.max(1.0, Math.min(100.0, Math.floor(compressed * 100) / 100));
}

function getMultiplierAtTime(startedAt: Date, now: Date): number {
  const elapsed = (now.getTime() - startedAt.getTime()) / 1000;
  if (elapsed <= 0) return 1.0;
  return Math.exp(GROWTH_RATE * elapsed);
}

function getCrashTime(startedAt: Date, crashPoint: number): Date {
  const seconds = Math.log(crashPoint) / GROWTH_RATE;
  return new Date(startedAt.getTime() + seconds * 1000);
}

function calculateMinesMultiplier(bombCount: number, revealed: number): number {
  if (revealed === 0) return 1.0;
  const total = 25;
  const safe = total - bombCount;
  let mult = 1;
  for (let i = 0; i < revealed; i++) {
    mult *= (total - i) / (safe - i);
  }
  return Math.floor(mult * 0.97 * 100) / 100;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No auth header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { action } = body;
    let result: unknown = null;

    switch (action) {
      // ═══════════════════════════════════════════
      // ROCKET
      // ═══════════════════════════════════════════
      case 'get_rocket_round': {
        const { data: rounds } = await supabaseAdmin
          .from('casino_rocket_rounds')
          .select('*')
          .in('status', ['waiting', 'flying'])
          .order('created_at', { ascending: false })
          .limit(1);

        let round = rounds?.[0];
        const now = new Date();

        if (round) {
          const startedAt = new Date(round.started_at);
          const crashAt = getCrashTime(startedAt, round.crash_point);

          if (round.status === 'waiting' && now >= startedAt) {
            await supabaseAdmin
              .from('casino_rocket_rounds')
              .update({ status: 'flying' })
              .eq('id', round.id);
            round.status = 'flying';
          }

          if (round.status === 'flying') {
            // Process auto-cashouts
            const currentMult = getMultiplierAtTime(startedAt, now < crashAt ? now : crashAt);
            const { data: autoBets } = await supabaseAdmin
              .from('casino_bets')
              .select('*')
              .eq('round_id', round.id)
              .eq('result', 'pending')
              .not('auto_cashout', 'is', null);

            for (const bet of (autoBets || [])) {
              if (bet.auto_cashout && currentMult >= bet.auto_cashout) {
                const cashMult = Math.min(bet.auto_cashout, round.crash_point);
                if (cashMult <= round.crash_point) {
                  const profit = bet.bet_amount * cashMult - bet.bet_amount;
                  await supabaseAdmin
                    .from('casino_bets')
                    .update({ result: 'won', cashout_multiplier: cashMult, profit })
                    .eq('id', bet.id);
                }
              }
            }

            if (now >= crashAt) {
              await supabaseAdmin
                .from('casino_rocket_rounds')
                .update({ status: 'crashed' })
                .eq('id', round.id);
              await supabaseAdmin
                .from('casino_bets')
                .update({ result: 'lost' })
                .eq('round_id', round.id)
                .eq('result', 'pending');
              round.status = 'crashed';
            }
          }
        }

        // Create new round if needed (with 3s cooldown after crash)
        if (!round || round.status === 'crashed') {
          let shouldCreate = true;
          if (round?.status === 'crashed') {
            const crashAt = getCrashTime(new Date(round.started_at), round.crash_point);
            const sinceCrash = (Date.now() - crashAt.getTime()) / 1000;
            if (sinceCrash < 3) shouldCreate = false;
          }
          if (shouldCreate) {
            const crashPoint = generateCrashPoint();
            const startedAt = new Date(Date.now() + 10000);
            const { data: newRound } = await supabaseAdmin
              .from('casino_rocket_rounds')
              .insert({ crash_point: crashPoint, status: 'waiting', started_at: startedAt.toISOString() })
              .select()
              .single();
            round = newRound;
          }
        }

        const { data: bets } = await supabaseAdmin
          .from('casino_bets')
          .select('*')
          .eq('round_id', round?.id)
          .eq('game_type', 'rocket');

        const { data: history } = await supabaseAdmin
          .from('casino_rocket_rounds')
          .select('crash_point')
          .eq('status', 'crashed')
          .order('created_at', { ascending: false })
          .limit(20);

        const startedAt = round ? new Date(round.started_at) : new Date();
        const now2 = new Date();
        const currentMultiplier = round?.status === 'flying'
          ? Math.floor(getMultiplierAtTime(startedAt, now2) * 100) / 100
          : round?.status === 'crashed' ? round.crash_point : 1.0;

        result = {
          round: round ? {
            id: round.id,
            status: round.status,
            started_at: round.started_at,
            crash_point: round.status === 'crashed' ? round.crash_point : undefined,
            current_multiplier: currentMultiplier,
          } : null,
          bets: bets || [],
          history: (history || []).map((h: { crash_point: number }) => h.crash_point),
        };
        break;
      }

      case 'place_rocket_bet': {
        const { round_id, bet_amount, auto_cashout, username } = body;
        if (!round_id || !bet_amount || bet_amount < 100 || bet_amount > 1000000) {
          result = { error: 'Invalid bet' }; break;
        }
        const { data: round } = await supabaseAdmin
          .from('casino_rocket_rounds')
          .select('status')
          .eq('id', round_id)
          .single();
        if (!round || round.status !== 'waiting') {
          result = { error: 'Round not accepting bets' }; break;
        }
        const { data: existing } = await supabaseAdmin
          .from('casino_bets')
          .select('id')
          .eq('round_id', round_id)
          .eq('user_id', user.id)
          .limit(1);
        if (existing && existing.length > 0) {
          result = { error: 'Already placed bet' }; break;
        }
        const { data: bet } = await supabaseAdmin
          .from('casino_bets')
          .insert({
            user_id: user.id,
            username: username || 'Player',
            game_type: 'rocket',
            round_id,
            bet_amount,
            auto_cashout: auto_cashout || null,
            result: 'pending',
          })
          .select()
          .single();
        result = { bet };
        break;
      }

      case 'cashout_rocket': {
        const { round_id } = body;
        const { data: round } = await supabaseAdmin
          .from('casino_rocket_rounds')
          .select('*')
          .eq('id', round_id)
          .single();
        if (!round || round.status !== 'flying') {
          result = { error: 'Round not flying' }; break;
        }
        const now = new Date();
        const crashAt = getCrashTime(new Date(round.started_at), round.crash_point);
        if (now >= crashAt) {
          await supabaseAdmin.from('casino_rocket_rounds').update({ status: 'crashed' }).eq('id', round_id);
          await supabaseAdmin.from('casino_bets').update({ result: 'lost' }).eq('round_id', round_id).eq('result', 'pending');
          result = { error: 'Already crashed', crashed: true };
          break;
        }
        const multiplier = Math.floor(getMultiplierAtTime(new Date(round.started_at), now) * 100) / 100;
        const { data: bet } = await supabaseAdmin
          .from('casino_bets')
          .select('*')
          .eq('round_id', round_id)
          .eq('user_id', user.id)
          .eq('result', 'pending')
          .single();
        if (!bet) { result = { error: 'No pending bet' }; break; }
        const profit = bet.bet_amount * multiplier - bet.bet_amount;
        await supabaseAdmin
          .from('casino_bets')
          .update({ result: 'won', cashout_multiplier: multiplier, profit })
          .eq('id', bet.id);
        result = { success: true, multiplier, win_amount: bet.bet_amount * multiplier };
        break;
      }

      // ═══════════════════════════════════════════
      // MINES
      // ═══════════════════════════════════════════
      case 'start_mines': {
        const { bomb_count, bet_amount } = body;
        if (!bomb_count || bomb_count < 2 || bomb_count > 24) { result = { error: 'Invalid bomb count' }; break; }
        if (!bet_amount || bet_amount < 100 || bet_amount > 1000000) { result = { error: 'Invalid bet' }; break; }
        const positions: number[] = [];
        while (positions.length < bomb_count) {
          const pos = Math.floor(Math.random() * 25);
          if (!positions.includes(pos)) positions.push(pos);
        }
        const { data: game } = await supabaseAdmin
          .from('casino_mines_games')
          .insert({
            user_id: user.id, bomb_positions: positions, bomb_count, bet_amount,
            revealed_positions: [], current_multiplier: 1.0, status: 'active',
          })
          .select('id, bomb_count, bet_amount, current_multiplier, status, revealed_positions')
          .single();
        result = { game };
        break;
      }

      case 'reveal_mine': {
        const { game_id, position } = body;
        const { data: game } = await supabaseAdmin
          .from('casino_mines_games')
          .select('*')
          .eq('id', game_id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();
        if (!game) { result = { error: 'Game not found' }; break; }
        if (game.revealed_positions.includes(position)) { result = { error: 'Already revealed' }; break; }
        const isBomb = game.bomb_positions.includes(position);
        const newRevealed = [...game.revealed_positions, position];
        if (isBomb) {
          await supabaseAdmin.from('casino_mines_games')
            .update({ revealed_positions: newRevealed, status: 'lost' })
            .eq('id', game_id);
          await supabaseAdmin.from('casino_bets').insert({
            user_id: user.id, username: body.username || 'Player',
            game_type: 'mines', bet_amount: game.bet_amount,
            cashout_multiplier: 0, profit: -game.bet_amount,
            result: 'lost', bomb_count: game.bomb_count,
          });
          result = { is_bomb: true, bomb_positions: game.bomb_positions, game_over: true };
        } else {
          const safeRevealed = newRevealed.filter((p: number) => !game.bomb_positions.includes(p)).length;
          const newMultiplier = calculateMinesMultiplier(game.bomb_count, safeRevealed);
          const totalSafe = 25 - game.bomb_count;
          const allRevealed = safeRevealed >= totalSafe;
          await supabaseAdmin.from('casino_mines_games')
            .update({ revealed_positions: newRevealed, current_multiplier: newMultiplier, ...(allRevealed ? { status: 'won' } : {}) })
            .eq('id', game_id);
          if (allRevealed) {
            const profit = game.bet_amount * newMultiplier - game.bet_amount;
            await supabaseAdmin.from('casino_bets').insert({
              user_id: user.id, username: body.username || 'Player',
              game_type: 'mines', bet_amount: game.bet_amount,
              cashout_multiplier: newMultiplier, profit, result: 'won', bomb_count: game.bomb_count,
            });
          }
          result = { is_bomb: false, multiplier: newMultiplier, game_over: allRevealed, bomb_positions: allRevealed ? game.bomb_positions : undefined };
        }
        break;
      }

      case 'cashout_mines': {
        const { game_id } = body;
        const { data: game } = await supabaseAdmin
          .from('casino_mines_games')
          .select('*')
          .eq('id', game_id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();
        if (!game) { result = { error: 'Game not found' }; break; }
        const safeRevealed = game.revealed_positions.filter((p: number) => !game.bomb_positions.includes(p)).length;
        if (safeRevealed === 0) { result = { error: 'Reveal at least one cell' }; break; }
        const multiplier = game.current_multiplier;
        const winAmount = game.bet_amount * multiplier;
        const profit = winAmount - game.bet_amount;
        await supabaseAdmin.from('casino_mines_games').update({ status: 'won' }).eq('id', game_id);
        await supabaseAdmin.from('casino_bets').insert({
          user_id: user.id, username: body.username || 'Player',
          game_type: 'mines', bet_amount: game.bet_amount,
          cashout_multiplier: multiplier, profit, result: 'won', bomb_count: game.bomb_count,
        });
        result = { success: true, multiplier, win_amount: winAmount, bomb_positions: game.bomb_positions };
        break;
      }

      case 'get_mines_history': {
        const { data: bets } = await supabaseAdmin
          .from('casino_bets')
          .select('*')
          .eq('game_type', 'mines')
          .order('created_at', { ascending: false })
          .limit(20);
        result = { bets: bets || [] };
        break;
      }

      // ═══════════════════════════════════════════
      // COIN FLIP
      // ═══════════════════════════════════════════
      case 'get_coinflip_round': {
        const { data: rounds } = await supabaseAdmin
          .from('casino_coinflip_rounds')
          .select('*')
          .in('status', ['waiting', 'flipping'])
          .order('created_at', { ascending: false })
          .limit(1);
        let round = rounds?.[0];
        const now = new Date();
        if (round) {
          const startedAt = new Date(round.started_at);
          if (round.status === 'waiting' && now >= startedAt) {
            const coinResult = Math.random() < 0.5 ? 'heads' : 'tails';
            await supabaseAdmin.from('casino_coinflip_rounds')
              .update({ status: 'done', result: coinResult })
              .eq('id', round.id);
            const { data: bets } = await supabaseAdmin
              .from('casino_bets')
              .select('*')
              .eq('round_id', round.id)
              .eq('result', 'pending');
            for (const bet of (bets || [])) {
              const won = bet.choice === coinResult;
              const profit = won ? bet.bet_amount * 0.94 : -bet.bet_amount;
              await supabaseAdmin.from('casino_bets')
                .update({ result: won ? 'won' : 'lost', cashout_multiplier: won ? 1.94 : 0, profit })
                .eq('id', bet.id);
            }
            round.status = 'done';
            round.result = coinResult;
          }
        }
        // Save completed round info before creating new one
        let completedRound: { id: string; result: string } | null = null;
        let completedBets: unknown[] = [];
        if (round && round.status === 'done') {
          completedRound = { id: round.id, result: round.result };
          const { data: cBets } = await supabaseAdmin
            .from('casino_bets')
            .select('*')
            .eq('round_id', round.id)
            .eq('game_type', 'coinflip');
          completedBets = cBets || [];
        }

        if (!round || round.status === 'done') {
          const startedAt = new Date(Date.now() + 10000);
          const { data: newRound } = await supabaseAdmin
            .from('casino_coinflip_rounds')
            .insert({ status: 'waiting', started_at: startedAt.toISOString() })
            .select()
            .single();
          round = newRound;
        }
        const { data: bets } = await supabaseAdmin
          .from('casino_bets')
          .select('*')
          .eq('round_id', round?.id)
          .eq('game_type', 'coinflip');
        const { data: history } = await supabaseAdmin
          .from('casino_coinflip_rounds')
          .select('result')
          .eq('status', 'done')
          .order('created_at', { ascending: false })
          .limit(20);
        result = {
          round: round ? {
            id: round.id, status: round.status, started_at: round.started_at,
            result: round.status === 'done' ? round.result : undefined,
          } : null,
          bets: bets || [],
          history: (history || []).map((h: { result: string }) => h.result),
          completed_round: completedRound,
          completed_bets: completedBets,
        };
        break;
      }

      case 'place_coinflip_bet': {
        const { round_id, bet_amount, choice, username } = body;
        if (!round_id || !bet_amount || bet_amount < 100 || bet_amount > 1000000) { result = { error: 'Invalid bet' }; break; }
        if (!choice || !['heads', 'tails'].includes(choice)) { result = { error: 'Invalid choice' }; break; }
        const { data: round } = await supabaseAdmin
          .from('casino_coinflip_rounds')
          .select('status')
          .eq('id', round_id)
          .single();
        if (!round || round.status !== 'waiting') { result = { error: 'Round not accepting bets' }; break; }
        const { data: existing } = await supabaseAdmin
          .from('casino_bets')
          .select('id')
          .eq('round_id', round_id)
          .eq('user_id', user.id)
          .limit(1);
        if (existing && existing.length > 0) { result = { error: 'Already placed bet' }; break; }
        const { data: bet } = await supabaseAdmin
          .from('casino_bets')
          .insert({
            user_id: user.id, username: username || 'Player',
            game_type: 'coinflip', round_id, bet_amount, choice, result: 'pending',
          })
          .select()
          .single();
        result = { bet };
        break;
      }

      default:
        result = { error: 'Unknown action' };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
