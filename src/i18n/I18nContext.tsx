import React, { createContext, useContext, useState, useCallback } from 'react';
import { translations, type Locale } from './translations';
import { dataTranslations } from './dataTranslations';

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
  /** Translate data-level string: returns translated value or fallback (original Russian from data) */
  td: (key: string, fallback: string) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be within I18nProvider');
  return ctx;
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    return (localStorage.getItem('language') as Locale) || 'ru';
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('language', l);
  }, []);

  const t = useCallback((key: string): string => {
    return translations[locale]?.[key] ?? dataTranslations[locale]?.[key] ?? translations.ru[key] ?? key;
  }, [locale]);

  const td = useCallback((key: string, fallback: string): string => {
    return dataTranslations[locale]?.[key] ?? translations[locale]?.[key] ?? fallback;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, td }}>
      {children}
    </I18nContext.Provider>
  );
};
