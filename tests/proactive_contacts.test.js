const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  canSendProactiveContinuation,
  listProactiveContacts,
  chooseProactiveContact,
  ensureProactiveSchedule,
  chooseDueProactiveContact,
  getNextProactiveDueAt,
} = require(path.join(__dirname, '..', 'app', 'lib', 'proactive-contacts.js'));

test('listProactiveContacts keeps only enabled permanent contacts with a profile location', () => {
  const contacts = listProactiveContacts([
    { slug: 'sample-contact', source: 'builtin', hostProfileLocation: 'file://a' },
    { slug: 'permanent-sample-contact', source: 'permanent', hostProfileLocation: 'file://a' },
    { slug: 'permanent-disabled', source: 'permanent', hostProfileLocation: 'file://b' },
    { slug: 'permanent-empty', source: 'permanent', hostProfileLocation: '' },
  ], {
    'permanent-sample-contact': { enabled: true, frequency: 'normal' },
    'permanent-disabled': { enabled: false, frequency: 'normal' },
  });

  assert.deepEqual(contacts, [
    { slug: 'permanent-sample-contact', source: 'permanent', hostProfileLocation: 'file://a' },
  ]);
});

test('chooseProactiveContact can choose across multiple permanent contacts', () => {
  const contacts = [
    { slug: 'permanent-a', source: 'permanent', hostProfileLocation: 'file://a' },
    { slug: 'permanent-b', source: 'permanent', hostProfileLocation: 'file://b' },
  ];
  const proactiveBySlug = {
    'permanent-a': { enabled: true, frequency: 'normal' },
    'permanent-b': { enabled: true, frequency: 'frequent' },
  };

  assert.equal(chooseProactiveContact(contacts, proactiveBySlug, () => 0.1).slug, 'permanent-a');
  assert.equal(chooseProactiveContact(contacts, proactiveBySlug, () => 0.9).slug, 'permanent-b');
});

test('ensureProactiveSchedule keeps independent next run times per contact', () => {
  const contacts = [
    { slug: 'permanent-a', source: 'permanent', hostProfileLocation: 'file://a' },
    { slug: 'permanent-b', source: 'permanent', hostProfileLocation: 'file://b' },
  ];
  const proactiveBySlug = {
    'permanent-a': { enabled: true, frequency: 'normal' },
    'permanent-b': { enabled: true, frequency: 'frequent' },
  };

  const schedule = ensureProactiveSchedule(contacts, proactiveBySlug, {}, 1000);

  assert.equal(schedule['permanent-a'], 1000 + 5 * 60 * 1000);
  assert.equal(schedule['permanent-b'], 1000 + 90 * 1000);
  assert.equal(getNextProactiveDueAt(schedule), 1000 + 90 * 1000);
});

test('ensureProactiveSchedule keeps overdue contacts due until the automatic chain consumes them', () => {
  const contacts = [
    { slug: 'permanent-a', source: 'permanent', hostProfileLocation: 'file://a' },
  ];
  const proactiveBySlug = {
    'permanent-a': { enabled: true, frequency: 'frequent' },
  };
  const schedule = ensureProactiveSchedule(contacts, proactiveBySlug, {
    'permanent-a': 1500,
  }, 2000);

  assert.equal(schedule['permanent-a'], 1500);
  assert.equal(chooseDueProactiveContact(contacts, proactiveBySlug, schedule, 2000).slug, 'permanent-a');
});

test('chooseDueProactiveContact picks only contacts whose own timer is due', () => {
  const contacts = [
    { slug: 'permanent-a', source: 'permanent', hostProfileLocation: 'file://a' },
    { slug: 'permanent-b', source: 'permanent', hostProfileLocation: 'file://b' },
  ];
  const proactiveBySlug = {
    'permanent-a': { enabled: true, frequency: 'normal' },
    'permanent-b': { enabled: true, frequency: 'frequent' },
  };
  const nextRunBySlug = {
    'permanent-a': 5000,
    'permanent-b': 1500,
  };

  assert.equal(chooseDueProactiveContact(contacts, proactiveBySlug, nextRunBySlug, 2000).slug, 'permanent-b');
  assert.equal(chooseDueProactiveContact(contacts, proactiveBySlug, nextRunBySlug, 1000), null);
});

test('canSendProactiveContinuation stops after a few unanswered assistant messages', () => {
  assert.equal(canSendProactiveContinuation([
    { kind: 'message', role: 'assistant', text: '鍦ㄥ悧' },
    { kind: 'message', role: 'assistant', text: '鍒氭兂璧锋潵' },
    { kind: 'message', role: 'assistant', text: 'never mind' },
  ]), false);

  assert.equal(canSendProactiveContinuation([
    { kind: 'message', role: 'assistant', text: '鍦ㄥ悧' },
    { kind: 'message', role: 'user', text: 'why' },
    { kind: 'message', role: 'assistant', text: 'nothing' },
  ]), true);
});
