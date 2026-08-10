import React, { useState, useEffect } from 'react';
import { useGame, formatMoney } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { accessoryCategories, accessoryItemsData, shopItemsData, ShopItemData } from '@/data/shopData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import GameIcon from '@/components/GameIcon';
import { useI18n } from '@/i18n/I18nContext';
import LicensePlate, {
  PLATE_COUNTRIES, RANDOM_PLATE_PRICE, CUSTOM_PLATE_PRICE,
  generateRandomPlate, validateCustomPlate, getPlateFormatHint,
  type LicensePlateData,
} from '@/components/LicensePlate';
import PlateSlotAnimation from '@/components/PlateSlotAnimation';
import { toast } from 'sonner';

type View = 'categories' | 'items';

const USERNAME_PRICE = 100;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{5,26}$/;
const MAX_USERNAMES = 25;
const MAX_ACTIVE = 15;

const MISC_CATEGORY = { id: 'misc', name: 'misc', emoji: '📦', description: 'misc_desc', image: '' };

interface PlayerUsername {
  id: string;
  username: string;
  is_active: boolean;
}

const AccessoriesTab: React.FC = () => {
  const { accessoryItems, buyAccessory, balance, spendBalance, addBalance, shopItems, licensePlates, addLicensePlate, assignPlate, removePlate } = useGame();
  const { user } = useAuth();
  const { t, td } = useI18n();
  const [view, setView] = useState<View>('categories');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ShopItemData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Username system
  const [usernameDialogOpen, setUsernameDialogOpen] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [usernameBuying, setUsernameBuying] = useState(false);
  const [myUsernames, setMyUsernames] = useState<PlayerUsername[]>([]);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);

  // License plate system
  const [plateDialogOpen, setPlateDialogOpen] = useState(false);
  const [plateMode, setPlateMode] = useState<'random' | 'custom'>('random');
  const [plateCountry, setPlateCountry] = useState('RU');
  const [customPlateText, setCustomPlateText] = useState('');
  const [platePreview, setPlatePreview] = useState<LicensePlateData | null>(null);
  const [managePlatesOpen, setManagePlatesOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningPlateId, setAssigningPlateId] = useState<string | null>(null);
  const [plateAnimating, setPlateAnimating] = useState(false);
  const [animatingPlate, setAnimatingPlate] = useState<LicensePlateData | null>(null);
  const [plateDuplicateError, setPlateDuplicateError] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    loadUsernames();
  }, [user?.id]);

  const loadUsernames = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('player_usernames')
      .select('id, username, is_active')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (data) setMyUsernames(data as PlayerUsername[]);
  };

  const isPurchased = (itemId: string) => accessoryItems.find(i => i.id === itemId)?.purchased || false;

  const openCategory = (catId: string) => {
    setSelectedCategory(catId);
    setView('items');
  };

  const openItemDialog = (item: ShopItemData) => {
    setSelectedItem(item);
    setDialogOpen(true);
  };

  const handleBuy = () => {
    if (!selectedItem) return;
    if (balance < selectedItem.basePrice) return;
    buyAccessory(selectedItem.id);
    setDialogOpen(false);
  };

  // Username functions
  const checkUsername = async (name: string) => {
    const clean = name.replace(/^@/, '').toLowerCase();
    if (!USERNAME_REGEX.test(clean)) {
      setUsernameAvailable(null);
      setUsernameError(clean.length < 5 ? t('acc.min_chars') : clean.length > 26 ? t('acc.max_chars') : t('acc.only_latin'));
      return;
    }
    setUsernameError('');
    setUsernameChecking(true);
    const { data } = await supabase
      .from('player_usernames')
      .select('id')
      .ilike('username', clean)
      .limit(1);
    if (error) {
      setUsernameAvailable(null);
      setUsernameError('Не удалось проверить username');
    } else {
      setUsernameAvailable(!data || data.length === 0);
    }
    setUsernameChecking(false);
  };

  const handleUsernameInputChange = (val: string) => {
    setUsernameInput(val);
    const clean = val.replace(/^@/, '');
    if (clean.length >= 3) {
      checkUsername(clean);
    } else {
      setUsernameAvailable(null);
      setUsernameError('');
    }
  };

  const handleBuyUsername = async () => {
    if (!user?.id) return;
    const clean = usernameInput.replace(/^@/, '').toLowerCase();
    if (!USERNAME_REGEX.test(clean) || !usernameAvailable) return;
    if (balance < USERNAME_PRICE) return;
    if (myUsernames.length >= MAX_USERNAMES) return;
    const activeCount = myUsernames.filter(u => u.is_active).length;
    const makeActive = activeCount < MAX_ACTIVE;
    if (!spendBalance(USERNAME_PRICE)) return;
    setUsernameBuying(true);
    const { error } = await supabase.from('player_usernames').insert({
      user_id: user.id,
      username: clean,
      is_active: makeActive,
    });
    if (error) {
      addBalance(USERNAME_PRICE);
      if (error.code === '23505') {
        setUsernameAvailable(false);
        setUsernameError(t('acc.already_taken'));
      }
      toast.error(usernameError || 'Не удалось купить username. Деньги возвращены.');
      setUsernameBuying(false);
      return;
    }
    setUsernameDialogOpen(false);
    setUsernameInput('');
    setUsernameAvailable(null);
    await loadUsernames();
    setUsernameBuying(false);
    toast.success(`Username @${clean} куплен`);
  };

  const toggleUsernameActive = async (id: string, currentActive: boolean) => {
    if (!currentActive) {
      const activeCount = myUsernames.filter(u => u.is_active).length;
      if (activeCount >= MAX_ACTIVE) return;
    }
    await supabase.from('player_usernames').update({ is_active: !currentActive }).eq('id', id);
    loadUsernames();
  };

  const handleDeleteUsername = async (id: string) => {
    if (!user?.id) return;
    await supabase.from('player_usernames').delete().eq('id', id).eq('user_id', user.id);
    loadUsernames();
  };


  const generatePreview = () => {
    setPlateDuplicateError('');
    if (plateMode === 'random') {
      const text = generateRandomPlate(plateCountry);
      setPlatePreview({ id: '', text, country: plateCountry, assignedTo: null, isCustom: false });
    } else {
      if (validateCustomPlate(customPlateText, plateCountry)) {
        const upper = customPlateText.trim().toUpperCase();
        // Check duplicate
        const isDupe = licensePlates.some(p => p.text === upper && p.country === plateCountry);
        if (isDupe) {
         setPlateDuplicateError(t('acc.plate_exists'));
          setPlatePreview(null);
        } else {
          setPlatePreview({ id: '', text: upper, country: plateCountry, assignedTo: null, isCustom: true });
        }
      } else {
        setPlatePreview(null);
      }
    }
  };

  useEffect(() => {
    if (plateDialogOpen) generatePreview();
  }, [plateCountry, plateMode, plateDialogOpen]);

  const handleBuyPlate = () => {
    const price = plateMode === 'random' ? RANDOM_PLATE_PRICE : CUSTOM_PLATE_PRICE;
    if (balance < price) return;

    let text: string;
    if (plateMode === 'random') {
      // Generate and check for duplicates (re-roll if needed)
      let attempts = 0;
      do {
        text = generateRandomPlate(plateCountry);
        attempts++;
      } while (licensePlates.some(p => p.text === text && p.country === plateCountry) && attempts < 50);
    } else {
      if (!validateCustomPlate(customPlateText, plateCountry)) return;
      text = customPlateText.trim().toUpperCase();
      if (licensePlates.some(p => p.text === text && p.country === plateCountry)) {
        setPlateDuplicateError(t('acc.plate_taken'));
        return;
      }
    }

    if (!spendBalance(price)) return;

    const plate: LicensePlateData = {
      id: `plate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      country: plateCountry,
      assignedTo: null,
      isCustom: plateMode === 'custom',
    };

    if (plateMode === 'random') {
      // Show animation for random plates
      setAnimatingPlate(plate);
      setPlateAnimating(true);
      setPlateDialogOpen(false);
    } else {
      addLicensePlate(plate);
      setPlateDialogOpen(false);
      setCustomPlateText('');
    }
  };

  const handleAnimationComplete = () => {
    if (animatingPlate) {
      addLicensePlate(animatingPlate);
    }
    setPlateAnimating(false);
    setAnimatingPlate(null);
  };

  const ownedCars = shopItems.filter(i => i.purchased && i.category === 'cars');

  const openAssignDialog = (plateId: string) => {
    setAssigningPlateId(plateId);
    setAssignDialogOpen(true);
  };

  const catItems = selectedCategory ? accessoryItemsData.filter(i => i.categoryId === selectedCategory) : [];
  const catInfo = [...accessoryCategories, MISC_CATEGORY].find(c => c.id === selectedCategory);
  const allCategories = [...accessoryCategories, MISC_CATEGORY];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1 flex items-center gap-2"><GameIcon name="accessories" size={24} themed /> {t('acc.title')}</h2>
        <p className="text-muted-foreground text-sm">{t('acc.subtitle')}</p>
      </div>

      {/* Category Grid */}
      {view === 'categories' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {allCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => openCategory(cat.id)}
              className="rounded-2xl overflow-hidden border border-border bg-card transition-all hover:shadow-lg hover:border-primary/50 hover:scale-[1.02] active:scale-[0.98] group"
            >
              {cat.image ? (
                <div className="aspect-[4/3] relative overflow-hidden">
                  <img src={cat.image} alt={td('d.acccat.' + cat.id, cat.name)} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="font-semibold text-white text-sm">{td('d.acccat.' + cat.id, cat.name)}</p>
                    <p className="text-[11px] text-white/60">{td('d.acccat.' + cat.id + '.d', cat.description)}</p>
                  </div>
                </div>
              ) : (
                <div className="aspect-[4/3] flex flex-col items-center justify-center p-4">
                   <GameIcon name={cat.id} size={48} themed />
                   <span className="font-semibold text-foreground text-sm mt-2">{cat.id === 'misc' ? t('acc.misc') : cat.name}</span>
                   <span className="text-xs text-muted-foreground">{cat.id === 'misc' ? t('acc.misc_desc') : cat.description}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Misc category */}
      {view === 'items' && selectedCategory === 'misc' && (
        <>
          <button onClick={() => { setView('categories'); setSelectedCategory(null); }} className="text-sm text-primary hover:underline flex items-center gap-1">{t('acc.back_categories')}</button>
          <h3 className="text-lg font-semibold flex items-center gap-2"><GameIcon name="misc" size={20} /> {t('acc.misc')}</h3>

          {/* Usernames card */}
          <div className="bg-card rounded-2xl border p-5 space-y-4">
            <div className="flex items-center gap-3">
              <GameIcon name="tag" size={36} themed />
              <div>
                <p className="font-semibold text-foreground">{t('acc.username_title')}</p>
                <p className="text-xs text-muted-foreground">{t('acc.username_desc')}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono-game text-sm text-foreground">${formatMoney(USERNAME_PRICE)} {t('acc.price_each')}</span>
              <span className="text-xs text-muted-foreground">{myUsernames.length}/{MAX_USERNAMES} {t('acc.created')}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setUsernameDialogOpen(true); setUsernameInput(''); setUsernameAvailable(null); setUsernameError(''); }}
                disabled={!user || myUsernames.length >= MAX_USERNAMES || balance < USERNAME_PRICE}
                className="flex-1 rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('acc.create_username')}
              </button>
              {myUsernames.length > 0 && (
                <button onClick={() => setManageDialogOpen(true)} className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50">
                  {t('acc.manage')} ({myUsernames.length})
                </button>
              )}
            </div>
            {!user && <p className="text-xs text-destructive">{t('acc.login_required')}</p>}
          </div>

          {/* License Plates card */}
          <div className="bg-card rounded-2xl border p-5 space-y-4">
            <div className="flex items-center gap-3">
              <GameIcon name="plate" size={36} themed />
              <div>
                <p className="font-semibold text-foreground">{t('acc.plate_title')}</p>
                <p className="text-xs text-muted-foreground">{t('acc.plate_desc')}</p>
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">{t('acc.random_plate')}</p>
                <p className="font-mono-game text-sm font-bold text-foreground">${formatMoney(RANDOM_PLATE_PRICE)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{t('acc.random_gen')}</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">{t('acc.custom_plate')}</p>
                <p className="font-mono-game text-sm font-bold text-foreground">${formatMoney(CUSTOM_PLATE_PRICE)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{t('acc.choose_text')}</p>
              </div>
            </div>

            {/* Preview of owned plates */}
            {licensePlates.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t('acc.your_plates')} ({licensePlates.length}):</p>
                <div className="flex flex-wrap gap-2">
                  {licensePlates.slice(0, 6).map(p => (
                    <LicensePlate key={p.id} plate={p as LicensePlateData} size="sm" />
                  ))}
                  {licensePlates.length > 6 && (
                    <span className="text-xs text-muted-foreground self-center">+{licensePlates.length - 6}</span>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setPlateDialogOpen(true); setPlateMode('random'); setCustomPlateText(''); generatePreview(); }}
                disabled={balance < RANDOM_PLATE_PRICE}
                className="flex-1 rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('acc.buy_plate')}
              </button>
              {licensePlates.length > 0 && (
                <button onClick={() => setManagePlatesOpen(true)} className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50">
                  {t('acc.manage')} ({licensePlates.length})
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Items Grid */}
      {view === 'items' && selectedCategory && selectedCategory !== 'misc' && (
        <>
          <button onClick={() => { setView('categories'); setSelectedCategory(null); }} className="text-sm text-primary hover:underline flex items-center gap-1">{t('acc.back_categories')}</button>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {catInfo?.image ? <img src={catInfo.image} alt="" className="w-8 h-8 rounded-lg object-cover" /> : <GameIcon name={catInfo?.id || 'misc'} size={20} themed />}
            {catInfo ? td('d.acccat.' + catInfo.id, catInfo.name) : ''}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {catItems.map(item => {
              const purchased = isPurchased(item.id);
              return (
                <button key={item.id} disabled={purchased} onClick={() => !purchased && openItemDialog(item)}
                  className={`rounded-2xl overflow-hidden border text-left transition-all group ${purchased ? 'bg-muted/50 border-border opacity-70 cursor-default' : 'bg-card border-border hover:border-primary/50 hover:shadow-md cursor-pointer'}`}
                >
                  <div className="aspect-[4/3] relative overflow-hidden">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                    {purchased && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold text-sm bg-green-500/80 px-3 py-1 rounded-full">{t('acc.purchased')}</span>
                      </div>
                    )}
                    {!purchased && (
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1">
                        <span className="font-mono-game text-xs text-white">${formatMoney(item.basePrice)}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-foreground text-sm">{td('d.accitem.' + item.id, item.name)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{td('d.accitem.' + item.id + '.d', item.description)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Purchase confirmation */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('acc.confirm_title')}</DialogTitle>
            <DialogDescription>{t('acc.confirm_desc')}</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-full aspect-[16/9] rounded-xl overflow-hidden mb-3">
                  <img src={selectedItem.image} alt={selectedItem.name} className="w-full h-full object-cover" />
                </div>
                <p className="font-semibold text-foreground">{td('d.accitem.' + selectedItem.id, selectedItem.name)}</p>
                <p className="text-xs text-muted-foreground">{td('d.accitem.' + selectedItem.id + '.d', selectedItem.description)}</p>
              </div>
              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between items-center">
                   <span className="text-sm font-medium text-foreground">{t('acc.total')}:</span>
                  <span className="font-mono-game text-lg font-bold text-foreground">${formatMoney(selectedItem.basePrice)}</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-xs text-muted-foreground">{t('acc.balance')}:</span>
                  <span className="font-mono-game text-xs text-muted-foreground">${formatMoney(balance)}</span>
                </div>
                <button onClick={handleBuy} disabled={balance < selectedItem.basePrice}
                  className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all ${balance >= selectedItem.basePrice ? 'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
                >
                  {t('acc.confirm_buy')}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Username creation dialog */}
      <Dialog open={usernameDialogOpen} onOpenChange={setUsernameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('acc.create_username_dialog')}</DialogTitle>
            <DialogDescription>{t('acc.create_username_hint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">{t('acc.username_label')}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <input type="text" value={usernameInput.replace(/^@/, '')} onChange={e => handleUsernameInputChange(e.target.value)} placeholder="durov" maxLength={26}
                  className="w-full rounded-xl border border-border bg-background pl-8 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div className="mt-1.5 min-h-[20px]">
                {usernameChecking && <p className="text-xs text-muted-foreground">{t('acc.checking')}</p>}
                {usernameError && <p className="text-xs text-destructive">{usernameError}</p>}
                {usernameAvailable === true && !usernameError && <p className="text-xs text-green-500">{t('acc.available')}</p>}
                {usernameAvailable === false && !usernameError && <p className="text-xs text-destructive">{t('acc.taken')}</p>}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{t('acc.username_hint')}</p>
            </div>
            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-foreground">{t('acc.cost')}:</span>
                <span className="font-mono-game text-lg font-bold text-foreground">${formatMoney(USERNAME_PRICE)}</span>
              </div>
              <button onClick={handleBuyUsername} disabled={!usernameAvailable || balance < USERNAME_PRICE || usernameChecking || usernameBuying || !!usernameError}
                className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all ${usernameAvailable && balance >= USERNAME_PRICE && !usernameError ? 'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
              >
                {usernameBuying ? 'Покупка...' : t('acc.buy_username')}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage usernames dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('acc.my_usernames')}</DialogTitle>
            <DialogDescription>{t('acc.active_label')}: {myUsernames.filter(u => u.is_active).length}/{MAX_ACTIVE} • {t('acc.total_label')}: {myUsernames.length}/{MAX_USERNAMES}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {myUsernames.map(u => (
              <div key={u.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border">
                <span className="text-sm font-medium text-foreground">@{u.username}</span>
                <div className="flex gap-1.5">
                  <button onClick={() => toggleUsernameActive(u.id, u.is_active)}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${u.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  >
                    {u.is_active ? t('acc.active') : t('acc.activate')}
                  </button>
                  <button onClick={() => handleDeleteUsername(u.id)}
                    className="text-xs px-2.5 py-1 rounded-full font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
                  >
                    {t('acc.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* License Plate Purchase Dialog */}
      <Dialog open={plateDialogOpen} onOpenChange={setPlateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('acc.buy_plate_dialog')}</DialogTitle>
            <DialogDescription>{t('acc.buy_plate_hint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Mode toggle */}
            <div className="flex rounded-xl border border-border overflow-hidden">
              <button onClick={() => setPlateMode('random')}
                className={`flex-1 py-2.5 text-sm font-medium transition-all ${plateMode === 'random' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted/50'}`}
              >
                {t('acc.random_mode')} · ${formatMoney(RANDOM_PLATE_PRICE)}
              </button>
              <button onClick={() => setPlateMode('custom')}
                className={`flex-1 py-2.5 text-sm font-medium transition-all ${plateMode === 'custom' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted/50'}`}
              >
                {t('acc.custom_mode')} · ${formatMoney(CUSTOM_PLATE_PRICE)}
              </button>
            </div>

            {/* Country selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">{t('acc.country')}</label>
              <div className="grid grid-cols-3 gap-2">
                {PLATE_COUNTRIES.map(c => (
                  <button key={c.id} onClick={() => setPlateCountry(c.id)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${plateCountry === c.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:bg-muted/50'}`}
                  >
                    {c.flag} {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom text input */}
            {plateMode === 'custom' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('acc.plate_text')}</label>
                <input type="text" value={customPlateText} onChange={e => { setCustomPlateText(e.target.value); setPlateDuplicateError(''); }}
                  onBlur={generatePreview} onKeyUp={generatePreview}
                  placeholder={getPlateFormatHint(plateCountry).replace('Формат: ', '')} maxLength={16}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono uppercase tracking-wider"
                />
                <p className="text-[10px] text-muted-foreground mt-1">{getPlateFormatHint(plateCountry)}</p>
                {plateDuplicateError && <p className="text-xs text-destructive mt-1">{plateDuplicateError}</p>}
              </div>
            )}

            {/* Preview */}
            <div className="bg-muted/30 rounded-xl p-4 flex flex-col items-center gap-2">
              <p className="text-xs text-muted-foreground">{t('acc.preview')}</p>
              {platePreview ? (
                <LicensePlate plate={platePreview as LicensePlateData} size="lg" />
              ) : (
                <p className="text-xs text-muted-foreground italic">{t('acc.enter_plate')}</p>
              )}
              {plateMode === 'random' && (
                <button onClick={generatePreview} className="text-xs text-primary hover:underline mt-1">
                  {t('acc.generate_another')}
                </button>
              )}
            </div>

            {/* Frame branding note */}
            <p className="text-[10px] text-muted-foreground text-center italic">
              {t('acc.frame_note')}
            </p>

            {/* Buy button */}
            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-foreground">{t('acc.total')}:</span>
                <span className="font-mono-game text-lg font-bold text-foreground">
                  ${formatMoney(plateMode === 'random' ? RANDOM_PLATE_PRICE : CUSTOM_PLATE_PRICE)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{t('acc.balance')}:</span>
                <span className="font-mono-game text-xs text-muted-foreground">${formatMoney(balance)}</span>
              </div>
              <button onClick={handleBuyPlate}
                disabled={
                  balance < (plateMode === 'random' ? RANDOM_PLATE_PRICE : CUSTOM_PLATE_PRICE) ||
                  (plateMode === 'custom' && !validateCustomPlate(customPlateText, plateCountry)) ||
                  !!plateDuplicateError
                }
                className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all ${
                  balance >= (plateMode === 'random' ? RANDOM_PLATE_PRICE : CUSTOM_PLATE_PRICE) && (plateMode === 'random' || validateCustomPlate(customPlateText, plateCountry)) && !plateDuplicateError
                    ? 'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                {t('acc.buy_plate_btn')}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Slot Animation Dialog */}
      <Dialog open={plateAnimating} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader>
             <DialogTitle className="text-center">{t('acc.generating')}</DialogTitle>
             <DialogDescription className="text-center">{t('acc.generating_desc')}</DialogDescription>
          </DialogHeader>
          {animatingPlate && (
            <PlateSlotAnimation plate={animatingPlate} onComplete={handleAnimationComplete} />
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Plates Dialog */}
      <Dialog open={managePlatesOpen} onOpenChange={setManagePlatesOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
             <DialogTitle>{t('acc.my_plates')}</DialogTitle>
             <DialogDescription>{t('acc.my_plates_desc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {licensePlates.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">{t('acc.no_plates')}</p>}
            {licensePlates.map(p => {
              const assignedCar = p.assignedTo ? shopItemsData.find(i => i.id === p.assignedTo) : null;
              return (
                <div key={p.id} className="flex items-center gap-3 px-3 py-3 rounded-xl border border-border">
                  <LicensePlate plate={p as LicensePlateData} size="md" />
                  <div className="flex-1 min-w-0">
                    {assignedCar ? (
                      <p className="text-xs text-foreground truncate">🚗 {assignedCar.name}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">{t('acc.not_assigned')}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">{p.isCustom ? t('acc.custom_label') : t('acc.random_label')} • {PLATE_COUNTRIES.find(c => c.id === p.country)?.name}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => openAssignDialog(p.id)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20"
                    >
                      {assignedCar ? t('acc.change') : t('acc.assign')}
                    </button>
                    <button onClick={() => removePlate(p.id)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive font-medium hover:bg-destructive/20"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Plate to Car Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
             <DialogTitle>{t('acc.assign_title')}</DialogTitle>
             <DialogDescription>{t('acc.assign_desc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {ownedCars.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">{t('acc.no_cars')}</p>}
            {/* Unassign option */}
            {assigningPlateId && licensePlates.find(p => p.id === assigningPlateId)?.assignedTo && (
              <button onClick={() => { assignPlate(assigningPlateId!, null); setAssignDialogOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-border hover:bg-muted/50 transition-colors"
              >
                <span className="text-lg">❌</span>
                <span className="text-sm text-foreground">{t('acc.unassign')}</span>
              </button>
            )}
            {ownedCars.map(car => {
              const carData = shopItemsData.find(i => i.id === car.id);
              const existingPlate = licensePlates.find(p => p.assignedTo === car.id);
              return (
                <button key={car.id}
                  onClick={() => { assignPlate(assigningPlateId!, car.id); setAssignDialogOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-border hover:bg-muted/50 transition-colors text-left"
                >
                  {carData?.image && <img src={carData.image} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{car.name}</p>
                    {existingPlate && (
                      <div className="mt-0.5"><LicensePlate plate={existingPlate as LicensePlateData} size="sm" /></div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccessoriesTab;
