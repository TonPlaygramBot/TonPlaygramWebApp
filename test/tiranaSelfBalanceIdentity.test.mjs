import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifiedSelfBalanceFilter} from '../bot/utils/selfBalanceIdentity.js';
test('selects the one verified external identity rather than accepting UI account identifiers',()=>{
 assert.deepEqual(verifiedSelfBalanceFilter({telegramId:141,googleId:'stale-other-session',accountId:'arbitrary'}),{telegramId:141});
 assert.deepEqual(verifiedSelfBalanceFilter({googleId:'verified-google'}),{googleId:'verified-google'});
 assert.equal(verifiedSelfBalanceFilter({accountId:'known-or-stale'}),null);
 assert.equal(verifiedSelfBalanceFilter({telegramId:'141',googleId:''}),null);
});
