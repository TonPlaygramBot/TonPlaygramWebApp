import assert from 'node:assert/strict';
import test from 'node:test';
import { sendPushNotifications } from '../services/pushNotificationService.js';

test('sends game invite notifications to registered FCM devices', async () => {
  const previousKey = process.env.FCM_SERVER_KEY;
  const previousFetch = global.fetch;
  process.env.FCM_SERVER_KEY = 'test-key';
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true };
  };

  try {
    const sent = await sendPushNotifications(
      [{ token: 'device-token', platform: 'android' }],
      { title: 'New game invite', body: 'Alice invited you' },
      { type: 'gameInvite', roomId: 'snake-2' }
    );
    assert.equal(sent, 1);
    assert.equal(request.url, 'https://fcm.googleapis.com/fcm/send');
    assert.equal(request.options.headers.authorization, 'key=test-key');
    assert.deepEqual(JSON.parse(request.options.body).data, {
      type: 'gameInvite',
      roomId: 'snake-2'
    });
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.FCM_SERVER_KEY;
    else process.env.FCM_SERVER_KEY = previousKey;
  }
});

test('skips unconfigured providers without failing an invite', async () => {
  const previousKey = process.env.FCM_SERVER_KEY;
  delete process.env.FCM_SERVER_KEY;
  try {
    assert.equal(await sendPushNotifications([{ token: 'token', platform: 'web' }], { title: 'Invite' }), 0);
  } finally {
    if (previousKey !== undefined) process.env.FCM_SERVER_KEY = previousKey;
  }
});
