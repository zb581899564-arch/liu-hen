const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createReplyBatch,
  appendToReplyBatch,
  getReplyDelayMs,
  joinPendingUserMessages,
} = require('../app/lib/reply-batcher.js');
const fs = require('node:fs');
const path = require('node:path');

test('reply batch joins consecutive user messages as one request', () => {
  const batch = createReplyBatch(1000);
  appendToReplyBatch(batch, 'm1');
  appendToReplyBatch(batch, 'm2');

  assert.deepEqual(batch.messageIds, ['m1', 'm2']);
  assert.equal(
    joinPendingUserMessages([
      { id: 'm1', text: 'first' },
      { id: 'm2', text: 'second' },
    ]),
    'first\nsecond'
  );
});

test('reply delay gives the user room to send a few messages before the model replies', () => {
  const firstDelay = getReplyDelayMs({ messageCount: 1, firstAt: 1000, now: 1000, random: () => 0 });
  const secondDelay = getReplyDelayMs({ messageCount: 2, firstAt: 1000, now: 4000, random: () => 0.999 });
  const cappedDelay = getReplyDelayMs({ messageCount: 3, firstAt: 1000, now: 12900, random: () => 0.999 });

  assert.equal(firstDelay, 8000);
  assert.equal(secondDelay, 9000);
  assert.equal(cappedDelay, 4100);
});

test('main reply flow can open a continuation window after assistant reply', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'main.js'), 'utf8');
  assert.match(source, /scheduleContinuationForContact\(contact/);
});
