import { describe, expect, test } from '@jest/globals';
import fs from 'fs';

const scriptPath = new URL('../webapp/public/domino-royal-game.js', import.meta.url);

describe('Domino Royal runtime script', () => {
  test('declares accountId before onlineAccountId so online mode can bootstrap', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');
    const accountIndex = source.indexOf("const accountId = (urlParams.get('accountId') || '').trim();");
    const onlineIndex = source.indexOf('const onlineAccountId = accountId;');

    expect(accountIndex).toBeGreaterThanOrEqual(0);
    expect(onlineIndex).toBeGreaterThan(accountIndex);
  });
});
