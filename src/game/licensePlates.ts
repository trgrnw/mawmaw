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
  const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  const randInt = (min: number, max: number) => Math.floor(random() * (max - min + 1)) + min;
  const pick = (s: string) => s[Math.floor(random() * s.length)];
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
      return /^[\u4e00-\u9fff]{1,2}[A-Z]·?\d{5}$/.test(clean);
    default:
      return /^[A-ZА-Я0-9 ·-]+$/.test(clean) && clean.length >= 2;
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

