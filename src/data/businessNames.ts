// Fictional name components; no real business directory or brand list is used.
// These creative names are not a trademark-clearance certification.
const nameRoots = ["Avelqor", "Brenvilo", "Caldrevo", "Dovrenix", "Elnavero", "Fenvoria", "Grelvane", "Havrelio", "Istravon", "Jorveliq", "Kelmavio", "Lunqevra", "Morvexil", "Nerquivo", "Ostravel", "Penvorix", "Quelmara", "Renvazio", "Selqorin", "Tervunio"];
const makeBusinessNames = (suffixes: string[]): string[] =>
  nameRoots.flatMap(root => suffixes.map(suffix => `${root} ${suffix}`));

export interface BusinessCategory {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  baseIncomePerHour: number; // base hourly income
  names: string[];
}

export const businessCategories: BusinessCategory[] = [
  {
    id: 'retail',
    name: 'Продажа',
    emoji: '🛍️',
    cost: 4999,
    baseIncomePerHour: 250,
    names: makeBusinessNames(["Market", "Goods", "Stores", "Trading", "Outlet", "Bazaar", "Retail", "Supply", "Mart", "Emporium"]),
  },
  {
    id: 'taxi',
    name: 'Таксопарк',
    emoji: '🚕',
    cost: 17899,
    baseIncomePerHour: 890,
    names: makeBusinessNames(["Rides", "Cabs", "Transit", "Fleet", "Mobility", "Routes", "Shuttle", "Drive", "Transfer", "Taxi"]),
  },
  {
    id: 'food',
    name: 'Общепит',
    emoji: '🍔',
    cost: 23999,
    baseIncomePerHour: 1200,
    names: makeBusinessNames(["Kitchen", "Bistro", "Bakery", "Table", "Pantry", "Diner", "Grill", "Eatery", "Supper", "Catering"]),
  },
  {
    id: 'manufacturing',
    name: 'Производство',
    emoji: '🏭',
    cost: 38999,
    baseIncomePerHour: 1950,
    names: makeBusinessNames(["Works", "Foundry", "Industries", "Fabrication", "Assembly", "Machining", "Forge", "Components", "Production", "Toolworks"]),
  },
  {
    id: 'construction',
    name: 'Строительство',
    emoji: '🏗️',
    cost: 78999,
    baseIncomePerHour: 3950,
    names: makeBusinessNames(["Builders", "Structures", "Foundations", "Masonry", "Construction", "Frameworks", "Developments", "Brickworks", "Contracting", "Roofing"]),
  },
  {
    id: 'education',
    name: 'Образование',
    emoji: '📚',
    cost: 122999,
    baseIncomePerHour: 6150,
    names: makeBusinessNames(["Academy", "Learning", "School", "Tutoring", "Studies", "Courses", "Classroom", "Scholars", "Education", "Institute"]),
  },
  {
    id: 'medicine',
    name: 'Медицина',
    emoji: '🏥',
    cost: 189999,
    baseIncomePerHour: 9500,
    names: makeBusinessNames(["Clinic", "Care", "Medical", "Wellness", "Diagnostics", "Therapy", "Health", "Remedies", "Dental", "Recovery"]),
  },
  {
    id: 'auto-dealer',
    name: 'Автомобильный дилер',
    emoji: '🚗',
    cost: 250000,
    baseIncomePerHour: 12500,
    names: makeBusinessNames(["Motors", "Autos", "Vehicles", "Autohouse", "Showroom", "Carriage", "Autotrade", "Autoplaza", "Motorhall", "Carworks"]),
  },
  {
    id: 'it',
    name: 'IT-компания',
    emoji: '💻',
    cost: 478999,
    baseIncomePerHour: 24000,
    names: makeBusinessNames(["Systems", "Software", "Computing", "Digital", "Networks", "Logic", "Code", "Cloud", "Dataworks", "Technologies"]),
  },
  {
    id: 'bank',
    name: 'Банк',
    emoji: '🏦',
    cost: 10000000,
    baseIncomePerHour: 500000,
    names: makeBusinessNames(["Bank", "Capital", "Finance", "Treasury", "Savings", "Credit", "Trust", "Holdings", "Securities", "Funds"]),
  },
  {
    id: 'sports',
    name: 'Спортивный клуб',
    emoji: '⚽',
    cost: 50000000,
    baseIncomePerHour: 2500000,
    names: makeBusinessNames(["Athletics", "Sport", "Arena", "Fitness", "Training", "Club", "Stadium", "Racing", "Champions", "Team"]),
  },
  {
    id: 'oil',
    name: 'Нефтегазовая компания',
    emoji: '🛢️',
    cost: 1500000000,
    baseIncomePerHour: 75000000,
    names: makeBusinessNames(["Energy", "Petroleum", "Gas", "Drilling", "Refining", "Fuels", "Pipelines", "Resources", "Petrochem", "Oilfields"]),
  },
  {
    id: 'airline',
    name: 'Авиакомпания',
    emoji: '✈️',
    cost: 13000000000,
    baseIncomePerHour: 650000000,
    names: makeBusinessNames(["Airways", "Airlines", "Aviation", "Flights", "Air", "Skyways", "Airlift", "Wings", "Airfleet", "Airlink"]),
  },
];

export function generateBusinessName(categoryId: string): string {
  const category = businessCategories.find(c => c.id === categoryId);
  if (!category) return 'Business';
  const randomIndex = Math.floor(Math.random() * category.names.length);
  return category.names[randomIndex];
}
