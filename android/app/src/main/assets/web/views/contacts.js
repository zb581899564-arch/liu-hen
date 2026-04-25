(function (globalScope) {
  'use strict';

  function firstLetter(name) {
    const value = String(name || '').trim();
    if (!value) {
      return '#';
    }
    const first = value[0].toUpperCase();
    return /^[A-Z]$/.test(first) ? first : '#';
  }

  function isPermanentContact(contact) {
    return contact && contact.source === 'permanent';
  }

  function renderPermanenceBadge() {
    return '<span class="permanence-badge" aria-label="永久保留" title="永久保留">∞</span>';
  }

  function renderContactAvatar(contact) {
    return [
      '<span class="avatar-wrap' + (isPermanentContact(contact) ? ' avatar-wrap-permanent' : '') + '">',
      '<span class="avatar' + (contact.avatarUrl ? '' : ' avatar-fallback') + '" aria-hidden="true"' + (contact.avatarUrl ? ' style="background-image:url(\'' + contact.avatarUrl + '\')"' : '') + '></span>',
      isPermanentContact(contact) ? renderPermanenceBadge() : '',
      '</span>',
    ].join('');
  }

  function renderContactsView(args) {
    const contacts = ((args && args.contacts) || []).slice().sort(function (a, b) {
      const groupA = firstLetter(a.displayName);
      const groupB = firstLetter(b.displayName);
      if (groupA !== groupB) {
        return groupA === '#' ? 1 : groupB === '#' ? -1 : groupA.localeCompare(groupB);
      }
      return String(a.displayName || '').localeCompare(String(b.displayName || ''), 'zh-Hans-CN');
    });
    const groups = [];
    const groupLookup = {};

    contacts.forEach(function (contact) {
      const letter = firstLetter(contact.displayName);
      if (!groupLookup[letter]) {
        groupLookup[letter] = [];
        groups.push(letter);
      }
      groupLookup[letter].push(contact);
    });

    const content = groups.length ? groups.flatMap(function (letter) {
      return [
        '<div class="contacts-group-title">' + letter + '</div>',
        ...groupLookup[letter].map(function (contact) {
          return [
            '<button class="chat-row contact-row" type="button" data-route="#/chat/' + encodeURIComponent(contact.slug) + '">',
            renderContactAvatar(contact),
            '<span class="chat-meta">',
            '<strong class="chat-name">' + contact.displayName + '</strong>',
            '<span class="chat-preview">' + (contact.source === 'permanent' ? '永久联系人' : contact.source === 'builtin' ? '内置联系人' : '导入联系人') + '</span>',
            '</span>',
            '<span class="chat-time">' + (contact.badge || '') + '</span>',
            '</button>',
          ].join('');
        }),
      ];
    }) : [
      '<div class="empty-state">',
      '<strong>通讯录还是空的</strong>',
      '<span>导入 Profile 后，这里会按 A-Z 自动排好。</span>',
      '</div>',
    ];

    return [
      '<div class="wechat-top">',
      '<header class="screen-header"><span></span><div class="screen-title">通讯录</div><span></span><span></span></header>',
      '</div>',
      '<section class="contacts-screen page-panel">',
      ...content,
      '<nav class="contacts-index" aria-label="字母索引">' + groups.map(function (letter) {
        return '<span>' + letter + '</span>';
      }).join('') + '</nav>',
      '</section>',
    ].join('');
  }

  const api = { renderContactsView };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileContactsView = api;
  } else if (globalScope) {
    globalScope.ExProfileContactsView = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
