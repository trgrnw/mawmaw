import React, { useState, useEffect } from 'react';
import { useGame, formatMoney } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nContext';
import { supabase } from '@/integrations/supabase/client';
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

type TabId = 'earning' | 'upgrade' | 'business' | 'shop' | 'accessories' | 'investments' | 'casino' | 'market' | 'clans' | 'profile' | 'forbes' | 'achievements' | 'settings' | 'authors' | 'faq' | 'support';

const mainMenuItems: { id: TabId; i18nKey: string; icon: string }[] = [
  { id: 'earning', i18nKey: 'nav.earning', icon: 'earning' },
  { id: 'upgrade', i18nKey: 'nav.upgrade', icon: 'upgrade' },
  { id: 'business', i18nKey: 'nav.business', icon: 'business' },
  { id: 'shop', i18nKey: 'nav.shop', icon: 'shop' },
  { id: 'accessories', i18nKey: 'nav.accessories', icon: 'accessories' },
  { id: 'investments', i18nKey: 'nav.investments', icon: 'investments' },
  { id: 'casino', i18nKey: 'nav.casino', icon: 'casino' },
  { id: 'market', i18nKey: 'nav.market', icon: 'market' },
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
  clans: ClansTab,
  support: SupportTab,
  settings: SettingsTab,
  authors: AuthorsTab,
  faq: FaqTab,
};

const GameLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('earning');
  const [isStaff, setIsStaff] = useState(false);
  const { balance } = useGame();
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
    const handler = (e: Event) => {
      const { amount, hours, mins } = (e as CustomEvent).detail || {};
      if (!amount) return;
      const time = hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`;
      toast.success(`💰 Оффлайн-доход: $${formatMoney(amount)}`, {
        description: `Начислено за ${time} отсутствия (макс 12ч)`,
        duration: 6000,
      });
    };
    window.addEventListener('offline-income', handler);
    return () => window.removeEventListener('offline-income', handler);
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
    </button>
  );

  return (
    <div className="flex min-h-screen w-full">
      <aside className="sidebar-gradient w-56 flex-shrink-0 flex flex-col p-3 gap-1.5 overflow-y-auto sticky top-0 h-screen">
        {/* Logo & Balance */}
        <div className="px-3 py-4 mb-2 flex items-center gap-3">
          <img src="/images/logo.png" alt="Logo" className="w-10 h-10" />
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
            <a
              href="/admin"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-yellow-600 dark:text-yellow-400 hover:bg-sidebar-btn-hover"
            >
              <GameIcon name="admin" size={18} themed />
              <span>Админка</span>
            </a>
          )}
          {!user && (
            <a
              href="/auth"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-foreground/80 hover:bg-sidebar-btn-hover"
            >
              <GameIcon name="login" size={18} />
              <span>{t('auth.login')}</span>
            </a>
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
