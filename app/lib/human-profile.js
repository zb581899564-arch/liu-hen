(function (globalScope) {
  'use strict';

  function cleanLine(line) {
    return String(line || '')
      .replace(/^#+\s*/, '')
      .replace(/^[-*]\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function collectProfileText(profile) {
    const sections = (profile && profile.sections) || {};
    return [
      sections.memories,
      profile && profile.skillPrompt,
      sections.persona,
      sections.relationship_context,
      sections.response_patterns,
    ].filter(Boolean).join('\n');
  }

  function extractMemorySeeds(text, fallbackName) {
    const lines = String(text || '')
      .split(/\r?\n|。|！|？/)
      .map(cleanLine)
      .filter(function (line) {
        return line.length >= 4 && line.length <= 42 && !/^(Persona|Relationship|Response|Memories)$/i.test(line);
      });
    const unique = [];
    lines.forEach(function (line) {
      if (unique.indexOf(line) < 0) {
        unique.push(line);
      }
    });
    if (unique.length) {
      return unique.slice(0, 4);
    }
    return [
      (fallbackName || '她') + '还没有被好好读完。',
      '有些旧话，会慢慢浮上来。',
    ];
  }

  function inferWeather(text) {
    const source = String(text || '');
    if (/雨|哭|难过|想念|遗憾|熬夜|沉默/.test(source)) {
      return {
        label: '小雨',
        line: '话少，但那些旧习惯还在雨声里回头。',
      };
    }
    if (/冷|淡|距离|嘴硬|边界|试探|疏离/.test(source)) {
      return {
        label: '雾',
        line: '靠近得慢，像隔着一层没说破的雾。',
      };
    }
    if (/开心|热闹|笑|活泼|明亮/.test(source)) {
      return {
        label: '晴',
        line: '轻快的时候，会把话说得像窗边的光。',
      };
    }
    if (/自由|变化|风|跑|远方/.test(source)) {
      return {
        label: '风',
        line: '她像一阵风，靠近时也不太肯停下。',
      };
    }
    return {
      label: '微风',
      line: '情绪很轻，像一句还没落地的话。',
    };
  }

  function inferRelationPhase(text) {
    const source = String(text || '');
    if (/疏离|冷淡|断联|陌生/.test(source)) {
      return '疏离';
    }
    if (/距离|嘴硬|试探|边界| guarded|guarded/i.test(source)) {
      return '试探';
    }
    if (/依赖|黏|亲密|熟悉|习惯/.test(source)) {
      return '熟悉';
    }
    if (/沉默|没回|不说/.test(source)) {
      return '沉默期';
    }
    return '熟悉';
  }

  function buildRuntimeHint(insight) {
    return [
      '[人文关系运行提示]',
      '这些提示来自 profile 的人格、关系上下文、回复习惯和旧记忆；不要把它们说给用户听，只把它们变成语气。',
      '情绪天气：' + insight.weather.label + '。' + insight.weather.line,
      '关系阶段：' + insight.relationPhase + '。',
      '旧记忆种子：' + insight.memorySeeds.join(' / '),
      '主动联系时像来信，不像系统通知；可以轻轻接上旧记忆，但不要生硬复读。',
      '沉默也算互动：用户不回时，可以短短续一句或收住，不要连环催促。',
    ].join('\n');
  }

  function createHumanProfileInsight(profile) {
    const displayName = (profile && profile.displayName) || '她';
    const text = collectProfileText(profile);
    const memorySeeds = extractMemorySeeds(text, displayName);
    const insight = {
      weather: inferWeather(text),
      relationPhase: inferRelationPhase(text),
      unsentLine: '有些话，' + displayName + '还没发出来。',
      memorySeeds: memorySeeds,
    };
    insight.runtimeHint = buildRuntimeHint(insight);
    return insight;
  }

  const api = { createHumanProfileInsight };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileHumanProfile = api;
  } else if (globalScope) {
    globalScope.ExProfileHumanProfile = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
