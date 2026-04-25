(function (globalScope) {
  'use strict';

  const BASE_REPLY_TARGET_MS = 8000;
  const EXTRA_REPLY_TARGET_MS = 4000;
  const MIN_REPLY_AFTER_LAST_MESSAGE_MS = 2500;
  const MAX_REPLY_WAIT_MS = 18000;

  function createReplyBatch(now) {
    return {
      firstAt: typeof now === 'number' ? now : Date.now(),
      messageIds: [],
      timerId: null,
    };
  }

  function appendToReplyBatch(batch, messageId) {
    if (!batch || !messageId) {
      return batch;
    }
    if (batch.messageIds.indexOf(messageId) < 0) {
      batch.messageIds.push(messageId);
    }
    return batch;
  }

  function getReplyDelayMs(options) {
    const source = options || {};
    const messageCount = Math.max(1, Number(source.messageCount) || 1);
    const firstAt = Number(source.firstAt) || Date.now();
    const now = Number(source.now) || Date.now();
    const elapsed = Math.max(0, now - firstAt);
    const targetTotal = Math.min(
      MAX_REPLY_WAIT_MS,
      BASE_REPLY_TARGET_MS + Math.max(0, messageCount - 1) * EXTRA_REPLY_TARGET_MS
    );
    const remainingToTarget = Math.max(0, targetTotal - elapsed);
    const remainingToCap = Math.max(0, MAX_REPLY_WAIT_MS - elapsed);
    return Math.min(
      remainingToCap,
      Math.max(MIN_REPLY_AFTER_LAST_MESSAGE_MS, remainingToTarget)
    );
  }

  function joinPendingUserMessages(messages) {
    return (messages || [])
      .map(function (message) {
        return String((message && message.text) || '').trim();
      })
      .filter(Boolean)
      .join('\n');
  }

  const api = {
    createReplyBatch,
    appendToReplyBatch,
    getReplyDelayMs,
    joinPendingUserMessages,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileReplyBatcher = api;
  } else if (globalScope) {
    globalScope.ExProfileReplyBatcher = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
