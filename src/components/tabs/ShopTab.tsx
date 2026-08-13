import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import GameIcon from '@/components/GameIcon';
import { useGame, formatMoney } from '@/context/GameContext';
import {
  carEngineOptions, carTrimOptions, crewOption, finishOptions,
  shopCategories, shopItemsData, type ShopItemData,
} from '@/data/shopData';
import { useI18n } from '@/i18n/I18nContext';

const ShopTab: React.FC = () => {
  const { t, td } = useI18n();
  const { balance, shopItems, buyShopItem, syncProgress } = useGame();
  const [categoryId, setCategoryId] = useState(shopCategories[0]?.id ?? '');
  const [selected, setSelected] = useState<ShopItemData | null>(null);
  const [engine, setEngine] = useState('df');
  const [trim, setTrim] = useState('standard');
  const [crew, setCrew] = useState(false);
  const [finish, setFinish] = useState('standard');
  const [buying, setBuying] = useState(false);

  const category = shopCategories.find(item => item.id === categoryId);
  const items = shopItemsData.filter(item => item.categoryId === categoryId);
  const ownedIds = useMemo(() => new Set(shopItems.filter(item => item.purchased).map(item => item.id)), [shopItems]);
  const ownedCount = ownedIds.size;
  const hourlyIncome = shopItemsData.reduce((sum, item) => ownedIds.has(item.id) ? sum + (item.baseIncomePerHour ?? 0) : sum, 0);

  const choose = (item: ShopItemData) => {
    if (ownedIds.has(item.id) || buying) return;
    setSelected(item);
    setEngine('df');
    setTrim('standard');
    setCrew(false);
    setFinish('standard');
  };

  const finalPrice = useMemo(() => {
    if (!selected) return 0;
    let multiplier = 1;
    if (selected.categoryId === 'cars') {
      multiplier += carEngineOptions.find(item => item.id === engine)?.priceMultiplier ?? 0;
      multiplier += carTrimOptions.find(item => item.id === trim)?.priceMultiplier ?? 0;
    }
    if (selected.categoryId === 'ships' || selected.categoryId === 'planes') {
      if (crew) multiplier += crewOption.priceMultiplier;
      multiplier += finishOptions.find(item => item.id === finish)?.priceMultiplier ?? 0;
    }
    return Math.round(selected.basePrice * multiplier);
  }, [crew, engine, finish, selected, trim]);

  const purchase = async () => {
    if (!selected || buying || balance < finalPrice) return;
    setBuying(true);
    try {
      if (!buyShopItem(selected.id, finalPrice)) {
        toast.error(t('biz.insufficient'));
        return;
      }
      await syncProgress();
      toast.success(t('shop.purchased'));
      setSelected(null);
    } catch (error) {
      console.error('[ShopTab] purchase save failed', error);
      toast.error('Покупка сохранена на устройстве. Облачная синхронизация повторится автоматически.');
      setSelected(null);
    } finally {
      setBuying(false);
    }
  };

  return <div className="max-w-6xl space-y-5 pb-8">
    <header className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-card p-5 sm:p-7">
      <div className="absolute -right-16 -top-20 h-60 w-60 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15"><GameIcon name="shop" size={26} themed /></div>
          <h2 className="text-2xl font-bold sm:text-3xl">{t('shop.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('shop.subtitle')}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Metric label={t('shop.balance')} value={`$${formatMoney(balance)}`} />
          <Metric label={t('shop.purchased')} value={`${ownedCount}/${shopItemsData.length}`} />
          <Metric label={t('shop.income')} value={`$${formatMoney(hourlyIncome)}/ч`} />
        </div>
      </div>
    </header>

    <section className="rounded-2xl border border-border bg-card/80 p-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {shopCategories.map(item => <button key={item.id} onClick={() => { setCategoryId(item.id); setSelected(null); }} className={`flex min-w-max items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${categoryId === item.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><GameIcon name={item.id} size={17} /><span>{td(`d.shopcat.${item.id}`, item.name)}</span></button>)}
      </div>
    </section>

    <div className={`grid gap-4 ${selected ? 'xl:grid-cols-[1fr_360px]' : ''}`}>
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          {category && <img src={category.image} alt="" className="h-12 w-12 rounded-xl object-cover" />}
          <div><h3 className="text-xl font-bold">{category ? td(`d.shopcat.${category.id}`, category.name) : ''}</h3><p className="text-sm text-muted-foreground">{category ? td(`d.shopcat.${category.id}.d`, category.description) : ''}</p></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(item => {
            const owned = ownedIds.has(item.id);
            const active = selected?.id === item.id;
            return <button key={item.id} disabled={owned || buying} onClick={() => choose(item)} className={`group overflow-hidden rounded-2xl border bg-card text-left transition-all ${owned ? 'cursor-default border-emerald-500/25 opacity-70' : active ? 'border-cyan-400 ring-2 ring-cyan-400/20' : 'border-border hover:-translate-y-0.5 hover:border-cyan-400/50 hover:shadow-lg'}`}>
              <div className="relative aspect-[4/3] overflow-hidden"><img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /><div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />{owned ? <span className="absolute right-2 top-2 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-bold text-white">{t('shop.purchased')}</span> : <span className="absolute right-2 top-2 rounded-full bg-black/65 px-2.5 py-1 font-mono-game text-xs text-white">${formatMoney(item.basePrice)}</span>}</div>
              <div className="p-4"><h4 className="truncate text-sm font-bold">{td(`d.shop.${item.id}`, item.name)}</h4><p className="mt-1 line-clamp-2 min-h-8 text-xs text-muted-foreground">{td(`d.shop.${item.id}.d`, item.description)}</p><div className="mt-3 flex items-center justify-between text-xs">{item.baseIncomePerHour ? <span className="font-semibold text-emerald-500">+${formatMoney(item.baseIncomePerHour)}{t('shop.per_hour')}</span> : <span className="text-muted-foreground">{item.capacity ? `${item.capacity} ${td(`d.shop.${item.id}.cu`, item.capacityUnit ?? '')}` : item.location ? td(`d.shop.${item.id}.loc`, item.location) : 'Премиум'}</span>}<span className="text-cyan-400">{owned ? '✓' : 'Выбрать →'}</span></div></div>
            </button>;
          })}
        </div>
      </section>

      {selected && <aside className="h-fit overflow-hidden rounded-3xl border border-cyan-500/25 bg-card xl:sticky xl:top-4">
        <div className="relative aspect-[16/10] overflow-hidden"><img src={selected.image} alt={selected.name} className="h-full w-full object-cover" /><div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-card to-transparent" /><button onClick={() => !buying && setSelected(null)} disabled={buying} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-lg text-white disabled:opacity-40">×</button></div>
        <div className="-mt-8 relative space-y-4 p-5 pt-0">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">{t('shop.confirm_title')}</p><h3 className="mt-1 text-xl font-bold">{td(`d.shop.${selected.id}`, selected.name)}</h3><p className="mt-1 text-xs text-muted-foreground">{td(`d.shop.${selected.id}.d`, selected.description)}</p></div>
          {selected.categoryId === 'cars' && <><Options title={t('shop.engine')} value={engine} setValue={setEngine} options={carEngineOptions} td={td} prefix="d.engine." /><Options title={t('shop.trim')} value={trim} setValue={setTrim} options={carTrimOptions} td={td} prefix="d.trim." /></>}
          {(selected.categoryId === 'ships' || selected.categoryId === 'planes') && <><div><p className="mb-2 text-xs font-semibold text-muted-foreground">{t('shop.crew')}</p><button onClick={() => setCrew(value => !value)} className={`w-full rounded-xl border px-3 py-2.5 text-xs font-semibold ${crew ? 'border-cyan-400 bg-cyan-500/10 text-cyan-400' : 'border-border hover:bg-muted'}`}>{crew ? t('shop.crew_hired') : t('shop.hire_crew')} · +25%</button></div><Options title={t('shop.finish')} value={finish} setValue={setFinish} options={finishOptions} td={td} prefix="d.finish." /></>}
          <div className="space-y-2 border-t border-border pt-4"><Row label={t('shop.total')} value={`$${formatMoney(finalPrice)}`} strong /><Row label={t('shop.balance')} value={`$${formatMoney(balance)}`} /><button onClick={purchase} disabled={buying || balance < finalPrice} className="mt-2 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">{buying ? 'Сохраняю в облако…' : balance < finalPrice ? t('biz.insufficient') : t('shop.confirm_buy')}</button></div>
        </div>
      </aside>}
    </div>
  </div>;
};

type Option = { id: string; name: string; priceMultiplier: number };
const Options = ({ title, value, setValue, options, td, prefix }: { title: string; value: string; setValue: (id: string) => void; options: Option[]; td: (key: string, fallback: string) => string; prefix: string }) => <div><p className="mb-2 text-xs font-semibold text-muted-foreground">{title}</p><div className="grid grid-cols-2 gap-2">{options.map(option => <button key={option.id} onClick={() => setValue(option.id)} className={`rounded-xl border px-2 py-2.5 text-xs font-semibold ${value === option.id ? 'border-cyan-400 bg-cyan-500/10 text-cyan-400' : 'border-border hover:bg-muted'}`}>{td(prefix + option.id, option.name)}{option.priceMultiplier > 0 && <span className="block text-[10px] opacity-70">+{option.priceMultiplier * 100}%</span>}</button>)}</div></div>;
const Metric = ({ label, value }: { label: string; value: string }) => <div className="rounded-2xl border border-border/70 bg-background/50 px-3 py-3"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 whitespace-nowrap font-mono-game text-xs font-bold sm:text-sm">{value}</p></div>;
const Row = ({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) => <div className="flex items-center justify-between"><span className={strong ? 'font-semibold' : 'text-xs text-muted-foreground'}>{label}</span><span className={`font-mono-game ${strong ? 'text-lg font-bold' : 'text-xs'}`}>{value}</span></div>;

export default ShopTab;
