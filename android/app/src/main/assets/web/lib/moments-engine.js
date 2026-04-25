(function (globalScope) {
  'use strict';

  function hashText(text) {
    return String(text || '').split('').reduce(function (sum, char) {
      return (sum * 31 + char.charCodeAt(0)) % 1000003;
    }, 7);
  }

  function pickIntent(seed, postCount) {
    const intents = ['share', 'vent', 'hint', 'record', 'test-the-water', 'be-seen'];
    return intents[(seed + postCount) % intents.length];
  }

  function buildMomentText(contact, intent, postCount) {
    const insight = (contact && contact.humanInsight) || {};
    const weather = (insight.weather && insight.weather.label) || '微风';
    const weatherLine = (insight.weather && insight.weather.line) || '';
    const memorySeeds = Array.isArray(insight.memorySeeds) ? insight.memorySeeds : [];
    const memorySeed = memorySeeds.length ? String(memorySeeds[postCount % memorySeeds.length] || '') : '';
    const preview = String((contact && contact.preview) || '').trim();
    const unsent = String(insight.unsentLine || '').trim();

    switch (intent) {
      case 'vent':
        return preview
          ? preview + '。今天也有点烦。'
          : '今天有点烦，先这样吧。';
      case 'hint':
        return memorySeed
          ? '刚又想到' + memorySeed
          : '有些话没想好怎么说。';
      case 'record':
        return weatherLine || (weather + '，适合安静一会儿。');
      case 'test-the-water':
        return preview
          ? '你刚刚那句“' + preview + '”我还记着。'
          : '先发这里，看看有没有人接。';
      case 'be-seen':
        return unsent || '有些话不想在聊天框里说。';
      case 'share':
      default:
        return preview
          ? preview + '，先记一下。'
          : (memorySeed || '今天就这样慢慢过去。');
    }
  }

  function createPost(contact, postCount, nowMs, shouldBackdate) {
    const slug = String(contact && contact.slug || '');
    const seed = hashText(slug);
    const intent = pickIntent(seed, postCount);
    const createdAt = shouldBackdate
      ? Number(nowMs || Date.now()) - Math.min(45, (seed + postCount * 13) % 46) * 60000
      : Number(nowMs || Date.now());

    return {
      id: 'moment-' + slug + '-' + (postCount + 1),
      contactSlug: slug,
      displayName: String(contact && contact.displayName || ''),
      avatarUrl: String(contact && contact.avatarUrl || ''),
      intent: intent,
      text: buildMomentText(contact, intent, postCount),
      createdAt: createdAt,
      comments: [],
      likedByUser: false,
    };
  }

  function nextDelayMs(contact, postCount) {
    const seed = hashText(contact && contact.slug);
    const baseHours = 2 + ((seed + postCount) % 4);
    return baseHours * 60 * 60 * 1000;
  }

  function ensureMomentsFresh(state, contacts, options) {
    const source = state || {};
    const nowMs = Number(options && options.nowMs) || Date.now();
    const postsBySlug = { ...(source.postsBySlug || {}) };
    const nextPostAtBySlug = { ...(source.nextPostAtBySlug || {}) };
    let changed = false;

    (Array.isArray(contacts) ? contacts : []).forEach(function (contact) {
      if (!contact || !contact.slug) {
        return;
      }
      const slug = String(contact.slug);
      const posts = Array.isArray(postsBySlug[slug]) ? postsBySlug[slug].slice() : [];
      const nextDueAt = Number(nextPostAtBySlug[slug] || 0);

      if (!posts.length) {
        posts.unshift(createPost(contact, 0, nowMs, true));
        nextPostAtBySlug[slug] = nowMs + nextDelayMs(contact, 0);
        postsBySlug[slug] = posts;
        changed = true;
        return;
      }

      if (nextDueAt && nextDueAt <= nowMs && posts.length < 6) {
        posts.unshift(createPost(contact, posts.length, nowMs, false));
        nextPostAtBySlug[slug] = nowMs + nextDelayMs(contact, posts.length);
        postsBySlug[slug] = posts.sort(function (left, right) {
          return Number(right.createdAt || 0) - Number(left.createdAt || 0);
        });
        changed = true;
      }
    });

    return {
      activeTab: source.activeTab === 'memory' ? 'memory' : 'moments',
      postsBySlug: postsBySlug,
      nextPostAtBySlug: nextPostAtBySlug,
      changed: changed,
    };
  }

  function createMomentCommentReply(contact, post, commentText, nowMs) {
    const text = String(commentText || '').trim();
    let replyText = '嗯，知道了。';

    if (/吃|饭|外卖|火锅/.test(text)) {
      replyText = '还没，等会儿再说。';
    } else if (/早点睡|别熬夜|晚安/.test(text)) {
      replyText = '你先别管我，你也早点睡。';
    } else if (/emo|烦|难受|别想太多/.test(text)) {
      replyText = '也没有那么夸张。就是有点烦。';
    } else if (/在干嘛|忙|干吗/.test(text)) {
      replyText = '没干嘛，就随便发一下。';
    } else if (post && post.intent === 'hint') {
      replyText = '你能看懂就行。';
    }

    return {
      id: 'comment-reply-' + Number(nowMs || Date.now()).toString(36),
      authorRole: 'assistant',
      authorSlug: String(contact && contact.slug || ''),
      authorName: String(contact && contact.displayName || ''),
      text: replyText,
      createdAt: Number(nowMs || Date.now()),
    };
  }

  const api = {
    ensureMomentsFresh,
    createMomentCommentReply,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileMomentsEngine = api;
  } else if (globalScope) {
    globalScope.ExProfileMomentsEngine = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
