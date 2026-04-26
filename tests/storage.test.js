const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  loadAppearance,
  loadChatPersistence,
  loadMoments,
  saveAppearance,
  saveChatPersistence,
  saveMoments,
  toPermanentSlug,
  isPermanentSlug,
  sanitizeMessagesForPersistence,
  normalizeProactiveSettings,
  normalizeProactiveBySlug,
  loadContactPreferences,
  saveContactPreferences,
  saveProactiveRuntime,
  loadProactiveRuntime,
} = require(path.join(__dirname, '..', 'app', 'lib', 'storage.js'));

function createMemoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
  };
}

test('chat persistence round-trips enabled flag and permanent messages', () => {
  const previousStorage = global.localStorage;
  global.localStorage = createMemoryStorage();

  try {
    saveChatPersistence({
      enabled: true,
      proactiveBySlug: {
        'permanent-sample-contact': { enabled: true, frequency: 'frequent' },
      },
      messages: {
        'permanent-sample-contact': [
          { kind: 'message', role: 'user', text: 'hi', avatarUrl: 'blob:skip-me' },
          { kind: 'message', role: 'assistant', text: 'hello' },
        ],
      },
      scheduledBySlug: {},
    });

    assert.deepEqual(loadChatPersistence(), {
      enabled: true,
      doNotDisturbEnabled: false,
      proactive: { enabled: false, frequency: 'normal' },
      proactiveBySlug: {
        'permanent-sample-contact': { enabled: true, frequency: 'frequent' },
      },
      messages: {
        'permanent-sample-contact': [
          { kind: 'message', role: 'user', text: 'hi' },
          { kind: 'message', role: 'assistant', text: 'hello' },
        ],
      },
      scheduledBySlug: {},
    });
  } finally {
    global.localStorage = previousStorage;
  }
});

test('chat persistence round-trips do not disturb mode', () => {
  const previousStorage = global.localStorage;
  global.localStorage = createMemoryStorage();

  try {
    saveChatPersistence({
      enabled: true,
      doNotDisturbEnabled: true,
      proactiveBySlug: {},
      messages: {},
    });

    assert.equal(loadChatPersistence().doNotDisturbEnabled, true);
  } finally {
    global.localStorage = previousStorage;
  }
});

test('chat persistence round-trips scheduled assistant messages', () => {
  const previousStorage = global.localStorage;
  global.localStorage = createMemoryStorage();

  try {
    saveChatPersistence({
      enabled: true,
      scheduledBySlug: {
        'permanent-sample-contact': [
          { id: 's1', dueAt: 123456, type: 'text', text: 'later' },
          { id: 's2', dueAt: 123457, type: 'sticker', md5: 'abc123' },
        ],
      },
      messages: {},
    });

    assert.deepEqual(loadChatPersistence().scheduledBySlug, {
      'permanent-sample-contact': [
        { id: 's1', dueAt: 123456, type: 'text', text: 'later' },
        { id: 's2', dueAt: 123457, type: 'sticker', md5: 'abc123' },
      ],
    });
  } finally {
    global.localStorage = previousStorage;
  }
});

test('appearance persists through Android bridge when available', () => {
  const previousStorage = global.localStorage;
  const previousBridge = global.AndroidBridge;
  let savedPayload = '';
  global.localStorage = {
    getItem() {
      throw new Error('quota blocked');
    },
    setItem() {
      throw new Error('quota blocked');
    },
  };
  global.AndroidBridge = {
    saveAppearance(payload) {
      savedPayload = payload;
    },
    loadAppearance() {
      return savedPayload || '{}';
    },
  };

  try {
    saveAppearance({
      userAvatarUrl: 'data:image/png;base64,user',
      contactAvatarUrls: {
        'permanent-sample-contact': 'data:image/png;base64,contact',
      },
    });

    assert.match(savedPayload, /permanent-sample-contact/);
    assert.deepEqual(loadAppearance(), {
      userAvatarUrl: 'data:image/png;base64,user',
      contactAvatarUrls: {
        'permanent-sample-contact': 'data:image/png;base64,contact',
      },
    });
  } finally {
    global.localStorage = previousStorage;
    global.AndroidBridge = previousBridge;
  }
});

test('normalizeProactiveSettings clamps unknown values to defaults', () => {
  assert.deepEqual(normalizeProactiveSettings({ enabled: true, frequency: 'wild' }), {
    enabled: true,
    frequency: 'normal',
  });
  assert.deepEqual(normalizeProactiveSettings(null), {
    enabled: false,
    frequency: 'normal',
  });
});

