import React from 'react';

export interface LicensePlateData {
  id: string;
  text: string;
  country: string; // 'RU' | 'US' | 'DE' | 'PL' | 'UA' | 'CN'
  assignedTo: string | null; // car item id
  isCustom: boolean;
}

export const PLATE_COUNTRIES = [
  { id: 'RU', name: 'Россия', flag: '🇷🇺' },
  { id: 'US', name: 'США', flag: '🇺🇸' },
  { id: 'DE', name: 'Германия', flag: '🇩🇪' },
  { id: 'PL', name: 'Польша', flag: '🇵🇱' },
  { id: 'UA', name: 'Украина', flag: '🇺🇦' },
  { id: 'CN', name: 'Китай', flag: '🇨🇳' },
];

export const RANDOM_PLATE_PRICE = 5000;
export const CUSTOM_PLATE_PRICE = 25000;

// Letters used in Russian plates (only those that look like Latin)
const RU_LETTERS = 'АВЕКМНОРСТУХ';
const EN_LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ';

export function generateRandomPlate(country: string): string {
  const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const digits = (n: number) => Array.from({ length: n }, () => randInt(0, 9)).join('');

  switch (country) {
    case 'RU':
      return `${pick(RU_LETTERS)}${digits(3)}${pick(RU_LETTERS)}${pick(RU_LETTERS)} ${randInt(1, 199)}`;
    case 'US':
      return `${pick(EN_LETTERS)}${pick(EN_LETTERS)}${pick(EN_LETTERS)} ${digits(4)}`;
    case 'DE':
      return `FC ${pick(EN_LETTERS)}${pick(EN_LETTERS)} ${digits(4)}`;
    case 'PL':
      return `FC ${digits(5)}`;
    case 'UA':
      return `${pick(RU_LETTERS)}${pick(RU_LETTERS)} ${digits(4)} ${pick(RU_LETTERS)}${pick(RU_LETTERS)}`;
    case 'CN':
      return `京${pick(EN_LETTERS)}·${digits(5)}`;
    default:
      return `${pick(EN_LETTERS)}${pick(EN_LETTERS)}${pick(EN_LETTERS)} ${digits(4)}`;
  }
}

// Validate custom plate text based on country format
export function validateCustomPlate(text: string, country: string): boolean {
  const clean = text.trim().toUpperCase();
  if (clean.length < 2 || clean.length > 16) return false;

  switch (country) {
    case 'RU': {
      // Format: Б 123 ББ 77 (letter digits*3 letters*2 region)
      return /^[АВЕКМНОРСТУХ]\s?\d{3}\s?[АВЕКМНОРСТУХ]{2}\s?\d{1,3}$/.test(clean);
    }
    case 'UA': {
      // Format: ББ 1234 ББ
      return /^[АВЕКМНОРСТУХ]{2}\s?\d{4}\s?[АВЕКМНОРСТУХ]{2}$/.test(clean);
    }
    case 'US':
      return /^[A-Z]{2,3}\s?\d{3,4}$/.test(clean);
    case 'DE':
      return /^[A-Z]{1,3}\s?[A-Z]{1,2}\s?\d{1,4}$/.test(clean);
    case 'PL':
      return /^[A-Z]{2,3}\s?\d{4,5}$/.test(clean);
    case 'CN':
      return /^.{1,2}[A-Z]·?\d{5}$/.test(clean);
    default:
      return /^[A-ZА-Я0-9 ·\-]+$/.test(clean) && clean.length >= 2;
  }
}

// Format helper text for each country
export function getPlateFormatHint(country: string): string {
  switch (country) {
    case 'RU': return 'Формат: А 123 ВС 77';
    case 'UA': return 'Формат: АА 1234 АА';
    case 'US': return 'Формат: ABC 1234';
    case 'DE': return 'Формат: FC AB 1234';
    case 'PL': return 'Формат: FC 12345';
    case 'CN': return 'Формат: 京A·12345';
    default: return '2-16 символов';
  }
}

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
