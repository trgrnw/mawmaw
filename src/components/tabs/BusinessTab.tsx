import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import GameIcon from '@/components/GameIcon';
import { useGame, formatMoney } from '@/context/GameContext';
import { businessCategories, generateBusinessName } from '@/data/businessNames';
import { businessMergers } from '@/data/mergerData';
import { useI18n } from '@/i18n/I18nContext';

type Section = 'portfolio' | 'launch' | 'mergers';

const BusinessTab: React.FC = () => {
  const game = useGame();
  const { t, td } = useI18n();
  const [section, setSection] = useState<Section>('portfolio');
  const [categoryId, setCategoryId] = useState(businessCategories[0]?.id ?? '');
  const [name, setName] = useState('');
  const [opening, setOpening] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const category = businessCategories.find(item => item.id === categoryId);

  const assets = useMemo(() => ({
    stocks: game.stockHoldings.reduce((sum, item) => sum + (game.stockPrices[item.assetId]?.current ?? 0) * item.quantity, 0),
    crypto: game.cryptoHoldings.reduce((sum, item) => sum + (game.cryptoPrices[item.assetId]?.current ?? 0) * item.quantity, 0),
    realEstate: game.shopItems.filter(item => item.purchased && item.category === 'realestate').reduce((sum, item) => sum + item.price, 0),
    islands: game.shopItems.filter(item => item.purchased && item.category === 'islands').length,
  }), [game.stockHoldings, game.stockPrices, game.cryptoHoldings, game.cryptoPrices, game.shopItems]);

  const createBusiness = async () => {
    if (!category || !name.trim() || opening) return;
    setOpening(true);
    try {
      if (!await game.openBusiness(category.id, name.trim())) {
        toast.error(t('biz.insufficient'));
        return;
      }
      toast.success(t('biz.open_btn'));
      setName('');
      setSection('portfolio');
    } catch (error) {
      console.error('[BusinessTab] create failed', error);
      toast.error('Не удалось сохранить бизнес. Попробуйте ещё раз.');
    } finally {
      setOpening(false);
    }
  };

  const sell = (id: string) => {
    if (deleteId !== id) return setDeleteId(id);
    game.deleteBusiness(id);
    setDeleteId(null);
    toast.success(t('biz.delete'));
  };

  const nav: Array<[Section, string, string]> = [
    ['portfolio', t('biz.my_businesses'), 'briefcase'],
    ['launch', t('biz.open'), 'build'],
    ['mergers', t('biz.merge'), 'merge'],
  ];

  return <div className="max-w-5xl space-y-5 pb-8">
    <header className="relative overflow-hidden rounded-3xl border border-sky-500/20 bg-card p-5 sm:p-7">
      <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15"><GameIcon name="business" size={26} themed /></div>
          <h2 className="text-2xl font-bold sm:text-3xl">{t('biz.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('biz.subtitle')}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metric label={t('biz.total_income')} value={`$${formatMoney(game.hourlyIncomeBusiness)}/ч`} />
          <Metric label={t('biz.taxes_due')} value={`$${formatMoney(game.totalTaxDue)}`} danger={game.totalTaxDue > 0} />
          <div className="col-span-2 sm:col-span-1"><Metric label={t('biz.balance')} value={`$${formatMoney(game.balance)}`} /></div>
        </div>
      </div>
    </header>

    <nav className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card/80 p-1.5">
      {nav.map(([id, label, icon]) => <button key={id} onClick={() => setSection(id)} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold transition-colors sm:text-sm ${section === id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><GameIcon name={icon} size={17} /><span className="truncate">{label}</span></button>)}
    </nav>

    {section === 'portfolio' && <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="text-xl font-bold">{t('biz.my_businesses')}</h3><p className="text-sm text-muted-foreground">{game.businesses.length} · ${formatMoney(game.hourlyIncomeBusiness)}{t('earning.per_hour')}</p></div>
        <button onClick={() => game.payTaxes()} disabled={game.totalTaxDue <= 0 || game.balance < game.totalTaxDue} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-500 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40">{t('biz.pay_taxes')}</button>
      </div>
      {game.businesses.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted"><GameIcon name="building" size={32} themed /></div>
        <h4 className="font-bold">{t('biz.no_businesses')}</h4><p className="mt-1 text-sm text-muted-foreground">{t('biz.open_first')}</p>
        <button onClick={() => setSection('launch')} className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">{t('biz.open')}</button>
      </div> : <div className="grid gap-3 md:grid-cols-2">{game.businesses.map(business => {
        const overdue = !business.taxPaid && Date.now() >= business.taxDueAt;
        const confirming = deleteId === business.id;
        return <article key={business.id} className={`rounded-2xl border bg-card p-5 ${overdue ? 'border-destructive/40' : 'border-border'}`}>
          <div className="flex items-start gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/10"><GameIcon name={business.categoryId || 'business'} size={24} themed /></div><div className="min-w-0 flex-1"><h4 className="truncate font-bold">{business.name}</h4><p className="text-xs text-muted-foreground">{td(`d.bizcat.${business.categoryId}`, business.categoryName)}</p></div>{overdue && <span className="rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-bold text-destructive">{t('biz.tax_unpaid')}</span>}</div>
          <div className="mt-4 grid grid-cols-2 gap-2"><Mini label={t('biz.income')} value={`$${formatMoney(business.incomePerHour)}/ч`} /><Mini label={t('biz.cost')} value={`$${formatMoney(business.investmentCost)}`} /></div>
          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3"><span className="text-xs text-muted-foreground">{t('biz.refund')}: <b className="text-foreground">${formatMoney(business.investmentCost * .45)}</b></span><button onClick={() => sell(business.id)} onBlur={() => setDeleteId(current => current === business.id ? null : current)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${confirming ? 'bg-destructive text-destructive-foreground' : 'text-destructive hover:bg-destructive/10'}`}>{confirming ? t('biz.delete_confirm') : t('biz.delete')}</button></div>
        </article>;
      })}</div>}
    </section>}

    {section === 'launch' && category && <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
      <div className="rounded-3xl border border-border bg-card p-4 sm:p-5"><h3 className="text-xl font-bold">{t('biz.choose_category')}</h3><div className="mt-4 grid gap-2 sm:grid-cols-2">{businessCategories.map(item => {
        const selected = item.id === categoryId;
        const affordable = game.balance >= item.cost;
        return <button key={item.id} onClick={() => { setCategoryId(item.id); setName(''); }} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${selected ? 'border-sky-400 bg-sky-500/10' : 'border-border hover:bg-muted/60'}`}><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted"><GameIcon name={item.id} size={21} themed /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{td(`d.bizcat.${item.id}`, item.name)}</p><p className="text-xs text-muted-foreground">${formatMoney(item.baseIncomePerHour)}/ч</p></div><div className="text-right"><p className="text-xs font-bold">${formatMoney(item.cost)}</p>{!affordable && <p className="text-[9px] text-destructive">{t('biz.insufficient')}</p>}</div></button>;
      })}</div></div>
      <aside className="h-fit rounded-3xl border border-sky-500/20 bg-card p-5 lg:sticky lg:top-4">
        <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10"><GameIcon name={category.id} size={25} themed /></div><div><h4 className="font-bold">{td(`d.bizcat.${category.id}`, category.name)}</h4><p className="text-xs text-muted-foreground">{t('biz.tax')}: 23% · {t('biz.every_72h')}</p></div></div>
        <div className="my-5 space-y-2"><Mini label={t('biz.cost')} value={`$${formatMoney(category.cost)}`} /><Mini label={t('biz.income')} value={`$${formatMoney(category.baseIncomePerHour)}/ч`} /></div>
        <label className="text-xs font-semibold text-muted-foreground">{t('biz.name_label')}</label><div className="mt-2 flex gap-2"><input value={name} onChange={event => setName(event.target.value)} maxLength={30} placeholder={t('biz.name_placeholder')} className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-sky-400" /><button onClick={() => setName(generateBusinessName(category.id))} className="rounded-xl border border-border px-3 hover:bg-muted" aria-label="Generate name"><GameIcon name="random" size={18} /></button></div>
        <button onClick={createBusiness} disabled={opening || !name.trim() || game.balance < category.cost} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">{opening ? 'Сохраняю…' : t('biz.open_btn')}</button>
      </aside>
    </section>}

    {section === 'mergers' && <section className="space-y-4"><div><h3 className="text-xl font-bold">{t('biz.merge')}</h3><p className="text-sm text-muted-foreground">Объединяйте компании и создавайте корпорации с повышенным доходом.</p></div><div className="grid gap-3 md:grid-cols-2">{businessMergers.map(merger => {
      const checks = [
        ...merger.requiredCategories.map(id => ({ id, met: game.businesses.some(business => business.categoryId === id) })),
        ...(merger.minStockPortfolio ? [{ id: `Акции ≥ $${formatMoney(merger.minStockPortfolio)}`, met: assets.stocks >= merger.minStockPortfolio }] : []),
        ...(merger.minCryptoPortfolio ? [{ id: `Криптовалюта ≥ $${formatMoney(merger.minCryptoPortfolio)}`, met: assets.crypto >= merger.minCryptoPortfolio }] : []),
        ...(merger.minRealEstateValue ? [{ id: `Недвижимость ≥ $${formatMoney(merger.minRealEstateValue)}`, met: assets.realEstate >= merger.minRealEstateValue }] : []),
        ...(merger.minIslandCount ? [{ id: `Острова ${assets.islands}/${merger.minIslandCount}`, met: assets.islands >= merger.minIslandCount }] : []),
      ];
      const available = checks.every(check => check.met);
      return <article key={merger.id} className={`rounded-2xl border bg-card p-5 ${available ? 'border-purple-400/50' : 'border-border'}`}><div className="flex items-start justify-between gap-3"><div><GameIcon name="merge" size={30} themed /><h4 className="mt-2 text-lg font-bold">{td(`d.merger.${merger.id}`, merger.name)}</h4></div><span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-400">${formatMoney(merger.resultIncomePerHour)}/ч</span></div><div className="my-4 space-y-2">{checks.map(check => { const cat = businessCategories.find(item => item.id === check.id); return <div key={check.id} className="flex items-center gap-2 text-xs"><GameIcon name={check.met ? 'success' : 'cancel'} size={14} className={check.met ? 'text-emerald-500' : 'text-destructive'} /><span className={check.met ? 'text-foreground' : 'text-muted-foreground'}>{cat ? td(`d.bizcat.${cat.id}`, cat.name) : check.id}</span></div>; })}</div><button disabled={!available} onClick={() => { if (game.mergeBusiness(merger.id)) { toast.success(t('biz.merge')); setSection('portfolio'); } }} className="w-full rounded-xl bg-purple-500 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">{available ? 'Создать корпорацию' : t('biz.merge_locked')}</button></article>;
    })}</div></section>}
  </div>;
};

const Metric = ({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) => <div className="min-w-32 rounded-2xl border border-border/70 bg-background/50 px-4 py-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className={`mt-1 whitespace-nowrap font-mono-game text-sm font-bold ${danger ? 'text-destructive' : 'text-foreground'}`}>{value}</p></div>;
const Mini = ({ label, value }: { label: string; value: string }) => <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5 text-xs"><span className="text-muted-foreground">{label}</span><strong className="font-mono-game">{value}</strong></div>;

export default BusinessTab;
