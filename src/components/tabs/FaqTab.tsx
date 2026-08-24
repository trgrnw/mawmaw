import React, { useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, ChevronDown, ExternalLink, HelpCircle, Info, LockKeyhole, Scale, ShieldCheck, XCircle } from 'lucide-react';
import GameIcon from '@/components/GameIcon';
import { useI18n } from '@/i18n/I18nContext';
import { faqContent, type RuleEntry } from '@/data/faqContent';

type Section = 'questions' | 'rules' | 'privacy';

const ruleStyle: Record<RuleEntry['tone'], { icon: React.ElementType; color: string; bg: string }> = {
  allowed: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
  prohibited: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
  neutral: { icon: Info, color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500/20' },
};

const FaqTab: React.FC = () => {
  const { locale } = useI18n();
  const [section, setSection] = useState<Section>('questions');
  const content = faqContent[locale === 'en' ? 'en' : 'ru'];

  return <div className="max-w-6xl space-y-5 pb-10">
    <header className="relative overflow-hidden rounded-3xl border border-sky-500/20 bg-card p-6 sm:p-8">
      <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15"><GameIcon name="faq" size={26} themed /></div><h1 className="text-2xl font-bold sm:text-3xl">FAQ & Rules</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{content.hero}</p><p className="mt-3 text-xs text-muted-foreground">{content.updated}</p></div>
        <div className="grid grid-cols-3 gap-2"><Stat value={content.questions.length} label={locale === 'en' ? 'answers' : 'ответов'} /><Stat value={content.rules.length} label={locale === 'en' ? 'rules' : 'правил'} /><Stat value={content.privacy.length} label={locale === 'en' ? 'privacy sections' : 'разделов политики'} /></div>
      </div>
    </header>

    <nav className="grid grid-cols-3 gap-2 rounded-2xl border bg-card p-1.5">
      <NavButton active={section === 'questions'} onClick={() => setSection('questions')} icon={HelpCircle} label={locale === 'en' ? 'Questions' : 'Вопросы'} />
      <NavButton active={section === 'rules'} onClick={() => setSection('rules')} icon={Scale} label={locale === 'en' ? 'Rules' : 'Правила'} />
      <NavButton active={section === 'privacy'} onClick={() => setSection('privacy')} icon={ShieldCheck} label={locale === 'en' ? 'Privacy' : 'Конфиденциальность'} />
    </nav>

    {section === 'questions' && <section className="grid gap-3 lg:grid-cols-2">{content.questions.map((item, index) => <Disclosure key={item.question} title={item.question} index={index + 1}><p>{item.answer}</p></Disclosure>)}</section>}

    {section === 'rules' && <section className="space-y-4">
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500"/><div><h2 className="font-bold">{locale === 'en' ? 'Freedom without abuse' : 'Свобода без злоупотреблений'}</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{content.rulesIntro}</p></div></div></div>
      <div className="grid gap-3 lg:grid-cols-2">{content.rules.map((rule, index) => { const style=ruleStyle[rule.tone], Icon=style.icon; return <article key={rule.title} className={`rounded-2xl border p-5 ${style.bg}`}><div className="flex items-start gap-3"><Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.color}`}/><div><p className="text-xs font-mono-game text-muted-foreground">{String(index + 1).padStart(2, '0')}</p><h3 className="mt-1 font-bold">{rule.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{rule.text}</p></div></div></article>})}</div>
    </section>}

    {section === 'privacy' && <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3"><Promise icon={LockKeyhole} title={locale === 'en' ? 'Passwords stay private' : 'Пароль не виден разработчику'} /><Promise icon={ShieldCheck} title={locale === 'en' ? 'Personal data is not sold' : 'Данные не продаются'} /><Promise icon={BookOpen} title={locale === 'en' ? 'No ad tracking today' : 'Нет рекламных трекеров'} /></div>
      <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5 text-sm leading-relaxed text-muted-foreground">{content.privacyIntro}</div>
      <div className="space-y-3">{content.privacy.map((item, index) => <Disclosure key={item.title} title={item.title} index={index + 1} defaultOpen={index === 0}><TextWithLinks text={item.text}/>{item.bullets && <ul className="mt-3 space-y-2">{item.bullets.map(bullet => <li key={bullet} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"/><TextWithLinks text={bullet}/></li>)}</ul>}</Disclosure>)}</div>
      <div className="rounded-2xl border bg-card p-5 text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">{locale === 'en' ? 'Plain-language notice:' : 'Важно:'}</strong> {locale === 'en' ? 'This page is intended to clearly explain current game behavior. Applicable law and provider terms still apply.' : 'Эта страница простыми словами описывает текущую работу игры. Требования применимого законодательства и условия поставщиков сервисов продолжают действовать.'}</div>
    </section>}
  </div>;
};

const NavButton=({active,onClick,icon:Icon,label}:{active:boolean;onClick:()=>void;icon:React.ElementType;label:string})=><button onClick={onClick} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold transition-all sm:text-sm ${active?'bg-primary text-primary-foreground shadow-sm':'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon className="h-4 w-4"/>{label}</button>;
const Stat=({value,label}:{value:number;label:string})=><div className="min-w-20 rounded-2xl border bg-background/60 px-3 py-3 text-center"><p className="font-mono-game text-lg font-bold">{value}</p><p className="text-[9px] text-muted-foreground">{label}</p></div>;
const Promise=({icon:Icon,title}:{icon:React.ElementType;title:string})=><div className="flex items-center gap-3 rounded-2xl border bg-card p-4"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10"><Icon className="h-4 w-4 text-emerald-500"/></div><p className="text-sm font-semibold">{title}</p></div>;
const Disclosure=({title,index,children,defaultOpen=false}:{title:string;index:number;children:React.ReactNode;defaultOpen?:boolean})=><details open={defaultOpen || undefined} className="group overflow-hidden rounded-2xl border bg-card"><summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40"><span className="font-mono-game text-[10px] text-sky-500">{String(index).padStart(2,'0')}</span><span className="flex-1 text-sm font-bold">{title}</span><ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"/></summary><div className="border-t px-5 py-4 text-sm leading-relaxed text-muted-foreground">{children}</div></details>;
const TextWithLinks=({text}:{text:string})=>{const parts=text.split(/(https?:\/\/[^\s.]+(?:\.[^\s.]+)*)/g);return <p>{parts.map((part,i)=>part.startsWith('http')?<a key={i} href={part} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">{part}<ExternalLink className="h-3 w-3"/></a>:part)}</p>};

export default FaqTab;
