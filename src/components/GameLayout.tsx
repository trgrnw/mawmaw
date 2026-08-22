import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGame, formatMoney } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nContext';
import { supabase } from '@/integrations/supabase/client';
import { assetUrl } from '@/lib/assets';
import { toast } from 'sonner';
import GameIcon from '@/components/GameIcon';
import EarningTab from '@/components/tabs/EarningTab';
import UpgradeTab from '@/components/tabs/UpgradeTab';
import BusinessTab from '@/components/tabs/BusinessTab';
import ShopTab from '@/components/tabs/ShopTab';
import AccessoriesTab from '@/components/tabs/AccessoriesTab';
import InvestmentsTab from '@/components/tabs/InvestmentsTab';
import ProfileTab from '@/components/tabs/ProfileTab';
import ForbesTab from '@/components/tabs/ForbesTab';
import SettingsTab from '@/components/tabs/SettingsTab';
import AuthorsTab from '@/components/tabs/AuthorsTab';
import CasinoTab from '@/components/tabs/CasinoTab';
import FaqTab from '@/components/tabs/FaqTab';
import AchievementsTab from '@/components/tabs/AchievementsTab';
import MarketTab from '@/components/tabs/MarketTab';
import ClansTab from '@/components/tabs/ClansTab';
import SupportTab from '@/components/tabs/SupportTab';
import NotificationsTab from '@/components/tabs/NotificationsTab';

type TabId = 'earning' | 'upgrade' | 'business' | 'shop' | 'accessories' | 'investments' | 'casino' | 'market' | 'notifications' | 'clans' | 'profile' | 'forbes' | 'achievements' | 'settings' | 'authors' | 'faq' | 'support';

const mainMenuItems: { id: TabId; i18nKey: string; icon: string }[] = [
  { id: 'earning', i18nKey: 'nav.earning', icon: 'earning' },
  { id: 'upgrade', i18nKey: 'nav.upgrade', icon: 'upgrade' },
  { id: 'business', i18nKey: 'nav.business', icon: 'business' },
  { id: 'shop', i18nKey: 'nav.shop', icon: 'shop' },
  { id: 'accessories', i18nKey: 'nav.accessories', icon: 'accessories' },
  { id: 'investments', i18nKey: 'nav.investments', icon: 'investments' },
  { id: 'casino', i18nKey: 'nav.casino', icon: 'casino' },
  { id: 'market', i18nKey: 'nav.market', icon: 'market' },
  { id: 'notifications', i18nKey: 'nav.notifications', icon: 'notifications' },
  { id: 'clans', i18nKey: 'nav.clans', icon: 'users' },
  { id: 'profile', i18nKey: 'nav.profile', icon: 'profile' },
  { id: 'forbes', i18nKey: 'nav.forbes', icon: 'forbes' },
  { id: 'achievements', i18nKey: 'nav.achievements', icon: 'star' },
];

const bottomMenuItems: { id: TabId; i18nKey: string; icon: string }[] = [
  { id: 'support', i18nKey: 'nav.support', icon: 'faq' },
  { id: 'settings', i18nKey: 'nav.settings', icon: 'settings' },
  { id: 'authors', i18nKey: 'nav.authors', icon: 'authors' },
  { id: 'faq', i18nKey: 'nav.faq', icon: 'faq' },
];

const tabComponents: Record<TabId, React.FC> = {
  earning: EarningTab,
  upgrade: UpgradeTab,
  business: BusinessTab,
  shop: ShopTab,
  accessories: AccessoriesTab,
  investments: InvestmentsTab,
  profile: ProfileTab,
  forbes: ForbesTab,
  achievements: AchievementsTab,
  casino: CasinoTab,
  market: MarketTab,
  notifications: NotificationsTab,
  clans: ClansTab,
  support: SupportTab,
  settings: SettingsTab,
  authors: AuthorsTab,
  faq: FaqTab,
};

const GameLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('earning');
  const [isStaff, setIsStaff] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const { balance, playerXp, playerLevel, levelStartXp, nextLevelXp, levelProgress } = useGame();
  const { user, username } = useAuth();
  const { t } = useI18n();
  const ActiveComponent = tabComponents[activeTab];

  useEffect(() => {
    if (!user) {
      setIsStaff(false);
      return;
    }
    const checkStaff = async () => {
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      setIsStaff(data && data.length > 0);
    };
    checkStaff();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotificationCount(0);
      return;
    }
    const loadCount = async () => {
      const { count } = await supabase
        .from('clan_invites')
        .select('id', { count: 'exact', head: true })
        .eq('invitee_id', user.id)
        .eq('status', 'pending');
      setNotificationCount(count || 0);
    };
    loadCount();
    window.addEventListener('notifications-changed', loadCount);
    const channel = supabase
      .channel(`layout-notifications-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clan_invites', filter: `invitee_id=eq.${user.id}` }, loadCount)
      .subscribe();
    return () => {
      window.removeEventListener('notifications-changed', loadCount);
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { amount, hours, mins } = (e as CustomEvent).detail || {};
      if (!amount) return;
      const time = hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`;
      toast.success(`Оффлайн-доход: $${formatMoney(amount)}`, {
        description: `Начислено за ${time} отсутствия (макс 12ч)`,
        duration: 6000,
      });
    };
    window.addEventListener('offline-income', handler);
    return () => window.removeEventListener('offline-income', handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const { level, reward } = (event as CustomEvent).detail || {};
      if (!level) return;
      toast.success(`Новый уровень: ${level}!`, {
        description: `Награда за развитие: $${formatMoney(reward || 0)}`,
        duration: 6000,
      });
    };
    window.addEventListener('player-level-up', handler);
    return () => window.removeEventListener('player-level-up', handler);
  }, []);

  const renderMenuButton = (item: { id: TabId; i18nKey: string; icon: string }) => (
    <button
      key={item.id}
      onClick={() => setActiveTab(item.id)}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
        activeTab === item.id
          ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
          : 'text-foreground/80 hover:bg-sidebar-btn-hover'
      }`}
    >
      <GameIcon name={item.icon} size={18} themed />
      <span>{t(item.i18nKey)}</span>
      {item.id === 'notifications' && notificationCount > 0 && (
        <span className="ml-auto min-w-5 rounded-full bg-violet-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">{notificationCount > 99 ? '99+' : notificationCount}</span>
      )}
    </button>
  );

  return (
    <div className="flex min-h-screen w-full">
      <aside className="sidebar-gradient w-56 flex-shrink-0 flex flex-col p-3 gap-1.5 overflow-y-auto sticky top-0 h-screen">
        {/* Logo & Balance */}
        <div className="px-3 py-4 mb-2 flex items-center gap-3">
          <img src={assetUrl('/images/logo.png')} alt="Logo" className="w-10 h-10" />
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-foreground leading-tight">Financial Clicker</h1>
            <p className="text-[10px] text-foreground/50">Business Empire</p>
          </div>
        </div>
        <div className="px-3 -mt-3 mb-2">
          <p className="font-mono-game text-xs text-foreground/70">${formatMoney(balance)}</p>
          {user && (
            <p className="text-xs text-foreground/50 mt-0.5 truncate flex items-center gap-1">
              <GameIcon name="profile" size={12} /> {username}
            </p>
          )}
          <div className="mt-3" title={`${playerXp} / ${nextLevelXp} XP`}>
            <div className="mb-1 flex items-center justify-between text-[10px] text-foreground/60">
              <span>Уровень {playerLevel}</span>
              <span>{playerXp - levelStartXp}/{nextLevelXp - levelStartXp} XP</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, levelProgress * 100))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Main menu */}
        {mainMenuItems.map(renderMenuButton)}

        {/* Divider */}
        <div className="my-2 mx-3 border-t border-foreground/10" />

        {/* Bottom section */}
        {bottomMenuItems.map(renderMenuButton)}

        {/* Staff & auth */}
        <div className="mt-auto space-y-1">
          {isStaff && (
            <Link
              to="/admin"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-yellow-600 dark:text-yellow-400 hover:bg-sidebar-btn-hover"
            >
              <GameIcon name="admin" size={18} themed />
              <span>Центр управления</span>
            </Link>
          )}
          {!user && (
            <Link
              to="/auth"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-foreground/80 hover:bg-sidebar-btn-hover"
            >
              <GameIcon name="login" size={18} />
              <span>{t('auth.login')}</span>
            </Link>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <ActiveComponent />
      </main>
    </div>
  );
};

export default GameLayout;
