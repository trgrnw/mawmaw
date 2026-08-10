import React from 'react';
import { useGame, formatMoney } from '@/context/GameContext';
import { useI18n } from '@/i18n/I18nContext';

const BankCard: React.FC = () => {
  const { balance } = useGame();
  const { t } = useI18n();

  return (
    <div className="bank-card-gradient relative w-full max-w-[420px] aspect-[1.6/1] rounded-2xl p-6 flex flex-col justify-between overflow-hidden">
      {/* Holographic overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          background: 'linear-gradient(125deg, transparent 30%, rgba(255,255,255,0.3) 45%, transparent 55%, rgba(255,255,255,0.15) 70%, transparent 80%)',
        }}
      />
      
      {/* Chip */}
      <div className="flex items-start justify-between">
        <div className="w-12 h-9 rounded-md bg-gradient-to-br from-yellow-300/80 to-yellow-500/60 border border-yellow-400/30 flex items-center justify-center">
          <div className="w-8 h-5 border border-yellow-600/30 rounded-sm" />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold tracking-wider" style={{ color: 'hsl(195, 53%, 79%)' }}>CLICKER</span>
          <span className="text-sm font-light tracking-wider" style={{ color: 'hsl(195, 53%, 70%)' }}>BANK</span>
        </div>
      </div>

      {/* Card number */}
      <div className="font-mono-game text-lg tracking-[0.2em] mt-2" style={{ color: 'hsl(195, 53%, 82%)' }}>
        •••• •••• •••• 4242
      </div>

      {/* Balance */}
      <div className="mt-auto">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'hsl(195, 53%, 65%)' }}>{t('bank.balance')}</p>
        <p className="font-mono-game text-3xl font-bold balance-glow" style={{ color: 'hsl(0, 0%, 100%)' }}>
          ${formatMoney(balance)}
        </p>
      </div>

      {/* Contactless icon */}
      <div className="absolute top-6 right-20 opacity-30">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="hsl(195, 53%, 80%)" strokeWidth="2">
          <path d="M6.5 12C6.5 8.96 8.96 6.5 12 6.5" />
          <path d="M3 12C3 7.03 7.03 3 12 3" />
          <path d="M10 12C10 10.9 10.9 10 12 10" />
        </svg>
      </div>

      {/* Decorative circles */}
      <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full opacity-10" style={{ background: 'hsl(195, 53%, 80%)' }} />
      <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-5" style={{ background: 'hsl(195, 53%, 90%)' }} />
    </div>
  );
};

export default BankCard;
