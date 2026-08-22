import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export function useCloudSave(userId: string | undefined) {
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const writeState = useCallback(async (gameState: Record<string, unknown>, netWorth: number) => {
    if (!userId) return;
    const { data, error } = await supabase.rpc('save_game_state' as never, {
      p_state: gameState as unknown as Json,
      p_net_worth: netWorth,
    } as never);
    if (error) {
      // Keep cross-device saves working even when the RPC migration has not
      // reached a Supabase project yet. RLS still restricts this row to userId.
      const { error: fallbackError } = await supabase
        .from('game_saves')
        .upsert({
          user_id: userId,
          game_state: gameState as unknown as Json,
          net_worth: netWorth,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (fallbackError) throw fallbackError;
      return;
    }
    const result = data as unknown as { saved?: boolean; reason?: string } | null;
    if (result?.saved === false) throw new Error(result.reason || 'Cloud rejected the save');
  }, [userId]);

  const forceSave = useCallback(async (gameState: Record<string, unknown>, netWorth: number) => {
    const queued = saveQueueRef.current.catch(() => undefined).then(() => writeState(gameState, netWorth));
    saveQueueRef.current = queued;
    return queued;
  }, [writeState]);

  // Critical transactions bypass the background queue. Server-side savedAt
  // ordering prevents older in-flight autosaves from overwriting this state.
  const forceSaveNow = useCallback((gameState: Record<string, unknown>, netWorth: number) =>
    writeState(gameState, netWorth), [writeState]);

  const loadFromCloud = useCallback(async (): Promise<Record<string, unknown> | null> => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('game_saves')
      .select('game_state, pending_balance')
      .eq('user_id', userId)
      .maybeSingle();
    // CRITICAL: distinguish "no save" from "network error". Returning null on transient
    // errors caused autosave to wipe progress. On error → return undefined-as-null
    // BUT do NOT autosave defaults; caller must check.
    if (error) {
      console.warn('[loadFromCloud] error:', error.message);
      return null;
    }
    if (!data) return null;

    const state = (data.game_state as Record<string, unknown>) || {};
    const pending = Number((data as any).pending_balance) || 0;

    if (pending !== 0) {
      const currentBalance = Number(state.balance) || 0;
      state.balance = currentBalance + pending;
      // Atomically reset pending only if it didn't change in the meantime
      await supabase.from('game_saves')
        .update({ pending_balance: 0 } as any)
        .eq('user_id', userId)
        .eq('pending_balance', pending);
    }

    return state;
  }, [userId]);

  // Periodic claim while playing (to receive market sales / offline / wheel without reload)
  const claimPending = useCallback(async (): Promise<number> => {
    if (!userId) return 0;
    const { data, error } = await supabase.rpc('claim_pending_balance');
    if (error) return 0;
    return Number((data as any)?.amount) || 0;
  }, [userId]);

  return { saveToCloud: forceSave, loadFromCloud, forceSave, forceSaveNow, claimPending };
}
