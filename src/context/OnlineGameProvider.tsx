import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { GameContext } from './GameContext';
import { accrueGameState, applyGameAction, createGameState, gameView, type EngineState, type GameAction } from '@/game/engine';
import { bindGameActions } from '@/game/actions';
import { withTimeout } from '@/lib/async';
import { toast } from 'sonner';

type SyncResponse = { state: EngineState; acknowledged: string[]; rejected: Array<{ id: string; message: string }> };
export default function OnlineGameProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user!.id, key = `gameJournal_${uid}`;
  const [state, setState] = useState<EngineState>(() => createGameState());
  const [ready, setReady] = useState(false), [syncError, setSyncError] = useState('');
  const [ownsSession, setOwnsSession] = useState(false);
  const [hasSnapshot, setHasSnapshot] = useState(false), [accessDenied, setAccessDenied] = useState(false);
  const current = useRef(state), base = useRef(state), pending = useRef<GameAction[]>([]);
  const flight = useRef<Promise<void> | null>(null), alive = useRef(true), busy = useRef(false);
  const owner = useRef(false), lastError = useRef(''), lastRejected = useRef('');
  const persist = useCallback(() => {
    localStorage.setItem(key, JSON.stringify({ base: base.current, pending: pending.current }));
    localStorage.setItem(`gameState_${uid}`, JSON.stringify(current.current));
  }, [key, uid]);
  const sync = useCallback(async () => {
    if (!owner.current) return;
    if (flight.current) { await flight.current; return; }
    const work = (async () => {
      busy.current = true;
      try {
        const batch = pending.current.slice(0, 200);
        const { data, error } = await withTimeout(supabase.functions.invoke('game-sync', { body: { actions: batch } }), 15000, 'Сервер синхронизации не отвечает');
        if (error) {
          const status = (error as { context?: { status?: number } }).context?.status;
          setAccessDenied(status === 401 || status === 403);
          throw error;
        }
        const response = data as SyncResponse;
        if (!response?.state || !Array.isArray(response.acknowledged)) throw Error('Обновление онлайн-сервера ещё не установлено');
        if (!alive.current) return;
        const acknowledged = new Set(response.acknowledged);
        pending.current = pending.current.filter(action => !acknowledged.has(action.id));
        base.current = createGameState(response.state);
        let next = structuredClone(base.current);
        for (const action of pending.current) {
          try { next = applyGameAction(structuredClone(next), action); }
          catch { /* Keep actions until the server explicitly acknowledges them. */ }
        }
        current.current = next; setState(next);
        lastRejected.current = response.rejected?.[0]?.message || '';
        lastError.current = ''; setSyncError(''); setAccessDenied(false); setHasSnapshot(true); persist();
        if (lastRejected.current) toast.error(lastRejected.current, { description: 'Баланс и имущество сверены с сервером.' });
      } catch (error) {
        if (alive.current) {
          lastError.current = error instanceof Error ? error.message : 'Не удалось синхронизировать игру';
          setSyncError(lastError.current);
        }
      } finally { busy.current = false; }
    })();
    flight.current = work;
    try { await work; } finally { flight.current = null; }
  }, [persist]);
  useEffect(() => {
    alive.current = true;
    let release: (() => void) | undefined;
    const start = async () => {
      if (!alive.current) return;
      owner.current = true; setOwnsSession(true);
      try {
        const cached = JSON.parse(localStorage.getItem(key) || 'null');
        const saved = localStorage.getItem(`gameState_${uid}`);
        let snapshot = cached?.base || (saved ? JSON.parse(saved) : null);
        if (!snapshot) {
          const { data, error } = await withTimeout(supabase.from('game_saves').select('game_state').eq('user_id', uid).maybeSingle(), 15000, 'Не удалось загрузить облачное сохранение');
          if (error) throw error;
          snapshot = data?.game_state || {};
        }
        if (!alive.current) return;
        base.current = createGameState(snapshot); setHasSnapshot(true);
        pending.current = Array.isArray(cached?.pending) ? cached.pending : [];
        let next = structuredClone(base.current);
        for (const action of pending.current) { try { next = applyGameAction(structuredClone(next), action); } catch { /* Reconcile with server. */ } }
        current.current = next; setState(next);
      } catch { pending.current = []; }
      await sync();
      if (alive.current) setReady(true);
    };
    const acquire = () => {
      if (owner.current || !alive.current) return;
      if (!navigator.locks) { void start(); return; }
      void navigator.locks.request(`financial-clicker-${uid}`, { ifAvailable: true }, async lock => {
        if (!lock || !alive.current) return;
        const held = new Promise<void>(resolve => { release = resolve; });
        await start();
        if (!alive.current) release?.();
        await held;
      }).catch(error => { setSyncError(String(error)); });
    };
    acquire();
    const lockRetry = setInterval(acquire, 3000);
    const timer = setInterval(() => { void sync(); }, 5000);
    const retry = () => { void sync(); };
    const save = () => { if (owner.current) { try { persist(); } catch { /* Existing journal remains recoverable. */ } } };
    const visibility = () => { if (document.hidden) save(); else retry(); };
    window.addEventListener('online', retry); window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      alive.current = false; clearInterval(timer); clearInterval(lockRetry); save();
      owner.current = false; release?.();
      window.removeEventListener('online', retry); window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [key, uid, sync, persist]);
  useEffect(() => {
    if (!ready || syncError) return;
    const timer = setInterval(() => {
      if (busy.current) return;
      const next = accrueGameState(structuredClone(current.current));
      current.current = next; setState(next);
    }, 1000);
    return () => clearInterval(timer);
  }, [ready, syncError]);
  const dispatch = useCallback((type: string, args: Record<string, unknown> = {}) => {
    if (!ready || !hasSnapshot || accessDenied || !owner.current || (syncError && type !== 'click')) {
      toast.error(syncError ? 'Онлайн-действия временно недоступны. Повторите синхронизацию.' : 'Игра синхронизируется');
      return false;
    }
    if (pending.current.length >= 200) {
      toast.error('Очередь сохранения заполнена. Подождите восстановления синхронизации.');
      return false;
    }
    const action: GameAction = { id: crypto.randomUUID(), type, args };
    const previous = current.current;
    try {
      const next = applyGameAction(structuredClone(previous), action);
      pending.current.push(action); current.current = next;
      try { persist(); } catch (error) { pending.current.pop(); current.current = previous; throw error; }
      setState(next); return true;
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Действие недоступно'); return false; }
  }, [ready, hasSnapshot, accessDenied, syncError, persist]);
  const refresh = useCallback(async () => {
    if (!owner.current) throw Error('Игра открыта в другой вкладке');
    do {
      await sync();
      if (lastError.current) throw Error(lastError.current);
      if (lastRejected.current) throw Error(lastRejected.current);
    } while (pending.current.length);
  }, [sync]);
  if (!ownsSession) return <div role="status" className="p-8 text-center">Игра открыта в другой вкладке. Закройте её, чтобы продолжить здесь.</div>;
  if (!ready) return <div role="status" className="p-8 text-center">Загрузка сохранения…</div>;
  return <GameContext.Provider value={{ ...gameView(state), ...bindGameActions(dispatch, refresh) }}>
    {syncError && <div role="status" className="fixed bottom-3 left-1/2 z-50 max-w-lg -translate-x-1/2 rounded-xl border bg-card p-3 text-sm shadow-xl">Синхронизация приостановлена. {hasSnapshot && !accessDenied ? 'Можно кликать: до 200 действий сохраняются на устройстве и ожидают проверки сервером. Покупки временно недоступны.' : 'Не удалось подтвердить сохранение или доступ к аккаунту. Действия временно недоступны.'}<button className="ml-2 underline" onClick={() => void sync()}>Повторить</button></div>}
    {children}
  </GameContext.Provider>;
}
