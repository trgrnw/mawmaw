import React, { useState, useCallback, useRef } from 'react';
import { useGame, formatMoney } from '@/context/GameContext';
import { useI18n } from '@/i18n/I18nContext';
import BankCard from '@/components/BankCard';
import GameIcon from '@/components/GameIcon';

interface FloatingCoin {
  id: number;
  x: number;
  y: number;
  value: number;
}

const EarningTab: React.FC = () => {
  const { click, clickPower, passiveIncome, hourlyIncome, hourlyIncomeRent, hourlyIncomeBusiness, hourlyIncomeDividends } = useGame();
  const { t } = useI18n();
  const [coins, setCoins] = useState<FloatingCoin[]>([]);
  const coinId = useRef(0);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    click();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = coinId.current++;
    setCoins(prev => [...prev, { id, x, y, value: clickPower }]);
    setTimeout(() => setCoins(prev => prev.filter(c => c.id !== id)), 800);
  }, [click, clickPower]);

  const hasPassive = hourlyIncome > 0;

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <GameIcon name="earning" size={24} themed />
          {t('earning.title')}
        </h2>
        <p className="text-muted-foreground text-sm">{t('earning.subtitle')}</p>
      </div>

      <BankCard />

      {hasPassive && (
        <div className="stat-card rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <GameIcon name="passive" size={28} themed />
            <div>
              <p className="text-sm text-muted-foreground">{t('earning.passive')}</p>
              <p className="font-mono-game font-semibold text-foreground">+${formatMoney(hourlyIncome)}{t('earning.per_hour')}</p>
              <p className="font-mono-game text-xs text-muted-foreground">≈ ${formatMoney(passiveIncome)}{t('earning.per_sec')}</p>
            </div>
          </div>

          {/* Income breakdown */}
          <div className="border-t border-border/50 pt-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">{t('earning.breakdown')}</p>
            {hourlyIncomeRent > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5"><GameIcon name="rent" size={14} themed /> {t('earning.rent')}</span>
                <span className="font-mono-game text-foreground">+${formatMoney(hourlyIncomeRent)}{t('earning.per_hour')} <span className="text-xs text-muted-foreground">≈ ${formatMoney(hourlyIncomeRent / 3600)}{t('earning.per_sec')}</span></span>
              </div>
            )}
            {hourlyIncomeBusiness > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5"><GameIcon name="business" size={14} themed /> {t('earning.business')}</span>
                <span className="font-mono-game text-foreground">+${formatMoney(hourlyIncomeBusiness)}{t('earning.per_hour')} <span className="text-xs text-muted-foreground">≈ ${formatMoney(hourlyIncomeBusiness / 3600)}{t('earning.per_sec')}</span></span>
              </div>
            )}
            {hourlyIncomeDividends > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5"><GameIcon name="dividends" size={14} themed /> {t('earning.dividends')}</span>
                <span className="font-mono-game text-foreground">+${formatMoney(hourlyIncomeDividends)}{t('earning.per_hour')} <span className="text-xs text-muted-foreground">≈ ${formatMoney(hourlyIncomeDividends / 3600)}{t('earning.per_sec')}</span></span>
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className="relative click-area-pulse border-2 border-dashed rounded-2xl h-52 flex flex-col items-center justify-center cursor-pointer transition-transform active:scale-[0.98] hover:border-sky-400"
        onClick={handleClick}
      >
        <span className="mb-3 pointer-events-none"><GameIcon name="click" size={48} themed /></span>
        <p className="text-muted-foreground pointer-events-none text-center px-4">
          {t('earning.click_area')}
        </p>
        <p className="text-xs text-muted-foreground mt-2 font-mono-game pointer-events-none">
          +${formatMoney(clickPower)} {t('earning.per_click')}
        </p>

        {coins.map(coin => (
          <span
            key={coin.id}
            className="coin-float absolute text-sm font-bold pointer-events-none"
            style={{ left: coin.x, top: coin.y, color: 'hsl(var(--success))' }}
          >
            +${formatMoney(coin.value)}
          </span>
        ))}
      </div>
    </div>
  );
};

export default EarningTab;
