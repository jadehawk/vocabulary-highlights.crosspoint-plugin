'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const pluginPath = path.resolve(__dirname, '../vocabulary-highlights.crosspoint-plugin/plugin.js');

class FakeElement {
  constructor(tagName, text = '') {
    this.tagName = tagName.toLowerCase();
    this.children = [];
    this.handlers = Object.create(null);
    this.attributes = Object.create(null);
    this._text = String(text);
    this.value = '';
    this.disabled = false;
  }
  get textContent() {
    return this._text + this.children.map(child => child.textContent).join('');
  }
  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }
  append(...children) {
    for (const child of children) this.children.push(
      typeof child === 'string' ? new FakeElement('#text', child) : child);
  }
  appendChild(child) { this.append(child); return child; }
  replaceChildren(...children) { this.children = []; this._text = ''; this.append(...children); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] || null; }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  querySelector(selector) {
    if (selector === '[data-vb-search]') return walk(this).find(item => item.getAttribute('data-vb-search') === '1');
    return null;
  }
  focus() { global.document.activeElement = this; }
  setSelectionRange() {}
}
function walk(element) {
  return [element, ...element.children.flatMap(walk)];
}
function findButton(host, text) {
  return walk(host).find(element => element.tagName === 'button' && element.textContent === text);
}
function findButtonPrefix(host, prefix) {
  return walk(host).find(element => element.tagName === 'button' && element.textContent.startsWith(prefix));
}
function fakeResponse(status, text) {
  return { status, ok: status >= 200 && status < 300, text: async () => text };
}

test('browser UI reads both exports, persists statuses and reversible deletions without editing sources', async t => {
  const data = Object.create(null);
  const originalVocab = {
    v: 1, id: 'a'.repeat(32), timestamp: 1794208671,
    word: 'consternation.', headword: 'consternation',
    definition: 'Dismay or terror.', definition_truncated: false,
    title: 'Graveyard of Demons', author: 'Larry Correia',
    chapter: 'Chapter 24', page: 2, spine: 32, start_offset: 229
  };
  data['/Vocabulary.txt'] = JSON.stringify(originalVocab) + '\n';
  data['/My Clippings.txt'] =
    'Graveyard of Demons (Larry Correia)\n' +
    '- Your Highlight on Page 2 | Chapter 24 | Added on Monday, November 9, 2026, 02:18 AM\n' +
    '\nconsternation.\n==========\n';
  const originals = { vocab: data['/Vocabulary.txt'], clips: data['/My Clippings.txt'] };
  const statePath = '/.crosspoint/vocabulary-highlights/state-v1.json';
  const legacyPath = '/.crosspoint/vocabulary-builder/state-v1.json';
  const legacyState = { version: 1, statuses: { ['vocab:' + originalVocab.id]: 'mastered' }, hidden: {} };
  data[legacyPath] = JSON.stringify(legacyState);

  global.document = {
    activeElement: null,
    createElement: name => new FakeElement(name),
    createTextNode: content => new FakeElement('#text', content)
  };
  global.window = { confirm: () => true };
  let mkdirCalls = 0;
  global.fetch = async (request, options) => {
    if (request === '/mkdir') {
      mkdirCalls++;
      assert.equal(options.method, 'POST');
      assert.equal(options.body.get('name'), 'vocabulary-highlights');
      assert.equal(options.body.get('path'), '/.crosspoint');
      return fakeResponse(400, 'Folder already exists');
    }
    const p = new URL(request, 'http://crosspoint.local').searchParams.get('path');
    return p in data ? fakeResponse(200, data[p]) : fakeResponse(404, 'Not found');
  };
  let render = null;
  global.CrossPoint = { registerPlugin(callback) { render = callback; } };
  t.after(() => {
    for (const name of ['document', 'window', 'fetch', 'CrossPoint']) delete global[name];
    delete require.cache[pluginPath];
  });
  delete require.cache[pluginPath];
  require(pluginPath);
  assert.equal(typeof render, 'function', 'plugin must synchronously register');

  const writes = [];
  const api = {
    dir: '/.crosspoint/plugins/vocabulary-highlights',
    pluginFile: file => '/plugin?name=vocabulary-highlights&file=' + file,
    async writeFile(p, contentB64) {
      const content = Buffer.from(contentB64, 'base64').toString('utf8');
      assert.equal(p, statePath);
      data[p] = content;
      writes.push(JSON.parse(content));
    }
  };
  const host = new FakeElement('main');
  await render(host, api);
  assert.equal(walk(host).some(node => node.className === 'vb-foot'), false,
    'WebUI should not display a redundant environment footer');

  assert.match(host.textContent, /Vocabulary \(1\)/);
  assert.match(host.textContent, /Highlights \(1\)/);
  assert.match(host.textContent, /Graveyard of Demons/);
  assert.match(host.textContent, /Dismay or terror/);
  assert.ok(findButton(host, 'Learning'));
  assert.match(host.textContent, /Previous Vocabulary Builder progress loaded/);
  assert.match(findButton(host, 'Mastered').className, /vb-current/, 'legacy status is restored');
  await findButton(host, 'Learning').handlers.click();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].statuses['vocab:' + originalVocab.id], 'learning');
  assert.equal(data[legacyPath], JSON.stringify(legacyState), 'legacy state remains unchanged');
  assert.equal(data['/Vocabulary.txt'], originals.vocab);
  assert.equal(data['/My Clippings.txt'], originals.clips);

  await findButton(host, 'Refresh from SD').handlers.click();
  assert.match(host.textContent, /learning/i, 'saved status is reloaded');
  assert.match(findButton(host, 'Learning').className, /vb-current/, 'new state takes priority after migration');
  await findButton(host, 'Delete from list').handlers.click();
  // Delete confirms synchronously and saves asynchronously.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes[1].hidden['vocab:' + originalVocab.id], true);
  assert.match(host.textContent, /Vocabulary \(0\)/);

  const deleted = walk(host).find(node => node.tagName === 'input' && node.type === 'checkbox');
  assert.ok(deleted);
  deleted.checked = true;
  deleted.handlers.change();
  assert.ok(findButton(host, 'Restore entry'));
  await findButton(host, 'Restore entry').handlers.click();
  assert.equal(writes[2].hidden['vocab:' + originalVocab.id], undefined);

  await findButtonPrefix(host, 'Highlights (').handlers.click();
  assert.match(host.textContent, /Saved highlight/);
  assert.match(host.textContent, /consternation\./);
  assert.equal(findButton(host, 'Learning'), undefined, 'no learning status for clips');
  await findButton(host, 'Delete from list').handlers.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(Object.keys(writes[3].hidden).length, 1);
  assert.match(Object.keys(writes[3].hidden)[0], /^clip:/);
  assert.equal(mkdirCalls, 1, 'state directory is initialized only once');

  assert.equal(data['/Vocabulary.txt'], originals.vocab, 'original JSONL unchanged');
  assert.equal(data['/My Clippings.txt'], originals.clips, 'original clip file unchanged');
});

