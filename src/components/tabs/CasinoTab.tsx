import React, { useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import GameIcon from '@/components/GameIcon';
import RocketGame from '@/components/casino/RocketGame';
import MinesGame from '@/components/casino/MinesGame';
import CoinFlipGame from '@/components/casino/CoinFlipGame';
import DailyWheelGame from '@/components/casino/DailyWheelGame';

type CasinoView = 'hub' | 'rocket' | 'mines' | 'coinflip' | 'wheel';

const games = [
  {
    id: 'rocket' as const,
    icon: 'rocket',
    i18nKey: 'casino.rocket',
    descKey: 'casino.rocket_desc',
    gradient: 'from-orange-500/20 to-red-500/20',
    border: 'border-orange-500/30',
    hoverBg: 'hover:from-orange-500/30 hover:to-red-500/30',
  },
  {
    id: 'mines' as const,
    icon: 'bomb',
    i18nKey: 'casino.mines',
    descKey: 'casino.mines_desc',
    gradient: 'from-emerald-500/20 to-teal-500/20',
    border: 'border-emerald-500/30',
    hoverBg: 'hover:from-emerald-500/30 hover:to-teal-500/30',
  },
  {
    id: 'coinflip' as const,
    icon: 'coinflip',
    i18nKey: 'casino.coinflip',
    descKey: 'casino.coinflip_desc',
    gradient: 'from-amber-500/20 to-yellow-500/20',
    border: 'border-amber-500/30',
    hoverBg: 'hover:from-amber-500/30 hover:to-yellow-500/30',
  },
  {
    id: 'wheel' as const,
    icon: 'gift',
    i18nKey: 'casino.wheel',
    descKey: 'casino.wheel_desc',
    gradient: 'from-purple-500/20 to-pink-500/20',
    border: 'border-purple-500/30',
    hoverBg: 'hover:from-purple-500/30 hover:to-pink-500/30',
  },
];

const CasinoTab: React.FC = () => {
  const [view, setView] = useState<CasinoView>('hub');
  const { t } = useI18n();

  if (view === 'rocket') return <RocketGame onBack={() => setView('hub')} />;
  if (view === 'mines') return <MinesGame onBack={() => setView('hub')} />;
  if (view === 'coinflip') return <CoinFlipGame onBack={() => setView('hub')} />;
  if (view === 'wheel') return <DailyWheelGame onBack={() => setView('hub')} />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <GameIcon name="casino" size={24} themed />
          {t('casino.title')}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t('casino.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {games.map(game => (
          <button
            key={game.id}
            onClick={() => setView(game.id)}
            className={`group relative overflow-hidden rounded-2xl border ${game.border} bg-gradient-to-br ${game.gradient} ${game.hoverBg} p-8 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg`}
          >
            <div className="mb-4"><GameIcon name={game.icon} size={56} themed /></div>
            <h3 className="text-xl font-bold text-foreground mb-2">{t(game.i18nKey)}</h3>
            <p className="text-sm text-muted-foreground">{t(game.descKey)}</p>
            <div className="absolute top-4 right-4 text-xs font-mono text-muted-foreground/50">
              {game.id === 'wheel' ? 'DAILY' : game.id === 'mines' ? 'SOLO' : 'ONLINE'}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CasinoTab;
