import { describe, expect, it } from 'vitest';
import { accrueGameState, applyGameAction, createGameState, income, updateAchievements } from '@/game/engine';
import { businessMergers } from '@/data/mergerData';
import { cryptoAssets, stockAssets } from '@/data/investmentData';
import { getBusinessPlan, migrateBusiness } from '@/game/businessLifecycle';
import { generateRandomPlate, validateCustomPlate } from '@/game/licensePlates';
import { upgradeLevels } from '@/game/upgrades';
const NOW=Date.UTC(2026,9,2);
const action=(type:string,args:Record<string,unknown>={})=>({id:crypto.randomUUID(),type,args});

describe('verified game actions',()=>{
 it.each([NaN,Infinity,-Infinity,-1,0])('rejects invalid investment quantity %s without changing the source state',quantity=>{
  const state=createGameState({balance:1e6},NOW);
  expect(()=>applyGameAction(structuredClone(state),action('buy-stock',{id:stockAssets[0].id,quantity}),NOW)).toThrow();
  expect(state.balance).toBe(1e6);expect(state.stockHoldings).toEqual([]);
 });
 it('uses the catalog price instead of accepting a discounted purchase',()=>{
  expect(()=>applyGameAction(createGameState({balance:1e6},NOW),action('buy-shop',{id:'re1',price:1}),NOW)).toThrow('Invalid price');
 });
 it('migrates each merged business and keeps its income after reload',()=>{
  for(const recipe of businessMergers){
   expect(()=>getBusinessPlan(recipe.id)).not.toThrow();
   const business=migrateBusiness({id:recipe.id,name:recipe.name,categoryId:recipe.id,categoryName:recipe.name,emoji:recipe.emoji,investmentCost:1e6,incomePerHour:recipe.resultIncomePerHour,taxRate:.13,taxDueAt:0,taxPaid:true,taxAmount:0,createdAt:NOW});
   const restored=createGameState({businesses:[business]},NOW);
   expect(income(restored,NOW).business).toBeCloseTo(recipe.resultIncomePerHour);
  }
 });
 it.each(businessMergers.map(recipe=>[recipe.id,recipe] as const))('completes the %s merger and survives a reload',(_id,recipe)=>{
  const state=createGameState({
   businesses:recipe.requiredCategories.map((categoryId,i)=>({id:'source-'+i,name:'Source',categoryId,categoryName:categoryId,emoji:'B',investmentCost:10000,incomePerHour:100,taxRate:.13,taxDueAt:0,taxPaid:true,taxAmount:0,createdAt:NOW})),
   stockHoldings:[{assetId:stockAssets[0].id,quantity:1000000,avgBuyPrice:stockAssets[0].basePrice}],
   cryptoHoldings:[{assetId:cryptoAssets[0].id,quantity:1000000,avgBuyPrice:cryptoAssets[0].basePrice}],
   purchasedShop:[{id:'re5',price:5000000},{id:'isl1',price:10000000}],
  },NOW);
  const merged=applyGameAction(state,action('merge-business',{id:recipe.id}),NOW);
  expect(merged.businesses).toHaveLength(1);
  expect(merged.businesses[0].categoryId).toBe(recipe.id);
  expect(income(createGameState(merged,NOW),NOW).business).toBeCloseTo(recipe.resultIncomePerHour);
 });
 it('accrues offline income once and limits a long absence to 12 hours',()=>{
  const state=createGameState({purchasedShop:[{id:'re1',price:50000}],savedAt:NOW-24*3600000},NOW);
  accrueGameState(state,NOW);expect(state.balance).toBeCloseTo(500*.93*12);
  const previous=state.balance;accrueGameState(state,NOW);expect(state.balance).toBe(previous);
 });
 it('keeps balance achievements after spending and reload',()=>{
  const state=createGameState({balance:1e6},NOW);updateAchievements(state,NOW);
  const unlocked=[...state.unlockedAchievements];expect(unlocked.length).toBeGreaterThan(0);
  state.balance=0;const restored=createGameState(state,NOW);updateAchievements(restored,NOW);
  expect(restored.unlockedAchievements).toEqual(unlocked);
 });
 it('applies the tax optimization upgrade to actual business income',()=>{
  const recipe=businessMergers[0];const legacy={id:'legacy',name:recipe.name,categoryId:recipe.id,categoryName:recipe.name,emoji:recipe.emoji,investmentCost:1000,incomePerHour:100,taxRate:.13,taxDueAt:0,taxPaid:true,taxAmount:0,createdAt:NOW};
  const state=createGameState({businesses:[legacy],upgradeLevels:[{id:'auto-tax',currentLevel:1}]},NOW);
  expect(income(state,NOW).business).toBeCloseTo(102);
 });
 it('preserves valid old upgrade progress but derives click power',()=>{
  const state=createGameState({clickPower:1e12,upgradeLevels:[{id:'click-power',currentLevel:3}]},NOW);
  expect(state.clickPower).toBe(4);expect(state.upgradeLevels[0].currentLevel).toBe(3);
  expect(upgradeLevels.every(l=>Number.isSafeInteger(l.cost)&&l.cost<=50_000_000)).toBe(true);
 });
 it.each(['RU','US','DE','PL','UA','CN'])('generates a valid random %s plate and charges exactly once',country=>{
  expect(validateCustomPlate(generateRandomPlate(country),country)).toBe(true);
  const state=applyGameAction(createGameState({balance:10000},NOW),action('buy-plate',{country,isCustom:false,text:'ATTACK'}),NOW);
  expect(state.balance).toBe(5000);expect(state.licensePlates).toHaveLength(1);
  expect(state.licensePlates[0].text).not.toBe('ATTACK');
 });
 it('requires the custom price and validates custom plate format',()=>{
  expect(()=>applyGameAction(createGameState({balance:5000},NOW),action('buy-plate',{country:'US',isCustom:true,text:'ABC 1234'}),NOW)).toThrow();
 });
 it('does not allow assigning a plate to a vehicle the player does not own',()=>{
  const state=createGameState({licensePlates:[{id:'p',text:'ABC 1234',country:'US',assignedTo:null,isCustom:true}]},NOW);
  expect(()=>applyGameAction(state,action('assign-plate',{id:'p',carId:'car1'}),NOW)).toThrow();
 });
});
