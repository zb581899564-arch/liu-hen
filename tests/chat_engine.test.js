const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeAssistantText } = require('../app/lib/response-normalizer.js');
const { extractStickerMarker } = require('../app/lib/sticker-resolver.js');
const { buildChatRequest, buildProactiveChatRequest } = require('../app/lib/chat-engine.js');

test('normalizeAssistantText hides think tags but keeps final text', () => {
  const result = normalizeAssistantText('<think>secret</think>okay, say it first.');
  assert.equal(result.visibleText, 'okay, say it first.');
  assert.equal(result.rawText.includes('<think>'), true);
});

test('normalizeAssistantText hides common reasoning sections before final answer', () => {
  const result = normalizeAssistantText('Thoughts: hidden\nFinal answer: hey, what are you doing?');
  assert.equal(result.visibleText, 'hey, what are you doing?');
});

test('normalizeAssistantText hides reasoning xml blocks', () => {
  const result = normalizeAssistantText('<reasoning>private steps</reasoning>\nhello');
  assert.equal(result.visibleText, 'hello');
});

test('normalizeAssistantText hides bracketed reasoning sections before answer', () => {
  const result = normalizeAssistantText('[Thought]\nprivate\n[Answer]\nhello there');
  assert.equal(result.visibleText, 'hello there');
});

test('normalizeAssistantText hides reasoning preface when no final marker exists', () => {
  const result = normalizeAssistantText('Reasoning: private first\nstill miss you');
  assert.equal(result.visibleText, 'still miss you');
});

test('extractStickerMarker finds md5 marker', () => {
  assert.equal(extractStickerMarker('hi [sticker:abc123]'), 'abc123');
});

test('extractStickerMarker accepts md5 equals marker format from model output', () => {
  assert.equal(
    extractStickerMarker('[[sticker:md5=a6320e6d9fafc4421191425f5c06b225]]'),
    'a6320e6d9fafc4421191425f5c06b225'
  );
});

test('buildChatRequest assembles system prompt and messages', () => {
  const payload = buildChatRequest({
    profile: {
      displayName: 'Contact A',
      userName: 'User A',
      sections: {
        persona: 'Short replies.',
        relationship_context: 'A little guarded.',
        response_patterns: 'Lead with short answers.',
        memories: 'Can quote old lines.',
      },
      stickerProfile: { usage_rules: [], avoid: [], high_frequency_md5: [] },
    },
    history: [{ role: 'assistant', content: 'hi' }],
    message: 'what are you doing',
    settings: { model: 'deepseek-chat', temperature: 0.9 },
  });

  assert.equal(payload.model, 'deepseek-chat');
  assert.equal(payload.messages[0].role, 'system');
  assert.equal(payload.messages[payload.messages.length - 1].content, 'what are you doing');
});

test('buildChatRequest tells the model to handle batched messages like a real chat', () => {
  const payload = buildChatRequest({
    profile: {
      displayName: 'Contact A',
      userName: 'User A',
      sections: {
        persona: 'Short replies.',
        relationship_context: 'A little guarded.',
        response_patterns: 'Lead with short answers.',
        memories: 'Can quote old lines.',
      },
      stickerProfile: { usage_rules: [], avoid: [], high_frequency_md5: [] },
    },
    history: [],
    message: 'first\nsecond',
    settings: { model: 'deepseek-chat' },
  });

  assert.match(payload.messages[0].content, /2-3/);
  assert.match(payload.messages[0].content, /Turn Safety/);
  assert.match(payload.messages[0].content, /same turn/);
  assert.match(payload.messages[0].content, /clarify your previous line/);
  assert.equal(payload.messages[payload.messages.length - 1].content, 'first\nsecond');
});

