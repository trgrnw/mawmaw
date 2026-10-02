/** Cosmetic activity only: never changes the game's actions or saved balance. */
export interface CatActivity { clicks: number[]; reactionAt: number; nextReactionAt: number }
export const createCatActivity = (): CatActivity => ({ clicks: [], reactionAt: -Infinity, nextReactionAt: 0 });
export function recordCatClick(activity: CatActivity, now: number) {
  activity.clicks = activity.clicks.filter(time => now - time < 1000);
  activity.clicks.push(now);
  if (activity.clicks.length >= 6 && now >= activity.nextReactionAt) {
    activity.reactionAt = now;
    activity.nextReactionAt = now + 6500;
    activity.clicks = [];
  }
}
export function catSurprise(activity: CatActivity, now: number) {
  const elapsed = now - activity.reactionAt;
  if (elapsed < 0 || elapsed > 4200) return 0;
  const ramp = elapsed < 900 ? elapsed / 900 : elapsed < 2700 ? 1 : (4200 - elapsed) / 1500;
  return ramp * ramp * (3 - 2 * ramp);
}
