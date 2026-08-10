import type { Business } from './types';
import { BUSINESS_SELL_REFUND_RATE, BUSINESS_TAX_RATE, TAX_PERIOD_MS } from './constants';

export function createBusiness(input: {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  emoji: string;
  investmentCost: number;
  incomePerHour: number;
  now?: number;
}): Business {
  const now = input.now ?? Date.now();
  return {
    id: input.id,
    name: input.name,
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    emoji: input.emoji,
    investmentCost: input.investmentCost,
    incomePerHour: input.incomePerHour,
    taxRate: BUSINESS_TAX_RATE,
    taxDueAt: now + TAX_PERIOD_MS,
    taxPaid: true,
    taxAmount: 0,
    createdAt: now,
  };
}

export function calculateBusinessTax(business: Pick<Business, 'incomePerHour'>): number {
  return business.incomePerHour * 72 * BUSINESS_TAX_RATE;
}

export function calculateBusinessRefund(business: Pick<Business, 'investmentCost'>): number {
  return business.investmentCost * BUSINESS_SELL_REFUND_RATE;
}

export function calculateTotalTaxDue(businesses: Business[], now = Date.now()): number {
  return businesses
    .filter(business => !business.taxPaid && now >= business.taxDueAt)
    .reduce((sum, business) => sum + business.taxAmount, 0);
}
