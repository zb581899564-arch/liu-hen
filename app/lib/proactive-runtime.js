(function (globalScope) {
  'use strict';

  const MODES = ['idle', 'engaged', 'waiting-user', 'continuing', 'cooling'];

  function normalizeMode(mode) {
    return MODES.indexOf(mode) >= 0 ? mode : 'idle';
  }

  function normalizeRuntimeEntry(entry) {
    const source = entry || {};
    return {
      mode: normalizeMode(source.mode),
      intent: typeof source.intent === 'string' ? source.intent : '',
      consecutiveAssistantCount: Math.max(0, Number(source.consecutiveAssistantCount) || 0),
      lastUserAt: Math.max(0, Number(source.lastUserAt) || 0),
      lastAssistantAt: Math.max(0, Number(source.lastAssistantAt) || 0),
      lastProactiveAt: Math.max(0, Number(source.lastProactiveAt) || 0),
      nextContinuationAt: Math.max(0, Number(source.nextContinuationAt) || 0),
      cooldownUntil: Math.max(0, Number(source.cooldownUntil) || 0),
      lastContinuationReason: typeof source.lastContinuationReason === 'string'
        ? source.lastContinuationReason
        : '',
    };
  }

  function normalizeProactiveRuntimeState(state) {
    const source = state || {};
    const normalized = {};
    Object.keys(source).forEach(function (slug) {
      normalized[String(slug)] = normalizeRuntimeEntry(source[slug]);
    });
    return normalized;
  }

  function touchUserActivity(entry, nowMs) {
    const next = normalizeRuntimeEntry(entry);
    next.mode = 'engaged';
    next.intent = '';
    next.consecutiveAssistantCount = 0;
    next.lastUserAt = Math.max(0, Number(nowMs) || 0);
    next.nextContinuationAt = 0;
    next.cooldownUntil = 0;
    next.lastContinuationReason = '';
    return next;
  }

  function touchAssistantActivity(entry, nowMs, options) {
    const next = normalizeRuntimeEntry(entry);
    const opts = options || {};
    next.mode = opts.continuation ? 'waiting-user' : 'waiting-user';
    next.intent = typeof opts.intent === 'string' ? opts.intent : next.intent;
    next.lastAssistantAt = Math.max(0, Number(nowMs) || 0);
    next.nextContinuationAt = 0;
    next.lastContinuationReason = '';
    if (opts.proactive) {
      next.lastProactiveAt = next.lastAssistantAt;
    }
    next.consecutiveAssistantCount = opts.continuation
      ? next.consecutiveAssistantCount + 1
      : Math.max(1, next.consecutiveAssistantCount || 0);
    return next;
  }

  function setContinuationTarget(entry, dueAt, reason) {
    const next = normalizeRuntimeEntry(entry);
    next.mode = 'continuing';
    next.nextContinuationAt = Math.max(0, Number(dueAt) || 0);
    next.lastContinuationReason = typeof reason === 'string' ? reason : '';
    return next;
  }

  function enterCooldown(entry, nowMs, delayMs, reason) {
    const next = normalizeRuntimeEntry(entry);
    next.mode = 'cooling';
    next.nextContinuationAt = 0;
    next.cooldownUntil = Math.max(0, Number(nowMs) || 0) + Math.max(0, Number(delayMs) || 0);
    next.lastContinuationReason = typeof reason === 'string' ? reason : '';
    return next;
  }

  function clearContinuationTarget(entry) {
    const next = normalizeRuntimeEntry(entry);
    next.nextContinuationAt = 0;
    if (next.mode === 'continuing') {
      next.mode = 'waiting-user';
    }
    return next;
  }

  const api = {
    MODES,
    clearContinuationTarget,
    enterCooldown,
    normalizeProactiveRuntimeState,
    normalizeRuntimeEntry,
    setContinuationTarget,
    touchAssistantActivity,
    touchUserActivity,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileProactiveRuntime = api;
  } else if (globalScope) {
    globalScope.ExProfileProactiveRuntime = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
