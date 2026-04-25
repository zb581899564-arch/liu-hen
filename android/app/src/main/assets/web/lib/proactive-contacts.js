(function (globalScope) {
  'use strict';

  const DELAY_BY_FREQUENCY = {
    gentle: 12 * 60 * 1000,
    normal: 5 * 60 * 1000,
    frequent: 90 * 1000,
  };

  function getDelayForSettings(settings) {
    const frequency = settings && DELAY_BY_FREQUENCY[settings.frequency]
      ? settings.frequency
      : 'normal';
    return DELAY_BY_FREQUENCY[frequency];
  }

  function listProactiveContacts(contacts, proactiveBySlug) {
    const settingsBySlug = proactiveBySlug || {};
    return (Array.isArray(contacts) ? contacts : []).filter(function (contact) {
      const settings = contact ? settingsBySlug[contact.slug] : null;
      return (
        contact &&
        contact.source === 'permanent' &&
        Boolean(contact.hostProfileLocation) &&
        Boolean(settings && settings.enabled)
      );
    });
  }

  function chooseProactiveContact(contacts, proactiveBySlug, randomFn) {
    const candidates = listProactiveContacts(contacts, proactiveBySlug);
    if (!candidates.length) {
      return null;
    }

    const random = typeof randomFn === 'function' ? randomFn : Math.random;
    const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
    return candidates[index];
  }

  function ensureProactiveSchedule(contacts, proactiveBySlug, nextRunBySlug, nowMs) {
    const current = nextRunBySlug || {};
    const next = {};

    listProactiveContacts(contacts, proactiveBySlug).forEach(function (contact) {
      const existing = Number(current[contact.slug] || 0);
      next[contact.slug] = existing > 0
        ? existing
        : (Number(nowMs) || 0) + getDelayForSettings(proactiveBySlug[contact.slug]);
    });

    return next;
  }

  function getNextProactiveDueAt(nextRunBySlug) {
    const values = Object.keys(nextRunBySlug || {}).map(function (slug) {
      return Number(nextRunBySlug[slug] || 0);
    }).filter(function (value) {
      return value > 0;
    });
    return values.length ? Math.min.apply(null, values) : 0;
  }

  function chooseDueProactiveContact(contacts, proactiveBySlug, nextRunBySlug, nowMs) {
    const now = Number(nowMs) || 0;
    const candidates = listProactiveContacts(contacts, proactiveBySlug)
      .filter(function (contact) {
        return Number((nextRunBySlug || {})[contact.slug] || 0) <= now;
      })
      .sort(function (a, b) {
        return Number(nextRunBySlug[a.slug] || 0) - Number(nextRunBySlug[b.slug] || 0);
      });

    return candidates[0] || null;
  }

  function canSendProactiveContinuation(messages, maxConsecutiveAssistant) {
    const maxCount = Number(maxConsecutiveAssistant) > 0 ? Number(maxConsecutiveAssistant) : 3;
    const queue = Array.isArray(messages) ? messages : [];
    let assistantCount = 0;

    for (let index = queue.length - 1; index >= 0; index -= 1) {
      const message = queue[index];
      if (!message || message.pending || message.kind !== 'message') {
        continue;
      }
      if (message.role === 'user') {
        return true;
      }
      if (message.role === 'assistant') {
        assistantCount += 1;
        if (assistantCount >= maxCount) {
          return false;
        }
      }
    }

    return true;
  }

  function scheduleNextForContact(nextRunBySlug, proactiveBySlug, slug, nowMs) {
    const next = { ...(nextRunBySlug || {}) };
    const settings = proactiveBySlug && proactiveBySlug[slug];
    if (settings && settings.enabled) {
      next[slug] = (Number(nowMs) || 0) + getDelayForSettings(settings);
    } else {
      delete next[slug];
    }
    return next;
  }

  const api = {
    DELAY_BY_FREQUENCY,
    canSendProactiveContinuation,
    chooseDueProactiveContact,
    chooseProactiveContact,
    ensureProactiveSchedule,
    getNextProactiveDueAt,
    listProactiveContacts,
    scheduleNextForContact,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileProactiveContacts = api;
  } else if (globalScope) {
    globalScope.ExProfileProactiveContacts = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
