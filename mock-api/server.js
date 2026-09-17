'use strict';

// Ballast mock API — no dependencies, no install. Run it with:
//   node mock-api/server.js
// It serves the prototype at / and a small REST API at /api, keeping state in
// mock-api/data.json so the demo survives a reload and a restart.

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parse } = require('./parse.js');

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'prototype', 'ballast.html');
const STORE = path.join(__dirname, 'data.json');
const SEED = path.join(__dirname, 'seed.json');
const PORT = parseInt(process.env.PORT || process.argv[2] || '4000', 10);

// ---------------------------------------------------------------- state

const fresh = () => JSON.parse(fs.readFileSync(SEED, 'utf8'));

let state;
try {
  state = JSON.parse(fs.readFileSync(STORE, 'utf8'));
} catch (e) {
  state = fresh();
}

let writing = null;
function save() {
  clearTimeout(writing);
  writing = setTimeout(() => {
    fs.writeFile(STORE, JSON.stringify(state, null, 2), (err) => {
      if (err) console.error('could not write data.json:', err.message);
    });
  }, 40);
}

function nextId() {
  const n = state.items.reduce((hi, it) => Math.max(hi, parseInt(String(it.id).replace(/\D/g, ''), 10) || 0), 0);
  return 'i' + (n + 1);
}

// ---------------------------------------------------------------- answers

// The structured half of retrieval. Counting and filtering happen here, in
// code, over the real records — never in the language model.
const asDate = (s) => (s ? new Date(s + 'T00:00:00') : null);
const money = (n) => '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const count = (n, sing, plur) => (n < 10 ? WORDS[n] : n) + ' ' + (n === 1 ? sing : plur);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function answer(text, todayISO) {
  const t = String(text).toLowerCase();
  const today = asDate(todayISO) || new Date();
  const live = state.items.filter((it) => !it.done);
  const dated = live.filter((it) => it.date).sort((a, b) => asDate(a.date) - asDate(b.date));
  const within = (n) => dated.filter((it) => {
    const d = Math.round((asDate(it.date) - today) / 86400000);
    return d >= 0 && d <= n;
  });

  if (/\b(payments?|pay|paying|owe|owing|cost|costs|money|spend|spending)\b/.test(t)) {
    const pays = dated.filter((it) => it.type === 'Payment');
    const priced = pays.filter((it) => typeof it.amount === 'number');
    const blank = pays.length - priced.length;
    const sum = priced.reduce((a, it) => a + it.amount, 0);
    let lead = pays.length ? cap(count(pays.length, 'payment', 'payments')) + ' ahead' : 'No payments are recorded ahead of today';
    if (priced.length) lead += ', ' + money(sum) + (blank ? ' of it priced' : ' in total');
    lead += '.';
    if (blank) lead += ' ' + (blank === pays.length ? 'None have' : count(blank, 'has', 'have')) + ' no amount on ' + (blank === 1 ? 'it' : 'them') + ' yet.';
    return { title: 'PAYMENTS AHEAD', lead, ids: pays.map((it) => it.id) };
  }

  if (/\b(overdue|late|behind|missed|slipped|slipping)\b/.test(t)) {
    const late = dated.filter((it) => it.type !== 'Note' && asDate(it.date) < today);
    return {
      title: 'PAST ITS DATE',
      lead: late.length ? cap(count(late.length, 'item has', 'items have')) + ' gone past the date you set.' : 'Nothing has slipped. Everything still has time on it.',
      ids: late.map((it) => it.id)
    };
  }

  if (/\b(week|7 days|seven days|next few days|coming days)\b/.test(t)) {
    const soon = within(7);
    return { title: 'THE NEXT SEVEN DAYS', lead: soon.length ? cap(count(soon.length, 'thing falls', 'things fall')) + ' inside seven days.' : 'The week ahead is clear.', ids: soon.map((it) => it.id) };
  }

  if (/\b(today|right now|tonight)\b/.test(t)) {
    const now = within(0);
    return { title: 'TODAY', lead: now.length ? cap(count(now.length, 'thing sits', 'things sit')) + ' on today.' : 'Nothing is dated today.', ids: now.map((it) => it.id) };
  }

  const SEGS = { home: 'home', house: 'home', remodel: 'home', contractor: 'home', wedding: 'wedding', finance: 'finance', tax: 'finance', mortgage: 'finance', invest: 'invest', isa: 'invest', family: 'family' };
  for (const word of Object.keys(SEGS)) {
    if (t.includes(word)) {
      const id = SEGS[word];
      const mine = live.filter((it) => it.seg === id);
      return { title: id.toUpperCase() + ' — OPEN ITEMS', lead: mine.length ? cap(count(mine.length, 'open item', 'open items')) + ' in that part of your life.' : 'Nothing open there at the moment.', ids: mine.map((it) => it.id) };
    }
  }

  // Nothing matched a structured shape — fall back to words in titles.
  const words = t.split(/\W+/).filter((w) => w.length > 3);
  const hits = live.filter((it) => words.some((w) => it.title.toLowerCase().includes(w)));
  return {
    title: hits.length ? 'WHAT I FOUND' : 'NOTHING MATCHED',
    lead: hits.length
      ? cap(count(hits.length, 'item looks', 'items look')) + ' like what you asked about. Say it differently if none of these are it.'
      : 'I could not match that to anything you have saved. Try a segment name, a date, or a word from the item itself.',
    ids: hits.map((it) => it.id)
  };
}

