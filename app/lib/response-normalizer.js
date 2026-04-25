(function (globalScope) {
  'use strict';

  function normalizeAssistantText(text) {
    const rawText = String(text || '');
    let visibleText = rawText
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
      .replace(/<analysis>[\s\S]*?<\/analysis>/gi, '');

    const finalAnswerMatch = visibleText.match(/(?:最终回答|最终答案|最后回答|回答|答复|Final answer|Answer)\s*[：:】\]]\s*([\s\S]*)/i);
    if (finalAnswerMatch && finalAnswerMatch[1]) {
      visibleText = finalAnswerMatch[1];
    } else {
      visibleText = visibleText
        .replace(/(?:^|\n)\s*[【\[]?(?:思考过程|思维链|推理过程|推理|思考|分析|Reasoning|Chain of thought|Analysis)[】\]]?\s*[：:]\s*[^\n]*(?:\n|$)/gi, '\n')
        .replace(/(?:^|\n)\s*[【\[]?(?:思考过程|思维链|推理过程|推理|思考|分析|Reasoning|Chain of thought|Analysis)[】\]]\s*[^\n]*(?:\n|$)/gi, '\n');
    }

    visibleText = visibleText.trim();
    return { rawText, visibleText };
  }

  const api = { normalizeAssistantText };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileResponseNormalizer = api;
  } else if (globalScope) {
    globalScope.ExProfileResponseNormalizer = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
