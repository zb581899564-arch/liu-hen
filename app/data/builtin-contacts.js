(function (globalScope) {
  'use strict';

  const BUILTIN_CONTACTS = [];

  const api = { BUILTIN_CONTACTS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileBuiltinContacts = api;
  } else if (globalScope) {
    globalScope.ExProfileBuiltinContacts = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
