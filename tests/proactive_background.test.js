const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readMainSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'app', 'main.js'), 'utf8');
}

test('proactive chat can run while the app is backgrounded', () => {
  const source = readMainSource();
  const runMatch = source.match(/async function runProactiveChat\(\) \{[\s\S]*?\n  \}/);

  assert.ok(runMatch, 'runProactiveChat should exist');
  assert.doesNotMatch(runMatch[0], /document\.hidden/);
});

test('visibility changes do not cancel the proactive chat timer', () => {
  const source = readMainSource();
  const visibilityMatch = source.match(/document\.addEventListener\('visibilitychange'[\s\S]*?\n    \}\);/);

  assert.ok(visibilityMatch, 'visibilitychange handler should exist');
  assert.doesNotMatch(visibilityMatch[0], /clearTimeout\(proactiveTimerId\)/);
});

test('overdue proactive resume invalidates the old timer callback', () => {
  const source = readMainSource();
  const visibilityMatch = source.match(/document\.addEventListener\('visibilitychange'[\s\S]*?\n    \}\);/);

  assert.ok(visibilityMatch, 'visibilitychange handler should exist');
  assert.match(source, /let proactiveTimerToken = 0/);
  assert.match(source, /const timerToken = proactiveTimerToken/);
  assert.match(source, /timerToken !== proactiveTimerToken/);
  assert.match(visibilityMatch[0], /proactiveTimerToken \+= 1/);
});

test('fresh installs open on the wechat list instead of the removed bundled contact', () => {
  const source = readMainSource();

  assert.match(source, /window\.location\.hash = '#\/wechat'/);
  assert.doesNotMatch(source, /window\.location\.hash = '#\/chat\/sample-contact'/);
});

test('permanent contacts keep the original contact name instead of generic numbering', () => {
  const source = readMainSource();

  assert.doesNotMatch(source, /displayName: '永久联系�? \+ \(index \+ 1\)/);
});

test('wechat list uses permanent contacts as the only canonical contact rows', () => {
  const source = readMainSource();

  assert.doesNotMatch(source, /contacts = contacts\.concat\(permanentContacts\)/);
  assert.match(source, /source: 'permanent'/);
  assert.match(source, /baseSlug: baseSlug/);
});

test('proactive chat respects do not disturb mode', () => {
  const source = readMainSource();
  const runMatch = source.match(/async function runProactiveChat\(\) \{[\s\S]*?\n  \}/);

  assert.ok(runMatch, 'runProactiveChat should exist');
  assert.match(source, /let doNotDisturbEnabled = Boolean/);
  assert.match(runMatch[0], /doNotDisturbEnabled/);
});

test('proactive chat has a watchdog for missed mobile timers', () => {
  const source = readMainSource();

  assert.match(source, /let proactiveWatchdogId = null/);
  assert.match(source, /function startProactiveWatchdog\(\)/);
  assert.match(source, /window\.setInterval\(/);
  assert.match(source, /runProactiveWatchdog/);
});

test('foreground proactive heartbeat refreshes countdowns and checks overdue contacts without relying only on timers', () => {
  const source = readMainSource();

  assert.match(source, /let proactiveHeartbeatFrameId = null/);
  assert.match(source, /function startProactiveHeartbeat\(\)/);
  assert.match(source, /window\.requestAnimationFrame/);
  assert.match(source, /runProactiveWatchdog\(\)/);
  assert.match(source, /refreshProactiveStatusLabels\(\)/);
});

test('foreground proactive heartbeat does not request animation frames continuously', () => {
  const source = readMainSource();
  const heartbeatMatch = source.match(/function runProactiveHeartbeat\(\) \{[\s\S]*?\n  \}/);

  assert.ok(heartbeatMatch, 'runProactiveHeartbeat should exist');
  assert.match(source, /let proactiveHeartbeatTimeoutId = null/);
  assert.doesNotMatch(heartbeatMatch[0], /requestAnimationFrame\(runProactiveHeartbeat\)/);
  assert.match(source, /scheduleProactiveHeartbeatTick/);
});

test('contact settings receives live proactive diagnostics', () => {
  const source = readMainSource();

  assert.match(source, /let proactiveLastAttemptBySlug = \{\}/);
  assert.match(source, /function getProactiveDiagnosticsForContact/);
  assert.match(source, /proactiveDiagnostics: getProactiveDiagnosticsForContact/);
});

test('pending user batches stay quiet until the actual reply request begins', () => {
  const source = readMainSource();
  const batchMatch = source.match(/function scheduleUserReplyBatch\(contact, userMessage\) \{[\s\S]*?\n  \}/);

  assert.ok(batchMatch, 'scheduleUserReplyBatch should exist');
  assert.doesNotMatch(batchMatch[0], /ensureAssistantTypingPlaceholder\(contact\)/);
  assert.doesNotMatch(source, /pendingUserBatchBySlug\[route\.slug\] \|\| pendingTypingMessageBySlug\[route\.slug\]/);
});

test('scheduled assistant follow-up messages have a watchdog instead of relying only on timers', () => {
  const source = readMainSource();

  assert.match(source, /function runScheduledMessageWatchdog\(\)/);
  assert.match(source, /processDueScheduledMessages\(slug\)/);
  assert.match(source, /Object\.keys\(scheduledBySlug \|\| \{\}\)\.forEach/);
});

test('automatic proactive chain only advances the next schedule after a real attempt result', () => {
  const source = readMainSource();
  const runMatch = source.match(/async function runProactiveChat\(\) \{[\s\S]*?\n  \}/);

  assert.ok(runMatch, 'runProactiveChat should exist');
  assert.match(runMatch[0], /const proactiveResult = await deliverProactiveMessage/);
  assert.match(runMatch[0], /if \(proactiveResult && proactiveResult\.attempted\)/);
});

test('automatic proactive failures are surfaced instead of silently disappearing', () => {
  const source = readMainSource();
  const runMatch = source.match(/async function runProactiveChat\(\) \{[\s\S]*?\n  \}/);

  assert.ok(runMatch, 'runProactiveChat should exist');
  assert.match(runMatch[0], /showError: true/);
  assert.match(source, /errorPrefix/);
});

test('assistant replies use the structured message protocol and scheduled queue', () => {
  const source = readMainSource();

  assert.match(source, /ExProfileMessageProtocol/);
  assert.match(source, /buildAssistantMessages/);
  assert.match(source, /enqueueScheduledAssistantMessages/);
  assert.match(source, /scheduledBySlug/);
});

test('proactive chat does not auto-attach old local image assets', () => {
  const source = readMainSource();

  assert.doesNotMatch(source, /proactiveImageLibrary/);
  assert.doesNotMatch(source, /buildProactiveImageMessage/);
  assert.doesNotMatch(source, /attachmentType:\s*'image'[\s\S]*imageUrl:\s*image\.imageUrl/);
});

test('changing proactive settings resets the existing countdown for that contact', () => {
  const source = readMainSource();

  assert.match(source, /function resetProactiveScheduleForSlug\(slug\)/);
  assert.match(source, /resetProactiveScheduleForSlug\(route\.slug\)/);
});

test('main proactive flow persists runtime state and schedules continuations', () => {
  const source = readMainSource();

  assert.match(source, /loadProactiveRuntime/);
  assert.match(source, /saveProactiveRuntime/);
  assert.match(source, /scheduleContinuationForContact/);
  assert.match(source, /clearContinuationTimer/);
  assert.match(source, /buildContinuationChatRequest/);
});
