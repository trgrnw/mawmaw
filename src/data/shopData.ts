import { assetUrl } from '@/lib/assets';

export interface ShopCategory {
  id: string;
  name: string;
  emoji: string;
  description: string;
  image: string;
}

export interface ShopItemData {
  id: string;
  name: string;
  categoryId: string;
  basePrice: number;
  emoji: string;
  description: string;
  image: string;
  // Real estate specific
  location?: string;
  baseIncomePerHour?: number;
  // Vehicle capacity
  capacity?: number;
  capacityUnit?: string;
}

export const shopCategories: ShopCategory[] = [
  { id: 'realestate', name: 'Недвижимость', emoji: '🏠', description: 'Дома, квартиры и виллы', image: assetUrl('/images/shop/realestate.jpg') },
  { id: 'cars', name: 'Автомобили', emoji: '🚗', description: 'Спорткары и суперкары', image: assetUrl('/images/shop/cars.jpg') },
  { id: 'ships', name: 'Корабли', emoji: '🚢', description: 'Яхты и лайнеры', image: assetUrl('/images/shop/ships.jpg') },
  { id: 'planes', name: 'Самолёты', emoji: '✈️', description: 'Частные джеты', image: assetUrl('/images/shop/planes.jpg') },
  { id: 'garage', name: 'Гараж', emoji: '🅿️', description: 'Хранение автомобилей', image: assetUrl('/images/shop/garage.jpg') },
  { id: 'hangar', name: 'Ангар', emoji: '🏗️', description: 'Хранение самолётов', image: assetUrl('/images/shop/hangar.jpg') },
  { id: 'dock', name: 'Причал', emoji: '⚓', description: 'Хранение кораблей', image: assetUrl('/images/shop/dock.jpg') },
  { id: 'islands', name: 'Острова', emoji: '🏝️', description: 'Частные острова', image: assetUrl('/images/shop/islands.jpg') },
];

