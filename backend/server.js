'use strict';

// Smarty backend. Node's standard library plus the built-in
// node:sqlite module only — no npm install, no external database.
//   node backend/server.js          http://localhost:4000
//   node backend/server.js 5000     pick a port

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { open, wipe, createBlankUser, log, newId } = require('./db.js');
const { taskState, segmentCounts, daysUntil } = require('./status.js');
const assistant = require('./assistant.js');

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'prototype', 'tracker.html');
const ICONS_DIR = path.join(ROOT, 'prototype', 'icons');
const PORT = parseInt(process.env.PORT || process.argv[2] || '4000', 10);

let db = open();
const USER_ID = 'u1';

// ---------------------------------------------------------------- helpers

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

function getUser() { return db.prepare('SELECT * FROM users WHERE id = ?').get(USER_ID); }
function allSegments() { return db.prepare('SELECT * FROM segments WHERE user_id = ? ORDER BY sort_order, created_at').all(USER_ID); }
function allTasks() {
  return db.prepare('SELECT tasks.* FROM tasks JOIN segments ON segments.id = tasks.segment_id WHERE segments.user_id = ? ORDER BY tasks.created_at').all(USER_ID);
}
function segmentRow(id) { return db.prepare('SELECT * FROM segments WHERE id = ?').get(id); }
function taskRow(id) { return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id); }

function effectiveReminder(task, user) {
  const parse = (s) => { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch (e) { return null; } };
  const prefs = parse(user.preferences) || {};
  return parse(task.reminder) || prefs.reminderDefault || { mode: 'none' };
}

function decorateTask(t) {
  const now = new Date();
  const seg = segmentRow(t.segment_id);
  const user = getUser();
  return Object.assign({}, t, {
    segmentName: seg ? seg.name : null,
    segmentColor: seg ? seg.color : null,
    state: taskState(t, now),
    reminder: effectiveReminder(t, user),
    googleCalendarUrl: googleCalendarUrl(t, seg, user)
  });
}

function decorateSegment(s, tasks) {
  const c = segmentCounts(s, tasks, new Date());
  return Object.assign({}, s, {
    overdueCount: c.overdue, approachingCount: c.approaching, pendingCount: c.pending, completedCount: c.completed,
    nextTask: c.nextTask ? { id: c.nextTask.id, title: c.nextTask.title, due_at: c.nextTask.due_at } : null
  });
}

// ---------------------------------------------------------------- voice transcription

async function transcribeWithOpenAI(buf, mime, key) {
  const ext = mime.includes('mp4') ? 'mp4' : mime.includes('wav') ? 'wav' : mime.includes('ogg') ? 'ogg' : 'webm';
  const form = new FormData();
  form.append('file', new Blob([buf], { type: mime }), 'audio.' + ext);
  form.append('model', 'whisper-1');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key },
    body: form
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data.error && data.error.message) || 'Transcription failed.');
  return (data.text || '').trim();
}

async function transcribeWithGemini(buf, mime, key) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=' + key;
  const reqBody = {
    contents: [{
      parts: [
        { text: 'Transcribe this audio recording exactly as spoken. Reply with only the transcript text, nothing else.' },
        { inline_data: { mime_type: mime, data: buf.toString('base64') } }
      ]
    }]
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reqBody)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data.error && data.error.message) || 'Transcription failed.');
  const text = data.candidates && data.candidates[0] && data.candidates[0].content &&
    data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
    data.candidates[0].content.parts[0].text;
  if (!text) throw new Error('Gemini returned no transcript for this audio format.');
  return text.trim();
}

// ---------------------------------------------------------------- page

function servePage(res) {
  fs.readFile(PAGE, 'utf8', (err, html) => {
    if (err) { res.writeHead(500); return res.end('Cannot read prototype/tracker.html — run this from the repository.'); }
    const t = html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = t ? t[1].trim() : 'Smarty';
    const doc = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
      '<title>' + title + '</title>\n' +
      '<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">\n' +
      '<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">\n' +
      '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">\n' +
      '<link rel="manifest" href="/manifest.json">\n' +
      '<meta name="theme-color" content="#6e9075">\n' +
      '<style>html,body{height:100%}body{margin:0;background:#fafafa;-webkit-font-smoothing:antialiased}img{max-width:100%}[hidden]{display:none!important}</style>\n' +
      '</head>\n<body>\n' + (t ? html.replace(t[0], '') : html) + '\n</body>\n</html>';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(doc);
  });
}

