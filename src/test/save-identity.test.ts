import { describe, expect, it } from 'vitest';
import { isSaveKeyReady } from '@/game/save';

describe('save identity guard', () => {
  it('blocks the previous guest render from saving into an authenticated key', () => {
    expect(isSaveKeyReady('gameState_guest', 'gameState_user-123')).toBe(false);
  });

  it('blocks autosave while a new identity is still loading', () => {
    expect(isSaveKeyReady(null, 'gameState_user-123')).toBe(false);
  });

  it('allows persistence only after the exact key has finished loading', () => {
    expect(isSaveKeyReady('gameState_user-123', 'gameState_user-123')).toBe(true);
  });
});
