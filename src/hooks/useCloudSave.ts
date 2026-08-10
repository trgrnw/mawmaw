import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export function useCloudSave(userId: string | undefined) {
  const forceSave = useCallback(async (gameState: Record<string, unknown>, netWorth: number) => {
    if (!userId) return;
    // IMPORTANT: never overwrite pending_balance here — it accumulates server-side
    // (market sales, offline income, wheel) and is consumed by claim_pending_balance().
    await supabase.from('game_saves').upsert(
      {
        user_id: userId,
        game_state: gameState as unknown as Json,
        net_worth: netWorth,
      },
      { onConflict: 'user_id' }
    );
  }, [userId]);

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

  return { saveToCloud: forceSave, loadFromCloud, forceSave, claimPending };
}
