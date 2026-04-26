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

  function getThreadScrollTarget(options) {
    const source = options || {};
    const scrollState = source.scrollState || {};
    const scrollHeight = Math.max(0, Number(source.scrollHeight) || 0);
    const clientHeight = Math.max(0, Number(source.clientHeight) || 0);
    const currentScrollTop = Math.max(0, Number(source.currentScrollTop) || 0);
    const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
    const shouldStick = Boolean(source.forceThreadBottom || !source.scrollState || scrollState.shouldStick);
    const targetScrollTop = shouldStick
      ? maxScrollTop
      : Math.min(Math.max(0, Number(scrollState.scrollTop) || 0), maxScrollTop);
    return {
      shouldUpdate: Math.abs(currentScrollTop - targetScrollTop) > 2,
      scrollTop: targetScrollTop,
    };
  }

  const api = { getThreadScrollTarget, shouldDeferRenderForComposer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileRenderGuard = api;
  } else if (globalScope) {
    globalScope.ExProfileRenderGuard = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
