import React, { useState } from 'react';
import { useGame, formatMoney } from '@/context/GameContext';
import { shopCategories, shopItemsData, carEngineOptions, carTrimOptions, crewOption, finishOptions, ShopItemData } from '@/data/shopData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import GameIcon from '@/components/GameIcon';
import { useI18n } from '@/i18n/I18nContext';

type View = 'categories' | 'items';

const ShopTab: React.FC = () => {
  const { t, td } = useI18n();
  const { shopItems, buyShopItem, balance } = useGame();
  const [view, setView] = useState<View>('categories');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ShopItemData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Car config
  const [carEngine, setCarEngine] = useState('df');
  const [carTrim, setCarTrim] = useState('standard');
  // Ship/Plane config
  const [hireCrew, setHireCrew] = useState(false);
  const [finish, setFinish] = useState('standard');

  const openCategory = (catId: string) => {
    setSelectedCategory(catId);
    setView('items');
  };

  const openItemDialog = (item: ShopItemData) => {
    setSelectedItem(item);
    setCarEngine('df');
    setCarTrim('standard');
    setHireCrew(false);
    setFinish('standard');
    setDialogOpen(true);
  };

  const calcFinalPrice = (): number => {
    if (!selectedItem) return 0;
    let price = selectedItem.basePrice;
    const catId = selectedItem.categoryId;
    if (catId === 'cars') {
      const eng = carEngineOptions.find(e => e.id === carEngine);
      const trim = carTrimOptions.find(t => t.id === carTrim);
      price += selectedItem.basePrice * (eng?.priceMultiplier || 0);
      price += selectedItem.basePrice * (trim?.priceMultiplier || 0);
    } else if (catId === 'ships' || catId === 'planes') {
      if (hireCrew) price += selectedItem.basePrice * crewOption.priceMultiplier;
      const fin = finishOptions.find(f => f.id === finish);
      price += selectedItem.basePrice * (fin?.priceMultiplier || 0);
    }
    return Math.round(price);
  };

  const isPurchased = (itemId: string) => shopItems.find(i => i.id === itemId)?.purchased || false;

  const handleBuy = () => {
    if (!selectedItem) return;
    const finalPrice = calcFinalPrice();
    if (balance < finalPrice) return;
    buyShopItem(selectedItem.id, finalPrice);
    setDialogOpen(false);
  };

  const catItems = selectedCategory ? shopItemsData.filter(i => i.categoryId === selectedCategory) : [];
  const catInfo = shopCategories.find(c => c.id === selectedCategory);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1 flex items-center gap-2"><GameIcon name="shop" size={24} themed /> {t('shop.title')}</h2>
        <p className="text-muted-foreground text-sm">{t('shop.subtitle')}</p>
      </div>

      {/* Category Grid with Images */}
      {view === 'categories' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {shopCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => openCategory(cat.id)}
              className="rounded-2xl overflow-hidden border border-border bg-card transition-all hover:shadow-lg hover:border-primary/50 hover:scale-[1.02] active:scale-[0.98] group"
            >
              <div className="aspect-[4/3] relative overflow-hidden">
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="font-semibold text-white text-sm">{td('d.shopcat.' + cat.id, cat.name)}</p>
                  <p className="text-[11px] text-white/60">{td('d.shopcat.' + cat.id + '.d', cat.description)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Items Grid with Images */}
      {view === 'items' && selectedCategory && (
        <>
          <button
            onClick={() => { setView('categories'); setSelectedCategory(null); }}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            {t('shop.back_categories')}
          </button>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <img src={catInfo?.image} alt="" className="w-8 h-8 rounded-lg object-cover" />
            {catInfo ? td('d.shopcat.' + catInfo.id, catInfo.name) : ''}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {catItems.map(item => {
              const purchased = isPurchased(item.id);
              return (
                <button
                  key={item.id}
                  disabled={purchased}
                  onClick={() => !purchased && openItemDialog(item)}
                  className={`rounded-2xl overflow-hidden border text-left transition-all group ${
                    purchased
                      ? 'bg-muted/50 border-border opacity-70 cursor-default'
                      : 'bg-card border-border hover:border-primary/50 hover:shadow-md cursor-pointer'
                  }`}
                >
                  <div className="aspect-[4/3] relative overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    {purchased && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold text-sm bg-green-500/80 px-3 py-1 rounded-full">{t('shop.purchased')}</span>
                      </div>
                    )}
                    {!purchased && (
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1">
                        <span className="font-mono-game text-xs text-white">${formatMoney(item.basePrice)}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-foreground text-sm">{td('d.shop.' + item.id, item.name)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{td('d.shop.' + item.id + '.d', item.description)}</p>
                    {item.location && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><GameIcon name="location" size={12} /> {td('d.shop.' + item.id + '.loc', item.location)}</p>}
                    {item.capacity && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><GameIcon name="capacity" size={12} /> {item.capacity} {td('d.shop.' + item.id + '.cu', item.capacityUnit || '')}</p>}
                    {item.baseIncomePerHour && !purchased && (
                      <p className="text-xs mt-1" style={{ color: 'hsl(var(--success))' }}>
                        +${formatMoney(item.baseIncomePerHour)} {t('shop.per_hour')}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Purchase confirmation dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('shop.confirm_title')}</DialogTitle>
            <DialogDescription>{t('shop.confirm_desc')}</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-full aspect-[16/9] rounded-xl overflow-hidden mb-3">
                  <img src={selectedItem.image} alt={selectedItem.name} className="w-full h-full object-cover" />
                </div>
                <p className="font-semibold text-foreground">{td('d.shop.' + selectedItem.id, selectedItem.name)}</p>
                <p className="text-xs text-muted-foreground">{td('d.shop.' + selectedItem.id + '.d', selectedItem.description)}</p>
                {selectedItem.location && <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1"><GameIcon name="location" size={12} /> {td('d.shop.' + selectedItem.id + '.loc', selectedItem.location)}</p>}
                {selectedItem.baseIncomePerHour && (
                  <p className="text-xs mt-1" style={{ color: 'hsl(var(--success))' }}>
                    {t('shop.income')}: ${formatMoney(selectedItem.baseIncomePerHour)} {t('shop.per_hour')}
                  </p>
                )}
                {selectedItem.capacity && (
                  <p className="text-xs text-muted-foreground mt-1">{t('shop.capacity')}: {selectedItem.capacity} {td('d.shop.' + selectedItem.id + '.cu', selectedItem.capacityUnit || '')}</p>
                )}
              </div>

              {/* Car options */}
              {selectedItem.categoryId === 'cars' && (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1.5">{t('shop.engine')}</p>
                    <div className="flex gap-2">
                      {carEngineOptions.map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => setCarEngine(opt.id)}
                          className={`flex-1 rounded-xl py-2 px-3 text-xs font-medium border transition-all ${
                            carEngine === opt.id
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card border-border text-foreground hover:border-primary/50'
                          }`}
                        >
                          {td('d.engine.' + opt.id, opt.name)}
                          {opt.priceMultiplier > 0 && <span className="block text-[10px] opacity-80">+{opt.priceMultiplier * 100}%</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1.5">{t('shop.trim')}</p>
                    <div className="flex gap-2">
                      {carTrimOptions.map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => setCarTrim(opt.id)}
                          className={`flex-1 rounded-xl py-2 px-3 text-xs font-medium border transition-all ${
                            carTrim === opt.id
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card border-border text-foreground hover:border-primary/50'
                          }`}
                        >
                          {td('d.trim.' + opt.id, opt.name)}
                          {opt.priceMultiplier > 0 && <span className="block text-[10px] opacity-80">+{opt.priceMultiplier * 100}%</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Ship options */}
              {selectedItem.categoryId === 'ships' && (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1.5">{t('shop.crew')}</p>
                    <p className="text-xs text-muted-foreground mb-1">{t('shop.crew_desc_ship')}</p>
                    <button
                      onClick={() => setHireCrew(!hireCrew)}
                      className={`w-full rounded-xl py-2 px-3 text-xs font-medium border transition-all ${
                        hireCrew
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-foreground hover:border-primary/50'
                      }`}
                    >
                       {hireCrew ? t('shop.crew_hired') : t('shop.hire_crew')} (+{crewOption.priceMultiplier * 100}%)
                     </button>
                   </div>
                   <div>
                     <p className="text-sm font-medium text-foreground mb-1.5">{t('shop.finish')}</p>
                    <div className="flex gap-2">
                      {finishOptions.map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => setFinish(opt.id)}
                          className={`flex-1 rounded-xl py-2 px-3 text-xs font-medium border transition-all ${
                            finish === opt.id
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card border-border text-foreground hover:border-primary/50'
                          }`}
                        >
                          {td('d.finish.' + opt.id, opt.name)}
                          {opt.priceMultiplier > 0 && <span className="block text-[10px] opacity-80">+{opt.priceMultiplier * 100}%</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Plane options */}
              {selectedItem.categoryId === 'planes' && (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1.5">{t('shop.crew')}</p>
                    <p className="text-xs text-muted-foreground mb-1">{t('shop.crew_desc_plane')}</p>
                    <button
                      onClick={() => setHireCrew(!hireCrew)}
                      className={`w-full rounded-xl py-2 px-3 text-xs font-medium border transition-all ${
                        hireCrew
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-foreground hover:border-primary/50'
                      }`}
                    >
                       {hireCrew ? t('shop.crew_hired') : t('shop.hire_crew')} (+{crewOption.priceMultiplier * 100}%)
                     </button>
                   </div>
                   <div>
                     <p className="text-sm font-medium text-foreground mb-1.5">{t('shop.finish')}</p>
                     <div className="flex gap-2">
                       {finishOptions.map(opt => (
                         <button
                           key={opt.id}
                           onClick={() => setFinish(opt.id)}
                           className={`flex-1 rounded-xl py-2 px-3 text-xs font-medium border transition-all ${
                             finish === opt.id
                               ? 'bg-primary text-primary-foreground border-primary'
                               : 'bg-card border-border text-foreground hover:border-primary/50'
                           }`}
                         >
                           {td('d.finish.' + opt.id, opt.name)}
                           {opt.priceMultiplier > 0 && <span className="block text-[10px] opacity-80">+{opt.priceMultiplier * 100}%</span>}
                         </button>
                       ))}
                     </div>
                   </div>
                 </div>
               )}

               {/* Price summary */}
               <div className="border-t border-border pt-3 space-y-2">
                 <div className="flex justify-between items-center">
                   <span className="text-sm font-medium text-foreground">{t('shop.total')}:</span>
                  <span className="font-mono-game text-lg font-bold text-foreground">${formatMoney(calcFinalPrice())}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{t('shop.balance')}:</span>
                  <span className="font-mono-game text-xs text-muted-foreground">${formatMoney(balance)}</span>
                </div>
                <button
                  onClick={handleBuy}
                  disabled={balance < calcFinalPrice()}
                  className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all ${
                    balance >= calcFinalPrice()
                      ? 'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  {t('shop.confirm_buy')}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShopTab;
