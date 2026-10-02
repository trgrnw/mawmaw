import { describe, expect, it } from 'vitest';
import { catSurprise, createCatActivity, recordCatClick } from '@/components/earning/catReactions';
describe('cosmetic cat reactions', () => {
  it('ignores ordinary slow clicks', () => {
    const activity = createCatActivity();
    for (let i = 0; i < 20; i++) recordCatClick(activity, i * 500);
    expect(catSurprise(activity, 9500)).toBe(0);
    expect(activity.clicks.length).toBeLessThan(4);
  });
  it('turns gradually, holds surprise and recovers after a fast burst', () => {
    const activity = createCatActivity();
    for (let i = 0; i < 6; i++) recordCatClick(activity, i * 100);
    expect(catSurprise(activity, 500)).toBe(0);
    expect(catSurprise(activity, 950)).toBeCloseTo(.5);
    expect(catSurprise(activity, 1600)).toBe(1);
    expect(catSurprise(activity, 4800)).toBe(0);
  });
  it('does not restart reactions continuously and can react again later', () => {
    const activity = createCatActivity();
    for (let i = 0; i < 60; i++) recordCatClick(activity, i * 100);
    expect(activity.reactionAt).toBe(500);
    for (let i = 70; i < 76; i++) recordCatClick(activity, i * 100);
    expect(activity.reactionAt).toBeGreaterThanOrEqual(7000);
  });
});
