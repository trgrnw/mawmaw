import React, { useState, useEffect, useCallback } from 'react';
import { useGame, formatMoney } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import GameIcon from '@/components/GameIcon';

interface MinesGameState {
  id: string;
  bomb_count: number;
  bet_amount: number;
  current_multiplier: number;
  status: string;
  revealed_positions: number[];
}

interface MinesBet {
  id: string;
  username: string;
  bet_amount: number;
  bomb_count: number;
  cashout_multiplier: number;
  result: string;
  profit: number;
}

function getMultiplierColor(x: number): string {
  if (x < 2) return 'hsl(210 10% 55%)';
  if (x < 5) return 'hsl(217 91% 60%)';
  if (x < 10) return 'hsl(271 81% 56%)';
  if (x < 50) return 'hsl(25 95% 53%)';
  return 'hsl(45 93% 47%)';
}

const BOMB_PRESETS = [3, 5, 10, 16, 24];

const MinesGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { balance, spendBalance, addBalance } = useGame();
  const { user, username } = useAuth();
  const { t } = useI18n();

  const [game, setGame] = useState<MinesGameState | null>(null);
  const [bombCount, setBombCount] = useState(5);
  const [betAmount, setBetAmount] = useState(1000);
  const [bombPositions, setBombPositions] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [recentBets, setRecentBets] = useState<MinesBet[]>([]);
  const [revealedCells, setRevealedCells] = useState<Set<number>>(new Set());
  const [bombHit, setBombHit] = useState<number | null>(null);

  const callCasino = useCallback(async (action: string, params: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke('casino', { body: { action, ...params } });
    if (error) console.error('Casino error:', error);
    return data;
  }, []);

  // Load recent bets
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const data = await callCasino('get_mines_history');
      if (data?.bets) setRecentBets(data.bets);
    };
    load();
  }, [user, callCasino]);

  const startGame = async () => {
    if (betAmount < 100 || !spendBalance(betAmount)) return;
    setLoading(true);
    setBombPositions(null);
    setBombHit(null);
    setRevealedCells(new Set());
    const data = await callCasino('start_mines', { bomb_count: bombCount, bet_amount: betAmount });
    if (data?.error) {
      addBalance(betAmount);
    } else if (data?.game) {
      setGame(data.game);
    }
    setLoading(false);
  };

  const revealCell = async (pos: number) => {
    if (!game || game.status !== 'active' || revealedCells.has(pos) || loading) return;
    setLoading(true);
    const data = await callCasino('reveal_mine', { game_id: game.id, position: pos, username: username || 'Player' });
    if (data) {
      const newRevealed = new Set(revealedCells);
      newRevealed.add(pos);
      setRevealedCells(newRevealed);

      if (data.is_bomb) {
        setBombHit(pos);
        setBombPositions(data.bomb_positions);
        setGame(prev => prev ? { ...prev, status: 'lost' } : null);
        // Refresh history
        const hist = await callCasino('get_mines_history');
        if (hist?.bets) setRecentBets(hist.bets);
      } else {
        setGame(prev => prev ? { ...prev, current_multiplier: data.multiplier, revealed_positions: [...prev.revealed_positions, pos] } : null);
        if (data.game_over) {
          setBombPositions(data.bomb_positions);
          setGame(prev => prev ? { ...prev, status: 'won' } : null);
          addBalance(game.bet_amount * data.multiplier);
          const hist = await callCasino('get_mines_history');
          if (hist?.bets) setRecentBets(hist.bets);
        }
      }
    }
    setLoading(false);
  };

  const cashoutMines = async () => {
    if (!game || game.status !== 'active' || loading) return;
    setLoading(true);
    const data = await callCasino('cashout_mines', { game_id: game.id, username: username || 'Player' });
    if (data?.success) {
      addBalance(data.win_amount);
      setBombPositions(data.bomb_positions);
      setGame(prev => prev ? { ...prev, status: 'won' } : null);
      const hist = await callCasino('get_mines_history');
      if (hist?.bets) setRecentBets(hist.bets);
    }
    setLoading(false);
  };

  const isGameOver = game && (game.status === 'won' || game.status === 'lost');
  const isActive = game && game.status === 'active';

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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Recent bets panel */}
        <div className="lg:col-span-1 rounded-xl border border-border bg-card p-4 max-h-[600px] overflow-y-auto">
          <h3 className="text-sm font-semibold text-foreground mb-3">{t('casino.recent_bets')}</h3>
          <div className="space-y-2">
            {recentBets.map(bet => (
              <div key={bet.id} className={`p-2 rounded-lg text-xs ${bet.result === 'won' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                <div className="flex justify-between">
                  <span className="font-medium text-foreground">{bet.username}</span>
                  <span className="text-muted-foreground">{bet.bomb_count} <GameIcon name="bomb" size={12} className="inline" /></span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">${formatMoney(bet.bet_amount)}</span>
                  <span
                    className="font-mono font-bold"
                    style={{ color: bet.result === 'won' ? 'hsl(var(--success))' : 'hsl(var(--destructive))' }}
                  >
                    {bet.result === 'won' ? `${bet.cashout_multiplier?.toFixed(2)}x` : <GameIcon name="crash" size={14} className="inline" />}
                  </span>
                </div>
                {bet.result === 'won' && bet.profit > 0 && (
                  <div className="text-right text-success font-mono mt-0.5">+${formatMoney(bet.profit)}</div>
                )}
              </div>
            ))}
            {recentBets.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">{t('casino.no_bets')}</p>}
          </div>
        </div>

        {/* Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 25 }, (_, i) => {
              const isRevealed = revealedCells.has(i);
              const isBombCell = bombPositions?.includes(i);
              const isBombHitCell = bombHit === i;
              const isGameDone = isGameOver;

              let cellClass = 'aspect-square rounded-xl border-2 transition-all duration-200 flex items-center justify-center text-2xl font-bold cursor-pointer ';

              if (isBombHitCell) {
                cellClass += 'bg-destructive/30 border-destructive text-destructive';
              } else if (isGameDone && isBombCell) {
                cellClass += 'bg-destructive/10 border-destructive/30 text-destructive/60';
              } else if (isRevealed && !isBombCell) {
                cellClass += 'bg-success/20 border-success/40 text-success';
              } else if (isGameDone) {
                cellClass += 'bg-muted/50 border-border text-muted-foreground';
              } else if (isActive) {
                cellClass += 'bg-card border-border hover:border-primary hover:bg-primary/5 hover:scale-105';
              } else {
                cellClass += 'bg-muted/30 border-border/50';
              }

              return (
                <button
                  key={i}
                  onClick={() => revealCell(i)}
                  disabled={!isActive || isRevealed || loading}
                  className={cellClass}
                >
                  {isBombHitCell && <GameIcon name="bomb" size={24} color="hsl(var(--destructive))" />}
                  {isGameDone && isBombCell && !isBombHitCell && <GameIcon name="bomb" size={20} className="opacity-60" />}
                  {isRevealed && !isBombCell && <GameIcon name="gem" size={24} color="hsl(var(--success))" />}
                  {!isRevealed && !isGameDone && isActive && '?'}
                </button>
              );
            })}
          </div>

          {/* Multiplier display */}
          {isActive && (
            <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
              <div>
                <span className="text-sm text-muted-foreground">{t('casino.current_mult')}:</span>
                <span
                  className="text-2xl font-mono font-black ml-3"
                  style={{ color: getMultiplierColor(game.current_multiplier) }}
                >
                  {game.current_multiplier.toFixed(2)}x
                </span>
              </div>
              <Button
                onClick={cashoutMines}
                disabled={loading || revealedCells.size === 0}
                className="bg-success hover:bg-success/90 text-success-foreground"
                size="lg"
              >
                {t('casino.cashout')} ${formatMoney(game.bet_amount * game.current_multiplier)}
              </Button>
            </div>
          )}
          {isGameOver && (
            <div className={`p-4 rounded-xl border text-center font-bold ${
              game.status === 'won' ? 'border-success/40 bg-success/10 text-success' : 'border-destructive/40 bg-destructive/10 text-destructive'
            }`}>
              {game.status === 'won'
                ? `${t('casino.you_won')} $${formatMoney(game.bet_amount * game.current_multiplier)}`
                : t('casino.you_lost')}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="lg:col-span-1 rounded-xl border border-border bg-card p-4 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">{t('casino.bombs')}</label>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {BOMB_PRESETS.map(n => (
                <button
                  key={n}
                  onClick={() => !isActive && setBombCount(n)}
                  disabled={!!isActive}
                  className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    bombCount === n
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground hover:bg-muted/80'
                  }`}
                >
                  {n}
                </button>
              ))}
              <Input
                type="number"
                value={bombCount}
                onChange={e => !isActive && setBombCount(Math.min(24, Math.max(2, Number(e.target.value))))}
                disabled={!!isActive}
                min={2}
                max={24}
                className="font-mono text-xs h-auto py-1.5"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">{t('casino.bet_amount')}</label>
            <Input
              type="number"
              value={betAmount}
              onChange={e => !isActive && setBetAmount(Number(e.target.value))}
              disabled={!!isActive}
              min={100}
              max={1000000}
              className="font-mono mt-1"
            />
            <div className="flex gap-1 mt-2">
              {[
                { label: 'Min', value: 100 },
                { label: '+100', value: betAmount + 100 },
                { label: '+250', value: betAmount + 250 },
                { label: '+500', value: betAmount + 500 },
                { label: '+1K', value: betAmount + 1000 },
                { label: 'Max', value: Math.min(1000000, balance) },
              ].map(({ label, value }) => (
                <button
                  key={label}
                  onClick={() => !isActive && setBetAmount(Math.min(1000000, value))}
                  disabled={!!isActive}
                  className="flex-1 text-xs py-1 rounded bg-muted hover:bg-muted/80 text-foreground font-mono"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            {t('casino.your_balance')}: <span className="font-mono text-foreground">${formatMoney(balance)}</span>
          </div>

          {!isActive && (
            <Button
              onClick={startGame}
              disabled={loading || betAmount < 100 || betAmount > balance}
              className="w-full"
              size="lg"
            >
              {t('casino.play')} — ${formatMoney(betAmount)}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MinesGame;
