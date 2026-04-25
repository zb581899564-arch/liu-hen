(function (globalScope) {
  'use strict';

  const STICKER_MARKER_PATTERN = /\[{1,2}sticker:(?:md5=)?([a-zA-Z0-9]+)\]{1,2}/i;
  const TRAILING_STICKER_MARKER_PATTERN = /\s*\[{1,2}sticker:(?:md5=)?[a-zA-Z0-9]+\]{1,2}\s*$/i;

  function extractStickerMarker(text) {
    const match = String(text || '').match(STICKER_MARKER_PATTERN);
    return match ? match[1] : null;
  }

  function stripStickerMarker(text) {
    return String(text || '').replace(TRAILING_STICKER_MARKER_PATTERN, '').trim();
  }

  const api = { extractStickerMarker, stripStickerMarker };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileStickerResolver = api;
  } else if (globalScope) {
    globalScope.ExProfileStickerResolver = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
