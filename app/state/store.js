(function (globalScope) {
  'use strict';

  function createInitialState() {
    return {
      activeTab: 'wechat',
      activeThreadSlug: null,
      contacts: [],
      chats: {},
      settings: {},
    };
  }

  const api = { createInitialState };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileAppStore = api;
  } else if (globalScope) {
    globalScope.ExProfileAppStore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
