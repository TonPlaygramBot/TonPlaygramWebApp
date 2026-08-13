import test from 'node:test';
import assert from 'node:assert/strict';
import { hasSocialDeveloperAccess } from '../routes/socialAdmin.js';

test('allows every configured developer account environment name', () => {
  const env = {
    DEV_ACCOUNT_ID: 'primary',
    DEV_ACCOUNT_ID_1: 'secondary',
    VITE_DEV_ACCOUNT_ID_2: 'legacy-client-config'
  };

  assert.equal(hasSocialDeveloperAccess({ accountId: 'primary' }, env), true);
  assert.equal(hasSocialDeveloperAccess({ accountId: 'secondary' }, env), true);
  assert.equal(hasSocialDeveloperAccess({ accountId: 'legacy-client-config' }, env), true);
});

test('allows the Telegram owner and API token but rejects other users', () => {
  const env = { OWNER_TELEGRAM_ID: '12345', DEV_ACCOUNT_ID: 'developer' };

  assert.equal(hasSocialDeveloperAccess({ telegramId: 12345 }, env), true);
  assert.equal(hasSocialDeveloperAccess({ apiToken: true }, env), true);
  assert.equal(hasSocialDeveloperAccess({ accountId: 'someone-else' }, env), false);
});
