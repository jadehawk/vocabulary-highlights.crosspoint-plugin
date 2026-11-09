'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '..');
const payload = path.join(repo, 'vocabulary-highlights');

test('plugin manifest is installable on stock CrossPoint', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(payload, 'manifest.json'), 'utf8'));
  assert.equal(manifest.name, 'vocabulary-highlights');
  assert.equal(manifest.title, 'Vocabulary & Highlights');
  assert.equal(path.basename(payload), manifest.name);
  assert.equal(manifest.version, require('../package.json').version);
  assert.equal(manifest.mount, 'settings');
  assert.equal(manifest.compatibility?.requires, undefined, 'stock firmware must not be blocked');
  assert.ok(manifest.files.includes('plugin.js'));
  assert.ok(manifest.files.includes('style.css'));
  for (const file of manifest.files) {
    assert.ok(!file.includes('..') && !file.startsWith('/'), 'manifest path is relative');
    assert.ok(fs.statSync(path.join(payload, file)).isFile(), 'missing manifest file: ' + file);
  }
});

test('on-device README fallback stays under the 16 KiB firmware limit', () => {
  assert.ok(fs.statSync(path.join(payload, 'README.md')).size < 16 * 1024);
});

test('browser script registers synchronously without requiring another script', () => {
  let handler = null;
  global.CrossPoint = { registerPlugin(fn) { handler = fn; } };
  try {
    const filename = require.resolve('../vocabulary-highlights/plugin.js');
    delete require.cache[filename];
    require(filename);
    assert.equal(typeof handler, 'function');
    delete require.cache[filename];
  } finally {
    delete global.CrossPoint;
  }
});
