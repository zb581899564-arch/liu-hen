(function (globalScope) {
  'use strict';

  const SPLASH_LINES = [
    '那年抓住了一只蝉，就以为抓住了永远',
    '断不了的是思念，藏起来的是回声',
    '有些话没说完，就留在风里',
    '后来才懂，重逢也会迟到',
    '时间往前走，有些名字还在原地',
    '愿你偶尔想起，也只是轻轻一下',
    '不是所有告别，都真的结束',
  ];

  function chooseSplashLine(randomFn) {
    const random = typeof randomFn === 'function' ? randomFn : Math.random;
    const index = Math.min(SPLASH_LINES.length - 1, Math.floor(random() * SPLASH_LINES.length));
    return SPLASH_LINES[index];
  }

  function hydrateSplashCopy(documentRef, randomFn) {
    if (!documentRef || !documentRef.querySelector) {
      return '';
    }
    const lineElement = documentRef.querySelector('[data-role="startup-splash-line"]');
    const line = chooseSplashLine(randomFn);
    if (lineElement) {
      lineElement.textContent = line;
    }
    return line;
  }

  const api = { SPLASH_LINES, chooseSplashLine, hydrateSplashCopy };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileSplashCopy = api;
    hydrateSplashCopy(window.document);
  } else if (globalScope) {
    globalScope.ExProfileSplashCopy = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
