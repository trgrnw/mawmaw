import type { Upgrade, UpgradeLevel } from './types';

export function generateUpgradeLevels(): UpgradeLevel[] {
  const levels: UpgradeLevel[] = [];
  let totalBonus = 0;
  let cost = 50;
  let bonus = 1;
  let level = 1;

  while (totalBonus + bonus <= 5900) {
    levels.push({ level, bonus, cost: Math.round(cost) });
    totalBonus += bonus;
    level++;

    if (totalBonus < 10) bonus = 1;
    else if (totalBonus < 50) bonus = 2;
    else if (totalBonus < 200) bonus = 5;
    else if (totalBonus < 500) bonus = 10;
    else if (totalBonus < 1000) bonus = 25;
    else if (totalBonus < 2000) bonus = 50;
    else if (totalBonus < 3500) bonus = 100;
    else bonus = 200;

    cost = cost * 1.35 + bonus * 10;
  }

  return levels;
}

export const upgradeLevels = generateUpgradeLevels();

export const defaultUpgrades: Upgrade[] = [
  {
    id: 'click-power',
    name: 'Сила клика',
    description: 'Увеличивает доход за каждый клик',
    emoji: '👆',
    currentLevel: 0,
    maxLevel: upgradeLevels.length,
    levels: upgradeLevels,
  },
];
