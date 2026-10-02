import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Pause, Play } from 'lucide-react';
import type { CatActivity } from './catReactions';

export default function CatCompanion({ activity }: { activity: MutableRefObject<CatActivity> }) {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(() => { try { return localStorage.getItem('earningCatPaused') === 'true'; } catch { return false; } });
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  useEffect(() => {
    if (paused || !canvas.current || !host.current) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    setStatus('loading');
    void import('./createCatScene').then(({ createCatScene }) => {
      if (cancelled || !canvas.current || !host.current) return;
      const scene = createCatScene(canvas.current, activity.current, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      const resize = new ResizeObserver(entries => { const r = entries[0]?.contentRect; if (r) scene.resize(r.width, r.height); });
      const visible = new IntersectionObserver(entries => scene.setVisible(entries[0]?.isIntersecting ?? false));
      resize.observe(host.current); visible.observe(host.current);
      cleanup = () => { resize.disconnect(); visible.disconnect(); scene.dispose(); };
      setStatus('ready');
    }).catch(() => { if (!cancelled) setStatus('unavailable'); });
    return () => { cancelled = true; cleanup?.(); };
  }, [activity, paused]);
  const toggle = () => {
    setPaused(value => { try { localStorage.setItem('earningCatPaused', String(!value)); } catch { /* Cosmetic preference only. */ } return !value; });
  };
  return <section aria-label="Кот-бухгалтер" className="relative min-w-0 overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-sky-500/[0.07] via-card/40 to-card/70 xl:sticky xl:top-4">
    <div className="flex items-center justify-between px-5 pt-5">
      <div><p className="text-xs font-medium uppercase tracking-[.18em] text-muted-foreground">Ваш напарник</p><h3 className="mt-1 text-lg font-semibold">Кот-бухгалтер</h3></div>
      <button type="button" onClick={toggle} aria-label={paused ? 'Показать кота' : 'Скрыть кота'} title={paused ? 'Показать кота' : 'Скрыть кота'} className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground">{paused ? <Play size={15} /> : <Pause size={15} />}</button>
    </div>
    <div ref={host} className="relative h-[360px] w-full sm:h-[440px] xl:h-[520px]">
      {!paused && <canvas ref={canvas} aria-label="Пухлый рыжий кот за столом с калькулятором. От быстрых кликов он удивлённо поворачивается к вам." role="img" className="pointer-events-none block h-full w-full" />}
      {(paused || status !== 'ready') && <p role="status" className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-muted-foreground">{paused ? 'Кот ушёл на перерыв' : status === 'unavailable' ? '3D-сцена недоступна на этом устройстве. Можно продолжать играть.' : 'Кот устраивается за столом…'}</p>}
    </div>
    <p className="px-5 pb-5 text-center text-sm text-muted-foreground">Деньги любит. Считать не успевает.</p>
  </section>;
}
