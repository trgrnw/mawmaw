import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { playUiSound } from '@/lib/sounds';
import type { PlayerNotification } from '@/lib/liveOps';
interface Notifications { count: number; supportCount: number; announcement: PlayerNotification | null; refresh: () => Promise<void>; mark: (id: string | null,state: string) => Promise<void> }
const Context = createContext<Notifications>({count:0,supportCount:0,announcement:null,refresh:async()=>{},mark:async()=>{}});
export const useNotifications = () => useContext(Context);
export function NotificationProvider({children}:{children:React.ReactNode}) {
 const { user }=useAuth(); const uid=user?.id;
 const [count,setCount]=useState(0),[supportCount,setSupportCount]=useState(0),[announcement,setAnnouncement]=useState<PlayerNotification|null>(null);
 const identity=useRef(uid); identity.current=uid;
 const last=useRef<{uid:string;count:number;latest:string}|null>(null), request=useRef(0);
 const refresh=useCallback(async()=>{
  if(!uid)return; const seq=++request.current;
  const sync=await supabase.rpc('sync_player_notifications'); if(sync.error)return;
  const [unread,support,ann,latest]=await Promise.all([
   supabase.from('player_notifications').select('id',{head:true,count:'exact'}).eq('user_id',uid).is('read_at',null),
   supabase.from('player_notifications').select('id',{head:true,count:'exact'}).eq('user_id',uid).eq('kind','support').is('read_at',null),
   supabase.from('player_notifications').select('*').eq('user_id',uid).eq('kind','announcement').is('read_at',null).order('created_at',{ascending:false}).order('id').limit(100),
   supabase.from('player_notifications').select('*').eq('user_id',uid).is('read_at',null).order('created_at',{ascending:false}).order('id').limit(1)
  ]);
  if(identity.current!==uid||seq!==request.current||unread.error)return;
  setCount(unread.count||0);setSupportCount(support.count||0);
  const activeAnnouncements=await supabase.from('announcements').select('id').eq('is_active',true);
  const activeIds=new Set((activeAnnouncements.data||[]).map(a=>`announcement:${a.id}`));
  const next=ann.data?.find(a=>activeIds.has(a.dedupe_key))||null;
  if(identity.current!==uid||seq!==request.current)return;
  setAnnouncement(next);
  const row=latest.data?.[0];
  if(last.current?.uid===uid && row && last.current.latest!==row.id && (unread.count||0)>last.current.count){toast(row.title,{description:row.message.slice(0,160)});playUiSound('notice');}
  last.current={uid,count:unread.count||0,latest:row?.id||''};
 },[uid]);
 useEffect(()=>{setCount(0);setSupportCount(0);setAnnouncement(null);last.current=null;if(!uid)return;void refresh();const timer=setInterval(()=>void refresh(),10000);const focus=()=>void refresh();window.addEventListener('focus',focus);window.addEventListener('notifications-changed',focus);return()=>{request.current++;clearInterval(timer);window.removeEventListener('focus',focus);window.removeEventListener('notifications-changed',focus);};},[uid,refresh]);
 const mark=useCallback(async(id:string|null,state:string)=>{const {error}=await supabase.rpc('set_notification_state',{p_id:id,p_state:state});if(error)throw error;await refresh();window.dispatchEvent(new CustomEvent('notification-inbox-updated'));},[refresh]);
 return <Context.Provider value={{count,supportCount,announcement,refresh,mark}}>{children}</Context.Provider>;
}
