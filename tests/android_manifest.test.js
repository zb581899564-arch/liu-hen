const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('android manifest grants network access for model API calls', () => {
  const manifest = fs.readFileSync(
    path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
    'utf8'
  );

  assert.match(manifest, /android\.permission\.INTERNET/);
});

test('android manifest uses custom launcher icons', () => {
  const manifest = fs.readFileSync(
    path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
    'utf8'
  );

  assert.match(manifest, /android:icon="@mipmap\/ic_launcher"/);
  assert.match(manifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);
});

test('android manifest labels the app as 留痕', () => {
  const manifest = fs.readFileSync(
    path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
    'utf8'
  );

  assert.match(manifest, /android:label="留痕"/);
});

test('android bridge exposes native chat persistence storage', () => {
  const bridge = fs.readFileSync(
    path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'com', 'qianrenskill', 'app', 'bridge', 'AndroidBridge.kt'),
    'utf8'
  );

  assert.match(bridge, /fun saveChatPersistence/);
  assert.match(bridge, /fun loadChatPersistence/);
});

test('main activity maps Android back button from chat thread to wechat list', () => {
  const mainActivity = fs.readFileSync(
    path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'com', 'qianrenskill', 'app', 'MainActivity.kt'),
    'utf8'
  );

  assert.match(mainActivity, /onBackPressedDispatcher\.addCallback/);
  assert.match(mainActivity, /#\/chat\//);
  assert.match(mainActivity, /#\/wechat/);
});

test('android package declares sample-contact as a bundled profile', () => {
  const repository = fs.readFileSync(
    path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'com', 'qianrenskill', 'app', 'data', 'ProfileRepository.kt'),
    'utf8'
  );

  assert.match(repository, /id = "builtin-sample-contact"/);
  assert.match(repository, /displayName = "Sample Contact\."/);
  assert.match(repository, /sourceType = ProfileSource\.BUILTIN/);
  assert.match(repository, /location = "profiles\/sample-contact\.exprofile\.zip"/);
});

test('android package ships the latest sample-contact bundled profile asset', () => {
  const sourceProfile = path.join(__dirname, '..', 'profiles', 'sample-contact.exprofile.zip');
  const bundledProfile = path.join(
    __dirname,
    '..',
    'android',
    'app',
    'src',
    'main',
    'assets',
    'profiles',
    'sample-contact.exprofile.zip'
  );

  assert.equal(fs.existsSync(bundledProfile), true);
  assert.equal(fs.statSync(bundledProfile).size, fs.statSync(sourceProfile).size);
});
