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

test('android manifest keeps local chat data out of device backup', () => {
  const manifest = fs.readFileSync(
    path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
    'utf8'
  );

  assert.match(manifest, /android:allowBackup="false"/);
});

test('android manifest disables cleartext traffic for API credentials', () => {
  const manifest = fs.readFileSync(
    path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
    'utf8'
  );

  assert.match(manifest, /android:usesCleartextTraffic="false"/);
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

test('android package does not declare a private bundled profile', () => {
  const repository = fs.readFileSync(
    path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'com', 'qianrenskill', 'app', 'data', 'ProfileRepository.kt'),
    'utf8'
  );

  assert.match(repository, /fun listBuiltinProfiles\(\): List<StoredProfile>/);
  assert.match(repository, /return emptyList\(\)/);
  assert.doesNotMatch(repository, /builtin-sample-contact|sample-contact\.exprofile\.zip/);
});

test('gitignore excludes private bundled profile assets', () => {
  const gitignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');

  assert.match(gitignore, /android\/app\/src\/main\/assets\/profiles\//);
  assert.match(gitignore, /profiles\/\*/);
});
