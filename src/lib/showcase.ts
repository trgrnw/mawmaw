export interface ShowcaseItem {
  cat: string;
  id: string;
  name: string;
  image?: string;
  country?: string;
}

export const showcaseCategoryKeys: Record<string, string> = {
  cars: 'profile.cat_car', planes: 'profile.cat_plane', ships: 'profile.cat_ship',
  nft: 'profile.cat_nft', art: 'profile.cat_art',
  favorite_username: 'profile.favorite_username', favorite_plate: 'profile.favorite_plate',
};

// Older saves may contain an unprefixed username/plate id.
export function showcaseId(category: string, id: string) {
  return category === 'favorite_username' ? `username:${id.replace(/^username:/, '')}`
    : category === 'favorite_plate' ? `plate:${id.replace(/^plate:/, '')}` : id;
}

export function readShowcase(value: unknown): ShowcaseItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ShowcaseItem => !!item && typeof item.cat === 'string'
    && typeof item.id === 'string' && typeof item.name === 'string')
    .map(item => ({ ...item, id: showcaseId(item.cat, item.id) }));
}

export function resolveShowcaseItem(category: string, id: string | undefined,
  inventory: Array<{ id: string; name: string; image?: string; country?: string }>, saved: ShowcaseItem[]) {
  if (!id) return null;
  const normalized = showcaseId(category, id);
  const current = inventory.find(item => showcaseId(category, item.id) === normalized);
  const snapshot = saved.find(item => item.cat === category && showcaseId(category, item.id) === normalized);
  // Keep the saved presentation while inventory/catalog data is rehydrating.
  return current ? { ...snapshot, ...current, cat: category, id: normalized }
    : snapshot ? { ...snapshot, id: normalized } : null;
}

export function normalizePlayerQuery(value: string) {
  return value.trim().replace(/^[@#]\s*/, '');
}
