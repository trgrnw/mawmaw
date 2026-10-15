import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import SupportDesk from '@/components/support/SupportDesk';
const state=vi.hoisted(()=>({status:'open',fail:false,calls:[] as string[]}));
vi.mock('@/context/AuthContext',()=>({useAuth:()=>({user:{id:'owner-id'}})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{
 from:(table:string)=>{
  const query={select:()=>query,eq:()=>query,neq:()=>query,range:()=>query,order:()=>query,limit:()=>query,
   then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({error:null,data:table==='support_tickets'?[{id:'ticket-id',user_id:'owner-id',subject:'Lost yacht',category:'bug',status:state.status,created_at:'2026-10-15T12:00:00Z',updated_at:'2026-10-15T12:00:00Z'}]:[{id:'msg-id',ticket_id:'ticket-id',author_user_id:'owner-id',author_username:'thugger',message:'Please help',is_staff_reply:false,created_at:'2026-10-15T12:00:00Z'}]}).then(resolve)};
  return query;
 },
 rpc:vi.fn(async(name:string)=>{state.calls.push(name);if(state.fail)return {data:null,error:{message:'Server rejected message'}};if(name==='close_ticket')state.status='closed';return {data:{success:true},error:null};}),
}}));
beforeEach(()=>{cleanup();state.status='open';state.fail=false;state.calls=[];});
describe('support user flow',()=>{
 it('moves a closed ticket to Archive and keeps the conversation readable',async()=>{
  render(<SupportDesk/>);
  fireEvent.click(await screen.findByRole('button',{name:/Lost yacht/}));
  await screen.findByText('Please help');
  fireEvent.click(screen.getByRole('button',{name:'Закрыть тикет'}));
  await waitFor(()=>expect(state.calls).toContain('close_ticket'));
  fireEvent.click(screen.getByRole('button',{name:/Архив/}));
  fireEvent.click(await screen.findByRole('button',{name:/Lost yacht/}));
  expect(await screen.findByText('Please help')).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Отправить'})).toBeNull();
 });
 it('keeps the reply draft and shows an error when sending fails',async()=>{
  render(<SupportDesk/>);
  fireEvent.click(await screen.findByRole('button',{name:/Lost yacht/}));
  const input=await screen.findByRole('textbox',{name:'Сообщение в поддержку'});
  fireEvent.change(input,{target:{value:'My draft'}});state.fail=true;
  fireEvent.click(screen.getByRole('button',{name:'Отправить'}));
  await screen.findByRole('alert');
  expect((input as HTMLTextAreaElement).value).toBe('My draft');
 });
});
