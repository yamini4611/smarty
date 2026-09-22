'use strict';

// Smart Life Tracker backend. Node's standard library plus the built-in
// node:sqlite module only — no npm install, no external database.
//   node backend/server.js          http://localhost:4000
//   node backend/server.js 5000     pick a port

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { open, wipe, plant, log, newId } = require('./db.js');
const { computeProjectStatus, nextTask, effectiveReminder, daysUntil } = require('./status.js');
const assistant = require('./assistant.js');

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'prototype', 'tracker.html');
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
function allProjects() { return db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at').all(USER_ID); }
function allTasks() {
  return db.prepare('SELECT tasks.* FROM tasks JOIN projects ON projects.id = tasks.project_id WHERE projects.user_id = ? ORDER BY tasks.created_at').all(USER_ID);
}
function projectRow(id) { return db.prepare('SELECT * FROM projects WHERE id = ?').get(id); }
function taskRow(id) { return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id); }

function decorateProject(p, tasks, user) {
  const s = computeProjectStatus(p, tasks, new Date());
  const next = nextTask(p, tasks);
  const open = tasks.filter((t) => t.project_id === p.id && t.status === 'open');
  const done = tasks.filter((t) => t.project_id === p.id && t.status === 'completed');
  const overdue = open.filter((t) => t.due_at && daysUntil(t.due_at, new Date()) < 0).length;
  return Object.assign({}, p, {
    status: s.status, statusReason: s.reason, manualStatus: !!s.manual,
    nextTask: next ? { id: next.id, title: next.title, due_at: next.due_at } : null,
    openCount: open.length, doneCount: done.length, overdueCount: overdue,
    reminder: effectiveReminder({ reminder: p.reminder_default }, { reminder_default: null }, user)
  });
}

function decorateTask(t) {
  const p = projectRow(t.project_id);
  const user = getUser();
  return Object.assign({}, t, {
    blocked: !!t.blocked,
    projectName: p ? p.name : null,
    reminder: effectiveReminder(t, p || {}, user)
  });
}

// ---------------------------------------------------------------- page

function servePage(res) {
  fs.readFile(PAGE, 'utf8', (err, html) => {
    if (err) { res.writeHead(500); return res.end('Cannot read prototype/tracker.html — run this from the repository.'); }
    const t = html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = t ? t[1].trim() : 'Smart Life Tracker';
    const doc = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
      '<title>' + title + '</title>\n' +
      '<style>html,body{height:100%}body{margin:0;background:#fafaf9;-webkit-font-smoothing:antialiased}img{max-width:100%}[hidden]{display:none!important}</style>\n' +
      '</head>\n<body>\n' + (t ? html.replace(t[0], '') : html) + '\n</body>\n</html>';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(doc);
  });
}

