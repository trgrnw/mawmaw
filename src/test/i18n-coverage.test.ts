import { describe, expect, it } from 'vitest';
import { translations, type Locale } from '@/i18n/translations';
import { dataTranslations } from '@/i18n/dataTranslations';

const locales: Locale[] = ['ru', 'en', 'cn', 'pl', 'de'];

describe('translation coverage', () => {
  it('keeps every UI locale in sync with Russian', () => {
    const expected = Object.keys(translations.ru).sort();
    for (const locale of locales) {
      expect(Object.keys(translations[locale]).sort()).toEqual(expected);
      expect(Object.values(translations[locale]).every(value => value.trim().length > 0)).toBe(true);
    }
  });

  it('keeps all translated data locales in sync', () => {
    const translatedLocales = ['en', 'cn', 'pl', 'de'];
    const expected = Object.keys(dataTranslations.en).sort();
    for (const locale of translatedLocales) {
      expect(Object.keys(dataTranslations[locale]).sort()).toEqual(expected);
      expect(Object.values(dataTranslations[locale]).every(value => value.trim().length > 0)).toBe(true);
    }
  });
});
