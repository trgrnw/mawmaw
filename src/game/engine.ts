import { businessCategories } from '@/data/businessNames';
import { businessMergers } from '@/data/mergerData';
import { stockAssets, cryptoAssets } from '@/data/investmentData';
import { shopItemsData, accessoryItemsData, carEngineOptions, carTrimOptions, finishOptions, crewOption } from '@/data/shopData';
import { defaultUpgrades, upgradeLevels } from './upgrades';
import { getBusinessPlan, migrateBusiness, calculateBusinessNet, createLicense, BUSINESS_LEGAL_FORMS, ENTREPRENEUR_LICENSE_COST } from './businessLifecycle';
import { BANK_CARD_DESIGNS, normalizeBankCardState } from './bankCards';
import { REAL_ESTATE_UPGRADES } from './realEstate';
import { sharedMarketPrices } from './marketEngine';
import { progressionFromXp, rewardsBetweenLevels } from './progression';
import { achievements } from '@/data/achievementsData';
import { generateRandomPlate, validateCustomPlate, PLATE_COUNTRIES } from './licensePlates';
import type { Business, LicensePlateState } from './types';

export const MAX_MONEY = 1e14;
export interface GameAction { id: string; type: string; args: Record<string, unknown> }
export interface EngineState {
  [key:string]: unknown;
  balance: number; playerXp: number; clickPower: number;
  totalEarnedClick: number; totalEarnedBusiness: number; totalEarnedRent: number;
  totalEarnedDividends: number; totalEarnedTrading: number; totalEarnedCrypto: number; totalEarnedGems: number;
  upgradeLevels: Array<{id:string;currentLevel:number}>;
  purchasedShop: Array<{id:string;price:number}>; purchasedAccessories: Array<{id:string;price:number}>;
  businesses: Business[]; stockHoldings: Array<{assetId:string;quantity:number;avgBuyPrice:number}>;
  cryptoHoldings: Array<{assetId:string;quantity:number;avgBuyPrice:number}>;
  licensePlates: LicensePlateState[]; realEstateUpgrades: Record<string,string[]>;
  entrepreneurLicense: ReturnType<typeof createLicense> | null;
  bankCard: ReturnType<typeof normalizeBankCardState>; unlockedAchievements: string[];
  savedAt: number; lastAccruedAt: number; clickCredit: number; clickCreditAt: number;
}
const amount = (v: unknown, fallback=0) => typeof v === 'number' && Number.isFinite(v) && v>=0 ? Math.min(MAX_MONEY,v) : fallback;
const list = <T>(v:unknown): T[] => Array.isArray(v) ? v.slice(0,1000) as T[] : [];
const level = (s:EngineState,id:string)=>s.upgradeLevels.find(x=>x.id===id)?.currentLevel || 0;
const credit=(s:EngineState,value:number)=>{if(!Number.isFinite(value))throw Error('Invalid amount');s.balance=Math.min(MAX_MONEY,Math.max(0,s.balance+value));};
const charge=(s:EngineState,value:number)=>{if(!Number.isFinite(value)||value<0||s.balance<value)throw Error('Недостаточно средств');s.balance-=value;};
const xp=(s:EngineState,n:number)=>{const old=progressionFromXp(s.playerXp).level;s.playerXp=Math.min(1e9,s.playerXp+n);const reward=rewardsBetweenLevels(old,progressionFromXp(s.playerXp).level);credit(s,reward);s.totalEarnedGems+=reward;};
export function createGameState(saved: Record<string,unknown> = {}, now=Date.now()):EngineState {
  const upgrades=defaultUpgrades.map(u=>({id:u.id,currentLevel:Math.min(u.maxLevel,Math.floor(amount(list<{id:string;currentLevel:number}>(saved.upgradeLevels).find(x=>x.id===u.id)?.currentLevel)))}));
  const numeric=Object.fromEntries(['balance','playerXp','totalEarnedClick','totalEarnedBusiness','totalEarnedRent','totalEarnedDividends','totalEarnedTrading','totalEarnedCrypto','totalEarnedGems'].map(k=>[k,amount(saved[k])]));
  return {...numeric,playerXp:Math.min(1e9,amount(saved.playerXp)),clickPower:1+upgradeLevels.slice(0,upgrades[0].currentLevel).reduce((s,l)=>s+l.bonus,0),upgradeLevels:upgrades,
    purchasedShop:list<{id:string;price:number}>(saved.purchasedShop).filter(x=>shopItemsData.some(i=>i.id===x.id)).map(x=>({id:x.id,price:amount(x.price,shopItemsData.find(i=>i.id===x.id)!.basePrice)})),
    purchasedAccessories:list<string|{id:string;price:number}>(saved.purchasedAccessories).map(x=>typeof x==='string'?{id:x,price:accessoryItemsData.find(i=>i.id===x)?.basePrice||0}:x).filter(x=>accessoryItemsData.some(i=>i.id===x.id)),
    businesses:list<Business>(saved.businesses).flatMap(b=>{try{return [migrateBusiness(b)]}catch{return []}}),
    stockHoldings:list<EngineState['stockHoldings'][number]>(saved.stockHoldings).filter(h=>stockAssets.some(a=>a.id===h.assetId)&&amount(h.quantity)>0),
    cryptoHoldings:list<EngineState['cryptoHoldings'][number]>(saved.cryptoHoldings).filter(h=>cryptoAssets.some(a=>a.id===h.assetId)&&amount(h.quantity)>0),
    licensePlates:list<LicensePlateState>(saved.licensePlates),realEstateUpgrades:(saved.realEstateUpgrades||{}) as Record<string,string[]>,entrepreneurLicense:(saved.entrepreneurLicense||null) as EngineState['entrepreneurLicense'],
    bankCard:normalizeBankCardState(saved.bankCard,progressionFromXp(Math.min(1e9,amount(saved.playerXp))).level),unlockedAchievements:list<string>(saved.unlockedAchievements),
    savedAt:now,lastAccruedAt:amount(saved.lastAccruedAt,amount(saved.savedAt,now)),clickCredit:Math.min(200,amount(saved.clickCredit,200)),clickCreditAt:amount(saved.clickCreditAt,now)} as EngineState;
}
let priceCache: { at: number; value: ReturnType<typeof sharedMarketPrices> } | undefined;
function pricesAt(now: number) {
  const at = Math.floor(now / 1000) * 1000;
  if (!priceCache || priceCache.at !== at) priceCache = { at, value: sharedMarketPrices(stockAssets, cryptoAssets, at) };
  return priceCache.value;
}
export function income(s:EngineState,now=Date.now()) {
  const prices=pricesAt(now);
  const rent=s.purchasedShop.reduce((sum,item)=>{const d=shopItemsData.find(x=>x.id===item.id);if(d?.categoryId!=='realestate')return sum;const bonus=(s.realEstateUpgrades[item.id]||[]).reduce((a,id)=>a+(REAL_ESTATE_UPGRADES.find(x=>x.id===id)?.incomeBonus||0),0);return sum+(d.baseIncomePerHour||0)*(1+bonus)*.93;},0);
  const business=s.businesses.reduce((n,b)=>n+calculateBusinessNet(b)*(level(s,'auto-tax')?1.02:1),0);
  const dividends=s.stockHoldings.reduce((n,h)=>n+(stockAssets.find(a=>a.id===h.assetId)?.dividendYield||0)*prices.stocks[h.assetId].current*h.quantity/8760,0);
  return {rent,business,dividends,prices};
}
export function accrueGameState(s:EngineState,now=Date.now()) {
  const seconds=Math.min(43200,Math.max(0,(now-s.lastAccruedAt)/1000));const i=income(s,now);
  const r=i.rent/3600*seconds,b=i.business/3600*seconds,d=i.dividends/3600*seconds,c=level(s,'autoclicker')?s.clickPower*seconds:0;
  credit(s,r+b+d+c);s.totalEarnedRent+=r;s.totalEarnedBusiness+=b;s.totalEarnedDividends+=d;s.totalEarnedClick+=c;s.lastAccruedAt=now;s.bankCard=normalizeBankCardState(s.bankCard,progressionFromXp(s.playerXp).level);s.savedAt=now;updateAchievements(s,now);return s;
}
export function updateAchievements(s:EngineState,now=Date.now()) {
  const {prices}=income(s,now);const netWorth=assetWorth(s,now);
  const metrics:Record<string,number>={...Object.fromEntries(['balance','clickPower','totalEarnedClick','totalEarnedBusiness','totalEarnedRent','totalEarnedDividends','totalEarnedTrading','totalEarnedCrypto'].map(k=>[k,s[k as keyof EngineState] as number])),netWorth,businessCount:s.businesses.length,businessInvestTotal:s.businesses.reduce((n,b)=>n+b.investmentCost,0),businessCategoryCount:new Set(s.businesses.map(b=>b.categoryId)).size,shopCount:s.purchasedShop.length,accessoryCount:s.purchasedAccessories.length,stockUniqueCount:s.stockHoldings.length,cryptoUniqueCount:s.cryptoHoldings.length,stockPortfolioValue:s.stockHoldings.reduce((n,h)=>n+prices.stocks[h.assetId].current*h.quantity,0),cryptoPortfolioValue:s.cryptoHoldings.reduce((n,h)=>n+prices.crypto[h.assetId].current*h.quantity,0),upgradeLevel:s.upgradeLevels.reduce((n,u)=>n+u.currentLevel,0),upgradeSpent:s.upgradeLevels.reduce((n,u)=>n+(defaultUpgrades.find(x=>x.id===u.id)?.levels.slice(0,u.currentLevel).reduce((v,l)=>v+l.cost,0)||0),0)};
  for(const a of achievements){let value=metrics[a.metric]||0;const [kind,id]=a.metric.split(':');if(kind==='shopCategoryCount')value=s.purchasedShop.filter(x=>shopItemsData.find(d=>d.id===x.id)?.categoryId===id).length;if(kind==='accCategoryCount')value=s.purchasedAccessories.filter(x=>accessoryItemsData.find(d=>d.id===x.id)?.categoryId===id).length;if(kind==='hasCrypto')value=s.cryptoHoldings.some(h=>h.assetId===id)?1:0;if(value>=a.threshold&&!s.unlockedAchievements.includes(a.id))s.unlockedAchievements.push(a.id);}
}
export function assetWorth(s:EngineState,now=Date.now()) {const {prices}=income(s,now);return Math.min(MAX_MONEY,s.purchasedShop.reduce((n,x)=>n+x.price,0)+s.purchasedAccessories.reduce((n,x)=>n+x.price,0)+s.businesses.reduce((n,x)=>n+x.investmentCost,0)+s.stockHoldings.reduce((n,h)=>n+prices.stocks[h.assetId].current*h.quantity,0)+s.cryptoHoldings.reduce((n,h)=>n+prices.crypto[h.assetId].current*h.quantity,0));}
export function applyGameAction(s:EngineState,action:GameAction,now=Date.now()):EngineState {
  const a=action.args,id=String(a.id||''), business=()=>{const b=s.businesses.find(x=>x.id===id);if(!b)throw Error('Предприятие не найдено');return b;};
  switch(action.type){
    case 'click': {const count=Number(a.count);if(!Number.isInteger(count)||count<1||count>40)throw Error('Invalid click count');const available=Math.min(200,s.clickCredit+Math.max(0,now-s.clickCreditAt)/1000*20);if(count>available)throw Error('Слишком частые клики');s.clickCredit=available-count;s.clickCreditAt=now;credit(s,s.clickPower*count);s.totalEarnedClick+=s.clickPower*count;xp(s,count);break;}
    case 'upgrade': {const u=defaultUpgrades.find(x=>x.id===id),l=level(s,id);if(!u||l>=u.maxLevel)throw Error('Улучшение недоступно');charge(s,u.levels[l].cost);s.upgradeLevels.find(x=>x.id===id)!.currentLevel++;if(id==='click-power')s.clickPower+=u.levels[l].bonus;xp(s,15+l*5);break;}
    case 'buy-shop': {const item=shopItemsData.find(x=>x.id===id);if(!item||s.purchasedShop.some(x=>x.id===id))throw Error('Покупка недоступна');const p=Number(a.price??item.basePrice);let multipliers=[1];if(item.categoryId==='cars')multipliers=carEngineOptions.flatMap(e=>carTrimOptions.map(t=>1+e.priceMultiplier+t.priceMultiplier));if(['ships','planes'].includes(item.categoryId))multipliers=[false,true].flatMap(c=>finishOptions.map(f=>1+(c?crewOption.priceMultiplier:0)+f.priceMultiplier));if(!multipliers.some(m=>Math.round(item.basePrice*m)===p))throw Error('Invalid price');charge(s,p);s.purchasedShop.push({id,price:p});xp(s,40);break;}
    case 'sell-shop': {const item=s.purchasedShop.find(x=>x.id===id);if(!item)throw Error('Нет предмета');credit(s,Math.round(item.price*.25));s.purchasedShop=s.purchasedShop.filter(x=>x.id!==id);delete s.realEstateUpgrades[id];s.licensePlates=s.licensePlates.map(p=>p.assignedTo===id?{...p,assignedTo:null}:p);break;}
    case 'buy-accessory': {const item=accessoryItemsData.find(x=>x.id===id);if(!item||s.purchasedAccessories.some(x=>x.id===id))throw Error('Покупка недоступна');charge(s,item.basePrice);s.purchasedAccessories.push({id,price:item.basePrice});xp(s,30);break;}
    case 'sell-accessory': {const item=s.purchasedAccessories.find(x=>x.id===id);if(!item||accessoryItemsData.find(x=>x.id===id)?.categoryId==='misc')throw Error('Продажа недоступна');credit(s,Math.round(item.price*.25));s.purchasedAccessories=s.purchasedAccessories.filter(x=>x.id!==id);break;}
    case 'realestate-upgrade': {const item=s.purchasedShop.find(x=>x.id===id),u=REAL_ESTATE_UPGRADES.find(x=>x.id===a.upgradeId);if(!item||shopItemsData.find(x=>x.id===id)?.categoryId!=='realestate'||!u||(s.realEstateUpgrades[id]||[]).includes(u.id))throw Error('Улучшение недоступно');charge(s,Math.round(item.price*u.costRate));s.realEstateUpgrades[id]=[...(s.realEstateUpgrades[id]||[]),u.id];xp(s,25);break;}
    case 'license': {const country=String(a.country);if(s.entrepreneurLicense||!BUSINESS_LEGAL_FORMS[country])throw Error('Лицензия недоступна');charge(s,ENTREPRENEUR_LICENSE_COST);s.entrepreneurLicense=createLicense(country,now);xp(s,20);break;}
    case 'open-business': {const cat=businessCategories.find(x=>x.id===a.categoryId),name=String(a.name||'').trim();if(!cat||!s.entrepreneurLicense||name.length<1||name.length>80||s.businesses.length>=1000)throw Error('Регистрация недоступна');const p=getBusinessPlan(cat.id);charge(s,p.registrationCost);s.businesses.push({id:action.id,name,categoryId:cat.id,categoryName:cat.name,emoji:cat.emoji,investmentCost:p.registrationCost,incomePerHour:0,taxRate:p.taxRate,taxDueAt:now+259200000,taxPaid:true,taxAmount:0,createdAt:now,status:'registered',registrationNumber:`ENT-${action.id}`,completedSetupSteps:[],employeesHired:0,employeesRequired:p.employeesRequired,grossRevenuePerHour:cat.baseIncomePerHour,salaryCostPerHour:0,operatingCostPerHour:p.operatingCostPerHour,taxCostPerHour:0});xp(s,75);break;}
    case 'setup-business': {const b=business(),p=getBusinessPlan(b.categoryId),done=b.completedSetupSteps||[],step=p.steps.find(x=>!done.includes(x.id));if(b.status==='operating'||!step||step.id!==a.stepId)throw Error('Неверный этап');charge(s,step.cost);b.completedSetupSteps=[...done,step.id];b.status=b.completedSetupSteps.length===p.steps.length?'staffing':step.stage;b.investmentCost+=step.cost;xp(s,35);break;}
    case 'hire-business': {const b=business(),p=getBusinessPlan(b.categoryId);if(b.status==='operating'||b.completedSetupSteps?.length!==p.steps.length)throw Error('Команда недоступна');charge(s,p.hiringCost);b.status='operating';b.employeesHired=b.employeesRequired=p.employeesRequired;b.salaryCostPerHour=p.employeesRequired*p.salaryPerEmployee;b.operatingCostPerHour=p.operatingCostPerHour;b.taxCostPerHour=(b.grossRevenuePerHour||0)*p.taxRate;b.incomePerHour=calculateBusinessNet(b);b.investmentCost+=p.hiringCost;xp(s,80);break;}
    case 'sell-business': {const b=business();credit(s,b.investmentCost*.45);s.businesses=s.businesses.filter(x=>x.id!==id);break;}
    case 'merge-business': {const m=businessMergers.find(x=>x.id===id);if(!m)throw Error('Нет рецепта');const consumed:Business[]=[];for(const cat of m.requiredCategories){const b=s.businesses.find(x=>x.categoryId===cat&&x.status==='operating'&&!consumed.includes(x));if(!b)throw Error('Не хватает предприятий');consumed.push(b);}const {prices}=income(s,now);if(s.stockHoldings.reduce((n,h)=>n+prices.stocks[h.assetId].current*h.quantity,0)<(m.minStockPortfolio||0)||s.cryptoHoldings.reduce((n,h)=>n+prices.crypto[h.assetId].current*h.quantity,0)<(m.minCryptoPortfolio||0)||s.purchasedShop.filter(x=>shopItemsData.find(d=>d.id===x.id)?.categoryId==='islands').length<(m.minIslandCount||0)||s.purchasedShop.filter(x=>shopItemsData.find(d=>d.id===x.id)?.categoryId==='realestate').reduce((n,x)=>n+x.price,0)<(m.minRealEstateValue||0))throw Error('Не выполнены условия объединения');s.businesses=s.businesses.filter(x=>!consumed.includes(x));s.businesses.push(migrateBusiness({id:action.id,name:m.name,categoryId:m.id,categoryName:m.name,emoji:m.emoji,investmentCost:consumed.reduce((n,b)=>n+b.investmentCost,0),incomePerHour:m.resultIncomePerHour,taxRate:.13,taxDueAt:now+259200000,taxPaid:true,taxAmount:0,createdAt:now}));xp(s,150);break;}
    case 'buy-stock':case 'sell-stock':case 'buy-crypto':case 'sell-crypto': {const quantity=Number(a.quantity),crypto=action.type.endsWith('crypto'),buy=action.type.startsWith('buy'),assets=crypto?cryptoAssets:stockAssets,asset=assets.find(x=>x.id===id);if(!asset||!Number.isFinite(quantity)||quantity<=0||quantity>MAX_MONEY)throw Error('Invalid quantity');const limit='availableShares'in asset?asset.availableShares:asset.availableSupply;const holdings=crypto?s.cryptoHoldings:s.stockHoldings,h=holdings.find(x=>x.assetId===id);const price=(crypto?income(s,now).prices.crypto:income(s,now).prices.stocks)[id].current;if(buy){if(quantity+(h?.quantity||0)>limit)throw Error('Превышен объём выпуска');charge(s,quantity*price);if(h){h.avgBuyPrice=(h.quantity*h.avgBuyPrice+quantity*price)/(h.quantity+quantity);h.quantity+=quantity;}else holdings.push({assetId:id,quantity,avgBuyPrice:price});}else{if(!h||quantity>h.quantity)throw Error('Не хватает активов');credit(s,quantity*price);const profit=Math.max(0,(price-h.avgBuyPrice)*quantity);if(crypto)s.totalEarnedCrypto+=profit;else s.totalEarnedTrading+=profit;h.quantity-=quantity;if(!h.quantity)holdings.splice(holdings.indexOf(h),1);}break;}
    case 'buy-card': {const d=BANK_CARD_DESIGNS.find(x=>x.id===id);if(!d||d.unlockLevel||s.bankCard.ownedIds.includes(id))throw Error('Карта недоступна');charge(s,d.price);s.bankCard.ownedIds.push(id);s.bankCard.activeId=id;break;}
    case 'select-card': {s.bankCard=normalizeBankCardState(s.bankCard,progressionFromXp(s.playerXp).level);if(!s.bankCard.ownedIds.includes(id))throw Error('Карта заблокирована');s.bankCard.activeId=id;break;}
    case 'customize-card': {if(!/^\d{4}$/.test(String(a.customNumber))||!/^(0[1-9]|1[0-2])\/\d{2}$/.test(String(a.expiresAt))||(a.customColor!==null&&!/^#[0-9a-f]{6}$/i.test(String(a.customColor))))throw Error('Неверные реквизиты');s.bankCard={...s.bankCard,customNumber:String(a.customNumber),expiresAt:String(a.expiresAt),customColor:a.customColor as string|null};break;}
    case 'buy-plate': {
      const country=String(a.country||'');
      if(!PLATE_COUNTRIES.some(c=>c.id===country)||typeof a.isCustom!=='boolean')throw Error('Неверный номер');
      let text= a.isCustom ? String(a.text||'').trim().toUpperCase() : generateRandomPlate(country);
      if(a.isCustom && !validateCustomPlate(text,country))throw Error('Неверный номер');
      if(!a.isCustom){for(let n=0;n<50&&s.licensePlates.some(p=>p.text===text&&p.country===country);n++)text=generateRandomPlate(country);}
      if(s.licensePlates.some(p=>p.text===text&&p.country===country))throw Error('Номер уже есть');
      charge(s,a.isCustom?25000:5000);s.licensePlates.push({id:action.id,text,country,assignedTo:null,isCustom:a.isCustom});break;
    }
    case 'assign-plate': {const plate=s.licensePlates.find(x=>x.id===id),carId=a.carId===null?null:String(a.carId);if(!plate||(carId&&!s.purchasedShop.some(x=>x.id===carId&&shopItemsData.find(d=>d.id===x.id)?.categoryId==='cars')))throw Error('Назначение недоступно');s.licensePlates=s.licensePlates.map(p=>({...p,assignedTo:p.id===id?carId:carId&&p.assignedTo===carId?null:p.assignedTo}));break;}
    case 'delete-plate': if(!s.licensePlates.some(x=>x.id===id))throw Error('Нет номера');s.licensePlates=s.licensePlates.filter(x=>x.id!==id);break;
    default: throw Error('Unknown game action');
  }
  s.bankCard=normalizeBankCardState(s.bankCard,progressionFromXp(s.playerXp).level);s.savedAt=now;updateAchievements(s,now);return s;
}
export function gameView(s:EngineState,now=Date.now()) {
  const i=income(s,now),p=progressionFromXp(s.playerXp);return {...s,upgrades:defaultUpgrades.map(u=>({...u,currentLevel:level(s,u.id)})),shopItems:shopItemsData.map(d=>({id:d.id,name:d.name,emoji:d.emoji,category:d.categoryId,purchased:s.purchasedShop.some(x=>x.id===d.id),price:s.purchasedShop.find(x=>x.id===d.id)?.price||d.basePrice})),accessoryItems:accessoryItemsData.map(d=>({id:d.id,name:d.name,emoji:d.emoji,category:d.categoryId,purchased:s.purchasedAccessories.some(x=>x.id===d.id),price:d.basePrice})),stockPrices:i.prices.stocks,cryptoPrices:i.prices.crypto,playerLevel:p.level,levelStartXp:p.levelStartXp,nextLevelXp:p.nextLevelXp,levelProgress:p.progress,hourlyIncomeRent:i.rent,hourlyIncomeBusiness:i.business,hourlyIncomeDividends:i.dividends,hourlyIncome:i.rent+i.business+i.dividends,passiveIncome:(i.rent+i.business+i.dividends)/3600,netWorth:assetWorth(s,now),totalTaxDue:0};
}
