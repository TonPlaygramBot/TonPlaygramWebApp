import { applyStoreItemDelivery } from '../bot/routes/store.js';

describe('applyStoreItemDelivery', () => {
  test('delivers Pool, Snooker, and Air Hockey unlocks and tracks unsupported items', () => {
    const user = {
      poolRoyalInventory: { tableFinish: ['classic_green'] },
      snookerRoyalInventory: { cueStyle: ['stock'] },
      airHockeyInventory: { field: ['bust-marble'] }
    };

    const result = applyStoreItemDelivery(user, [
      { slug: 'poolroyale', type: 'tableFinish', optionId: 'neo_carbon' },
      { slug: 'snookerroyale', type: 'cueStyle', optionId: 'pro_black' },
      { slug: 'airhockey', type: 'table', optionId: 'ice_blue' }
    ]);

    expect(result.pool).toHaveLength(1);
    expect(result.snooker).toHaveLength(1);
    expect(result.airHockey).toHaveLength(1);
    expect(result.unsupported).toHaveLength(0);
    expect(user.poolRoyalInventory.tableFinish).toEqual(
      expect.arrayContaining(['classic_green', 'neo_carbon'])
    );
    expect(user.snookerRoyalInventory.cueStyle).toEqual(
      expect.arrayContaining(['stock', 'pro_black'])
    );
    expect(user.airHockeyInventory.table).toContain('ice_blue');
  });

  test('does not duplicate already owned items', () => {
    const user = {
      poolRoyalInventory: { tableFinish: ['neo_carbon'] },
      snookerRoyalInventory: { cueStyle: [] }
    };

    const result = applyStoreItemDelivery(user, [
      { slug: 'poolroyale', type: 'tableFinish', optionId: 'neo_carbon' }
    ]);

    expect(result.pool).toHaveLength(0);
    expect(user.poolRoyalInventory.tableFinish).toContain('neo_carbon');
    expect(user.poolRoyalInventory.tableFinish.filter((entry) => entry === 'neo_carbon')).toHaveLength(1);
  });
});
