const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  getProactiveStatus,
} = require(path.join(__dirname, '..', 'app', 'lib', 'proactive-status.js'));

test('getProactiveStatus shows seconds until the next proactive contact', () => {
  assert.deepEqual(getProactiveStatus({
    proactiveSettings: { enabled: true, frequency: 'frequent' },
    hasApiSettings: true,
    doNotDisturbEnabled: false,
    nextRunAt: 109000,
    nowMs: 19000,
  }), {
    visible: true,
    tone: 'active',
    text: '90秒后主动联系',
  });
});

test('getProactiveStatus explains why proactive contact is blocked', () => {
  assert.equal(getProactiveStatus({
    proactiveSettings: { enabled: true, frequency: 'frequent' },
    hasApiSettings: true,
    doNotDisturbEnabled: true,
    nextRunAt: 109000,
    nowMs: 19000,
  }).text, '勿扰中');

  assert.equal(getProactiveStatus({
    proactiveSettings: { enabled: true, frequency: 'frequent' },
    hasApiSettings: false,
    doNotDisturbEnabled: false,
    nextRunAt: 109000,
    nowMs: 19000,
  }).text, '等待 API 配置');
});
