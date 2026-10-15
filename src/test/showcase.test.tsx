import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nContext';
import ShowcaseCard from '@/components/profile/ShowcaseCard';
import { normalizePlayerQuery, readShowcase, resolveShowcaseItem } from '@/lib/showcase';
import { businessCategories } from '@/data/businessNames';

describe('profile showcase persistence', () => {
  const saved = readShowcase([
    { cat: 'ships', id: 'yacht-1', name: 'My yacht', image: '/yacht.jpg' },
    { cat: 'planes', id: 'plane-1', name: 'My plane', image: '/plane.jpg' },
    { cat: 'favorite_username', id: 'user-1', name: '@thugger' },
    { cat: 'favorite_plate', id: 'plate:plate-1', name: 'A 737 MB 77' },
  ]);
  it('keeps all saved showcase items during delayed inventory hydration', () => {
    for (const item of saved) expect(resolveShowcaseItem(item.cat, item.id, [], saved)).toEqual(item);
    expect(resolveShowcaseItem('planes', '', [], saved)).toBeNull();
  });
  it('resolves old unprefixed ids and prefers current inventory names', () => {
    expect(resolveShowcaseItem('favorite_username', 'user-1', [{id:'username:user-1',name:'@renamed'}], saved)?.name).toBe('@renamed');
    expect(resolveShowcaseItem('favorite_plate', 'plate-1', [], saved)?.name).toBe('A 737 MB 77');
  });
  it('renders selected text-only items and readable category labels', () => {
    localStorage.setItem('language', 'ru');
    render(<I18nProvider><ShowcaseCard item={saved[2]} /><ShowcaseCard item={saved[3]} /><ShowcaseCard item={saved[1]} /></I18nProvider>);
    expect(screen.getByText('@thugger')).toBeTruthy();
    expect(screen.getByText('A 737 MB 77')).toBeTruthy();
    expect(screen.getByText('Любимый username')).toBeTruthy();
    expect(screen.queryByText('favorite_plate')).toBeNull();
    expect(screen.getByAltText('My plane').getAttribute('src')).toBe('/plane.jpg');
  });
  it('accepts player ids with # and usernames with @', () => {
    expect(normalizePlayerQuery(' #123 ')).toBe('123');
    expect(normalizePlayerQuery(' @thugger ')).toBe('thugger');
  });
});

describe('fictional English business names', () => {
  it('offers exactly 200 unique ASCII names per category without duplicates across categories', () => {
    const all=businessCategories.flatMap(category=>{
      expect(category.names).toHaveLength(200);
      expect(new Set(category.names).size).toBe(200);
      expect(category.names.every(name=>/^[A-Za-z]+ [A-Za-z]+$/.test(name))).toBe(true);
      return category.names;
    });
    expect(new Set(all).size).toBe(all.length);
  });
});
