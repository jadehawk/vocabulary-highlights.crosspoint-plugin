'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '..');
const pluginId = 'vocabulary-highlights';
const payload = path.join(repo, pluginId + '.crosspoint-plugin');
const manifestPath = path.join(payload, 'manifest.json');

test('Plugin Hub discovery contract: exactly one direct-child payload matches manifest ID', () => {
  const roots = fs.readdirSync(repo, { withFileTypes: true })
    .filter(item => item.isDirectory() && item.name.endsWith('.crosspoint-plugin'))
    .map(item => item.name);
  assert.deepEqual(roots, [pluginId + '.crosspoint-plugin']);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.name, pluginId);
  assert.match(manifest.name, /^[a-z0-9][a-z0-9-]{0,63}$/);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(manifest.version, require('../package.json').version);
  assert.equal(manifest.title, 'Vocabulary & Highlights');
  assert.equal(manifest.mount, 'settings');
  assert.equal(manifest.compatibility?.requires, undefined,
    'browser-only firmware must not be blocked by optional native UI capabilities');
  assert.equal(manifest.home_shortcut.label, 'Vocabulary & Highlights');
  assert.equal(manifest.home_shortcut.target, 'dashboard');
});

test('Plugin Hub payload explicitly declares only present, safe runtime files', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(Array.isArray(manifest.files));
  assert.ok(manifest.files.includes('manifest.json'));
  assert.ok(manifest.files.includes('plugin.js'));
  assert.ok(manifest.files.includes('device.json'));
  assert.ok(manifest.files.includes('style.css'));
  assert.ok(manifest.files.includes('README.md'));
  assert.ok(manifest.files.includes('DETAILS.md'));
  assert.equal(new Set(manifest.files).size, manifest.files.length, 'no duplicate filenames');
  for (const filename of manifest.files) {
    assert.equal(typeof filename, 'string');
    assert.ok(filename && !filename.startsWith('/') && !filename.includes('\\') &&
      !filename.split('/').some(part => !part || part === '.' || part === '..'),
    'unsafe manifest path: ' + filename);
    assert.ok(fs.statSync(path.join(payload, filename)).isFile(), 'missing runtime file: ' + filename);
  }
  const actualFiles = fs.readdirSync(payload, { withFileTypes: true })
    .filter(item => item.isFile()).map(item => item.name).sort();
  assert.deepEqual([...manifest.files].sort(), actualFiles,
    'installable files and manifest.files must match');
  assert.ok(!manifest.files.includes('package.json'), 'development tooling stays at repository root');
});

test('on-reader plugin supports README fallback when native integration is unavailable', () => {
  assert.ok(fs.statSync(path.join(payload, 'README.md')).size < 16 * 1024);
  const device = JSON.parse(fs.readFileSync(path.join(payload, 'device.json'), 'utf8'));
  assert.equal(device.local_library.source, 'vocabulary-highlights.v1');
  assert.equal(device.local_library.vocabulary_path, '/Vocabulary.txt');
  assert.equal(device.local_library.clippings_path, '/My Clippings.txt');
  assert.equal(device.browse, undefined, 'on-device catalog falls back to README without a browse feed');
  assert.ok(fs.statSync(path.join(payload, 'device.json')).size < 8 * 1024);
});

test('on-device fallback and Hub details contain only WebUI guidance', () => {
  const fallback = fs.readFileSync(path.join(payload, 'README.md'), 'utf8');
  assert.match(fallback, /^To access this plugin:/);
  assert.match(fallback, /1\. Open File Transfer\./);
  assert.match(fallback, /Join a Network or Create Hotspot/);
  assert.match(fallback, /WebUI address shown on the reader/);
  assert.doesNotMatch(fallback, /^Vocabulary & Highlights\s*$/m,
    'firmware already displays the plugin title above its instructions');
  const details = fs.readFileSync(path.join(payload, 'DETAILS.md'), 'utf8');
  assert.match(details, /File Transfer \/ WebUI/i);
  for (const file of ['README.md', 'DETAILS.md']) {
    const content = fs.readFileSync(path.join(payload, file), 'utf8');
    assert.match(content, /Plugins\s*->\s*Vocabulary & Highlights/i);
    assert.doesNotMatch(content, /native|long-press|show deleted|restore entry|state-v1|X3/i,
      file + ' must not instruct users about unsupported on-device features');
    assert.ok(Buffer.byteLength(content, 'utf8') < 1024,
      file + ' should be concise for e-ink screens');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const device = JSON.parse(fs.readFileSync(path.join(payload, 'device.json'), 'utf8'));
  assert.match(manifest.description, /WebUI/);
  assert.match(device.description, /WebUI/);
});

test('user-facing documentation and plugin UI remain firmware-neutral', () => {
  for (const filename of ['README.md', 'CHANGELOG.md', 'docs/RELEASE_CHECKLIST.md',
    'vocabulary-highlights.crosspoint-plugin/README.md',
    'vocabulary-highlights.crosspoint-plugin/DETAILS.md',
    'vocabulary-highlights.crosspoint-plugin/plugin.js']) {
    const content = fs.readFileSync(path.join(repo, filename), 'utf8');
    assert.doesNotMatch(content, /Razor-Crest|stock CrossPoint|compatible forks/i,
      'firmware-specific branding in ' + filename);
  }
});

test('repository README uses an ASCII title with no BOM or mojibake', () => {
  const bytes = fs.readFileSync(path.join(repo, 'README.md'));
  assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf],
    'README must not start with a UTF-8 BOM');
  const text = bytes.toString('utf8');
  assert.equal(text.split(/\r?\n/, 1)[0], '# Vocabulary & Highlights - CrossPoint plugin');
  assert.doesNotMatch(text, /â€”|â€“|Ã./u, 'README contains misdecoded UTF-8');
});

test('browser plugin registers synchronously without requiring another script', () => {
  let handler = null;
  global.CrossPoint = { registerPlugin(fn) { handler = fn; } };
  try {
    const filename = require.resolve('../vocabulary-highlights.crosspoint-plugin/plugin.js');
    delete require.cache[filename];
    require(filename);
    assert.equal(typeof handler, 'function');
    delete require.cache[filename];
  } finally {
    delete global.CrossPoint;
  }
});