export const shopItemsData: ShopItemData[] = [
  // === Недвижимость ===
  { id: 're1', name: 'Квартира-студия', categoryId: 'realestate', basePrice: 50000, emoji: '🏠', description: 'Уютная студия в центре', location: 'Москва', baseIncomePerHour: 500, image: assetUrl('/images/shop/re1.jpg') },
  { id: 're2', name: 'Двухкомнатная квартира', categoryId: 'realestate', basePrice: 120000, emoji: '🏠', description: 'Просторная двушка', location: 'Санкт-Петербург', baseIncomePerHour: 1200, image: assetUrl('/images/shop/re2.jpg') },
  { id: 're3', name: 'Пентхаус', categoryId: 'realestate', basePrice: 500000, emoji: '🏢', description: 'Роскошный пентхаус', location: 'Дубай', baseIncomePerHour: 5000, image: assetUrl('/images/shop/re3.jpg') },
  { id: 're4', name: 'Вилла у моря', categoryId: 'realestate', basePrice: 2000000, emoji: '🏖️', description: 'Вилла с видом на океан', location: 'Мальдивы', baseIncomePerHour: 20000, image: assetUrl('/images/shop/re4.jpg') },
  { id: 're5', name: 'Особняк', categoryId: 'realestate', basePrice: 5000000, emoji: '🏰', description: 'Особняк с территорией', location: 'Лос-Анджелес', baseIncomePerHour: 50000, image: assetUrl('/images/shop/re5.jpg') },
  { id: 're6', name: 'Небоскрёб', categoryId: 'realestate', basePrice: 50000000, emoji: '🏙️', description: 'Целый небоскрёб', location: 'Нью-Йорк', baseIncomePerHour: 500000, image: assetUrl('/images/shop/re6.jpg') },

  // === Автомобили ===
  { id: 'car1', name: 'Toyota Camry', categoryId: 'cars', basePrice: 35000, emoji: '🚙', description: 'Надёжный седан', image: assetUrl('/images/shop/car1.jpg') },
  { id: 'car2', name: 'BMW M5', categoryId: 'cars', basePrice: 110000, emoji: '🚗', description: 'Спортивный седан', image: assetUrl('/images/shop/car2.jpg') },
  { id: 'car3', name: 'Porsche 911', categoryId: 'cars', basePrice: 250000, emoji: '🏎️', description: 'Легендарный спорткар', image: assetUrl('/images/shop/car3.jpg') },
  { id: 'car4', name: 'Lamborghini Huracán', categoryId: 'cars', basePrice: 600000, emoji: '🏎️', description: 'Итальянский суперкар', image: assetUrl('/images/shop/car4.jpg') },
  { id: 'car5', name: 'Ferrari SF90', categoryId: 'cars', basePrice: 900000, emoji: '🏎️', description: 'Гибридный гиперкар', image: assetUrl('/images/shop/car5.jpg') },
  { id: 'car6', name: 'Bugatti Chiron', categoryId: 'cars', basePrice: 3000000, emoji: '🏎️', description: 'Гиперкар класса люкс', image: assetUrl('/images/shop/car6.jpg') },
  { id: 'car7', name: 'Rolls-Royce Phantom', categoryId: 'cars', basePrice: 500000, emoji: '🚗', description: 'Королевская роскошь', image: assetUrl('/images/shop/car7.jpg') },

  // === Корабли ===
  { id: 'ship1', name: 'Моторная лодка', categoryId: 'ships', basePrice: 80000, emoji: '🚤', description: 'Быстрая моторная лодка', image: assetUrl('/images/shop/ship1.jpg') },
  { id: 'ship2', name: 'Парусная яхта', categoryId: 'ships', basePrice: 500000, emoji: '⛵', description: 'Элегантная яхта', image: assetUrl('/images/shop/ship2.jpg') },
  { id: 'ship3', name: 'Моторная яхта', categoryId: 'ships', basePrice: 3000000, emoji: '🛥️', description: 'Роскошная моторная яхта', image: assetUrl('/images/shop/ship3.jpg') },
  { id: 'ship4', name: 'Мегаяхта', categoryId: 'ships', basePrice: 25000000, emoji: '🛥️', description: 'Мегаяхта с вертолётной площадкой', image: assetUrl('/images/shop/ship4.jpg') },
  { id: 'ship5', name: 'Круизный лайнер', categoryId: 'ships', basePrice: 500000000, emoji: '🚢', description: 'Полноразмерный круизный лайнер', image: assetUrl('/images/shop/ship5.jpg') },

  // === Самолёты ===
  { id: 'plane1', name: 'Cessna 172', categoryId: 'planes', basePrice: 400000, emoji: '🛩️', description: 'Лёгкий самолёт', image: assetUrl('/images/shop/plane1.jpg') },
  { id: 'plane2', name: 'Learjet 75', categoryId: 'planes', basePrice: 15000000, emoji: '✈️', description: 'Бизнес-джет', image: assetUrl('/images/shop/plane2.jpg') },
  { id: 'plane3', name: 'Gulfstream G700', categoryId: 'planes', basePrice: 75000000, emoji: '✈️', description: 'Люксовый джет', image: assetUrl('/images/shop/plane3.jpg') },
  { id: 'plane4', name: 'Boeing 787', categoryId: 'planes', basePrice: 300000000, emoji: '✈️', description: 'Частный лайнер', image: assetUrl('/images/shop/plane4.jpg') },

  // === Гараж (use category image) ===
  { id: 'gar1', name: 'Гараж на 2 места', categoryId: 'garage', basePrice: 50000, emoji: '🅿️', description: 'Компактный гараж', capacity: 2, capacityUnit: 'авто', image: assetUrl('/images/shop/garage.jpg') },
  { id: 'gar2', name: 'Гараж на 5 мест', categoryId: 'garage', basePrice: 150000, emoji: '🅿️', description: 'Средний гараж', capacity: 5, capacityUnit: 'авто', image: assetUrl('/images/shop/garage.jpg') },
  { id: 'gar3', name: 'Гараж на 10 мест', categoryId: 'garage', basePrice: 400000, emoji: '🅿️', description: 'Большой гараж', capacity: 10, capacityUnit: 'авто', image: assetUrl('/images/shop/garage.jpg') },
  { id: 'gar4', name: 'Подземный гараж на 20 мест', categoryId: 'garage', basePrice: 1000000, emoji: '🅿️', description: 'Подземная парковка', capacity: 20, capacityUnit: 'авто', image: assetUrl('/images/shop/garage.jpg') },

  // === Ангар (use category image) ===
  { id: 'han1', name: 'Малый ангар', categoryId: 'hangar', basePrice: 2000000, emoji: '🏗️', description: 'Для лёгких самолётов', capacity: 1, capacityUnit: 'самолёт', image: assetUrl('/images/shop/hangar.jpg') },
  { id: 'han2', name: 'Средний ангар', categoryId: 'hangar', basePrice: 8000000, emoji: '🏗️', description: 'Для бизнес-джетов', capacity: 3, capacityUnit: 'самолёта', image: assetUrl('/images/shop/hangar.jpg') },
  { id: 'han3', name: 'Большой ангар', categoryId: 'hangar', basePrice: 25000000, emoji: '🏗️', description: 'Для крупных самолётов', capacity: 5, capacityUnit: 'самолётов', image: assetUrl('/images/shop/hangar.jpg') },

  // === Причал (use category image) ===
  { id: 'dock1', name: 'Малый причал', categoryId: 'dock', basePrice: 300000, emoji: '⚓', description: 'Для лодок и яхт', capacity: 2, capacityUnit: 'судна', image: assetUrl('/images/shop/dock.jpg') },
  { id: 'dock2', name: 'Средний причал', categoryId: 'dock', basePrice: 1500000, emoji: '⚓', description: 'Причал для яхт', capacity: 5, capacityUnit: 'судов', image: assetUrl('/images/shop/dock.jpg') },
  { id: 'dock3', name: 'Марина', categoryId: 'dock', basePrice: 10000000, emoji: '⚓', description: 'Полноценная марина', capacity: 15, capacityUnit: 'судов', image: assetUrl('/images/shop/dock.jpg') },

  // === Острова ===
  { id: 'isl1', name: 'Маленький остров', categoryId: 'islands', basePrice: 10000000, emoji: '🏝️', description: 'Уединённый тропический остров', image: assetUrl('/images/shop/isl1.jpg') },
  { id: 'isl2', name: 'Средний остров', categoryId: 'islands', basePrice: 50000000, emoji: '🏝️', description: 'Остров с инфраструктурой', image: assetUrl('/images/shop/isl2.jpg') },
  { id: 'isl3', name: 'Архипелаг', categoryId: 'islands', basePrice: 500000000, emoji: '🏝️', description: 'Группа частных островов', image: assetUrl('/images/shop/isl3.jpg') },
];

