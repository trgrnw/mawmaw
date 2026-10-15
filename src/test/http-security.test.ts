// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readJsonBody, RequestLimitError, validActions } from '../../supabase/functions/_shared/http';
describe('server request validation',()=>{
 it('reads normal JSON and rejects scalar/array action envelopes',async()=>{
  expect(await readJsonBody(new Request('https://example.test',{method:'POST',body:'{"actions":[]}'}),100)).toEqual({actions:[]});
  for(const body of ['[]','null','"state"'])await expect(readJsonBody(new Request('https://example.test',{method:'POST',body}),100)).rejects.toThrow();
 });
 it('rejects oversized bodies without trusting Content-Length',async()=>{
  await expect(readJsonBody(new Request('https://example.test',{method:'POST',body:JSON.stringify({data:'a'.repeat(1000)})}),100)).rejects.toBeInstanceOf(RequestLimitError);
 });
 it('enforces byte limits for multibyte UTF-8 input',async()=>{
  await expect(readJsonBody(new Request('https://example.test',{method:'POST',body:JSON.stringify({data:'я'.repeat(40)})}),70)).rejects.toBeInstanceOf(RequestLimitError);
 });
 it('limits batches and accepts only structured actions with UUID receipts',()=>{
  const action={id:crypto.randomUUID(),type:'click',args:{count:1}};
  expect(validActions([action])).toBe(true);
  expect(validActions(Array(201).fill(action))).toBe(false);
  expect(validActions([{...action,id:'a'.repeat(36)}])).toBe(false);
  expect(validActions([{...action,args:[]}])).toBe(false);
  expect(validActions([{...action,args:null}])).toBe(false);
 });
});
