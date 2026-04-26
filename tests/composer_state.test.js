const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { captureComposerState, restoreComposerState } = require(path.join(__dirname, '..', 'app', 'lib', 'composer-state.js'));

test('composer state restores focus and selection after chat render', () => {
  const input = {
    value: 'half typed',
    selectionStart: 4,
    selectionEnd: 9,
    matches(selector) {
      return selector === '[data-role="composer-input"]';
    },
    focusCalled: false,
    focus() {
      this.focusCalled = true;
    },
    setSelectionRange(start, end) {
      this.selectionStart = start;
      this.selectionEnd = end;
    },
  };
  const documentRef = {
    activeElement: input,
    querySelector(selector) {
      return selector === '[data-role="composer-input"]' ? input : null;
    },
  };
  const route = { view: 'chat-thread', slug: 'permanent-sample-contact' };

  const state = captureComposerState(documentRef, route);
  input.value = '';
  restoreComposerState(documentRef, route, state);

  assert.equal(input.value, 'half typed');
  assert.equal(input.focusCalled, true);
  assert.equal(input.selectionStart, 4);
  assert.equal(input.selectionEnd, 9);
});

test('composer state does not restore when route changes', () => {
  const input = {
    value: 'draft',
    selectionStart: 0,
    selectionEnd: 0,
    matches() {
      return true;
    },
    focus() {
      throw new Error('should not focus');
    },
  };
  const documentRef = {
    activeElement: input,
    querySelector() {
      return input;
    },
  };

  const state = captureComposerState(documentRef, { view: 'chat-thread', slug: 'a' });
  restoreComposerState(documentRef, { view: 'chat-thread', slug: 'b' }, state);

  assert.equal(input.value, 'draft');
});
