import type { GameContextType } from './types';
import { formatMoney } from './format';

type Dispatch = (type: string, args?: Record<string, unknown>) => boolean;
/** The same action vocabulary is used by local play and the verified server. */
export function bindGameActions(dispatch: Dispatch, syncProgress: () => Promise<void>): Omit<GameContextType, keyof import('./types').GameState> {
  return {
    click: () => { dispatch('click', { count: 1 }); },
    buyUpgrade: id => dispatch('upgrade', { id }),
    buyShopItem: (id, price) => dispatch('buy-shop', { id, price }),
    sellShopItem: id => dispatch('sell-shop', { id }),
    buyAccessory: id => dispatch('buy-accessory', { id }),
    sellAccessory: id => dispatch('sell-accessory', { id }),
    openBusiness: async (categoryId, name) => {
      const accepted = dispatch('open-business', { categoryId, name });
      if (accepted) await syncProgress();
      return accepted;
    },
    obtainEntrepreneurLicense: country => dispatch('license', { country }),
    completeBusinessSetupStep: (id, stepId) => dispatch('setup-business', { id, stepId }),
    hireBusinessTeam: id => dispatch('hire-business', { id }),
    mergeBusiness: id => dispatch('merge-business', { id }),
    deleteBusiness: id => dispatch('sell-business', { id }),
    payTaxes: () => false,
    buyStock: (id, quantity) => dispatch('buy-stock', { id, quantity }),
    sellStock: (id, quantity) => dispatch('sell-stock', { id, quantity }),
    buyCrypto: (id, quantity) => dispatch('buy-crypto', { id, quantity }),
    sellCrypto: (id, quantity) => dispatch('sell-crypto', { id, quantity }),
    buyRealEstateUpgrade: (id, upgradeId) => dispatch('realestate-upgrade', { id, upgradeId }),
    addLicensePlate: plate => dispatch('buy-plate', { text: plate.text, country: plate.country, isCustom: plate.isCustom }),
    assignPlate: (id, carId) => { dispatch('assign-plate', { id, carId }); },
    removePlate: id => { dispatch('delete-plate', { id }); },
    buyBankCard: id => dispatch('buy-card', { id }),
    selectBankCard: id => dispatch('select-card', { id }),
    customizeBankCard: details => dispatch('customize-card', details),
    syncProgress,
    formatMoney,
  };
}
