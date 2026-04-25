self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('wechat-profile-app-v24').then((cache) => {
      return cache.addAll([
        './index.html',
        './favicon.ico',
        './assets/app-icon.svg',
        './styles/app.css',
        './state/store.js',
        './data/builtin-contacts.js',
        './lib/storage.js',
        './lib/android-host.js',
        './lib/contact-registry.js',
        './vendor/jszip.min.js',
        './lib/profile-loader.js',
        './lib/chat-engine.js',
        './lib/provider-client.js',
        './lib/response-normalizer.js',
        './lib/sticker-resolver.js',
        './lib/message-protocol.js',
        './lib/composer-state.js',
        './lib/render-guard.js',
        './lib/contact-preview.js',
        './lib/proactive-contacts.js',
        './lib/proactive-status.js',
        './lib/human-profile.js',
        './lib/splash-copy.js',
        './lib/reply-batcher.js',
        './lib/moments-store.js',
        './lib/moments-engine.js',
        './router.js',
        './views/chat-list.js',
        './views/contacts.js',
        './views/chat-thread.js',
        './views/contact-settings.js',
        './views/discover.js',
        './views/me.js',
        './main.js',
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
