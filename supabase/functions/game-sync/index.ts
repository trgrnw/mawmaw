import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';
import { createGameState, accrueGameState, applyGameAction, assetWorth, MAX_MONEY } from '../_shared/game-engine.js';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version','Content-Type':'application/json'};
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{headers});
  if(req.method!=='POST')return new Response('{}',{status:405,headers});
  try{
    if(Number(req.headers.get('content-length')||0)>100000)throw Error('Request too large');
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');const {data:{user},error}=await db.auth.getUser(token);if(error||!user)return new Response('{}',{status:401,headers});
    const {data:banned,error:banError}=await db.rpc('is_user_banned',{_user_id:user.id});if(banError)throw banError;if(banned)return new Response('{}',{status:403,headers});
    const text=await req.text();if(text.length>100000)throw Error('Request too large');const body=JSON.parse(text);const actions=body.actions||[];
    if(!Array.isArray(actions)||actions.length>200||actions.some(a=>!a||!/^[-a-z0-9]{36}$/i.test(a.id)||typeof a.type!=='string'||!a.args||typeof a.args!=='object'))throw Error('Invalid actions');
    const settled=await db.rpc('settle_casino');if(settled.error)throw settled.error;
    const auctions=await db.rpc('finalize_expired_auctions');if(auctions.error)throw auctions.error;
    const {error:initError}=await db.from('game_saves').upsert({user_id:user.id,game_state:createGameState()}, {onConflict:'user_id',ignoreDuplicates:true});if(initError)throw initError;
    for(let attempt=0;attempt<5;attempt++){
      const {data:row,error:loadError}=await db.from('game_saves').select('game_state,revision,pending_balance').eq('user_id',user.id).single();if(loadError)throw loadError;
      const ids=actions.map(a=>a.id);const {data:receipts,error:receiptError}=ids.length?await db.from('game_action_receipts').select('action_id').eq('user_id',user.id).in('action_id',ids):{data:[],error:null};if(receiptError)throw receiptError;
      const done=new Set((receipts||[]).map(r=>r.action_id));const now=Date.now();let state=createGameState(row.game_state,now);state.balance=Math.min(MAX_MONEY,Math.max(0,state.balance+Number(row.pending_balance)));state=accrueGameState(state,now);const processed:string[]=[];const rejected:Array<{id:string;message:string}>=[];
      for(const action of actions){if(done.has(action.id))continue;try{const next=applyGameAction(structuredClone(state),action,now);state=next;}catch(e){rejected.push({id:action.id,message:e instanceof Error?e.message:'Invalid action'});}processed.push(action.id);done.add(action.id);}
      const {data:commit,error:commitError}=await db.rpc('commit_verified_game_state',{p_user_id:user.id,p_revision:row.revision,p_state:state,p_net_worth:assetWorth(state,now),p_action_ids:processed});if(commitError)throw commitError;
      if(commit?.committed)return new Response(JSON.stringify({state:commit.state,acknowledged:ids,rejected}),{headers});
    }
    return new Response(JSON.stringify({error:'Concurrent update; retry'}),{status:409,headers});
  }catch(e){console.error(e);return new Response(JSON.stringify({error:'Не удалось синхронизировать игру. Повторите попытку.'}),{status:400,headers});}
});
