(function (globalScope) {
  'use strict';

  function hasEnabled(settings) {
    return Boolean(settings && settings.enabled);
  }

  function formatRemaining(ms) {
    const remaining = Math.max(0, Number(ms) || 0);
    if (remaining <= 0) {
      return '随时会主动联系';
    }
    if (remaining < 120000) {
      return Math.ceil(remaining / 1000) + '秒后主动联系';
    }
    if (remaining < 60 * 60 * 1000) {
      return Math.ceil(remaining / 60000) + '分钟后主动联系';
    }
    return Math.ceil(remaining / (60 * 60 * 1000)) + '小时后主动联系';
  }

  function getProactiveStatus(args) {
    const source = args || {};
    if (!hasEnabled(source.proactiveSettings)) {
      return { visible: false, tone: 'off', text: '未开启主动联系' };
    }
    if (source.doNotDisturbEnabled) {
      return { visible: true, tone: 'blocked', text: '勿扰中' };
    }
    if (!source.hasApiSettings) {
      return { visible: true, tone: 'blocked', text: '等待 API 配置' };
    }
    const nextRunAt = Number(source.nextRunAt || 0);
    if (!nextRunAt) {
      return { visible: true, tone: 'pending', text: '正在安排主动联系' };
    }
    return {
      visible: true,
      tone: 'active',
      text: formatRemaining(nextRunAt - (Number(source.nowMs) || Date.now())),
    };
  }

  const api = { formatRemaining, getProactiveStatus };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileProactiveStatus = api;
  } else if (globalScope) {
    globalScope.ExProfileProactiveStatus = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
