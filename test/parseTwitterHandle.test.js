import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTwitterHandle } from '../bot/routes/profile.js';

test('parses usernames from URLs', () => {
  assert.equal(parseTwitterHandle('https://twitter.com/user'), 'user');
  assert.equal(parseTwitterHandle('twitter.com/user'), 'user');
  assert.equal(parseTwitterHandle('https://x.com/user'), 'user');
  assert.equal(parseTwitterHandle('x.com/user'), 'user');
  assert.equal(parseTwitterHandle('@user'), 'user');
});
