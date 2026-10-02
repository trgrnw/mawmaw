import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return new Response('{}', { status: 405, headers });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return new Response('{"error":"Unauthorized"}', { status: 401, headers });
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return new Response('{"error":"Unauthorized"}', { status: 401, headers });
  try {
    const raw = await req.text();
    if (raw.length > 8000) throw Error('Request too large');
    const body = JSON.parse(raw);
    // This single database transaction checks stakes, settles wins and credits
    // accounts. No reads of hidden round data ever reach the browser.
    const result = await admin.rpc('casino_action', { p_uid: user.id, p_action: body.action, p_body: body });
    if (result.error) throw result.error;
    return new Response(JSON.stringify(result.data), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Casino unavailable' }), { status: 400, headers });
  }
});