// Car configuration options
export const carEngineOptions = [
  { id: 'df', name: 'DF (Стандарт)', priceMultiplier: 0 },
  { id: 'bst', name: 'BST', priceMultiplier: 0.15 },
  { id: 's', name: 'S', priceMultiplier: 0.35 },
];

export const carTrimOptions = [
  { id: 'standard', name: 'Стандарт', priceMultiplier: 0 },
  { id: 'premium', name: 'Премиум', priceMultiplier: 0.40 },
];

// Ship/Plane crew option
export const crewOption = { name: 'Нанять команду', priceMultiplier: 0.25 };
export const finishOptions = [
  { id: 'standard', name: 'Стандарт', priceMultiplier: 0 },
  { id: 'premium', name: 'Премиум', priceMultiplier: 0.30 },
];

export const accessoryCategories: ShopCategory[] = [
  { id: 'nft', name: 'NFT', emoji: '🖼️', description: 'Цифровые коллекции', image: assetUrl('/images/acc/nft.jpg') },
  { id: 'watches', name: 'Часы', emoji: '⌚', description: 'Роскошные часы', image: assetUrl('/images/acc/watches.jpg') },
  { id: 'jewelry', name: 'Драгоценности', emoji: '💎', description: 'Ювелирные изделия', image: assetUrl('/images/acc/jewelry.jpg') },
  { id: 'art', name: 'Живопись', emoji: '🎨', description: 'Мировые шедевры', image: assetUrl('/images/acc/art.jpg') },
  { id: 'electronics', name: 'Электроника', emoji: '🥽', description: 'Премиум техника', image: assetUrl('/images/acc/electronics.jpg') },
  { id: 'classics', name: 'Классические авто', emoji: '🏁', description: 'Раритетные автомобили', image: assetUrl('/images/acc/classics.jpg') },
  { id: 'artifacts', name: 'Артефакты', emoji: '👑', description: 'Исторические ценности', image: assetUrl('/images/acc/artifacts.jpg') },
];

