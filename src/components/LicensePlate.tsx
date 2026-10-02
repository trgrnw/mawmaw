import React from 'react';

import type { LicensePlateData } from '@/game/licensePlates';
export { PLATE_COUNTRIES, RANDOM_PLATE_PRICE, CUSTOM_PLATE_PRICE, generateRandomPlate, validateCustomPlate, getPlateFormatHint } from '@/game/licensePlates';
export type { LicensePlateData } from '@/game/licensePlates';

interface LicensePlateProps {
  plate: LicensePlateData;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const countryStyles: Record<string, { bg: string; border: string; textColor: string; accent: string }> = {
  RU: { bg: 'bg-white', border: 'border-black', textColor: 'text-black', accent: '🇷🇺' },
  US: { bg: 'bg-white', border: 'border-blue-700', textColor: 'text-blue-900', accent: '🇺🇸' },
  DE: { bg: 'bg-white', border: 'border-black', textColor: 'text-black', accent: '🇩🇪' },
  PL: { bg: 'bg-white', border: 'border-black', textColor: 'text-black', accent: '🇵🇱' },
  UA: { bg: 'bg-[#005BBB]', border: 'border-[#005BBB]', textColor: 'text-black', accent: '🇺🇦' },
  CN: { bg: 'bg-blue-700', border: 'border-blue-800', textColor: 'text-white', accent: '🇨🇳' },
};

const LicensePlate: React.FC<LicensePlateProps> = ({ plate, size = 'md', className = '' }) => {
  const style = countryStyles[plate.country] || countryStyles.US;
  const isUA = plate.country === 'UA';
  const isCN = plate.country === 'CN';

  const sizeClasses = {
    sm: 'px-2 py-1 text-[10px] gap-0.5 rounded-md',
    md: 'px-2.5 py-1 text-[11px] gap-1 rounded-md',
    lg: 'px-4 py-2 text-sm gap-1.5 rounded-lg',
  };

  const plateBg = isCN ? 'bg-blue-700' : isUA ? 'bg-white' : style.bg;
  const plateText = isCN ? 'text-white' : style.textColor;

  return (
    <div
      className={`inline-flex items-center ${sizeClasses[size]} border-2 ${style.border} ${plateBg} font-bold tracking-wider ${plateText} shadow-sm ${className}`}
      style={{ fontFamily: "'Arial Black', 'Impact', sans-serif", lineHeight: 1.1 }}
    >
      {plate.country === 'UA' && (
        <span className="bg-[#005BBB] text-white px-0.5 rounded-sm text-[8px] mr-0.5">UA</span>
      )}
      <span className="whitespace-nowrap">{plate.text}</span>
      {plate.country === 'RU' && (
        <span className="ml-0.5 flex flex-col items-center leading-none">
          <span className="text-[6px] font-normal">RUS</span>
        </span>
      )}
      {plate.country !== 'UA' && plate.country !== 'RU' && (
        <span className="text-[7px] ml-0.5 opacity-70">{plate.country}</span>
      )}
    </div>
  );
};

export default LicensePlate;
