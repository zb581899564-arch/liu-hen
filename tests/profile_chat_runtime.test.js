const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  createProfileBundle,
  buildSystemPrompt,
  buildChatPayload,
  windowsPathToFileUrl,
  createProfileBundleFromFiles,
} = require(path.join(__dirname, '..', 'runtime', 'chat-runtime.js'));

test('createProfileBundle assembles required profile artifacts', () => {
  const bundle = createProfileBundle({
    'meta.json': JSON.stringify({
      slug: 'sample-contact',
      name: 'Contact A',
      participants: {
        user: 'User A',
        target: 'Contact A',
      },
    }),
    'persona.md': '# Persona\nShort and sharp.',
    'relationship_context.md': '# Relationship\nClose but guarded.',
    'response_patterns.md': '# Response\nShort reply first.',
    'memories.md': '# Memories\nQuotes old messages.',
    'sticker_profile.json': JSON.stringify({
      default_style: 'short_reaction_then_soften',
      high_frequency_md5: [
        {
          md5: 'abc',
          count: 12,
          path: 'G:\\ai\\llm\\前任skill\\聊天记录\\emojis\\abc.gif',
        },
      ],
    }),
  });

  assert.equal(bundle.meta.slug, 'sample-contact');
  assert.equal(bundle.displayName, 'Contact A');
  assert.equal(bundle.sections.persona.includes('Short and sharp'), true);
  assert.equal(bundle.stickerProfile.high_frequency_md5[0].md5, 'abc');
});

test('buildSystemPrompt describes relationship simulation and sticker rules', () => {
  const prompt = buildSystemPrompt({
    meta: {
      name: 'Contact A',
      participants: {
        user: 'User A',
        target: 'Contact A',
      },
    },
    sections: {
      persona: '# Persona\nShort and sharp.',
      relationship_context: '# Relationship\nClose but guarded.',
      response_patterns: '# Response\nShort reply first.',
      memories: '# Memories\nQuotes old messages.',
    },
    stickerProfile: {
      default_style: 'short_reaction_then_soften',
      usage_rules: ['Use stickers for short reactions.'],
      avoid: ['Sticker spam'],
      high_frequency_md5: [
        {
          md5: 'abc',
          count: 12,
          path: 'G:\\ai\\llm\\前任skill\\聊天记录\\emojis\\abc.gif',
        },
      ],
    },
  });

  assert.match(prompt, /Contact A/);
  assert.match(prompt, /User A/);
  assert.match(prompt, /sticker/i);
  assert.match(prompt, /abc/);
});

test('buildChatPayload creates OpenAI compatible messages', () => {
  const payload = buildChatPayload({
    model: 'gpt-4.1-mini',
    systemPrompt: 'You are Contact A.',
    history: [
      { role: 'user', content: 'What are you doing?' },
      { role: 'assistant', content: 'Busy.' },
    ],
    userMessage: 'Talk nicely',
  });

  assert.equal(payload.model, 'gpt-4.1-mini');
  assert.equal(payload.messages[0].role, 'system');
  assert.equal(payload.messages[payload.messages.length - 1].content, 'Talk nicely');
});

test('windowsPathToFileUrl converts local sticker path to file url', () => {
  const fileUrl = windowsPathToFileUrl('G:\\ai\\llm\\前任skill\\聊天记录\\emojis\\abc.gif');
  assert.equal(
    fileUrl,
    'file:///<workspace>/%E5%89%8D%E4%BB%BBskill/%E8%81%8A%E5%A4%A9%E8%AE%B0%E5%BD%95/emojis/abc.gif'
  );
});

test('createProfileBundleFromFiles reads browser File objects', async () => {
  const files = [
    new File([JSON.stringify({
      slug: 'sample-contact',
      name: 'Contact A',
      participants: { user: 'User A', target: 'Contact A' },
    })], 'meta.json', { type: 'application/json' }),
    new File(['# Persona\nShort and sharp.'], 'persona.md', { type: 'text/markdown' }),
    new File(['# Relationship\nClose but guarded.'], 'relationship_context.md', { type: 'text/markdown' }),
    new File(['# Response\nShort reply first.'], 'response_patterns.md', { type: 'text/markdown' }),
    new File(['# Memories\nQuotes old messages.'], 'memories.md', { type: 'text/markdown' }),
    new File([JSON.stringify({
      default_style: 'short_reaction_then_soften',
      high_frequency_md5: [{ md5: 'abc', count: 12, path: 'G:\\ai\\llm\\前任skill\\聊天记录\\emojis\\abc.gif' }],
    })], 'sticker_profile.json', { type: 'application/json' }),
  ];

  const bundle = await createProfileBundleFromFiles(files);

  assert.equal(bundle.displayName, 'Contact A');
  assert.equal(bundle.userName, 'User A');
});

test('android host adapter exposes desktop-safe fallback', async () => {
  const androidHost = require(path.join(__dirname, '..', 'app', 'lib', 'android-host.js'));
  const host = androidHost.createAndroidHostAdapter({});
  const settings = await host.loadSettings();
  assert.deepEqual(settings, { baseUrl: '', apiKey: '', model: '' });
});
