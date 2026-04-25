const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  normalizeMomentsState,
  setDiscoverTab,
  upsertMomentPosts,
  toggleMomentLike,
  addMomentComment,
  removeMomentComment,
  getMomentFeed,
} = require(path.join(__dirname, '..', 'app', 'lib', 'moments-store.js'));

test('normalizeMomentsState keeps valid tab and sanitized posts', () => {
  const state = normalizeMomentsState({
    activeTab: 'memory',
    postsBySlug: {
      'permanent-a': [{
        id: 'post-1',
        contactSlug: 'permanent-a',
        text: 'hello',
        intent: 'share',
        createdAt: 123,
        likedByUser: true,
        comments: [{ id: 'c1', authorRole: 'user', text: 'hi', createdAt: 456 }],
      }],
    },
  });

  assert.equal(state.activeTab, 'memory');
  assert.equal(state.postsBySlug['permanent-a'][0].id, 'post-1');
  assert.equal(state.postsBySlug['permanent-a'][0].comments.length, 1);
});

test('upsertMomentPosts keeps posts sorted newest first per slug', () => {
  const state = upsertMomentPosts(normalizeMomentsState({}), 'permanent-a', [
    { id: 'old', contactSlug: 'permanent-a', text: 'old', intent: 'share', createdAt: 10, comments: [] },
    { id: 'new', contactSlug: 'permanent-a', text: 'new', intent: 'share', createdAt: 20, comments: [] },
  ]);

  assert.deepEqual(state.postsBySlug['permanent-a'].map((post) => post.id), ['new', 'old']);
});

test('toggleMomentLike flips likedByUser for a post', () => {
  const state = upsertMomentPosts(normalizeMomentsState({}), 'permanent-a', [
    { id: 'post-1', contactSlug: 'permanent-a', text: 'hello', intent: 'share', createdAt: 10, comments: [], likedByUser: false },
  ]);

  const liked = toggleMomentLike(state, 'post-1');
  const unliked = toggleMomentLike(liked, 'post-1');

  assert.equal(liked.postsBySlug['permanent-a'][0].likedByUser, true);
  assert.equal(unliked.postsBySlug['permanent-a'][0].likedByUser, false);
});

test('addMomentComment and removeMomentComment update a post comments immutably', () => {
  const state = upsertMomentPosts(normalizeMomentsState({}), 'permanent-a', [
    { id: 'post-1', contactSlug: 'permanent-a', text: 'hello', intent: 'share', createdAt: 10, comments: [] },
  ]);

  const withComment = addMomentComment(state, 'post-1', {
    id: 'comment-1',
    authorRole: 'user',
    text: '在干嘛',
    createdAt: 12,
  });
  const removed = removeMomentComment(withComment, 'post-1', 'comment-1');

  assert.equal(withComment.postsBySlug['permanent-a'][0].comments.length, 1);
  assert.equal(removed.postsBySlug['permanent-a'][0].comments.length, 0);
});

test('getMomentFeed flattens all contact posts newest first', () => {
  const state = normalizeMomentsState({
    postsBySlug: {
      'permanent-a': [
        { id: 'a1', contactSlug: 'permanent-a', text: 'A', intent: 'share', createdAt: 30, comments: [] },
      ],
      'permanent-b': [
        { id: 'b1', contactSlug: 'permanent-b', text: 'B', intent: 'share', createdAt: 40, comments: [] },
      ],
    },
  });

  assert.deepEqual(getMomentFeed(state).map((post) => post.id), ['b1', 'a1']);
});

test('setDiscoverTab only accepts supported tabs', () => {
  const state = normalizeMomentsState({});

  assert.equal(setDiscoverTab(state, 'memory').activeTab, 'memory');
  assert.equal(setDiscoverTab(state, 'weird').activeTab, 'moments');
});
