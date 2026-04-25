(function (globalScope) {
  'use strict';

  const PROVIDER_PRESETS = {
    deepseek: {
      baseUrl: 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat',
    },
    minimax: {
      baseUrl: 'https://api.minimaxi.com/v1',
      defaultModel: 'MiniMax-M2.7-highspeed',
    },
  };

  const api = { PROVIDER_PRESETS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileProviderPresets = api;
  } else if (globalScope) {
    globalScope.ExProfileProviderPresets = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
