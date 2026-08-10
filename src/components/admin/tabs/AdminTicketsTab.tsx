import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface Ticket {
  id: string;
  user_id: string;
  category: string;
  subject: string;
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
  updated_at: string;
}
interface Msg {
  id: string;
  author_user_id: string;
  author_username: string;
  is_staff_reply: boolean;
  message: string;
  created_at: string;
}

const STATUS_FILTERS = ['open', 'in_progress', 'closed'] as const;

const CAT_LABEL: Record<string, string> = {
  ban_appeal: '⚖️ Бан-апелляция',
  complaint: '📝 Жалоба',
  bug: '🐞 Баг',
  other: '💬 Другое',
};

const AdminTicketsTab: React.FC = () => {
  const { user } = useAuth();
  const [filter, setFilter] = useState<typeof STATUS_FILTERS[number]>('open');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [usernameMap, setUsernameMap] = useState<Record<string, string>>({});
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('status', filter)
      .order('updated_at', { ascending: false })
      .limit(200);
    const list = (data as any) || [];
    setTickets(list);
    // Resolve usernames
    const ids = Array.from(new Set(list.map((t: Ticket) => t.user_id))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, username').in('user_id', ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p.username; });
      setUsernameMap(map);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const loadMsgs = useCallback(async (id: string) => {
    const { data } = await supabase.from('ticket_messages').select('*').eq('ticket_id', id).order('created_at');
    setMessages((data as any) || []);
  }, []);

  useEffect(() => {
    if (!active) return;
    loadMsgs(active.id);
    const i = setInterval(() => loadMsgs(active.id), 4000);
    return () => clearInterval(i);
  }, [active, loadMsgs]);

  const send = async () => {
    if (!active || !reply.trim()) return;
    setBusy(true);
    await supabase.rpc('post_ticket_message', { p_ticket_id: active.id, p_message: reply.trim() });
    setReply('');
    setBusy(false);
    loadMsgs(active.id);
    load();
  };

  const setStatus = async (action: 'close' | 'reopen') => {
    if (!active) return;
    setBusy(true);
    if (action === 'close') await supabase.rpc('close_ticket', { p_ticket_id: active.id });
    else await supabase.rpc('reopen_ticket', { p_ticket_id: active.id });
    setBusy(false);
    setActive(null);
    load();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">📬 Тикеты поддержки</h2>
      <div className="flex gap-2">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => { setFilter(s); setActive(null); }}
            className={`px-3 py-1.5 text-xs rounded-lg ${filter === s ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70'}`}>
            {s === 'open' ? 'Открыты' : s === 'in_progress' ? 'В работе' : 'Закрыты'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Нет тикетов</p>
          ) : tickets.map(t => (
            <button key={t.id} onClick={() => setActive(t)}
              className={`w-full text-left bg-card border rounded-xl p-3 hover:bg-muted/40 ${active?.id === t.id ? 'ring-2 ring-primary' : ''}`}>
              <div className="text-[10px] text-muted-foreground">{CAT_LABEL[t.category]} · {usernameMap[t.user_id] || '—'}</div>
              <div className="text-sm font-medium truncate">{t.subject}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{new Date(t.updated_at).toLocaleString()}</div>
            </button>
          ))}
        </div>

        <div className="bg-card border rounded-2xl p-3 min-h-[400px] flex flex-col">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Выберите тикет слева</div>
          ) : (
            <>
              <div className="border-b pb-2 mb-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="text-[11px] text-muted-foreground">{CAT_LABEL[active.category]} · от {usernameMap[active.user_id] || active.user_id.slice(0, 8)}</div>
                    <div className="font-semibold text-sm">{active.subject}</div>
                  </div>
                  {active.status === 'closed' ? (
                    <Button size="sm" variant="outline" onClick={() => setStatus('reopen')} disabled={busy}>Открыть</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setStatus('close')} disabled={busy}>Закрыть</Button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 mb-2 max-h-[50vh]">
                {messages.map(m => {
                  const mine = m.author_user_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-xl px-3 py-2 ${mine ? 'bg-primary text-primary-foreground' : m.is_staff_reply ? 'bg-yellow-500/15 border border-yellow-500/30' : 'bg-muted'}`}>
                        <div className="text-[10px] opacity-80 mb-0.5">
                          {m.is_staff_reply ? '🛡️ ' : ''}{m.author_username} · {new Date(m.created_at).toLocaleString()}
                        </div>
                        <p className="text-xs whitespace-pre-wrap break-words">{m.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {active.status !== 'closed' && (
                <div className="space-y-2 border-t pt-2">
                  <Textarea value={reply} onChange={e => setReply(e.target.value.slice(0, 2000))}
                    placeholder="Ответ от поддержки..." className="min-h-[60px] text-sm" />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={send} disabled={busy || !reply.trim()}>
                      {busy && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />}Отправить
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminTicketsTab;
