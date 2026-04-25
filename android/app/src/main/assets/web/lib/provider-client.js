(function (globalScope) {
  'use strict';

  let nextNativeRequestId = 1;
  const pendingNativeRequests = {};
  const DEFAULT_CHAT_TIMEOUT_MS = 45000;

  function normalizeTimeoutMs(options) {
    const timeoutMs = Number(options && options.timeoutMs);
    return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_CHAT_TIMEOUT_MS;
  }

  function createTimeoutError() {
    return new Error('请求超时，请稍后重试');
  }

  function resolveChatEndpoint(baseUrl) {
    const trimmed = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!trimmed) {
      throw new Error('请先填写 Base URL');
    }

    if (/\/chat\/completions$/i.test(trimmed)) {
      return trimmed;
    }

    if (/\/v\d+$/i.test(trimmed)) {
      return trimmed + '/chat/completions';
    }

    return trimmed + '/v1/chat/completions';
  }

  function readAssistantText(json) {
    const content = json && json.choices && json.choices[0] && json.choices[0].message
      ? json.choices[0].message.content
      : '';

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map(function (item) {
          return item && (item.text || item.content) ? (item.text || item.content) : '';
        })
        .join('\n')
        .trim();
    }

    return '';
  }

  function getNativeBridge() {
    return globalScope && globalScope.AndroidBridge ? globalScope.AndroidBridge : null;
  }

  function parseNativeResponse(rawText) {
    let json;
    try {
      json = JSON.parse(String(rawText || '{}'));
    } catch (_error) {
      throw new Error('原生网络返回不是合法 JSON');
    }

    if (json && json.error) {
      throw new Error(String(json.error));
    }

    return json;
  }

  function ensureNativeCallbacks() {
    if (!globalScope) {
      return null;
    }

    if (!globalScope.ExProfileNativeCallbacks) {
      globalScope.ExProfileNativeCallbacks = {
        resolve: function (requestId, rawText) {
          const pending = pendingNativeRequests[requestId];
          if (!pending) {
            return;
          }
          delete pendingNativeRequests[requestId];
          if (pending.timeoutId) {
            globalScope.clearTimeout(pending.timeoutId);
          }

          try {
            pending.resolve(parseNativeResponse(rawText));
          } catch (error) {
            pending.reject(error);
          }
        },
        reject: function (requestId, message) {
          const pending = pendingNativeRequests[requestId];
          if (!pending) {
            return;
          }
          delete pendingNativeRequests[requestId];
          if (pending.timeoutId) {
            globalScope.clearTimeout(pending.timeoutId);
          }
          pending.reject(new Error(String(message || 'native request failed')));
        },
      };
    }

    return globalScope.ExProfileNativeCallbacks;
  }

  function sendNativeChatRequestAsync(nativeBridge, endpoint, apiKey, payload, timeoutMs) {
    ensureNativeCallbacks();
    const requestId = 'chat-' + nextNativeRequestId++;

    return new Promise(function (resolve, reject) {
      const timeoutId = globalScope.setTimeout(function () {
        delete pendingNativeRequests[requestId];
        reject(createTimeoutError());
      }, timeoutMs);
      pendingNativeRequests[requestId] = { resolve, reject, timeoutId };
      try {
        nativeBridge.sendChatRequestAsync(requestId, endpoint, apiKey, JSON.stringify(payload));
      } catch (error) {
        delete pendingNativeRequests[requestId];
        globalScope.clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  async function sendChatRequest(baseUrl, apiKey, payload, options) {
    const endpoint = resolveChatEndpoint(baseUrl);
    const timeoutMs = normalizeTimeoutMs(options);
    const nativeBridge = getNativeBridge();
    if (nativeBridge) {
      if (typeof nativeBridge.sendChatRequestAsync === 'function') {
        return sendNativeChatRequestAsync(nativeBridge, endpoint, apiKey, payload, timeoutMs);
      }

      try {
        return parseNativeResponse(nativeBridge.sendChatRequest(endpoint, apiKey, JSON.stringify(payload)));
      } catch (error) {
        if (String(error && error.message || error).indexOf('sendChatRequest') === -1) {
          throw error;
        }
      }
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let didTimeout = false;
    let timeoutId = null;
    const timeoutPromise = new Promise(function (_resolve, reject) {
      timeoutId = setTimeout(function () {
        didTimeout = true;
        if (controller) {
          controller.abort();
        }
        reject(createTimeoutError());
      }, timeoutMs);
    });

    let response;
    try {
      response = await Promise.race([
        fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + apiKey,
          },
          body: JSON.stringify(payload),
          signal: controller ? controller.signal : undefined,
        }),
        timeoutPromise,
      ]);
    } catch (error) {
      if (didTimeout || (error && error.name === 'AbortError')) {
        throw createTimeoutError();
      }
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

    if (!response.ok) {
      throw new Error('接口请求失败：' + response.status);
    }

    return response.json();
  }

  const api = { resolveChatEndpoint, readAssistantText, sendChatRequest };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileProviderClient = api;
  } else if (globalScope) {
    globalScope.ExProfileProviderClient = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
