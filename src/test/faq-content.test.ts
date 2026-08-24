import { describe, expect, it } from 'vitest';
import { faqContent } from '@/data/faqContent';

describe('FAQ and privacy content', () => {
  it.each(['ru', 'en'] as const)('keeps the %s policy complete', locale => {
    const content = faqContent[locale];
    expect(content.questions.length).toBeGreaterThanOrEqual(12);
    expect(content.rules.length).toBeGreaterThanOrEqual(10);
    expect(content.privacy.length).toBeGreaterThanOrEqual(12);
  });

  it('clearly permits multi-accounting and reasonable auto-clickers', () => {
    const rules = faqContent.ru.rules.map(rule => `${rule.title} ${rule.text}`).join(' ');
    expect(rules).toContain('Мультиаккаунты разрешены');
    expect(rules).toContain('Автокликеры и макросы разрешены');
    expect(rules).toContain('крайне низкие задержки');
  });

  it('names the actual cloud provider and deletion route', () => {
    const privacy = faqContent.ru.privacy.map(section => `${section.title} ${section.text} ${(section.bullets || []).join(' ')}`).join(' ');
    expect(privacy).toContain('Supabase');
    expect(privacy).toContain('GitHub Pages');
    expect(privacy).toContain('удал');
    expect(privacy).toContain('Поддержк');
  });
});
