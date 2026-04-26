(function (globalScope) {
  'use strict';

  function escapeAttribute(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  const WECHAT_INLINE_EMOJI = {
    '微笑': '🙂',
    '撇嘴': '😕',
    '色': '😍',
    '发呆': '😳',
    '得意': '😎',
    '流泪': '😢',
    '害羞': '☺️',
    '闭嘴': '🤐',
    '睡': '😴',
    '大哭': '😭',
    '尴尬': '😅',
    '发怒': '😡',
    '调皮': '😜',
    '呲牙': '😁',
    '惊讶': '😮',
    '难过': '😞',
    '酷': '😎',
    '冷汗': '😓',
    '抓狂': '😫',
    '吐': '🤮',
    '偷笑': '🤭',
    '可爱': '🥰',
    '白眼': '🙄',
    '傲慢': '😤',
    '饥饿': '😋',
    '困': '😪',
    '惊恐': '😨',
    '流汗': '😅',
    '憨笑': '😄',
    '悠闲': '😌',
    '奋斗': '💪',
    '咒骂': '😠',
    '疑问': '❓',
    '嘘': '🤫',
    '晕': '😵',
    '衰': '😩',
    '骷髅': '💀',
    '敲打': '🔨',
    '再见': '👋',
    '擦汗': '😅',
    '抠鼻': '🤧',
    '鼓掌': '👏',
    '坏笑': '😏',
    '左哼哼': '😤',
    '右哼哼': '😤',
    '哈欠': '🥱',
    '鄙视': '🙄',
    '委屈': '🥺',
    '快哭了': '🥹',
    '阴险': '😈',
    '亲亲': '😘',
    '吓': '😱',
    '可怜': '🥺',
    '笑脸': '😄',
    '生病': '🤒',
    '脸红': '😊',
    '破涕为笑': '😂',
    '恐惧': '😨',
    '失望': '😞',
    '无语': '😑',
    '嘿哈': '😄',
    '捂脸': '🤦',
    '奸笑': '😏',
    '机智': '😏',
    '皱眉': '😟',
    '耶': '✌️',
    '吃瓜': '🍉',
    '加油': '💪',
    '汗': '😓',
    '天啊': '😲',
    'Emm': '😶',
    '社会社会': '🤝',
    '旺柴': '🐶',
    '好的': '👌',
  };

  function escapeHtml(value) {
    return escapeAttribute(value).replace(/'/g, '&#39;');
  }

  function safeMediaUrl(value) {
    const text = String(value || '').trim();
    if (!text) {
      return '';
    }
    const lower = text.toLowerCase();
    if (
      lower.startsWith('blob:') ||
      lower.startsWith('file:') ||
      lower.startsWith('https://') ||
      lower.startsWith('http://') ||
      lower.startsWith('data:image/')
    ) {
      return text;
    }
    if (!lower.includes(':') && !lower.startsWith('//')) {
      return text;
    }
    return '';
  }

  function safeCssUrl(value) {
    return safeMediaUrl(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\)/g, '\\)');
  }

  function renderAvatar(role, avatarUrl) {
    const safeUrl = safeCssUrl(avatarUrl || '');
    const className = role === 'user' ? 'thread-avatar thread-avatar-user' : 'thread-avatar';
    const style = safeUrl ? ' style="background-image:url(\'' + escapeAttribute(safeUrl) + '\')"' : '';
    return '<span class="' + className + '"' + style + '></span>';
  }

  function renderInlineEmojiText(text) {
    return escapeHtml(text).replace(/\[([^\[\]\s]{1,8})\]/g, function (match, name) {
      const emoji = WECHAT_INLINE_EMOJI[name];
      if (!emoji) {
        return match;
      }
      return '<span class="wechat-inline-emoji" title="' + escapeAttribute(name) + '">' + emoji + '</span>';
    });
  }

  function renderAttachment(message) {
    if (message.pending) {
      return [
        '<div class="typing-dots" aria-label="正在输入">',
        '<span></span><span></span><span></span>',
        '</div>',
      ].join('');
    }

    if (message.attachmentType === 'image') {
      const imageUrl = safeMediaUrl(message.imageUrl || '');
      const fileName = message.fileName || 'image';
      return [
        '<div class="attachment-image-card">',
        '<img class="attachment-image" src="' + escapeAttribute(imageUrl) + '" alt="' + escapeAttribute(fileName) + '">',
        message.fileName ? '<div class="attachment-caption">' + escapeHtml(message.fileName) + '</div>' : '',
        '</div>',
      ].join('');
    }

    if (message.attachmentType === 'file') {
      return [
        '<div class="file-card">',
        '<div class="file-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 4.5h6l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5Z"></path><path d="M13 4.5V9h4.5"></path></svg></div>',
        '<div class="file-meta">',
        '<div class="file-name">' + escapeHtml(message.fileName || 'Attachment') + '</div>',
        message.fileSizeLabel ? '<div class="file-size">' + escapeHtml(message.fileSizeLabel) + '</div>' : '',
        '</div>',
        '</div>',
      ].join('');
    }

    return '<div class="text">' + renderInlineEmojiText(message.text || '') + '</div>';
  }

  function renderFailureAction(message) {
    if (message.role !== 'user' || message.sendStatus !== 'failed') {
      return '';
    }

    return [
      '<div class="message-send-failed">',
      '<span>' + escapeHtml(message.errorText || '发送失败') + '</span>',
      '<button type="button" data-action="retry-message" data-message-id="' + escapeAttribute(message.id || '') + '">重试</button>',
      '</div>',
    ].join('');
  }

  function renderChatThreadTitle(args) {
    const contact = (args && args.contact) || { displayName: '' };
    return String(contact.displayName || '') + (args && args.isTyping ? ' 正在输入中......' : '');
  }

  function renderMessageHtml(message) {
    if (message.kind === 'time' || message.kind === 'system') {
      return '<div class="thread-meta-label">' + escapeHtml(message.text || '') + '</div>';
    }

    return [
      '<article class="thread-row thread-row-' + message.role + (message.sendStatus === 'failed' ? ' thread-row-failed' : '') + '">',
      message.role === 'assistant' ? renderAvatar('assistant', message.avatarUrl || '') : '',
      '<div class="bubble bubble-' + message.role + '">',
      message.stickerUrl
        ? '<img class="sticker" src="' + escapeAttribute(safeMediaUrl(message.stickerUrl || '')) + '" alt="' + escapeAttribute(message.stickerMd5 || '') + '">'
        : renderAttachment(message),
      renderFailureAction(message),
      '</div>',
      message.role === 'user' ? renderAvatar('user', message.avatarUrl || '') : '',
      '</article>',
    ].join('');
  }

  function renderChatThreadMessagesHtml(args) {
    const messages = (args && args.messages) || [];
    return messages.map(renderMessageHtml).join('');
  }

  function renderChatThreadView(args) {
    const contact = args.contact || { displayName: '' };
    const messages = args.messages || [];
    const composerText = args.composerText || '';
    const contactSettingsRoute = '#/contact-settings/' + encodeURIComponent(contact.slug || contact.displayName || '');
    const titleText = renderChatThreadTitle(args);

    return [
      '<div class="thread-screen page-panel">',
      '<div class="wechat-top"><header class="screen-header thread-header"><button class="thread-back" type="button" aria-label="Back" data-route="#/wechat"><svg viewBox="0 0 24 24"><path d="M14.5 4.5 7 12l7.5 7.5"></path></svg></button><div class="screen-title thread-title">' + escapeHtml(titleText) + '</div><button class="thread-side-icon" type="button" aria-label="Mute"><svg viewBox="0 0 24 24"><path d="M14 17.5c0 1.2-1 2.2-2.2 2.2S9.6 18.7 9.6 17.5V8.6c0-2.3 1.9-4.1 4.2-4.1S18 6.3 18 8.6c0 1.6-1.3 2.9-2.9 2.9s-2.9-1.3-2.9-2.9V7.1"></path></svg></button><button class="thread-more" type="button" aria-label="More" data-route="' + contactSettingsRoute + '"><svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"></circle><circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none"></circle></svg></button></header></div>',
      '<section class="thread-messages" data-role="thread-messages">',
      renderChatThreadMessagesHtml({ messages: messages }),
      '</section>',
      '<footer class="wechat-composer"><button class="composer-circle" type="button" aria-label="Voice"><svg viewBox="0 0 24 24"><path d="M12 4v8"></path><path d="M8.5 8.5a3.5 3.5 0 1 1 7 0v3a3.5 3.5 0 1 1-7 0v-3Z"></path><path d="M6 11.5a6 6 0 0 0 12 0"></path></svg></button><div class="composer-input-wrap"><input class="composer-input" data-role="composer-input" type="text" value="' + escapeAttribute(composerText) + '" placeholder="" enterkeyhint="send" autocomplete="off"><button class="composer-send" data-role="composer-send-button" type="button">发送</button></div><button class="composer-circle" type="button" aria-label="Sticker"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.7"></circle><path d="M9 10h.01M15 10h.01"></path><path d="M8.5 14.2c.8 1.2 2.1 1.8 3.5 1.8 1.4 0 2.7-.6 3.5-1.8"></path></svg></button><button class="composer-circle" type="button" aria-label="Attach" data-action="attach"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v8M8 12h8"></path></svg></button><input class="composer-file-input file-input-proxy" data-role="composer-file-input" type="file" multiple></footer>',
      '</div>',
    ].join('');
  }

  const api = { renderChatThreadMessagesHtml, renderChatThreadTitle, renderChatThreadView };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileChatThreadView = api;
  } else if (globalScope) {
    globalScope.ExProfileChatThreadView = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
