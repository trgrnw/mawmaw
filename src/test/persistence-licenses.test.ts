import { describe,expect,it } from 'vitest';
import { accrueGameState, applyGameAction, createGameState } from '@/game/engine';
import { getBusinessPlan } from '@/game/businessLifecycle';
const start=Date.UTC(2026,9,16),action=(type:string,args:Record<string,unknown>,id:string=crypto.randomUUID())=>({id,type,args});
describe('permanent entrepreneur assets',()=>{
 it('retains a license and each business lifecycle step through repeated server reloads',()=>{
  let state=createGameState({balance:1e8},start);
  state=applyGameAction(state,action('license',{country:'US'}),start);
  const license=structuredClone(state.entrepreneurLicense);
  state=applyGameAction(state,action('open-business',{categoryId:'retail',name:'Test Store'},'business-fixture'),start);
  state=createGameState(JSON.parse(JSON.stringify(state)),start+60000);
  expect(state.entrepreneurLicense).toEqual(license);expect(state.businesses[0].status).toBe('registered');
  for(const step of getBusinessPlan('retail').steps){state=applyGameAction(state,action('setup-business',{id:'business-fixture',stepId:step.id}),start+60000);state=createGameState(JSON.parse(JSON.stringify(state)),start+60000);}
  state=applyGameAction(state,action('hire-business',{id:'business-fixture'}),start+60000);
  state=accrueGameState(createGameState(JSON.parse(JSON.stringify(state)),start+3600000),start+3600000);
  expect(state.entrepreneurLicense).toEqual(license);expect(state.businesses).toHaveLength(1);expect(state.businesses[0].status).toBe('operating');expect(state.totalEarnedBusiness).toBeGreaterThan(0);
 });
 it('preserves a previously owned enterprise if its old category is no longer in the catalog',()=>{
  const state=createGameState({businesses:[{id:'old-enterprise',name:'Legacy',categoryId:'retired-category',investmentCost:5000,incomePerHour:150,createdAt:1}]},start);
  expect(state.businesses).toHaveLength(1);expect(state.businesses[0].id).toBe('old-enterprise');expect(state.businesses[0].investmentCost).toBe(5000);
 });
});
