(function (globalScope) {
  'use strict';

  function shouldScheduleContinuation(options) {
    const source = options || {};
    const runtime = source.runtime || {};
    const nowMs = Number(source.nowMs) || 0;
    const maxCount = Number(source.maxConsecutiveAssistant) || 4;

    if (Number(runtime.cooldownUntil || 0) > nowMs) {
      return { allowed: false, reason: 'cooling' };
    }
    if (source.hasPendingReply) {
      return { allowed: false, reason: 'pending-reply' };
    }
    if (source.hasScheduledMessages) {
      return { allowed: false, reason: 'scheduled-pending' };
    }
    if (Number(runtime.consecutiveAssistantCount || 0) >= maxCount) {
      return { allowed: false, reason: 'max-consecutive' };
    }

    const lastUserAt = Number(runtime.lastUserAt || 0);
    const lastAssistantAt = Number(runtime.lastAssistantAt || 0);
    if (source.source === 'reply' && lastUserAt && lastAssistantAt && nowMs - lastUserAt < 45000) {
      return { allowed: true, reason: 'conversation-still-warm' };
    }
    if (source.source === 'proactive') {
      return { allowed: true, reason: 'light-unanswered-nudge' };
    }

    return { allowed: false, reason: 'no-window' };
  }

  function chooseContinuationIntent(options) {
    const source = options || {};
    const runtime = source.runtime || {};
    if (source.source === 'reply') {
      return Number(runtime.consecutiveAssistantCount || 0) > 1 ? 'addendum' : 'follow-up-question';
    }
    return Number(runtime.consecutiveAssistantCount || 0) > 1 ? 'soft-close' : 'test-the-water';
  }

  function getContinuationDelayMs(options) {
    const source = options || {};
    const count = Math.max(0, Number(source.consecutiveAssistantCount) || 0);
    if (source.source === 'reply') {
      return 4500 + count * 2500;
    }
    return 25000 + count * 15000;
  }

  const api = {
    chooseContinuationIntent,
    getContinuationDelayMs,
    shouldScheduleContinuation,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileProactiveContinuation = api;
  } else if (globalScope) {
    globalScope.ExProfileProactiveContinuation = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
