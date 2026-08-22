import { describe, expect, it } from 'vitest';
import { DEFAULT_BANK_CARD_STATE, normalizeBankCardState } from '@/game/bankCards';

describe('bank card progress', () => {
  it('creates a safe starter card for old saves', () => {
    expect(normalizeBankCardState(undefined, 1)).toEqual(DEFAULT_BANK_CARD_STATE);
  });

  it('unlocks reward cards from the player level', () => {
    const state = normalizeBankCardState(DEFAULT_BANK_CARD_STATE, 25);
    expect(state.ownedIds).toContain('level-10');
    expect(state.ownedIds).toContain('level-25');
    expect(state.ownedIds).not.toContain('level-50');
  });

  it('rejects malformed custom card details from a save', () => {
    const state = normalizeBankCardState({
      ownedIds: ['starter'],
      activeId: 'missing',
      customNumber: '12AB',
      customColor: 'red',
      expiresAt: '99/99',
    }, 1);
    expect(state.activeId).toBe('starter');
    expect(state.customNumber).toBe('4242');
    expect(state.customColor).toBeNull();
    expect(state.expiresAt).toBe('12/30');
  });
});
