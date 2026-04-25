const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createAndroidHostAdapter } = require(path.join(__dirname, '..', 'app', 'lib', 'android-host.js'));

function createMemoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
  };
}

test('android host adapter persists settings locally when bridge is unavailable', async () => {
  const previousStorage = global.localStorage;
  global.localStorage = createMemoryStorage();

  try {
    const host = createAndroidHostAdapter({});
    await host.saveSettings({
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test',
      model: 'deepseek-chat',
    });

    const settings = await host.loadSettings();
    assert.deepEqual(settings, {
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test',
      model: 'deepseek-chat',
    });
  } finally {
    global.localStorage = previousStorage;
  }
});

test('android host adapter still saves through bridge when localStorage fails', async () => {
  const previousStorage = global.localStorage;
  let savedPayload = '';
  global.localStorage = {
    getItem() {
      throw new Error('storage blocked');
    },
    setItem() {
      throw new Error('storage blocked');
    },
  };

  try {
    const host = createAndroidHostAdapter({
      loadSettings() {
        return savedPayload || '{}';
      },
      saveSettings(payload) {
        savedPayload = payload;
      },
    });

    await host.saveSettings({
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test',
      model: 'deepseek-chat',
    });

    assert.deepEqual(JSON.parse(savedPayload), {
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test',
      model: 'deepseek-chat',
    });
    assert.deepEqual(await host.loadSettings(), {
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test',
      model: 'deepseek-chat',
    });
  } finally {
    global.localStorage = previousStorage;
  }
});
