const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeProactiveRuntimeState,
  touchAssistantActivity,
  touchUserActivity,
  enterCooldown,
} = require('../app/lib/proactive-runtime.js');

test('normalizeProactiveRuntimeState sanitizes invalid runtime entries', () => {
  const state = normalizeProactiveRuntimeState({
    'permanent-a': {
      mode: '???',
      intent: 42,
      consecutiveAssistantCount: '3',
      lastUserAt: '100',
      cooldownUntil: '250',
    },
  });

  assert.deepEqual(state['permanent-a'], {
    mode: 'idle',
    intent: '',
    consecutiveAssistantCount: 3,
    lastUserAt: 100,
    lastAssistantAt: 0,
    lastProactiveAt: 0,
    nextContinuationAt: 0,
    cooldownUntil: 250,
    lastContinuationReason: '',
  });
});

test('touchUserActivity resets consecutive assistant count', () => {
  const next = touchUserActivity({
    mode: 'continuing',
    intent: 'follow-up-question',
    consecutiveAssistantCount: 2,
    lastAssistantAt: 50,
  }, 1000);

  assert.equal(next.mode, 'engaged');
  assert.equal(next.consecutiveAssistantCount, 0);
  assert.equal(next.lastUserAt, 1000);
});

test('touchAssistantActivity increments consecutive assistant count for continuations', () => {
  const next = touchAssistantActivity({
    mode: 'waiting-user',
    intent: 'addendum',
    consecutiveAssistantCount: 1,
    lastUserAt: 20,
  }, 1200, { proactive: true, continuation: true, intent: 'addendum' });

  assert.equal(next.mode, 'waiting-user');
  assert.equal(next.intent, 'addendum');
  assert.equal(next.consecutiveAssistantCount, 2);
  assert.equal(next.lastAssistantAt, 1200);
  assert.equal(next.lastProactiveAt, 1200);
});

test('enterCooldown moves runtime state into cooling mode', () => {
  const next = enterCooldown({
    mode: 'continuing',
    intent: 'follow-up-question',
    consecutiveAssistantCount: 3,
  }, 9000, 3000, 'max-consecutive');

  assert.equal(next.mode, 'cooling');
  assert.equal(next.cooldownUntil, 12000);
  assert.equal(next.lastContinuationReason, 'max-consecutive');
});
