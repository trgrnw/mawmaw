import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import GameIcon from '@/components/GameIcon';

const socialLinks = [
  { name: 'Telegram', icon: 'telegram', url: 'https://t.me/trgrnw', color: 'hsl(200, 70%, 55%)' },
  { name: 'VK', icon: 'vk', url: 'https://vk.com/trgrnw', color: 'hsl(215, 60%, 50%)' },
  { name: 'Steam', icon: 'steam', url: 'https://steamcommunity.com/id/trgrnw', color: 'hsl(210, 20%, 35%)' },
  { name: 'YouTube', icon: 'youtube', url: 'https://youtube.com/@trgrnw', color: 'hsl(0, 70%, 50%)' },
];

const AuthorsTab: React.FC = () => {
  const { t } = useI18n();
  return (
  <div className="max-w-xl mx-auto space-y-6">
    <div>
      <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
        <GameIcon name="authors" size={24} themed />
        {t('authors.title')}
      </h2>
      <p className="text-muted-foreground text-sm">{t('authors.subtitle')}</p>
    </div>

    <div className="bg-card rounded-2xl border p-8 text-center space-y-6">
      <div className="w-24 h-24 rounded-full mx-auto flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(197, 71%, 73%), hsl(195, 53%, 79%))' }}>
        <GameIcon name="gamepad" size={48} color="hsl(210, 20%, 15%)" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-foreground">Clicker Tycoon</h3>
        <p className="text-muted-foreground text-sm mt-1">{t('authors.game_desc')}</p>
      </div>

      <div className="h-px bg-border" />

      <div className="space-y-2">
        <p className="font-semibold text-foreground">trgrnw</p>
        <p className="text-muted-foreground text-sm">{t('authors.dev')}</p>
      </div>

      {/* Social links */}
      <div className="grid grid-cols-2 gap-3">
        {socialLinks.map(link => (
          <a
            key={link.name}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-muted/30 hover:bg-muted/60 transition-all group"
          >
            <GameIcon name={link.icon} size={20} color={link.color} />
            <div className="text-left flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{link.name}</p>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </a>
        ))}
      </div>

      <div className="h-px bg-border" />

      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">{t('authors.made_with')}</p>
        <p className="text-xs text-muted-foreground">Version 1.0.0 • 2026</p>
      </div>
    </div>
  </div>
  );
};

export default AuthorsTab;
