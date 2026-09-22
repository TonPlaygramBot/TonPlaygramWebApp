/* Loaded by the existing app service worker; notifications also work while the
 * page is closed. Never trust a push payload to navigate outside this origin. */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { /* Still show a useful alert. */ }
  const path = /^\/wall(?:#post-[a-f\d]{24})?$/i.test(data.url || '') ? data.url : '/wall';
  event.waitUntil(self.registration.showNotification(String(data.title || 'TonPlayGram · Social wall').slice(0, 100), {
    body: String(data.body || 'A new post is waiting on the social wall.').slice(0, 240),
    icon: '/assets/icons/profile.svg',
    tag: String(data.tag || 'tonplaygram-wall').slice(0, 80),
    data: { url: path }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const path = event.notification.data?.url;
  const target = new URL(/^\/wall(?:#post-[a-f\d]{24})?$/i.test(path || '') ? path : '/wall', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      const navigated = await existing.navigate(target);
      if (navigated) return navigated.focus();
    }
    return self.clients.openWindow(target);
  })());
});
