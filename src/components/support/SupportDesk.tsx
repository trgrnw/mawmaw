import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Send, Archive, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { withTimeout } from '@/lib/async';
import { ticketCategories, ticketStatuses, ticketsForFolder, type SupportTicket, type SupportMessage, type TicketCategory } from '@/lib/support';

const messageOf = (error: unknown) => error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Не удалось выполнить запрос. Повторите попытку.';
export default function SupportDesk({ staff = false, forcedCategory, hideHeading = false }: { staff?: boolean; forcedCategory?: TicketCategory; hideHeading?: boolean }) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [folder, setFolder] = useState('active');
  const [page, setPage] = useState(0), [hasMore, setHasMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [names, setNames] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(true), [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [reply, setReply] = useState('');
  const [creating, setCreating] = useState(false), [subject, setSubject] = useState(''), [body, setBody] = useState('');
  const [category, setCategory] = useState<TicketCategory>(forcedCategory || 'other');
  const active = tickets.find(ticket => ticket.id === selectedId) || null;
  const currentSelection = useRef(selectedId); currentSelection.current = selectedId;
  const lastReadMessage = useRef('');
  const listRequest = useRef(0), chatRequest = useRef(0), operation = useRef(false);
  useEffect(()=>{const id=sessionStorage.getItem('supportOpenTicket');if(!id||!user||staff)return;sessionStorage.removeItem('supportOpenTicket');let alive=true;void supabase.from('support_tickets').select('status').eq('id',id).maybeSingle().then(({data})=>{if(alive&&data){setFolder(data.status==='closed'?'closed':'active');setSelectedId(id);}});return()=>{alive=false;};},[user?.id,staff]);
  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const request = ++listRequest.current;
    try {
      let query = supabase.from('support_tickets').select('*').order('updated_at', { ascending: false }).order('id').range(page*100,page*100+99);
      query = folder === 'active' ? query.neq('status','closed') : query.eq('status',folder);
      if (!staff) query = query.eq('user_id',user.id);
      const result = await withTimeout(query,10000,'Поддержка не отвечает. Попробуйте обновить список.');
      if (result.error) throw result.error;
      if (request !== listRequest.current) return;
      const rows = result.data as SupportTicket[] || [];
      setTickets(rows);
      setHasMore(rows.length === 100);
      if (staff && rows.length) {
        const ids = [...new Set(rows.map(ticket=>ticket.user_id))];
        const profiles = await supabase.from('profiles').select('user_id,username').in('user_id',ids);
        if (!profiles.error && request === listRequest.current) setNames(Object.fromEntries((profiles.data||[]).map(profile=>[profile.user_id,profile.username])));
      }
    } catch (error) { if (request === listRequest.current) setError(messageOf(error)); }
    finally { if (request === listRequest.current) setLoading(false); }
  },[user?.id,staff,folder,page]);
  const loadMessages = useCallback(async (id: string) => {
    const request = ++chatRequest.current;
    try {
      const result = await withTimeout(supabase.from('ticket_messages').select('*').eq('ticket_id',id).order('created_at',{ascending:false}).order('id').limit(500),10000,'Переписка не загрузилась. Попробуйте ещё раз.');
      if (result.error) throw result.error;
      if (request === chatRequest.current && currentSelection.current === id) {
        setMessages((result.data as SupportMessage[] || []).reverse());
        const newest=result.data?.[result.data.length-1]?.id;
        if(!staff&&newest&&lastReadMessage.current!==newest&&!document.hidden){lastReadMessage.current=newest;const read=await supabase.rpc('mark_ticket_notifications',{p_ticket_id:id});if(!read.error)window.dispatchEvent(new CustomEvent('notifications-changed'));}
      }
    } catch (error) { if (request === chatRequest.current && currentSelection.current === id) setError(messageOf(error)); }
    finally { if (request === chatRequest.current) setChatLoading(false); }
  },[staff]);
  useEffect(()=>{
    setTickets([]); setSelectedId(null); setMessages([]); setLoading(true); setError('');
    void load(); const timer=setInterval(()=>{if(!document.hidden)void load();},6000);
    return ()=>{clearInterval(timer);listRequest.current++;};
  },[load]);
  useEffect(()=>{
    setMessages([]); setReply(''); setError('');
    if(!selectedId)return;
    setChatLoading(true);void loadMessages(selectedId);
    const timer=setInterval(()=>{if(!document.hidden)void loadMessages(selectedId);},4000);
    return ()=>{clearInterval(timer);chatRequest.current++;};
  },[selectedId,loadMessages]);
  const run = async (work:()=>Promise<void>)=>{
    if(operation.current)return;
    operation.current=true;setBusy(true);setError('');
    try{await work();}catch(error){setError(messageOf(error));}finally{operation.current=false;setBusy(false);}
  };
  const create = ()=>run(async()=>{
    if(subject.trim().length<3||body.trim().length<5)throw Error('Тема: минимум 3 символа. Сообщение: минимум 5 символов.');
    const result=await withTimeout(supabase.rpc('create_support_ticket',{p_category:forcedCategory||category,p_subject:subject.trim(),p_message:body.trim()}),10000,'Не удалось подтвердить создание тикета. Обновите список перед повторной отправкой.');
    if(result.error)throw result.error;
    setCreating(false);setSubject('');setBody('');setFolder('active');setPage(0);await load();
    const id=(result.data as {ticket_id?:string})?.ticket_id;if(id)setSelectedId(id);
  });
  const send = ()=>run(async()=>{
    if(!active||active.status==='closed'||!reply.trim())return;
    const id=active.id;
    const result=await withTimeout(supabase.rpc('post_ticket_message',{p_ticket_id:id,p_message:reply.trim()}),10000,'Не удалось подтвердить отправку. Обновите переписку перед повторной отправкой.');
    if(result.error)throw result.error;
    if(currentSelection.current===id)setReply('');await loadMessages(id);await load();
  });
  const changeStatus = ()=>run(async()=>{
    if(!active)return;
    const result=await supabase.rpc(active.status==='closed'?'reopen_ticket':'close_ticket',{p_ticket_id:active.id});
    if(result.error)throw result.error;
    setSelectedId(null);await load();
  });
  if(!user)return <p className="p-8 text-center text-sm text-muted-foreground">Войдите в аккаунт, чтобы написать в поддержку.</p>;
  const folders=staff?[['active','Активные'],['in_progress','В работе'],['closed','Архив']]:[['active','Активные обращения'],['closed','Архив']];
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div>{!hideHeading&&<h2 className="text-2xl font-bold">{staff?'Тикеты поддержки':'Поддержка'}</h2>}<p className="mt-1 text-sm text-muted-foreground">{staff?'Ответьте игроку, затем закройте решённый тикет.':'Ответы команды и история ваших обращений.'}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>{setError('');void load();if(selectedId)void loadMessages(selectedId);}}><RefreshCw className="mr-1 h-4 w-4"/>Обновить</Button>{!staff&&<Button size="sm" onClick={()=>{setCreating(true);setError('');}}><Plus className="mr-1 h-4 w-4"/>Новый тикет</Button>}</div></div>
    <div className="flex flex-wrap gap-2">{folders.map(([id,label])=><Button key={id} variant={folder===id?'default':'outline'} size="sm" onClick={()=>{setFolder(id);setPage(0);setSelectedId(null);}}>{id==='closed'&&<Archive className="mr-1 h-4 w-4"/>}{label}</Button>)}</div>
    <div className="flex items-center justify-between gap-2"><Button size="sm" variant="ghost" disabled={page===0||loading} onClick={()=>setPage(value=>value-1)}>Назад</Button><span className="text-xs text-muted-foreground">Страница {page+1}</span><Button size="sm" variant="ghost" disabled={!hasMore||loading} onClick={()=>setPage(value=>value+1)}>Далее</Button></div>
    {error&&<p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    <div className="grid gap-4 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]"><div className="max-h-[65vh] space-y-2 overflow-y-auto">{loading?<Loader2 className="m-8 h-6 w-6 animate-spin"/>:ticketsForFolder(tickets,folder).map(ticket=><button key={ticket.id} onClick={()=>setSelectedId(ticket.id)} className={`w-full rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/50 ${selectedId===ticket.id?'border-primary bg-primary/5':''}`}><div className="flex justify-between gap-2 text-[10px] text-muted-foreground"><span>{ticketCategories[ticket.category]}</span><span>{ticketStatuses[ticket.status]}</span></div><p className="mt-2 break-words text-sm font-semibold">{ticket.subject}</p>{staff&&<p className="mt-1 text-xs text-primary">{names[ticket.user_id]||ticket.user_id.slice(0,8)}</p>}<p className="mt-2 text-[10px] text-muted-foreground">{new Date(ticket.updated_at).toLocaleString()}</p></button>)}{!loading&&!ticketsForFolder(tickets,folder).length&&<p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{folder==='closed'?'Закрытые обращения появятся здесь вместе с перепиской.':'Обращений пока нет.'}</p>}</div>
    <section className="flex min-h-96 min-w-0 flex-col rounded-2xl border bg-card p-4">{!active?<div className="m-auto p-8 text-center text-sm text-muted-foreground">Выберите обращение, чтобы открыть переписку.</div>:<><div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3"><div className="min-w-0"><p className="text-xs text-muted-foreground">{ticketStatuses[active.status]} · {ticketCategories[active.category]}</p><h3 className="mt-1 break-words font-semibold">{active.subject}</h3></div>{(active.status!=='closed'||staff)&&<Button variant="outline" size="sm" disabled={busy} onClick={changeStatus}>{active.status==='closed'?'Открыть повторно':'Закрыть тикет'}</Button>}</div>
    <div aria-live="polite" className="my-4 flex max-h-[48vh] flex-1 flex-col gap-3 overflow-y-auto">{chatLoading?<Loader2 className="m-auto h-6 w-6 animate-spin"/>:messages.map(message=><div key={message.id} className={`max-w-[90%] rounded-2xl p-3 ${message.author_user_id===user.id?'self-end bg-primary/10':message.is_staff_reply?'self-start border border-amber-500/25 bg-amber-500/10':'self-start bg-muted'}`}><p className="flex items-center gap-1 text-[10px] text-muted-foreground">{message.is_staff_reply&&<ShieldCheck className="h-3 w-3 text-amber-500"/>}{message.is_staff_reply?'Поддержка · ':''}{message.author_username}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.message}</p><p className="mt-2 text-[9px] text-muted-foreground">{new Date(message.created_at).toLocaleString()}</p></div>)}</div>
    {active.status==='closed'?<p className="border-t pt-3 text-center text-xs text-muted-foreground">Обращение закрыто и сохранено в архиве. Переписка доступна для чтения.</p>:<div className="space-y-2 border-t pt-3"><Textarea aria-label="Сообщение в поддержку" value={reply} maxLength={2000} onChange={event=>setReply(event.target.value)} placeholder={staff?'Ответ игроку…':'Ваше сообщение…'} onKeyDown={event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();void send();}}}/><div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground">{reply.length}/2000</span><Button disabled={busy||!reply.trim()} onClick={send}><Send className="mr-2 h-4 w-4"/>Отправить</Button></div></div>}</>}</section></div>
    <Dialog open={creating} onOpenChange={open=>!busy&&setCreating(open)}><DialogContent><DialogHeader><DialogTitle>Новое обращение</DialogTitle><DialogDescription>Опишите проблему. Не отправляйте пароли и коды входа.</DialogDescription></DialogHeader><div className="space-y-3"><label className="block text-sm">Категория<select aria-label="Категория обращения" value={forcedCategory||category} disabled={!!forcedCategory} onChange={event=>setCategory(event.target.value as TicketCategory)} className="mt-1 w-full rounded-xl border bg-background p-2">{Object.entries(ticketCategories).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><Input aria-label="Тема обращения" placeholder="Тема" value={subject} maxLength={120} onChange={event=>setSubject(event.target.value)}/><Textarea aria-label="Описание проблемы" placeholder="Что произошло?" value={body} maxLength={2000} onChange={event=>setBody(event.target.value)}/>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Button className="w-full" onClick={create} disabled={busy||subject.trim().length<3||body.trim().length<5}>{busy?'Отправка…':'Создать тикет'}</Button></div></DialogContent></Dialog>
  </div>;
}
