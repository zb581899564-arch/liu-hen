(function (globalScope) {
  'use strict';

  function summarizeMessage(message) {
    if (!message) {
      return '';
    }

    if (message.pending) {
      return '正在输入...';
    }

    if (message.kind === 'system') {
      return String(message.text || '');
    }

    if (message.kind !== 'message') {
      return '';
    }

    if (message.role === 'assistant' && message.origin === 'proactive') {
      const date = new Date(Number(message.sentAt || Date.now()));
      const hour = String((date.getUTCHours() + 8) % 24).padStart(2, '0');
      const minute = String(date.getUTCMinutes()).padStart(2, '0');
      return '她在 ' + hour + ':' + minute + ' 留了一句话';
    }

    if (message.stickerMd5 || message.stickerUrl) {
      return '[动画表情]';
    }

    if (message.attachmentType === 'image') {
      return '[图片]';
    }

    if (message.attachmentType === 'file') {
      return '[文件] ' + String(message.fileName || '').trim();
    }

    const text = String(message.text || '').trim();
    if (!text) {
      return '';
    }

    return message.role === 'user' ? '我: ' + text : text;
  }

  function getContactPreview(messages, fallback) {
    const queue = Array.isArray(messages) ? messages : [];
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      const preview = summarizeMessage(queue[index]);
      if (preview) {
        return preview;
      }
    }
    return String(fallback || '');
  }

  const api = { getContactPreview, summarizeMessage };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileContactPreview = api;
  } else if (globalScope) {
    globalScope.ExProfileContactPreview = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
