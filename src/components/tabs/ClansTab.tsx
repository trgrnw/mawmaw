import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/context/GameContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import GameIcon from '@/components/GameIcon';
import { toast } from 'sonner';
import { Loader2, Crown, Users, MessageSquare, Coins, Shield, Trash2, LogOut, Plus, UserPlus, Send } from 'lucide-react';

interface Clan {
  id: string;
  name: string;
  tag: string;
  emoji: string;
  description: string;
  treasury: number;
  member_count: number;
  owner_id: string;
}
interface ClanRole {
  id: string;
  clan_id: string;
  name: string;
  color: string;
  rank: number;
  is_owner_role: boolean;
  perm_invite: boolean;
  perm_kick: boolean;
  perm_treasury: boolean;
  perm_edit_clan: boolean;
  perm_manage_roles: boolean;
}
interface ClanMember {
  id: string;
  user_id: string;
  role_id: string;
  joined_at: string;
  username?: string;
  avatar_emoji?: string;
  net_worth?: number;
}
interface ClanInvite {
  id: string;
  clan_id: string;
  inviter_id: string;
  invitee_id: string;
  status: string;
  created_at: string;
  clan?: Clan;
}
interface ChatMsg {
  id: string;
  user_id: string;
  username: string;
  message: string;
  created_at: string;
}
interface TreasuryLog {
  id: string;
  user_id: string;
  username: string;
  action: string;
  amount: number;
  created_at: string;
}

const PERM_LABELS: { key: keyof ClanRole; label: string }[] = [
  { key: 'perm_invite', label: 'Приглашать игроков' },
  { key: 'perm_kick', label: 'Исключать игроков' },
  { key: 'perm_treasury', label: 'Снимать с казны' },
  { key: 'perm_edit_clan', label: 'Менять название/тег' },
  { key: 'perm_manage_roles', label: 'Управлять ролями' },
];

