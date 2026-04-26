(function (globalScope) {
  'use strict';

  function buildStickerGuide(stickerProfile) {
    const topStickers = Array.isArray(stickerProfile && stickerProfile.high_frequency_md5)
      ? stickerProfile.high_frequency_md5.slice(0, 6)
      : [];

    if (!topStickers.length) {
      return 'No sticker examples are available.';
    }

    return topStickers.map(function (item) {
      return '- md5=' + item.md5 + ', count=' + item.count;
    }).join('\n');
  }

  function buildStickerHabits(stickerProfile) {
    const profile = stickerProfile || {};
    const usageRules = Array.isArray(profile.usage_rules) ? profile.usage_rules.slice(0, 4) : [];
    const avoidRules = Array.isArray(profile.avoid) ? profile.avoid.slice(0, 3) : [];
    const lines = [];

    if (profile.default_style) {
      lines.push('Profile sticker style: ' + profile.default_style);
    }

    usageRules.forEach(function (rule) {
      lines.push('- habit: ' + rule);
    });

    avoidRules.forEach(function (rule) {
      lines.push('- avoid: ' + rule);
    });

    return lines.join('\n');
  }

  function buildStickerDiscipline() {
    return [
      'When the profile suggests playful, embarrassed, speech-softening, or short-reaction moments, it is okay to send one sticker instead of extra text.',
      'Use stickers sparingly and only when the tone truly calls for them.',
      'Do not append a sticker to every reply as a habit.',
      'Do not repeat the same sticker again and again.',
      'If you output a sticker, it must be its own message and must use one of the allowed md5 values.',
    ].join('\n');
  }

  function buildHumanisticRuntimeHint(profile) {
    const insight = profile && profile.humanInsight;
    if (!insight) {
      return '';
    }

    const weather = insight.weather || {};
    const seeds = Array.isArray(insight.memorySeeds) ? insight.memorySeeds : [];

    return [
      '[Humanistic Runtime Hint]',
      'These hints come from the profile and shared history. Do not explain them to the user; turn them into tone and timing.',
      'Emotional weather: ' + (weather.label || 'Soft Wind') + (weather.line ? ' - ' + weather.line : ''),
      'Relationship phase: ' + (insight.relationPhase || 'Familiar'),
      seeds.length ? 'Memory seeds: ' + seeds.slice(0, 4).join(' / ') : '',
      'Silence also counts as interaction. If the user does not reply, you may hold back instead of pushing.',
    ].filter(Boolean).join('\n');
  }

  function buildTurnSafetyRules() {
    return [
      '[Turn Safety]',
      'Do not ask a user-facing question and then answer it yourself in the same turn.',
      'If you ask the user a question, stop that turn there unless every earlier message is clearly your own context before the question.',
      'If the user only replies with "?", "啊？", "什么意思", or another ambiguous short reaction, clarify your previous line instead of inventing a new question from the user.',
      'Never roleplay both sides of the conversation.',
    ].join('\n');
  }

  function buildRuntimeAdapterRules(profile) {
    return [
      '[Runtime Adapter]',
      'You are running inside the ExSkill Runtime Adapter.',
      'Follow the profile and relationship faithfully.',
      'If SKILL.md does not override the output format, the reply must be structured-messages-v1 JSON.',
      'Do not output markdown explanations and do not wrap JSON in code fences.',
      buildTurnSafetyRules(),
      '',
      '[Sticker Rules]',
      'If you output sticker messages, only use allowed sticker md5 values.',
      buildStickerDiscipline(),
      buildStickerHabits(profile && profile.stickerProfile),
      buildStickerGuide(profile && profile.stickerProfile),
      buildHumanisticRuntimeHint(profile),
    ].filter(Boolean).join('\n');
  }

  function buildFallbackPrompt(profile) {
    const sections = (profile && profile.sections) || {};

    return [
      'Please roleplay as ' + ((profile && profile.displayName) || 'the other person') + ' while chatting with ' + ((profile && profile.userName) || 'the user') + '.',
      'Stay in character. Do not explain the setup. Do not sound like a generic assistant.',
      'Keep the familiarity, distance, and speech habits consistent with the profile.',
      'If the user sends multiple short messages in a row, treat them as one real chat turn and reply to the whole burst instead of answering line by line.',
      'A reply can be one short message or naturally split into 2-3 short messages.',
      buildTurnSafetyRules(),
      '[Persona]',
      sections.persona || '',
      '[Relationship Context]',
      sections.relationship_context || '',
      '[Response Patterns]',
      sections.response_patterns || '',
      '[Shared Memories]',
      sections.memories || '',
      buildHumanisticRuntimeHint(profile),
      '[Sticker Rules]',
      'If you need a sticker, use [[sticker:md5=...]] only as its own message.',
      buildStickerDiscipline(),
      buildStickerHabits(profile && profile.stickerProfile),
      buildStickerGuide(profile && profile.stickerProfile),
    ].filter(Boolean).join('\n');
  }

  function buildSystemPrompt(profile) {
    if (profile && profile.skillPrompt) {
      return [
        String(profile.skillPrompt || '').trim(),
        '',
        buildRuntimeAdapterRules(profile),
      ].join('\n');
    }

    return buildFallbackPrompt(profile);
  }

  function buildChatRequest(options) {
    const settings = options.settings || {};
    return {
      model: settings.model,
      temperature: typeof settings.temperature === 'number' ? settings.temperature : 0.9,
      messages: [
        { role: 'system', content: buildSystemPrompt(options.profile) },
        ...(options.history || []),
        { role: 'user', content: options.message },
      ],
    };
  }

  function buildProactiveChatRequest(options) {
    const settings = options.settings || {};
    return {
      model: settings.model,
      temperature: typeof settings.temperature === 'number' ? settings.temperature : 0.95,
      messages: [
        { role: 'system', content: buildSystemPrompt(options.profile) },
        ...(options.history || []),
        {
          role: 'user',
          content: [
            'Start a natural conversation proactively.',
            'Sound like a real message, not a system notification.',
            'Send one short opening message.',
            'If the recent context already has unanswered proactive messages, either hold back or send only a very light continuation.',
            'You may use a sticker if it truly fits, but only with the allowed sticker md5 values.',
            'Do not claim to have seen real-world photos, posts, or events unless the chat context already contains them.',
          ].join('\n'),
        },
      ],
    };
  }

  function buildContinuationPrompt(continuation) {
    const source = continuation || {};
    return [
      'Continue the current conversation naturally.',
      'This is not a brand-new topic unless the intent explicitly shifts gently.',
      'Most of the time send one short message; occasionally two.',
      'Do not ask a question and answer it yourself.',
      'Do not roleplay both sides.',
      'If it is not a good time to continue, keep the line light and soft.',
      'Intent: ' + (source.intent || 'addendum'),
      'Source: ' + (source.source || 'reply'),
      'Consecutive assistant count: ' + String(source.consecutiveAssistantCount || 0),
    ].join('\n');
  }

  function buildContinuationChatRequest(options) {
    const settings = options.settings || {};
    return {
      model: settings.model,
      temperature: typeof settings.temperature === 'number' ? settings.temperature : 0.92,
      messages: [
        { role: 'system', content: buildSystemPrompt(options.profile) },
        {
          role: 'user',
          content: buildContinuationPrompt(options.continuation),
        },
        ...(options.history || []),
      ],
    };
  }

  const api = { buildSystemPrompt, buildChatRequest, buildProactiveChatRequest, buildContinuationChatRequest };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileChatEngine = api;
  } else if (globalScope) {
    globalScope.ExProfileChatEngine = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
