import React, { useState, useEffect, useRef } from 'react';
import LicensePlate, { type LicensePlateData } from './LicensePlate';

interface PlateSlotAnimationProps {
  plate: LicensePlateData;
  onComplete: () => void;
}

const SPIN_CHARS_RU = 'АВЕКМНОРСТУХ0123456789';
const SPIN_CHARS_EN = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
const SPIN_CHARS_CN = '京沪粤苏浙鲁豫冀ABCDEFG0123456789·';

function getSpinChars(country: string): string {
  if (country === 'RU' || country === 'UA') return SPIN_CHARS_RU;
  if (country === 'CN') return SPIN_CHARS_CN;
  return SPIN_CHARS_EN;
}

const PlateSlotAnimation: React.FC<PlateSlotAnimationProps> = ({ plate, onComplete }) => {
  const chars = plate.text.split('');
  const [revealedCount, setRevealedCount] = useState(0);
  const [spinChars, setSpinChars] = useState<string[]>(chars.map(() => ' '));
  const spinInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const pool = getSpinChars(plate.country);

  // Spin unrevealed characters rapidly
  useEffect(() => {
    spinInterval.current = setInterval(() => {
      setSpinChars(prev =>
        prev.map((_, i) => {
          if (i < revealedCount) return chars[i];
          // Spaces stay as spaces
          if (chars[i] === ' ') return ' ';
          return pool[Math.floor(Math.random() * pool.length)];
        })
      );
    }, 50);
    return () => { if (spinInterval.current) clearInterval(spinInterval.current); };
  }, [revealedCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reveal characters one by one
  useEffect(() => {
    if (revealedCount >= chars.length) {
      // All revealed — stop spinning, fire complete
      if (spinInterval.current) clearInterval(spinInterval.current);
      setSpinChars([...chars]);
      const t = setTimeout(onComplete, 800);
      return () => clearTimeout(t);
    }

    // Skip spaces instantly
    if (chars[revealedCount] === ' ') {
      setRevealedCount(prev => prev + 1);
      return;
    }

    const delay = 300 + Math.random() * 200;
    const t = setTimeout(() => setRevealedCount(prev => prev + 1), delay);
    return () => clearTimeout(t);
  }, [revealedCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayText = spinChars.join('');

  const displayPlate: LicensePlateData = {
    ...plate,
    text: displayText,
  };

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Glow effect */}
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
        <div className="relative">
          <LicensePlate plate={displayPlate} size="lg" />
        </div>
      </div>

      {/* Character indicators */}
      <div className="flex gap-0.5">
        {chars.map((c, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              c === ' '
                ? 'bg-transparent'
                : i < revealedCount
                  ? 'bg-primary scale-100'
                  : 'bg-muted-foreground/30 scale-75'
            }`}
          />
        ))}
      </div>

      {/* Status text */}
      <p className="text-xs text-muted-foreground animate-pulse">
        {revealedCount < chars.length ? '🎰 Генерация номера...' : '✅ Номер получен!'}
      </p>
    </div>
  );
};

export default PlateSlotAnimation;