test('browser UI blocks edits if saved state cannot be parsed', async t => {
  const data = {
    '/Vocabulary.txt': JSON.stringify({
      v: 1, id: 'b'.repeat(32), title: 'Book', headword: 'word',
      definition: 'description'
    }) + '\n',
    '/.crosspoint/vocabulary-highlights/state-v1.json': '{invalid',
    '/.crosspoint/vocabulary-builder/state-v1.json': JSON.stringify({ version: 1,
      statuses: { ['vocab:' + 'b'.repeat(32)]: 'mastered' }, hidden: {} })
  };
  global.document = {
    activeElement: null, createElement: name => new FakeElement(name),
    createTextNode: text => new FakeElement('#text', text)
  };
  global.fetch = async request => {
    const p = new URL(request, 'http://crosspoint.local').searchParams.get('path');
    return p in data ? fakeResponse(200, data[p]) : fakeResponse(404, '');
  };
  global.CrossPoint = { registerPlugin(callback) { global.testRenderer = callback; } };
  t.after(() => {
    for (const name of ['document', 'fetch', 'CrossPoint', 'testRenderer']) delete global[name];
    delete require.cache[pluginPath];
  });
  delete require.cache[pluginPath];
  require(pluginPath);
  let writes = 0;
  const host = new FakeElement('main');
  await global.testRenderer(host, {
    dir: '/.crosspoint/plugins/vocabulary-highlights',
    pluginFile: f => f,
    writeFile: () => { writes++; }
  });
  assert.match(host.textContent, /disabled to preserve it/i);
  const learning = findButton(host, 'Learning');
  assert.equal(learning.disabled, true);
  assert.equal(writes, 0);
});
