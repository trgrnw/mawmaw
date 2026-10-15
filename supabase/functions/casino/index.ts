import { readJsonBody, RequestLimitError } from '../_shared/http.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return new Response('{}', { status: 405, headers });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return new Response('{"error":"Unauthorized"}', { status: 401, headers });
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return new Response('{"error":"Unauthorized"}', { status: 401, headers });
  try {
    const budget = await admin.rpc('consume_game_request', { p_user_id:user.id,p_scope:'casino',p_limit:180,p_window_seconds:60 });
    if (budget.error) throw budget.error;
    if (!budget.data) return new Response(JSON.stringify({error:'Слишком много запросов. Подождите минуту.'}),{status:429,headers:{...headers,'Retry-After':'60'}});
    const body = await readJsonBody(req,8000);
    if (typeof body.action !== 'string') throw Error('Invalid action');
    // This single database transaction checks stakes, settles wins and credits
    // accounts. No reads of hidden round data ever reach the browser.
    const result = await admin.rpc('casino_action', { p_uid: user.id, p_action: body.action, p_body: body });
    if (result.error) throw result.error;
    return new Response(JSON.stringify(result.data), { headers });
  } catch (error) {
    console.error('Casino operation rejected', error instanceof Error ? error.message : 'database error');
    return new Response(JSON.stringify({ error: 'Операция казино отклонена. Проверьте ставку, баланс и состояние раунда.' }), { status: error instanceof RequestLimitError ? 413 : 400, headers });
  }
});
