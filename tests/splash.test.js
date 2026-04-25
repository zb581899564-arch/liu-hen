const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('app shell includes a restrained startup splash for the app', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'styles', 'app.css'), 'utf8');

  assert.match(html, /<title>/);
  assert.match(html, /startup-splash/);
  assert.match(html, /data-role="startup-splash-line"/);
  assert.match(html, /lib\/splash-copy\.js/);
  assert.match(css, /\.startup-splash/);
  assert.match(css, /#fff/);
  assert.match(css, /#111/);
});

test('startup splash copy has multiple launch lines and deterministic selection support', () => {
  const { SPLASH_LINES, chooseSplashLine } = require('../app/lib/splash-copy.js');

  assert.ok(Array.isArray(SPLASH_LINES));
  assert.ok(SPLASH_LINES.length >= 5);
  assert.equal(chooseSplashLine(() => 0), SPLASH_LINES[0]);
  assert.equal(chooseSplashLine(() => 0.999), SPLASH_LINES[SPLASH_LINES.length - 1]);
});