test('normalizeProactiveBySlug migrates legacy temporary contact keys to permanent keys', () => {
  assert.deepEqual(normalizeProactiveBySlug({
    'sample-contact': { enabled: true, frequency: 'frequent' },
    'permanent-sample-contact-b': { enabled: true, frequency: 'gentle' },
  }), {
    'permanent-sample-contact': { enabled: true, frequency: 'frequent' },
    'permanent-sample-contact-b': { enabled: true, frequency: 'gentle' },
  });
});

test('permanent slug helpers keep temporary and permanent chats separated', () => {
  assert.equal(toPermanentSlug('sample-contact'), 'permanent-sample-contact');
  assert.equal(isPermanentSlug('permanent-sample-contact'), true);
  assert.equal(isPermanentSlug('sample-contact'), false);
});

test('sanitizeMessagesForPersistence drops pending messages and transient avatar urls', () => {
  const messages = sanitizeMessagesForPersistence([
    { id: 'pending-1', kind: 'message', role: 'assistant', pending: true, text: '' },
    { kind: 'message', role: 'user', text: 'keep', avatarUrl: 'blob:user' },
    { kind: 'message', role: 'assistant', attachmentType: 'image', imageUrl: 'https://example.com/a.jpg', fileName: 'a.jpg' },
    { kind: 'system', text: 'saved' },
  ]);

  assert.deepEqual(messages, [
    { kind: 'message', role: 'user', text: 'keep' },
    { kind: 'message', role: 'assistant', text: '', attachmentType: 'image', imageUrl: 'https://example.com/a.jpg', fileName: 'a.jpg' },
    { kind: 'system', text: 'saved' },
  ]);
});

test('sanitizeMessagesForPersistence drops old proactive image assets', () => {
  const messages = sanitizeMessagesForPersistence([
    { kind: 'message', role: 'assistant', attachmentType: 'image', imageUrl: './assets/proactive-images/a.jpg', fileName: 'a.jpg' },
    { kind: 'message', role: 'assistant', text: 'keep me' },
  ]);

  assert.deepEqual(messages, [
    { kind: 'message', role: 'assistant', text: 'keep me' },
  ]);
});

test('sanitizeMessagesForPersistence drops heavyweight data urls from stickers and images', () => {
  const messages = sanitizeMessagesForPersistence([
    {
      kind: 'message',
      role: 'assistant',
      text: '',
      stickerMd5: 'abc123',
      stickerUrl: 'data:image/gif;base64,' + 'x'.repeat(1024),
    },
    {
      kind: 'message',
      role: 'assistant',
      text: '',
      attachmentType: 'image',
      imageUrl: 'data:image/png;base64,' + 'x'.repeat(1024),
      fileName: 'huge.png',
    },
  ]);

  assert.deepEqual(messages, [
    { kind: 'message', role: 'assistant', text: '', stickerMd5: 'abc123' },
  ]);
});

test('chat persistence can use Android bridge when localStorage quota fails', () => {
  const previousStorage = global.localStorage;
  const previousBridge = global.AndroidBridge;
  let savedPayload = '';
  global.localStorage = {
    getItem() {
      throw new Error('quota blocked');
    },
    setItem() {
      throw new Error('quota blocked');
    },
  };
  global.AndroidBridge = {
    saveChatPersistence(payload) {
      savedPayload = payload;
    },
    loadChatPersistence() {
      return savedPayload || '{}';
    },
  };

  try {
    saveChatPersistence({
      enabled: true,
      messages: {
        'permanent-sample-contact': [{ kind: 'message', role: 'assistant', text: 'still here' }],
      },
    });

    assert.match(savedPayload, /permanent-sample-contact/);
    assert.deepEqual(loadChatPersistence().messages['permanent-sample-contact'], [
      { kind: 'message', role: 'assistant', text: 'still here' },
    ]);
  } finally {
    global.localStorage = previousStorage;
    global.AndroidBridge = previousBridge;
  }
});

test('chat persistence falls back to existing local data before native store has content', () => {
  const previousStorage = global.localStorage;
  const previousBridge = global.AndroidBridge;
  const local = createMemoryStorage();
  global.localStorage = local;
  local.setItem('wechatProfileChatPersistence', JSON.stringify({
    enabled: true,
    messages: {
      'permanent-sample-contact': [{ kind: 'message', role: 'assistant', text: 'old record' }],
    },
  }));
  global.AndroidBridge = {
    loadChatPersistence() {
      return '{}';
    },
  };

  try {
    assert.deepEqual(loadChatPersistence().messages['permanent-sample-contact'], [
      { kind: 'message', role: 'assistant', text: 'old record' },
    ]);
  } finally {
    global.localStorage = previousStorage;
    global.AndroidBridge = previousBridge;
  }
});

