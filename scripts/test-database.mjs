import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}',created_at timestamptz DEFAULT now());
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'service_role') $$;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,owner uuid);
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;
CREATE PUBLICATION supabase_realtime;
-- Test adapter only: production uses pgcrypto supplied by Supabase.
CREATE FUNCTION public.gen_random_bytes(integer) RETURNS bytea LANGUAGE sql AS $$ SELECT decode(substr(md5(random()::text),1,$1*2),'hex') $$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
`);
const root=new URL('../supabase/migrations/',import.meta.url);
const path=file=>new URL(file,root);
for (const file of (await fs.readdir(root)).filter(x=>x.endsWith('.sql')).sort()) {
 if(file==='20261002000000_verified_economy.sql') {
  await db.exec(`INSERT INTO auth.users(id) VALUES('00000000-0000-4000-8000-000000000003'),('00000000-0000-4000-8000-000000000004');
  INSERT INTO game_saves(user_id,game_state,pending_balance) VALUES('00000000-0000-4000-8000-000000000003','{"balance":1000,"licensePlates":[]}',0),('00000000-0000-4000-8000-000000000004','{"balance":1000,"licensePlates":[]}',0);
  INSERT INTO market_listings(seller_id,item_type,item_data,price,created_at) VALUES('00000000-0000-4000-8000-000000000003','license_plate','{"plate_id":"legacy-escrow","text":"ABC 9999","country":"US"}',100,now()-interval '2 hours');
  INSERT INTO market_listings(seller_id,buyer_id,item_type,item_data,price,status,sold_at) VALUES('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','license_plate','{"plate_id":"legacy-sold","text":"ABC 7777","country":"US"}',100,'sold',now());`);
 }
 try { await db.exec(await fs.readFile(path(file),'utf8')); }
 catch(error) {console.error(file,error.message);process.exitCode=1;await db.close();process.exit();}
}
if (process.argv.includes('--schema')) {
  const columns = (await db.query("SELECT table_name,column_name,is_nullable,column_default,udt_name,data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows;
  const functions = (await db.query("SELECT p.proname AS name,p.proargnames AS names,p.proargmodes AS modes,p.proallargtypes AS all_types,p.proargtypes::oid[] AS input_types,p.prorettype AS result_type,p.proretset AS setof,p.pronargdefaults AS defaults FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'")).rows;
  const types = (await db.query("SELECT oid,typname FROM pg_type")).rows;
  await fs.writeFile(new URL('../../database-schema.json',import.meta.url),JSON.stringify({columns,functions,types}));
}
console.log('All migrations applied');
const seller='00000000-0000-4000-8000-000000000001',buyer='00000000-0000-4000-8000-000000000002';
await db.exec(`INSERT INTO auth.users(id,raw_user_meta_data) VALUES('${seller}','{"username":"seller"}'),('${buyer}','{"username":"buyer"}');
INSERT INTO game_saves(user_id,game_state,net_worth) VALUES('${seller}','{"balance":100000,"licensePlates":[]}',100),('${buyer}','{"balance":100000,"licensePlates":[]}',200) ON CONFLICT(user_id) DO UPDATE SET game_state=EXCLUDED.game_state,net_worth=EXCLUDED.net_worth;`);
let checks=0;
const eq=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const identity=async(uid,role='authenticated')=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[uid,role]);await db.exec('SET ROLE '+role);};
const reject=async(sql,args=[])=>{await assert.rejects(db.query(sql,args));checks++;};
const rpc=async(name,args,casts)=>scalar(`SELECT ${name}(${args.map((_,i)=>'$'+(i+1)+(casts?.[i]?'::'+casts[i]:'')).join(',')})`,args);
const balance=async uid=>Number(await scalar("SELECT (game_state->>'balance')::numeric+pending_balance FROM game_saves WHERE user_id=$1",[uid]));
eq(Number(await scalar("SELECT pending_balance FROM game_saves WHERE user_id='00000000-0000-4000-8000-000000000004'")),0);
eq(Number(await scalar("SELECT count(*) FROM market_listings WHERE status='active' AND item_data->>'plate_id'='legacy-escrow'")),1);
eq(await scalar("SELECT data->>'text' FROM owned_license_plates WHERE id='legacy-escrow'"),'ABC 9999');
eq((await scalar("SELECT game_state FROM game_saves WHERE user_id='00000000-0000-4000-8000-000000000004'")).licensePlates[0].id,'legacy-sold');
await identity(seller);
await reject("UPDATE game_saves SET game_state='{\"balance\":999999999}' WHERE user_id=$1",[seller]);
await reject("SELECT * FROM casino_mines_games");await reject("SELECT * FROM casino_rocket_rounds");
await reject("SELECT save_game_state('{}',1000000)");await reject('SELECT claim_offline_income(1000000000)');
await reject("INSERT INTO market_listings(seller_id,item_type,item_data,price) VALUES($1,'license_plate','{}',1)",[seller]);
const before=await balance(seller);
const username=await rpc('purchase_player_username',['unique_name'],['text']);
eq(await balance(seller),before-100);
await rpc('purchase_player_username',['unique_name'],['text']);eq(await balance(seller),before-100);
const listing=await rpc('create_market_listing',['username',{username_id:username.id},500,null],['text','jsonb','numeric','integer']);
await reject('SELECT create_market_listing($1,$2,$3,$4)',['username',{username_id:username.id},500,null]);
await identity(buyer);
await reject("UPDATE market_listings SET price=1 WHERE id=$1",[listing.listing_id]);
await rpc('buy_market_listing',[listing.listing_id],['uuid']);eq(await balance(buyer),99500);
await rpc('buy_market_listing',[listing.listing_id],['uuid']);eq(await balance(buyer),99500);
eq(await scalar('SELECT user_id::text FROM player_usernames WHERE id=$1',[username.id]),buyer);
await identity(seller);eq(await balance(seller),100400);
const claim=await rpc('claim_pending_balance',[]);eq(Number(claim.amount),500);
await rpc('claim_pending_balance',[]);eq(await balance(seller),100400);
await rpc('spin_daily_wheel',[]);await reject('SELECT spin_daily_wheel()');
await identity(seller,'service_role');
let state=await scalar('SELECT game_state FROM game_saves WHERE user_id=$1',[seller]);
state.balance+=Number(await scalar('SELECT pending_balance FROM game_saves WHERE user_id=$1',[seller]));
let revision=Number(await scalar('SELECT revision FROM game_saves WHERE user_id=$1',[seller]));
state.licensePlates=[{id:'verified-plate',text:'ABC 1234',country:'US',assignedTo:null,isCustom:true}];
const committed=await rpc('commit_verified_game_state',[seller,revision,state,100,['test-action']],['uuid','bigint','jsonb','numeric','text[]']);eq(committed.committed,true);
const repeat=await rpc('commit_verified_game_state',[seller,revision,state,100,['test-action']],['uuid','bigint','jsonb','numeric','text[]']);eq(repeat.committed,false);
await identity(seller);const plateListing=await rpc('create_market_listing',['license_plate',{plate_id:'verified-plate'},200,null],['text','jsonb','numeric','integer']);
eq((await scalar('SELECT game_state FROM game_saves WHERE user_id=$1',[seller])).licensePlates,[]);
await rpc('cancel_auction',[plateListing.listing_id],['uuid']);await rpc('cancel_auction',[plateListing.listing_id],['uuid']);
eq((await scalar('SELECT game_state FROM game_saves WHERE user_id=$1',[seller])).licensePlates.length,1);
// The casino RPC is inaccessible to browsers even with a forged p_uid.
await reject("SELECT casino_action($1,'get_rocket_round','{}')",[buyer]);
await identity(buyer,'service_role');
const casino=async(action,body={})=>rpc('casino_action',[buyer,action,{request_id:crypto.randomUUID(),...body}],['uuid','text','jsonb']);
const rocket=await casino('get_rocket_round');eq(rocket.round.crash_point,null);
const stakeBefore=await balance(buyer);const req=crypto.randomUUID();
await casino('place_rocket_bet',{request_id:req,round_id:rocket.round.id,bet_amount:100,auto_cashout:2});
await casino('place_rocket_bet',{request_id:req,round_id:rocket.round.id,bet_amount:100,auto_cashout:2});eq(await balance(buyer),stakeBefore-100);
await db.exec('RESET ROLE');await db.query("UPDATE casino_rocket_rounds SET crash_point=3,status='flying',started_at=clock_timestamp()-interval '15 seconds' WHERE id=$1",[rocket.round.id]);await identity(buyer,'service_role');
await rpc('settle_casino',[]);eq(await balance(buyer),stakeBefore+100);
await rpc('settle_casino',[]);eq(await balance(buyer),stakeBefore+100);
const mines=await casino('start_mines',{bet_amount:100,bomb_count:5});eq('bomb_positions' in mines.game,false);
const minesBefore=await balance(buyer);
const resumed=await casino('start_mines',{bet_amount:100,bomb_count:5});eq(resumed.game.id,mines.game.id);eq(await balance(buyer),minesBefore);
await reject("SELECT casino_action($1,'reveal_mine',$2)",[buyer,{request_id:crypto.randomUUID(),game_id:mines.game.id,position:-1}]);
await reject("SELECT casino_action($1,'reveal_mine',$2)",[buyer,{request_id:crypto.randomUUID(),game_id:mines.game.id,position:1.5}]);
await db.exec('RESET ROLE');const bombs=await scalar('SELECT bomb_positions FROM casino_mines_games WHERE id=$1',[mines.game.id]);const safe=Array.from({length:25},(_,i)=>i).find(i=>!bombs.includes(i));await identity(buyer,'service_role');
const reveal=await casino('reveal_mine',{game_id:mines.game.id,position:safe});eq(reveal.game_over,false);eq(reveal.bomb_positions,null);
const cashout=await casino('cashout_mines',{game_id:mines.game.id});eq(cashout.success,true);const paid=await balance(buyer);
await casino('cashout_mines',{game_id:mines.game.id});eq(await balance(buyer),paid);
const coin=await casino('get_coinflip_round');await casino('place_coinflip_bet',{round_id:coin.round.id,bet_amount:100,choice:'heads'});
await db.exec('RESET ROLE');await db.query("UPDATE casino_coinflip_rounds SET started_at=clock_timestamp()-interval '1 second' WHERE id=$1",[coin.round.id]);await identity(buyer,'service_role');
const completed=await casino('get_coinflip_round');eq(completed.completed_round.id,coin.round.id);
const afterCoin=await balance(buyer);const otherPoll=await casino('get_coinflip_round');eq(otherPoll.completed_round.id,coin.round.id);eq(await balance(buyer),afterCoin);
await identity(buyer);const bans=await db.query('SELECT * FROM get_active_ban($1)',[buyer]);eq(bans.rows,[]);
console.log(`${checks} database checks passed (roles, receipts, market escrow, stakes, auto payouts, reconnects)`);
await db.close();
