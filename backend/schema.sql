-- Smart Life Tracker — data model per the client UI requirements doc, §8.
-- SQLite via Node's built-in node:sqlite — no external database, no install.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  age_range TEXT,
  life_stage TEXT,               -- JSON array of strings
  goals TEXT,                    -- JSON array of strings
  timezone TEXT NOT NULL DEFAULT 'Europe/London',
  preferences TEXT NOT NULL DEFAULT '{"reminderDefault":{"mode":"before","offsetDays":1,"atHour":9},"voiceSpoken":false,"privateMode":false}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS segments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT,
  color TEXT NOT NULL DEFAULT '#3B6FD9',
  kind TEXT NOT NULL DEFAULT 'permanent',  -- permanent | routine | project — a project gets a start->finish turtle
  target_date TEXT,                        -- a project's own estimated finish date, optional
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',   -- active | hidden | archived
  archived_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  segment_id TEXT NOT NULL REFERENCES segments(id),
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  due_at TEXT,                   -- ISO date, or null = "No deadline"
  priority TEXT NOT NULL DEFAULT 'normal',   -- low | normal | high
  status TEXT NOT NULL DEFAULT 'open',       -- open | completed | archived
  reminder TEXT,                 -- null = inherit the user default, else JSON
  calendar_event_id TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  trigger_at TEXT NOT NULL,
  repeat_rule TEXT,
  state TEXT NOT NULL DEFAULT 'scheduled',
  last_sent_at TEXT
);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  permission_scope TEXT NOT NULL DEFAULT 'calendar.events.write',
  token_reference TEXT NOT NULL DEFAULT 'mock-token',
  status TEXT NOT NULL DEFAULT 'disconnected'
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
