export const REAL_ESTATE_TAX_RATE = 0.07;
export const REAL_ESTATE_UPGRADES = [
  { id: 'appliances', name: 'Обновить бытовую технику', description: 'Современная техника повышает привлекательность аренды', costRate: 0.08, incomeBonus: 0.10 },
  { id: 'furniture', name: 'Обновить мебель', description: 'Премиальная меблировка позволяет поднять арендную ставку', costRate: 0.12, incomeBonus: 0.15 },
  { id: 'internet', name: 'Провести высокоскоростной интернет', description: 'Быстрое подключение для жильцов и удалённой работы', costRate: 0.05, incomeBonus: 0.07 },
  { id: 'parking', name: 'Организовать паркинг для жильцов', description: 'Собственная парковка заметно повышает доход объекта', costRate: 0.18, incomeBonus: 0.22 },
] as const;
