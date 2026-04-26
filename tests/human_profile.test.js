const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  createHumanProfileInsight,
} = require(path.join(__dirname, '..', 'app', 'lib', 'human-profile.js'));

test('createHumanProfileInsight distills weather, phase, and memory seeds from profile text', () => {
  const insight = createHumanProfileInsight({
    displayName: 'Sample Contact',
    sections: {
      persona: '话少，有点嘴硬，但会默默关心。喜欢用短句。',
      relationship_context: '关系里有距离感，也有旧习惯。',
      response_patterns: '先怼一句，再轻轻接住。',
      memories: '那年夏天一起等雨。她说过别总熬夜。',
    },
  });

  assert.equal(insight.weather.label, '小雨');
  assert.match(insight.weather.line, /旧习惯|关心|距离/);
  assert.equal(insight.relationPhase, '试探');
  assert.ok(insight.memorySeeds.some((item) => item.includes('别总熬夜')));
  assert.match(insight.runtimeHint, /profile/);
  assert.match(insight.runtimeHint, /旧记忆/);
});

test('createHumanProfileInsight keeps output graceful when profile is sparse', () => {
  const insight = createHumanProfileInsight({ displayName: 'Contact A', sections: {} });

  assert.equal(insight.weather.label, '微风');
  assert.equal(insight.relationPhase, '熟悉');
  assert.ok(insight.unsentLine.length > 0);
  assert.ok(insight.memorySeeds.length > 0);
});
