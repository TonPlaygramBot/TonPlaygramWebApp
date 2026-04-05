import {
  POOL_ROYALE_HDRI_VARIANTS,
  POOL_ROYALE_STORE_ITEMS
} from '../webapp/src/config/poolRoyaleInventoryConfig.js';

const REQUIRED_CHECKERS_HDRI_IDS = [
  'churchMeetingRoom',
  'polyHavenStudio',
  'cinemaLobby',
  'warmBar',
  'pineAttic',
  'rostockArches',
  'vignaioliNight',
  'stPetersSquareNight',
  'zwingerNight',
  'winterEvening',
  'rathaus',
  'newmanLobby',
  'lapa',
  'medievalCafe',
  'crossfitGym',
  'voortrekkerInterior'
];

describe('Checkers Battle Royal shared HDRI catalog', () => {
  test('contains all requested HDRI variants in shared inventory options', () => {
    const ids = new Set(POOL_ROYALE_HDRI_VARIANTS.map((option) => option.id));
    REQUIRED_CHECKERS_HDRI_IDS.forEach((id) => {
      expect(ids.has(id)).toBe(true);
    });
  });

  test('contains all requested HDRI variants in store purchasables', () => {
    const storeHdriIds = new Set(
      POOL_ROYALE_STORE_ITEMS.filter((item) => item.type === 'environmentHdri').map(
        (item) => item.optionId
      )
    );
    REQUIRED_CHECKERS_HDRI_IDS.forEach((id) => {
      expect(storeHdriIds.has(id)).toBe(true);
    });
  });
});
