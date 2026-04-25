(function (globalScope) {
  'use strict';

  const SETTINGS_KEY = 'exProfileSettings';

  function parseJson(text, fallback) {
    try {
      return JSON.parse(text);
    } catch (_error) {
      return fallback;
    }
  }

  function normalizeSettings(settings) {
    const source = settings || {};
    return {
      baseUrl: String(source.baseUrl || ''),
      apiKey: String(source.apiKey || ''),
      model: String(source.model || ''),
    };
  }

  function loadLocalSettings() {
    if (typeof localStorage === 'undefined') {
      return normalizeSettings({});
    }
    try {
      return normalizeSettings(parseJson(localStorage.getItem(SETTINGS_KEY) || '{}', {}));
    } catch (_error) {
      return normalizeSettings({});
    }
  }

  function saveLocalSettings(settings) {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
    } catch (_error) {
      // Android WebView file origins may deny localStorage. Keep the bridge path alive.
    }
  }

  function mergeSettings(primary, fallback) {
    const preferred = normalizeSettings(primary);
    const backup = normalizeSettings(fallback);
    return {
      baseUrl: preferred.baseUrl || backup.baseUrl,
      apiKey: preferred.apiKey || backup.apiKey,
      model: preferred.model || backup.model,
    };
  }

  function createAndroidHostAdapter(androidBridge) {
    const bridge = androidBridge || null;

    return {
      isAndroid() {
        return Boolean(bridge);
      },
      async loadSettings() {
        const localSettings = loadLocalSettings();
        if (!bridge || typeof bridge.loadSettings !== 'function') {
          return localSettings;
        }
        try {
          return mergeSettings(parseJson(bridge.loadSettings(), {}), localSettings);
        } catch (_error) {
          return localSettings;
        }
      },
      async saveSettings(settings) {
        const normalized = normalizeSettings(settings);
        saveLocalSettings(normalized);
        if (bridge && typeof bridge.saveSettings === 'function') {
          bridge.saveSettings(JSON.stringify(normalized));
        }
        return normalized;
      },
      async listBuiltinProfiles() {
        if (!bridge || typeof bridge.listBuiltinProfiles !== 'function') {
          return [];
        }
        return parseJson(bridge.listBuiltinProfiles(), []);
      },
      async listImportedProfiles() {
        if (!bridge || typeof bridge.listImportedProfiles !== 'function') {
          return [];
        }
        return parseJson(bridge.listImportedProfiles(), []);
      },
      async importProfileFromPicker() {
        if (bridge && typeof bridge.importProfileFromPicker === 'function') {
          bridge.importProfileFromPicker();
        }
      },
    };
  }

  const api = { SETTINGS_KEY, createAndroidHostAdapter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  globalScope.ExProfileAndroidHost = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
