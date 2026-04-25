const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  ensureMomentsFresh,
  createMomentCommentReply,
} = require(path.join(__dirname, '..', 'app', 'lib', 'moments-engine.js'));

test('ensureMomentsFresh seeds a post for contacts without moments', () => {
  const state = ensureMomentsFresh(
    { activeTab: 'moments', postsBySlug: {}, nextPostAtBySlug: {} },
    [{
      slug: 'permanent-a',
      displayName: 'Alpha',
      preview: '晚点睡',
      humanInsight: {
        weather: { label: '小雨', line: '话少，但还是会回头。' },
        relationPhase: '试探',
        unsentLine: '有些话没说出口。',
        memorySeeds: ['你别总熬夜'],
      },
    }],
    { nowMs: 1000 }
  );

  assert.equal(state.postsBySlug['permanent-a'].length, 1);
  assert.match(state.postsBySlug['permanent-a'][0].text, /晚点睡|熬夜|小雨|没说出口/);
  assert.ok(state.nextPostAtBySlug['permanent-a'] > 1000);
});

test('ensureMomentsFresh appends a new post when the next post time is due', () => {
  const next = ensureMomentsFresh(
    {
      activeTab: 'moments',
      postsBySlug: {
        'permanent-a': [{
          id: 'moment-permanent-a-1',
          contactSlug: 'permanent-a',
          text: 'first',
          intent: 'share',
          createdAt: 100,
          comments: [],
        }],
      },
      nextPostAtBySlug: { 'permanent-a': 50 },
    },
    [{
      slug: 'permanent-a',
      displayName: 'Alpha',
      preview: '还没睡',
      humanInsight: {
        weather: { label: '微风', line: '像是在犹豫。' },
        relationPhase: '熟悉',
        unsentLine: '想说又算了。',
        memorySeeds: ['火锅'],
      },
    }],
    { nowMs: 200 }
  );

  assert.equal(next.postsBySlug['permanent-a'].length, 2);
  assert.ok(next.postsBySlug['permanent-a'][0].createdAt >= 200);
});

test('createMomentCommentReply returns a short in-character contact comment', () => {
  const comment = createMomentCommentReply(
    {
      slug: 'permanent-a',
      displayName: 'Alpha',
      humanInsight: {
        weather: { label: '小雨', line: '话少。' },
        relationPhase: '熟悉',
        unsentLine: '有些话没说出口。',
        memorySeeds: ['你别总熬夜'],
      },
    },
    { id: 'post-1', text: '今天有点烦', intent: 'vent' },
    '你又在emo了',
    300
  );

  assert.equal(comment.authorRole, 'assistant');
  assert.equal(comment.authorSlug, 'permanent-a');
  assert.ok(comment.text.length > 0);
});
