import React from 'react';
import { useI18n } from '@/i18n/I18nContext';
import GameIcon from '@/components/GameIcon';

const FaqTab: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <GameIcon name="faq" size={24} />
          {t('faq.title')}
        </h1>
        <p className="text-sm text-foreground/60 mt-1">{t('faq.subtitle')}</p>
      </div>

      {/* Game Rules */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <GameIcon name="rules" size={20} themed /> {t('faq.rules_title')}
        </h2>
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3 text-sm text-foreground/80 leading-relaxed">
          <p><strong>1.</strong> {t('faq.rule1')}</p>
          <p><strong>2.</strong> {t('faq.rule2')}</p>
          <p><strong>3.</strong> {t('faq.rule3')}</p>
          <p><strong>4.</strong> {t('faq.rule4')}</p>
          <p><strong>5.</strong> {t('faq.rule5')}</p>
          <p><strong>6.</strong> {t('faq.rule6')}</p>
          <p><strong>7.</strong> {t('faq.rule7')}</p>
          <p><strong>8.</strong> {t('faq.rule8')}</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <GameIcon name="faq" size={20} /> {t('faq.questions_title')}
        </h2>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <details key={i} className="bg-card border border-border rounded-2xl overflow-hidden group">
              <summary className="px-5 py-3.5 cursor-pointer text-sm font-medium text-foreground hover:bg-muted/50 transition-colors flex items-center justify-between">
                {t(`faq.q${i}`)}
                <span className="text-foreground/40 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="px-5 pb-4 text-sm text-foreground/70 leading-relaxed border-t border-border pt-3">
                {t(`faq.a${i}`)}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Privacy Policy */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <GameIcon name="privacy" size={20} /> {t('faq.privacy_title')}
        </h2>
        <div className="bg-card border border-border rounded-2xl p-5 text-sm text-foreground/70 leading-relaxed space-y-3">
          <p>{t('faq.privacy_intro')}</p>

          <h3 className="font-semibold text-foreground/90 pt-2">{t('faq.privacy_collect_title')}</h3>
          <p>{t('faq.privacy_collect')}</p>

          <h3 className="font-semibold text-foreground/90 pt-2">{t('faq.privacy_use_title')}</h3>
          <p>{t('faq.privacy_use')}</p>

          <h3 className="font-semibold text-foreground/90 pt-2">{t('faq.privacy_storage_title')}</h3>
          <p>{t('faq.privacy_storage')}</p>

          <h3 className="font-semibold text-foreground/90 pt-2">{t('faq.privacy_third_title')}</h3>
          <p>{t('faq.privacy_third')}</p>

          <h3 className="font-semibold text-foreground/90 pt-2">{t('faq.privacy_rights_title')}</h3>
          <p>{t('faq.privacy_rights')}</p>

          <p className="text-foreground/50 pt-2 text-xs">{t('faq.privacy_updated')}</p>
        </div>
      </section>
    </div>
  );
};

export default FaqTab;
