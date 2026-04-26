const test = require('node:test');
const assert = require('node:assert/strict');

const {
  chooseContinuationIntent,
  getContinuationDelayMs,
  shouldScheduleContinuation,
} = require('../app/lib/proactive-continuation.js');

test('shouldScheduleContinuation allows warm conversation follow-up', () => {
  const decision = shouldScheduleContinuation({
    nowMs: 10000,
    runtime: {
      mode: 'waiting-user',
      consecutiveAssistantCount: 1,
      lastUserAt: 7000,
      lastAssistantAt: 9000,
      cooldownUntil: 0,
    },
    hasPendingReply: false,
    hasScheduledMessages: false,
    maxConsecutiveAssistant: 4,
    source: 'reply',
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, 'conversation-still-warm');
});

test('shouldScheduleContinuation blocks when cooling', () => {
  const decision = shouldScheduleContinuation({
    nowMs: 10000,
    runtime: {
      mode: 'cooling',
      consecutiveAssistantCount: 2,
      cooldownUntil: 12000,
    },
    hasPendingReply: false,
    hasScheduledMessages: false,
    maxConsecutiveAssistant: 4,
    source: 'proactive',
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'cooling');
});

test('chooseContinuationIntent prefers follow-up while chat is warm', () => {
  const intent = chooseContinuationIntent({
    runtime: {
      mode: 'waiting-user',
      consecutiveAssistantCount: 1,
      lastUserAt: 9000,
      lastAssistantAt: 9800,
    },
    source: 'reply',
  });

  assert.equal(intent, 'follow-up-question');
});

test('getContinuationDelayMs spaces unanswered proactive nudges more gently', () => {
  const delay = getContinuationDelayMs({
    source: 'proactive',
    consecutiveAssistantCount: 2,
  });

  assert.equal(typeof delay, 'number');
  assert.equal(delay > 20000, true);
});
