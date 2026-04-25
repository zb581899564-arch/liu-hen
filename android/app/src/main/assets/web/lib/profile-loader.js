(function (globalScope) {
  'use strict';

  const REQUIRED_FILES = [
    'meta.json',
    'persona.md',
    'relationship_context.md',
    'response_patterns.md',
    'memories.md',
    'sticker_profile.json',
    'sticker_library.json',
  ];
  const EX_SKILL_REQUIRED_FILES = [
    'meta.json',
    'SKILL.md',
    'persona.md',
    'memories.md',
  ];

  function pickDisplayName(meta) {
    return (
      (meta && meta.participants && meta.participants.target) ||
      (meta && meta.name) ||
      (meta && meta.slug) ||
      '未命名 Profile'
    );
  }

  function pickUserName(meta) {
    return (meta && meta.participants && meta.participants.user) || '用户';
  }

  function parseBridgeJson(rawText) {
    let json;
    try {
      json = JSON.parse(String(rawText || '{}'));
    } catch (_error) {
      throw new Error('原生读取返回不是合法 JSON');
    }

    if (json && json.error) {
      throw new Error(String(json.error));
    }

    return json;
  }

  function getNativeBridge() {
    return globalScope && globalScope.AndroidBridge ? globalScope.AndroidBridge : null;
  }

  function isMissingStickerError(error) {
    const message = String(error && error.message || error || '').toLowerCase();
    return (
      message.indexOf('loadstickerdataurl') !== -1 ||
      message.indexOf('sticker not found') !== -1 ||
      message.indexOf('invalid sticker path') !== -1
    );
  }

  function hasAllFiles(fileMap, names) {
    return names.every(function (name) {
      return Boolean(fileMap[name]);
    });
  }

  function collectPrefixedFiles(fileMap, prefixes) {
    const collected = {};
    Object.keys(fileMap || {}).forEach(function (name) {
      if (prefixes.some(function (prefix) { return name.indexOf(prefix) === 0; })) {
        collected[name] = fileMap[name];
      }
    });
    return collected;
  }

  async function loadProfileFromFileMap(fileMap) {
    const isAppProfile = hasAllFiles(fileMap, REQUIRED_FILES);
    const isExSkillProfile = hasAllFiles(fileMap, EX_SKILL_REQUIRED_FILES);
    if (!isAppProfile && !isExSkillProfile) {
      const expected = REQUIRED_FILES.concat(EX_SKILL_REQUIRED_FILES.filter(function (name) {
        return REQUIRED_FILES.indexOf(name) < 0;
      }));
      const missing = expected.filter(function (name) {
        return !fileMap[name];
      });
      throw new Error('missing profile files: ' + missing.join(', '));
    }

    const meta = JSON.parse(fileMap['meta.json']);
    return {
      meta: meta,
      format: fileMap['SKILL.md'] ? 'ex-skill' : 'exprofile',
      skillPrompt: fileMap['SKILL.md'] || '',
      knowledgeFiles: collectPrefixedFiles(fileMap, ['knowledge/', 'versions/']),
      sections: {
        persona: fileMap['persona.md'] || '',
        relationship_context: fileMap['relationship_context.md'] || '',
        response_patterns: fileMap['response_patterns.md'] || '',
        memories: fileMap['memories.md'] || '',
      },
      stickerProfile: fileMap['sticker_profile.json']
        ? JSON.parse(fileMap['sticker_profile.json'])
        : { high_frequency_md5: [] },
      stickerLibrary: fileMap['sticker_library.json']
        ? JSON.parse(fileMap['sticker_library.json'])
        : { stickers: [] },
      displayName: pickDisplayName(meta),
      userName: pickUserName(meta),
    };
  }

  function findArchiveEntry(archive, name) {
    if (archive.file(name)) {
      return archive.file(name);
    }
    if (archive.file('profile/' + name)) {
      return archive.file('profile/' + name);
    }
    const archiveNames = Object.keys(archive.files || {});
    const nestedName = archiveNames.find(function (entryName) {
      return entryName.slice(-name.length - 1) === '/' + name;
    });
    return nestedName ? archive.file(nestedName) : null;
  }

  async function loadProfileFromNativeBridge(archiveUrl) {
    const bridge = getNativeBridge();
    if (!bridge) {
      return null;
    }

    let response;
    try {
      response = parseBridgeJson(bridge.loadProfileFiles(archiveUrl));
    } catch (error) {
      if (String(error && error.message || error).indexOf('loadProfileFiles') !== -1) {
        return null;
      }
      throw error;
    }
    if (!response.files) {
      return null;
    }

    const bundle = await loadProfileFromFileMap(response.files);
    bundle.nativeLocation = archiveUrl;
    bundle._stickerUrlCache = {};
    return bundle;
  }

  async function loadProfileFromArchiveUrl(archiveUrl) {
    const nativeBundle = await loadProfileFromNativeBridge(archiveUrl);
    if (nativeBundle) {
      return nativeBundle;
    }

    if (!globalScope.JSZip) {
      throw new Error('JSZip 未加载');
    }

    if (typeof globalScope.JSZip.loadAsync !== 'function') {
      throw new Error('JSZip 未正确加载');
    }

    const response = await fetch(archiveUrl);
    if (!response.ok && response.status !== 0) {
      throw new Error('读取 Profile 失败：' + response.status);
    }

    const archive = await globalScope.JSZip.loadAsync(await response.arrayBuffer());
    const fileMap = {};

    const archiveNames = Object.keys(archive.files || {});
    const candidateNames = REQUIRED_FILES.concat(EX_SKILL_REQUIRED_FILES).filter(function (name, index, names) {
      return names.indexOf(name) === index;
    });

    for (const name of candidateNames) {
      const entry = findArchiveEntry(archive, name);
      if (entry) {
        fileMap[name] = await entry.async('string');
      }
    }
    for (const name of archiveNames) {
      const normalizedName = name.replace(/^profile\//, '').replace(/^[^/]+\/(knowledge|versions)\//, '$1/');
      if ((normalizedName.indexOf('knowledge/') === 0 || normalizedName.indexOf('versions/') === 0) && !archive.files[name].dir) {
        fileMap[normalizedName] = await archive.files[name].async('string');
      }
    }

    const bundle = await loadProfileFromFileMap(fileMap);
    bundle.archive = archive;
    bundle.archiveUrl = archiveUrl;
    bundle._stickerUrlCache = {};
    return bundle;
  }

  function resolveStickerArchivePath(profileBundle, md5) {
    if (!profileBundle || !md5) {
      return '';
    }

    const stickerList = Array.isArray(profileBundle.stickerLibrary && profileBundle.stickerLibrary.stickers)
      ? profileBundle.stickerLibrary.stickers
      : [];
    const exact = stickerList.find(function (item) {
      return item.md5 === md5;
    });

    if (exact && exact.path) {
      const segments = String(exact.path).replace(/\\/g, '/').split('/');
      const fileName = segments[segments.length - 1];
      if (fileName) {
        const directPath = 'stickers/' + fileName;
        if (!profileBundle.archive || profileBundle.archive.file(directPath)) {
          return directPath;
        }
      }
    }

    if (!profileBundle.archive) {
      return '';
    }

    const archiveNames = Object.keys(profileBundle.archive.files);
    return archiveNames.find(function (name) {
      return name.indexOf('stickers/' + md5 + '.') === 0;
    }) || '';
  }

  async function resolveStickerUrl(profileBundle, md5) {
    if (!profileBundle || !md5) {
      return '';
    }

    if (profileBundle._stickerUrlCache && profileBundle._stickerUrlCache[md5]) {
      return profileBundle._stickerUrlCache[md5];
    }

    const archivePath = resolveStickerArchivePath(profileBundle, md5);
    if (!archivePath) {
      return '';
    }

    if (profileBundle.nativeLocation) {
      const bridge = getNativeBridge();
      if (!bridge) {
        return '';
      }
      let response;
      try {
        response = parseBridgeJson(bridge.loadStickerDataUrl(profileBundle.nativeLocation, archivePath));
      } catch (error) {
        if (isMissingStickerError(error)) {
          return '';
        }
        throw error;
      }
      const dataUrl = response.dataUrl || '';
      profileBundle._stickerUrlCache = profileBundle._stickerUrlCache || {};
      profileBundle._stickerUrlCache[md5] = dataUrl;
      return dataUrl;
    }

    if (!profileBundle.archive || typeof URL === 'undefined') {
      return '';
    }

    const entry = profileBundle.archive.file(archivePath);
    if (!entry) {
      return '';
    }

    const stickerUrl = URL.createObjectURL(await entry.async('blob'));
    profileBundle._stickerUrlCache = profileBundle._stickerUrlCache || {};
    profileBundle._stickerUrlCache[md5] = stickerUrl;
    return stickerUrl;
  }

  const api = {
    REQUIRED_FILES,
    EX_SKILL_REQUIRED_FILES,
    loadProfileFromFileMap,
    loadProfileFromArchiveUrl,
    resolveStickerArchivePath,
    resolveStickerUrl,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.ExProfileLoader = api;
  } else if (globalScope) {
    globalScope.ExProfileLoader = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
