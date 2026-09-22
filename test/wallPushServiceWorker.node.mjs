import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(
  new URL('../webapp/public/pwa/wall-push.js', import.meta.url),
  'utf8'
);
function worker(clients = {}, scope = 'https://wall.example/') {
  const listeners = {},
    notifications = [];
  vm.runInNewContext(source, {
    URL,
    self: {
      location: { origin: 'https://wall.example' },
      addEventListener: (name, handler) => (listeners[name] = handler),
      registration: {
        scope,
        showNotification: async (...args) => notifications.push(args)
      },
      clients
    }
  });
  return { listeners, notifications };
}
test('push displays while the page is closed and rejects outside navigation payloads', async () => {
  const { listeners, notifications } = worker();
  let task;
  listeners.push({
    data: {
      json: () => ({
        title: 'New post',
        body: 'Alice shared a video',
        url: 'https://evil.example'
      })
    },
    waitUntil: (promise) => (task = promise)
  });
  await task;
  assert.equal(notifications[0][0], 'New post');
  assert.equal(notifications[0][1].data.url, '/wall');
});
test('Social notifications open Social without replacing an open main app', async () => {
  let opened, task;
  const { listeners } = worker({
    matchAll: async () => [{ url: 'https://wall.example/wallet', navigate: async () => assert.fail('Main app must stay open') }],
    openWindow: async url => { opened = url; }
  }, 'https://wall.example/social-app/');
  listeners.notificationclick({ notification: { data: { url: '/wall#post-000000000000000000000001' }, close() {} }, waitUntil(promise) { task = promise; } });
  await task;
  assert.equal(opened, 'https://wall.example/social-app/wall#post-000000000000000000000001');
});
test('a notification click navigates and focuses an existing app window', async () => {
  const id = '000000000000000000000001';
  let target,
    focused = false,
    closed = false,
    task;
  const { listeners } = worker({
    matchAll: async () => [
      {
        url: 'https://wall.example/',
        navigate: async (url) => {
          target = url;
          return { focus: async () => (focused = true) };
        }
      }
    ]
  });
  listeners.notificationclick({
    notification: {
      data: { url: `/wall#post-${id}` },
      close: () => (closed = true)
    },
    waitUntil: (promise) => (task = promise)
  });
  await task;
  assert.equal(target, `https://wall.example/wall#post-${id}`);
  assert.equal(focused, true);
  assert.equal(closed, true);
});
