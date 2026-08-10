export const XP_PER_CLICK = 1;

export function totalXpForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return Math.floor(100 * Math.pow(safeLevel - 1, 1.65));
}

export function levelFromXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;
  while (totalXpForLevel(level + 1) <= safeXp) level += 1;
  return level;
}

export function rewardForLevel(level: number): number {
  return Math.max(0, Math.floor(level)) * Math.max(0, Math.floor(level)) * 250;
}

export function rewardsBetweenLevels(previousLevel: number, nextLevel: number): number {
  let reward = 0;
  for (let level = previousLevel + 1; level <= nextLevel; level += 1) {
    reward += rewardForLevel(level);
  }
  return reward;
}

export function progressionFromXp(xp: number) {
  const playerXp = Math.max(0, Math.floor(xp));
  const level = levelFromXp(playerXp);
  const levelStartXp = totalXpForLevel(level);
  const nextLevelXp = totalXpForLevel(level + 1);
  const progress = nextLevelXp === levelStartXp
    ? 1
    : (playerXp - levelStartXp) / (nextLevelXp - levelStartXp);

  return { level, levelStartXp, nextLevelXp, progress };
}
