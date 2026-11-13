import express from 'express';
import storeRoutes from '../bot/routes/store.js';
import User from '../bot/models/User.js';
import { createAuthSession } from '../bot/utils/authSession.js';

jest.mock('../bot/models/User.js');
jest.mock('../webapp/src/config/poolRoyaleInventoryConfig.js', () => ({ POOL_ROYALE_DEFAULT_UNLOCKS: {} }));
jest.mock('../webapp/src/config/snookerRoyalInventoryConfig.js', () => ({ SNOOKER_ROYALE_DEFAULT_UNLOCKS: {} }));
jest.mock('../webapp/src/config/airHockeyInventoryConfig.js', () => ({ AIR_HOCKEY_DEFAULT_UNLOCKS: {} }));

// Client prices cannot authorize an entitlement or debit. Keep this historical
// regression on the closed contract until authoritative settlement replaces it.
test('legacy storefront rejects forged prices even for an authenticated customer', async () => {
  const oldSecret = process.env.AUTH_SESSION_SECRET;
  process.env.AUTH_SESSION_SECRET = 'storefront-regression-secret-longer-than-32-characters';
  const app = express();
  app.use(express.json());
  app.use('/api/store', storeRoutes);
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  try {
    for (const route of ['purchase', 'purchase-v2']) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/store/${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${createAuthSession({ accountId: 'customer' })}` },
        body: JSON.stringify({ fromAccount: 'customer', bundle: { items: [{ optionId: 'premium', price: 0 }] } })
      });
      expect(response.status).toBe(403);
      expect(User.findOne).not.toHaveBeenCalled();
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (oldSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
    else process.env.AUTH_SESSION_SECRET = oldSecret;
  }
});
