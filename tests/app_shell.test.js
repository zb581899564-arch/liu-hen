const test = require('node:test');
const assert = require('node:assert/strict');

const { createInitialState } = require('../app/state/store.js');
const { resolveRoute, shouldShowMainNav } = require('../app/router.js');
const fs = require('node:fs');
const path = require('node:path');

test('createInitialState opens on chat list', () => {
  const state = createInitialState();
  assert.equal(state.activeTab, 'wechat');
  assert.equal(state.activeThreadSlug, null);
});

test('resolveRoute returns chat thread route when slug is present', () => {
  assert.deepEqual(resolveRoute('#/chat/sample-contact'), {
    tab: 'wechat',
    view: 'chat-thread',
    slug: 'sample-contact',
  });
});

test('resolveRoute returns contact settings route when slug is present', () => {
  assert.deepEqual(resolveRoute('#/contact-settings/permanent-sample-contact'), {
    tab: 'wechat',
    view: 'contact-settings',
    slug: 'permanent-sample-contact',
  });
});

test('shouldShowMainNav hides bottom nav inside chat thread', () => {
  assert.equal(shouldShowMainNav(resolveRoute('#/chat/sample-contact')), false);
  assert.equal(shouldShowMainNav(resolveRoute('#/contact-settings/sample-contact')), false);
  assert.equal(shouldShowMainNav(resolveRoute('#/wechat')), true);
});

test('app shell declares a favicon to avoid browser 404 noise', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');

  assert.match(html, /rel="icon"/);
  assert.match(html, /href="\.\/assets\/app-icon\.svg"/);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'app', 'favicon.ico')));
});

test('app shell does not bundle proactive image assets', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  const serviceWorker = fs.readFileSync(path.join(__dirname, '..', 'app', 'sw.js'), 'utf8');
  const imageDir = path.join(__dirname, '..', 'app', 'assets', 'proactive-images');

  assert.doesNotMatch(html, /proactive-images/);
  assert.doesNotMatch(serviceWorker, /proactive-images/);
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'app', 'data', 'proactive-images.js')), false);
  assert.equal(fs.existsSync(imageDir), false);
});
