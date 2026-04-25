(function (globalScope) {
  'use strict';

  function isComposerInput(element) {
    return Boolean(
      element &&
      typeof element.matches === 'function' &&
      element.matches('[data-role="composer-input"]')
    );
  }

  function shouldDeferRenderForComposer(documentRef, route, options) {
    const opts = options || {};
    return Boolean(
      opts.deferIfComposerFocused &&
      route &&
      route.view === 'chat-thread' &&
      isComposerInput(documentRef && documentRef.activeElement)
    );
  }

  const api = { shouldDeferRenderForComposer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileRenderGuard = api;
  } else if (globalScope) {
    globalScope.ExProfileRenderGuard = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
