import { TENNIS_HDRI_OPTIONS, TENNIS_STORE_ITEMS } from '../webapp/src/config/tennisInventoryConfig.js';

const REQUIRED = ['suburbanGarden','countryTrackMidday','autumnPark','rooitouPark','rotesRathaus','veniceDawn2','piazzaSanMarco'];

describe('tennis hdri catalog', () => {
  test('contains requested ids in options and store', () => {
    const optionIds = new Set(TENNIS_HDRI_OPTIONS.map((i) => i.id));
    const storeIds = new Set(TENNIS_STORE_ITEMS.map((i) => i.optionId));
    REQUIRED.forEach((id) => {
      expect(optionIds.has(id)).toBe(true);
      expect(storeIds.has(id)).toBe(true);
    });
  });
});
