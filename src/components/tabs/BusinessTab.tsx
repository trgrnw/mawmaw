import React, { useState } from 'react';
import { useGame, formatMoney } from '@/context/GameContext';
import { useI18n } from '@/i18n/I18nContext';
import { businessCategories, generateBusinessName } from '@/data/businessNames';
import { businessMergers } from '@/data/mergerData';
import GameIcon from '@/components/GameIcon';

type View = 'main' | 'open' | 'name' | 'merge';

const BusinessTab: React.FC = () => {
  const { businesses, balance, hourlyIncomeBusiness, totalTaxDue, openBusiness, mergeBusiness, deleteBusiness, payTaxes, stockHoldings, cryptoHoldings, stockPrices, cryptoPrices, shopItems } = useGame();
  const { t, td } = useI18n();
  const [view, setView] = useState<View>('main');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const selectedCategory = businessCategories.find(c => c.id === selectedCategoryId);

  const handleSelectCategory = (catId: string) => {
    setSelectedCategoryId(catId);
    setBusinessName('');
    setView('name');
  };

  const handleGenerateName = () => {
    if (selectedCategoryId) {
      setBusinessName(generateBusinessName(selectedCategoryId));
    }
  };

  const handleOpenBusiness = () => {
    if (selectedCategoryId && businessName.trim()) {
      const success = openBusiness(selectedCategoryId, businessName.trim());
      if (success) {
        setView('main');
        setSelectedCategoryId(null);
        setBusinessName('');
      }
    }
  };

  const handleDeleteBusiness = (bizId: string) => {
    if (confirmDeleteId === bizId) {
      deleteBusiness(bizId);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(bizId);
      setTimeout(() => setConfirmDeleteId(null), 5000);
    }
  };

  // Main view
  if (view === 'main') {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-1 flex items-center gap-2"><GameIcon name="business" size={24} themed /> {t('biz.title')}</h2>
          <p className="text-muted-foreground text-sm">{t('biz.subtitle')}</p>
        </div>

        {/* Income & Tax summary card */}
        <div className="stat-card rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('biz.total_income')}</p>
              <p className="text-3xl font-bold font-mono-game text-foreground">${formatMoney(hourlyIncomeBusiness)}<span className="text-sm font-normal text-muted-foreground ml-1">{t('earning.per_hour')}</span></p>
            </div>
            <GameIcon name="briefcase" size={48} themed />
          </div>
          <div className="border-t border-border/50 pt-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t('biz.taxes_due')} <span className="text-xs">{t('biz.tax_note')}</span>
              </p>
              <p className={`font-mono-game font-semibold text-sm ${totalTaxDue > 0 ? 'text-destructive' : 'text-foreground'}`}>
                ${formatMoney(totalTaxDue)}
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setView('open')}
            className="rounded-xl p-4 bg-card border border-sky-300 hover:border-sky-400 hover:shadow-md transition-all text-center"
          >
            <span className="block mb-1"><GameIcon name="build" size={28} themed /></span>
            <p className="text-sm font-semibold text-foreground">{t('biz.open')}</p>
          </button>
          <button
            onClick={() => setView('merge')}
            className="rounded-xl p-4 bg-card border border-purple-300 hover:border-purple-400 hover:shadow-md transition-all text-center"
          >
            <span className="block mb-1"><GameIcon name="merge" size={28} themed /></span>
            <p className="text-sm font-semibold text-foreground">{t('biz.merge')}</p>
          </button>
          <button
            onClick={() => totalTaxDue > 0 && payTaxes()}
            className={`rounded-xl p-4 border text-center transition-all ${
              totalTaxDue > 0 && balance >= totalTaxDue
                ? 'bg-card border-destructive/50 hover:border-destructive hover:shadow-md cursor-pointer'
                : 'bg-card border-border opacity-60 cursor-not-allowed'
            }`}
          >
            <span className="block mb-1"><GameIcon name="taxes" size={28} /></span>
            <p className="text-sm font-semibold text-foreground">{t('biz.pay_taxes')}</p>
          </button>
        </div>

        {/* Business list */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">{t('biz.my_businesses')} ({businesses.length})</h3>
          {businesses.length === 0 ? (
            <div className="stat-card rounded-2xl p-8 flex flex-col items-center justify-center min-h-[200px]">
              <GameIcon name="building" size={48} className="text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-center">
                {t('biz.no_businesses')}<br />{t('biz.open_first')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {businesses.map(biz => {
                const isOverdue = !biz.taxPaid && Date.now() >= biz.taxDueAt;
                const isConfirming = confirmDeleteId === biz.id;
                const refund = biz.investmentCost * 0.45;
                return (
                  <div
                    key={biz.id}
                    className={`rounded-xl p-4 border bg-card transition-all ${
                      isOverdue ? 'border-destructive/40 bg-destructive/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                        <GameIcon name={biz.emoji || 'business'} size={24} themed />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-foreground truncate">{biz.name}</h4>
                        <p className="text-xs text-muted-foreground">{td(`d.bizcat.${biz.categoryId || ''}`, biz.categoryName)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono-game text-sm font-semibold text-foreground">
                          ${formatMoney(biz.incomePerHour)}{t('earning.per_hour')}
                        </p>
                        {isOverdue && (
                          <p className="text-[10px] text-destructive font-medium">{t('biz.tax_unpaid')}</p>
                        )}
                      </div>
                    </div>
                    {/* Management actions */}
                    <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {t('biz.refund')}: <span className="font-mono-game text-foreground">${formatMoney(refund)}</span> (45%)
                      </div>
                      <button
                        onClick={() => handleDeleteBusiness(biz.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          isConfirming
                            ? 'bg-destructive text-destructive-foreground'
                            : 'border border-destructive/30 text-destructive hover:bg-destructive/10'
                        }`}
                      >
                        {isConfirming ? t('biz.delete_confirm') : t('biz.delete')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Open business — category selection
  if (view === 'open') {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('main')}
            className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-accent transition-colors"
          >
            ←
          </button>
          <div>
            <h2 className="text-2xl font-bold">{t('biz.open')}</h2>
            <p className="text-muted-foreground text-sm">{t('biz.choose_category')}</p>
          </div>
        </div>

        <div className="space-y-3">
          {businessCategories.map(cat => {
            const canAfford = balance >= cat.cost;
            return (
              <div
                key={cat.id}
                onClick={() => canAfford && handleSelectCategory(cat.id)}
                className={`rounded-xl p-4 border transition-all ${
                  canAfford
                    ? 'bg-card border-sky-300 hover:border-sky-400 hover:shadow-md cursor-pointer'
                    : 'bg-card border-border opacity-60'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <GameIcon name={cat.id} size={24} themed />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">{td(`d.bizcat.${cat.id}`, cat.name)}</h4>
                    <p className="text-xs text-muted-foreground">{t('biz.income')}: ${formatMoney(cat.baseIncomePerHour)}{t('earning.per_hour')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono-game text-sm font-semibold text-foreground">${formatMoney(cat.cost)}</p>
                    {!canAfford && (
                      <p className="text-[10px] text-destructive">{t('biz.insufficient')}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="stat-card rounded-xl p-3 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('biz.your_balance')}:</span>
          <span className="font-mono-game font-semibold text-foreground">${formatMoney(balance)}</span>
        </div>
      </div>
    );
  }

  // Name your business
  if (view === 'name' && selectedCategory) {
    const canAfford = balance >= selectedCategory.cost;
    return (
      <div className="max-w-xl space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('open')}
            className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-accent transition-colors"
          >
            ←
          </button>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2"><GameIcon name={selectedCategory.id} size={24} themed /> {td(`d.bizcat.${selectedCategory.id}`, selectedCategory.name)}</h2>
            <p className="text-muted-foreground text-sm">{t('biz.name_your')}</p>
          </div>
        </div>

        <div className="stat-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{t('biz.cost')}:</span>
            <span className="font-mono-game font-semibold text-foreground">${formatMoney(selectedCategory.cost)}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{t('biz.income')}:</span>
            <span className="font-mono-game font-semibold text-foreground">${formatMoney(selectedCategory.baseIncomePerHour)}{t('earning.per_hour')}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{t('biz.tax')}:</span>
            <span className="font-mono-game font-semibold text-foreground">23%</span>
            <span className="text-xs">({t('biz.every_72h')})</span>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">{t('biz.name_label')}</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder={t('biz.name_placeholder')}
              className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-sky-400 transition-colors"
              maxLength={30}
            />
            <button
              onClick={handleGenerateName}
              className="rounded-xl px-4 py-2.5 bg-muted hover:bg-accent text-sm font-medium text-foreground transition-colors"
              title="Generate name"
            >
              <GameIcon name="random" size={20} />
            </button>
          </div>
        </div>

        <button
          onClick={handleOpenBusiness}
          disabled={!businessName.trim() || !canAfford}
          className={`w-full rounded-xl py-3 text-sm font-semibold transition-all ${
            businessName.trim() && canAfford
              ? 'bg-primary text-primary-foreground hover:shadow-md'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          <span className="flex items-center gap-1"><GameIcon name="build" size={16} themed /> {t('biz.open_btn')}</span> — ${formatMoney(selectedCategory.cost)}
        </button>

        <div className="stat-card rounded-xl p-3 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('biz.balance')}:</span>
          <span className="font-mono-game font-semibold text-foreground">${formatMoney(balance)}</span>
        </div>
      </div>
    );
  }

  // Merge view
  if (view === 'merge') {
    const stockValue = stockHoldings.reduce((s, h) => s + (stockPrices[h.assetId]?.current ?? 0) * h.quantity, 0);
    const cryptoValue = cryptoHoldings.reduce((s, h) => s + (cryptoPrices[h.assetId]?.current ?? 0) * h.quantity, 0);
    const reValue = shopItems.filter(i => i.purchased && i.category === 'realestate').reduce((s, i) => s + i.price, 0);
    const islandCount = shopItems.filter(i => i.purchased && i.category === 'islands').length;

    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('main')} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center hover:bg-accent transition-colors">←</button>
          <div>
            <h2 className="text-2xl font-bold">{t('biz.merge')}</h2>
            <p className="text-muted-foreground text-sm">{t('biz.merge_desc') || 'Объедините бизнесы для создания корпораций'}</p>
          </div>
        </div>

        <div className="space-y-4">
          {businessMergers.map(merger => {
            const catsMet = merger.requiredCategories.every(catId =>
              businesses.some(b => b.categoryId === catId)
            );
            const stockMet = !merger.minStockPortfolio || stockValue >= merger.minStockPortfolio;
            const cryptoMet = !merger.minCryptoPortfolio || cryptoValue >= merger.minCryptoPortfolio;
            const reMet = !merger.minRealEstateValue || reValue >= merger.minRealEstateValue;
            const islandMet = !merger.minIslandCount || islandCount >= merger.minIslandCount;
            const canMerge = catsMet && stockMet && cryptoMet && reMet && islandMet;

            return (
              <div key={merger.id} className={`rounded-xl border p-5 transition-all ${canMerge ? 'bg-card border-purple-300 hover:shadow-md' : 'bg-card border-border opacity-70'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{merger.emoji}</span>
                  <div>
                    <h4 className="font-bold text-foreground text-lg">{td(`d.merger.${merger.id}`, merger.name)}</h4>
                    <p className="text-xs text-muted-foreground font-mono-game">${formatMoney(merger.resultIncomePerHour)}/час</p>
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  {merger.requiredCategories.map(catId => {
                    const cat = businessCategories.find(c => c.id === catId);
                    const has = businesses.some(b => b.categoryId === catId);
                    return (
                      <div key={catId} className="flex items-center gap-2 text-sm">
                        <span className={has ? 'text-green-500' : 'text-destructive'}>{has ? '✓' : '✗'}</span>
                        <span className={has ? 'text-foreground' : 'text-muted-foreground'}>{td(`d.bizcat.${catId}`, cat?.name || catId)}</span>
                      </div>
                    );
                  })}
                  {merger.minStockPortfolio && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className={stockMet ? 'text-green-500' : 'text-destructive'}>{stockMet ? '✓' : '✗'}</span>
                      <span className={stockMet ? 'text-foreground' : 'text-muted-foreground'}>Портфель акций ≥ ${formatMoney(merger.minStockPortfolio)}</span>
                    </div>
                  )}
                  {merger.minCryptoPortfolio && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className={cryptoMet ? 'text-green-500' : 'text-destructive'}>{cryptoMet ? '✓' : '✗'}</span>
                      <span className={cryptoMet ? 'text-foreground' : 'text-muted-foreground'}>Крипто-портфель ≥ ${formatMoney(merger.minCryptoPortfolio)}</span>
                    </div>
                  )}
                  {merger.minRealEstateValue && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className={reMet ? 'text-green-500' : 'text-destructive'}>{reMet ? '✓' : '✗'}</span>
                      <span className={reMet ? 'text-foreground' : 'text-muted-foreground'}>Недвижимость ≥ ${formatMoney(merger.minRealEstateValue)}</span>
                    </div>
                  )}
                  {merger.minIslandCount && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className={islandMet ? 'text-green-500' : 'text-destructive'}>{islandMet ? '✓' : '✗'}</span>
                      <span className={islandMet ? 'text-foreground' : 'text-muted-foreground'}>Островов: {islandCount}/{merger.minIslandCount}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => { if (canMerge) { mergeBusiness(merger.id); setView('main'); } }}
                  disabled={!canMerge}
                  className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all ${
                    canMerge ? 'bg-primary text-primary-foreground hover:opacity-90' : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  {canMerge ? t('biz.merge_create') || 'Создать' : t('biz.merge_locked') || 'Требования не выполнены'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};

export default BusinessTab;
