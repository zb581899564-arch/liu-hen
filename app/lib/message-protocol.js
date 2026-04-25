(function (globalScope) {
  'use strict';

  const MAX_DELAY_SECONDS = 24 * 60 * 60;

  function stripCodeFence(text) {
    const source = String(text || '').trim();
    const match = source.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return match ? match[1].trim() : source;
  }

  function tryParseJson(text) {
    try {
      return JSON.parse(stripCodeFence(text));
    } catch (_error) {
      return null;
    }
  }

  function normalizeDelay(value) {
    const delay = Math.floor(Number(value) || 0);
    return Math.max(0, Math.min(MAX_DELAY_SECONDS, delay));
  }

  function normalizeProtocolItem(item) {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const type = String(item.type || 'text').toLowerCase();
    const normalized = { type: type };
    if (Object.prototype.hasOwnProperty.call(item, 'delaySeconds')) {
      normalized.delaySeconds = normalizeDelay(item.delaySeconds);
    }

    if (type === 'text') {
      const text = String(item.text || '').trim();
      if (!text) {
        return null;
      }
      normalized.text = text;
      return normalized;
    }

    if (type === 'sticker') {
      const md5 = String(item.md5 || item.stickerMd5 || '').trim();
      if (!md5) {
        return null;
      }
      normalized.md5 = md5;
      return normalized;
    }

    if (type === 'image') {
      const imageUrl = String(item.imageUrl || item.url || '').trim();
      if (!imageUrl) {
        return null;
      }
      normalized.imageUrl = imageUrl;
      normalized.fileName = String(item.fileName || 'image');
      return normalized;
    }

    return null;
  }

  function parseLegacyLine(line) {
    const text = String(line || '').trim();
    if (!text) {
      return null;
    }
    const marker = text.match(/^\[\[?sticker:md5=([a-zA-Z0-9_-]+)\]?\]$/) || text.match(/^\[sticker:([a-zA-Z0-9_-]+)\]$/);
    if (marker) {
      return { type: 'sticker', md5: marker[1] };
    }
    return { type: 'text', text: text };
  }

  function parseFallbackMessages(text) {
    return String(text || '')
      .split(/\n+/)
      .map(parseLegacyLine)
      .filter(Boolean);
  }

  function isUserDirectedQuestion(text) {
    const value = String(text || '').trim();
    if (!value || value.indexOf('你') < 0) {
      return false;
    }
    if (/[？?]$/.test(value)) {
      return true;
    }
    return /(吗|嘛|么|呢)$/.test(value);
  }

  function trimSelfAnsweringMessages(messages) {
    const source = Array.isArray(messages) ? messages : [];
    const next = [];
    for (const item of source) {
      if (!item) {
        continue;
      }
      next.push(item);
      if (item.type === 'text' && isUserDirectedQuestion(item.text)) {
        break;
      }
    }
    return next;
  }

  function looksLikeBrokenStructuredProtocol(text) {
    const source = String(text || '').trim();
    return (
      source.charAt(0) === '{' &&
      (
        source.indexOf('"messages"') >= 0 ||
        source.indexOf("'messages'") >= 0 ||
        source.indexOf('"type"') >= 0 ||
        source.indexOf("'type'") >= 0 ||
        source.indexOf('sticker') >= 0
      )
    );
  }

  function parseAssistantProtocol(text) {
    const parsed = tryParseJson(text);
    if (parsed && typeof parsed === 'object') {
      const messages = (Array.isArray(parsed.messages) ? parsed.messages : [])
        .map(normalizeProtocolItem)
        .filter(Boolean);
      const scheduled = (Array.isArray(parsed.scheduled) ? parsed.scheduled : [])
        .map(function (item) {
          return normalizeProtocolItem({
            ...item,
            delaySeconds: normalizeDelay(item && item.delaySeconds),
          });
        })
        .filter(function (item) {
          return item && item.delaySeconds > 0;
        });

      if (messages.length || scheduled.length) {
        return { messages: trimSelfAnsweringMessages(messages), scheduled: scheduled };
      }
    }

    if (looksLikeBrokenStructuredProtocol(text)) {
      return {
        messages: [{ type: 'text', text: String(text || '').indexOf('sticker') >= 0 ? '[表情]' : '...' }],
        scheduled: [],
      };
    }

    return {
      messages: trimSelfAnsweringMessages(parseFallbackMessages(text)),
      scheduled: [],
    };
  }

  const api = {
    trimSelfAnsweringMessages,
    parseAssistantProtocol,
    normalizeProtocolItem,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileMessageProtocol = api;
  } else if (globalScope) {
    globalScope.ExProfileMessageProtocol = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
