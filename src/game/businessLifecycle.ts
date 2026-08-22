import { businessCategories } from '@/data/businessNames';
import type { Business, EntrepreneurLicense } from './types';

export const ENTREPRENEUR_LICENSE_COST = 2_500;
export const BUSINESS_LEGAL_FORMS: Record<string, string> = {
  RU: 'Индивидуальный предприниматель (ИП)',
  US: 'Sole Proprietorship',
  DE: 'Einzelunternehmen',
  GB: 'Sole Trader',
  NL: 'Eenmanszaak',
};
export const BUSINESS_COUNTRIES = [
  { id: 'RU', name: 'Россия' }, { id: 'US', name: 'США' }, { id: 'DE', name: 'Германия' },
  { id: 'GB', name: 'Великобритания' }, { id: 'NL', name: 'Нидерланды' },
];

export interface SetupStep { id: string; name: string; description: string; cost: number; stage: Business['status'] }
export interface BusinessPlan {
  registrationCost: number;
  steps: SetupStep[];
  employeesRequired: number;
  salaryPerEmployee: number;
  hiringCost: number;
  operatingCostPerHour: number;
  taxRate: number;
}

const labels: Record<string, [string, string, string]> = {
  retail: ['Построить торговое помещение', 'Закупить витрины, кассы и мебель', 'Сформировать складской запас'],
  taxi: ['Построить диспетчерский центр и гараж', 'Закупить парк автомобилей', 'Установить связь и программное обеспечение'],
  food: ['Построить ресторан и кухню', 'Закупить кухонную технику и мебель', 'Получить санитарное оснащение'],
  manufacturing: ['Построить производственный корпус', 'Установить станки и линии', 'Организовать склад и логистику'],
  construction: ['Построить офис и базу техники', 'Закупить строительную технику', 'Закупить инструменты и оборудование'],
  education: ['Построить учебный центр', 'Оборудовать аудитории и мебель', 'Закупить компьютеры и учебные материалы'],
  medicine: ['Построить клинику', 'Закупить медицинское оборудование', 'Оборудовать кабинеты и аптечный склад'],
  'auto-dealer': ['Построить автосалон и сервис', 'Закупить демонстрационные автомобили', 'Оборудовать мастерскую и офис'],
  it: ['Построить технологический офис', 'Закупить серверы и рабочие станции', 'Развернуть облачную инфраструктуру'],
  bank: ['Построить банковский офис', 'Оборудовать хранилище и кассы', 'Развернуть защищённую IT-инфраструктуру'],
  sports: ['Построить спортивный комплекс', 'Закупить тренажёры и инвентарь', 'Оборудовать раздевалки и медицинский блок'],
  oil: ['Построить добывающий комплекс', 'Закупить буровые установки и транспорт', 'Построить хранилища и трубопровод'],
  airline: ['Построить операционный центр и ангары', 'Закупить воздушные суда', 'Оснастить наземную службу и системы безопасности'],
};

export function getBusinessPlan(categoryId: string): BusinessPlan {
  const category = businessCategories.find(item => item.id === categoryId)!;
  const scale = category.cost;
  const names = labels[categoryId] || ['Построить здание предприятия', 'Закупить мебель и оборудование', 'Организовать технику и логистику'];
  const employeesRequired = Math.max(2, Math.round(3 + Math.log10(Math.max(10, scale)) * 2));
  const salaryPerEmployee = Math.max(8, category.baseIncomePerHour * 0.018);
  return {
    registrationCost: Math.max(100, Math.round(scale * 0.015)),
    steps: [
      { id: 'facility', name: names[0], description: 'Капитальная основа предприятия', cost: Math.round(scale * 0.45), stage: 'building' },
      { id: 'equipment', name: names[1], description: 'Основные средства для запуска производства или услуг', cost: Math.round(scale * 0.28), stage: 'equipping' },
      { id: 'operations', name: names[2], description: 'Финальная подготовка рабочих процессов', cost: Math.round(scale * 0.17), stage: 'equipping' },
    ],
    employeesRequired,
    salaryPerEmployee,
    hiringCost: Math.round(employeesRequired * salaryPerEmployee * 8),
    operatingCostPerHour: category.baseIncomePerHour * 0.08,
    taxRate: 0.13,
  };
}

export function createLicense(country: string, now = Date.now()): EntrepreneurLicense {
  return { id: `LIC-${country}-${now.toString(36).toUpperCase()}`, country, legalForm: BUSINESS_LEGAL_FORMS[country] || 'Individual Business License', issuedAt: now };
}

export function calculateBusinessNet(business: Business): number {
  if (business.status !== 'operating') return 0;
  return Math.max(0, (business.grossRevenuePerHour || 0) - (business.salaryCostPerHour || 0) - (business.operatingCostPerHour || 0) - (business.taxCostPerHour || 0));
}

export function migrateBusiness(business: Business): Business {
  if (business.status) return business;
  const plan = getBusinessPlan(business.categoryId);
  const salary = plan.employeesRequired * plan.salaryPerEmployee;
  const gross = (business.incomePerHour + salary + plan.operatingCostPerHour) / (1 - plan.taxRate);
  return { ...business, status: 'operating', registrationNumber: `LEGACY-${business.id.slice(-8).toUpperCase()}`, completedSetupSteps: plan.steps.map(step => step.id), employeesHired: plan.employeesRequired, employeesRequired: plan.employeesRequired, grossRevenuePerHour: gross, salaryCostPerHour: salary, operatingCostPerHour: plan.operatingCostPerHour, taxCostPerHour: gross * plan.taxRate, incomePerHour: business.incomePerHour, taxPaid: true, taxAmount: 0 };
}
