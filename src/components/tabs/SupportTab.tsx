import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Plus, MessageSquare, X } from 'lucide-react';
import GameIcon from '@/components/GameIcon';

interface Ticket {
  id: string;
  category: 'ban_appeal' | 'complaint' | 'bug' | 'other';
  subject: string;
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
  updated_at: string;
}

interface TicketMessage {
  id: string;
  author_user_id: string;
  author_username: string;
  is_staff_reply: boolean;
  message: string;
  created_at: string;
}

const CATEGORY_LABELS: Record<Ticket['category'], string> = {
  ban_appeal: '⚖️ Бан-апелляция',
  complaint: '📝 Жалоба',
  bug: '🐞 Баг',
  other: '💬 Другое',
};

const STATUS_LABELS: Record<Ticket['status'], { label: string; cls: string }> = {
  open: { label: 'Открыт', cls: 'bg-blue-500/15 text-blue-500' },
  in_progress: { label: 'В работе', cls: 'bg-yellow-500/15 text-yellow-500' },
  closed: { label: 'Закрыт', cls: 'bg-muted text-muted-foreground' },
};

interface SupportProps {
  /** When set, the support page is rendered standalone (e.g. for banned users)
   *  with a single category preselected. */
  forcedCategory?: Ticket['category'];
  hideHeading?: boolean;
}

const SupportTab: React.FC<SupportProps> = ({ forcedCategory, hideHeading }) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newOpen, setNewOpen] = useState(false);

  const loadTickets = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    setTickets((data as any) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadTickets();
    const i = setInterval(loadTickets, 6000);
    return () => clearInterval(i);
  }, [loadTickets]);

  const loadMessages = useCallback(async (ticketId: string) => {
    const { data } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    setMessages((data as any) || []);
  }, []);

  useEffect(() => {
    if (!active) return;
    loadMessages(active.id);
    const i = setInterval(() => loadMessages(active.id), 4000);
    return () => clearInterval(i);
  }, [active, loadMessages]);

  if (!user) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Войдите в аккаунт, чтобы пользоваться поддержкой.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {!hideHeading && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <GameIcon name="faq" size={22} themed /> Поддержка
            </h2>
            <p className="text-sm text-muted-foreground">Создавайте тикеты и общайтесь с командой</p>
          </div>
          <Button size="sm" onClick={() => setNewOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Новый тикет
          </Button>
        </div>
      )}

      {hideHeading && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setNewOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Новое обращение
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : tickets.length === 0 ? (
        <div className="bg-card border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          У вас пока нет обращений. Нажмите «Новый тикет», чтобы связаться с поддержкой.
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => (
            <button
              key={t.id}
              onClick={() => setActive(t)}
              className="w-full text-left bg-card border rounded-2xl p-3 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{CATEGORY_LABELS[t.category]}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${STATUS_LABELS[t.status].cls}`}>
                      {STATUS_LABELS[t.status].label}
                    </span>
                  </div>
                  <p className="font-medium text-sm truncate mt-0.5">{t.subject}</p>
                </div>
                <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}

      <NewTicketDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        forcedCategory={forcedCategory}
        onCreated={() => { setNewOpen(false); loadTickets(); }}
      />

      <TicketChatDialog
        ticket={active}
        messages={messages}
        onClose={() => { setActive(null); setMessages([]); }}
        onChanged={() => { if (active) loadMessages(active.id); loadTickets(); }}
      />
    </div>
  );
};

const NewTicketDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  forcedCategory?: Ticket['category'];
}> = ({ open, onClose, onCreated, forcedCategory }) => {
  const [category, setCategory] = useState<Ticket['category']>(forcedCategory || 'other');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCategory(forcedCategory || 'other');
      setSubject('');
      setMessage('');
      setError(null);
    }
  }, [open, forcedCategory]);

  const submit = async () => {
    setError(null);
    if (subject.trim().length < 3) { setError('Тема: минимум 3 символа'); return; }
    if (message.trim().length < 5) { setError('Сообщение: минимум 5 символов'); return; }
    setBusy(true);
    const { error: e } = await supabase.rpc('create_support_ticket', {
      p_category: category,
      p_subject: subject.trim(),
      p_message: message.trim(),
    });
    setBusy(false);
    if (e) setError(e.message);
    else onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новый тикет</DialogTitle>
          <DialogDescription>Опишите проблему — модераторы ответят как можно скорее</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Категория</label>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {(Object.keys(CATEGORY_LABELS) as Ticket['category'][]).map(c => (
                <button
                  key={c}
                  type="button"
                  disabled={!!forcedCategory && forcedCategory !== c}
                  onClick={() => setCategory(c)}
                  className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                    category === c ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted'
                  } ${forcedCategory && forcedCategory !== c ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Тема</label>
            <Input value={subject} onChange={e => setSubject(e.target.value.slice(0, 120))} placeholder="Кратко опишите проблему" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Сообщение</label>
            <Textarea value={message} onChange={e => setMessage(e.target.value.slice(0, 2000))} placeholder="Подробности..." className="mt-1 min-h-[100px]" />
            <p className="text-[10px] text-muted-foreground text-right mt-0.5">{message.length}/2000</p>
          </div>
          {error && <div className="text-xs text-red-500 bg-red-500/10 rounded-lg p-2">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>Отмена</Button>
            <Button size="sm" onClick={submit} disabled={busy}>
              {busy && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />}
              Создать
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const TicketChatDialog: React.FC<{
  ticket: Ticket | null;
  messages: TicketMessage[];
  onClose: () => void;
  onChanged: () => void;
}> = ({ ticket, messages, onClose, onChanged }) => {
  const { user } = useAuth();
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);
  useEffect(() => { setReply(''); setError(null); }, [ticket?.id]);

  const send = async () => {
    if (!ticket || !reply.trim()) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc('post_ticket_message', {
      p_ticket_id: ticket.id,
      p_message: reply.trim(),
    });
    setBusy(false);
    if (e) setError(e.message);
    else { setReply(''); onChanged(); }
  };

  const closeTicket = async () => {
    if (!ticket) return;
    setBusy(true);
    await supabase.rpc('close_ticket', { p_ticket_id: ticket.id });
    setBusy(false);
    onChanged();
    onClose();
  };

  return (
    <Dialog open={!!ticket} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {ticket && CATEGORY_LABELS[ticket.category]}
            {ticket && (
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${STATUS_LABELS[ticket.status].cls}`}>
                {STATUS_LABELS[ticket.status].label}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="line-clamp-2">{ticket?.subject}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-2 py-2 min-h-[200px] max-h-[50vh]">
          {messages.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-4">Нет сообщений</p>
          ) : (
            messages.map(m => {
              const mine = m.author_user_id === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                    mine ? 'bg-primary text-primary-foreground' : m.is_staff_reply ? 'bg-yellow-500/15 border border-yellow-500/30' : 'bg-muted'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-semibold opacity-80">
                        {m.is_staff_reply ? '🛡️ ' : ''}{m.author_username}
                      </span>
                      <span className="text-[9px] opacity-60">{new Date(m.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-xs whitespace-pre-wrap break-words">{m.message}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>
        {ticket?.status !== 'closed' ? (
          <div className="space-y-2 border-t pt-2">
            <Textarea
              value={reply}
              onChange={e => setReply(e.target.value.slice(0, 2000))}
              placeholder="Ваше сообщение..."
              className="min-h-[60px] text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
            />
            {error && <div className="text-xs text-red-500">{error}</div>}
            <div className="flex justify-between items-center">
              <Button variant="ghost" size="sm" onClick={closeTicket} disabled={busy} className="text-muted-foreground">
                <X className="w-3 h-3 mr-1" /> Закрыть тикет
              </Button>
              <Button size="sm" onClick={send} disabled={busy || !reply.trim()}>
                {busy && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />}
                Отправить
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t pt-2 text-center text-xs text-muted-foreground">
            Тикет закрыт
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SupportTab;
