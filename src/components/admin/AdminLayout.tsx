import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth, type AppRole } from '@/hooks/useAdminAuth';
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

type AdminTab = 'players' | 'economy' | 'casino' | 'announcements' | 'roles' | 'logs' | 'transactions' | 'bans' | 'tickets' | 'reports';

interface AdminLayoutProps {
  role: AppRole;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ role }) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { canManageUsers, canManageEconomy, canManageRoles, canViewStats } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('players');

  const tabs: { id: AdminTab; label: string; icon: string; allowed: boolean }[] = [
    { id: 'players', label: 'Игроки', icon: 'users', allowed: canManageUsers },
    { id: 'tickets', label: 'Тикеты', icon: 'faq', allowed: canManageUsers },
    { id: 'reports', label: 'Жалобы', icon: 'logout', allowed: canManageUsers },
    { id: 'transactions', label: 'Транзакции', icon: 'earning', allowed: canViewStats },
    { id: 'bans', label: 'Баны', icon: 'logout', allowed: canManageUsers },
    { id: 'economy', label: 'Экономика', icon: 'earning', allowed: canManageEconomy },
    { id: 'casino', label: 'Казино', icon: 'casino', allowed: canViewStats },
    { id: 'announcements', label: 'Объявления', icon: 'announce', allowed: canManageUsers },
    { id: 'roles', label: 'Роли', icon: 'crown', allowed: canManageRoles },
    { id: 'logs', label: 'Логи', icon: 'logs', allowed: canViewStats },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const renderTab = () => {
    switch (activeTab) {
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

  const getRoleBadgeColor = (r: AppRole) => {
    switch (r) {
      case 'owner':
        return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400';
      case 'admin':
        return 'bg-red-500/20 text-red-600 dark:text-red-400';
      case 'moderator':
        return 'bg-blue-500/20 text-blue-600 dark:text-blue-400';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold flex items-center gap-2"><GameIcon name="admin" size={22} themed /> Админ-панель</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getRoleBadgeColor(role)}`}>
              {role}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/')} className="flex items-center gap-1.5">
              <GameIcon name="gamepad" size={16} /> В игру
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="flex items-center gap-1.5">
              <GameIcon name="logout" size={16} /> Выйти
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 border-r bg-card/50 min-h-[calc(100vh-57px)] p-3 space-y-1">
          {tabs.filter(t => t.allowed).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-foreground/80 hover:bg-muted'
              }`}
            >
              <GameIcon name={tab.icon} size={18} themed />
              <span>{tab.label}</span>
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 p-6">
          {renderTab()}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
