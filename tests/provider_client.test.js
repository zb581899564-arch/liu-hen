const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { readAssistantText, sendChatRequest } = require(path.join(__dirname, '..', 'app', 'lib', 'provider-client.js'));

test('sendChatRequest uses native Android bridge when available', async () => {
  const previousBridge = global.AndroidBridge;
  let captured = null;
  global.AndroidBridge = {
    sendChatRequest(endpoint, apiKey, payload) {
      captured = { endpoint, apiKey, payload: JSON.parse(payload) };
      return JSON.stringify({
        choices: [{ message: { content: 'native ok' } }],
      });
    },
  };

  try {
    const json = await sendChatRequest('https://api.deepseek.com/v1', 'sk-test', {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'hi' }],
    });

    assert.equal(captured.endpoint, 'https://api.deepseek.com/v1/chat/completions');
    assert.equal(captured.apiKey, 'sk-test');
    assert.equal(captured.payload.model, 'deepseek-chat');
    assert.equal(json.choices[0].message.content, 'native ok');
  } finally {
    global.AndroidBridge = previousBridge;
  }
});

test('sendChatRequest surfaces native bridge errors', async () => {
  const previousBridge = global.AndroidBridge;
  global.AndroidBridge = {
    sendChatRequest() {
      return JSON.stringify({ error: 'network blocked' });
    },
  };

  try {
    await assert.rejects(
      sendChatRequest('https://api.deepseek.com/v1', 'sk-test', { model: 'deepseek-chat' }),
      /network blocked/
    );
  } finally {
    global.AndroidBridge = previousBridge;
  }
});

test('sendChatRequest prefers async native Android bridge when available', async () => {
  const previousBridge = global.AndroidBridge;
  let captured = null;
  global.AndroidBridge = {
    sendChatRequestAsync(requestId, endpoint, apiKey, payload) {
      captured = { requestId, endpoint, apiKey, payload: JSON.parse(payload) };
      setTimeout(() => {
        global.ExProfileNativeCallbacks.resolve(
          requestId,
          JSON.stringify({ choices: [{ message: { content: 'async native ok' } }] })
        );
      }, 0);
    },
    sendChatRequest() {
      throw new Error('sync bridge should not be used');
    },
  };

  try {
    const json = await sendChatRequest('https://api.deepseek.com/v1', 'sk-test', {
      model: 'deepseek-chat',
    });

    assert.equal(captured.endpoint, 'https://api.deepseek.com/v1/chat/completions');
    assert.equal(captured.apiKey, 'sk-test');
    assert.equal(captured.payload.model, 'deepseek-chat');
    assert.equal(json.choices[0].message.content, 'async native ok');
  } finally {
    global.AndroidBridge = previousBridge;
  }
});

test('sendChatRequest aborts browser fetch after the timeout window', async () => {
  const previousBridge = global.AndroidBridge;
  const previousFetch = global.fetch;
  delete global.AndroidBridge;

  global.fetch = function (_endpoint, options) {
    return new Promise(function (_resolve, reject) {
      options.signal.addEventListener('abort', function () {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });
  };

  try {
    await assert.rejects(
      sendChatRequest('https://api.deepseek.com/v1', 'sk-test', { model: 'deepseek-chat' }, { timeoutMs: 1 }),
      /请求超时/
    );
  } finally {
    global.AndroidBridge = previousBridge;
    global.fetch = previousFetch;
  }
});

test('readAssistantText ignores provider reasoning_content fields', () => {
  const text = readAssistantText({
    choices: [
      {
        message: {
          reasoning_content: 'private chain of thought',
          content: 'visible answer',
        },
      },
    ],
  });

  assert.equal(text, 'visible answer');
});

test('readAssistantText returns empty text when provider only returns reasoning_content', () => {
  const text = readAssistantText({
    choices: [
      {
        message: {
          reasoning_content: 'private chain of thought',
        },
      },
    ],
  });

  assert.equal(text, '');
});
