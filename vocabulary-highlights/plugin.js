/* Vocabulary & Highlights — browser plugin for stock CrossPoint and compatible forks. */
(function () {
  'use strict';

  const STATE_VERSION = 1;
  const STATE_DIR = '/.crosspoint/vocabulary-highlights';
  const LEGACY_STATE_PATH = '/.crosspoint/vocabulary-builder/state-v1.json';
  const STATE_FILE = 'state-v1.json';
  const STATE_MAX_BYTES = 240 * 1024; // Firmware plugin-fs allows at most 256 KiB.
  const BOOK_PAGE_SIZE = 75;
  const ENTRY_PAGE_SIZE = 50;
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

  function numberOrNull(value) {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }

  function parseVocabulary(text) {
    const entries = [];
    const seen = new Set();
    let invalid = 0;
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      let raw;
      try { raw = JSON.parse(line); } catch (_) { invalid++; continue; }
      if (!raw || raw.v !== 1 || !/^[a-f0-9]{32}$/i.test(raw.id || '') ||
          typeof raw.title !== 'string' || !raw.title.trim() ||
          typeof raw.definition !== 'string' || !raw.definition.trim() ||
          typeof raw.headword !== 'string' || !raw.headword.trim()) {
        invalid++;
        continue;
      }
      const id = 'vocab:' + raw.id.toLowerCase();
      if (seen.has(id)) { invalid++; continue; }
      seen.add(id);
      entries.push({
        id, type: 'vocab', title: raw.title.trim(),
        author: typeof raw.author === 'string' ? raw.author.trim() : '',
        series: typeof raw.series === 'string' ? raw.series.trim() : '',
        seriesIndex: typeof raw.series_index === 'number' && Number.isFinite(raw.series_index) ? raw.series_index : null,
        chapter: typeof raw.chapter === 'string' ? raw.chapter.trim() : '',
        page: numberOrNull(raw.page),
        spine: numberOrNull(raw.spine),
        startOffset: numberOrNull(raw.start_offset),
        word: typeof raw.word === 'string' ? raw.word : raw.headword,
        headword: raw.headword.trim(), definition: raw.definition,
        definitionTruncated: raw.definition_truncated === true,
        timestamp: numberOrNull(raw.timestamp), sourceIndex: i
      });
    }
    return { entries, invalid };
  }

  // Use two independent FNV-1a passes to keep IDs compact without relying on
  // record numbers. An occurrence suffix distinguishes identical repeated clips.
  function clipHash(input) {
    let a = 2166136261, b = 2166136261 ^ 0x9e3779b9;
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i);
      a = Math.imul(a ^ c, 16777619) >>> 0;
      b = Math.imul(b ^ c, 16777619) >>> 0;
    }
    return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
  }

  function clippingTimestamp(text) {
    const parts = /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i.exec(text);
    if (!parts) return null;
    const months = ['january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'];
    const month = months.indexOf(parts[1].toLowerCase());
    const day = Number(parts[2]), year = Number(parts[3]);
    const hour = Number(parts[4]), minute = Number(parts[5]);
    if (month < 0 || day < 1 || day > 31 || hour < 1 || hour > 12 || minute > 59) return null;
    const localHour = hour % 12 + (parts[6].toUpperCase() === 'PM' ? 12 : 0);
    const date = new Date(year, month, day, localHour, minute, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
    return Math.floor(date.getTime() / 1000);
  }

  function parseClippings(text) {
    const entries = [];
    const occurrences = Object.create(null);
    const lines = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
    let block = [], invalid = 0;
    function finish() {
      while (block.length && !block[block.length - 1].trim()) block.pop();
      if (block.length < 4) { invalid++; return; }
      const header = block[0].trim();
      const meta = block[1].trim();
      if (!header || !/^\-\s*Your Highlight on Page\s+\d+/i.test(meta) || block[2].trim()) {
        invalid++;
        return;
      }
      const heading = /^(.*) \(([^()]*)\)$/.exec(header);
      const title = (heading ? heading[1] : header).trim();
      const author = heading ? heading[2].trim() : '';
      const parts = meta.split(/\s*\|\s*/);
      const pageMatch = /^\-\s*Your Highlight on Page\s+(\d+)\s*$/i.exec(parts[0]);
      if (!pageMatch || !title) { invalid++; return; }
      let chapter = '', dateText = '';
      for (const part of parts.slice(1)) {
        if (/^Added on\s+/i.test(part)) dateText = part.replace(/^Added on\s+/i, '');
        else if (!chapter) chapter = part.trim();
      }
      const content = block.slice(3).join('\n').trim();
      if (!content) { invalid++; return; }
      const fingerprint = clipHash(header + '\n' + meta + '\n' + content);
      const occurrence = (occurrences[fingerprint] || 0) + 1;
      occurrences[fingerprint] = occurrence;
      const timestamp = dateText ? clippingTimestamp(dateText) : null;
      entries.push({
        id: 'clip:' + fingerprint + ':' + occurrence, type: 'clip', title, author,
        chapter, page: numberOrNull(Number(pageMatch[1])), spine: null, startOffset: null,
        text: content, timestamp,
        sourceIndex: entries.length
      });
    }
    for (const line of lines) {
      if (line.trim() === '==========') {
        finish();
        block = [];
      } else {
        block.push(line);
      }
    }
    // Ignore an unfinished trailing record rather than turning a partial write
    // into a highlight. The exporter always finishes with ten equals signs.
    return { entries, invalid };
  }

  function emptyState() {
    return { version: STATE_VERSION, statuses: Object.create(null), hidden: Object.create(null) };
  }

  function normalizeState(raw) {
    if (!raw || raw.version !== STATE_VERSION || !raw.statuses || !raw.hidden ||
        typeof raw.statuses !== 'object' || Array.isArray(raw.statuses) ||
        typeof raw.hidden !== 'object' || Array.isArray(raw.hidden)) {
      throw new Error('Unsupported or damaged saved state. Changes are disabled to preserve it.');
    }
    const result = emptyState();
    for (const [key, value] of Object.entries(raw.statuses)) {
      if (!/^vocab:[a-f0-9]{32}$/.test(key) || (value !== 'learning' && value !== 'mastered'))
        throw new Error('Damaged learning status in saved state. Editing is disabled to preserve it.');
      result.statuses[key] = value;
    }
    for (const [key, value] of Object.entries(raw.hidden)) {
      if (!/^(vocab:[a-f0-9]{32}|clip:[a-f0-9]{16}:[1-9][0-9]*)$/.test(key) || value !== true)
        throw new Error('Damaged deletion state. Editing is disabled to preserve it.');
      result.hidden[key] = true;
    }
    return result;
  }

  function statusOf(entry, state) {
    return entry.type === 'vocab' ? (state.statuses[entry.id] || 'new') : null;
  }

  function bookKey(entry) {
    return entry.title.toLowerCase() + '\u001f' + entry.author.toLowerCase();
  }

  function newest(a, b) {
    if (a.timestamp !== null && b.timestamp !== null && a.timestamp !== b.timestamp)
      return b.timestamp - a.timestamp;
    if (a.timestamp !== null && b.timestamp === null) return -1;
    if (a.timestamp === null && b.timestamp !== null) return 1;
    return b.sourceIndex - a.sourceIndex;
  }

  function readingOrder(a, b) {
    if (a.spine !== null && b.spine !== null && a.spine !== b.spine) return a.spine - b.spine;
    if (a.chapter && b.chapter && a.chapter !== b.chapter) {
      // Chapter titles commonly contain numbers; numeric collation handles 9 vs 10.
      const chapterOrder = collator.compare(a.chapter, b.chapter);
      if (chapterOrder) return chapterOrder;
    }
    if (a.spine !== null && b.spine === null) return -1;
    if (a.spine === null && b.spine !== null) return 1;
    if (a.page !== null && b.page !== null && a.page !== b.page) return a.page - b.page;
    if (a.startOffset !== null && b.startOffset !== null && a.startOffset !== b.startOffset)
      return a.startOffset - b.startOffset;
    return a.sourceIndex - b.sourceIndex;
  }

  function sortEntries(entries, sort) {
    const result = entries.slice();
    result.sort((a, b) => {
      if (sort === 'az' || sort === 'za') {
        const x = a.type === 'vocab' ? a.headword : a.text;
        const y = b.type === 'vocab' ? b.headword : b.text;
        const n = collator.compare(x, y);
        return (sort === 'za' ? -n : n) || a.sourceIndex - b.sourceIndex;
      }
      if (sort === 'reading') return readingOrder(a, b);
      if (sort === 'oldest') return -newest(a, b);
      return newest(a, b);
    });
    return result;
  }

  function groupBooks(entries, sort) {
    const groups = new Map();
    for (const entry of entries) {
      const key = bookKey(entry);
      if (!groups.has(key)) groups.set(key, {
        key, title: entry.title, author: entry.author,
        entries: [], recent: null, lastIndex: 0
      });
      const group = groups.get(key);
      group.entries.push(entry);
      if (entry.timestamp !== null && (group.recent === null || entry.timestamp > group.recent))
        group.recent = entry.timestamp;
      group.lastIndex = Math.max(group.lastIndex, entry.sourceIndex);
    }
    return Array.from(groups.values()).sort((a, b) => {
      if (sort === 'recent') {
        if (a.recent !== null && b.recent !== null && a.recent !== b.recent) return b.recent - a.recent;
        if (a.recent !== null && b.recent === null) return -1;
        if (b.recent !== null && a.recent === null) return 1;
        if (a.lastIndex !== b.lastIndex) return b.lastIndex - a.lastIndex;
      }
      const n = collator.compare(a.title, b.title) || collator.compare(a.author, b.author);
      return sort === 'za' ? -n : n;
    });
  }

  function utf8Base64(text) {
    const bytes = new TextEncoder().encode(text);
    if (bytes.length > STATE_MAX_BYTES)
      throw new Error('Saved state exceeds 240 KiB; no changes were written.');
    const chunks = [];
    for (let i = 0; i < bytes.length; i += 8192)
      chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
    return btoa(chunks.join(''));
  }

  function fmtDate(timestamp) {
    if (timestamp === null) return 'Date unavailable';
    return new Date(timestamp * 1000).toLocaleString();
  }

  async function mount(container, api) {
    const root = document.createElement('section');
    root.className = 'vb';
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = api.pluginFile('style.css');
    container.replaceChildren(stylesheet, root);

    let vocabulary = [], highlights = [], db = emptyState();
    let readOnly = false, busy = false, tab = 'vocab', query = '', statusFilter = 'all';
    let bookSort = 'az', wordSort = 'az', highlightSort = 'reading';
    let showDeleted = false, bookPage = 0, entryPage = 0, notice = 'Reading SD-card exports…';
    let stateDirectoryReady = false;
    const selectedBooks = { vocab: null, clip: null };
    const selectedEntries = { vocab: null, clip: null };
    const STATE_PATH = STATE_DIR + '/' + STATE_FILE;

    function el(tag, className, content) {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (content !== undefined) element.textContent = String(content);
      return element;
    }
    function btn(text, onClick, className, disabled) {
      const element = el('button', className || '', text);
      element.type = 'button';
      element.disabled = !!disabled;
      element.addEventListener('click', onClick);
      return element;
    }
    function select(options, value, onChange, label) {
      const selectEl = el('select', 'vb-select');
      selectEl.setAttribute('aria-label', label);
      for (const [id, name] of options) {
        const option = el('option', '', name);
        option.value = id;
        option.selected = value === id;
        selectEl.appendChild(option);
      }
      selectEl.addEventListener('change', () => onChange(selectEl.value));
      return selectEl;
    }
    function row(label, value) {
      const line = el('div', 'vb-fact');
      line.append(el('span', 'vb-fact-label', label), el('span', '', value));
      return line;
    }
    function message(text, kind) {
      const block = el('p', 'vb-message' + (kind ? ' vb-' + kind : ''), text);
      block.setAttribute('role', kind === 'error' ? 'alert' : 'status');
      return block;
    }
    async function readFile(path, optional) {
      const response = await fetch('/download?path=' + encodeURIComponent(path), { cache: 'no-store' });
      if (optional && response.status === 404) return null;
      if (!response.ok) throw new Error(path + ' returned HTTP ' + response.status);
      return response.text();
    }
    async function readSavedState() {
      const current = await readFile(STATE_PATH, true);
      if (current !== null) return { raw: current, fromLegacy: false };
      const previous = await readFile(LEGACY_STATE_PATH, true);
      return { raw: previous, fromLegacy: previous !== null };
    }
    async function reload() {
      if (busy) return;
      busy = true;
      notice = 'Reading SD-card exports…';
      render();
      const warnings = [];
      try {
        const sources = await Promise.allSettled([
          readFile('/Vocabulary.txt', true), readFile('/My Clippings.txt', true), readSavedState()
        ]);
        if (sources[0].status === 'fulfilled') {
          const parsed = parseVocabulary(sources[0].value);
          vocabulary = parsed.entries;
          if (sources[0].value === null) warnings.push('Vocabulary.txt is missing from SD root.');
          if (parsed.invalid) warnings.push(parsed.invalid + ' invalid vocabulary line(s) skipped.');
        } else { vocabulary = []; warnings.push('Vocabulary: ' + sources[0].reason.message); }
        if (sources[1].status === 'fulfilled') {
          const parsed = parseClippings(sources[1].value);
          highlights = parsed.entries;
          if (sources[1].value === null) warnings.push('My Clippings.txt is missing from SD root.');
          if (parsed.invalid) warnings.push(parsed.invalid + ' malformed highlight(s) skipped.');
        } else { highlights = []; warnings.push('Highlights: ' + sources[1].reason.message); }
        if (sources[2].status === 'fulfilled') {
          try {
            const saved = sources[2].value;
            db = saved.raw === null ? emptyState() : normalizeState(JSON.parse(saved.raw));
            stateDirectoryReady = saved.raw !== null && !saved.fromLegacy;
            readOnly = false;
            if (saved.fromLegacy) warnings.push('Previous Vocabulary Builder progress loaded; next saved change migrates it to the new state path.');
          } catch (error) {
            readOnly = true;
            warnings.push('Saved state is unreadable (' + error.message + '). Editing is disabled to preserve it.');
          }
        } else {
          readOnly = true;
          warnings.push('Cannot read saved state; edits disabled: ' + sources[2].reason.message);
        }
        notice = warnings.join(' ') || 'Loaded from SD card. Changes save to a separate SD-card state file; source exports are unchanged.';
      } catch (error) {
        notice = error.message;
      } finally {
        busy = false;
        render();
      }
    }
    async function ensureStateDirectory() {
      if (stateDirectoryReady) return;
      const form = new URLSearchParams({ path: '/.crosspoint', name: 'vocabulary-highlights' });
      const response = await fetch('/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form
      });
      if (!response.ok) {
        const text = await response.text();
        if (response.status !== 400 || text.trim() !== 'Folder already exists')
          throw new Error('Could not create saved-state folder (HTTP ' + response.status + '): ' + text);
      }
      stateDirectoryReady = true;
    }
    async function persist(change) {
      if (busy || readOnly || typeof api.writeFile !== 'function') return;
      const next = normalizeState(db);
      change(next);
      busy = true;
      render();
      try {
        const body = utf8Base64(JSON.stringify(next));
        await ensureStateDirectory();
        await api.writeFile(STATE_PATH, body);
        db = next;
        notice = 'Saved. Original export files were not modified.';
      } catch (error) {
        notice = 'Could not save: ' + error.message + '. No status or deletion changes were applied.';
      } finally {
        busy = false;
        render();
      }
    }

    function render() {
      const hadSearch = document.activeElement && document.activeElement.getAttribute('data-vb-search') === '1';
      const selection = hadSearch ? document.activeElement.selectionStart : 0;
      root.replaceChildren();
      const header = el('div', 'vb-header');
      const heading = el('div', '');
      heading.append(el('h2', '', 'Vocabulary & Highlights'),
        el('p', 'vb-muted', 'Books, definitions, highlights and learning progress'));
      header.append(heading, btn('Refresh from SD', reload, 'vb-primary', busy));
      root.append(header);

      const tabs = el('div', 'vb-tabs');
      for (const [id, label, count] of [
        ['vocab', 'Vocabulary', vocabulary.filter(item => !db.hidden[item.id]).length],
        ['clip', 'Highlights', highlights.filter(item => !db.hidden[item.id]).length]
      ]) {
        const button = btn(label + ' (' + count + ')', () => {
          tab = id; bookPage = 0; entryPage = 0; query = ''; render();
        }, 'vb-tab' + (tab === id ? ' vb-active' : ''), busy);
        button.setAttribute('aria-pressed', String(tab === id));
        tabs.appendChild(button);
      }
      root.append(tabs, message(notice, readOnly ? 'error' : ''));

      const controls = el('div', 'vb-controls');
      const search = el('input', 'vb-search');
      search.type = 'search';
      search.placeholder = tab === 'vocab' ? 'Search books, words or definitions' : 'Search books or highlight text';
      search.value = query;
      search.setAttribute('aria-label', 'Search library');
      search.setAttribute('data-vb-search', '1');
      search.addEventListener('input', () => {
        query = search.value; bookPage = 0; entryPage = 0; render();
      });
      controls.appendChild(search);
      const bookPicker = el('label', 'vb-control', 'Books: ');
      bookPicker.appendChild(select([
        ['az', 'A–Z'], ['za', 'Z–A'], ['recent', 'Recently added']
      ], bookSort, value => { bookSort = value; bookPage = 0; render(); }, 'Sort books'));
      controls.appendChild(bookPicker);
      const entryPicker = el('label', 'vb-control', tab === 'vocab' ? 'Words: ' : 'Highlights: ');
      entryPicker.appendChild(select(tab === 'vocab'
        ? [['az', 'A–Z'], ['za', 'Z–A'], ['reading', 'Reading order'], ['newest', 'Newest'], ['oldest', 'Oldest']]
        : [['reading', 'Reading order'], ['newest', 'Newest'], ['oldest', 'Oldest']],
        tab === 'vocab' ? wordSort : highlightSort, value => {
          if (tab === 'vocab') wordSort = value;
          else highlightSort = value;
          entryPage = 0; render();
        }, 'Sort entries'));
      controls.appendChild(entryPicker);
      if (tab === 'vocab') {
        const statusPicker = el('label', 'vb-control', 'Status: ');
        statusPicker.appendChild(select([
          ['all', 'All'], ['new', 'New'], ['learning', 'Learning'], ['mastered', 'Mastered']
        ], statusFilter, value => { statusFilter = value; bookPage = 0; entryPage = 0; render(); },
        'Filter learning status'));
        controls.appendChild(statusPicker);
      }
      const deletedLabel = el('label', 'vb-check');
      const check = el('input');
      check.type = 'checkbox'; check.checked = showDeleted;
      check.addEventListener('change', () => { showDeleted = check.checked; bookPage = 0; entryPage = 0; render(); });
      deletedLabel.append(check, document.createTextNode('Show deleted'));
      controls.appendChild(deletedLabel);
      root.appendChild(controls);

      const source = tab === 'vocab' ? vocabulary : highlights;
      const needle = query.trim().toLowerCase();
      const eligible = source.filter(item =>
        (showDeleted || !db.hidden[item.id]) &&
        (tab !== 'vocab' || statusFilter === 'all' || statusOf(item, db) === statusFilter) &&
        (!needle || [item.title, item.author, item.chapter, item.headword, item.definition, item.text]
          .some(field => typeof field === 'string' && field.toLowerCase().includes(needle)))
      );
      const books = groupBooks(eligible, bookSort);
      if (!books.some(book => book.key === selectedBooks[tab])) {
        selectedBooks[tab] = books.length ? books[0].key : null;
        bookPage = 0; entryPage = 0;
      }
      const selectedBookIndex = books.findIndex(book => book.key === selectedBooks[tab]);
      if (selectedBookIndex >= 0)
        bookPage = Math.floor(selectedBookIndex / BOOK_PAGE_SIZE);
      const currentBook = selectedBookIndex >= 0 ? books[selectedBookIndex] : null;
      const ordered = currentBook ? sortEntries(currentBook.entries, tab === 'vocab' ? wordSort : highlightSort) : [];
      if (!ordered.some(entry => entry.id === selectedEntries[tab])) {
        selectedEntries[tab] = ordered.length ? ordered[0].id : null;
        entryPage = 0;
      }
      const selectedIndex = ordered.findIndex(entry => entry.id === selectedEntries[tab]);
      if (selectedIndex >= 0) entryPage = Math.floor(selectedIndex / ENTRY_PAGE_SIZE);
      const selected = selectedIndex >= 0 ? ordered[selectedIndex] : null;

      const grid = el('div', 'vb-grid');
      const booksPanel = el('section', 'vb-panel');
      booksPanel.appendChild(el('h3', '', 'Books (' + books.length + ')'));
      const booksList = el('div', 'vb-list');
      for (const book of books.slice(bookPage * BOOK_PAGE_SIZE, (bookPage + 1) * BOOK_PAGE_SIZE)) {
        const item = btn('', () => {
          selectedBooks[tab] = book.key; selectedEntries[tab] = null; entryPage = 0; render();
        }, 'vb-list-item' + (selectedBooks[tab] === book.key ? ' vb-selected' : ''));
        item.append(el('strong', '', book.title), el('small', '', (book.author ? book.author + ' · ' : '') +
          book.entries.length + (tab === 'vocab' ? ' words' : ' highlights')));
        booksList.appendChild(item);
      }
      if (!books.length) booksList.appendChild(message('No matching books. Try another filter or refresh.'));
      booksPanel.append(booksList, pagination(bookPage, books.length, BOOK_PAGE_SIZE, value => {
        bookPage = value;
        const target = books[value * BOOK_PAGE_SIZE];
        if (target) { selectedBooks[tab] = target.key; selectedEntries[tab] = null; entryPage = 0; }
        render();
      }));
      grid.appendChild(booksPanel);

      const entriesPanel = el('section', 'vb-panel');
      entriesPanel.appendChild(el('h3', '', currentBook
        ? (tab === 'vocab' ? 'Words' : 'Highlights') + ' (' + ordered.length + ')'
        : 'Entries'));
      const entriesList = el('div', 'vb-list');
      for (const item of ordered.slice(entryPage * ENTRY_PAGE_SIZE, (entryPage + 1) * ENTRY_PAGE_SIZE)) {
        const button = btn('', () => { selectedEntries[tab] = item.id; render(); },
          'vb-list-item' + (selectedEntries[tab] === item.id ? ' vb-selected' : ''));
        button.append(el('strong', '', item.type === 'vocab' ? item.headword : item.text.slice(0, 105)),
          el('small', '', [item.chapter, item.page === null ? '' : 'Page ' + item.page,
            db.hidden[item.id] ? 'Deleted' : item.type === 'vocab' ? statusOf(item, db) : '']
            .filter(Boolean).join(' · ')));
        entriesList.appendChild(button);
      }
      if (!ordered.length) entriesList.appendChild(message('No entries match this view.'));
      entriesPanel.append(entriesList, pagination(entryPage, ordered.length, ENTRY_PAGE_SIZE, value => {
        entryPage = value; selectedEntries[tab] = ordered[value * ENTRY_PAGE_SIZE].id; render();
      }));
      grid.appendChild(entriesPanel);

      const detail = el('section', 'vb-panel vb-detail');
      detail.appendChild(el('h3', '', 'Details'));
      if (selected) {
        detail.appendChild(el('h2', 'vb-word', selected.type === 'vocab' ? selected.headword : 'Saved highlight'));
        if (selected.type === 'vocab') {
          const definition = el('p', 'vb-definition', selected.definition);
          detail.appendChild(definition);
          if (selected.definitionTruncated)
            detail.appendChild(message('Definition was truncated when exported.', 'warning'));
        } else {
          detail.appendChild(el('blockquote', 'vb-definition', selected.text));
        }
        const facts = el('div', 'vb-facts');
        facts.append(row('Book', selected.title),
          row('Author', selected.author || 'Not recorded'),
          row('Location', [selected.chapter, selected.page === null ? '' : 'Page ' + selected.page]
            .filter(Boolean).join(' · ') || 'Not recorded'),
          row('Added', fmtDate(selected.timestamp)));
        if (selected.type === 'vocab' && selected.series)
          facts.appendChild(row('Series', selected.series +
            (selected.seriesIndex === null ? '' : ' #' + selected.seriesIndex)));
        if (selected.type === 'vocab' && selected.spine !== null)
          facts.appendChild(row('Spine', selected.spine));
        detail.appendChild(facts);
        const actions = el('div', 'vb-actions');
        if (selected.type === 'vocab' && !db.hidden[selected.id]) {
          actions.appendChild(el('h4', '', 'Learning status'));
          const statuses = el('div', 'vb-action-row');
          for (const [value, label] of [['new', 'New'], ['learning', 'Learning'], ['mastered', 'Mastered']]) {
            statuses.appendChild(btn(label, () => persist(next => {
              if (value === 'new') delete next.statuses[selected.id];
              else next.statuses[selected.id] = value;
            }), 'vb-choice' + (statusOf(selected, db) === value ? ' vb-current' : ''),
            busy || readOnly));
          }
          actions.appendChild(statuses);
        }
        if (db.hidden[selected.id]) {
          actions.appendChild(btn('Restore entry', () => persist(next => { delete next.hidden[selected.id]; }),
            'vb-primary', busy || readOnly));
        } else {
          actions.appendChild(btn('Delete from list', () => {
            if (typeof window !== 'undefined' && !window.confirm(
              'Hide this entry from Vocabulary Builder? The original SD-card export will remain unchanged.')) return;
            persist(next => { next.hidden[selected.id] = true; });
          }, 'vb-danger', busy || readOnly));
        }
        if (readOnly) actions.appendChild(message('State cannot be read safely. Editing is disabled.', 'error'));
        detail.appendChild(actions);
      } else {
        detail.appendChild(message('Select a book and an entry to see its details.'));
      }
      grid.appendChild(detail);
      root.appendChild(grid);
      root.appendChild(el('p', 'vb-foot', 'Works in the device WebUI on stock CrossPoint and Razor-Crest. ' +
        'This browser view does not run on the e-reader screen.'));
      if (hadSearch) {
        const nextSearch = root.querySelector('[data-vb-search]');
        if (nextSearch) {
          nextSearch.focus();
          nextSearch.setSelectionRange(selection, selection);
        }
      }
    }

    function pagination(page, total, size, go) {
      const pages = Math.ceil(total / size);
      const nav = el('div', 'vb-pager');
      if (pages > 1) {
        nav.append(btn('Previous', () => go(Math.max(0, page - 1)), '', page === 0),
          el('span', '', 'Page ' + (page + 1) + ' / ' + pages),
          btn('Next', () => go(Math.min(pages - 1, page + 1)), '', page + 1 >= pages));
      }
      return nav;
    }

    render();
    await reload();
  }

  if (typeof CrossPoint !== 'undefined' && CrossPoint && typeof CrossPoint.registerPlugin === 'function')
    CrossPoint.registerPlugin(mount);
  if (typeof module !== 'undefined' && module.exports)
    module.exports = { parseVocabulary, parseClippings, normalizeState, emptyState,
      statusOf, bookKey, groupBooks, sortEntries, readingOrder, clipHash, utf8Base64 };
})();