function serveIcon(res, filename) {
  fs.readFile(path.join(ICONS_DIR, filename), (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
    res.end(data);
  });
}

function serveManifest(res) {
  const manifest = {
    name: 'Smarty', short_name: 'Smarty', start_url: '/', display: 'standalone',
    background_color: '#f6f1e8', theme_color: '#6e9075',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  };
  const s = JSON.stringify(manifest);
  res.writeHead(200, { 'Content-Type': 'application/manifest+json', 'Content-Length': Buffer.byteLength(s), 'Cache-Control': 'public, max-age=86400' });
  res.end(s);
}

// ---------------------------------------------------------------- routing

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname, m = req.method;

  if (m === 'OPTIONS') return json(res, 204, {});
  if (!p.startsWith('/api')) {
    if (p === '/' || p === '/index.html') return servePage(res);
    if (p === '/favicon.ico') return serveIcon(res, 'favicon-32.png');
    if (p.startsWith('/icons/') && /^[a-z0-9.-]+$/i.test(p.slice(7))) return serveIcon(res, p.slice(7));
    if (p === '/manifest.json') return serveManifest(res);
    res.writeHead(404); return res.end('Not found');
  }
  if (p !== '/api/health') console.log('  ' + m.padEnd(6) + p);

  const inBody = (m === 'GET' || m === 'DELETE') ? {} : await body(req);

  try {
    // ---- health & auth -------------------------------------------------
    if (p === '/api/health') return json(res, 200, { trackerApp: true });

    if (p === '/api/auth/sign-in' && m === 'POST') {
      if (!getUser()) createBlankUser(db, USER_ID, new Date());
      return json(res, 200, getUser());
    }
    if (p === '/api/me') return json(res, 200, getUser() || null);
    if (p === '/api/auth/sign-out' && m === 'POST') return json(res, 200, { ok: true });
    if (p === '/api/account' && m === 'DELETE') { wipe(db); return json(res, 200, { ok: true }); }
    if (p === '/api/profile' && m === 'PUT') {
      const u = getUser();
      const fields = {
        display_name: 'display_name' in inBody ? inBody.display_name : u.display_name,
        age_range: 'age_range' in inBody ? inBody.age_range : u.age_range,
        life_stage: 'life_stage' in inBody ? JSON.stringify(inBody.life_stage) : u.life_stage,
        goals: 'goals' in inBody ? JSON.stringify(inBody.goals) : u.goals
      };
      db.prepare('UPDATE users SET display_name=?, age_range=?, life_stage=?, goals=? WHERE id=?').run(fields.display_name, fields.age_range, fields.life_stage, fields.goals, u.id);
      return json(res, 200, getUser());
    }

    // ---- segments --------------------------------------------------------
    if (p === '/api/segments') {
      const tasks = allTasks();
      if (m === 'GET') return json(res, 200, allSegments().map((s) => decorateSegment(s, tasks)));
      if (m === 'POST') {
        const id = newId('sg');
        const maxOrder = allSegments().reduce((hi, s) => Math.max(hi, s.sort_order), -1);
        const kind = ['project', 'routine'].includes(inBody.kind) ? inBody.kind : 'permanent';
        db.prepare('INSERT INTO segments (id,user_id,name,description,icon,color,kind,target_date,sort_order,status,archived_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(id, USER_ID, inBody.name || 'Untitled', inBody.description || '', inBody.icon || null, inBody.color || '#3B6FD9', kind, kind === 'project' ? (inBody.target_date || null) : null, maxOrder + 1, 'active', null, new Date().toISOString());
        log(db, USER_ID, 'segment', id, 'created');
        return json(res, 201, decorateSegment(segmentRow(id), tasks));
      }
    }
    const segMatch = p.match(/^\/api\/segments\/([^/]+)(?:\/(archive|restore|hide|show))?$/);
    if (segMatch) {
      const sg = segmentRow(segMatch[1]);
      if (!sg) return json(res, 404, { error: 'No such segment' });
      const tasks = allTasks();
      if (segMatch[2] === 'archive' && m === 'POST') {
        db.prepare('UPDATE segments SET status=?, archived_at=? WHERE id=?').run('archived', new Date().toISOString(), sg.id);
        log(db, USER_ID, 'segment', sg.id, 'archived');
        return json(res, 200, decorateSegment(segmentRow(sg.id), tasks));
      }
      if (segMatch[2] === 'restore' && m === 'POST') {
        db.prepare('UPDATE segments SET status=?, archived_at=NULL WHERE id=?').run('active', sg.id);
        log(db, USER_ID, 'segment', sg.id, 'restored');
        return json(res, 200, decorateSegment(segmentRow(sg.id), tasks));
      }
      if (segMatch[2] === 'hide' && m === 'POST') {
        db.prepare('UPDATE segments SET status=? WHERE id=?').run('hidden', sg.id);
        return json(res, 200, decorateSegment(segmentRow(sg.id), tasks));
      }
      if (segMatch[2] === 'show' && m === 'POST') {
        db.prepare('UPDATE segments SET status=? WHERE id=?').run('active', sg.id);
        return json(res, 200, decorateSegment(segmentRow(sg.id), tasks));
      }
      if (!segMatch[2] && m === 'PATCH') {
        const fields = { name: sg.name, description: sg.description, icon: sg.icon, color: sg.color, kind: sg.kind, target_date: sg.target_date, sort_order: sg.sort_order };
        for (const k of ['name', 'description', 'icon', 'color', 'kind', 'target_date', 'sort_order']) if (k in inBody) fields[k] = inBody[k];
        if (fields.kind !== 'project') fields.target_date = null;
        db.prepare('UPDATE segments SET name=?, description=?, icon=?, color=?, kind=?, target_date=?, sort_order=? WHERE id=?').run(fields.name, fields.description, fields.icon, fields.color, fields.kind, fields.target_date, fields.sort_order, sg.id);
        log(db, USER_ID, 'segment', sg.id, 'edited');
        return json(res, 200, decorateSegment(segmentRow(sg.id), tasks));
      }
      if (!segMatch[2] && m === 'DELETE') {
        db.prepare('DELETE FROM tasks WHERE segment_id=?').run(sg.id);
        db.prepare('DELETE FROM segments WHERE id=?').run(sg.id);
        log(db, USER_ID, 'segment', sg.id, 'deleted');
        return json(res, 200, { ok: true });
      }
    }
    if (p === '/api/segments/reorder' && m === 'PUT') {
      (inBody.order || []).forEach((id, i) => db.prepare('UPDATE segments SET sort_order=? WHERE id=?').run(i, id));
      return json(res, 200, allSegments());
    }

    // ---- tasks -------------------------------------------------------
    if (p === '/api/tasks') {
      if (m === 'GET') {
        let rows = allTasks();
        const q = url.searchParams;
        if (q.get('segment_id')) rows = rows.filter((t) => t.segment_id === q.get('segment_id'));
        if (q.get('state')) rows = rows.filter((t) => taskState(t, new Date()) === q.get('state'));
        if (q.get('status')) rows = rows.filter((t) => t.status === q.get('status'));
        if (q.get('q')) {
          const needle = q.get('q').toLowerCase();
          rows = rows.filter((t) => t.title.toLowerCase().includes(needle) || (t.notes || '').toLowerCase().includes(needle));
        }
        return json(res, 200, rows.map(decorateTask));
      }
      if (m === 'POST') {
        const id = newId('t');
        const sg = segmentRow(inBody.segment_id);
        if (!sg) return json(res, 400, { error: 'segment_id must name an existing segment' });
        db.prepare('INSERT INTO tasks (id,segment_id,title,notes,due_at,due_time,priority,status,reminder,calendar_event_id,completed_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(id, inBody.segment_id, inBody.title || 'Untitled task', inBody.notes || '', inBody.due_at || null, inBody.due_at ? (inBody.due_time || null) : null, inBody.priority || 'normal', 'open', inBody.reminder ? JSON.stringify(inBody.reminder) : null, null, null, new Date().toISOString());
        log(db, USER_ID, 'task', id, 'created');
        let t = taskRow(id);
        if (inBody.calendarExport && t.due_at) t = exportToCalendar(t);
        return json(res, 201, decorateTask(t));
      }
    }
    const taskMatch = p.match(/^\/api\/tasks\/([^/]+)(?:\/(complete|reopen|archive|calendar-export|calendar\.ics))?$/);
    if (taskMatch) {
      const t = taskRow(taskMatch[1]);
      if (!t) return json(res, 404, { error: 'No such task' });
      const action = taskMatch[2];
      if (action === 'calendar.ics' && m === 'GET') {
        if (!t.due_at) return json(res, 400, { error: 'Only a task with a deadline can go on the calendar' });
        const seg = segmentRow(t.segment_id);
        const ics = icsForTask(t, seg);
        const safeName = (t.title || 'task').replace(/[^a-z0-9]+/gi, '-').slice(0, 40) || 'task';
        res.writeHead(200, {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="' + safeName + '.ics"',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(ics);
      }
      if (action === 'complete' && m === 'POST') {
        db.prepare('UPDATE tasks SET status=?, completed_at=? WHERE id=?').run('completed', new Date().toISOString(), t.id);
        log(db, USER_ID, 'task', t.id, 'completed');
        return json(res, 200, decorateTask(taskRow(t.id)));
      }
      if (action === 'reopen' && m === 'POST') {
        db.prepare('UPDATE tasks SET status=?, completed_at=NULL WHERE id=?').run('open', t.id);
        log(db, USER_ID, 'task', t.id, 'reopened');
        return json(res, 200, decorateTask(taskRow(t.id)));
      }
      if (action === 'archive' && m === 'POST') {
        db.prepare('UPDATE tasks SET status=? WHERE id=?').run('archived', t.id);
        log(db, USER_ID, 'task', t.id, 'archived');
        return json(res, 200, decorateTask(taskRow(t.id)));
      }
      if (action === 'calendar-export') {
        if (m === 'POST') {
          if (!t.due_at) return json(res, 400, { error: 'Only a task with a deadline can go on the calendar' });
          return json(res, 200, decorateTask(exportToCalendar(t)));
        }
        if (m === 'DELETE') {
          db.prepare('UPDATE tasks SET calendar_event_id=NULL WHERE id=?').run(t.id);
          return json(res, 200, decorateTask(taskRow(t.id)));
        }
      }
      if (!action && m === 'GET') return json(res, 200, decorateTask(t));
      if (!action && m === 'PATCH') {
        const wasDate = t.due_at;
        const fields = { title: t.title, notes: t.notes, due_at: t.due_at, due_time: t.due_time, priority: t.priority, reminder: t.reminder, segment_id: t.segment_id };
        for (const k of ['title', 'notes', 'due_at', 'due_time', 'priority', 'segment_id']) if (k in inBody) fields[k] = inBody[k];
        if (!fields.due_at) fields.due_time = null;
        if ('reminder' in inBody) fields.reminder = inBody.reminder ? JSON.stringify(inBody.reminder) : null;
        db.prepare('UPDATE tasks SET title=?, notes=?, due_at=?, due_time=?, priority=?, reminder=?, segment_id=? WHERE id=?')
          .run(fields.title, fields.notes, fields.due_at, fields.due_time, fields.priority, fields.reminder, fields.segment_id, t.id);
        log(db, USER_ID, 'task', t.id, wasDate !== fields.due_at ? 'rescheduled' : 'edited');
        let updated = taskRow(t.id);
        const dateMoved = fields.due_at !== wasDate;
        if (dateMoved && updated.calendar_event_id) updated = exportToCalendar(updated);
        return json(res, 200, Object.assign(decorateTask(updated), { calendarMoved: dateMoved && !!t.calendar_event_id }));
      }
      if (!action && m === 'DELETE') {
        db.prepare('DELETE FROM tasks WHERE id=?').run(t.id);
        log(db, USER_ID, 'task', t.id, 'deleted');
        return json(res, 200, { ok: true });
      }
    }

    // ---- dashboard & progress -----------------------------------
    if (p === '/api/dashboard' && m === 'GET') return json(res, 200, dashboard());
    if (p === '/api/progress' && m === 'GET') return json(res, 200, progress());

    // ---- settings ------------------------------------------------------
    if (p === '/api/settings/reminder' && m === 'PUT') {
      const u = getUser();
      const prefs = JSON.parse(u.preferences);
      prefs.reminderDefault = inBody;
      db.prepare('UPDATE users SET preferences=? WHERE id=?').run(JSON.stringify(prefs), USER_ID);
      return json(res, 200, getUser());
    }
    if (p === '/api/settings/voice' && m === 'PUT') {
      const u = getUser();
      const prefs = JSON.parse(u.preferences);
      if ('voiceSpoken' in inBody) prefs.voiceSpoken = !!inBody.voiceSpoken;
      if ('privateMode' in inBody) prefs.privateMode = !!inBody.privateMode;
      db.prepare('UPDATE users SET preferences=? WHERE id=?').run(JSON.stringify(prefs), USER_ID);
      return json(res, 200, getUser());
    }
    if (p === '/api/settings/calendar' && m === 'PUT') {
      const status = inBody.connect ? 'connected' : 'disconnected';
      db.prepare('UPDATE integrations SET status=? WHERE user_id=? AND provider=?').run(status, USER_ID, 'google_calendar');
      return json(res, 200, db.prepare('SELECT * FROM integrations WHERE user_id=? AND provider=?').get(USER_ID, 'google_calendar'));
    }
    if (p === '/api/integrations' && m === 'GET') return json(res, 200, db.prepare('SELECT * FROM integrations WHERE user_id=?').all(USER_ID));

    // ---- assistant -------------------------------------------------------
    if (p === '/api/assistant/parse' && m === 'POST') {
      const today = inBody.today ? new Date(inBody.today + 'T00:00:00') : new Date();
      return json(res, 200, { proposals: assistant.parse(inBody.text || '', { today, segments: allSegments(), listMode: !!inBody.listMode }) });
    }
    if (p === '/api/assistant/query' && m === 'POST') {
      const today = inBody.today ? new Date(inBody.today + 'T00:00:00') : new Date();
      return json(res, 200, assistant.answer(inBody.text || '', { today, segments: allSegments(), tasks: allTasks() }));
    }
    // Real speech-to-text for browsers with no Web Speech API support
    // (every browser on iOS, since they all run WebKit) — the client
    // records audio instead and posts it here as base64. Requires an
    // OPENAI_API_KEY in the environment; without one this just tells the
    // client plainly rather than pretending to work.
    if (p === '/api/assistant/transcribe' && m === 'POST') {
      const geminiKey = process.env.GEMINI_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!geminiKey && !openaiKey) return json(res, 501, { error: 'Voice transcription isn’t set up on this server yet (set GEMINI_API_KEY or OPENAI_API_KEY).' });
      if (!inBody.audio) return json(res, 400, { error: 'No audio received.' });
      try {
        const buf = Buffer.from(inBody.audio, 'base64');
        if (!buf.length) return json(res, 400, { error: 'No audio received.' });
        const mime = inBody.mimeType || 'audio/webm';
        // Gemini is preferred when both keys are set, since it's the one
        // most recently asked for — but it's a general multimodal model
        // doing transcription via a prompt, not a purpose-built speech
        // model, and its documented audio inputs are WAV/MP3/AAC/OGG/FLAC,
        // not the webm/mp4 a browser's MediaRecorder actually produces; if
        // it rejects the format, that error comes back to the client as-is.
        const text = geminiKey ? await transcribeWithGemini(buf, mime, geminiKey) : await transcribeWithOpenAI(buf, mime, openaiKey);
        return json(res, 200, { text });
      } catch (e) {
        return json(res, 502, { error: e.message || 'Transcription failed.' });
      }
    }

    // ---- search ----------------------------------------------------------
    if (p === '/api/search' && m === 'GET') {
      const needle = (url.searchParams.get('q') || '').toLowerCase();
      if (!needle) return json(res, 200, { tasks: [] });
      const tasks = allTasks().filter((t) => t.title.toLowerCase().includes(needle) || (t.notes || '').toLowerCase().includes(needle)).map(decorateTask);
      return json(res, 200, { tasks });
    }

    return json(res, 404, { error: 'No such endpoint', path: p });
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: err.message });
  }
});

