import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type LimitedClaim, type ReleaseKind, releaseKinds } from '@/lib/liveOps';
import GameIcon from '@/components/GameIcon';
export function LimitedItemArt({image,icon,title}:{image?:string|null;icon:string;title:string}) {
 const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[image]);
 return image&&!failed?<img src={image} alt={title} className="h-full w-full object-cover" loading="lazy" onError={()=>setFailed(true)}/>:<div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-500/10 via-card to-violet-500/10"><GameIcon name={icon} size={48} className="text-amber-500"/></div>;
}
export default function LimitedCollection({userId,kind}:{userId?:string|null;kind?:ReleaseKind}) {
 const [claims,setClaims]=useState<LimitedClaim[]>([]),[error,setError]=useState('');
 useEffect(()=>{setClaims([]);if(!userId)return;let alive=true;const load=async()=>{const {data,error}=await supabase.rpc('get_limited_collection',{p_user_id:userId});if(!alive)return;if(error)setError('Коллекция пока не загрузилась');else{setError('');setClaims((data as unknown as LimitedClaim[])||[]);}};void load();const timer=setInterval(()=>void load(),15000);window.addEventListener('limited-collection-changed',load);return()=>{alive=false;clearInterval(timer);window.removeEventListener('limited-collection-changed',load);};},[userId]);
 const filtered=claims.filter(c=>!kind||c.item_snapshot.kind===kind);
 if(!userId||(!filtered.length&&!error))return null;
 return <section className="space-y-3"><div><h3 className="flex items-center gap-2 text-lg font-bold"><GameIcon name="star" size={20} className="text-amber-500"/>Событийная коллекция</h3><p className="mt-1 text-xs text-muted-foreground">Полученные экземпляры и достижения сохраняются после завершения события</p></div>{error&&<p className="text-xs text-destructive">{error}</p>}<div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">{filtered.map(c=><article key={c.id} className="overflow-hidden rounded-2xl border border-amber-500/20 bg-card"><div className="aspect-square"><LimitedItemArt image={c.item_snapshot.image_url} icon={c.item_snapshot.icon} title={c.item_snapshot.title}/></div><div className="p-3"><div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span>{releaseKinds[c.item_snapshot.kind]}</span><span>№{c.serial} / {c.item_snapshot.edition_size}</span></div><h4 className="mt-2 break-words text-sm font-semibold">{c.item_snapshot.text?`${c.item_snapshot.kind==='username'?'@':''}${c.item_snapshot.text}`:c.item_snapshot.title}</h4><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.item_snapshot.description}</p><p className="mt-3 text-[10px] text-muted-foreground">Получено {new Date(c.claimed_at).toLocaleDateString()}</p></div></article>)}</div></section>;
}
