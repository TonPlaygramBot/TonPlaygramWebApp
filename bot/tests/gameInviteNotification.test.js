import assert from 'node:assert/strict';
import test from 'node:test';
import { getInviteReplyMarkup, getInviteUrl } from '../utils/notifications.js';

test('opens accepted Telegram invites as a Mini App', () => {
  const url = getInviteUrl('pool-room-2', 'TPC', 25, 'pool-royale');
  const markup = getInviteReplyMarkup(url, 'short-action-token');
  const parsedUrl = new URL(url);

  assert.equal(parsedUrl.origin, 'https://tonplaygram-bot.onrender.com');
  // Telegram must load the Mini App root first. Some production hosts return
  // a plain 404 for a direct request to a nested client-side route.
  assert.equal(parsedUrl.pathname, '/');
  assert.equal(parsedUrl.searchParams.get('game'), 'pool-royale');
  assert.equal(parsedUrl.searchParams.get('table'), 'pool-room-2');
  assert.equal(parsedUrl.searchParams.get('tableId'), 'pool-room-2');
  assert.equal(parsedUrl.searchParams.get('mode'), 'online');
  assert.equal(parsedUrl.searchParams.get('capacity'), '2');

  assert.deepEqual(markup.inline_keyboard[0][0], {
    text: '✅ Accept',
    web_app: { url },
  });
  assert.equal(markup.inline_keyboard[0][0].url, undefined);
  assert.equal(
    markup.inline_keyboard[0][1].callback_data,
    'reject_invite:short-action-token',
  );
});
