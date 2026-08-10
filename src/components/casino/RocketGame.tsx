import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGame, formatMoney } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import GameIcon from '@/components/GameIcon';

interface RocketRound {
  id: string;
  status: 'waiting' | 'flying' | 'crashed';
  started_at: string;
  crash_point?: number;
  current_multiplier: number;
}

interface RocketBet {
  id: string;
  user_id: string;
  username: string;
  bet_amount: number;
  auto_cashout: number | null;
  cashout_multiplier: number | null;
  result: string;
}

function getMultiplierColor(x: number): string {
  if (x < 2) return 'hsl(210 10% 55%)';
  if (x < 5) return 'hsl(217 91% 60%)';
  if (x < 10) return 'hsl(271 81% 56%)';
  if (x < 50) return 'hsl(25 95% 53%)';
  return 'hsl(45 93% 47%)';
}

const SpaceBackground: React.FC<{ progress: number; status: string }> = ({ progress, status }) => {
  const starsRef = useRef<{ x: number; y: number; size: number; opacity: number }[]>([]);
  if (starsRef.current.length === 0) {
    starsRef.current = Array.from({ length: 100 }, () => ({
      x: Math.random() * 100, y: Math.random() * 200 - 50,
      size: Math.random() * 2 + 0.5, opacity: Math.random() * 0.7 + 0.3,
    }));
  }
  const bgColor = status === 'crashed'
    ? 'radial-gradient(ellipse at 50% 100%, hsl(0 40% 15%) 0%, hsl(220 30% 8%) 60%, hsl(230 25% 4%) 100%)'
    : `radial-gradient(ellipse at 50% ${100 - progress * 30}%, hsl(220 60% ${12 + progress * 3}%) 0%, hsl(230 40% ${6 + progress}%) 50%, hsl(240 30% 4%) 100%)`;
  const scrollY = progress * 300;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: bgColor }}>
      {starsRef.current.map((star, i) => (
        <div key={i} className="absolute rounded-full bg-white" style={{
          left: `${star.x}%`, top: `${((star.y + scrollY) % 200) - 50}%`,
          width: `${star.size}px`, height: `${star.size}px`,
          opacity: star.opacity * (status === 'flying' ? 1 : 0.6),
        }} />
      ))}
      <div className="absolute rounded-full" style={{
        width: '60px', height: '60px', right: '15%', top: `${12 + scrollY * 0.4}%`,
        background: 'radial-gradient(circle at 35% 35%, hsl(45 20% 90%), hsl(45 10% 70%))',
        boxShadow: '0 0 20px hsl(45 20% 80% / 0.3), inset -8px -4px 12px hsl(45 10% 55% / 0.4)',
        opacity: status === 'crashed' ? 0.4 : 0.8,
      }}>
        <div className="absolute rounded-full" style={{ width: 10, height: 10, top: '25%', left: '45%', background: 'hsl(45 8% 62% / 0.5)' }} />
        <div className="absolute rounded-full" style={{ width: 6, height: 6, top: '55%', left: '25%', background: 'hsl(45 8% 62% / 0.4)' }} />
      </div>
      <div className="absolute rounded-full" style={{
        width: '24px', height: '24px', left: '10%', top: `${20 + scrollY * 0.25}%`,
        background: 'radial-gradient(circle at 40% 40%, hsl(197 60% 60%), hsl(220 50% 35%))', opacity: 0.5,
      }} />
    </div>
  );
};

const RocketGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { balance, spendBalance, addBalance } = useGame();
  const { user, username } = useAuth();
  const { t } = useI18n();

  const [round, setRound] = useState<RocketRound | null>(null);
  const [bets, setBets] = useState<RocketBet[]>([]);
  const [history, setHistory] = useState<number[]>([]);
  const [betAmount, setBetAmount] = useState(1000);
  const [autoCashout, setAutoCashout] = useState<string>('2.0');
  const [autoCashoutEnabled, setAutoCashoutEnabled] = useState(true);
  const [myBetPlaced, setMyBetPlaced] = useState(false);
  const [myCashedOut, setMyCashedOut] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);

  // === NEW: Pure server-synced multiplier system ===
  // We store the last two server multiplier readings and interpolate between them
  const [displayMultiplier, setDisplayMultiplier] = useState(1.0);
  const serverMultRef = useRef({ value: 1.0, time: Date.now() });
  const prevServerMultRef = useRef({ value: 1.0, time: Date.now() });
  const animRef = useRef<number>();
  const roundStatusRef = useRef<string>('');

  const callCasino = useCallback(async (action: string, params: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke('casino', { body: { action, ...params } });
    if (error) console.error('Casino error:', error);
    return data;
  }, []);

  // Poll — only source of truth for multiplier
  useEffect(() => {
    if (!user) return;
    let active = true;
    const poll = async () => {
      const data = await callCasino('get_rocket_round');
      if (!active || !data) return;
      if (data.round) {
        const sr = data.round;
        setRound(sr);
        roundStatusRef.current = sr.status;

        if (sr.status === 'flying') {
          // Shift: prev = old current, current = new server value
          prevServerMultRef.current = { ...serverMultRef.current };
          serverMultRef.current = { value: sr.current_multiplier, time: Date.now() };
        } else if (sr.status === 'crashed') {
          const cp = sr.crash_point || sr.current_multiplier;
          serverMultRef.current = { value: cp, time: Date.now() };
          setDisplayMultiplier(cp);
        } else if (sr.status === 'waiting') {
          serverMultRef.current = { value: 1.0, time: Date.now() };
          prevServerMultRef.current = { value: 1.0, time: Date.now() };
          setDisplayMultiplier(1.0);
        }
      }
      setBets(data.bets || []);
      setHistory(data.history || []);

      const myBet = (data.bets || []).find((b: RocketBet) => b.user_id === user.id);
      setMyBetPlaced(!!myBet);
      setMyCashedOut(myBet?.result === 'won');
    };
    poll();
    const interval = setInterval(poll, 500); // poll faster for smoother sync
    return () => { active = false; clearInterval(interval); };
  }, [user, callCasino]);

  // Smooth interpolation animation between server polls
  useEffect(() => {
    const animate = () => {
      if (roundStatusRef.current !== 'flying') {
        animRef.current = requestAnimationFrame(animate);
        return;
      }
      const now = Date.now();
      const prev = prevServerMultRef.current;
      const curr = serverMultRef.current;
      const pollInterval = Math.max(curr.time - prev.time, 1); // ms between last two polls
      const elapsed = now - curr.time;
      
      // Extrapolate: assume growth continues at the same rate
      const rate = pollInterval > 0 ? (curr.value - prev.value) / pollInterval : 0;
      const extrapolated = curr.value + rate * elapsed;
      
      // Clamp: never go below 1.0 or below last known server value
      const clamped = Math.max(1.0, Math.max(curr.value, extrapolated));
      setDisplayMultiplier(Math.floor(clamped * 100) / 100);
      
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  // Countdown timer
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

  // Reset on new round
  useEffect(() => {
    if (round?.status === 'waiting') {
      setMyBetPlaced(false);
      setMyCashedOut(false);
    }
  }, [round?.id]);

  const placeBet = async () => {
    if (!round || round.status !== 'waiting' || betAmount < 100 || !spendBalance(betAmount)) return;
    setLoading(true);
    const ac = autoCashoutEnabled && autoCashout ? parseFloat(autoCashout) : undefined;
    const data = await callCasino('place_rocket_bet', {
      round_id: round.id, bet_amount: betAmount,
      auto_cashout: ac && ac >= 1.1 ? ac : undefined,
      username: username || 'Player',
    });
    if (data?.error) addBalance(betAmount);
    else setMyBetPlaced(true);
    setLoading(false);
  };

  const cashout = async () => {
    if (!round || round.status !== 'flying' || myCashedOut) return;
    setLoading(true);
    const data = await callCasino('cashout_rocket', { round_id: round.id });
    if (data?.success) { setMyCashedOut(true); addBalance(data.win_amount); }
    setLoading(false);
  };

  const progress = round?.status === 'flying' ? Math.min(1, (displayMultiplier - 1) / 15) : 0;

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

      <div className="flex gap-2 overflow-x-auto pb-2">
        {history.map((cp, i) => (
          <span key={i} className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-mono font-bold"
            style={{ color: getMultiplierColor(cp), backgroundColor: 'hsl(var(--muted))' }}>
            {cp.toFixed(2)}x
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 rounded-xl border border-border bg-card p-4 max-h-[500px] overflow-y-auto">
          <h3 className="text-sm font-semibold text-foreground mb-3">{t('casino.players')}</h3>
          <div className="space-y-2">
            {bets.map(bet => (
              <div key={bet.id} className={`flex items-center justify-between text-xs p-2 rounded-lg ${
                bet.result === 'won' ? 'bg-success/10' : bet.result === 'lost' ? 'bg-destructive/10' : 'bg-muted/50'
              }`}>
                <div>
                  <div className="font-medium text-foreground">{bet.username}</div>
                  <div className="text-muted-foreground">${formatMoney(bet.bet_amount)}</div>
                </div>
                {bet.result === 'won' && <span className="font-mono font-bold text-success">{bet.cashout_multiplier?.toFixed(2)}x</span>}
                {bet.result === 'lost' && <span className="font-mono font-bold text-destructive">💥</span>}
                {bet.result === 'pending' && <span className="font-mono text-muted-foreground">...</span>}
              </div>
            ))}
            {bets.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">{t('casino.no_bets')}</p>}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-border overflow-hidden flex flex-col items-center justify-center min-h-[400px] relative">
          <SpaceBackground progress={progress} status={round?.status || 'waiting'} />
          <div className="relative z-10 flex flex-col items-center justify-center">
            {round?.status === 'waiting' && (
              <div className="text-center">
                <div className="mb-4"><GameIcon name="rocket" size={56} themed /></div>
                <div className="text-4xl font-mono font-bold text-white drop-shadow-lg">{countdown}s</div>
                <p className="text-sm text-white/60 mt-2">{t('casino.waiting')}</p>
              </div>
            )}
            {round?.status === 'flying' && (
              <div className="text-center flex flex-col items-center">
                <div className="flex flex-col items-center">
                  <div style={{ filter: 'drop-shadow(0 0 12px hsl(25 100% 60% / 0.6))' }}>
                    <GameIcon name="rocket" size={56} color="hsl(25 95% 53%)" />
                  </div>
                  <div style={{
                    width: '16px', height: `${30 + Math.min(displayMultiplier * 4, 60)}px`,
                    background: 'linear-gradient(to bottom, hsl(25 100% 60% / 0.9), hsl(45 100% 50% / 0.5), transparent)',
                    borderRadius: '0 0 50% 50%', filter: 'blur(3px)', marginTop: '-4px',
                  }} />
                </div>
                <div className="text-5xl font-mono font-black drop-shadow-lg mt-4"
                  style={{ color: getMultiplierColor(displayMultiplier) }}>
                  {displayMultiplier.toFixed(2)}x
                </div>
              </div>
            )}
            {round?.status === 'crashed' && (
              <div className="text-center">
                <div className="mb-4" style={{ filter: 'drop-shadow(0 0 20px hsl(0 80% 50% / 0.6))' }}>
                  <GameIcon name="crash" size={64} color="hsl(0 72% 55%)" />
                </div>
                <div className="text-5xl font-mono font-black text-destructive drop-shadow-lg">
                  {(round.crash_point || displayMultiplier).toFixed(2)}x
                </div>
                <p className="text-sm text-white/50 mt-2">{t('casino.crashed')}</p>
              </div>
            )}
            {!round && <div className="text-white/60">{t('casino.loading')}</div>}
          </div>
        </div>

        <div className="lg:col-span-1 rounded-xl border border-border bg-card p-4 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">{t('casino.bet_amount')}</label>
            <Input type="number" value={betAmount} onChange={e => setBetAmount(Number(e.target.value))}
              min={100} max={1000000} className="font-mono mt-1" />
            <div className="flex gap-1 mt-2">
              {[100, 1000, 5000, 10000].map(v => (
                <button key={v} onClick={() => setBetAmount(v)} className="flex-1 text-xs py-1 rounded bg-muted hover:bg-muted/80 text-foreground font-mono">
                  {v >= 1000 ? `${v/1000}K` : v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <Checkbox id="auto-cashout-toggle" checked={autoCashoutEnabled}
                onCheckedChange={(checked) => setAutoCashoutEnabled(checked === true)} />
              <label htmlFor="auto-cashout-toggle" className="text-xs text-muted-foreground cursor-pointer">
                {t('casino.auto_cashout')}
              </label>
            </div>
            <Input type="number" value={autoCashout} onChange={e => setAutoCashout(e.target.value)}
              placeholder="x2.0" step="0.1" min="1.1" className="font-mono" disabled={!autoCashoutEnabled} />
          </div>

          <div className="text-xs text-muted-foreground">
            {t('casino.your_balance')}: <span className="font-mono text-foreground">${formatMoney(balance)}</span>
          </div>

          {round?.status === 'waiting' && !myBetPlaced && (
            <Button onClick={placeBet} disabled={loading || betAmount < 100 || betAmount > balance} className="w-full" size="lg">
              {t('casino.play')} — ${formatMoney(betAmount)}
            </Button>
          )}
          {round?.status === 'waiting' && myBetPlaced && (
            <Button disabled className="w-full" size="lg" variant="secondary">{t('casino.bet_placed')} ✓</Button>
          )}
          {round?.status === 'flying' && myBetPlaced && !myCashedOut && (
            <Button onClick={cashout} disabled={loading} className="w-full bg-success hover:bg-success/90 text-success-foreground" size="lg">
              {t('casino.cashout')} {displayMultiplier.toFixed(2)}x
            </Button>
          )}
          {round?.status === 'flying' && myCashedOut && (
            <Button disabled className="w-full" size="lg" variant="secondary">{t('casino.cashed_out')} ✓</Button>
          )}
          {round?.status === 'flying' && !myBetPlaced && (
            <Button disabled className="w-full" size="lg" variant="outline">{t('casino.wait_next')}</Button>
          )}
          {round?.status === 'crashed' && (
            <Button disabled className="w-full" size="lg" variant="outline">{t('casino.next_round')}...</Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RocketGame;