// ---------------------------------------------------------------- routing

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname, m = req.method;

  if (m === 'OPTIONS') return json(res, 204, {});
  if (!p.startsWith('/api')) {
    if (p === '/' || p === '/index.html') return servePage(res);
    if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
    res.writeHead(404); return res.end('Not found');
  }
  if (p !== '/api/health') console.log('  ' + m.padEnd(6) + p);

  const inBody = (m === 'GET' || m === 'DELETE') ? {} : await body(req);

  try {
    // ---- health & auth -------------------------------------------------
    if (p === '/api/health') return json(res, 200, { trackerApp: true });

    if (p === '/api/auth/sign-in' && m === 'POST') {
      if (!getUser()) plant(db, new Date());
      return json(res, 200, getUser());
    }
    if (p === '/api/me') return json(res, 200, getUser() || null);
    if (p === '/api/auth/sign-out' && m === 'POST') return json(res, 200, { ok: true });
    if (p === '/api/account' && m === 'DELETE') { wipe(db); return json(res, 200, { ok: true }); }

    // ---- projects --------------------------------------------------------
    if (p === '/api/projects') {
      const user = getUser();
      const tasks = allTasks();
      if (m === 'GET') return json(res, 200, allProjects().map((pr) => decorateProject(pr, tasks, user)));
      if (m === 'POST') {
        const id = newId('pr');
        db.prepare('INSERT INTO projects (id,user_id,name,description,life_area,status_override,reminder_default,archived_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
          .run(id, USER_ID, inBody.name || 'Untitled project', inBody.description || '', inBody.life_area || null, null, inBody.reminder_default ? JSON.stringify(inBody.reminder_default) : null, null, new Date().toISOString());
        log(db, USER_ID, 'project', id, 'created');
        return json(res, 201, decorateProject(projectRow(id), tasks, user));
      }
    }
    const projMatch = p.match(/^\/api\/projects\/([^/]+)(?:\/(archive|restore))?$/);
    if (projMatch) {
      const pr = projectRow(projMatch[1]);
      if (!pr) return json(res, 404, { error: 'No such project' });
      const user = getUser();
      if (projMatch[2] === 'archive' && m === 'POST') {
        db.prepare('UPDATE projects SET archived_at = ? WHERE id = ?').run(new Date().toISOString(), pr.id);
        log(db, USER_ID, 'project', pr.id, 'archived');
        return json(res, 200, decorateProject(projectRow(pr.id), allTasks(), user));
      }
      if (projMatch[2] === 'restore' && m === 'POST') {
        db.prepare('UPDATE projects SET archived_at = NULL WHERE id = ?').run(pr.id);
        log(db, USER_ID, 'project', pr.id, 'restored');
        return json(res, 200, decorateProject(projectRow(pr.id), allTasks(), user));
      }
      if (!projMatch[2] && m === 'GET') return json(res, 200, decorateProject(pr, allTasks(), user));
      if (!projMatch[2] && m === 'PATCH') {
        const fields = { name: pr.name, description: pr.description, life_area: pr.life_area, status_override: pr.status_override, reminder_default: pr.reminder_default };
        if ('name' in inBody) fields.name = inBody.name;
        if ('description' in inBody) fields.description = inBody.description;
        if ('life_area' in inBody) fields.life_area = inBody.life_area;
        if ('status_override' in inBody) fields.status_override = inBody.status_override;
        if ('reminder_default' in inBody) fields.reminder_default = inBody.reminder_default ? JSON.stringify(inBody.reminder_default) : null;
        db.prepare('UPDATE projects SET name=?, description=?, life_area=?, status_override=?, reminder_default=? WHERE id=?')
          .run(fields.name, fields.description, fields.life_area, fields.status_override, fields.reminder_default, pr.id);
        log(db, USER_ID, 'project', pr.id, 'edited');
        return json(res, 200, decorateProject(projectRow(pr.id), allTasks(), user));
      }
      if (!projMatch[2] && m === 'DELETE') {
        db.prepare('DELETE FROM tasks WHERE project_id = ?').run(pr.id);
        db.prepare('DELETE FROM projects WHERE id = ?').run(pr.id);
        log(db, USER_ID, 'project', pr.id, 'deleted');
        return json(res, 200, { ok: true });
      }
    }

    // ---- tasks -------------------------------------------------------
    if (p === '/api/tasks') {
      if (m === 'GET') {
        let rows = allTasks();
        const q = url.searchParams;
        if (q.get('project_id')) rows = rows.filter((t) => t.project_id === q.get('project_id'));
        if (q.get('status')) rows = rows.filter((t) => t.status === q.get('status'));
        if (q.get('q')) {
          const needle = q.get('q').toLowerCase();
          rows = rows.filter((t) => t.title.toLowerCase().includes(needle) || (t.notes || '').toLowerCase().includes(needle));
        }
        return json(res, 200, rows.map(decorateTask));
      }
      if (m === 'POST') {
        const id = newId('t');
        const pr = projectRow(inBody.project_id);
        if (!pr) return json(res, 400, { error: 'project_id must name an existing project' });
        db.prepare('INSERT INTO tasks (id,project_id,title,notes,due_at,priority,status,blocked,reminder,calendar_event_id,completed_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(id, inBody.project_id, inBody.title || 'Untitled task', inBody.notes || '', inBody.due_at || null, inBody.priority || 'normal', 'open', inBody.blocked ? 1 : 0, inBody.reminder ? JSON.stringify(inBody.reminder) : null, null, null, new Date().toISOString());
        log(db, USER_ID, 'task', id, 'created');
        let t = taskRow(id);
        if (inBody.calendarExport && t.due_at) t = exportToCalendar(t);
        return json(res, 201, decorateTask(t));
      }
    }
    const taskMatch = p.match(/^\/api\/tasks\/([^/]+)(?:\/(complete|reopen|archive|calendar-export))?$/);
    if (taskMatch) {
      const t = taskRow(taskMatch[1]);
      if (!t) return json(res, 404, { error: 'No such task' });
      const action = taskMatch[2];
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
        const fields = { title: t.title, notes: t.notes, due_at: t.due_at, priority: t.priority, blocked: t.blocked, reminder: t.reminder, project_id: t.project_id };
        for (const k of ['title', 'notes', 'due_at', 'priority', 'project_id']) if (k in inBody) fields[k] = inBody[k];
        if ('blocked' in inBody) fields.blocked = inBody.blocked ? 1 : 0;
        if ('reminder' in inBody) fields.reminder = inBody.reminder ? JSON.stringify(inBody.reminder) : null;
        db.prepare('UPDATE tasks SET title=?, notes=?, due_at=?, priority=?, blocked=?, reminder=?, project_id=? WHERE id=?')
          .run(fields.title, fields.notes, fields.due_at, fields.priority, fields.blocked, fields.reminder, fields.project_id, t.id);
        log(db, USER_ID, 'task', t.id, 'edited');
        let updated = taskRow(t.id);
        // §4.4 — a moved deadline on a linked task offers to move the calendar event too.
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

    // ---- dashboard & weekly summary -----------------------------------
    if (p === '/api/dashboard' && m === 'GET') return json(res, 200, dashboard());
    if (p === '/api/summary/weekly' && m === 'GET') return json(res, 200, weeklySummary());

    // ---- settings ------------------------------------------------------
    if (p === '/api/settings/reminder' && m === 'PUT') {
      db.prepare('UPDATE users SET notification_defaults=? WHERE id=?').run(JSON.stringify(inBody), USER_ID);
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
      return json(res, 200, { proposals: assistant.parse(inBody.text || '', { today, projects: allProjects() }) });
    }
    if (p === '/api/assistant/query' && m === 'POST') {
      const today = inBody.today ? new Date(inBody.today + 'T00:00:00') : new Date();
      return json(res, 200, assistant.answer(inBody.text || '', { today, projects: allProjects(), tasks: allTasks() }));
    }

    // ---- search ----------------------------------------------------------
    if (p === '/api/search' && m === 'GET') {
      const needle = (url.searchParams.get('q') || '').toLowerCase();
      if (!needle) return json(res, 200, { projects: [], tasks: [] });
      const projects = allProjects().filter((pr) => pr.name.toLowerCase().includes(needle) || (pr.description || '').toLowerCase().includes(needle));
      const tasks = allTasks().filter((t) => t.title.toLowerCase().includes(needle) || (t.notes || '').toLowerCase().includes(needle)).map(decorateTask);
      return json(res, 200, { projects, tasks });
    }

    return json(res, 404, { error: 'No such endpoint', path: p });
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: err.message });
  }
});