test('sanitizeMessagesForPersistence keeps failed user messages retryable', () => {
  const messages = sanitizeMessagesForPersistence([
    {
      id: 'user-1',
      kind: 'message',
      role: 'user',
      text: 'retry once',
      sendStatus: 'failed',
      errorText: '璇锋眰瓒呮椂',
      avatarUrl: 'blob:user',
    },
  ]);

  assert.deepEqual(messages, [
    {
      id: 'user-1',
      kind: 'message',
      role: 'user',
      text: 'retry once',
      sendStatus: 'failed',
      errorText: '璇锋眰瓒呮椂',
    },
  ]);
});

test('sanitizeMessagesForPersistence keeps proactive letter metadata', () => {
  const messages = sanitizeMessagesForPersistence([
    {
      kind: 'message',
      role: 'assistant',
      text: '杩樻病鐫★紵',
      origin: 'proactive',
      sentAt: 1709971260000,
    },
  ]);

  assert.deepEqual(messages, [
    {
      kind: 'message',
      role: 'assistant',
      text: '杩樻病鐫★紵',
      origin: 'proactive',
      sentAt: 1709971260000,
    },
  ]);
});

test('contact preferences persist remarks and deleted slugs', () => {
  const previousStorage = global.localStorage;
  global.localStorage = createMemoryStorage();

  try {
    saveContactPreferences({
      remarksBySlug: {
        'sample-contact': 'A',
        'permanent-sample-contact': '姘镐箙闃夸箼',
      },
      deletedSlugs: ['removed', 'permanent-removed'],
    });

    assert.deepEqual(loadContactPreferences(), {
      remarksBySlug: {
        'sample-contact': 'A',
        'permanent-sample-contact': '姘镐箙闃夸箼',
      },
      deletedSlugs: ['removed', 'permanent-removed'],
    });
  } finally {
    global.localStorage = previousStorage;
  }
});

test('moments persistence round-trips tabs posts and schedule metadata', () => {
  const previousStorage = global.localStorage;
  global.localStorage = createMemoryStorage();

  try {
    saveMoments({
      activeTab: 'memory',
      postsBySlug: {
        'permanent-sample-contact': [{
          id: 'moment-1',
          contactSlug: 'permanent-sample-contact',
          displayName: '',
          avatarUrl: '',
          text: '浠婂ぉ椋庢湁鐐瑰ぇ',
          intent: 'share',
          createdAt: 100,
          likedByUser: true,
          comments: [{ id: 'comment-1', authorRole: 'user', text: 'wear more', createdAt: 120 }],
        }],
      },
      nextPostAtBySlug: {
        'permanent-sample-contact': 1000,
      },
    });

    assert.deepEqual(loadMoments(), {
      activeTab: 'memory',
      postsBySlug: {
        'permanent-sample-contact': [{
          id: 'moment-1',
          contactSlug: 'permanent-sample-contact',
          text: '浠婂ぉ椋庢湁鐐瑰ぇ',
          intent: 'share',
          createdAt: 100,
          likedByUser: true,
          comments: [{ id: 'comment-1', authorRole: 'user', authorSlug: '', text: 'wear more', createdAt: 120 }],
        }],
      },
      nextPostAtBySlug: {
        'permanent-sample-contact': 1000,
      },
    });
  } finally {
    global.localStorage = previousStorage;
  }
});

test('proactive runtime state round-trips through storage', () => {
  const previousStorage = global.localStorage;
  global.localStorage = createMemoryStorage();

  try {
    saveProactiveRuntime({
      'permanent-a': {
        mode: 'waiting-user',
        intent: 'test-the-water',
        consecutiveAssistantCount: 2,
        lastUserAt: 100,
        lastAssistantAt: 200,
        lastProactiveAt: 200,
        nextContinuationAt: 450,
        cooldownUntil: 0,
        lastContinuationReason: '',
      },
    });

    const restored = loadProactiveRuntime();
    assert.equal(restored['permanent-a'].intent, 'test-the-water');
    assert.equal(restored['permanent-a'].nextContinuationAt, 450);
  } finally {
    global.localStorage = previousStorage;
  }
});