function exportToCalendar(t) {
  const eventId = t.calendar_event_id || (t.id + '@smarty-tracker');
  db.prepare('UPDATE tasks SET calendar_event_id=? WHERE id=?').run(eventId, t.id);
  return taskRow(t.id);
}

// Real calendar export without needing Google/Apple OAuth (no credentials
// for either exist in this environment): a downloadable .ics file opens
// directly in Apple Calendar (and imports into Google/Outlook), and
// Google's own "quick add" URL pre-fills an event with no auth at all.
// Both are stateless, one-tap exports rather than a live, background sync.
function icsEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
function nextDayIso(iso) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function addMinutesToTime(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = ((h * 60 + m + mins) % 1440 + 1440) % 1440;
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}
// Floating (no timezone) date/date-time, matching how the rest of the app
// already treats due_at/due_time as plain local wall-clock values.
function icsDates(t) {
  if (!t.due_time) {
    const start = t.due_at.replace(/-/g, '');
    const end = nextDayIso(t.due_at).replace(/-/g, '');
    return { allDay: true, dtstart: 'DTSTART;VALUE=DATE:' + start, dtend: 'DTEND;VALUE=DATE:' + end, startRaw: start, endRaw: end };
  }
  const datePart = t.due_at.replace(/-/g, '');
  const startTime = t.due_time.replace(':', '') + '00';
  const endTime = addMinutesToTime(t.due_time, 30).replace(':', '') + '00';
  return { allDay: false, dtstart: 'DTSTART:' + datePart + 'T' + startTime, dtend: 'DTEND:' + datePart + 'T' + endTime, startRaw: datePart + 'T' + startTime, endRaw: datePart + 'T' + endTime };
}
function eventDetails(t, seg) {
  return [seg ? seg.name : null, t.notes || null].filter(Boolean).join(' \u2014 ');
}
function icsForTask(t, seg) {
  const d = icsDates(t);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const details = eventDetails(t, seg);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Smarty//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:' + (t.calendar_event_id || t.id + '@smarty-tracker'),
    'DTSTAMP:' + stamp, d.dtstart, d.dtend,
    'SUMMARY:' + icsEscape(t.title),
    details ? 'DESCRIPTION:' + icsEscape(details) : null,
    'END:VEVENT', 'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');
}
function googleCalendarUrl(t, seg, user) {
  if (!t.due_at) return null;
  const d = icsDates(t);
  const params = new URLSearchParams({
    action: 'TEMPLATE', text: t.title, dates: d.startRaw + '/' + d.endRaw,
    details: eventDetails(t, seg)
  });
  if (!d.allDay && user && user.timezone) params.set('ctz', user.timezone);
  return 'https://calendar.google.com/calendar/render?' + params.toString();
}

