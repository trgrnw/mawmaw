import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGame, formatMoney } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import GameIcon from '@/components/GameIcon';

interface CoinFlipRound {
  id: string;
  status: 'waiting' | 'flipping' | 'done';
  started_at: string;
  result?: string;
}

interface CoinBet {
  id: string;
  user_id: string;
  username: string;
  bet_amount: number;
  choice: string;
  result: string;
  profit: number;
}

const CoinFlipGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { balance, spendBalance, addBalance } = useGame();
  const { user, username } = useAuth();
  const { t } = useI18n();

  const [round, setRound] = useState<CoinFlipRound | null>(null);
  const [bets, setBets] = useState<CoinBet[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [betAmount, setBetAmount] = useState(1000);
  const [choice, setChoice] = useState<'heads' | 'tails'>('heads');
  const [myBetPlaced, setMyBetPlaced] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [myBetResult, setMyBetResult] = useState<'won' | 'lost' | null>(null);

  // Track which round IDs we already processed winnings for
  const winProcessedRef = useRef<Set<string>>(new Set());
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const callCasino = useCallback(async (action: string, params: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke('casino', { body: { action, ...params } });
    if (error) console.error('Casino error:', error);
    return data;
  }, []);

  // Poll for round state
  useEffect(() => {
    if (!user) return;
    let active = true;
    const poll = async () => {
      const data = await callCasino('get_coinflip_round');
      if (!active || !data) return;

      // Handle completed round result (server sends it separately)
      if (data.completed_round && data.completed_round.result) {
        const cr = data.completed_round;
        if (!winProcessedRef.current.has(cr.id)) {
          winProcessedRef.current.add(cr.id);
          setLastResult(cr.result);
          setShowResult(true);

          // Check my bet in the completed bets
          const myBet = (data.completed_bets || []).find((b: CoinBet) => b.user_id === user.id);
          if (myBet) {
            const won = myBet.result === 'won';
            setMyBetResult(won ? 'won' : 'lost');
            if (won) {
              addBalance(myBet.bet_amount + myBet.profit);
            }
          }

          // Clear result after 4s
          if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
          resultTimeoutRef.current = setTimeout(() => {
            setShowResult(false);
            setMyBetPlaced(false);
            setMyBetResult(null);
            setLastResult(null);
          }, 4000);
        }
      }

      // Current round (the new waiting round)
      if (data.round) {
        setRound(data.round);
        if (data.round.status === 'waiting' && !showResult) {
          const myBet = (data.bets || []).find((b: CoinBet) => b.user_id === user.id);
          setMyBetPlaced(!!myBet);
        }
      }
      setBets(data.bets || []);
      setHistory(data.history || []);
    };
    poll();
    const interval = setInterval(poll, 1000);
    return () => { active = false; clearInterval(interval); };
  }, [user, callCasino, addBalance, showResult]);

  // Countdown
  useEffect(() => {
    if (!round || round.status !== 'waiting') { setCountdown(0); return; }
    const update = () => {
      const diff = (new Date(round.started_at).getTime() - Date.now()) / 1000;
      setCountdown(Math.max(0, Math.ceil(diff)));
    };
    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [round]);

  const placeBet = async () => {
    if (!round || round.status !== 'waiting' || betAmount < 100 || !spendBalance(betAmount)) return;
    setLoading(true);
    const data = await callCasino('place_coinflip_bet', {
      round_id: round.id, bet_amount: betAmount, choice, username: username || 'Player',
    });
    if (data?.error) {
      addBalance(betAmount);
    } else {
      setMyBetPlaced(true);
    }
    setLoading(false);
  };

  if (!user) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">← {t('casino.back')}</button>
        <div className="text-center py-20 text-muted-foreground">{t('casino.login_required')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">← {t('casino.back')}</button>

      {/* History bar */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {history.map((r, i) => (
          <span key={i} className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold ${
            r === 'heads' ? 'bg-amber-500/20 text-amber-600' : 'bg-sky-500/20 text-sky-600'
          }`}>
            {r === 'heads' ? <GameIcon name="heads" size={16} /> : <GameIcon name="tails" size={16} />}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Players */}
        <div className="lg:col-span-1 rounded-xl border border-border bg-card p-4 max-h-[500px] overflow-y-auto">
          <h3 className="text-sm font-semibold text-foreground mb-3">{t('casino.players')}</h3>
          <div className="space-y-2">
            {bets.map(bet => (
              <div key={bet.id} className={`flex items-center justify-between text-xs p-2 rounded-lg ${
                bet.result === 'won' ? 'bg-success/10' : bet.result === 'lost' ? 'bg-destructive/10' : 'bg-muted/50'
              }`}>
                <div>
                  <div className="font-medium text-foreground">{bet.username}</div>
                  <div className="text-muted-foreground">${formatMoney(bet.bet_amount)} — {bet.choice === 'heads' ? <GameIcon name="heads" size={14} className="inline" /> : <GameIcon name="tails" size={14} className="inline" />}</div>
                </div>
                {bet.result === 'won' && <span className="font-mono font-bold text-success">+${formatMoney(bet.profit)}</span>}
                {bet.result === 'lost' && <span className="font-mono font-bold text-destructive">-${formatMoney(bet.bet_amount)}</span>}
                {bet.result === 'pending' && <span className="text-muted-foreground">...</span>}
              </div>
            ))}
            {bets.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">{t('casino.no_bets')}</p>}
          </div>
        </div>

        {/* Coin */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card flex flex-col items-center justify-center min-h-[400px]">
          {showResult && lastResult && (
            <div className="text-center">
              <div className="mb-4">{lastResult === 'heads' ? <GameIcon name="heads" size={80} color="hsl(45 93% 47%)" /> : <GameIcon name="tails" size={80} color="hsl(var(--sky-400))" />}</div>
              <div className="text-2xl font-bold text-foreground mb-2">
                {lastResult === 'heads' ? t('casino.heads') : t('casino.tails')}
              </div>
              {myBetResult && (
                <div className={`text-xl font-bold ${myBetResult === 'won' ? 'text-success' : 'text-destructive'}`}>
                  {myBetResult === 'won' ? t('casino.you_won') + '!' : t('casino.you_lost')}
                </div>
              )}
            </div>
          )}
          {!showResult && round?.status === 'waiting' && (
            <div className="text-center">
              <div className="mb-4"><GameIcon name="coinflip" size={80} color="hsl(45 93% 47%)" /></div>
              <div className="text-4xl font-mono font-bold text-foreground">{countdown}s</div>
              <p className="text-sm text-muted-foreground mt-2">{t('casino.waiting')}</p>
            </div>
          )}
          {!showResult && !round && (
            <div className="text-muted-foreground">{t('casino.loading')}</div>
          )}
        </div>

        {/* Controls */}
        <div className="lg:col-span-1 rounded-xl border border-border bg-card p-4 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">{t('casino.choose_side')}</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => setChoice('heads')}
                className={`py-4 rounded-xl flex flex-col items-center justify-center text-2xl transition-all border-2 ${
                  choice === 'heads'
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-border bg-card hover:border-amber-500/50'
                }`}
              >
                <GameIcon name="heads" size={28} color="hsl(45 93% 47%)" />
                <div className="text-xs mt-1 text-foreground">{t('casino.heads')}</div>
              </button>
              <button
                onClick={() => setChoice('tails')}
                className={`py-4 rounded-xl flex flex-col items-center justify-center text-2xl transition-all border-2 ${
                  choice === 'tails'
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-border bg-card hover:border-sky-500/50'
                }`}
              >
                <GameIcon name="tails" size={28} color="hsl(var(--sky-400))" />
                <div className="text-xs mt-1 text-foreground">{t('casino.tails')}</div>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">{t('casino.bet_amount')}</label>
            <Input
              type="number"
              value={betAmount}
              onChange={e => setBetAmount(Number(e.target.value))}
              min={100}
              max={1000000}
              className="font-mono mt-1"
            />
            <div className="flex gap-1 mt-2">
              {[100, 1000, 5000, 10000].map(v => (
                <button key={v} onClick={() => setBetAmount(v)} className="flex-1 text-xs py-1 rounded bg-muted hover:bg-muted/80 text-foreground font-mono">
                  {v >= 1000 ? `${v/1000}K` : v}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            {t('casino.your_balance')}: <span className="font-mono text-foreground">${formatMoney(balance)}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {t('casino.win_mult')}: <span className="font-mono text-success">x1.94</span>
          </div>

          {round?.status === 'waiting' && !myBetPlaced && !showResult && (
            <Button onClick={placeBet} disabled={loading || betAmount < 100 || betAmount > balance} className="w-full" size="lg">
              {t('casino.play')} — ${formatMoney(betAmount)}
            </Button>
          )}
          {round?.status === 'waiting' && myBetPlaced && (
            <Button disabled className="w-full" size="lg" variant="secondary">
              {t('casino.bet_placed')} ✓
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoinFlipGame;
