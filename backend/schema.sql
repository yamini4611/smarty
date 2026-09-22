-- Smart Life Tracker — data model per the MVP requirements doc, §6.
-- SQLite via Node's built-in node:sqlite — no external database, no install.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/London',
  auth_provider TEXT NOT NULL DEFAULT 'google',
  notification_defaults TEXT NOT NULL DEFAULT '{"mode":"before","offsetDays":1,"atHour":9}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  life_area TEXT,
  status_override TEXT,              -- null | red | yellow | green | gray
  reminder_default TEXT,             -- null = inherit the user default, else JSON
  archived_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  due_at TEXT,                       -- ISO date, or null = "No deadline"
  priority TEXT NOT NULL DEFAULT 'normal',   -- low | normal | high
  status TEXT NOT NULL DEFAULT 'open',       -- open | completed | archived
  blocked INTEGER NOT NULL DEFAULT 0,
  reminder TEXT,                     -- null = inherit project/user default, else JSON
  calendar_event_id TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  trigger_at TEXT NOT NULL,
  repeat_rule TEXT,                  -- null | daily | weekly
  state TEXT NOT NULL DEFAULT 'scheduled',   -- scheduled | sent | snoozed | muted
  last_sent_at TEXT
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  entity_type TEXT NOT NULL,         -- project | task
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,              -- created | completed | reopened | archived | restored | deleted | edited
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,            -- google_calendar
  scope TEXT NOT NULL DEFAULT 'calendar.events.write',
  token_reference TEXT NOT NULL DEFAULT 'mock-token',
  status TEXT NOT NULL DEFAULT 'disconnected'  -- connected | disconnected
);
