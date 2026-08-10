import React from 'react';
import { Sun, Moon, Globe, LogOut, Pencil, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/context/AuthContext';
import GameIcon from '@/components/GameIcon';
import type { Locale } from '@/i18n/translations';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { withTimeout } from '@/lib/async';

const LANGUAGES: { code: Locale; name: string; flag: string }[] = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'cn', name: '中文', flag: '🇨🇳' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
];

const SettingsTab: React.FC = () => {
  const { locale, setLocale, t } = useI18n();
  const { user, signOut, username, changeNickname } = useAuth();
  const [editingNickname, setEditingNickname] = React.useState(false);
  const [nicknameInput, setNicknameInput] = React.useState(username);
  const [nicknameSaving, setNicknameSaving] = React.useState(false);

  React.useEffect(() => setNicknameInput(username), [username]);

  const saveNickname = async () => {
    const nickname = nicknameInput.trim().replace(/\s+/g, ' ');
    if (nickname.length < 3 || nickname.length > 24) {
      toast.error(t('settings.nickname.invalid'));
      return;
    }
    if (nickname === username) {
      setEditingNickname(false);
      return;
    }
    setNicknameSaving(true);
    try {
      const result = await withTimeout(
        changeNickname(nickname),
        8_000,
        t('settings.nickname.timeout'),
      );
      if (result.error) throw new Error(result.error);
      setEditingNickname(false);
      toast.success(t('settings.nickname.success'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.nickname.error');
      toast.error(message.toLowerCase().includes('already taken') ? t('settings.nickname.taken') : message);
    } finally {
      setNicknameSaving(false);
    }
  };

  const [theme, setThemeState] = React.useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <GameIcon name="settings" size={24} />
          {t('nav.settings')}
        </h2>
        <p className="text-muted-foreground text-sm">
          {user ? <span className="flex items-center gap-1"><GameIcon name="profile" size={14} /> {username}</span> : ''}
        </p>
      </div>

      {/* Account */}
      {user ? (
        <div className="bg-card rounded-2xl border p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{username}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm text-destructive hover:bg-destructive/10 transition-all"
            >
              <LogOut className="w-4 h-4" />
              {t('auth.logout')}
            </button>
          </div>
          {editingNickname ? (
            <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
              <label className="text-xs font-medium text-muted-foreground">{t('settings.nickname.label')}</label>
              <Input
                value={nicknameInput}
                onChange={event => setNicknameInput(event.target.value.slice(0, 24))}
                onKeyDown={event => event.key === 'Enter' && saveNickname()}
                placeholder={t('settings.nickname.placeholder')}
                disabled={nicknameSaving}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">{t('settings.nickname.hint')}</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setEditingNickname(false); setNicknameInput(username); }} disabled={nicknameSaving} className="px-3 py-1.5 rounded-lg border text-xs">
                  {t('settings.nickname.cancel')}
                </button>
                <button onClick={saveNickname} disabled={nicknameSaving} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs flex items-center gap-1.5 disabled:opacity-50">
                  {nicknameSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                  {t('settings.nickname.save')}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setEditingNickname(true)} className="flex items-center gap-2 text-xs text-primary hover:underline">
              <Pencil className="w-3 h-3" /> {t('settings.nickname.change')}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-2xl border p-5">
          <a href="/auth" className="text-sm text-primary hover:underline">
            {t('auth.login')} / {t('auth.signup')} →
          </a>
        </div>
      )}

      {/* Theme */}
      <div className="bg-card rounded-2xl border p-5 space-y-4">
        <div className="flex items-center gap-3">
          {theme === 'light' ? <Sun className="w-5 h-5 text-foreground" /> : <Moon className="w-5 h-5 text-foreground" />}
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t('settings.theme')}</h3>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setThemeState('light')}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
              theme === 'light' ? 'bg-primary/15 border-primary text-foreground' : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50'
            }`}
          >
            <Sun className="w-4 h-4" /> {t('settings.theme.light')}
          </button>
          <button
            onClick={() => setThemeState('dark')}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
              theme === 'dark' ? 'bg-primary/15 border-primary text-foreground' : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50'
            }`}
          >
            <Moon className="w-4 h-4" /> {t('settings.theme.dark')}
          </button>
        </div>
      </div>

      {/* Language */}
      <div className="bg-card rounded-2xl border p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">{t('settings.language')}</h3>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => setLocale(lang.code)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left ${
                locale === lang.code ? 'bg-primary/15 border-primary text-foreground' : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <span className="text-lg">{lang.flag}</span>
              <span>{lang.name}</span>
              {locale === lang.code && <span className="ml-auto text-primary text-xs">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-card rounded-2xl border p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <GameIcon name="faq" size={16} /> {t('settings.about')}
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('settings.version')}</span>
            <span className="font-mono-game text-foreground">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('settings.engine')}</span>
            <span className="font-mono-game text-foreground">React + Vite</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
