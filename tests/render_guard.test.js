const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  shouldDeferRenderForComposer,
} = require(path.join(__dirname, '..', 'app', 'lib', 'render-guard.js'));

function createDocumentWithActiveElement(activeElement) {
  return { activeElement };
}

test('shouldDeferRenderForComposer defers async chat renders while composer is focused', () => {
  const input = {
    matches(selector) {
      return selector === '[data-role="composer-input"]';
    },
  };

  assert.equal(
    shouldDeferRenderForComposer(
      createDocumentWithActiveElement(input),
      { view: 'chat-thread', slug: 'permanent-sample-contact' },
      { deferIfComposerFocused: true }
    ),
    true
  );
});

test('shouldDeferRenderForComposer does not defer normal sends or route changes', () => {
  const input = {
    matches(selector) {
      return selector === '[data-role="composer-input"]';
    },
  };

  assert.equal(
    shouldDeferRenderForComposer(
      createDocumentWithActiveElement(input),
      { view: 'chat-thread', slug: 'permanent-sample-contact' },
      { forceThreadBottom: true }
    ),
    false
  );
  assert.equal(
    shouldDeferRenderForComposer(
      createDocumentWithActiveElement(input),
      { view: 'chat-list' },
      { deferIfComposerFocused: true }
    ),
    false
  );
});

test('chat waiting renders use stable thread updates while composer is focused', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'main.js'), 'utf8');
  const batchMatch = source.match(/function scheduleUserReplyBatch\(contact, userMessage\) \{[\s\S]*?\n  \}/);
  const replyMatch = source.match(/async function requestAssistantReply\(contact, userMessage, history, messageText\) \{[\s\S]*?\n  \}/);

  assert.match(source, /function renderStableChatThreadUpdate\(route, options\)/);
  assert.match(source, /stable-thread-update/);
  assert.ok(batchMatch, 'scheduleUserReplyBatch should exist');
  assert.ok(replyMatch, 'requestAssistantReply should exist');
  assert.doesNotMatch(batchMatch[0], /deferIfComposerFocused: true/);
  assert.match(replyMatch[0], /deferIfComposerFocused: true/);
});
