(function () {
  'use strict';

  const baseContacts = window.ExProfileBuiltinContacts.BUILTIN_CONTACTS.map(function (contact) {
    return { ...contact };
  });
  const defaultSettings = { baseUrl: '', apiKey: '', model: '' };
  const androidHost = window.ExProfileAndroidHost
    ? window.ExProfileAndroidHost.createAndroidHostAdapter(window.AndroidBridge)
    : {
        isAndroid: function () { return false; },
        loadSettings: async function () { return defaultSettings; },
        saveSettings: async function () { return null; },
        listBuiltinProfiles: async function () { return []; },
        listImportedProfiles: async function () { return []; },
        importProfileFromPicker: async function () { return null; },
      };
  const storageApi = window.ExProfileStorage || {
    loadAppearance: function () {
      return { userAvatarUrl: '', contactAvatarUrls: {} };
    },
    saveAppearance: function () {
      return null;
    },
    loadContactPreferences: function () {
      return { remarksBySlug: {}, deletedSlugs: [] };
    },
    saveContactPreferences: function () {
      return null;
    },
    loadChatPersistence: function () {
      return { enabled: false, doNotDisturbEnabled: false, proactive: { enabled: false, frequency: 'normal' }, proactiveBySlug: {}, messages: {}, scheduledBySlug: {} };
    },
    saveChatPersistence: function () {
      return null;
    },
    loadMoments: function () {
      return { activeTab: 'moments', postsBySlug: {}, nextPostAtBySlug: {} };
    },
    saveMoments: function () {
      return null;
    },
    normalizeProactiveSettings: function (settings) {
      const source = settings || {};
      return {
        enabled: Boolean(source.enabled),
        frequency: ['gentle', 'normal', 'frequent'].indexOf(source.frequency) >= 0 ? source.frequency : 'normal',
      };
    },
    normalizeProactiveBySlug: function (settingsBySlug) {
      return settingsBySlug || {};
    },
    sanitizeMessagesForPersistence: function (messages) {
      return messages || [];
    },
    sanitizeScheduledMessagesForPersistence: function (scheduledBySlug) {
      return scheduledBySlug || {};
    },
    isPermanentSlug: function (slug) {
      return String(slug || '').indexOf('permanent-') === 0;
    },
    toPermanentSlug: function (slug) {
      const source = String(slug || '');
      return source.indexOf('permanent-') === 0 ? source : 'permanent-' + source;
    },
  };
  const contactPreviewApi = window.ExProfileContactPreview || {
    getContactPreview: function (_messages, fallback) {
      return String(fallback || '');
    },
  };
  const proactiveStatusApi = window.ExProfileProactiveStatus || {
    getProactiveStatus: function () {
      return { visible: false, tone: 'off', text: '' };
    },
  };
  const humanProfileApi = window.ExProfileHumanProfile || {
    createHumanProfileInsight: function (profile) {
      return {
        weather: { label: '微风', line: '情绪很轻，像一句还没落地的话。' },
        relationPhase: '熟悉',
        unsentLine: '有些话，她还没发出来。',
        memorySeeds: [(profile && profile.displayName ? profile.displayName : '她') + '还没有被好好读完。'],
        runtimeHint: '',
      };
    },
  };
  const baseMessages = {};
  const chatPersistenceState = storageApi.loadChatPersistence();
  Object.keys(chatPersistenceState.messages || {}).forEach(function (slug) {
    baseMessages[slug] = chatPersistenceState.messages[slug];
  });
  let scheduledBySlug = chatPersistenceState.scheduledBySlug || {};

  let appearanceState = storageApi.loadAppearance();
  let contactPreferencesState = storageApi.loadContactPreferences();
  let chatRetentionEnabled = Boolean(chatPersistenceState.enabled);
  let doNotDisturbEnabled = Boolean(chatPersistenceState.doNotDisturbEnabled);
  let proactiveBySlug = storageApi.normalizeProactiveBySlug(chatPersistenceState.proactiveBySlug);
  let selectedAvatarContactSlug = baseContacts[0] ? baseContacts[0].slug : '';
  let settingsState = { ...defaultSettings };
  let settingsStatus = '';
  let hostProfilesState = { builtin: [], imported: [] };
  const profileBundleCache = {};
  const profileInsightBySlug = {};
  const pendingReplyBySlug = {};
  const pendingUserBatchBySlug = {};
  const pendingTypingMessageBySlug = {};
  const scheduledTimersBySlug = {};
  const composerDraftBySlug = {};
  let contactSearchOpen = false;
  let contactSearchQuery = '';
  let contactAvatarStatusBySlug = {};
  let nextPendingMessageId = 1;
  let nextUserMessageId = 1;
  let proactiveTimerId = null;
  let proactiveNextRunAt = 0;
  let proactiveNextRunBySlug = {};
  let proactiveTimerToken = 0;
  let proactiveWatchdogId = null;
  let proactiveHeartbeatFrameId = null;
  let proactiveHeartbeatLastTickAt = 0;
  let proactiveLastAttemptBySlug = {};
  let proactiveInFlight = false;
  let deferredRenderOptions = null;
  let threadViewportSyncFrameId = 0;
  let momentsState = storageApi.loadMoments ? storageApi.loadMoments() : { activeTab: 'moments', postsBySlug: {}, nextPostAtBySlug: {} };
  let openMomentCommentPostId = '';
  let momentCommentDraftByPostId = {};
  let momentReplyTimersByPostId = {};

  function normalizeSettings(settings) {
    const source = settings || {};
    return {
      baseUrl: String(source.baseUrl || ''),
      apiKey: String(source.apiKey || ''),
      model: String(source.model || ''),
    };
  }

  function getUserAvatarUrl() {
    return appearanceState.userAvatarUrl || '';
  }

  function getMessageQueue(slug) {
    if (!baseMessages[slug]) {
      baseMessages[slug] = [];
    }
    return baseMessages[slug];
  }

  function getPermanentSlug(slug) {
    return storageApi.toPermanentSlug(String(slug || ''));
  }

  function getProactiveSettingsForSlug(slug) {
    return storageApi.normalizeProactiveSettings(proactiveBySlug[getPermanentSlug(slug)]);
  }

  function setProactiveSettingsForSlug(slug, settings) {
    const permanentSlug = getPermanentSlug(slug);
    proactiveBySlug = {
      ...proactiveBySlug,
      [permanentSlug]: storageApi.normalizeProactiveSettings(settings),
    };
  }

  function hasEnabledProactiveContacts() {
    return Object.keys(proactiveBySlug).some(function (slug) {
      return Boolean(proactiveBySlug[slug] && proactiveBySlug[slug].enabled);
    });
  }

  function hasApiSettings() {
    return Boolean(settingsState.baseUrl && settingsState.apiKey && settingsState.model);
  }

  function resetProactiveScheduleForSlug(slug) {
    const permanentSlug = getPermanentSlug(slug);
    const previousRunAt = proactiveNextRunBySlug[permanentSlug] || 0;
    delete proactiveNextRunBySlug[permanentSlug];
    if (proactiveNextRunAt && previousRunAt === proactiveNextRunAt) {
      proactiveNextRunAt = 0;
    }
  }

  function getProactiveStatusForSlug(slug) {
    const permanentSlug = getPermanentSlug(slug);
    return proactiveStatusApi.getProactiveStatus({
      proactiveSettings: getProactiveSettingsForSlug(permanentSlug),
      doNotDisturbEnabled: doNotDisturbEnabled,
      hasApiSettings: hasApiSettings(),
      nextRunAt: proactiveNextRunBySlug[permanentSlug] || 0,
      nowMs: Date.now(),
    });
  }

  function formatClockTime(timestamp) {
    const value = Number(timestamp || 0);
    if (!value) {
      return '';
    }
    const date = new Date(value);
    return [
      String(date.getHours()).padStart(2, '0'),
      String(date.getMinutes()).padStart(2, '0'),
      String(date.getSeconds()).padStart(2, '0'),
    ].join(':');
  }

  function formatRelativeMs(ms) {
    const value = Math.max(0, Number(ms || 0));
    if (!value) {
      return '随时会触发';
    }
    if (value < 120000) {
      return Math.ceil(value / 1000) + '秒后';
    }
    if (value < 60 * 60 * 1000) {
      return Math.ceil(value / 60000) + '分钟后';
    }
    return Math.ceil(value / (60 * 60 * 1000)) + '小时后';
  }

  function getProactiveDiagnosticsForContact(contact, contacts) {
    const slug = contact ? contact.slug : '';
    const settings = getProactiveSettingsForSlug(slug);
    const nextRunAt = Number(proactiveNextRunBySlug[getPermanentSlug(slug)] || 0);
    const candidates = window.ExProfileProactiveContacts.listProactiveContacts(
      Array.isArray(contacts) ? contacts : [],
      proactiveBySlug
    );
    const lastAttempt = proactiveLastAttemptBySlug[getPermanentSlug(slug)] || null;
    const lastAttemptParts = [];
    if (lastAttempt) {
      if (lastAttempt.triggerLabel) {
        lastAttemptParts.push(lastAttempt.triggerLabel);
      }
      if (lastAttempt.status) {
        lastAttemptParts.push(lastAttempt.status);
      }
      if (lastAttempt.at) {
        lastAttemptParts.push(formatClockTime(lastAttempt.at));
      }
      if (lastAttempt.message) {
        lastAttemptParts.push(lastAttempt.message);
      }
    }
    return {
      enabled: Boolean(settings.enabled),
      frequency: settings.frequency || 'normal',
      doNotDisturbEnabled: doNotDisturbEnabled,
      hasApiSettings: hasApiSettings(),
      hasProfile: Boolean(contact && contact.hostProfileLocation),
      candidateCount: candidates.length,
      nextRunText: nextRunAt ? formatRelativeMs(nextRunAt - Date.now()) : '',
      nextRunAtText: nextRunAt ? formatClockTime(nextRunAt) : '',
      heartbeatText: proactiveHeartbeatFrameId
        ? '前台心跳运行中，最近' + (proactiveHeartbeatLastTickAt ? formatClockTime(proactiveHeartbeatLastTickAt) : '刚启动')
        : '前台心跳未启动',
      lastAttemptText: lastAttempt
        ? lastAttemptParts.join(' | ')
        : '还没有自动尝试',
    };
  }

  function getFallbackHumanInsight(contact) {
    return humanProfileApi.createHumanProfileInsight({
      displayName: (contact && contact.displayName) || '她',
      sections: {
        persona: (contact && contact.displayName ? contact.displayName : '她') + '的 profile 还在读取。',
        relationship_context: '',
        response_patterns: '',
        memories: '',
      },
    });
  }

  function rememberHumanInsight(contact, bundle) {
    if (!contact || !bundle) {
      return null;
    }
    const insight = humanProfileApi.createHumanProfileInsight(bundle);
    const slugs = {};
    slugs[contact.slug] = true;
    slugs[getPermanentSlug(contact.slug)] = true;
    if (contact.baseSlug) {
      slugs[contact.baseSlug] = true;
      slugs[getPermanentSlug(contact.baseSlug)] = true;
    }
    Object.keys(slugs).forEach(function (slug) {
      profileInsightBySlug[slug] = insight;
    });
    bundle.humanInsight = insight;
    return insight;
  }

  function isContactDeleted(slug) {
    return contactPreferencesState.deletedSlugs.indexOf(String(slug || '')) >= 0;
  }

  function getContactRemark(slug) {
    return contactPreferencesState.remarksBySlug[String(slug || '')] || '';
  }

  function persistContactPreferences() {
    storageApi.saveContactPreferences(contactPreferencesState);
  }

  function setContactRemark(slug, value) {
    const nextRemarks = { ...contactPreferencesState.remarksBySlug };
    const clean = String(value || '').trim();
    if (clean) {
      nextRemarks[String(slug || '')] = clean;
    } else {
      delete nextRemarks[String(slug || '')];
    }
    contactPreferencesState = {
      ...contactPreferencesState,
      remarksBySlug: nextRemarks,
    };
    persistContactPreferences();
  }

  function deleteContact(slug) {
    const sourceSlug = String(slug || '');
    const relatedSlugs = storageApi.isPermanentSlug(sourceSlug)
      ? [sourceSlug]
      : [sourceSlug, storageApi.toPermanentSlug(sourceSlug)];
    const deletedLookup = {};
    contactPreferencesState.deletedSlugs.forEach(function (item) {
      deletedLookup[item] = true;
    });
    relatedSlugs.forEach(function (item) {
      deletedLookup[item] = true;
      delete baseMessages[item];
      delete scheduledBySlug[item];
      delete proactiveBySlug[item];
      delete appearanceState.contactAvatarUrls[item];
    });
    const nextRemarks = { ...contactPreferencesState.remarksBySlug };
    relatedSlugs.forEach(function (item) {
      delete nextRemarks[item];
    });
    contactPreferencesState = {
      remarksBySlug: nextRemarks,
      deletedSlugs: Object.keys(deletedLookup),
    };
    persistContactPreferences();
    persistAppearance();
    persistChatPersistence();
    scheduleProactiveChat();
  }

  function persistChatPersistence() {
    const permanentMessages = {};
    Object.keys(baseMessages).forEach(function (slug) {
      if (storageApi.isPermanentSlug(slug)) {
        permanentMessages[slug] = storageApi.sanitizeMessagesForPersistence(baseMessages[slug]);
      }
    });

    storageApi.saveChatPersistence({
      enabled: chatRetentionEnabled,
      doNotDisturbEnabled: doNotDisturbEnabled,
      proactive: storageApi.normalizeProactiveSettings(null),
      proactiveBySlug: proactiveBySlug,
      messages: permanentMessages,
      scheduledBySlug: storageApi.sanitizeScheduledMessagesForPersistence
        ? storageApi.sanitizeScheduledMessagesForPersistence(scheduledBySlug)
        : scheduledBySlug,
    });
  }

  function persistQueueIfPermanent(slug) {
    if (storageApi.isPermanentSlug(slug)) {
      persistChatPersistence();
    }
  }

  function buildContacts() {
    let contacts = window.ExProfileContactRegistry.mergeHostProfiles(
      baseContacts,
      hostProfilesState.builtin,
      hostProfilesState.imported
    );

    contacts = contacts.filter(function (contact) {
      return !isContactDeleted(contact.slug);
    });

    contacts = contacts.map(function (contact) {
      const baseSlug = contact.baseSlug || contact.slug;
      const permanentSlug = storageApi.toPermanentSlug(baseSlug);
      const permanentQueue = baseMessages[permanentSlug] || [];
      const baseRemark = getContactRemark(baseSlug);
      const permanentRemark = getContactRemark(permanentSlug);
      return {
        ...contact,
        slug: permanentSlug,
        displayName: permanentRemark || baseRemark || contact.displayName,
        source: 'permanent',
        preview: contactPreviewApi.getContactPreview(permanentQueue, contact.preview || '永久保留聊天'),
        time: permanentQueue.length ? '已保存' : contact.time,
        baseSlug: baseSlug,
      };
    });

    return contacts.filter(function (contact) {
      return !isContactDeleted(contact.slug);
    }).map(function (contact) {
      const remark = getContactRemark(contact.slug) || getContactRemark(contact.baseSlug);
      return {
        ...contact,
        originalDisplayName: contact.originalDisplayName || contact.displayName,
        displayName: remark || contact.displayName,
        remark: remark,
        avatarUrl: appearanceState.contactAvatarUrls[contact.slug] || appearanceState.contactAvatarUrls[contact.baseSlug] || contact.avatarUrl || '',
        proactiveStatus: getProactiveStatusForSlug(contact.slug),
        humanInsight: profileInsightBySlug[contact.slug] || profileInsightBySlug[getPermanentSlug(contact.slug)] || getFallbackHumanInsight(contact),
      };
    });
  }

  function buildMessagesForContact(contact) {
    const userAvatarUrl = getUserAvatarUrl();
    const contactAvatarUrl = (contact && contact.avatarUrl) || '';
    const queue = getMessageQueue(contact.slug);

    return queue.map(function (message) {
      if (message.kind !== 'message') {
        return message;
      }

      if (message.role === 'user') {
        return { ...message, avatarUrl: message.avatarUrl || userAvatarUrl };
      }

      if (message.role === 'assistant') {
        return { ...message, avatarUrl: message.avatarUrl || contactAvatarUrl };
      }

      return { ...message };
    });
  }

  function persistMoments() {
    if (storageApi.saveMoments) {
      storageApi.saveMoments(momentsState);
    }
  }

  function formatMomentTime(timestamp) {
    const value = Number(timestamp || 0);
    if (!value) {
      return '刚刚';
    }
    const delta = Math.max(0, Date.now() - value);
    if (delta < 60 * 1000) {
      return '刚刚';
    }
    if (delta < 60 * 60 * 1000) {
      return Math.max(1, Math.round(delta / 60000)) + '分钟前';
    }
    if (delta < 24 * 60 * 60 * 1000) {
      return Math.max(1, Math.round(delta / (60 * 60 * 1000))) + '小时前';
    }
    const date = new Date(value);
    return (date.getMonth() + 1) + '月' + date.getDate() + '日';
  }

  function buildMomentsFeed(contacts) {
    const store = window.ExProfileMomentsStore;
    const feed = store && typeof store.getMomentFeed === 'function'
      ? store.getMomentFeed(momentsState)
      : [];
    const contactBySlug = {};
    (Array.isArray(contacts) ? contacts : []).forEach(function (contact) {
      contactBySlug[contact.slug] = contact;
    });
    return feed.map(function (post) {
      const contact = contactBySlug[post.contactSlug] || {};
      return {
        ...post,
        displayName: post.displayName || contact.displayName || '',
        avatarUrl: post.avatarUrl || contact.avatarUrl || '',
        createdAtLabel: formatMomentTime(post.createdAt),
      };
    });
  }

  function ensureMomentsFreshForContacts(contacts) {
    const engine = window.ExProfileMomentsEngine;
    if (!engine || typeof engine.ensureMomentsFresh !== 'function') {
      return;
    }
    const nextState = engine.ensureMomentsFresh(momentsState, contacts, { nowMs: Date.now() });
    if (nextState && nextState.changed) {
      momentsState = {
        activeTab: nextState.activeTab,
        postsBySlug: nextState.postsBySlug,
        nextPostAtBySlug: nextState.nextPostAtBySlug,
      };
      persistMoments();
    }
  }

  function findMomentPostById(postId, contacts) {
    const feed = buildMomentsFeed(contacts || buildContacts());
    return feed.find(function (post) {
      return post.id === postId;
    }) || null;
  }

  function syncSelectedContact(contacts) {
    if (!contacts.length) {
      selectedAvatarContactSlug = '';
      return;
    }

    if (!contacts.some(function (contact) { return contact.slug === selectedAvatarContactSlug; })) {
      selectedAvatarContactSlug = contacts[0].slug;
    }
  }

  function renderView(route) {
    const contacts = buildContacts();
    syncSelectedContact(contacts);

    if (route.view === 'chat-thread') {
      const contact = contacts.find(function (item) { return item.slug === route.slug; });
      if (!contact) {
        return window.ExProfileChatListView.renderChatListView({ contacts: contacts });
      }
      return window.ExProfileChatThreadView.renderChatThreadView({
        contact: contact,
        messages: contact ? buildMessagesForContact(contact) : [],
        composerText: composerDraftBySlug[route.slug] || '',
        isTyping: Boolean(pendingReplyBySlug[route.slug] || pendingTypingMessageBySlug[route.slug]),
        proactiveSettings: getProactiveSettingsForSlug(route.slug),
      });
    }

    if (route.view === 'contact-settings') {
      const contact = contacts.find(function (item) { return item.slug === route.slug; });
      if (!contact) {
        return window.ExProfileChatListView.renderChatListView({ contacts: contacts });
      }
      return window.ExProfileContactSettingsView.renderContactSettingsView({
        contact: contact,
        remark: contact ? getContactRemark(contact.slug) : '',
        proactiveSettings: getProactiveSettingsForSlug(route.slug),
        proactiveStatus: getProactiveStatusForSlug(route.slug),
        proactiveDiagnostics: getProactiveDiagnosticsForContact(contact, contacts),
        avatarStatus: contactAvatarStatusBySlug[route.slug] || '',
      });
    }

    if (route.tab === 'wechat') {
      return window.ExProfileChatListView.renderChatListView({
        contacts: contacts,
        searchOpen: contactSearchOpen,
        searchQuery: contactSearchQuery,
      });
    }

    if (route.tab === 'contacts') {
      return window.ExProfileContactsView.renderContactsView({ contacts: contacts });
    }

    if (route.tab === 'discover') {
      return window.ExProfileDiscoverView.renderDiscoverView({
        contacts: contacts,
        activeTab: momentsState.activeTab,
        momentsFeed: buildMomentsFeed(contacts),
        openCommentPostId: openMomentCommentPostId,
        commentDraftByPostId: momentCommentDraftByPostId,
      });
    }

    if (route.tab === 'me') {
      const selectedContact = contacts.find(function (contact) {
        return contact.slug === selectedAvatarContactSlug;
      }) || contacts[0] || null;
      return window.ExProfileMeView.renderMeView({
        contacts: contacts,
        settings: settingsState,
        settingsStatus: settingsStatus,
        chatRetentionEnabled: chatRetentionEnabled,
        doNotDisturbEnabled: doNotDisturbEnabled,
        userAvatarUrl: getUserAvatarUrl(),
        selectedContactSlug: selectedContact ? selectedContact.slug : '',
        selectedContactAvatarUrl: selectedContact ? selectedContact.avatarUrl : '',
      });
    }

    return '';
  }

  function setActiveTab(tab) {
    document.querySelectorAll('.tabbar-button').forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.tab === tab);
    });
  }

  function setShellChromeVisible(route) {
    const visible = window.ExProfileAppRouter.shouldShowMainNav(route);
    const tabbar = document.querySelector('.tabbar');
    const indicator = document.querySelector('.home-indicator');
    tabbar.classList.toggle('is-hidden', !visible);
    indicator.classList.toggle('is-hidden', !visible);
  }

  function captureThreadScrollState(route) {
    const screen = document.getElementById('screen');
    const threadMessages = screen ? screen.querySelector('[data-role="thread-messages"]') : null;

    if (!threadMessages || route.view !== 'chat-thread') {
      return { shouldStick: true, scrollTop: 0 };
    }

    const distanceFromBottom = threadMessages.scrollHeight - threadMessages.scrollTop - threadMessages.clientHeight;
    return {
      shouldStick: distanceFromBottom < 96,
      scrollTop: threadMessages.scrollTop,
    };
  }

  function syncAppViewportHeight() {
    const height = window.innerHeight || (window.visualViewport && window.visualViewport.height);
    if (height) {
      document.documentElement.style.setProperty('--app-height', Math.round(height) + 'px');
    }
  }

  function keepPageScrollLocked() {
    const scrollingElement = document.scrollingElement || document.documentElement;
    if (scrollingElement) {
      scrollingElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }
  }

  function waitForPaint() {
    return new Promise(function (resolve) {
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(resolve);
      });
    });
  }

  function syncThreadViewport(route, scrollState, options) {
    const opts = options || {};
    const screen = document.getElementById('screen');
    screen.classList.toggle('screen-thread', route.view === 'chat-thread');

    if (route.view !== 'chat-thread') {
      return;
    }

    if (threadViewportSyncFrameId && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(threadViewportSyncFrameId);
    }

    threadViewportSyncFrameId = window.requestAnimationFrame(function () {
      threadViewportSyncFrameId = 0;
      const threadMessages = screen.querySelector('[data-role="thread-messages"]');
      if (threadMessages) {
        const shouldStick = opts.forceThreadBottom || !scrollState || scrollState.shouldStick;
        if (shouldStick) {
          threadMessages.scrollTop = threadMessages.scrollHeight;
        } else {
          const maxScrollTop = Math.max(0, threadMessages.scrollHeight - threadMessages.clientHeight);
          threadMessages.scrollTop = Math.min(scrollState.scrollTop, maxScrollTop);
        }
      }
      keepPageScrollLocked();
    });
  }

  function refreshProactiveStatusLabels() {
    document.querySelectorAll('[data-role="proactive-countdown"]').forEach(function (node) {
      const slug = node.getAttribute('data-slug') || '';
      const status = getProactiveStatusForSlug(slug);
      node.textContent = status.text || '';
      node.classList.toggle('chat-proactive-status-active', status.tone === 'active');
      node.classList.toggle('chat-proactive-status-blocked', status.tone === 'blocked');
      const card = node.closest('.proactive-status-card');
      if (card) {
        card.classList.toggle('proactive-status-card-active', status.tone === 'active');
        card.classList.toggle('proactive-status-card-blocked', status.tone === 'blocked');
      }
    });
    refreshProactiveDiagnosticsPanels();
  }

  function refreshProactiveDiagnosticsPanels() {
    if (!window.ExProfileContactSettingsView || typeof window.ExProfileContactSettingsView.renderProactiveDiagnostics !== 'function') {
      return;
    }
    const panels = Array.from(document.querySelectorAll('[data-role="proactive-diagnostics-panel"]'));
    if (!panels.length) {
      return;
    }
    const contacts = buildContacts();
    panels.forEach(function (panel) {
      const slug = panel.getAttribute('data-slug') || '';
      const contact = contacts.find(function (item) { return item.slug === slug; });
      if (!contact) {
        return;
      }
      panel.outerHTML = window.ExProfileContactSettingsView.renderProactiveDiagnostics(
        contact,
        getProactiveDiagnosticsForContact(contact, contacts)
      );
    });
  }

  function renderStableChatThreadUpdate(route, options) {
    if (!route || route.view !== 'chat-thread' || !window.ExProfileChatThreadView) {
      return false;
    }
    const screen = document.getElementById('screen');
    const threadMessages = screen ? screen.querySelector('[data-role="thread-messages"]') : null;
    const title = screen ? screen.querySelector('.thread-title') : null;
    if (!threadMessages || !title || typeof window.ExProfileChatThreadView.renderChatThreadMessagesHtml !== 'function') {
      return false;
    }

    const contact = buildContacts().find(function (item) {
      return item.slug === route.slug;
    });
    if (!contact) {
      return false;
    }

    const scrollState = captureThreadScrollState(route);
    const isTyping = Boolean(pendingReplyBySlug[route.slug] || pendingTypingMessageBySlug[route.slug]);
    screen.classList.add('stable-thread-update');
    title.textContent = window.ExProfileChatThreadView.renderChatThreadTitle
      ? window.ExProfileChatThreadView.renderChatThreadTitle({ contact: contact, isTyping: isTyping })
      : contact.displayName;
    threadMessages.innerHTML = window.ExProfileChatThreadView.renderChatThreadMessagesHtml({
      messages: buildMessagesForContact(contact),
    });
    syncThreadViewport(route, scrollState, options);
    refreshProactiveStatusLabels();
    window.requestAnimationFrame(function () {
      screen.classList.remove('stable-thread-update');
    });
    return true;
  }

  function render(options) {
    const route = window.ExProfileAppRouter.resolveRoute(window.location.hash);
    const contacts = buildContacts();
    if (route.tab === 'discover') {
      ensureMomentsFreshForContacts(contacts);
    }
    if (options && options.preferStableThreadUpdate && route.view === 'chat-thread') {
      if (renderStableChatThreadUpdate(route, options)) {
        return;
      }
    }
    if (
      window.ExProfileRenderGuard &&
      window.ExProfileRenderGuard.shouldDeferRenderForComposer(document, route, options)
    ) {
      if (renderStableChatThreadUpdate(route, options)) {
        return;
      }
      deferredRenderOptions = {
        ...(options || {}),
        deferIfComposerFocused: false,
      };
      return;
    }
    const screen = document.getElementById('screen');
    const scrollState = captureThreadScrollState(route);
    const composerState = window.ExProfileComposerState
      ? window.ExProfileComposerState.captureComposerState(document, route)
      : { focused: false };
    setActiveTab(route.tab);
    setShellChromeVisible(route);
    screen.innerHTML = renderView(route);
    syncThreadViewport(route, scrollState, options);
    if (window.ExProfileComposerState) {
      window.ExProfileComposerState.restoreComposerState(document, route, composerState);
    }
    refreshProactiveStatusLabels();
  }

  function flushDeferredRender() {
    if (!deferredRenderOptions) {
      return;
    }
    const options = deferredRenderOptions;
    deferredRenderOptions = null;
    render(options);
  }

  function persistAppearance() {
    storageApi.saveAppearance(appearanceState);
  }

  function setContactAvatarUrl(slug, dataUrl) {
    const sourceSlug = String(slug || '');
    const relatedSlugs = {};
    if (sourceSlug) {
      relatedSlugs[sourceSlug] = true;
      relatedSlugs[getPermanentSlug(sourceSlug)] = true;
      if (storageApi.toTemporarySlug) {
        relatedSlugs[storageApi.toTemporarySlug(sourceSlug)] = true;
      }
    }
    const nextAvatarUrls = { ...appearanceState.contactAvatarUrls };
    Object.keys(relatedSlugs).forEach(function (item) {
      if (item) {
        nextAvatarUrls[item] = dataUrl;
      }
    });
    appearanceState = {
      ...appearanceState,
      contactAvatarUrls: nextAvatarUrls,
    };
  }

  function openInput(role) {
    const input = document.querySelector('[data-role="' + role + '"]');
    if (input) {
      input.click();
    }
  }

  function formatFileSize(bytes) {
    const size = Number(bytes || 0);
    if (size >= 1024 * 1024) {
      return (size / (1024 * 1024)).toFixed(1) + ' MB';
    }
    if (size >= 1024) {
      return Math.round(size / 1024) + ' KB';
    }
    return size + ' B';
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      if (typeof FileReader === 'undefined') {
        reject(new Error('FileReader unavailable'));
        return;
      }

      const reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ''));
      };
      reader.onerror = function () {
        reject(reader.error || new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    });
  }

  function collectSettingsFromDom() {
    return normalizeSettings({
      baseUrl: (document.querySelector('[data-role="settings-base-url"]') || {}).value || '',
      apiKey: (document.querySelector('[data-role="settings-api-key"]') || {}).value || '',
      model: (document.querySelector('[data-role="settings-model"]') || {}).value || '',
    });
  }

  async function persistSettingsFromDom() {
    settingsState = collectSettingsFromDom();
    await androidHost.saveSettings(settingsState);
    scheduleProactiveChat();
    settingsStatus = '已保存配置';
  }

  async function hydrateHostState() {
    settingsState = normalizeSettings(await androidHost.loadSettings());
    settingsStatus = '';
    hostProfilesState = {
      builtin: await androidHost.listBuiltinProfiles(),
      imported: await androidHost.listImportedProfiles(),
    };
    render();
    scheduleAllScheduledMessages();
    scheduleProactiveChat();
    hydrateProfileInsights().catch(function () {
      return null;
    });
  }

  async function handleAvatarInputChange(input, target) {
    if (!input.files || !input.files[0]) {
      return;
    }

    const dataUrl = await readFileAsDataUrl(input.files[0]);
    if (target === 'user') {
      appearanceState = {
        ...appearanceState,
        userAvatarUrl: dataUrl,
      };
    } else {
      if (!selectedAvatarContactSlug) {
        input.value = '';
        return;
      }

      setContactAvatarUrl(selectedAvatarContactSlug, dataUrl);
      const avatarStatus = { ...contactAvatarStatusBySlug };
      avatarStatus[selectedAvatarContactSlug] = '头像已保存';
      avatarStatus[getPermanentSlug(selectedAvatarContactSlug)] = '头像已保存';
      if (storageApi.toTemporarySlug) {
        avatarStatus[storageApi.toTemporarySlug(selectedAvatarContactSlug)] = '头像已保存';
      }
      contactAvatarStatusBySlug = {
        ...avatarStatus,
      };
    }

    persistAppearance();
    input.value = '';
    render();
  }

  async function importBrowserProfileFile(file) {
    const dataUrl = await readFileAsDataUrl(file);
    const profileBundle = await window.ExProfileLoader.loadProfileFromArchiveUrl(dataUrl);
    const idBase = (profileBundle.meta && (profileBundle.meta.slug || profileBundle.meta.name)) || file.name || profileBundle.displayName;
    const profileId = 'browser-' + String(idBase || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
    const importedProfile = {
      id: profileId,
      displayName: profileBundle.displayName,
      sourceType: 'imported',
      originalFileName: file.name || 'profile.zip',
      importedAt: new Date().toISOString(),
      location: dataUrl,
    };
    const imported = hostProfilesState.imported.filter(function (profile) {
      return profile.id !== importedProfile.id;
    });
    hostProfilesState = {
      ...hostProfilesState,
      imported: [importedProfile].concat(imported),
    };
    settingsStatus = '已导入 ' + profileBundle.displayName;
  }

  function buildChatHistory(queue) {
    return queue
      .filter(function (message) {
        return (
          message.kind === 'message' &&
          !message.attachmentType &&
          typeof message.text === 'string' &&
          message.text.trim()
        );
      })
      .map(function (message) {
        return {
          role: message.role,
          content: message.text,
        };
      });
  }

  async function loadProfileBundleForContact(contact) {
    if (!contact || !contact.hostProfileLocation) {
      throw new Error('当前联系人还没有可用的 Profile');
    }

    const cacheKey = contact.hostProfileId || contact.slug;
    if (profileBundleCache[cacheKey]) {
      rememberHumanInsight(contact, profileBundleCache[cacheKey]);
      return profileBundleCache[cacheKey];
    }

    const bundle = await window.ExProfileLoader.loadProfileFromArchiveUrl(contact.hostProfileLocation);
    rememberHumanInsight(contact, bundle);
    profileBundleCache[cacheKey] = bundle;
    return bundle;
  }

  async function hydrateProfileInsights() {
    const contacts = buildContacts().filter(function (contact) {
      return contact && contact.hostProfileLocation;
    });
    for (const contact of contacts) {
      try {
        await loadProfileBundleForContact(contact);
      } catch (_error) {
        // Profile insight is decorative; chat loading will surface real profile errors later.
      }
    }
    render();
  }

  async function buildAssistantMessageFromProtocolItem(contact, bundle, item) {
    if (item.type === 'sticker') {
      const stickerUrl = item.md5
        ? await window.ExProfileLoader.resolveStickerUrl(bundle, item.md5)
        : '';
      if (!stickerUrl) {
        return {
          kind: 'message',
          role: 'assistant',
          text: '[表情]',
          stickerMd5: item.md5 || '',
          avatarUrl: (contact && contact.avatarUrl) || '',
        };
      }
      return {
        kind: 'message',
        role: 'assistant',
        text: '',
        stickerMd5: item.md5 || '',
        stickerUrl: stickerUrl,
        avatarUrl: (contact && contact.avatarUrl) || '',
      };
    }

    if (item.type === 'image') {
      return {
        kind: 'message',
        role: 'assistant',
        text: '',
        attachmentType: 'image',
        imageUrl: item.imageUrl,
        fileName: item.fileName || 'image',
        avatarUrl: (contact && contact.avatarUrl) || '',
      };
    }

    return {
      kind: 'message',
      role: 'assistant',
      text: item.text || '...',
      avatarUrl: (contact && contact.avatarUrl) || '',
    };
  }

  function wasStickerRecentlyUsed(contact, md5) {
    if (!contact || !md5) {
      return false;
    }
    const recent = getMessageQueue(contact.slug)
      .filter(function (message) {
        return message && message.role === 'assistant' && message.stickerMd5;
      })
      .slice(-6);
    return recent.some(function (message) {
      return message.stickerMd5 === md5;
    });
  }

  async function buildAssistantMessages(contact, bundle, rawAssistantText, meta) {
    const visibleText = window.ExProfileResponseNormalizer
      .normalizeAssistantText(rawAssistantText)
      .visibleText;
    const protocol = window.ExProfileMessageProtocol
      ? window.ExProfileMessageProtocol.parseAssistantProtocol(visibleText)
      : { messages: [{ type: 'text', text: visibleText || '...' }], scheduled: [] };
    const immediate = protocol.messages.length ? protocol.messages : [{ type: 'text', text: visibleText || '...' }];
    const messages = [];
    for (const item of immediate) {
      if (item.type === 'sticker' && wasStickerRecentlyUsed(contact, item.md5)) {
        continue;
      }
      const message = await buildAssistantMessageFromProtocolItem(contact, bundle, item);
      if (message) {
        if (meta && meta.origin) {
          message.origin = meta.origin;
          message.sentAt = meta.sentAt || Date.now();
        }
        messages.push(message);
      }
    }
    if (!messages.length) {
      messages.push({
        kind: 'message',
        role: 'assistant',
        text: '[表情]',
        avatarUrl: (contact && contact.avatarUrl) || '',
      });
    }
    return {
      messages: messages,
      scheduled: protocol.scheduled || [],
    };
  }

  function currentRoute() {
    return window.ExProfileAppRouter.resolveRoute(window.location.hash);
  }

  function createScheduledMessageId() {
    return 'scheduled-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 100000).toString(36);
  }

  function clearScheduledTimer(slug) {
    if (scheduledTimersBySlug[slug]) {
      window.clearTimeout(scheduledTimersBySlug[slug]);
      delete scheduledTimersBySlug[slug];
    }
  }

  function enqueueScheduledAssistantMessages(contact, bundle, scheduledItems) {
    if (!contact || !storageApi.isPermanentSlug(contact.slug) || !Array.isArray(scheduledItems) || !scheduledItems.length) {
      return;
    }
    const now = Date.now();
    const existing = scheduledBySlug[contact.slug] || [];
    scheduledBySlug = {
      ...scheduledBySlug,
      [contact.slug]: existing.concat(scheduledItems.map(function (item) {
        return {
          id: createScheduledMessageId(),
          dueAt: now + Math.max(1, Number(item.delaySeconds) || 1) * 1000,
          type: item.type,
          text: item.text || '',
          md5: item.md5 || '',
          imageUrl: item.imageUrl || '',
          fileName: item.fileName || '',
        };
      })),
    };
    persistChatPersistence();
    scheduleScheduledMessagesForSlug(contact.slug);
  }

  async function processDueScheduledMessages(slug) {
    const queue = getMessageQueue(slug);
    const dueAt = Date.now();
    const pending = scheduledBySlug[slug] || [];
    const dueItems = pending.filter(function (item) { return Number(item.dueAt) <= dueAt; });
    const futureItems = pending.filter(function (item) { return Number(item.dueAt) > dueAt; });
    if (!dueItems.length) {
      scheduleScheduledMessagesForSlug(slug);
      return;
    }

    scheduledBySlug = {
      ...scheduledBySlug,
      [slug]: futureItems,
    };
    if (!futureItems.length) {
      delete scheduledBySlug[slug];
    }

    const contact = findContactBySlug(slug);
    if (contact) {
      const bundle = await loadProfileBundleForContact(contact);
      for (const item of dueItems) {
        queue.push(await buildAssistantMessageFromProtocolItem(contact, bundle, item));
      }
    }
    persistQueueIfPermanent(slug);
    render({ forceThreadBottom: currentRoute().slug === slug, deferIfComposerFocused: true, preferStableThreadUpdate: currentRoute().slug === slug });
    scheduleScheduledMessagesForSlug(slug);
  }

  function scheduleScheduledMessagesForSlug(slug) {
    clearScheduledTimer(slug);
    const items = scheduledBySlug[slug] || [];
    if (!items.length) {
      return;
    }
    const nextDueAt = items.reduce(function (min, item) {
      const dueAt = Number(item.dueAt) || Date.now();
      return Math.min(min, dueAt);
    }, Number.MAX_SAFE_INTEGER);
    scheduledTimersBySlug[slug] = window.setTimeout(function () {
      processDueScheduledMessages(slug).catch(function () {
        scheduleScheduledMessagesForSlug(slug);
      });
    }, Math.max(0, nextDueAt - Date.now()));
  }

  function scheduleAllScheduledMessages() {
    Object.keys(scheduledBySlug || {}).forEach(scheduleScheduledMessagesForSlug);
  }

  function runScheduledMessageWatchdog() {
    Object.keys(scheduledBySlug || {}).forEach(function (slug) {
      const items = scheduledBySlug[slug] || [];
      if (!items.length) {
        return;
      }
      const nextDueAt = items.reduce(function (min, item) {
        return Math.min(min, Number(item.dueAt) || Date.now());
      }, Number.MAX_SAFE_INTEGER);
      if (Date.now() >= nextDueAt) {
        processDueScheduledMessages(slug).catch(function () {
          scheduleScheduledMessagesForSlug(slug);
        });
      }
    });
  }

  function removePendingMessage(queue, pendingMessageId) {
    const pendingIndex = queue.findIndex(function (item) {
      return item.id === pendingMessageId;
    });
    if (pendingIndex >= 0) {
      queue.splice(pendingIndex, 1);
    }
  }

  function ensureAssistantTypingPlaceholder(contact) {
    if (!contact) {
      return '';
    }
    const queue = getMessageQueue(contact.slug);
    const existingId = pendingTypingMessageBySlug[contact.slug];
    if (existingId && queue.some(function (item) { return item && item.id === existingId; })) {
      return existingId;
    }
    const pendingMessageId = 'pending-' + nextPendingMessageId++;
    pendingTypingMessageBySlug[contact.slug] = pendingMessageId;
    queue.push({
      id: pendingMessageId,
      kind: 'message',
      role: 'assistant',
      pending: true,
      text: '',
      avatarUrl: (contact && contact.avatarUrl) || '',
    });
    return pendingMessageId;
  }

  function removeAssistantTypingPlaceholder(slug, pendingMessageId) {
    const targetId = pendingMessageId || pendingTypingMessageBySlug[slug];
    if (!targetId) {
      return;
    }
    removePendingMessage(getMessageQueue(slug), targetId);
    if (pendingTypingMessageBySlug[slug] === targetId) {
      delete pendingTypingMessageBySlug[slug];
    }
  }

  function createUserMessageId() {
    return 'user-' + Date.now().toString(36) + '-' + nextUserMessageId++;
  }

  function clearUserMessageFailure(message) {
    if (!message) {
      return;
    }
    message.sendStatus = 'sent';
    delete message.errorText;
  }

  function markUserMessageSending(message) {
    if (!message) {
      return;
    }
    message.sendStatus = 'sending';
    delete message.errorText;
  }

  function markUserMessageFailed(message, error) {
    if (!message) {
      return;
    }
    message.sendStatus = 'failed';
    message.errorText = error && error.message ? error.message : '发送失败，请稍后重试';
  }

  function buildChatHistoryBeforeIndex(queue, index) {
    return buildChatHistory(queue.slice(0, Math.max(0, index)));
  }

  function findContactBySlug(slug) {
    return buildContacts().find(function (item) {
      return item.slug === slug;
    }) || null;
  }

  function getReplyBatcher() {
    return window.ExProfileReplyBatcher || {
      createReplyBatch: function () {
        return { firstAt: Date.now(), messageIds: [], timerId: null };
      },
      appendToReplyBatch: function (batch, messageId) {
        if (batch && batch.messageIds.indexOf(messageId) < 0) {
          batch.messageIds.push(messageId);
        }
      },
      getReplyDelayMs: function () {
        return 5000;
      },
      joinPendingUserMessages: function (messages) {
        return (messages || []).map(function (message) { return message.text; }).join('\n');
      },
    };
  }

  function cancelReplyBatch(slug) {
    const batch = pendingUserBatchBySlug[slug];
    if (batch && batch.timerId) {
      window.clearTimeout(batch.timerId);
    }
    delete pendingUserBatchBySlug[slug];
  }

  function scheduleUserReplyBatch(contact, userMessage) {
    if (!contact || !userMessage) {
      return;
    }

    const batcher = getReplyBatcher();
    const now = Date.now();
    let batch = pendingUserBatchBySlug[contact.slug];
    if (!batch) {
      batch = batcher.createReplyBatch(now);
      pendingUserBatchBySlug[contact.slug] = batch;
    }

    batcher.appendToReplyBatch(batch, userMessage.id);
    if (batch.timerId) {
      window.clearTimeout(batch.timerId);
    }

    const delay = batcher.getReplyDelayMs({
      messageCount: batch.messageIds.length,
      firstAt: batch.firstAt,
      now: now,
      random: Math.random,
    });
    batch.timerId = window.setTimeout(function () {
      flushUserReplyBatch(contact.slug).catch(function () {
        return null;
      });
    }, delay);
  }

  async function flushUserReplyBatch(slug) {
    const batch = pendingUserBatchBySlug[slug];
    if (!batch) {
      return;
    }

    if (pendingReplyBySlug[slug]) {
      batch.timerId = window.setTimeout(function () {
        flushUserReplyBatch(slug).catch(function () {
          return null;
        });
      }, 900);
      return;
    }

    delete pendingUserBatchBySlug[slug];
    const contact = findContactBySlug(slug);
    if (!contact) {
      return;
    }

    const queue = getMessageQueue(slug);
    const userMessages = batch.messageIds
      .map(function (messageId) {
        return queue.find(function (message) {
          return message && message.id === messageId && message.role === 'user';
        });
      })
      .filter(Boolean);

    if (!userMessages.length) {
      return;
    }

    const firstIndex = queue.findIndex(function (message) {
      return message && message.id === userMessages[0].id;
    });
    const history = buildChatHistoryBeforeIndex(queue, firstIndex);
    const combinedMessage = getReplyBatcher().joinPendingUserMessages(userMessages);
    await requestAssistantReply(contact, userMessages, history, combinedMessage);
  }

  function getProactiveTypingDelayMs() {
    return 900 + Math.floor(Math.random() * 500);
  }

  function waitMs(delayMs) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, delayMs);
    });
  }

  function scheduleProactiveChat() {
    if (proactiveTimerId) {
      window.clearTimeout(proactiveTimerId);
      proactiveTimerId = null;
    }

    if (
      doNotDisturbEnabled ||
      !hasEnabledProactiveContacts() ||
      !hasApiSettings()
    ) {
      proactiveNextRunAt = 0;
      proactiveTimerToken += 1;
      refreshProactiveStatusLabels();
      return;
    }

    const now = Date.now();
    proactiveNextRunBySlug = window.ExProfileProactiveContacts.ensureProactiveSchedule(
      buildContacts(),
      proactiveBySlug,
      proactiveNextRunBySlug,
      now
    );
    proactiveNextRunAt = window.ExProfileProactiveContacts.getNextProactiveDueAt(proactiveNextRunBySlug);
    if (!proactiveNextRunAt) {
      proactiveTimerToken += 1;
      refreshProactiveStatusLabels();
      return;
    }

    const delay = Math.max(0, proactiveNextRunAt - now);
    proactiveTimerToken += 1;
    const timerToken = proactiveTimerToken;
    refreshProactiveStatusLabels();
    proactiveTimerId = window.setTimeout(function () {
      if (timerToken !== proactiveTimerToken) {
        return;
      }
      runProactiveChat().catch(function () {
        scheduleProactiveChat();
      });
    }, delay);
  }

  function runProactiveWatchdog() {
    if (
      proactiveInFlight ||
      doNotDisturbEnabled ||
      !hasEnabledProactiveContacts() ||
      !hasApiSettings()
    ) {
      return;
    }

    if (!proactiveNextRunAt) {
      scheduleProactiveChat();
      return;
    }

    if (Date.now() >= proactiveNextRunAt) {
      proactiveTimerId = null;
      proactiveTimerToken += 1;
      runProactiveChat().catch(function () {
        scheduleProactiveChat();
      });
    }
  }

  function startProactiveWatchdog() {
    if (proactiveWatchdogId) {
      window.clearInterval(proactiveWatchdogId);
    }
    proactiveWatchdogId = window.setInterval(runProactiveWatchdog, 15000);
  }

  function runProactiveHeartbeat() {
    const now = Date.now();
    if (!proactiveHeartbeatLastTickAt || now - proactiveHeartbeatLastTickAt >= 1000) {
      proactiveHeartbeatLastTickAt = now;
      refreshProactiveStatusLabels();
      runProactiveWatchdog();
      runScheduledMessageWatchdog();
    }

    proactiveHeartbeatFrameId = window.requestAnimationFrame(runProactiveHeartbeat);
  }

  function startProactiveHeartbeat() {
    if (proactiveHeartbeatFrameId && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(proactiveHeartbeatFrameId);
    }
    proactiveHeartbeatLastTickAt = 0;
    if (typeof window.requestAnimationFrame === 'function') {
      proactiveHeartbeatFrameId = window.requestAnimationFrame(runProactiveHeartbeat);
      return;
    }
    window.setInterval(function () {
      refreshProactiveStatusLabels();
      runProactiveWatchdog();
      runScheduledMessageWatchdog();
    }, 1000);
  }

  function getProactiveTriggerLabel(trigger) {
    if (trigger === 'auto') {
      return '自动';
    }
    if (trigger === 'test') {
      return '测试';
    }
    return '手动';
  }

  function recordProactiveAttempt(slug, status, message, trigger) {
    proactiveLastAttemptBySlug[getPermanentSlug(slug)] = {
      status: String(status || ''),
      at: Date.now(),
      message: String(message || ''),
      trigger: String(trigger || 'manual'),
      triggerLabel: getProactiveTriggerLabel(trigger),
    };
  }

  async function deliverProactiveMessage(contact, options) {
    const runOptions = options || {};
    const errorPrefix = runOptions.errorPrefix || '主动测试失败：';
    const trigger = runOptions.trigger || 'manual';
    if (!contact) {
      return { attempted: false, delivered: false, reason: 'missing-contact', trigger: trigger };
    }

    if (pendingReplyBySlug[contact.slug]) {
      recordProactiveAttempt(contact.slug, '跳过', '当前有待回复对话', trigger);
      return { attempted: false, delivered: false, reason: 'pending-reply', trigger: trigger };
    }

    if (!hasApiSettings()) {
      recordProactiveAttempt(contact.slug, '失败', 'API 配置缺失', trigger);
      if (runOptions.showError) {
        const queue = getMessageQueue(contact.slug);
        queue.push({
          kind: 'system',
          text: errorPrefix + '请先在“我”页面保存 Base URL、API Key 和 Model',
        });
        persistQueueIfPermanent(contact.slug);
        render({ forceThreadBottom: currentRoute().slug === contact.slug, deferIfComposerFocused: true, preferStableThreadUpdate: currentRoute().slug === contact.slug });
      }
      return { attempted: false, delivered: false, reason: 'missing-api-settings', trigger: trigger };
    }

    proactiveInFlight = true;
    pendingReplyBySlug[contact.slug] = true;
    recordProactiveAttempt(contact.slug, '请求中', '', trigger);
    const queue = getMessageQueue(contact.slug);
    if (
      !runOptions.force &&
      !runOptions.allowQuietContinuation &&
      !window.ExProfileProactiveContacts.canSendProactiveContinuation(queue)
    ) {
      pendingReplyBySlug[contact.slug] = false;
      proactiveInFlight = false;
      recordProactiveAttempt(contact.slug, '跳过', '连续主动消息已达上限', trigger);
      return { attempted: false, delivered: false, reason: 'continuation-blocked', trigger: trigger };
    }
    const pendingMessageId = 'pending-' + nextPendingMessageId++;
    queue.push({
      id: pendingMessageId,
      kind: 'message',
      role: 'assistant',
      pending: true,
      text: '',
      avatarUrl: (contact && contact.avatarUrl) || '',
    });
    render({ forceThreadBottom: currentRoute().slug === contact.slug, deferIfComposerFocused: true, preferStableThreadUpdate: currentRoute().slug === contact.slug });

    try {
      if (!runOptions.skipTypingDelay) {
        await waitMs(getProactiveTypingDelayMs());
      }
      if (doNotDisturbEnabled && !runOptions.ignoreDoNotDisturb) {
        removePendingMessage(queue, pendingMessageId);
        recordProactiveAttempt(contact.slug, '跳过', '勿扰模式已开启', trigger);
        return { attempted: false, delivered: false, reason: 'do-not-disturb', trigger: trigger };
      }
      const profileBundle = await loadProfileBundleForContact(contact);
      const payload = window.ExProfileChatEngine.buildProactiveChatRequest({
        profile: profileBundle,
        history: buildChatHistory(queue),
        settings: {
          model: settingsState.model,
          temperature: 0.95,
        },
      });
      const responseJson = await window.ExProfileProviderClient.sendChatRequest(
        settingsState.baseUrl,
        settingsState.apiKey,
        payload
      );
      const rawAssistantText = window.ExProfileProviderClient.readAssistantText(responseJson);
      removeAssistantTypingPlaceholder(contact.slug, pendingMessageId);
      const assistantPayload = await buildAssistantMessages(contact, profileBundle, rawAssistantText, {
        origin: 'proactive',
        sentAt: Date.now(),
      });
      assistantPayload.messages.forEach(function (message) {
        queue.push(message);
      });
      enqueueScheduledAssistantMessages(contact, profileBundle, assistantPayload.scheduled);
      recordProactiveAttempt(contact.slug, '成功', assistantPayload.messages.length + '条消息', trigger);

      persistQueueIfPermanent(contact.slug);
      return {
        attempted: true,
        delivered: true,
        reason: 'success',
        trigger: trigger,
        messageCount: assistantPayload.messages.length,
      };
    } catch (error) {
      removeAssistantTypingPlaceholder(contact.slug, pendingMessageId);
      recordProactiveAttempt(
        contact.slug,
        '失败',
        error && error.message ? error.message : '未知错误',
        trigger
      );
      if (runOptions.showError) {
        queue.push({
          kind: 'system',
          text: errorPrefix + (error && error.message ? error.message : '请稍后重试'),
        });
        persistQueueIfPermanent(contact.slug);
      }
      return {
        attempted: true,
        delivered: false,
        reason: 'request-failed',
        trigger: trigger,
        error: error,
      };
    } finally {
      pendingReplyBySlug[contact.slug] = false;
      proactiveInFlight = false;
      render({ forceThreadBottom: currentRoute().slug === contact.slug, deferIfComposerFocused: true, preferStableThreadUpdate: currentRoute().slug === contact.slug });
    }
  }

  async function runProactiveChat() {
    proactiveTimerId = null;
    if (
      proactiveInFlight ||
      doNotDisturbEnabled ||
      !hasEnabledProactiveContacts() ||
      !settingsState.baseUrl ||
      !settingsState.apiKey ||
      !settingsState.model
    ) {
      scheduleProactiveChat();
      return;
    }

    const now = Date.now();
    const contacts = buildContacts();
    proactiveNextRunBySlug = window.ExProfileProactiveContacts.ensureProactiveSchedule(
      contacts,
      proactiveBySlug,
      proactiveNextRunBySlug,
      now
    );
    const contact = window.ExProfileProactiveContacts.chooseDueProactiveContact(
      contacts,
      proactiveBySlug,
      proactiveNextRunBySlug,
      now
    );
    if (!contact || pendingReplyBySlug[contact.slug]) {
      scheduleProactiveChat();
      return;
    }

    const proactiveResult = await deliverProactiveMessage(contact, {
      allowQuietContinuation: true,
      showError: true,
      errorPrefix: '主动失败：',
      trigger: 'auto',
    });
    if (proactiveResult && proactiveResult.attempted) {
      proactiveNextRunBySlug = window.ExProfileProactiveContacts.scheduleNextForContact(
        proactiveNextRunBySlug,
        proactiveBySlug,
        contact.slug,
        Date.now()
      );
    }
    scheduleProactiveChat();
  }

  async function requestAssistantReply(contact, userMessage, history, messageText) {
    const queue = getMessageQueue(contact.slug);
    const userMessages = Array.isArray(userMessage) ? userMessage : [userMessage];
    if (!settingsState.baseUrl || !settingsState.apiKey || !settingsState.model) {
      removeAssistantTypingPlaceholder(contact.slug);
      userMessages.forEach(function (message) {
        markUserMessageFailed(message, new Error('请先在“我”页面保存 Base URL、API Key 和 Model'));
      });
      persistQueueIfPermanent(contact.slug);
      render({ forceThreadBottom: true, deferIfComposerFocused: true, preferStableThreadUpdate: true });
      return;
    }

    pendingReplyBySlug[contact.slug] = true;
    userMessages.forEach(markUserMessageSending);
    const pendingMessageId = ensureAssistantTypingPlaceholder(contact);
    persistQueueIfPermanent(contact.slug);
    render({ forceThreadBottom: true, deferIfComposerFocused: true, preferStableThreadUpdate: true });
    await waitForPaint();

    try {
      const profileBundle = await loadProfileBundleForContact(contact);
      const payload = window.ExProfileChatEngine.buildChatRequest({
        profile: profileBundle,
        history: history,
        message: messageText || (userMessages[0] && userMessages[0].text) || '',
        settings: {
          model: settingsState.model,
          temperature: 0.9,
        },
      });
      const responseJson = await window.ExProfileProviderClient.sendChatRequest(
        settingsState.baseUrl,
        settingsState.apiKey,
        payload
      );
      const rawAssistantText = window.ExProfileProviderClient.readAssistantText(responseJson);
      removeAssistantTypingPlaceholder(contact.slug, pendingMessageId);
      userMessages.forEach(clearUserMessageFailure);
      const assistantPayload = await buildAssistantMessages(contact, profileBundle, rawAssistantText);
      assistantPayload.messages.forEach(function (message) {
        queue.push(message);
      });
      enqueueScheduledAssistantMessages(contact, profileBundle, assistantPayload.scheduled);
      persistQueueIfPermanent(contact.slug);
    } catch (error) {
      removeAssistantTypingPlaceholder(contact.slug, pendingMessageId);
      userMessages.forEach(function (message) {
        markUserMessageFailed(message, error);
      });
      persistQueueIfPermanent(contact.slug);
    } finally {
      pendingReplyBySlug[contact.slug] = false;
      render({ forceThreadBottom: true, deferIfComposerFocused: true, preferStableThreadUpdate: true });
    }
  }

  async function sendComposerMessage() {
    const route = window.ExProfileAppRouter.resolveRoute(window.location.hash);
    if (route.view !== 'chat-thread' || pendingReplyBySlug[route.slug]) {
      return;
    }

    const input = document.querySelector('[data-role="composer-input"]');
    if (!input) {
      return;
    }

    const message = String(input.value || '').trim();
    composerDraftBySlug[route.slug] = '';
    if (!message) {
      input.value = '';
      return;
    }

    const contacts = buildContacts();
    const contact = contacts.find(function (item) {
      return item.slug === route.slug;
    }) || contacts[0];
    if (!contact) {
      return;
    }

    const queue = getMessageQueue(contact.slug);

    const userMessage = {
      id: createUserMessageId(),
      kind: 'message',
      role: 'user',
      text: message,
      sendStatus: 'sent',
      avatarUrl: getUserAvatarUrl(),
    };
    queue.push(userMessage);
    persistQueueIfPermanent(contact.slug);
    input.value = '';
    render({ forceThreadBottom: true, preferStableThreadUpdate: true });

    scheduleUserReplyBatch(contact, userMessage);
  }

  async function retryFailedMessage(messageId) {
    const route = window.ExProfileAppRouter.resolveRoute(window.location.hash);
    if (route.view !== 'chat-thread' || pendingReplyBySlug[route.slug]) {
      return;
    }

    const contacts = buildContacts();
    const contact = contacts.find(function (item) {
      return item.slug === route.slug;
    }) || contacts[0];
    if (!contact) {
      return;
    }

    const queue = getMessageQueue(contact.slug);
    const messageIndex = queue.findIndex(function (item) {
      return item && item.id === messageId && item.role === 'user' && item.sendStatus === 'failed';
    });
    if (messageIndex < 0) {
      return;
    }

    const userMessage = queue[messageIndex];
    const history = buildChatHistoryBeforeIndex(queue, messageIndex);
    await requestAssistantReply(contact, userMessage, history);
  }

  async function testProactiveMessage(slug) {
    const contacts = buildContacts();
    const contact = contacts.find(function (item) {
      return item.slug === slug;
    });
    if (!contact) {
      return;
    }

    const currentSettings = getProactiveSettingsForSlug(contact.slug);
    setProactiveSettingsForSlug(contact.slug, {
      ...currentSettings,
      enabled: true,
    });
    chatRetentionEnabled = true;
    persistChatPersistence();
    window.location.hash = '#/wechat';
    await deliverProactiveMessage(contact, {
      force: true,
      showError: true,
      ignoreDoNotDisturb: true,
      trigger: 'test',
    });
    proactiveNextRunBySlug = window.ExProfileProactiveContacts.scheduleNextForContact(
      proactiveNextRunBySlug,
      proactiveBySlug,
      contact.slug,
      Date.now()
    );
    scheduleProactiveChat();
  }

  async function simulateAutoProactiveMessage(slug) {
    const targetSlug = getPermanentSlug(slug);
    const contacts = buildContacts();
    const contact = contacts.find(function (item) {
      return item.slug === targetSlug;
    });
    if (!contact) {
      return;
    }

    const currentSettings = getProactiveSettingsForSlug(contact.slug);
    setProactiveSettingsForSlug(contact.slug, {
      ...currentSettings,
      enabled: true,
    });
    const now = Date.now();
    proactiveNextRunBySlug = window.ExProfileProactiveContacts.ensureProactiveSchedule(
      contacts,
      proactiveBySlug,
      proactiveNextRunBySlug,
      now
    );
    Object.keys(proactiveNextRunBySlug).forEach(function (candidateSlug) {
      if (candidateSlug === contact.slug) {
        proactiveNextRunBySlug[candidateSlug] = now - 1;
      } else if (Number(proactiveNextRunBySlug[candidateSlug] || 0) <= now) {
        proactiveNextRunBySlug[candidateSlug] = now + 30000;
      }
    });
    proactiveNextRunAt = now - 1;
    await runProactiveChat();
  }

  function clearConversationMemory(slug) {
    const targetSlug = String(slug || '');
    if (!targetSlug) {
      return;
    }
    cancelReplyBatch(targetSlug);
    clearScheduledTimer(targetSlug);
    delete scheduledBySlug[targetSlug];
    baseMessages[targetSlug] = [];
    persistQueueIfPermanent(targetSlug);
    window.location.hash = '#/chat/' + encodeURIComponent(targetSlug);
    render({ forceThreadBottom: true, preferStableThreadUpdate: true });
  }

  function setDiscoverTab(tab) {
    if (!window.ExProfileMomentsStore) {
      return;
    }
    momentsState = window.ExProfileMomentsStore.setDiscoverTab(momentsState, tab);
    persistMoments();
    render();
  }

  function toggleMomentLike(postId) {
    if (!window.ExProfileMomentsStore) {
      return;
    }
    momentsState = window.ExProfileMomentsStore.toggleMomentLike(momentsState, postId);
    persistMoments();
    render();
  }

  function deleteMomentComment(postId, commentId) {
    if (!window.ExProfileMomentsStore) {
      return;
    }
    momentsState = window.ExProfileMomentsStore.removeMomentComment(momentsState, postId, commentId);
    persistMoments();
    render();
  }

  function scheduleMomentCommentReply(post, commentText) {
    const contacts = buildContacts();
    const contact = contacts.find(function (item) {
      return item.slug === post.contactSlug;
    });
    if (!contact || !window.ExProfileMomentsEngine) {
      return;
    }
    if (momentReplyTimersByPostId[post.id]) {
      window.clearTimeout(momentReplyTimersByPostId[post.id]);
    }
    momentReplyTimersByPostId[post.id] = window.setTimeout(function () {
      delete momentReplyTimersByPostId[post.id];
      momentsState = window.ExProfileMomentsStore.addMomentComment(
        momentsState,
        post.id,
        window.ExProfileMomentsEngine.createMomentCommentReply(contact, post, commentText, Date.now())
      );
      persistMoments();
      if (currentRoute().tab === 'discover') {
        render();
      }
    }, 900 + Math.floor(Math.random() * 900));
  }

  function submitMomentComment(postId) {
    if (!window.ExProfileMomentsStore) {
      return;
    }
    const text = String(momentCommentDraftByPostId[postId] || '').trim();
    if (!text) {
      return;
    }
    const post = findMomentPostById(postId);
    if (!post) {
      return;
    }
    momentsState = window.ExProfileMomentsStore.addMomentComment(momentsState, postId, {
      id: 'comment-' + Date.now().toString(36),
      authorRole: 'user',
      text: text,
      createdAt: Date.now(),
    });
    momentCommentDraftByPostId = {
      ...momentCommentDraftByPostId,
      [postId]: '',
    };
    openMomentCommentPostId = '';
    persistMoments();
    render();
    scheduleMomentCommentReply(post, text);
  }

  function bindEvents() {
    document.querySelectorAll('.tabbar-button').forEach(function (button) {
      button.addEventListener('click', function () {
        const tab = button.dataset.tab;
        window.location.hash = tab === 'wechat' ? '#/wechat' : '#/' + tab;
      });
    });

    window.addEventListener('hashchange', render);
    window.addEventListener('resize', function () {
      syncAppViewportHeight();
      keepPageScrollLocked();
      const route = window.ExProfileAppRouter.resolveRoute(window.location.hash);
      syncThreadViewport(route, captureThreadScrollState(route), { forceThreadBottom: false });
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () {
        syncAppViewportHeight();
        keepPageScrollLocked();
      });
      window.visualViewport.addEventListener('scroll', keepPageScrollLocked);
    }
    window.addEventListener('android-profiles-changed', function () {
      hydrateHostState().catch(function () {
        return null;
      });
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && proactiveNextRunAt && Date.now() >= proactiveNextRunAt) {
        proactiveTimerId = null;
        proactiveTimerToken += 1;
        runProactiveChat().catch(function () {
          scheduleProactiveChat();
        });
        return;
      }
      scheduleProactiveChat();
    });

    document.addEventListener('focusin', function (event) {
      const target = event.target;
      if (target && target.matches('[data-role="composer-input"]')) {
        window.setTimeout(function () {
          keepPageScrollLocked();
          const threadMessages = document.querySelector('[data-role="thread-messages"]');
          if (threadMessages) {
            threadMessages.scrollTop = threadMessages.scrollHeight;
          }
        }, 80);
      }
    });

    document.addEventListener('click', async function (event) {
      const discoverTabTrigger = event.target.closest('[data-role="discover-tab"]');
      if (discoverTabTrigger) {
        setDiscoverTab(discoverTabTrigger.dataset.tab || 'moments');
        return;
      }

      const toggleMomentLikeTrigger = event.target.closest('[data-action="toggle-moment-like"]');
      if (toggleMomentLikeTrigger) {
        toggleMomentLike(toggleMomentLikeTrigger.dataset.postId || '');
        return;
      }

      const openMomentCommentTrigger = event.target.closest('[data-action="open-moment-comment"]');
      if (openMomentCommentTrigger) {
        const postId = openMomentCommentTrigger.dataset.postId || '';
        openMomentCommentPostId = openMomentCommentPostId === postId ? '' : postId;
        render();
        const input = document.querySelector('[data-role="moment-comment-input"][data-post-id="' + postId + '"]');
        if (input) {
          input.focus();
        }
        return;
      }

      const sendMomentCommentTrigger = event.target.closest('[data-action="send-moment-comment"]');
      if (sendMomentCommentTrigger) {
        submitMomentComment(sendMomentCommentTrigger.dataset.postId || '');
        return;
      }

      const deleteMomentCommentTrigger = event.target.closest('[data-action="delete-moment-comment"]');
      if (deleteMomentCommentTrigger) {
        deleteMomentComment(deleteMomentCommentTrigger.dataset.postId || '', deleteMomentCommentTrigger.dataset.commentId || '');
        return;
      }

      const sendTrigger = event.target.closest('[data-role="composer-send-button"]');
      if (sendTrigger) {
        await sendComposerMessage();
        return;
      }

      const attachTrigger = event.target.closest('[data-action="attach"]');
      if (attachTrigger) {
        openInput('composer-file-input');
        return;
      }

      const retryTrigger = event.target.closest('[data-action="retry-message"]');
      if (retryTrigger) {
        await retryFailedMessage(retryTrigger.dataset.messageId || '');
        return;
      }

      const testProactiveTrigger = event.target.closest('[data-role="test-proactive-button"]');
      if (testProactiveTrigger) {
        const route = window.ExProfileAppRouter.resolveRoute(window.location.hash);
        if (route.view === 'contact-settings') {
          await testProactiveMessage(route.slug);
        }
        return;
      }

      const simulateAutoProactiveTrigger = event.target.closest('[data-role="simulate-auto-proactive-button"]');
      if (simulateAutoProactiveTrigger) {
        const route = window.ExProfileAppRouter.resolveRoute(window.location.hash);
        if (route.view === 'contact-settings') {
          await simulateAutoProactiveMessage(route.slug);
        }
        return;
      }

      const clearMemoryTrigger = event.target.closest('[data-role="clear-conversation-memory-button"]');
      if (clearMemoryTrigger) {
        const route = window.ExProfileAppRouter.resolveRoute(window.location.hash);
        if (
          route.view === 'contact-settings' &&
          window.confirm('删除后，这个联系人会从新的对话重新开始。确定删除本段聊天记忆吗？')
        ) {
          clearConversationMemory(route.slug);
        }
        return;
      }

      const importProfileTrigger = event.target.closest('[data-role="import-profile-button"]');
      if (importProfileTrigger) {
        if (androidHost.isAndroid && androidHost.isAndroid()) {
          await androidHost.importProfileFromPicker();
          window.setTimeout(hydrateHostState, 800);
        } else {
          openInput('browser-profile-input');
        }
        return;
      }

      const searchToggle = event.target.closest('[data-role="contact-search-toggle"]');
      if (searchToggle) {
        contactSearchOpen = !contactSearchOpen;
        if (!contactSearchOpen) {
          contactSearchQuery = '';
        }
        render();
        const input = document.querySelector('[data-role="contact-search-input"]');
        if (input) {
          input.focus();
        }
        return;
      }

      const searchClear = event.target.closest('[data-role="contact-search-clear"]');
      if (searchClear) {
        contactSearchOpen = false;
        contactSearchQuery = '';
        render();
        return;
      }

      const saveSettingsTrigger = event.target.closest('[data-role="save-settings-button"]');
      if (saveSettingsTrigger) {
        await persistSettingsFromDom();
        render();
        return;
      }

      const deleteContactTrigger = event.target.closest('[data-role="delete-contact-button"]');
      if (deleteContactTrigger) {
        const route = window.ExProfileAppRouter.resolveRoute(window.location.hash);
        if (route.view === 'contact-settings') {
          deleteContact(route.slug);
          window.location.hash = '#/wechat';
        }
        return;
      }

      const trigger = event.target.closest('[data-route]');
      if (!trigger) {
        return;
      }
      window.location.hash = trigger.dataset.route.replace(/^#/, '');
    });

    document.addEventListener('keydown', function (event) {
      if (
        event.key === 'Enter' &&
        !event.shiftKey &&
        event.target &&
        event.target.matches('[data-role="moment-comment-input"]')
      ) {
        event.preventDefault();
        submitMomentComment(event.target.getAttribute('data-post-id') || '');
        return;
      }

      if (
        event.key === 'Enter' &&
        !event.shiftKey &&
        event.target &&
        event.target.matches('[data-role="composer-input"]')
      ) {
        event.preventDefault();
        sendComposerMessage().catch(function () {
          return null;
        });
      }
    });

    document.addEventListener('input', function (event) {
      const target = event.target;
      if (!target) {
        return;
      }

      if (
        target.matches('[data-role="settings-base-url"]') ||
        target.matches('[data-role="settings-api-key"]') ||
        target.matches('[data-role="settings-model"]')
      ) {
        settingsState = collectSettingsFromDom();
        settingsStatus = '';
        return;
      }

      if (target.matches('[data-role="composer-input"]')) {
        const route = window.ExProfileAppRouter.resolveRoute(window.location.hash);
        if (route.view === 'chat-thread') {
          composerDraftBySlug[route.slug] = String(target.value || '');
        }
      }

      if (target.matches('[data-role="contact-search-input"]')) {
        contactSearchQuery = String(target.value || '');
        render();
        const input = document.querySelector('[data-role="contact-search-input"]');
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }

      if (target.matches('[data-role="moment-comment-input"]')) {
        momentCommentDraftByPostId = {
          ...momentCommentDraftByPostId,
          [String(target.getAttribute('data-post-id') || '')]: String(target.value || ''),
        };
      }

      if (target.matches('[data-role="contact-remark-input"]')) {
        const route = window.ExProfileAppRouter.resolveRoute(window.location.hash);
        if (route.view === 'contact-settings') {
          setContactRemark(route.slug, target.value);
        }
      }
    });

    document.addEventListener('focusout', function (event) {
      const target = event.target;
      if (target && target.matches && target.matches('[data-role="composer-input"]')) {
        window.setTimeout(flushDeferredRender, 0);
      }
    });

    document.addEventListener('change', async function (event) {
      const target = event.target;

      if (target.matches('[data-role="contact-avatar-select"]')) {
        selectedAvatarContactSlug = target.value;
        render();
        return;
      }

      if (target.matches('[data-role="my-avatar-input"]')) {
        await handleAvatarInputChange(target, 'user');
        return;
      }

      if (target.matches('[data-role="contact-avatar-input"]')) {
        await handleAvatarInputChange(target, 'contact');
        return;
      }

      if (target.matches('[data-role="contact-settings-avatar-input"]')) {
        const route = window.ExProfileAppRouter.resolveRoute(window.location.hash);
        if (route.view === 'contact-settings') {
          selectedAvatarContactSlug = route.slug;
          await handleAvatarInputChange(target, 'contact');
        }
        return;
      }

      if (target.matches('[data-role="chat-retention-toggle"]')) {
        chatRetentionEnabled = Boolean(target.checked);
        persistChatPersistence();
        render();
        scheduleProactiveChat();
        return;
      }

      if (target.matches('[data-role="do-not-disturb-toggle"]')) {
        doNotDisturbEnabled = Boolean(target.checked);
        if (!doNotDisturbEnabled) {
          proactiveNextRunBySlug = {};
        }
        persistChatPersistence();
        render();
        scheduleProactiveChat();
        return;
      }

      if (target.matches('[data-role="contact-settings-proactive-toggle"]')) {
        const route = window.ExProfileAppRouter.resolveRoute(window.location.hash);
        if (route.view === 'contact-settings') {
          const currentSettings = getProactiveSettingsForSlug(route.slug);
          setProactiveSettingsForSlug(route.slug, {
            ...currentSettings,
            enabled: Boolean(target.checked),
          });
          if (target.checked) {
            chatRetentionEnabled = true;
          }
          resetProactiveScheduleForSlug(route.slug);
          persistChatPersistence();
          render();
          scheduleProactiveChat();
        }
        return;
      }

      if (target.matches('[data-role="contact-settings-proactive-frequency"]')) {
        const route = window.ExProfileAppRouter.resolveRoute(window.location.hash);
        if (route.view === 'contact-settings') {
          const currentSettings = getProactiveSettingsForSlug(route.slug);
          setProactiveSettingsForSlug(route.slug, {
            ...currentSettings,
            frequency: target.value,
          });
          if (currentSettings.enabled) {
            chatRetentionEnabled = true;
          }
          resetProactiveScheduleForSlug(route.slug);
          persistChatPersistence();
          render();
          scheduleProactiveChat();
        }
        return;
      }

      if (target.matches('[data-role="browser-profile-input"]')) {
        if (target.files && target.files[0]) {
          try {
            await importBrowserProfileFile(target.files[0]);
          } catch (error) {
            settingsStatus = error && error.message ? error.message : '导入失败';
          }
          target.value = '';
          render();
        }
        return;
      }

      if (target.matches('[data-role="proactive-chat-toggle"]')) {
        const route = window.ExProfileAppRouter.resolveRoute(window.location.hash);
        if (route.view === 'chat-thread') {
          setProactiveSettingsForSlug(route.slug, {
            ...getProactiveSettingsForSlug(route.slug),
            enabled: Boolean(target.checked),
          });
          chatRetentionEnabled = true;
          resetProactiveScheduleForSlug(route.slug);
          persistChatPersistence();
          render();
          scheduleProactiveChat();
        }
        return;
      }

      if (target.matches('[data-role="proactive-frequency-select"]')) {
        return;
      }

      if (!target.matches('[data-role="composer-file-input"]') || !target.files || target.files.length === 0) {
        return;
      }

      const route = window.ExProfileAppRouter.resolveRoute(window.location.hash);
      if (route.view !== 'chat-thread') {
        target.value = '';
        return;
      }

      const queue = getMessageQueue(route.slug);
      const userAvatarUrl = getUserAvatarUrl();

      Array.from(target.files).forEach(function (file) {
        const isImage = String(file.type || '').startsWith('image/');
        if (isImage) {
          queue.push({
            kind: 'message',
            role: 'user',
            attachmentType: 'image',
            imageUrl: URL.createObjectURL(file),
            fileName: file.name,
            avatarUrl: userAvatarUrl,
          });
          return;
        }

        queue.push({
          kind: 'message',
          role: 'user',
          attachmentType: 'file',
          fileName: file.name,
          fileSizeLabel: formatFileSize(file.size),
          avatarUrl: userAvatarUrl,
        });
      });

      target.value = '';
      persistQueueIfPermanent(route.slug);
      render();
    });
  }

  window.ExProfileAppStore.createInitialState();
  if (!window.location.hash) {
    window.location.hash = '#/wechat';
  }
  syncAppViewportHeight();
  bindEvents();
  startProactiveWatchdog();
  startProactiveHeartbeat();
  scheduleAllScheduledMessages();
  render();
  hydrateHostState().catch(function () {
    return null;
  });

  if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {
        return null;
      });
    });
  }
})();
