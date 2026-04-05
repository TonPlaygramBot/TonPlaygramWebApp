import {
  TEXAS_HDRI_OPTIONS,
  TEXAS_HOLDEM_STORE_ITEMS
} from '../webapp/src/config/texasHoldemInventoryConfig.js';

const REQUIRED_TEXAS_HDRI_IDS = [
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

describe("Texas Hold'em HDRI inventory", () => {
  test('contains all requested HDRI variants for inventory selection', () => {
    const ids = new Set(TEXAS_HDRI_OPTIONS.map((option) => option.id));
    REQUIRED_TEXAS_HDRI_IDS.forEach((id) => {
      expect(ids.has(id)).toBe(true);
    });
  });

  test('contains all requested HDRI variants in store purchasables', () => {
    const storeHdriIds = new Set(
      TEXAS_HOLDEM_STORE_ITEMS.filter((item) => item.type === 'environmentHdri').map(
        (item) => item.optionId
      )
    );
    REQUIRED_TEXAS_HDRI_IDS.forEach((id) => {
      expect(storeHdriIds.has(id)).toBe(true);
    });
  });
});