// ---------------------------------------------------------------- routing

const json = (res, code, body) => {
  const s = JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(s),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(s);
};

function body(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 2e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { resolve({}); } });
  });
}

function servePage(res) {
  fs.readFile(PAGE, 'utf8', (err, html) => {
    if (err) { res.writeHead(500); return res.end('Cannot read prototype/ballast.html — run this from the repository.'); }
    // The prototype is written to sit inside the artifact's own skeleton, so
    // supply the equivalent one here: the title moves up into the head, the
    // rest of the file becomes the body.
    const t = html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = t ? t[1].trim() : 'Ballast';
    const doc = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
      '<title>' + title + '</title>\n' +
      '<style>html,body{height:100%}body{margin:0;background:#fafaf9;-webkit-font-smoothing:antialiased}' +
      'img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n' +
      (t ? html.replace(t[0], '') : html) + '\n</body>\n</html>';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(doc);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (!p.startsWith('/api')) {
    if (p === '/' || p === '/index.html') return servePage(res);
    if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
    res.writeHead(404); return res.end('Not found');
  }
  if (p !== '/api/health') console.log('  ' + req.method.padEnd(6) + p);

  const m = req.method;
  const in_ = (m === 'GET' || m === 'DELETE') ? {} : await body(req);
  const item = p.match(/^\/api\/items\/([^/]+)$/);

  try {
    if (p === '/api/health') return json(res, 200, { ballast: true, items: state.items.length });

    if (p === '/api/state') {
      if (m === 'GET') return json(res, 200, state);
      if (m === 'PUT') { state = { items: in_.items || [], segments: in_.segments || state.segments, settings: in_.settings || state.settings, onboarded: !!in_.onboarded }; save(); return json(res, 200, state); }
      if (m === 'DELETE') { state = fresh(); save(); return json(res, 200, state); }
    }

    if (p === '/api/items') {
      if (m === 'GET') return json(res, 200, state.items);
      if (m === 'POST') {
        const it = Object.assign({}, in_, { id: in_.id && !state.items.some((x) => x.id === in_.id) ? in_.id : nextId() });
        state.items.push(it); save();
        return json(res, 201, it);
      }
    }

    if (item) {
      const i = state.items.findIndex((x) => x.id === item[1]);
      if (i < 0) return json(res, 404, { error: 'No item with that id' });
      if (m === 'PATCH') { Object.assign(state.items[i], in_); save(); return json(res, 200, state.items[i]); }
      if (m === 'DELETE') { const gone = state.items.splice(i, 1)[0]; save(); return json(res, 200, gone); }
      if (m === 'GET') return json(res, 200, state.items[i]);
    }

    if (p === '/api/segments' && m === 'PUT') { state.segments = in_.segments || in_; save(); return json(res, 200, { segments: state.segments }); }
    if (p === '/api/settings' && m === 'PUT') { Object.assign(state.settings, in_.settings || in_); save(); return json(res, 200, { settings: state.settings }); }

    if (p === '/api/assistant/parse' && m === 'POST') {
      const today = in_.today ? new Date(in_.today + 'T00:00:00') : new Date();
      return json(res, 200, { proposals: parse(in_.text || '', today, in_.segments || state.segments) });
    }
    if (p === '/api/assistant/query' && m === 'POST') {
      return json(res, 200, answer(in_.text || '', in_.today));
    }

    return json(res, 404, { error: 'No such endpoint', path: p });
  } catch (err) {
    return json(res, 500, { error: err.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces()).flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal).map((n) => n.address);
  console.log('\n  Ballast is running.\n');
  console.log('    on this computer   http://localhost:' + PORT);
  lan.forEach((ip) => console.log('    on your phone      http://' + ip + ':' + PORT + '   (same wifi)'));
  console.log('\n  State lives in mock-api/data.json — delete it to start the demo over.');
  console.log('  Stop with Ctrl-C.\n');
});
