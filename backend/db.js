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
  // CREATE TABLE IF NOT EXISTS won't add a column to a tasks table that
  // already exists from before due_time was introduced — patch it in so an
  // older data.sqlite left lying around still works instead of erroring.
  try { db.exec('ALTER TABLE tasks ADD COLUMN due_time TEXT'); } catch (e) {}

  const empty = db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0;
  if (empty) plant(db, new Date());
  return db;
}

function plant(db, today) {
  const { user, segments, tasks } = seed(today);
  const u = db.prepare('INSERT INTO users (id,email,display_name,age_range,life_stage,goals,timezone,preferences,created_at) VALUES (?,?,?,?,?,?,?,?,?)');
  u.run(user.id, user.email, user.display_name, user.age_range, user.life_stage, user.goals, user.timezone, user.preferences, user.created_at);

  const s = db.prepare('INSERT INTO segments (id,user_id,name,description,icon,color,kind,target_date,sort_order,status,archived_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const sg of segments) s.run(sg.id, sg.user_id, sg.name, sg.description || '', sg.icon, sg.color, sg.kind || 'permanent', sg.target_date || null, sg.sort_order, sg.status, sg.archived_at, sg.created_at);

  const t = db.prepare('INSERT INTO tasks (id,segment_id,title,notes,due_at,due_time,priority,status,reminder,calendar_event_id,completed_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const tk of tasks) t.run(tk.id, tk.segment_id, tk.title, tk.notes, tk.due_at, tk.due_time || null, tk.priority, tk.status, tk.reminder, tk.calendar_event_id, tk.completed_at, tk.created_at);

  db.prepare('INSERT INTO integrations (id,user_id,provider,permission_scope,token_reference,status) VALUES (?,?,?,?,?,?)')
    .run('ig1', user.id, 'google_calendar', 'calendar.events.write', 'mock-token', 'disconnected');
}

function wipe(db) {
  for (const table of ['reminders', 'activity_log', 'tasks', 'segments', 'integrations', 'users']) {
    db.exec('DELETE FROM ' + table);
  }
}

// A genuinely blank account — no segments, no tasks — so signing back in
// after a reset lands on real onboarding instead of the sample data. Only
// the server's very first boot ever (an empty database) gets the seeded
// demo automatically; see open() above.
function createBlankUser(db, userId, today) {
  db.prepare('INSERT INTO users (id,email,display_name,age_range,life_stage,goals,timezone,preferences,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(userId, 'you@example.com', '', null, '[]', '[]', 'Europe/London', '{"reminderDefault":{"mode":"before","offsetDays":1,"atHour":9},"voiceSpoken":false,"privateMode":false}', today.toISOString());
  db.prepare('INSERT INTO integrations (id,user_id,provider,permission_scope,token_reference,status) VALUES (?,?,?,?,?,?)')
    .run(newId('ig'), userId, 'google_calendar', 'calendar.events.write', 'mock-token', 'disconnected');
}

function log(db, userId, entityType, entityId, action) {
  db.prepare('INSERT INTO activity_log (id,user_id,entity_type,entity_id,action,occurred_at) VALUES (?,?,?,?,?,?)')
    .run('a' + Date.now() + Math.random().toString(36).slice(2, 6), userId, entityType, entityId, action, new Date().toISOString());
}

function newId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

module.exports = { open, plant, wipe, createBlankUser, log, newId, DB_PATH };
