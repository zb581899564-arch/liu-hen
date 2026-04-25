(function (globalScope) {
  'use strict';

  function resolveRoute(hash) {
    const value = String(hash || '#/wechat');
    const settingsMatch = value.match(/^#\/contact-settings\/([^/]+)$/);
    if (settingsMatch) {
      return { tab: 'wechat', view: 'contact-settings', slug: decodeURIComponent(settingsMatch[1]) };
    }

    const match = value.match(/^#\/chat\/([^/]+)$/);
    if (match) {
      return { tab: 'wechat', view: 'chat-thread', slug: decodeURIComponent(match[1]) };
    }
    if (value === '#/contacts') {
      return { tab: 'contacts', view: 'contacts', slug: null };
    }
    if (value === '#/discover') {
      return { tab: 'discover', view: 'discover', slug: null };
    }
    if (value === '#/me') {
      return { tab: 'me', view: 'me', slug: null };
    }
    return { tab: 'wechat', view: 'chat-list', slug: null };
  }

  function shouldShowMainNav(route) {
    return !(route && (route.view === 'chat-thread' || route.view === 'contact-settings'));
  }

  const api = { resolveRoute, shouldShowMainNav };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileAppRouter = api;
  } else if (globalScope) {
    globalScope.ExProfileAppRouter = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
