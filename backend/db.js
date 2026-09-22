'use strict';

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { seed } = require('./seed.js');

const DB_PATH = process.env.TRACKER_DB || path.join(__dirname, 'data.sqlite');

function open() {
  const db = new DatabaseSync(DB_PATH);
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  db.exec('PRAGMA foreign_keys = ON');

  const empty = db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0;
  if (empty) plant(db, new Date());
  return db;
}

function plant(db, today) {
  const { user, projects, tasks } = seed(today);
  const u = db.prepare('INSERT INTO users (id,email,display_name,timezone,auth_provider,notification_defaults,created_at) VALUES (?,?,?,?,?,?,?)');
  u.run(user.id, user.email, user.display_name, user.timezone, user.auth_provider, user.notification_defaults, user.created_at);

  const p = db.prepare('INSERT INTO projects (id,user_id,name,description,life_area,status_override,reminder_default,archived_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)');
  for (const pr of projects) p.run(pr.id, pr.user_id, pr.name, pr.description, pr.life_area, pr.status_override, pr.reminder_default, pr.archived_at, pr.created_at);

  const t = db.prepare('INSERT INTO tasks (id,project_id,title,notes,due_at,priority,status,blocked,reminder,calendar_event_id,completed_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const tk of tasks) t.run(tk.id, tk.project_id, tk.title, tk.notes, tk.due_at, tk.priority, tk.status, tk.blocked, tk.reminder, tk.calendar_event_id, tk.completed_at, tk.created_at);

  db.prepare('INSERT INTO integrations (id,user_id,provider,scope,token_reference,status) VALUES (?,?,?,?,?,?)')
    .run('ig1', user.id, 'google_calendar', 'calendar.events.write', 'mock-token', 'disconnected');
}

function wipe(db) {
  for (const table of ['reminders', 'activity_log', 'tasks', 'projects', 'integrations', 'users']) {
    db.exec('DELETE FROM ' + table);
  }
}

function log(db, userId, entityType, entityId, action) {
  db.prepare('INSERT INTO activity_log (id,user_id,entity_type,entity_id,action,occurred_at) VALUES (?,?,?,?,?,?)')
    .run('a' + Date.now() + Math.random().toString(36).slice(2, 6), userId, entityType, entityId, action, new Date().toISOString());
}

function newId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

module.exports = { open, plant, wipe, log, newId, DB_PATH };