test('buildChatRequest prioritizes SKILL.md prompt and asks for structured messages', () => {
  const payload = buildChatRequest({
    profile: {
      displayName: 'Xiao Mei',
      userName: 'User A',
      skillPrompt: '# Xiao Mei Skill\nUse this exact runtime.',
      sections: {
        persona: 'Do not lead with this old fallback.',
        relationship_context: '',
        response_patterns: '',
        memories: '',
      },
      stickerProfile: { high_frequency_md5: [] },
    },
    history: [],
    message: 'hi',
    settings: { model: 'deepseek-chat' },
  });

  assert.match(payload.messages[0].content, /# Xiao Mei Skill/);
  assert.match(payload.messages[0].content, /structured-messages-v1/);
  assert.doesNotMatch(payload.messages[0].content, /Do not lead with this old fallback/);
});

test('buildChatRequest adds sticker discipline to the runtime adapter prompt', () => {
  const payload = buildChatRequest({
    profile: {
      displayName: 'Xiao Mei',
      userName: 'User A',
      skillPrompt: '# Xiao Mei Skill',
      sections: {},
      stickerProfile: { high_frequency_md5: [{ md5: 'abc123', count: 8 }] },
    },
    history: [
      { role: 'assistant', content: '[[sticker:md5=abc123]]' },
      { role: 'user', content: 'hello' },
    ],
    message: 'hi',
    settings: { model: 'deepseek-chat' },
  });

  assert.match(payload.messages[0].content, /sticker/i);
  assert.match(payload.messages[0].content, /md5=abc123/);
});

test('buildChatRequest includes positive sticker habits from the profile', () => {
  const payload = buildChatRequest({
    profile: {
      displayName: 'Xiao Mei',
      userName: 'User A',
      skillPrompt: '# Xiao Mei Skill',
      sections: {},
      stickerProfile: {
        default_style: 'short_reaction_then_soften',
        usage_rules: [
          'Stickers often carry the short reaction by themselves.',
          'Use a sticker to soften the tone after a brief line when it fits.'
        ],
        avoid: ['Do not spam stickers.'],
        high_frequency_md5: [{ md5: 'abc123', count: 8 }],
      },
    },
    history: [],
    message: 'hi',
    settings: { model: 'deepseek-chat' },
  });

  assert.match(payload.messages[0].content, /short_reaction_then_soften/);
  assert.match(payload.messages[0].content, /carry the short reaction/i);
  assert.match(payload.messages[0].content, /soften the tone/i);
});

test('buildChatRequest includes humanistic profile runtime guidance', () => {
  const payload = buildChatRequest({
    profile: {
      displayName: 'Xiao Mei',
      userName: 'User A',
      sections: {
        persona: 'Quiet but sharp.',
        relationship_context: 'There is distance in the relationship.',
        response_patterns: 'Short first, then catch the feeling.',
        memories: 'We once waited out the rain together.',
      },
      humanInsight: {
        weather: { label: 'Light Rain', line: 'Speaks less, but still looks back at you.' },
        relationPhase: 'Tentative',
        memorySeeds: ['We once waited out the rain together.'],
      },
      stickerProfile: { high_frequency_md5: [] },
    },
    history: [],
    message: 'hi',
    settings: { model: 'deepseek-chat' },
  });

  assert.match(payload.messages[0].content, /Light Rain/);
  assert.match(payload.messages[0].content, /Tentative/);
  assert.match(payload.messages[0].content, /waited out the rain/);
});

test('buildProactiveChatRequest asks assistant to start a natural conversation', () => {
  const payload = buildProactiveChatRequest({
    profile: {
      displayName: 'Contact A',
      userName: 'User A',
      sections: {
        persona: 'Short replies.',
        relationship_context: 'A little guarded.',
        response_patterns: 'Lead with short answers.',
        memories: 'Can quote old lines.',
      },
      stickerProfile: { usage_rules: [], avoid: [], high_frequency_md5: [{ md5: 'abc123', count: 3 }] },
    },
    history: [{ role: 'user', content: 'good night' }],
    settings: { model: 'deepseek-chat' },
  });

  assert.equal(payload.model, 'deepseek-chat');
  assert.match(payload.messages[payload.messages.length - 1].content, /sticker/);
});