const ClansTab: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myClan, setMyClan] = useState<Clan | null>(null);
  const [myMember, setMyMember] = useState<ClanMember | null>(null);
  const [myRole, setMyRole] = useState<ClanRole | null>(null);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [roles, setRoles] = useState<ClanRole[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [treasuryLogs, setTreasuryLogs] = useState<TreasuryLog[]>([]);
  const [invites, setInvites] = useState<ClanInvite[]>([]);
  const [allClans, setAllClans] = useState<(Clan & { total_net_worth: number; owner_name: string })[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [treasuryOpen, setTreasuryOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadAll = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    // My membership
    const { data: memberData } = await supabase
      .from('clan_members')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberData) {
      setMyMember(memberData);
      const { data: clanData } = await supabase.from('clans').select('*').eq('id', memberData.clan_id).maybeSingle();
      setMyClan(clanData);

      const { data: rolesData } = await supabase.from('clan_roles').select('*').eq('clan_id', memberData.clan_id).order('rank', { ascending: false });
      setRoles(rolesData || []);
      const myR = (rolesData || []).find(r => r.id === memberData.role_id);
      setMyRole(myR || null);

      const { data: membersData } = await supabase.from('clan_members').select('*').eq('clan_id', memberData.clan_id);
      const userIds = (membersData || []).map(m => m.user_id);
      const { data: profs } = await supabase.from('profiles').select('user_id, username, avatar_emoji').in('user_id', userIds);
      const { data: saves } = await supabase.from('game_saves').select('user_id, net_worth').in('user_id', userIds);
      const enriched: ClanMember[] = (membersData || []).map(m => ({
        ...m,
        username: profs?.find(p => p.user_id === m.user_id)?.username || 'Player',
        avatar_emoji: profs?.find(p => p.user_id === m.user_id)?.avatar_emoji || '👤',
        net_worth: saves?.find(s => s.user_id === m.user_id)?.net_worth || 0,
      }));
      setMembers(enriched.sort((a, b) => (b.net_worth || 0) - (a.net_worth || 0)));

      const { data: chatData } = await supabase.from('clan_chat_messages').select('*').eq('clan_id', memberData.clan_id).order('created_at', { ascending: true }).limit(100);
      setChat(chatData || []);

      const { data: tlogs } = await supabase.from('clan_treasury_logs').select('*').eq('clan_id', memberData.clan_id).order('created_at', { ascending: false }).limit(50);
      setTreasuryLogs(tlogs || []);
    } else {
      setMyMember(null);
      setMyClan(null);
      setMyRole(null);
      setMembers([]);
      setRoles([]);
      setChat([]);
    }

    // Pending invites for me
    const { data: invitesData } = await supabase
      .from('clan_invites')
      .select('*')
      .eq('invitee_id', user.id)
      .eq('status', 'pending');
    if (invitesData && invitesData.length > 0) {
      const cIds = invitesData.map(i => i.clan_id);
      const { data: cl } = await supabase.from('clans').select('*').in('id', cIds);
      setInvites(invitesData.map(i => ({ ...i, clan: cl?.find(c => c.id === i.clan_id) })));
    } else {
      setInvites([]);
    }

    // Top clans
    const { data: lb } = await supabase.from('clan_leaderboard').select('*').order('total_net_worth', { ascending: false }).limit(50);
    setAllClans(lb as any || []);

    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Realtime for chat & members & invites
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('clans-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clan_chat_messages' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clan_members' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clan_invites' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clans' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clan_treasury_logs' }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadAll]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  const sendMsg = async () => {
    const msg = chatMessage.trim();
    if (!msg) return;
    setChatMessage('');
    const { error } = await supabase.rpc('send_clan_message', { p_message: msg });
    if (error) toast.error(error.message);
  };

  const respondInvite = async (id: string, accept: boolean) => {
    const { error } = await supabase.rpc('respond_clan_invite', { p_invite_id: id, p_accept: accept });
    if (error) toast.error(error.message);
    else { toast.success(accept ? 'Вы вступили в клан!' : 'Приглашение отклонено'); loadAll(); }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  // ─── No clan view ───
  if (!myClan) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <Shield className="w-6 h-6" /> Кланы
          </h2>
          <p className="text-muted-foreground text-sm">Объединяйтесь с другими игроками, копите казну, поднимайтесь в рейтинге</p>
        </div>

        {invites.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserPlus className="w-4 h-4" /> Приглашения ({invites.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {invites.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{inv.clan?.emoji} [{inv.clan?.tag}] {inv.clan?.name}</p>
                    <p className="text-xs text-muted-foreground">{inv.clan?.member_count} участников</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => respondInvite(inv.id, true)}>Принять</Button>
                    <Button size="sm" variant="outline" onClick={() => respondInvite(inv.id, false)}>Отклонить</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" />Создать клан ($50,000)</Button>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Топ кланов</CardTitle></CardHeader>
          <CardContent className="p-0">
            {allClans.length === 0 ? (
              <p className="p-6 text-center text-muted-foreground">Кланов ещё нет — создайте первый!</p>
            ) : (
              <div className="divide-y">
                {allClans.map((c, i) => (
                  <div key={c.id} className="p-3 flex items-center gap-3">
                    <span className="text-sm font-bold w-6 text-center text-muted-foreground">{i + 1}</span>
                    <span className="text-2xl">{c.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">[{c.tag}] {c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.member_count} уч. · {c.owner_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono-game text-sm font-semibold">${formatMoney(c.total_net_worth)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <CreateClanDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={loadAll} />
      </div>
    );
  }

  // ─── In-clan view ───
  const isOwner = myClan.owner_id === user?.id;
  const canInvite = isOwner || myRole?.perm_invite;
  const canKick = isOwner || myRole?.perm_kick;
  const canTreasuryWithdraw = isOwner || myRole?.perm_treasury;
  const canEdit = isOwner || myRole?.perm_edit_clan;
  const canManageRoles = isOwner || myRole?.perm_manage_roles;

  const handleLeave = async () => {
    if (!confirm('Покинуть клан?')) return;
    const { error } = await supabase.rpc('leave_clan');
    if (error) toast.error(error.message); else { toast.success('Вы покинули клан'); loadAll(); }
  };

  const handleDelete = async () => {
    if (!confirm('Удалить клан? Казна вернётся вам.')) return;
    const { error } = await supabase.rpc('delete_clan');
    if (error) toast.error(error.message); else { toast.success('Клан удалён'); loadAll(); }
  };

  const handleKick = async (userId: string) => {
    if (!confirm('Исключить игрока?')) return;
    const { error } = await supabase.rpc('kick_clan_member', { p_user_id: userId });
    if (error) toast.error(error.message); else { toast.success('Игрок исключён'); loadAll(); }
  };

  const handleAssignRole = async (userId: string, roleId: string) => {
    const { error } = await supabase.rpc('assign_clan_role', { p_user_id: userId, p_role_id: roleId });
    if (error) toast.error(error.message); else { toast.success('Роль изменена'); loadAll(); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          <span className="text-5xl">{myClan.emoji}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">[{myClan.tag}] {myClan.name}</h2>
            {myClan.description && <p className="text-sm text-muted-foreground">{myClan.description}</p>}
            <div className="flex gap-3 text-xs mt-1 text-muted-foreground">
              <span><Users className="w-3 h-3 inline mr-1" />{myClan.member_count}</span>
              <span><Coins className="w-3 h-3 inline mr-1" />${formatMoney(myClan.treasury)}</span>
              <span>Моя роль: <Badge variant="outline" style={{ color: myRole?.color }}>{myRole?.name}</Badge></span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {canInvite && <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}><UserPlus className="w-4 h-4 mr-1" />Пригласить</Button>}
            <Button size="sm" variant="outline" onClick={() => setTreasuryOpen(true)}><Coins className="w-4 h-4 mr-1" />Казна</Button>
            {canEdit && <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>Настройки</Button>}
            {canManageRoles && <Button size="sm" variant="outline" onClick={() => setRolesOpen(true)}><Crown className="w-4 h-4 mr-1" />Роли</Button>}
            {!isOwner && <Button size="sm" variant="ghost" onClick={handleLeave}><LogOut className="w-4 h-4 mr-1" />Выйти</Button>}
            {isOwner && <Button size="sm" variant="destructive" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-1" />Удалить</Button>}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="chat">
        <TabsList>
          <TabsTrigger value="chat"><MessageSquare className="w-4 h-4 mr-1" />Чат</TabsTrigger>
          <TabsTrigger value="members"><Users className="w-4 h-4 mr-1" />Участники ({members.length})</TabsTrigger>
          <TabsTrigger value="treasury"><Coins className="w-4 h-4 mr-1" />История казны</TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <Card>
            <CardContent className="p-0">
              <div className="h-[450px] overflow-y-auto p-4 space-y-2">
                {chat.length === 0 ? (
                  <p className="text-center text-muted-foreground py-10">Сообщений пока нет — будьте первым!</p>
                ) : (
                  chat.map(m => (
                    <div key={m.id} className={`flex flex-col ${m.user_id === user?.id ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${m.user_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <p className="text-xs opacity-70 mb-0.5">{m.username}</p>
                        <p className="text-sm break-words">{m.message}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-0.5">{new Date(m.created_at).toLocaleTimeString()}</span>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="border-t p-3 flex gap-2">
                <Input
                  value={chatMessage}
                  onChange={e => setChatMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMsg()}
                  placeholder="Сообщение..."
                  maxLength={500}
                />
                <Button onClick={sendMsg} size="icon"><Send className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardContent className="p-0 divide-y">
              {members.map(m => {
                const memberRole = roles.find(r => r.id === m.role_id);
                const isMemberOwner = m.user_id === myClan.owner_id;
                return (
                  <div key={m.id} className="p-3 flex items-center gap-3">
                    <span className="text-2xl">{m.avatar_emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate flex items-center gap-2">
                        {m.username}
                        {isMemberOwner && <Crown className="w-3.5 h-3.5 text-yellow-500" />}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <Badge variant="outline" style={{ color: memberRole?.color }} className="mr-2">{memberRole?.name}</Badge>
                        ${formatMoney(m.net_worth || 0)}
                      </p>
                    </div>
                    {canManageRoles && !isMemberOwner && m.user_id !== user?.id && (
                      <select
                        value={m.role_id}
                        onChange={e => handleAssignRole(m.user_id, e.target.value)}
                        className="text-xs border rounded px-2 py-1 bg-background"
                      >
                        {roles.filter(r => !r.is_owner_role).map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    )}
                    {canKick && !isMemberOwner && m.user_id !== user?.id && (
                      <Button size="sm" variant="ghost" onClick={() => handleKick(m.user_id)}><Trash2 className="w-4 h-4" /></Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="treasury">
          <Card>
            <CardContent className="p-0 divide-y">
              {treasuryLogs.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">Операций пока нет</p>
              ) : (
                treasuryLogs.map(l => (
                  <div key={l.id} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {l.action === 'deposit' ? '➕ Вклад' : '➖ Снятие'} от {l.username}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</p>
                    </div>
                    <p className={`font-mono-game text-sm font-semibold ${l.action === 'deposit' ? 'text-green-500' : 'text-red-500'}`}>
                      {l.action === 'deposit' ? '+' : '-'}${formatMoney(l.amount)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EditClanDialog open={editOpen} onOpenChange={setEditOpen} clan={myClan} onUpdated={loadAll} />
      <TreasuryDialog open={treasuryOpen} onOpenChange={setTreasuryOpen} clan={myClan} canWithdraw={!!canTreasuryWithdraw} onDone={loadAll} />
      <RolesDialog open={rolesOpen} onOpenChange={setRolesOpen} roles={roles} onChanged={loadAll} />
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvited={loadAll} />
    </div>
  );
};

// ─────────── Sub-dialogs ───────────

const CreateClanDialog: React.FC<{ open: boolean; onOpenChange: (b: boolean) => void; onCreated: () => void }> = ({ open, onOpenChange, onCreated }) => {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [emoji, setEmoji] = useState('🏛️');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('create_clan', { p_name: name, p_tag: tag, p_emoji: emoji, p_description: desc });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success('Клан создан!'); onOpenChange(false); onCreated(); setName(''); setTag(''); setDesc(''); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Создание клана</DialogTitle><DialogDescription>Стоимость: $50,000</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label>Эмодзи</Label><Input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={4} /></div>
          <div><Label>Название (3-30)</Label><Input value={name} onChange={e => setName(e.target.value)} maxLength={30} /></div>
          <div><Label>Тег (2-5, A-Z)</Label><Input value={tag} onChange={e => setTag(e.target.value.toUpperCase())} maxLength={5} /></div>
          <div><Label>Описание</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} maxLength={200} /></div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy || !name || !tag}>Создать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const EditClanDialog: React.FC<{ open: boolean; onOpenChange: (b: boolean) => void; clan: Clan; onUpdated: () => void }> = ({ open, onOpenChange, clan, onUpdated }) => {
  const [name, setName] = useState(clan.name);
  const [tag, setTag] = useState(clan.tag);
  const [emoji, setEmoji] = useState(clan.emoji);
  const [desc, setDesc] = useState(clan.description);
  useEffect(() => { setName(clan.name); setTag(clan.tag); setEmoji(clan.emoji); setDesc(clan.description); }, [clan]);

  const submit = async () => {
    const { data, error } = await supabase.rpc('update_clan_info', { p_name: name, p_tag: tag, p_emoji: emoji, p_description: desc });
    if (error) toast.error(error.message);
    else {
      const cost = (data as any)?.cost || 0;
      toast.success(cost > 0 ? `Изменения сохранены ($${formatMoney(cost)})` : 'Изменения сохранены');
      onOpenChange(false); onUpdated();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Настройки клана</DialogTitle>
          <DialogDescription>Изменение названия — $10,000, изменение тега — $10,000</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Эмодзи</Label><Input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={4} /></div>
          <div><Label>Название</Label><Input value={name} onChange={e => setName(e.target.value)} maxLength={30} /></div>
          <div><Label>Тег</Label><Input value={tag} onChange={e => setTag(e.target.value.toUpperCase())} maxLength={5} /></div>
          <div><Label>Описание (бесплатно)</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} maxLength={200} /></div>
        </div>
        <DialogFooter><Button onClick={submit}>Сохранить</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const TreasuryDialog: React.FC<{ open: boolean; onOpenChange: (b: boolean) => void; clan: Clan; canWithdraw: boolean; onDone: () => void }> = ({ open, onOpenChange, clan, canWithdraw, onDone }) => {
  const [amount, setAmount] = useState('');
  const [action, setAction] = useState<'deposit' | 'withdraw'>('deposit');

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Введите сумму'); return; }
    const { error } = await supabase.rpc('clan_treasury_op', { p_action: action, p_amount: amt });
    if (error) toast.error(error.message);
    else { toast.success('Готово'); onOpenChange(false); setAmount(''); onDone(); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Казна клана</DialogTitle>
          <DialogDescription>Текущая казна: ${formatMoney(clan.treasury)}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button variant={action === 'deposit' ? 'default' : 'outline'} className="flex-1" onClick={() => setAction('deposit')}>Внести</Button>
          {canWithdraw && <Button variant={action === 'withdraw' ? 'default' : 'outline'} className="flex-1" onClick={() => setAction('withdraw')}>Снять</Button>}
        </div>
        <Input type="number" placeholder="Сумма" value={amount} onChange={e => setAmount(e.target.value)} />
        <DialogFooter><Button onClick={submit}>Подтвердить</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const RolesDialog: React.FC<{ open: boolean; onOpenChange: (b: boolean) => void; roles: ClanRole[]; onChanged: () => void }> = ({ open, onOpenChange, roles, onChanged }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<ClanRole>>({});
  const [creating, setCreating] = useState(false);

  const startEdit = (r: ClanRole) => { setEditingId(r.id); setDraft(r); setCreating(false); };
  const startCreate = () => { setEditingId(null); setCreating(true); setDraft({ name: '', color: '#9CA3AF', perm_invite: false, perm_kick: false, perm_treasury: false, perm_edit_clan: false, perm_manage_roles: false }); };

  const save = async () => {
    if (creating) {
      const { error } = await supabase.rpc('create_clan_role', {
        p_name: draft.name || 'Роль', p_color: draft.color || '#9CA3AF',
        p_invite: !!draft.perm_invite, p_kick: !!draft.perm_kick, p_treasury: !!draft.perm_treasury,
        p_edit_clan: !!draft.perm_edit_clan, p_manage_roles: !!draft.perm_manage_roles,
      });
      if (error) toast.error(error.message); else { toast.success('Роль создана'); setCreating(false); setDraft({}); onChanged(); }
    } else if (editingId) {
      const { error } = await supabase.rpc('update_clan_role', {
        p_role_id: editingId, p_name: draft.name, p_color: draft.color,
        p_invite: !!draft.perm_invite, p_kick: !!draft.perm_kick, p_treasury: !!draft.perm_treasury,
        p_edit_clan: !!draft.perm_edit_clan, p_manage_roles: !!draft.perm_manage_roles,
      });
      if (error) toast.error(error.message); else { toast.success('Сохранено'); setEditingId(null); onChanged(); }
    }
  };

  const del = async (id: string) => {
    if (!confirm('Удалить роль?')) return;
    const { error } = await supabase.rpc('delete_clan_role', { p_role_id: id });
    if (error) toast.error(error.message); else { toast.success('Удалено'); onChanged(); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Роли клана</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {roles.map(r => (
            <div key={r.id} className="flex items-center justify-between p-2 border rounded">
              <span style={{ color: r.color }} className="font-medium flex items-center gap-2">
                {r.is_owner_role && <Crown className="w-4 h-4" />}{r.name}
              </span>
              {!r.is_owner_role && (
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => startEdit(r)}>Изменить</Button>
                  <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              )}
            </div>
          ))}
        </div>
        <Button variant="outline" onClick={startCreate} size="sm"><Plus className="w-4 h-4 mr-1" />Создать роль</Button>
        {(editingId || creating) && (
          <div className="space-y-2 border-t pt-3">
            <div className="flex gap-2">
              <Input placeholder="Название" value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} />
              <Input type="color" value={draft.color || '#9CA3AF'} onChange={e => setDraft({ ...draft, color: e.target.value })} className="w-16 p-1" />
            </div>
            {PERM_LABELS.map(p => (
              <div key={p.key} className="flex items-center justify-between">
                <Label>{p.label}</Label>
                <Switch checked={!!(draft as any)[p.key]} onCheckedChange={v => setDraft({ ...draft, [p.key]: v })} />
              </div>
            ))}
            <Button onClick={save} className="w-full">Сохранить</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const InviteDialog: React.FC<{ open: boolean; onOpenChange: (b: boolean) => void; onInvited: () => void }> = ({ open, onOpenChange, onInvited }) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<{ user_id: string; username: string; player_id: number; avatar_emoji: string }[]>([]);

  useEffect(() => {
    if (!search) { setResults([]); return; }
    const t = setTimeout(async () => {
      const isNum = /^\d+$/.test(search);
      const q = supabase.from('profiles').select('user_id, username, player_id, avatar_emoji').limit(10);
      const { data } = isNum
        ? await q.eq('player_id', parseInt(search))
        : await q.ilike('username', `%${search}%`);
      setResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const invite = async (uid: string) => {
    const { error } = await supabase.rpc('invite_to_clan', { p_invitee_id: uid });
    if (error) toast.error(error.message); else { toast.success('Приглашение отправлено'); onInvited(); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Пригласить игрока</DialogTitle><DialogDescription>Поиск по нику или ID</DialogDescription></DialogHeader>
        <Input placeholder="Ник или ID..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {results.map(r => (
            <div key={r.user_id} className="flex items-center justify-between p-2 border rounded">
              <span>{r.avatar_emoji} {r.username} <span className="text-xs text-muted-foreground">#{r.player_id}</span></span>
              <Button size="sm" onClick={() => invite(r.user_id)}>Пригласить</Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClansTab;
