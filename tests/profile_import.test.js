const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { mergeHostProfiles, upsertContact } = require('../app/lib/contact-registry.js');
const { loadProfileFromFileMap, loadProfileFromArchiveUrl, resolveStickerUrl } = require('../app/lib/profile-loader.js');

test('upsertContact updates by slug instead of duplicating', () => {
  const contacts = [{ slug: 'sample-contact', displayName: 'Old Name', source: 'builtin' }];
  const next = upsertContact(contacts, {
    slug: 'sample-contact',
    displayName: 'Contact A',
    source: 'imported',
  });
  assert.equal(next.length, 1);
  assert.equal(next[0].displayName, 'Contact A');
  assert.equal(next[0].source, 'imported');
});

test('mergeHostProfiles includes Android builtin profiles when no base contact exists', () => {
  const contacts = mergeHostProfiles([], [
    {
      id: 'builtin-sample-contact',
      displayName: 'Sample Contact',
      sourceType: 'builtin',
      originalFileName: 'sample-contact.exprofile.zip',
      location: 'file:///android_asset/profiles/sample-contact.exprofile.zip',
    },
  ], []);

  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].slug, 'builtin-sample-contact');
  assert.equal(contacts[0].displayName, 'Sample Contact');
  assert.equal(contacts[0].source, 'builtin');
  assert.equal(contacts[0].hostProfileLocation, 'file:///android_asset/profiles/sample-contact.exprofile.zip');
});

test('loadProfileFromFileMap throws when required files are missing', async () => {
  await assert.rejects(
    loadProfileFromFileMap({
      'meta.json': '{}',
    }),
    /missing profile files/i
  );
});

test('loadProfileFromFileMap accepts original ex-skill package files', async () => {
  const bundle = await loadProfileFromFileMap({
    'meta.json': JSON.stringify({
      slug: 'xiaomei',
      name: 'Xiao Mei',
      participants: { user: 'User A', target: 'Xiao Mei' },
      runtime: {
        preferredPrompt: 'SKILL.md',
        outputProtocol: 'structured-messages-v1',
      },
    }),
    'SKILL.md': '# Xiao Mei Skill\nAlways answer as Xiao Mei.',
    'persona.md': 'Short and casual.',
    'memories.md': 'Shared old memories.',
    'knowledge/extra.md': 'extra knowledge',
  });

  assert.equal(bundle.displayName, 'Xiao Mei');
  assert.equal(bundle.userName, 'User A');
  assert.equal(bundle.format, 'ex-skill');
  assert.equal(bundle.skillPrompt, '# Xiao Mei Skill\nAlways answer as Xiao Mei.');
  assert.equal(bundle.sections.persona, 'Short and casual.');
  assert.equal(bundle.sections.memories, 'Shared old memories.');
  assert.deepEqual(bundle.knowledgeFiles, { 'knowledge/extra.md': 'extra knowledge' });
  assert.deepEqual(bundle.stickerProfile, { high_frequency_md5: [] });
  assert.deepEqual(bundle.stickerLibrary, { stickers: [] });
});

test('web vendor exposes a working JSZip loader', () => {
  const vendorSource = fs.readFileSync(path.join(__dirname, '..', 'app', 'vendor', 'jszip.min.js'), 'utf8');
  const sandbox = {
    window: {},
    self: {},
    globalThis: {},
    setImmediate,
    setTimeout,
    clearTimeout,
    Promise,
  };

  sandbox.globalThis = sandbox;
  vm.runInNewContext(vendorSource, sandbox, { filename: 'jszip.min.js' });

  assert.equal(typeof sandbox.window.JSZip, 'function');
  assert.equal(typeof sandbox.window.JSZip.loadAsync, 'function');
});

test('loadProfileFromArchiveUrl reports a clear error when JSZip is a broken placeholder', async () => {
  const previousJSZip = global.JSZip;
  const previousFetch = global.fetch;
  global.JSZip = {};
  global.fetch = async () => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => new ArrayBuffer(0),
  });

  try {
    await assert.rejects(
      loadProfileFromArchiveUrl('blob:test-profile'),
      /JSZip 未正确加载/
    );
  } finally {
    global.JSZip = previousJSZip;
    global.fetch = previousFetch;
  }
});

function requiredProfileFiles() {
  return {
    'meta.json': JSON.stringify({
      name: 'Contact A',
      participants: { user: 'User A', target: 'Contact A' },
    }),
    'persona.md': 'Short replies.',
    'relationship_context.md': 'Known each other.',
    'response_patterns.md': 'Brief first.',
    'memories.md': 'Old things.',
    'sticker_profile.json': JSON.stringify({
      high_frequency_md5: [{ md5: 'abc123', count: 3 }],
    }),
    'sticker_library.json': JSON.stringify({
      stickers: [{ md5: 'abc123', path: 'G:\\emojis\\abc123.gif', format: 'gif' }],
    }),
  };
}

test('loadProfileFromArchiveUrl uses Android bridge for bundled profile files before fetch', async () => {
  const previousBridge = global.AndroidBridge;
  const previousFetch = global.fetch;
  global.AndroidBridge = {
    loadProfileFiles(location) {
      assert.equal(location, 'file:///android_asset/profiles/a.exprofile.zip');
      return JSON.stringify({ files: requiredProfileFiles() });
    },
  };
  global.fetch = async () => {
    throw new Error('Failed to fetch');
  };

  try {
    const bundle = await loadProfileFromArchiveUrl('file:///android_asset/profiles/a.exprofile.zip');

    assert.equal(bundle.displayName, 'Contact A');
    assert.equal(bundle.nativeLocation, 'file:///android_asset/profiles/a.exprofile.zip');
  } finally {
    global.AndroidBridge = previousBridge;
    global.fetch = previousFetch;
  }
});

test('resolveStickerUrl uses Android bridge for sticker bytes from native profile', async () => {
  const previousBridge = global.AndroidBridge;
  global.AndroidBridge = {
    loadStickerDataUrl(location, archivePath) {
      assert.equal(location, 'file:///android_asset/profiles/a.exprofile.zip');
      assert.equal(archivePath, 'stickers/abc123.gif');
      return JSON.stringify({ dataUrl: 'data:image/gif;base64,abc=' });
    },
  };

  try {
    const stickerUrl = await resolveStickerUrl({
      nativeLocation: 'file:///android_asset/profiles/a.exprofile.zip',
      stickerLibrary: {
        stickers: [{ md5: 'abc123', path: 'G:\\emojis\\abc123.gif', format: 'gif' }],
      },
    }, 'abc123');

    assert.equal(stickerUrl, 'data:image/gif;base64,abc=');
  } finally {
    global.AndroidBridge = previousBridge;
  }
});

test('resolveStickerUrl returns empty when Android bridge reports missing sticker asset', async () => {
  const previousBridge = global.AndroidBridge;
  global.AndroidBridge = {
    loadStickerDataUrl(_location, archivePath) {
      assert.equal(archivePath, 'stickers/abc123.png');
      return JSON.stringify({ error: 'sticker not found: stickers/abc123.png' });
    },
  };

  try {
    const stickerUrl = await resolveStickerUrl({
      nativeLocation: 'file:///android_asset/profiles/a.exprofile.zip',
      stickerLibrary: {
        stickers: [{ md5: 'abc123', path: 'stickers/abc123.png', format: 'png' }],
      },
    }, 'abc123');

    assert.equal(stickerUrl, '');
  } finally {
    global.AndroidBridge = previousBridge;
  }
});
