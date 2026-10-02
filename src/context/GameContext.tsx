import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import OnlineGameProvider from './OnlineGameProvider';
import { accrueGameState, applyGameAction, createGameState, gameView, type EngineState } from '@/game/engine';
import { bindGameActions } from '@/game/actions';
import type { GameContextType } from '@/game/types';
import { toast } from 'sonner';

export { formatMoney } from '@/game/format';
export const GameContext = createContext<GameContextType | null>(null);
export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be within GameProvider');
  return context;
}

function LocalGameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<EngineState>(() => {
    const raw = localStorage.getItem('gameState_guest');
    try { return accrueGameState(createGameState(raw ? JSON.parse(raw) : {})); }
    catch {
      // Keep a recovery copy instead of overwriting an unreadable save.
      if (raw) localStorage.setItem(`gameState_guest_recovery_${Date.now()}`, raw);
      return createGameState();
    }
  });
  const current = useRef(state);
  const persist = useCallback(() => {
    try { localStorage.setItem('gameState_guest', JSON.stringify(current.current)); }
    catch { toast.error('Не удалось сохранить игру на устройстве. Проверьте свободное место.'); }
  }, []);
  useEffect(() => {
    const accrue = setInterval(() => {
      const next = accrueGameState(structuredClone(current.current));
      current.current = next;
      setState(next);
    }, 1000);
    // A fixed interval also saves during uninterrupted clicking.
    const save = setInterval(persist, 2000);
    const visibility = () => { if (document.hidden) persist(); };
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearInterval(accrue); clearInterval(save); persist();
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [persist]);
  const dispatch = useCallback((type: string, args: Record<string, unknown> = {}) => {
    try {
      const next = applyGameAction(structuredClone(current.current), { id: crypto.randomUUID(), type, args });
      current.current = next; setState(next);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Действие недоступно');
      return false;
    }
  }, []);
  const sync = useCallback(async () => { persist(); }, [persist]);
  return <GameContext.Provider value={{ ...gameView(state), ...bindGameActions(dispatch, sync) }}>{children}</GameContext.Provider>;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user ? <OnlineGameProvider key={user.id}>{children}</OnlineGameProvider> : <LocalGameProvider>{children}</LocalGameProvider>;
}
