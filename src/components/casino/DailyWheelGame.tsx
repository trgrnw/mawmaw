import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/context/GameContext';
import { toast } from 'sonner';
import GameIcon from '@/components/GameIcon';
import { useI18n } from '@/i18n/I18nContext';

interface Props { onBack: () => void; }

// 8 segments matching server's spin_daily_wheel
const SEGMENTS = [
  { amount: 1000,     label: '$1K',   color: '#94a3b8' },
  { amount: 5000,     label: '$5K',   color: '#60a5fa' },
  { amount: 10000,    label: '$10K',  color: '#34d399' },
  { amount: 50000,    label: '$50K',  color: '#a78bfa' },
  { amount: 100000,   label: '$100K', color: '#fbbf24' },
  { amount: 250000,   label: '$250K', color: '#fb7185' },
  { amount: 1000000,  label: '$1M',   color: '#f472b6' },
  { amount: 10000000, label: '$10M',  color: '#fde047' },
];

const SEG_DEG = 360 / SEGMENTS.length;

const DailyWheelGame: React.FC<Props> = ({ onBack }) => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [lastSpin, setLastSpin] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const [recentPrize, setRecentPrize] = useState<{ label: string; amount: number } | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  // Load last spin time
  useEffect(() => {
    if (!user) return;
    supabase
      .from('daily_wheel_spins')
      .select('created_at, prize_amount, prize_label')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setLastSpin(new Date(data.created_at));
          setRecentPrize({ label: data.prize_label, amount: Number(data.prize_amount) });
        }
      });
  }, [user]);

  // Tick clock for cooldown
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  const cooldownMs = lastSpin ? Math.max(0, 24 * 3600 * 1000 - (now.getTime() - lastSpin.getTime())) : 0;
  const canSpin = !spinning && cooldownMs === 0 && !!user;

  const formatCooldown = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleSpin = async () => {
    if (!canSpin) return;
    setSpinning(true);
    try {
      const { data, error } = await supabase.rpc('spin_daily_wheel');
      if (error) throw error;
      const result = data as { segment: number; amount: number; label: string };
      // segment center angle (clockwise from top). pointer at top (0deg).
      // We want segment center to land at top (0deg).
      const segmentCenter = result.segment * SEG_DEG + SEG_DEG / 2;
      // Add 6 full turns + offset to align center at top (negate because we rotate the wheel)
      const targetRotation = rotation + 360 * 6 + (360 - segmentCenter);
      setRotation(targetRotation);
      // Wait for animation
      setTimeout(() => {
        setSpinning(false);
        setLastSpin(new Date());
        setRecentPrize({ label: result.label, amount: result.amount });
        toast.success(`🎉 ${t('wheel.won')} ${result.label}!`, {
          description: `$${formatMoney(result.amount)} ${t('wheel.credited')}`,
          duration: 6000,
        });
      }, 5200);
    } catch (e: any) {
      setSpinning(false);
      toast.error(e.message || t('wheel.error'));
    }
  };

  // Build conic-gradient for wheel segments
  const conicStops = SEGMENTS.map((s, i) => {
    const start = i * SEG_DEG;
    const end = (i + 1) * SEG_DEG;
    return `${s.color} ${start}deg ${end}deg`;
  }).join(', ');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <GameIcon name="arrow-left" size={16} /> {t('casino.back')}
        </button>
        {user && (
          <div className="text-right text-xs text-muted-foreground">
            {cooldownMs > 0 ? `${t('wheel.next')}: ${formatCooldown(cooldownMs)}` : t('wheel.available')}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">🎡 {t('wheel.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('wheel.subtitle')}</p>
      </div>

      <div className="relative mx-auto" style={{ width: 400, maxWidth: '90vw' }}>
        {/* Pointer */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-3 z-20">
          <div
            className="w-0 h-0"
            style={{
              borderLeft: '14px solid transparent',
              borderRight: '14px solid transparent',
              borderTop: '24px solid hsl(var(--primary))',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
            }}
          />
        </div>

        {/* Wheel */}
        <div
          ref={wheelRef}
          className="relative aspect-square rounded-full border-8 border-foreground/20 shadow-2xl"
          style={{
            background: `conic-gradient(from 0deg, ${conicStops})`,
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 5s cubic-bezier(0.17, 0.67, 0.16, 0.99)' : 'none',
          }}
        >
          {SEGMENTS.map((seg, i) => {
            const angle = i * SEG_DEG + SEG_DEG / 2;
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 origin-left text-white font-bold text-sm sm:text-base drop-shadow"
                style={{
                  transform: `rotate(${angle - 90}deg) translate(0, -50%)`,
                  width: '46%',
                  textAlign: 'right',
                  paddingRight: '20px',
                  pointerEvents: 'none',
                }}
              >
                {seg.label}
              </div>
            );
          })}

          {/* Center hub */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-card border-4 border-foreground/20 flex items-center justify-center text-2xl shadow-inner">
            🎰
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleSpin}
          disabled={!canSpin}
          className={`px-8 py-3 rounded-xl font-bold text-base transition-all ${
            canSpin
              ? 'bg-primary text-primary-foreground hover:opacity-90 shadow-lg hover:scale-105'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          {spinning ? t('wheel.spinning') : cooldownMs > 0 ? `${t('wheel.available_in')} ${formatCooldown(cooldownMs)}` : `🎲 ${t('wheel.spin')}`}
        </button>
        {!user && <p className="text-xs text-muted-foreground">{t('wheel.login')}</p>}
        {recentPrize && !spinning && (
          <div className="bg-card rounded-xl border p-3 text-center">
            <p className="text-xs text-muted-foreground">{t('wheel.last_prize')}</p>
            <p className="text-xl font-bold text-foreground">{recentPrize.label}</p>
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border p-4">
        <h4 className="text-sm font-semibold mb-2">{t('wheel.chances')}</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[
            { l: '$1K', p: '25%' }, { l: '$5K', p: '20%' }, { l: '$10K', p: '15%' }, { l: '$50K', p: '12%' },
            { l: '$100K', p: '10%' }, { l: '$250K', p: '8%' }, { l: '$1M', p: '6%' }, { l: '$10M', p: '4%' },
          ].map(s => (
            <div key={s.l} className="bg-muted/30 rounded-lg px-2 py-1.5 flex justify-between">
              <span className="font-medium">{s.l}</span>
              <span className="text-muted-foreground">{s.p}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DailyWheelGame;
