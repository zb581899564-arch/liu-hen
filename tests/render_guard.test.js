const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  getThreadScrollTarget,
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

test('stable chat updates avoid replacing unchanged message html', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'main.js'), 'utf8');
  const stableMatch = source.match(/function renderStableChatThreadUpdate\(route, options\) \{[\s\S]*?\n  \}/);

  assert.ok(stableMatch, 'renderStableChatThreadUpdate should exist');
  assert.match(stableMatch[0], /nextMessagesHtml/);
  assert.match(stableMatch[0], /threadMessages\.innerHTML !== nextMessagesHtml/);
});

test('moments interactions use stable discover pane updates', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'main.js'), 'utf8');
  const stableMatch = source.match(/function renderStableDiscoverUpdate\(route\) \{[\s\S]*?\n  \}/);
  const tabMatch = source.match(/function setDiscoverTab\(tab\) \{[\s\S]*?\n  \}/);
  const likeMatch = source.match(/function toggleMomentLike\(postId\) \{[\s\S]*?\n  \}/);
  const commentMatch = source.match(/function submitMomentComment\(postId\) \{[\s\S]*?\n  \}/);

  assert.ok(stableMatch, 'renderStableDiscoverUpdate should exist');
  assert.match(stableMatch[0], /renderDiscoverPaneHtml/);
  assert.match(stableMatch[0], /pane\.outerHTML !== nextPaneHtml/);
  assert.match(stableMatch[0], /discover-tab/);
  assert.ok(tabMatch, 'setDiscoverTab should exist');
  assert.match(tabMatch[0], /renderStableDiscoverUpdate/);
  assert.ok(likeMatch, 'toggleMomentLike should exist');
  assert.ok(commentMatch, 'submitMomentComment should exist');
  assert.match(likeMatch[0], /renderStableDiscoverUpdate/);
  assert.match(commentMatch[0], /renderStableDiscoverUpdate/);
});

test('discover entry defers moments freshness work until after first render', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'main.js'), 'utf8');
  const renderMatch = source.match(/function render\(options\) \{[\s\S]*?\n  \}/);
  const schedulerMatch = source.match(/function scheduleMomentsFreshForContacts\(contacts\) \{[\s\S]*?\n  \}/);

  assert.ok(renderMatch, 'render should exist');
  assert.ok(schedulerMatch, 'scheduleMomentsFreshForContacts should exist');
  assert.doesNotMatch(renderMatch[0], /ensureMomentsFreshForContacts\(contacts\)/);
  assert.match(renderMatch[0], /scheduleMomentsFreshForContacts\(contacts\)/);
  assert.match(schedulerMatch[0], /setTimeout/);
  assert.match(schedulerMatch[0], /renderStableDiscoverUpdate/);
});

test('getThreadScrollTarget avoids redundant scroll writes near current position', () => {
  const target = getThreadScrollTarget({
    scrollState: { shouldStick: true, scrollTop: 120 },
    forceThreadBottom: false,
    scrollHeight: 1000,
    clientHeight: 400,
    currentScrollTop: 599,
  });

  assert.deepEqual(target, { shouldUpdate: false, scrollTop: 600 });
});

test('getThreadScrollTarget preserves reading position when thread is not stuck to bottom', () => {
  const target = getThreadScrollTarget({
    scrollState: { shouldStick: false, scrollTop: 240 },
    forceThreadBottom: false,
    scrollHeight: 1000,
    clientHeight: 400,
    currentScrollTop: 600,
  });

  assert.deepEqual(target, { shouldUpdate: true, scrollTop: 240 });
});

test('thread viewport sync uses guarded scroll writes', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'main.js'), 'utf8');
  const syncMatch = source.match(/function syncThreadViewport\(route, scrollState, options\) \{[\s\S]*?\n  \}/);

  assert.ok(syncMatch, 'syncThreadViewport should exist');
  assert.match(syncMatch[0], /getThreadScrollTarget/);
  assert.match(syncMatch[0], /shouldUpdate/);
});

test('chat animation CSS avoids broad compositor hints on scroll containers', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'styles', 'app.css'), 'utf8');

  assert.doesNotMatch(css, /will-change:\s*scroll-position/);
  assert.match(css, /--motion-fast/);
  assert.match(css, /content-visibility:\s*auto/);
  assert.match(css, /contain-intrinsic-size/);
});

test('moments feed uses containment for smoother scrolling', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'styles', 'app.css'), 'utf8');
  const cardMatch = css.match(/\.moment-card\s*\{[\s\S]*?\n\}/);

  assert.ok(cardMatch, 'moment-card CSS should exist');
  assert.match(cardMatch[0], /content-visibility:\s*auto/);
  assert.match(cardMatch[0], /contain-intrinsic-size/);
});
