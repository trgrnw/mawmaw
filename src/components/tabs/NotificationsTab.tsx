import { useCallback, useEffect, useState, useRef } from 'react';
import { Archive, Bell, CheckCheck, Mail, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { supabase } from '@/integrations/supabase/client';
import { rpcError, type PlayerNotification } from '@/lib/liveOps';
import { achievements } from '@/data/achievementsData';
import { shopItemsData, accessoryItemsData } from '@/data/shopData';
import ClanInvitations from '@/components/ClanInvitations';
import { toast } from 'sonner';
export default function NotificationsTab() {
 const {user}=useAuth(), {mark,refresh}=useNotifications();
 const [folder,setFolder]=useState('unread'),[items,setItems]=useState<PlayerNotification[]>([]),[page,setPage]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const request=useRef(0);
 const load=useCallback(async()=>{
  const seq=++request.current;
  if(!user){setLoading(false);return;}
  let query=supabase.from('player_notifications').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).order('id').range(page*30,page*30+29);
  query=folder==='unread'?query.is('read_at',null):folder==='read'?query.not('read_at','is',null):query.not('archived_at','is',null);
  const result=await query;
  if(seq!==request.current)return;
  if(result.error)setError(result.error.message);else{setItems(result.data||[]);setError('');}setLoading(false);
 },[user?.id,folder,page]);
 useEffect(()=>{let alive=true;void load();const timer=setInterval(()=>{if(alive)void load();},10000);window.addEventListener('notification-inbox-updated',load);return()=>{alive=false;request.current++;clearInterval(timer);window.removeEventListener('notification-inbox-updated',load);};},[load]);
 const update=async(id:string|null,state:string)=>{if(busy)return;setBusy(true);try{await mark(id,state);await load();}catch(error){toast.error(rpcError(error));}finally{setBusy(false);}};
 const open=async(item:PlayerNotification)=>{
  await update(item.id,'read');
  const target=item.target?.split(':')[0];
  if(target==='support'&&item.target?.includes(':'))sessionStorage.setItem('supportOpenTicket',item.target.split(':')[1]);
  if(['business','shop','accessories','achievements','limited','support','clans'].includes(target||''))window.dispatchEvent(new CustomEvent('game-navigation',{detail:target}));
 };
 const body=(item:PlayerNotification)=>item.kind==='achievement'?(achievements.find(a=>a.id===item.message)?.title||item.message):item.kind==='purchase'?item.message.replace(/Предмет: (.+)/,(_,id)=>[...shopItemsData,...accessoryItemsData].find(x=>x.id===id)?.name||id):item.message;
 return <div className="max-w-5xl space-y-5 pb-8">
  <header className="flex flex-wrap items-end justify-between gap-4 rounded-3xl border bg-card p-6"><div><Bell className="mb-3 h-7 w-7 text-violet-500"/><h2 className="text-2xl font-bold">Уведомления</h2><p className="mt-1 text-sm text-muted-foreground">Ответы поддержки, покупки, достижения и новости игры</p></div><div className="flex gap-2"><button disabled={busy} onClick={()=>void update(null,'read_all')} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs disabled:opacity-50"><CheckCheck size={16}/>Прочитать всё</button><button aria-label="Обновить уведомления" onClick={()=>void refresh().then(load)} className="rounded-xl border p-2"><RefreshCw size={17}/></button></div></header>
  <nav className="flex gap-1 rounded-2xl border bg-card p-1.5">{[['unread','Непрочитанное',Mail],['read','Прочитанное',CheckCheck],['archive','Архив',Archive]].map(([id,label,Icon])=>{const Component=Icon as typeof Mail;return <button key={String(id)} onClick={()=>{setFolder(String(id));setPage(0);setLoading(true);}} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium ${folder===id?'bg-primary text-primary-foreground':'text-muted-foreground hover:bg-muted'}`}><Component size={16}/>{String(label)}</button>;})}</nav>
  <p className="text-xs text-muted-foreground">Прочитанные уведомления автоматически сохраняются в архиве. Во вкладке «Прочитанное» доступна вся история чтения.</p>
  {error&&<p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
  {loading?<p role="status" className="p-8 text-center text-sm text-muted-foreground">Загрузка…</p>:items.length===0?<div className="rounded-2xl border border-dashed p-12 text-center"><Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40"/><p className="font-medium">Здесь пока тихо</p><p className="mt-1 text-sm text-muted-foreground">Новые события появятся автоматически</p></div>:<div className="space-y-2">{items.map(item=><article key={item.id} className={`rounded-2xl border bg-card p-4 ${!item.read_at?'border-violet-500/30':''}`}><div className="flex items-start gap-3"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read_at?'bg-muted':'bg-violet-500'}`}/><div className="min-w-0 flex-1"><button onClick={()=>void open(item)} className="w-full text-left"><h3 className="text-sm font-semibold">{item.title}</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{body(item)}</p></button><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><time className="text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleString()}</time><button disabled={busy} onClick={()=>void update(item.id,item.read_at?'unread':'read')} className="text-xs font-medium text-primary disabled:opacity-50">{item.read_at?'Сделать непрочитанным':'Прочитать и архивировать'}</button></div></div></div></article>)}</div>}
  <div className="flex items-center justify-between text-xs"><button disabled={!page} onClick={()=>setPage(p=>p-1)} className="rounded-lg border px-3 py-2 disabled:opacity-30">Назад</button><span>Страница {page+1}</span><button disabled={items.length<30} onClick={()=>setPage(p=>p+1)} className="rounded-lg border px-3 py-2 disabled:opacity-30">Далее</button></div>
  {folder==='unread'&&<details className="rounded-2xl border bg-card p-4"><summary className="cursor-pointer text-sm font-semibold">Приглашения в кланы</summary><div className="mt-4"><ClanInvitations/></div></details>}
 </div>;
}
