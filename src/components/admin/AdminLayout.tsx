import AdminReleasesTab from './tabs/AdminReleasesTab';
import AdminOverviewTab from './tabs/AdminOverviewTab';
import { Search, ShieldCheck, ChevronRight, ArrowLeft, LogOut } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { type AppRole } from '@/hooks/useAdminAuth';
import { useAuth } from '@/context/AuthContext';
import AdminPlayersTab from './tabs/AdminPlayersTab';
import AdminEconomyTab from './tabs/AdminEconomyTab';
import AdminCasinoTab from './tabs/AdminCasinoTab';
import AdminAnnouncementsTab from './tabs/AdminAnnouncementsTab';
import AdminRolesTab from './tabs/AdminRolesTab';
import AdminLogsTab from './tabs/AdminLogsTab';
import AdminTransactionsTab from './tabs/AdminTransactionsTab';
import AdminBansTab from './tabs/AdminBansTab';
import AdminTicketsTab from './tabs/AdminTicketsTab';
import AdminReportsTab from './tabs/AdminReportsTab';
import { Button } from '@/components/ui/button';
import GameIcon from '@/components/GameIcon';

type AdminTab = 'overview' | 'releases' | 'players' | 'economy' | 'casino' | 'announcements' | 'roles' | 'logs' | 'transactions' | 'bans' | 'tickets' | 'reports';

interface AdminLayoutProps {
  role: AppRole;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ role }) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const canManageUsers = role === 'owner' || role === 'admin';
  const canManageEconomy = canManageUsers;
  const canManageRoles = role === 'owner';
  const canViewStats = true;
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [query,setQuery] = useState('');

  const tabs: { id: AdminTab; label: string; icon: string; allowed: boolean }[] = [
    { id: 'overview', label: 'Обзор', icon: 'admin', allowed: true },
    { id: 'releases', label: 'Лимитированные выпуски', icon: 'star', allowed: canManageUsers },
    { id: 'players', label: 'Игроки', icon: 'users', allowed: canManageUsers },
    { id: 'tickets', label: 'Поддержка', icon: 'faq', allowed: true },
    { id: 'reports', label: 'Жалобы', icon: 'logout', allowed: true },
    { id: 'transactions', label: 'Транзакции', icon: 'earning', allowed: canManageUsers },
    { id: 'bans', label: 'Баны', icon: 'logout', allowed: true },
    { id: 'economy', label: 'Экономика', icon: 'earning', allowed: canManageEconomy },
    { id: 'casino', label: 'Казино', icon: 'casino', allowed: canViewStats },
    { id: 'announcements', label: 'Объявления', icon: 'announce', allowed: canManageUsers },
    { id: 'roles', label: 'Роли', icon: 'crown', allowed: canManageRoles },
    { id: 'logs', label: 'Логи', icon: 'logs', allowed: canViewStats },
  ];

  const allowedTab = tabs.find(tab => tab.id === activeTab && tab.allowed)?.id || tabs.find(tab => tab.allowed)!.id;
  useEffect(() => { setActiveTab(allowedTab); }, [allowedTab]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const renderTab = () => {
    switch (allowedTab) {
      case 'overview':
        return <AdminOverviewTab navigate={tab=>setActiveTab(tab as AdminTab)} canManage={canManageUsers}/>;
      case 'releases':
        return <AdminReleasesTab/>;
      case 'players':
        return <AdminPlayersTab />;
      case 'tickets':
        return <AdminTicketsTab />;
      case 'reports':
        return <AdminReportsTab />;
      case 'transactions':
        return <AdminTransactionsTab />;
      case 'bans':
        return <AdminBansTab />;
      case 'economy':
        return <AdminEconomyTab />;
      case 'casino':
        return <AdminCasinoTab />;
      case 'announcements':
        return <AdminAnnouncementsTab />;
      case 'roles':
        return <AdminRolesTab />;
      case 'logs':
        return <AdminLogsTab />;
      default:
        return null;
    }
  };

  const descriptions: Record<AdminTab,string> = {
    overview:'Состояние игры и задачи команды в одном месте',releases:'Черновики, тиражи, расписание и постоянная коллекция игроков',players:'Профили, баланс и управление игровым прогрессом',tickets:'Обращения игроков, ответы команды и архив',reports:'Рассмотрение жалоб и решения модерации',transactions:'История операций и движения активов',bans:'Блокировки аккаунтов и история наказаний',economy:'Показатели игровой экономики',casino:'Ставки, результаты и история игр',announcements:'Новости, баннеры и уведомления для игроков',roles:'Доступ команды и разграничение полномочий',logs:'Аудит административных действий'
  };
  const active=tabs.find(t=>t.id===allowedTab)!;
  return <div className="admin-workspace min-h-screen bg-muted/25">
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-xl"><div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck size={21}/></span><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Financial Clicker</p><h1 className="text-sm font-semibold">Центр управления</h1></div><span className="ml-2 rounded-full border bg-card px-2.5 py-1 text-[10px] font-semibold">{role==='owner'?'Владелец':role==='admin'?'Администратор':'Модератор'}</span></div><div className="flex items-center gap-2"><span className="mr-2 hidden items-center gap-1.5 text-[10px] font-medium text-emerald-600 sm:flex"><ShieldCheck size={14}/>2FA подтверждена</span><Button variant="outline" size="sm" onClick={()=>navigate('/')} className="gap-2"><ArrowLeft size={14}/>В игру</Button><Button aria-label="Выйти из аккаунта" variant="ghost" size="sm" onClick={handleLogout}><LogOut size={16}/></Button></div></div></header>
    <div className="mx-auto flex max-w-[1800px] flex-col lg:flex-row"><aside className="border-b bg-background p-4 lg:sticky lg:top-[73px] lg:h-[calc(100vh-73px)] lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r"><div className="relative mb-5"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><input aria-label="Поиск раздела админки" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Найти раздел…" className="w-full rounded-xl border bg-muted/25 py-2.5 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary/20"/></div><p className="mb-3 px-3 text-[9px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Рабочее пространство</p><nav className="flex gap-1 overflow-x-auto lg:block lg:space-y-1">{tabs.filter(t=>t.allowed&&t.label.toLowerCase().includes(query.toLowerCase())).map(tab=><button key={tab.id} onClick={()=>setActiveTab(tab.id)} aria-current={allowedTab===tab.id?'page':undefined} className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-3 text-left text-xs font-medium transition lg:w-full ${allowedTab===tab.id?'bg-primary/10 text-primary':'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><GameIcon name={tab.icon} size={17}/><span className="flex-1">{tab.label}</span>{allowedTab===tab.id&&<ChevronRight size={13}/>}</button>)}</nav><div className="mt-8 hidden rounded-xl border bg-muted/20 p-3 lg:block"><p className="text-[10px] font-semibold">Серверная проверка прав</p><p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">Административные изменения сохраняются вместе с записью в журнал.</p></div></aside><main className="min-w-0 flex-1 p-5 sm:p-8"><div className="mx-auto max-w-[1320px]"><div className="mb-7"><div className="mb-3 flex items-center gap-2 text-[10px] text-muted-foreground"><span>Управление</span><ChevronRight size={11}/><span>{active.label}</span></div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{active.label}</h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{descriptions[allowedTab]}</p></div>{renderTab()}</div></main></div>
  </div>;
};

export default AdminLayout;
