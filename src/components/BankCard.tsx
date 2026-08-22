import React, { useMemo, useState } from 'react';
import { Check, CreditCard, LockKeyhole, Palette, Settings2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useGame, formatMoney } from '@/context/GameContext';
import { useI18n } from '@/i18n/I18nContext';
import { BANK_CARD_DESIGNS } from '@/game/bankCards';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const BankCard: React.FC = () => {
  const game = useGame();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState(game.bankCard.customNumber);
  const [expires, setExpires] = useState(game.bankCard.expiresAt);
  const [color, setColor] = useState(game.bankCard.customColor || '#0369a1');
  const design = BANK_CARD_DESIGNS.find(card => card.id === game.bankCard.activeId) || BANK_CARD_DESIGNS[0];
  const levelRewards = useMemo(() => new Set(BANK_CARD_DESIGNS.filter(card => card.unlockLevel && game.playerLevel >= card.unlockLevel).map(card => card.id)), [game.playerLevel]);
  const owned = (id: string) => game.bankCard.ownedIds.includes(id) || levelRewards.has(id);

  const saveDesign = () => {
    if (!game.customizeBankCard({ customNumber: number, customColor: color, expiresAt: expires })) {
      toast.error('Проверьте последние 4 цифры и срок действия в формате ММ/ГГ');
      return;
    }
    toast.success('Дизайн карты сохранён');
  };

  return <>
    <button onClick={() => setOpen(true)} className="group relative block w-full max-w-[440px] text-left transition-transform duration-300 hover:-translate-y-1 active:scale-[0.98]">
      <div className="relative aspect-[1.6/1] overflow-hidden rounded-3xl border border-white/15 p-6 shadow-2xl" style={{ background: `linear-gradient(135deg, ${game.bankCard.customColor || design.colors[0]}, ${design.colors[1]})` }}>
        <div className="pointer-events-none absolute -left-1/2 top-0 h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent transition-all duration-700 group-hover:left-[120%]" />
        <div className="absolute -bottom-16 -right-10 h-44 w-44 rounded-full border border-white/10"/><div className="absolute -bottom-8 -right-4 h-28 w-28 rounded-full border border-white/10"/>
        <div className="relative flex h-full flex-col justify-between text-white">
          <div className="flex items-start justify-between"><div className="grid h-10 w-12 place-items-center rounded-lg border border-yellow-200/30 bg-gradient-to-br from-yellow-200 to-amber-500"><div className="h-5 w-8 rounded border border-amber-700/30"/></div><div className="text-right"><p className="text-sm font-bold tracking-[.18em]">CLICKER BANK</p><p className="text-[10px] text-white/60">{design.name}</p></div></div>
          <p className="font-mono-game text-lg tracking-[.18em] sm:text-xl">•••• •••• •••• {game.bankCard.customNumber}</p>
          <div className="flex items-end justify-between"><div><p className="text-[9px] uppercase tracking-widest text-white/60">{t('bank.balance')}</p><p className="font-mono-game text-2xl font-bold sm:text-3xl">${formatMoney(game.balance)}</p></div><div className="text-right"><p className="text-[9px] text-white/60">VALID THRU</p><p className="font-mono-game text-sm">{game.bankCard.expiresAt}</p></div></div>
        </div>
      </div>
      <span className="absolute bottom-4 right-4 flex items-center gap-1 rounded-full bg-black/25 px-2 py-1 text-[10px] text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"><Settings2 className="h-3 w-3"/>Карты и дизайн</span>
    </button>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5"/>Мои банковские карты</DialogTitle><DialogDescription>Покупайте дизайны или открывайте особые карты за уровень.</DialogDescription></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{BANK_CARD_DESIGNS.map(card => { const isOwned=owned(card.id), active=game.bankCard.activeId===card.id; return <button key={card.id} onClick={() => { if (isOwned) game.selectBankCard(card.id); else if (game.buyBankCard(card.id)) toast.success(`Карта ${card.name} куплена`); else toast.error(card.unlockLevel ? `Откроется на ${card.unlockLevel} уровне` : 'Недостаточно средств'); }} className={`relative overflow-hidden rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 ${active?'border-primary ring-2 ring-primary/20':'border-border'}`}><div className="h-24 rounded-xl p-3 text-white shadow" style={{background:`linear-gradient(135deg,${card.colors[0]},${card.colors[1]})`}}><p className="text-xs font-bold">{card.name}</p><p className="mt-7 font-mono text-xs">•••• {game.bankCard.customNumber}</p></div><p className="mt-2 text-sm font-bold">{card.name}</p><p className="min-h-8 text-[11px] text-muted-foreground">{card.description}</p><div className="mt-2 flex items-center justify-between text-xs"><span>{card.unlockLevel ? `${card.unlockLevel} уровень` : card.price ? `$${formatMoney(card.price)}` : 'Бесплатно'}</span>{active?<Check className="h-4 w-4 text-primary"/>:!isOwned&&card.unlockLevel?<LockKeyhole className="h-4 w-4"/>:<Sparkles className="h-4 w-4"/>}</div></button>})}</div>
      <div className="rounded-2xl border bg-muted/20 p-4"><h3 className="flex items-center gap-2 text-sm font-bold"><Palette className="h-4 w-4"/>Персонализация активной карты</h3><div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-xs text-muted-foreground">Последние 4 цифры<input value={number} onChange={e=>setNumber(e.target.value.replace(/\D/g,'').slice(0,4))} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-foreground" placeholder="4242"/></label><label className="text-xs text-muted-foreground">Срок действия<input value={expires} onChange={e=>setExpires(e.target.value.slice(0,5))} className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-foreground" placeholder="12/30"/></label><label className="text-xs text-muted-foreground">Свой цвет<input type="color" value={color} onChange={e=>setColor(e.target.value)} className="mt-1 h-10 w-full cursor-pointer rounded-xl border bg-background p-1"/></label></div><button onClick={saveDesign} className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground">Сохранить оформление</button></div>
    </DialogContent></Dialog>
  </>;
};

export default BankCard;
