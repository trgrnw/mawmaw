import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RoleRow {
  id: string;
  user_id: string;
  role: string;
  username: string;
}

const AdminRolesTab: React.FC = () => {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; username: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [searchUser, setSearchUser] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setError('');
    const { data: rolesData, error: rolesError } = await supabase.from('user_roles').select('*');
    const { data: profilesData, error: profilesError } = await supabase.from('profiles').select('user_id, username');

    if (rolesError || profilesError) { setError(rolesError?.message || profilesError?.message || 'Ошибка загрузки'); return; }
    if (profilesData) setProfiles(profilesData);

    if (rolesData && profilesData) {
      const merged = rolesData.map(r => ({
        ...r,
        username: profilesData.find(p => p.user_id === r.user_id)?.username || 'Unknown',
      }));
      setRoles(merged);
    }
  };

  const addRole = async () => {
    if (!selectedUser || !selectedRole || busy) return;
    if (roles.some(row => row.user_id === selectedUser && row.role === selectedRole)) { toast.info('Такая роль уже назначена'); return; }
    setBusy(true);

    const { error } = await supabase.rpc('admin_manage_role', { p_user_id: selectedUser, p_role: selectedRole, p_remove: false });
    if (error) { setBusy(false); toast.error(error.message); return; }
    toast.success('Роль назначена');
    setBusy(false);
    setSelectedUser('');
    setSelectedRole('');
    loadData();
  };

  const removeRole = async (id: string, targetUserId: string, role: string) => {
    if (busy) return;
    if (targetUserId === user?.id && role === 'owner') { toast.error('Нельзя снять собственную роль владельца через панель'); return; }
    if (!confirm(`Удалить роль ${role}?`)) return;
    setBusy(true);

    const { error } = await supabase.rpc('admin_manage_role', { p_user_id: targetUserId, p_role: role, p_remove: true });
    if (error) { setBusy(false); toast.error(error.message); return; }
    toast.success('Роль удалена');
    setBusy(false);
    loadData();
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400';
      case 'admin': return 'bg-red-500/20 text-red-600 dark:text-red-400';
      case 'moderator': return 'bg-blue-500/20 text-blue-600 dark:text-blue-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const filteredProfiles = profiles.filter(p =>
    p.username.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">👑 Управление ролями</h2>

      {error && <p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Назначить роль</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Поиск игрока..."
            value={searchUser}
            onChange={e => setSearchUser(e.target.value)}
          />
          <div className="flex gap-2">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Выберите игрока" />
              </SelectTrigger>
              <SelectContent>
                {filteredProfiles.map(p => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Роль" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={addRole} disabled={busy || !selectedUser || !selectedRole}>
              Назначить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Текущие роли</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {roles.length === 0 ? (
            <p className="text-muted-foreground">Нет назначенных ролей</p>
          ) : (
            roles.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{r.username}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getRoleBadge(r.role)}`}>
                    {r.role}
                  </span>
                </div>
                <Button variant="ghost" size="sm" disabled={busy || (r.user_id === user?.id && r.role === 'owner')} onClick={() => removeRole(r.id, r.user_id, r.role)}>
                  ❌
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminRolesTab;
