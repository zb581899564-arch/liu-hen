(function (globalScope) {
  'use strict';

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[char];
    });
  }

  function matchesContact(contact, query) {
    if (!query) {
      return true;
    }
    const haystack = [
      contact.displayName,
      contact.originalDisplayName,
      contact.remark,
      contact.preview,
    ].join(' ').toLowerCase();
    return haystack.indexOf(query.toLowerCase()) >= 0;
  }

  function isPermanentContact(contact) {
    return contact && contact.source === 'permanent';
  }

  function renderPermanenceBadge() {
    return '<span class="permanence-badge" aria-label="永久保留" title="永久保留">∞</span>';
  }

  function renderContactAvatar(contact) {
    const avatarStyle = contact.avatarUrl ? ' style="background-image:url(\'' + escapeHtml(contact.avatarUrl) + '\')"' : '';
    return [
      '<span class="avatar-wrap' + (isPermanentContact(contact) ? ' avatar-wrap-permanent' : '') + '">',
      '<span class="avatar' + (contact.avatarUrl ? '' : ' avatar-fallback') + '" aria-hidden="true"' + avatarStyle + '></span>',
      isPermanentContact(contact) ? renderPermanenceBadge() : '',
      '</span>',
    ].join('');
  }

  function renderProactiveStatus(contact) {
    const status = contact && contact.proactiveStatus;
    if (!status || !status.visible) {
      return '';
    }
    return '<span class="chat-proactive-status chat-proactive-status-' + escapeHtml(status.tone || 'pending') + '" data-role="proactive-countdown" data-slug="' + escapeHtml(contact.slug || '') + '">' + escapeHtml(status.text || '') + '</span>';
  }

  function renderProfileWeather(contact) {
    const insight = contact && contact.humanInsight;
    if (!insight || !insight.weather) {
      return '';
    }
    return [
      '<span class="profile-weather">',
      '<span>' + escapeHtml(insight.weather.label || '微风') + '</span>',
      insight.relationPhase ? '<span>' + escapeHtml(insight.relationPhase) + '</span>' : '',
      '</span>',
    ].join('');
  }

  function renderChatListView(args) {
    const contacts = (args && args.contacts) || [];
    const searchOpen = Boolean(args && args.searchOpen);
    const searchQuery = String((args && args.searchQuery) || '').trim();
    const visibleContacts = contacts.filter(function (contact) {
      return matchesContact(contact, searchQuery);
    });
    const rows = visibleContacts.length ? visibleContacts.map((contact) => {
      return [
        '<button class="chat-row" type="button" data-route="#/chat/' + escapeHtml(contact.slug) + '">',
        renderContactAvatar(contact),
        '<span class="chat-meta">',
        '<strong class="chat-name">' + escapeHtml(contact.displayName) + '</strong>',
        renderProfileWeather(contact),
        '<span class="chat-preview">' + escapeHtml(contact.preview || '') + '</span>',
        renderProactiveStatus(contact),
        '</span>',
        '<span class="chat-time">' + escapeHtml(contact.time || '') + '</span>',
        '</button>',
      ].join('');
    }).join('') : contacts.length ? [
      '<div class="empty-state">',
      '<strong>没有搜到联系人</strong>',
      '<span>换个备注、昵称或关键词试试。</span>',
      '</div>',
    ].join('') : [
      '<div class="empty-state">',
      '<strong>还没有联系人</strong>',
      '<span>去“我”里面导入 Profile，新的聊天人会出现在这里。</span>',
      '</div>',
    ].join('');

    return [
      '<div class="wechat-top">',
      '<header class="screen-header">',
      '<span></span>',
      '<div class="screen-title">微信</div>',
      '<button class="screen-action" type="button" data-role="contact-search-toggle" aria-label="搜索"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4.2 4.2"></path></svg></button>',
      '<button class="screen-action" type="button" aria-label="添加"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v8M8 12h8"></path></svg></button>',
      '</header>',
      searchOpen ? [
        '<div class="contact-search-bar">',
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4.2 4.2"></path></svg>',
        '<input data-role="contact-search-input" type="search" value="' + escapeHtml(searchQuery) + '" placeholder="搜索联系人">',
        searchQuery ? '<button type="button" data-role="contact-search-clear">取消</button>' : '',
        '</div>',
      ].join('') : '',
      '</div>',
      '<section class="screen-section">',
      rows,
      '</section>',
    ].join('');
  }

  const api = { renderChatListView };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileChatListView = api;
  } else if (globalScope) {
    globalScope.ExProfileChatListView = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