function exportToCalendar(t) {
  // Mock: one external event id per task, reused on update rather than
  // duplicated — §4.5, "no more than one external calendar event."
  const eventId = t.calendar_event_id || 'gcal_mock_' + Math.random().toString(36).slice(2, 10);
  db.prepare('UPDATE tasks SET calendar_event_id=? WHERE id=?').run(eventId, t.id);
  return taskRow(t.id);
}

function dashboard() {
  const user = getUser();
  const tasks = allTasks();
  const projects = allProjects().filter((p) => !p.archived_at).map((p) => decorateProject(p, tasks, user));
  const now = new Date();

  const dueToday = tasks.filter((t) => t.status === 'open' && t.due_at && daysUntil(t.due_at, now) === 0).length;
  const overdue = tasks.filter((t) => t.status === 'open' && t.due_at && daysUntil(t.due_at, now) < 0).length;
  const needsAttention = projects.filter((p) => p.status === 'red' || p.status === 'yellow').length;
  const completedThisWeek = tasks.filter((t) => t.status === 'completed' && t.completed_at && daysUntil(t.completed_at.slice(0, 10), now) >= -7).length;

  const attention = projects
    .filter((p) => p.status === 'red' || p.status === 'yellow')
    .sort((a, b) => (a.status === 'red' ? 0 : 1) - (b.status === 'red' ? 0 : 1));

  return {
    user: { name: user.display_name },
    summary: { dueToday, overdue, needsAttention, completedThisWeek },
    projects,
    attention
  };
}

function weeklySummary() {
  const now = new Date();
  const tasks = allTasks();
  const projects = allProjects();
  const completedTasks = tasks.filter((t) => t.status === 'completed' && t.completed_at && daysUntil(t.completed_at.slice(0, 10), now) >= -7);
  const completedProjects = projects.filter((p) => p.archived_at && daysUntil(p.archived_at.slice(0, 10), now) >= -7);
  const overdueCarryover = tasks.filter((t) => t.status === 'open' && t.due_at && daysUntil(t.due_at, now) < 0);
  const highlights = tasks
    .filter((t) => t.status === 'open' && t.due_at && daysUntil(t.due_at, now) >= 0 && daysUntil(t.due_at, now) <= 7)
    .sort((a, b) => (b.priority === 'high') - (a.priority === 'high') || daysUntil(a.due_at, now) - daysUntil(b.due_at, now))
    .slice(0, 5);
  return {
    completedTasks: completedTasks.map(decorateTask),
    completedProjects,
    overdueCarryover: overdueCarryover.map(decorateTask),
    highlights: highlights.map(decorateTask)
  };
}

server.listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces()).flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal).map((n) => n.address);
  console.log('\n  Smart Life Tracker backend is running.\n');
  console.log('    on this computer   http://localhost:' + PORT);
  lan.forEach((ip) => console.log('    on your phone      http://' + ip + ':' + PORT + '   (same wifi)'));
  console.log('\n  Data lives in backend/data.sqlite — delete it to reset the demo.');
  console.log('  Stop with Ctrl-C.\n');
});
