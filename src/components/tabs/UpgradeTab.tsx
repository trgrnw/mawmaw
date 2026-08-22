import React from 'react';
import { useGame, formatMoney } from '@/context/GameContext';
import { useI18n } from '@/i18n/I18nContext';
import GameIcon from '@/components/GameIcon';

const UpgradeTab: React.FC = () => {
  const { upgrades, buyUpgrade, balance, clickPower } = useGame();
  const { t } = useI18n();
  const upgradeIcon = (id: string) => id === 'click-power' ? 'click' : id === 'autoclicker' ? 'gamepad' : id === 'auto-taxes' ? 'taxes' : 'upgrade';

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <GameIcon name="upgrade" size={24} themed />
          {t('upgrade.title')}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t('upgrade.click_power')}: <span className="font-mono-game font-semibold text-foreground">${formatMoney(clickPower)}</span>
        </p>
      </div>

      <div className="space-y-4">
        {upgrades.map(up => {
          const isMaxed = up.currentLevel >= up.maxLevel;
          const nextLevel = !isMaxed ? up.levels[up.currentLevel] : null;
          const canAfford = nextLevel ? balance >= nextLevel.cost : false;
          const totalBonus = up.levels.slice(0, up.currentLevel).reduce((s, l) => s + l.bonus, 0);
          const isClickPower = up.id === 'click-power';
          const nameKey = `upgrade.${up.id.replace('-', '_')}_name`;
          const descKey = `upgrade.${up.id.replace('-', '_')}_desc`;

          return (
            <div
              key={up.id}
              className={`stat-card rounded-2xl p-5 border transition-all ${
                isMaxed
                  ? 'border-border opacity-70'
                  : canAfford
                  ? 'border-sky-300 hover:shadow-lg cursor-pointer hover:border-sky-400'
                  : 'border-border opacity-80'
              }`}
              onClick={() => !isMaxed && buyUpgrade(up.id)}
            >
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <GameIcon name={upgradeIcon(up.id)} size={30} themed />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-foreground text-base">{t(nameKey)}</h3>
                    {isMaxed ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'hsl(var(--success) / 0.15)', color: 'hsl(var(--success))' }}>
                        {t('upgrade.max')}
                      </span>
                    ) : (
                      <span className="font-mono-game text-sm font-semibold text-foreground">
                        ${formatMoney(nextLevel!.cost)}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground mb-2">{t(descKey)}</p>

                  {/* Progress bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${(up.currentLevel / up.maxLevel) * 100}%`,
                          background: 'linear-gradient(90deg, hsl(var(--sky-300)), hsl(var(--sky-500)))',
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono-game text-muted-foreground whitespace-nowrap">
                      {up.currentLevel}/{up.maxLevel}
                    </span>
                  </div>

                  {/* Stats */}
                  {isClickPower && <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>
                      {t('upgrade.bonus')}: <span className="font-mono-game text-foreground">
                        +${totalBonus}{t('upgrade.per_click')}
                      </span>
                    </span>
                    {!isMaxed && nextLevel && (
                      <span>
                        {t('upgrade.next')}: <span className="font-mono-game text-foreground">
                          +${nextLevel.bonus}
                        </span>
                      </span>
                    )}
                  </div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UpgradeTab;