function dashboard() {
  const user = getUser();
  const tasks = allTasks();
  const segments = allSegments().filter((s) => s.status === 'active').map((s) => decorateSegment(s, tasks));
  const now = new Date();
  const open = tasks.filter((t) => t.status === 'open');

  const overdue = open.filter((t) => taskState(t, now) === 'overdue').length;
  const approaching = open.filter((t) => taskState(t, now) === 'approaching').length;
  const pending = open.filter((t) => taskState(t, now) === 'pending').length;
  const completedThisWeek = tasks.filter((t) => t.status === 'completed' && t.completed_at && daysUntil(t.completed_at.slice(0, 10), now) >= -7).length;

  const sorted = segments.slice().sort((a, b) => (b.overdueCount > 0) - (a.overdueCount > 0) || (b.approachingCount > 0) - (a.approachingCount > 0));

  return {
    user: { name: user.display_name },
    summary: { overdue, approaching, pending, completedThisWeek },
    segments: sorted
  };
}

function progress() {
  const now = new Date();
  const tasks = allTasks();
  const completedThisWeek = tasks.filter((t) => t.status === 'completed' && t.completed_at && daysUntil(t.completed_at.slice(0, 10), now) >= -7);
  return { completedThisWeek: completedThisWeek.map(decorateTask), totalCompleted: tasks.filter((t) => t.status === 'completed').length };
}

server.listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces()).flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal).map((n) => n.address);
  console.log('\n  Smarty backend is running.\n');
  console.log('    on this computer   http://localhost:' + PORT);
  lan.forEach((ip) => console.log('    on your phone      http://' + ip + ':' + PORT + '   (same wifi)'));
  console.log('\n  Data lives in backend/data.sqlite — delete it to reset the demo.');
  console.log('  Stop with Ctrl-C.\n');
});
