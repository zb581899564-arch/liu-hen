(function (globalScope) {
  'use strict';

  function normalizeComment(comment) {
    const source = comment || {};
    const text = String(source.text || '').trim();
    if (!text) {
      return null;
    }
    return {
      id: String(source.id || ('comment-' + Date.now())),
      authorRole: source.authorRole === 'assistant' ? 'assistant' : 'user',
      authorSlug: String(source.authorSlug || ''),
      authorName: String(source.authorName || ''),
      text: text,
      createdAt: Number(source.createdAt) || Date.now(),
    };
  }

  function normalizePost(post) {
    const source = post || {};
    const text = String(source.text || '').trim();
    if (!text) {
      return null;
    }
    return {
      id: String(source.id || ('moment-' + Date.now())),
      contactSlug: String(source.contactSlug || ''),
      displayName: String(source.displayName || ''),
      avatarUrl: String(source.avatarUrl || ''),
      intent: String(source.intent || 'share'),
      text: text,
      createdAt: Number(source.createdAt) || Date.now(),
      createdAtLabel: String(source.createdAtLabel || ''),
      likedByUser: Boolean(source.likedByUser),
      comments: (Array.isArray(source.comments) ? source.comments : []).map(normalizeComment).filter(Boolean),
    };
  }

  function normalizeMomentsState(state) {
    const source = state || {};
    const postsBySlug = {};
    Object.keys(source.postsBySlug || {}).forEach(function (slug) {
      const posts = (Array.isArray(source.postsBySlug[slug]) ? source.postsBySlug[slug] : [])
        .map(normalizePost)
        .filter(Boolean)
        .sort(function (left, right) {
          return Number(right.createdAt || 0) - Number(left.createdAt || 0);
        });
      if (posts.length) {
        postsBySlug[String(slug)] = posts;
      }
    });

    const nextPostAtBySlug = {};
    Object.keys(source.nextPostAtBySlug || {}).forEach(function (slug) {
      const value = Number(source.nextPostAtBySlug[slug] || 0);
      if (value > 0) {
        nextPostAtBySlug[String(slug)] = value;
      }
    });

    return {
      activeTab: source.activeTab === 'memory' ? 'memory' : 'moments',
      postsBySlug: postsBySlug,
      nextPostAtBySlug: nextPostAtBySlug,
    };
  }

  function setDiscoverTab(state, tab) {
    return {
      ...normalizeMomentsState(state),
      activeTab: tab === 'memory' ? 'memory' : 'moments',
    };
  }

  function upsertMomentPosts(state, slug, posts) {
    const normalized = normalizeMomentsState(state);
    const nextPosts = ((normalized.postsBySlug[String(slug)] || []).concat(posts || []))
      .map(normalizePost)
      .filter(Boolean);
    const seen = {};
    const deduped = nextPosts.filter(function (post) {
      if (seen[post.id]) {
        return false;
      }
      seen[post.id] = true;
      return true;
    }).sort(function (left, right) {
      return Number(right.createdAt || 0) - Number(left.createdAt || 0);
    });

    return {
      ...normalized,
      postsBySlug: {
        ...normalized.postsBySlug,
        [String(slug)]: deduped,
      },
    };
  }

  function updatePosts(state, updater) {
    const normalized = normalizeMomentsState(state);
    const postsBySlug = {};
    Object.keys(normalized.postsBySlug).forEach(function (slug) {
      postsBySlug[slug] = normalized.postsBySlug[slug].map(function (post) {
        return updater(post);
      }).filter(Boolean);
    });
    return {
      ...normalized,
      postsBySlug: postsBySlug,
    };
  }

  function toggleMomentLike(state, postId) {
    return updatePosts(state, function (post) {
      if (post.id !== postId) {
        return post;
      }
      return {
        ...post,
        likedByUser: !post.likedByUser,
      };
    });
  }

  function addMomentComment(state, postId, comment) {
    const normalizedComment = normalizeComment(comment);
    if (!normalizedComment) {
      return normalizeMomentsState(state);
    }
    return updatePosts(state, function (post) {
      if (post.id !== postId) {
        return post;
      }
      return {
        ...post,
        comments: post.comments.concat([normalizedComment]).sort(function (left, right) {
          return Number(left.createdAt || 0) - Number(right.createdAt || 0);
        }),
      };
    });
  }

  function removeMomentComment(state, postId, commentId) {
    return updatePosts(state, function (post) {
      if (post.id !== postId) {
        return post;
      }
      return {
        ...post,
        comments: post.comments.filter(function (comment) {
          return comment.id !== commentId;
        }),
      };
    });
  }

  function getMomentFeed(state) {
    const normalized = normalizeMomentsState(state);
    return Object.keys(normalized.postsBySlug)
      .reduce(function (all, slug) {
        return all.concat(normalized.postsBySlug[slug]);
      }, [])
      .sort(function (left, right) {
        return Number(right.createdAt || 0) - Number(left.createdAt || 0);
      });
  }

  const api = {
    normalizeMomentsState,
    setDiscoverTab,
    upsertMomentPosts,
    toggleMomentLike,
    addMomentComment,
    removeMomentComment,
    getMomentFeed,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileMomentsStore = api;
  } else if (globalScope) {
    globalScope.ExProfileMomentsStore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
