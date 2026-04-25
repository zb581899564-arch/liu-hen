(function (globalScope) {
  'use strict';

  function isComposerInput(element) {
    return Boolean(
      element &&
      typeof element.matches === 'function' &&
      element.matches('[data-role="composer-input"]')
    );
  }

  function captureComposerState(documentRef, route) {
    const activeElement = documentRef && documentRef.activeElement;
    if (!route || route.view !== 'chat-thread' || !isComposerInput(activeElement)) {
      return { focused: false };
    }

    return {
      focused: true,
      slug: route.slug,
      value: String(activeElement.value || ''),
      selectionStart: typeof activeElement.selectionStart === 'number' ? activeElement.selectionStart : null,
      selectionEnd: typeof activeElement.selectionEnd === 'number' ? activeElement.selectionEnd : null,
    };
  }

  function restoreComposerState(documentRef, route, state) {
    if (!state || !state.focused || !route || route.view !== 'chat-thread' || route.slug !== state.slug) {
      return;
    }

    const input = documentRef && documentRef.querySelector
      ? documentRef.querySelector('[data-role="composer-input"]')
      : null;
    if (!input) {
      return;
    }

    input.value = state.value;
    if (typeof input.focus === 'function') {
      input.focus();
    }
    if (
      typeof input.setSelectionRange === 'function' &&
      typeof state.selectionStart === 'number' &&
      typeof state.selectionEnd === 'number'
    ) {
      input.setSelectionRange(state.selectionStart, state.selectionEnd);
    }
  }

  const api = { captureComposerState, restoreComposerState };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileComposerState = api;
  } else if (globalScope) {
    globalScope.ExProfileComposerState = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
