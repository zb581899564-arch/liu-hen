const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseAssistantProtocol,
  normalizeProtocolItem,
} = require('../app/lib/message-protocol.js');

test('parseAssistantProtocol reads structured immediate and scheduled messages', () => {
  const result = parseAssistantProtocol(JSON.stringify({
    messages: [
      { type: 'text', text: 'just got off work' },
      { type: 'sticker', md5: 'abc123' },
    ],
    scheduled: [
      { delaySeconds: 300, type: 'text', text: 'you always say you are busy' },
    ],
  }));

  assert.deepEqual(result.messages, [
    { type: 'text', text: 'just got off work' },
    { type: 'sticker', md5: 'abc123' },
  ]);
  assert.deepEqual(result.scheduled, [
    { delaySeconds: 300, type: 'text', text: 'you always say you are busy' },
  ]);
});

test('parseAssistantProtocol falls back to multiple text lines and legacy sticker markers', () => {
  const result = parseAssistantProtocol('first line\nsecond line\n[[sticker:md5=abc123]]');

  assert.deepEqual(result.messages, [
    { type: 'text', text: 'first line' },
    { type: 'text', text: 'second line' },
    { type: 'sticker', md5: 'abc123' },
  ]);
  assert.deepEqual(result.scheduled, []);
});

test('parseAssistantProtocol trims follow-up self answers after a user-directed question in the same turn', () => {
  const result = parseAssistantProtocol(JSON.stringify({
    messages: [
      { type: 'text', text: '没啥，就躺着' },
      { type: 'text', text: '你吃了吗' },
      { type: 'text', text: '没吃呢' },
      { type: 'text', text: '不饿' },
    ],
  }));

  assert.deepEqual(result.messages, [
    { type: 'text', text: '没啥，就躺着' },
    { type: 'text', text: '你吃了吗' },
  ]);
});

test('normalizeProtocolItem rejects empty or unsafe scheduled items', () => {
  assert.equal(normalizeProtocolItem({ type: 'text', text: '' }), null);
  assert.deepEqual(
    normalizeProtocolItem({ type: 'text', text: 'later', delaySeconds: 999999 }),
    { type: 'text', text: 'later', delaySeconds: 86400 }
  );
});

test('parseAssistantProtocol does not expose broken structured sticker JSON as chat text', () => {
  const result = parseAssistantProtocol('{"messages":[{"type":"sticker","md5":"');

  assert.deepEqual(result.messages, [
    { type: 'text', text: '[表情]' },
  ]);
  assert.deepEqual(result.scheduled, []);
});
