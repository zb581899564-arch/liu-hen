const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { getContactPreview, summarizeMessage } = require(path.join(__dirname, '..', 'app', 'lib', 'contact-preview.js'));

test('getContactPreview shows pending proactive message on the chat list', () => {
  assert.equal(
    getContactPreview([{ kind: 'message', role: 'assistant', pending: true }], '永久保留聊天'),
    '正在输入...'
  );
});

test('getContactPreview shows the latest assistant message on the chat list', () => {
  assert.equal(
    getContactPreview([
      { kind: 'message', role: 'user', text: '你在干嘛' },
      { kind: 'message', role: 'assistant', text: '刚醒' },
    ], '永久保留聊天'),
    '刚醒'
  );
});

test('getContactPreview turns proactive assistant messages into letters', () => {
  assert.equal(
    getContactPreview([
      { kind: 'message', role: 'assistant', text: '还没睡？', origin: 'proactive', sentAt: 1709971260000 },
    ], '永久保留聊天'),
    '她在 16:01 留了一句话'
  );
});

test('summarizeMessage marks media and user messages for list preview', () => {
  assert.equal(summarizeMessage({ kind: 'message', role: 'assistant', stickerMd5: 'abc' }), '[动画表情]');
  assert.equal(summarizeMessage({ kind: 'message', role: 'assistant', attachmentType: 'image' }), '[图片]');
  assert.equal(summarizeMessage({ kind: 'message', role: 'user', text: '等你' }), '我: 等你');
});
