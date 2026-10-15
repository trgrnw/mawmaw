import { AtSign, CreditCard, Sparkles } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { showcaseCategoryKeys, type ShowcaseItem } from '@/lib/showcase';

export default function ShowcaseCard({ item }: { item: ShowcaseItem }) {
  const { t } = useI18n();
  const label = t(showcaseCategoryKeys[item.cat] || 'profile.showcase');
  const username = item.cat === 'favorite_username';
  const plate = item.cat === 'favorite_plate';
  if (username || plate) return <div className={`relative flex min-h-40 flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left ${username ? 'border-sky-500/25 bg-gradient-to-br from-sky-500/15 via-card to-indigo-500/15' : 'border-amber-500/25 bg-gradient-to-br from-amber-500/15 via-card to-orange-500/10'}`}>
    <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-medium text-muted-foreground">{label}</span>{username ? <AtSign className="h-4 w-4 text-sky-400" /> : <CreditCard className="h-4 w-4 text-amber-400" />}</div>
    {username ? <p className="my-4 break-all text-xl font-bold tracking-tight text-sky-400">@{item.name.replace(/^@/, '')}</p>
      : <div className="my-4 flex min-w-0 items-center justify-center rounded-lg border-2 border-zinc-700 bg-gradient-to-b from-white to-zinc-200 px-2 py-3 shadow-lg"><p className="break-words text-center font-mono text-base font-black tracking-wider text-zinc-950">{item.name}</p>{item.country && <span className="ml-2 border-l border-zinc-400 pl-2 text-[9px] font-semibold text-zinc-700">{item.country}</span>}</div>}
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Sparkles className="h-3 w-3" />{t('profile.showcase')}</div>
  </div>;
  return <div className="overflow-hidden rounded-2xl border bg-card text-left">
    {item.image ? <div className="relative aspect-[4/3] overflow-hidden"><img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" /><div className="absolute inset-x-0 bottom-0 p-3"><p className="text-[10px] text-white/70">{label}</p><p className="break-words text-sm font-bold text-white">{item.name}</p></div></div>
      : <div className="flex min-h-40 flex-col justify-center p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 break-words font-semibold">{item.name}</p></div>}
  </div>;
}
