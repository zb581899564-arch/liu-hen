(function (globalScope) {
  'use strict';

  const CONTACTS_KEY = 'wechatProfileContacts';
  const APPEARANCE_KEY = 'wechatProfileAppearance';
  const CHAT_PERSISTENCE_KEY = 'wechatProfileChatPersistence';
  const CONTACT_PREFERENCES_KEY = 'wechatProfileContactPreferences';
  const MOMENTS_KEY = 'wechatProfileMoments';
  const PROACTIVE_RUNTIME_KEY = 'wechatProfileProactiveRuntime';
  const PERMANENT_PREFIX = 'permanent-';
  const PROACTIVE_FREQUENCIES = ['gentle', 'normal', 'frequent'];

  function getNativeBridge() {
    return globalScope && globalScope.AndroidBridge ? globalScope.AndroidBridge : null;
  }

  function readJson(text, fallback) {
    try {
      return JSON.parse(String(text || '{}'));
    } catch (_error) {
      return fallback;
    }
  }

  function saveContacts(contacts) {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
  }

  function loadContacts() {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    return JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]');
  }

  function normalizeContactPreferences(preferences) {
    const source = preferences || {};
    const remarksBySlug = {};
    Object.keys(source.remarksBySlug || {}).forEach(function (slug) {
      const value = String(source.remarksBySlug[slug] || '').trim();
      if (slug && value) {
        remarksBySlug[String(slug)] = value;
      }
    });

    const deletedLookup = {};
    (Array.isArray(source.deletedSlugs) ? source.deletedSlugs : []).forEach(function (slug) {
      if (slug) {
        deletedLookup[String(slug)] = true;
      }
    });

    return {
      remarksBySlug: remarksBySlug,
      deletedSlugs: Object.keys(deletedLookup),
    };
  }

  function saveContactPreferences(preferences) {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(CONTACT_PREFERENCES_KEY, JSON.stringify(normalizeContactPreferences(preferences)));
  }

  function normalizeMomentComment(comment) {
    const source = comment || {};
    const text = String(source.text || '').trim();
    if (!text) {
      return null;
    }
    return {
      id: String(source.id || ('comment-' + Date.now())),
      authorRole: source.authorRole === 'assistant' ? 'assistant' : 'user',
      authorSlug: String(source.authorSlug || ''),
      text: text,
      createdAt: Number(source.createdAt) || Date.now(),
    };
  }

  function normalizeMomentPost(post) {
    const source = post || {};
    const text = String(source.text || '').trim();
    if (!text) {
      return null;
    }
    const normalized = {
      id: String(source.id || ('moment-' + Date.now())),
      contactSlug: String(source.contactSlug || ''),
      intent: String(source.intent || 'share'),
      text: text,
      createdAt: Number(source.createdAt) || Date.now(),
      likedByUser: Boolean(source.likedByUser),
      comments: (Array.isArray(source.comments) ? source.comments : []).map(normalizeMomentComment).filter(Boolean),
    };
    if (source.displayName) {
      normalized.displayName = String(source.displayName);
    }
    if (source.avatarUrl) {
      normalized.avatarUrl = String(source.avatarUrl);
    }
    return normalized;
  }

  function normalizeMomentsState(state) {
    const source = state || {};
    const postsBySlug = {};
    Object.keys(source.postsBySlug || {}).forEach(function (slug) {
      const posts = (Array.isArray(source.postsBySlug[slug]) ? source.postsBySlug[slug] : [])
        .map(normalizeMomentPost)
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

  function loadContactPreferences() {
    if (typeof localStorage === 'undefined') {
      return { remarksBySlug: {}, deletedSlugs: [] };
    }

    try {
      return normalizeContactPreferences(JSON.parse(localStorage.getItem(CONTACT_PREFERENCES_KEY) || '{}'));
    } catch (_error) {
      return { remarksBySlug: {}, deletedSlugs: [] };
    }
  }

  function normalizeAppearance(appearance) {
    const source = appearance || {};
    const contactAvatarUrls = {};
    Object.keys(source.contactAvatarUrls || {}).forEach(function (slug) {
      const value = String(source.contactAvatarUrls[slug] || '');
      if (slug && value) {
        contactAvatarUrls[String(slug)] = value;
      }
    });
    return {
      userAvatarUrl: String(source.userAvatarUrl || ''),
      contactAvatarUrls: contactAvatarUrls,
    };
  }

  function loadLocalAppearance() {
    if (typeof localStorage === 'undefined') {
      return normalizeAppearance({});
    }

    try {
      return normalizeAppearance(readJson(localStorage.getItem(APPEARANCE_KEY) || '{}', {}));
    } catch (_error) {
      return normalizeAppearance({});
    }
  }

  function saveAppearance(appearance) {
    const normalized = normalizeAppearance(appearance);
    const payload = JSON.stringify(normalized);
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.saveAppearance === 'function') {
      bridge.saveAppearance(payload);
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(APPEARANCE_KEY, payload);
      } catch (_error) {
        // Avatar data URLs can exceed WebView localStorage quota; native storage is the source of truth on Android.
      }
    }
  }

  function loadAppearance() {
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.loadAppearance === 'function') {
      const nativeAppearance = normalizeAppearance(readJson(bridge.loadAppearance(), {}));
      if (nativeAppearance.userAvatarUrl || Object.keys(nativeAppearance.contactAvatarUrls).length) {
        return nativeAppearance;
      }
    }

    return loadLocalAppearance();
  }

  function isPermanentSlug(slug) {
    return String(slug || '').indexOf(PERMANENT_PREFIX) === 0;
  }

  function toPermanentSlug(slug) {
    const source = String(slug || '');
    return isPermanentSlug(source) ? source : PERMANENT_PREFIX + source;
  }

  function toTemporarySlug(slug) {
    return String(slug || '').replace(new RegExp('^' + PERMANENT_PREFIX), '');
  }

  function normalizeProactiveSettings(settings) {
    const source = settings || {};
    const frequency = PROACTIVE_FREQUENCIES.indexOf(source.frequency) >= 0
      ? source.frequency
      : 'normal';

    return {
      enabled: Boolean(source.enabled),
      frequency: frequency,
    };
  }

  function normalizeProactiveBySlug(settingsBySlug) {
    const source = settingsBySlug || {};
    const normalized = {};
    Object.keys(source).forEach(function (slug) {
      const permanentSlug = toPermanentSlug(slug);
      normalized[permanentSlug] = normalizeProactiveSettings(source[slug]);
    });
    return normalized;
  }

  function isDeprecatedProactiveImageUrl(url) {
    return String(url || '').indexOf('./assets/proactive-images/') === 0;
  }

  function sanitizeScheduledMessagesForPersistence(scheduledBySlug) {
    const source = scheduledBySlug || {};
    const normalized = {};
    Object.keys(source).forEach(function (slug) {
      if (!isPermanentSlug(slug)) {
        return;
      }
      const items = (Array.isArray(source[slug]) ? source[slug] : [])
        .map(function (item) {
          if (!item || typeof item !== 'object') {
            return null;
          }
          const type = String(item.type || 'text');
          const clean = {
            id: String(item.id || ('scheduled-' + String(item.dueAt || Date.now()))),
            dueAt: Number(item.dueAt) || Date.now(),
            type: type,
          };
          if (type === 'sticker') {
            clean.md5 = String(item.md5 || '');
            return clean.md5 ? clean : null;
          }
          if (type === 'image') {
            clean.imageUrl = String(item.imageUrl || '');
            clean.fileName = String(item.fileName || 'image');
            return clean.imageUrl &&
              clean.imageUrl.indexOf('data:') !== 0 &&
              clean.imageUrl.indexOf('blob:') !== 0 &&
              !isDeprecatedProactiveImageUrl(clean.imageUrl) ? clean : null;
          }
          clean.type = 'text';
          clean.text = String(item.text || '');
          return clean.text ? clean : null;
        })
        .filter(Boolean);
      if (items.length) {
        normalized[slug] = items;
      }
    });
    return normalized;
  }

  function sanitizeMessagesForPersistence(messages) {
    return (Array.isArray(messages) ? messages : [])
      .filter(function (message) {
        return message && !message.pending && (message.kind === 'message' || message.kind === 'time' || message.kind === 'system');
      })
      .map(function (message) {
        if (message.kind === 'time' || message.kind === 'system') {
          return {
            kind: message.kind,
            text: String(message.text || ''),
          };
        }

        const clean = {
          kind: 'message',
          role: message.role === 'user' ? 'user' : 'assistant',
          text: String(message.text || ''),
        };

        if (message.id && clean.role === 'user') {
          clean.id = String(message.id);
        }

        if (clean.role === 'user' && message.sendStatus === 'failed') {
          clean.sendStatus = 'failed';
          clean.errorText = String(message.errorText || '发送失败');
        }

        if (message.attachmentType === 'file') {
          clean.attachmentType = 'file';
          clean.fileName = String(message.fileName || '');
          clean.fileSizeLabel = String(message.fileSizeLabel || '');
        }

        if (
          message.attachmentType === 'image' &&
          message.imageUrl &&
          String(message.imageUrl).indexOf('blob:') !== 0 &&
          String(message.imageUrl).indexOf('data:') !== 0 &&
          !isDeprecatedProactiveImageUrl(message.imageUrl)
        ) {
          clean.attachmentType = 'image';
          clean.imageUrl = String(message.imageUrl);
          clean.fileName = String(message.fileName || '');
        }

        if (message.stickerMd5) {
          clean.stickerMd5 = String(message.stickerMd5);
        }

        if (clean.role === 'assistant' && message.origin === 'proactive') {
          clean.origin = 'proactive';
          clean.sentAt = Number(message.sentAt) || Date.now();
        }

        if (
          message.stickerUrl &&
          String(message.stickerUrl).indexOf('blob:') !== 0 &&
          String(message.stickerUrl).indexOf('data:') !== 0
        ) {
          clean.stickerUrl = String(message.stickerUrl);
        }

        return clean;
      })
      .filter(function (message) {
        return Boolean(message && (
          message.kind !== 'message' ||
          message.text ||
          message.attachmentType ||
          message.stickerMd5 ||
          message.stickerUrl ||
          message.sendStatus
        ));
      });
  }

  function normalizeChatPersistence(raw) {
    const source = raw || {};
    const messages = {};
    Object.keys(source.messages || {}).forEach(function (slug) {
      if (isPermanentSlug(slug)) {
        messages[slug] = sanitizeMessagesForPersistence(source.messages[slug]);
      }
    });

    return {
      enabled: Boolean(source.enabled),
      doNotDisturbEnabled: Boolean(source.doNotDisturbEnabled),
      proactive: normalizeProactiveSettings(source.proactive),
      proactiveBySlug: normalizeProactiveBySlug(source.proactiveBySlug),
      messages: messages,
      scheduledBySlug: sanitizeScheduledMessagesForPersistence(source.scheduledBySlug),
    };
  }

  function hasChatPersistenceContent(state) {
    const source = state || {};
    return Boolean(
      source.enabled ||
      source.doNotDisturbEnabled ||
      Object.keys(source.proactiveBySlug || {}).length ||
      Object.keys(source.messages || {}).length ||
      Object.keys(source.scheduledBySlug || {}).length
    );
  }

  function loadLocalChatPersistence() {
    if (typeof localStorage === 'undefined') {
      return normalizeChatPersistence({});
    }

    try {
      return normalizeChatPersistence(readJson(localStorage.getItem(CHAT_PERSISTENCE_KEY) || '{}', {}));
    } catch (_error) {
      return normalizeChatPersistence({});
    }
  }

  function saveChatPersistence(state) {
    const normalized = normalizeChatPersistence(state);
    const payload = JSON.stringify(normalized);
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.saveChatPersistence === 'function') {
      bridge.saveChatPersistence(payload);
      return;
    }

    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(CHAT_PERSISTENCE_KEY, payload);
  }

  function loadChatPersistence() {
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.loadChatPersistence === 'function') {
      const nativeState = normalizeChatPersistence(readJson(bridge.loadChatPersistence(), {}));
      return hasChatPersistenceContent(nativeState) ? nativeState : loadLocalChatPersistence();
    }

    if (typeof localStorage === 'undefined') {
      return { enabled: false, doNotDisturbEnabled: false, proactive: normalizeProactiveSettings(null), proactiveBySlug: {}, messages: {}, scheduledBySlug: {} };
    }

    return loadLocalChatPersistence();
  }

  function saveMoments(state) {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(MOMENTS_KEY, JSON.stringify(normalizeMomentsState(state)));
  }

  function loadMoments() {
    if (typeof localStorage === 'undefined') {
      return normalizeMomentsState({});
    }
    try {
      return normalizeMomentsState(readJson(localStorage.getItem(MOMENTS_KEY) || '{}', {}));
    } catch (_error) {
      return normalizeMomentsState({});
    }
  }

  function saveProactiveRuntime(runtimeBySlug) {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(PROACTIVE_RUNTIME_KEY, JSON.stringify(runtimeBySlug || {}));
  }

  function loadProactiveRuntime() {
    if (typeof localStorage === 'undefined') {
      return {};
    }
    try {
      return readJson(localStorage.getItem(PROACTIVE_RUNTIME_KEY) || '{}', {});
    } catch (_error) {
      return {};
    }
  }

  const api = {
    CONTACTS_KEY,
    APPEARANCE_KEY,
    CHAT_PERSISTENCE_KEY,
    CONTACT_PREFERENCES_KEY,
    MOMENTS_KEY,
    PROACTIVE_RUNTIME_KEY,
    saveContacts,
    loadContacts,
    saveContactPreferences,
    loadContactPreferences,
    normalizeContactPreferences,
    saveAppearance,
    loadAppearance,
    saveChatPersistence,
    loadChatPersistence,
    saveMoments,
    loadMoments,
    saveProactiveRuntime,
    loadProactiveRuntime,
    sanitizeMessagesForPersistence,
    sanitizeScheduledMessagesForPersistence,
    normalizeProactiveSettings,
    normalizeProactiveBySlug,
    isPermanentSlug,
    toPermanentSlug,
    toTemporarySlug,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileStorage = api;
  } else if (globalScope) {
    globalScope.ExProfileStorage = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
