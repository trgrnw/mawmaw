import { accessoryItemsData, shopItemsData } from '@/data/shopData';
import type { ShopItem } from './types';

export const defaultShopItems: ShopItem[] = shopItemsData.map(item => ({
  id: item.id,
  name: item.name,
  category: item.categoryId,
  price: item.basePrice,
  emoji: item.emoji,
  purchased: false,
}));

export const defaultAccessories: ShopItem[] = accessoryItemsData.map(item => ({
  id: item.id,
  name: item.name,
  category: item.categoryId,
  price: item.basePrice,
  emoji: item.emoji,
  purchased: false,
}));
