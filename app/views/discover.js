(function (globalScope) {
  'use strict';

  function escapeText(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderMemoryGardenCard(contact) {
    const insight = contact.humanInsight || {};
    const weather = insight.weather || { label: '微风', line: '情绪很轻，像一句还没落地的话。' };
    const seeds = Array.isArray(insight.memorySeeds) && insight.memorySeeds.length
      ? insight.memorySeeds
      : ['有些旧话，会慢慢浮上来。'];

    return [
      '<article class="memory-garden-card">',
      '<div class="memory-garden-head">',
      '<span class="memory-weather">' + escapeText(weather.label) + '</span>',
      '<strong>' + escapeText(contact.displayName || '联系人') + '</strong>',
      '<span>' + escapeText(insight.relationPhase || '熟悉') + '</span>',
      '</div>',
      '<p>' + escapeText(weather.line || '') + '</p>',
      '<div class="unsent-line">' + escapeText(insight.unsentLine || '有些话，她还没发出来。') + '</div>',
      '<div class="memory-seeds">',
      seeds.slice(0, 4).map(function (seed) {
        return '<span>' + escapeText(seed) + '</span>';
      }).join(''),
      '</div>',
      '</article>',
    ].join('');
  }

  function renderDiscoverTabButton(tab, activeTab, label) {
    return [
      '<button class="discover-tab' + (activeTab === tab ? ' is-active' : '') + '"',
      ' data-role="discover-tab"',
      ' data-tab="' + escapeText(tab) + '"',
      ' type="button">',
      escapeText(label),
      '</button>',
    ].join('');
  }

  function renderMomentComment(post, comment) {
    const author = comment.authorRole === 'assistant'
      ? (comment.authorName || post.displayName || '她')
      : '你';
    return [
      '<div class="moment-comment">',
      '<strong>' + escapeText(author) + '</strong>',
      '<span>' + escapeText(comment.text || '') + '</span>',
      comment.authorRole === 'user'
        ? '<button class="moment-comment-delete" type="button" data-action="delete-moment-comment" data-post-id="' + escapeText(post.id) + '" data-comment-id="' + escapeText(comment.id || '') + '">删除</button>'
        : '',
      '</div>',
    ].join('');
  }

  function renderMomentCard(post, args) {
    const drafts = (args && args.commentDraftByPostId) || {};
    const openCommentPostId = args && args.openCommentPostId;
    const draftValue = String(drafts[post.id] || '');
    const isCommentOpen = openCommentPostId === post.id;

    return [
      '<article class="moment-card" data-post-id="' + escapeText(post.id) + '">',
      '<div class="moment-head">',
      '<span class="moment-avatar' + (post.avatarUrl ? '' : ' avatar-fallback') + '" style="' + (post.avatarUrl ? ('background-image:url(\'' + escapeText(post.avatarUrl) + '\')') : '') + '"></span>',
      '<div class="moment-head-copy">',
      '<strong>' + escapeText(post.displayName || '联系人') + '</strong>',
      '<span>' + escapeText(post.createdAtLabel || '刚刚') + '</span>',
      '</div>',
      '</div>',
      '<div class="moment-text">' + escapeText(post.text || '') + '</div>',
      '<div class="moment-actions">',
      '<button class="moment-action' + (post.likedByUser ? ' is-active' : '') + '" type="button" data-action="toggle-moment-like" data-post-id="' + escapeText(post.id) + '">' + (post.likedByUser ? '已赞' : '赞') + '</button>',
      '<button class="moment-action" type="button" data-action="open-moment-comment" data-post-id="' + escapeText(post.id) + '">评论</button>',
      '</div>',
      post.comments && post.comments.length
        ? '<div class="moment-comments">' + post.comments.map(function (comment) {
          return renderMomentComment(post, comment);
        }).join('') + '</div>'
        : '',
      isCommentOpen ? [
        '<div class="moment-comment-composer">',
        '<input data-role="moment-comment-input" data-post-id="' + escapeText(post.id) + '" type="text" value="' + escapeText(draftValue) + '" placeholder="写评论">',
        '<button type="button" data-action="send-moment-comment" data-post-id="' + escapeText(post.id) + '">发送</button>',
        '</div>',
      ].join('') : '',
      '</article>',
    ].join('');
  }

  function renderMomentsPane(args) {
    const feed = Array.isArray(args && args.momentsFeed) ? args.momentsFeed : [];
    if (!feed.length) {
      return [
        '<div class="empty-state">',
        '<strong>还没有新的动态</strong>',
        '<span>她们先安静过着自己的生活，等一会儿再来看看。</span>',
        '</div>',
      ].join('');
    }

    return [
      '<section class="moments-feed">',
      feed.map(function (post) {
        return renderMomentCard(post, args);
      }).join(''),
      '</section>',
    ].join('');
  }

  function renderMemoryPane(args) {
    const contacts = ((args && args.contacts) || []).filter(function (contact) {
      return contact && contact.humanInsight;
    });
    const cards = contacts.length
      ? contacts.map(renderMemoryGardenCard).join('')
      : '<div class="empty-state"><strong>记忆花园还没有发芽</strong><span>导入 Profile 或聊一会儿后，这里会长出共同记忆。</span></div>';

    return [
      '<section class="memory-garden">',
      '<div class="memory-garden-title"><strong>记忆花园</strong><span>从 profile 里长出来的天气、心事和旧句子。</span></div>',
      cards,
      '</section>',
    ].join('');
  }

  function renderDiscoverView(args) {
    const activeTab = args && args.activeTab === 'memory' ? 'memory' : 'moments';

    return [
      '<div class="wechat-top">',
      '<header class="screen-header"><span></span><div class="screen-title">发现</div><span></span><span></span></header>',
      '<div class="discover-tabs">',
      renderDiscoverTabButton('moments', activeTab, '朋友圈'),
      renderDiscoverTabButton('memory', activeTab, '记忆'),
      '</div>',
      '</div>',
      renderDiscoverPaneHtml(args),
    ].join('');
  }

  function renderDiscoverPaneHtml(args) {
    const activeTab = args && args.activeTab === 'memory' ? 'memory' : 'moments';

    return [
      '<div class="discover-pane discover-pane-' + activeTab + '" data-role="discover-pane">',
      activeTab === 'moments' ? renderMomentsPane(args) : renderMemoryPane(args),
      '</div>',
    ].join('');
  }

  const api = { renderDiscoverPaneHtml, renderDiscoverView };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileDiscoverView = api;
  } else if (globalScope) {
    globalScope.ExProfileDiscoverView = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