export const accessoryItemsData: ShopItemData[] = [
  { id: 'a1', name: 'CryptoPunk #7804', categoryId: 'nft', basePrice: 500000, emoji: '🖼️', description: 'Легендарный NFT', image: assetUrl('/images/acc/a1.jpg') },
  { id: 'a2', name: 'Bored Ape #8817', categoryId: 'nft', basePrice: 300000, emoji: '🐵', description: 'Из коллекции BAYC', image: assetUrl('/images/acc/a2.jpg') },
  { id: 'a3', name: 'Mutant Ape', categoryId: 'nft', basePrice: 150000, emoji: '🧟', description: 'Мутант из MAYC', image: assetUrl('/images/acc/a3.jpg') },
  { id: 'a4', name: 'Patek Philippe Nautilus', categoryId: 'watches', basePrice: 2000000, emoji: '⌚', description: 'Культовые часы', image: assetUrl('/images/acc/a4.jpg') },
  { id: 'a5', name: 'Rolex Daytona', categoryId: 'watches', basePrice: 500000, emoji: '⌚', description: 'Легендарный хронограф', image: assetUrl('/images/acc/a5.jpg') },
  { id: 'a6', name: 'Richard Mille RM 11', categoryId: 'watches', basePrice: 5000000, emoji: '⌚', description: 'Часы для избранных', image: assetUrl('/images/acc/a6.jpg') },
  { id: 'a7', name: 'Бриллиант "Надежда"', categoryId: 'jewelry', basePrice: 25000000, emoji: '💎', description: 'Легендарный камень', image: assetUrl('/images/acc/a7.jpg') },
  { id: 'a8', name: 'Колье Cartier', categoryId: 'jewelry', basePrice: 3000000, emoji: '💍', description: 'Высокое ювелирное искусство', image: assetUrl('/images/acc/a8.jpg') },
  { id: 'a9', name: 'Мона Лиза', categoryId: 'art', basePrice: 80000000, emoji: '🎨', description: 'Шедевр Леонардо', image: assetUrl('/images/acc/a9.jpg') },
  { id: 'a10', name: 'Звёздная ночь', categoryId: 'art', basePrice: 40000000, emoji: '🌌', description: 'Ван Гог', image: assetUrl('/images/acc/a10.jpg') },
  { id: 'a11', name: 'Apple Vision Ultra', categoryId: 'electronics', basePrice: 50000, emoji: '🥽', description: 'Будущее технологий', image: assetUrl('/images/acc/a11.jpg') },
  { id: 'a12', name: 'MacBook Diamond', categoryId: 'electronics', basePrice: 200000, emoji: '💻', description: 'Ноутбук с бриллиантами', image: assetUrl('/images/acc/a12.jpg') },
  { id: 'a13', name: 'Ferrari 250 GTO', categoryId: 'classics', basePrice: 50000000, emoji: '🏁', description: 'Самый дорогой автомобиль', image: assetUrl('/images/acc/a13.jpg') },
  { id: 'a14', name: 'Корона фараона', categoryId: 'artifacts', basePrice: 10000000, emoji: '👑', description: 'Древнеегипетская реликвия', image: assetUrl('/images/acc/a14.jpg') },
];
