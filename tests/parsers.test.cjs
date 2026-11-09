'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const plugin = require('../vocabulary-highlights.crosspoint-plugin/plugin.js');

function record(overrides = {}) {
  return {
    v: 1,
    id: 'a'.repeat(32),
    timestamp: 1794208671,
    word: 'consternation.',
    headword: 'consternation',
    definition: 'consternation (noun)\n1. Dismay.',
    definition_truncated: false,
    title: 'Graveyard of Demons',
    author: 'Larry Correia',
    series: 'Saga of the Forgotten Warrior',
    series_index: 5,
    chapter: 'Chapter 24',
    page: 2,
    spine: 32,
    start_offset: 229,
    ...overrides
  };
}
function jsonl(...objects) {
  return objects.map(obj => JSON.stringify(obj)).join('\n') + '\n';
}

test('JSONL parser preserves all export fields including escaped definitions', () => {
  const original = record();
  const parsed = plugin.parseVocabulary('\uFEFF' + jsonl(original));
  assert.equal(parsed.invalid, 0);
  assert.equal(parsed.entries.length, 1);
  const word = parsed.entries[0];
  assert.equal(word.id, 'vocab:' + original.id);
  assert.equal(word.headword, 'consternation');
  assert.equal(word.word, 'consternation.');
  assert.equal(word.definition, original.definition);
  assert.equal(word.title, original.title);
  assert.equal(word.author, original.author);
  assert.equal(word.series, original.series);
  assert.equal(word.seriesIndex, original.series_index);
  assert.equal(word.spine, 32);
  assert.equal(word.startOffset, 229);
  assert.equal(word.chapter, original.chapter);
  assert.equal(word.page, 2);
  assert.equal(word.timestamp, 1794208671);
});

test('JSONL parser preserves repeated words with distinct IDs and skips malformed lines', () => {
  const first = record();
  const second = record({ id: 'b'.repeat(32), chapter: 'Chapter 25', page: 4 });
  const result = plugin.parseVocabulary('not-json\n' + jsonl(first, second, first, {
    ...first, id: 'invalid'
  }) + '{}\n');
  assert.equal(result.entries.length, 2);
  assert.equal(result.invalid, 4);
  assert.equal(result.entries[1].chapter, 'Chapter 25');
  assert.notEqual(result.entries[0].id, result.entries[1].id);
});

test('JSONL parser handles missing optional metadata and null timestamps', () => {
  const raw = record({
    timestamp: null, chapter: '', page: null, spine: null, start_offset: null,
    series_index: null, author: '', definition_truncated: true
  });
  const parsed = plugin.parseVocabulary(jsonl(raw)).entries[0];
  assert.equal(parsed.timestamp, null);
  assert.equal(parsed.page, null);
  assert.equal(parsed.spine, null);
  assert.equal(parsed.startOffset, null);
  assert.equal(parsed.seriesIndex, null);
  assert.equal(parsed.definitionTruncated, true);
});

test('clipping parser reads real CrossPoint export layout, CRLF and multi-line text', () => {
  const content = [
    'Graveyard of Demons (Larry Correia)',
    '- Your Highlight on Page 2 | Chapter 24 | Added on Monday, November 9, 2026, 02:18 AM',
    '',
    'consternation.',
    'Second line of the highlight.',
    '==========',
    ''
  ].join('\r\n');
  const result = plugin.parseClippings(content);
  assert.equal(result.invalid, 0);
  assert.equal(result.entries.length, 1);
  const clipping = result.entries[0];
  assert.equal(clipping.title, 'Graveyard of Demons');
  assert.equal(clipping.author, 'Larry Correia');
  assert.equal(clipping.page, 2);
  assert.equal(clipping.chapter, 'Chapter 24');
  assert.equal(clipping.text, 'consternation.\nSecond line of the highlight.');
  assert.match(clipping.id, /^clip:[a-f0-9]{16}:1$/);
  assert.ok(clipping.timestamp);
});

test('multiple clips and duplicate IDs remain stable after an append', () => {
  const one = 'Example (Author)\n- Your Highlight on Page 1 | Chapter 1\n\nHello!\n==========\n';
  const two = 'Example (Author)\n- Your Highlight on Page 2 | Chapter 2\n\nWorld!\n==========\n';
  const before = plugin.parseClippings(one + one);
  const after = plugin.parseClippings(one + one + two);
  assert.deepEqual(after.entries.slice(0, 2).map(e => e.id), before.entries.map(e => e.id));
  assert.equal(new Set(before.entries.map(e => e.id)).size, 2);
  assert.equal(after.entries.length, 3);
  assert.equal(after.invalid, 0);
});

test('duplicate highlights have independent reversible hidden IDs', () => {
  const block = 'Repeated (Author)\n- Your Highlight on Page 7 | Chapter 2\n\nA repeated sentence.\n==========\n';
  const parsed = plugin.parseClippings(block + block).entries;
  assert.equal(parsed.length, 2);
  assert.match(parsed[0].id, /^clip:[a-f0-9]{16}:1$/);
  assert.equal(parsed[1].id, parsed[0].id.replace(/:1$/, ':2'));
  const state = plugin.normalizeState({ version: 1, statuses: {}, hidden: { [parsed[0].id]: true } });
  assert.equal(state.hidden[parsed[0].id], true);
  assert.equal(state.hidden[parsed[1].id], undefined, 'hiding one must preserve the other');
  delete state.hidden[parsed[0].id];
  assert.equal(Object.keys(state.hidden).length, 0, 'restoring one does not rewrite the export');
  assert.equal(plugin.parseClippings(block + block + block).entries[1].id, parsed[1].id);
});

