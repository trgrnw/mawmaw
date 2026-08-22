export interface BankCardDesign {
  id: string;
  name: string;
  description: string;
  price: number;
  unlockLevel?: number;
  colors: [string, string];
  accent: string;
}

export interface BankCardState {
  ownedIds: string[];
  activeId: string;
  customNumber: string;
  customColor: string | null;
  expiresAt: string;
}

export const DEFAULT_BANK_CARD_STATE: BankCardState = {
  ownedIds: ['starter'], activeId: 'starter', customNumber: '4242', customColor: null, expiresAt: '12/30',
};

export const BANK_CARD_DESIGNS: BankCardDesign[] = [
  { id: 'starter', name: 'Clicker Start', description: 'Базовая карта каждого игрока', price: 0, colors: ['#172554', '#0369a1'], accent: '#bae6fd' },
  { id: 'neon', name: 'Neon Pulse', description: 'Неоновая карта для активных игроков', price: 50_000, colors: ['#2e1065', '#c026d3'], accent: '#f5d0fe' },
  { id: 'emerald', name: 'Emerald Vault', description: 'Дизайн частного банка', price: 500_000, colors: ['#052e16', '#059669'], accent: '#a7f3d0' },
  { id: 'level-10', name: 'Silver Rank', description: 'Награда за достижение 10 уровня', price: 0, unlockLevel: 10, colors: ['#111827', '#64748b'], accent: '#f1f5f9' },
  { id: 'level-25', name: 'Royal Gold', description: 'Награда за достижение 25 уровня', price: 0, unlockLevel: 25, colors: ['#451a03', '#d97706'], accent: '#fef3c7' },
  { id: 'level-50', name: 'Obsidian Elite', description: 'Награда за достижение 50 уровня', price: 0, unlockLevel: 50, colors: ['#030712', '#312e81'], accent: '#c4b5fd' },
];

export function normalizeBankCardState(value: unknown, playerLevel: number): BankCardState {
  const saved = value && typeof value === 'object' ? value as Partial<BankCardState> : {};
  const rewarded = BANK_CARD_DESIGNS.filter(card => card.unlockLevel && playerLevel >= card.unlockLevel).map(card => card.id);
  const ownedIds = Array.from(new Set(['starter', ...(Array.isArray(saved.ownedIds) ? saved.ownedIds : []), ...rewarded]));
  return {
    ownedIds,
    activeId: ownedIds.includes(saved.activeId || '') ? saved.activeId! : 'starter',
    customNumber: /^\d{4}$/.test(saved.customNumber || '') ? saved.customNumber! : '4242',
    customColor: /^#[0-9a-f]{6}$/i.test(saved.customColor || '') ? saved.customColor! : null,
    expiresAt: /^(0[1-9]|1[0-2])\/\d{2}$/.test(saved.expiresAt || '') ? saved.expiresAt! : '12/30',
  };
}
