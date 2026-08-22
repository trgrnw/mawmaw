import { describe, expect, it } from 'vitest';
import {
  BUSINESS_LEGAL_FORMS,
  calculateBusinessNet,
  createLicense,
  getBusinessPlan,
  migrateBusiness,
} from '@/game/businessLifecycle';
import type { Business } from '@/game/types';

const legacyBusiness: Business = {
  id: 'business-legacy-001',
  name: 'Старое предприятие',
  categoryId: 'retail',
  categoryName: 'Розничная торговля',
  emoji: 'store',
  investmentCost: 10_000,
  incomePerHour: 500,
  taxRate: 0.13,
  taxDueAt: 0,
  taxPaid: true,
  taxAmount: 0,
  createdAt: 1,
};

describe('business lifecycle', () => {
  it('does not generate income before the enterprise is operating', () => {
    expect(calculateBusinessNet({
      ...legacyBusiness,
      status: 'registered',
      grossRevenuePerHour: 1_000,
    })).toBe(0);
  });

  it('subtracts salaries, operating costs and tax from gross revenue', () => {
    expect(calculateBusinessNet({
      ...legacyBusiness,
      status: 'operating',
      grossRevenuePerHour: 1_000,
      salaryCostPerHour: 200,
      operatingCostPerHour: 100,
      taxCostPerHour: 130,
    })).toBe(570);
  });

  it('migrates an old business without changing its former net income', () => {
    const migrated = migrateBusiness(legacyBusiness);
    expect(migrated.status).toBe('operating');
    expect(migrated.completedSetupSteps).toHaveLength(3);
    expect(calculateBusinessNet(migrated)).toBeCloseTo(legacyBusiness.incomePerHour, 8);
  });

  it('builds an ordered, fully priced setup plan for every category', () => {
    const plan = getBusinessPlan('taxi');
    expect(plan.registrationCost).toBeGreaterThan(0);
    expect(plan.steps.map(step => step.id)).toEqual(['facility', 'equipment', 'operations']);
    expect(plan.steps.every(step => step.cost > 0)).toBe(true);
    expect(plan.employeesRequired).toBeGreaterThan(1);
    expect(plan.taxRate).toBe(0.13);
  });

  it('issues a country-specific entrepreneur licence', () => {
    const license = createLicense('RU', 12345);
    expect(license.legalForm).toBe(BUSINESS_LEGAL_FORMS.RU);
    expect(license.id).toContain('LIC-RU-');
  });
});