test('clip parser ignores incomplete tail and malformed separators without inventing records', () => {
  const valid = 'One (A)\n- Your Highlight on Page 1\n\nvalid\n==========\n';
  const tail = 'Two (B)\n- Your Highlight on Page 2\n\nuncommitted';
  const result = plugin.parseClippings(valid + tail);
  assert.equal(result.entries.length, 1);
  assert.equal(result.invalid, 0);
  assert.equal(result.entries[0].text, 'valid');
});

test('grouping separates authors with identical titles and sorts by title or latest entry', () => {
  const entries = plugin.parseVocabulary(jsonl(
    record({ title: 'Beta', author: 'Someone', timestamp: 50 }),
    record({ title: 'Alpha', author: 'Person 1', id: 'b'.repeat(32), timestamp: 100 }),
    record({ title: 'Alpha', author: 'Person 2', id: 'c'.repeat(32), timestamp: 200 })
  )).entries;
  assert.deepEqual(plugin.groupBooks(entries, 'az').map(b => b.title), ['Alpha', 'Alpha', 'Beta']);
  assert.deepEqual(plugin.groupBooks(entries, 'recent').map(b => b.author), ['Person 2', 'Person 1', 'Someone']);
});

test('reading order prioritizes spine, then page and start offset', () => {
  const entries = plugin.parseVocabulary(jsonl(
    record({ id: 'a'.repeat(32), chapter: 'Chapter 25', spine: 33, page: 1, start_offset: 12 }),
    record({ id: 'b'.repeat(32), chapter: 'Chapter 24', spine: 32, page: 4, start_offset: 100 }),
    record({ id: 'c'.repeat(32), chapter: 'Chapter 24', spine: 32, page: 2, start_offset: 200 }),
    record({ id: 'd'.repeat(32), chapter: 'Chapter 24', spine: 32, page: 2, start_offset: 5 })
  )).entries;
  assert.deepEqual(plugin.sortEntries(entries, 'reading').map(e => e.id.slice(-1)), ['d', 'c', 'b', 'a']);
});

test('highlight reading order uses numeric chapter names then page', () => {
  const text = [10, 2, 9].map(n =>
    'Book (A)\n- Your Highlight on Page ' + n + ' | Chapter ' + n + '\n\n' + n + '\n==========\n'
  ).join('');
  const entries = plugin.parseClippings(text).entries;
  assert.deepEqual(plugin.sortEntries(entries, 'reading').map(e => e.page), [2, 9, 10]);
});

test('learning state and deletions are versioned and source records remain unchanged', () => {
  const parsed = plugin.parseVocabulary(jsonl(record()));
  const original = JSON.stringify(parsed.entries);
  const state = plugin.emptyState();
  const id = parsed.entries[0].id;
  state.statuses[id] = 'learning';
  state.hidden[id] = true;
  const recovered = plugin.normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(plugin.statusOf(parsed.entries[0], recovered), 'learning');
  assert.equal(recovered.hidden[id], true);
  recovered.statuses[id] = 'mastered';
  assert.equal(plugin.statusOf(parsed.entries[0], recovered), 'mastered');
  assert.equal(JSON.stringify(parsed.entries), original);
  assert.equal(Object.keys(plugin.emptyState().statuses).length, 0);
});

test('malformed state refuses loading instead of silently resetting progress', () => {
  for (const invalid of [null, {}, { version: 2, statuses: {}, hidden: {} },
    { version: 1, statuses: [], hidden: {} }]) {
    assert.throws(() => plugin.normalizeState(invalid), /Unsupported or damaged/);
  }
});

test('state serialization is UTF-8 safe and size-limited', () => {
  const encoded = plugin.utf8Base64('{"text":"café — 私"}');
  assert.equal(Buffer.from(encoded, 'base64').toString('utf8'), '{"text":"café — 私"}');
  assert.throws(() => plugin.utf8Base64('a'.repeat(241 * 1024)), /exceeds 240/);
});

test('sample exports can be checked locally without committing private reading history', (t) => {
  const dir = process.env.VOCAB_SAMPLES_DIR;
  if (!dir) { t.skip('Set VOCAB_SAMPLES_DIR to a folder with the three user exports.'); return; }
  for (const name of ['Vocabulary.txt', 'Vocabulary (5).txt']) {
    const file = path.join(dir, name);
    assert.ok(fs.existsSync(file), name + ' is missing from sample directory');
    const result = plugin.parseVocabulary(fs.readFileSync(file, 'utf8'));
    assert.equal(result.invalid, 0, name);
    assert.ok(result.entries.length > 0, name);
    assert.ok(result.entries.every(e => e.id && e.title && e.definition));
  }
  const result = plugin.parseClippings(fs.readFileSync(path.join(dir, 'My Clippings.txt'), 'utf8'));
  assert.equal(result.invalid, 0);
  assert.ok(result.entries.length > 0);
});
