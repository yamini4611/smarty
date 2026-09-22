'use strict';

// The deterministic status rules from the requirements doc, §4.2. Every rule
// here traces to a stored date or field — never an unexplained score — so the
// "explain why a project is red or yellow" guardrail (§5.2) can quote this
// same function's reasoning back to the user.

const DAY = 86400000;
const daysUntil = (iso, now) => Math.round((new Date(iso + 'T00:00:00') - startOfDay(now)) / DAY);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Returns { status, reason, task } — task is the one that explains the status.
function computeProjectStatus(project, tasks, now) {
  if (project.status_override) {
    return { status: project.status_override, reason: 'Set manually.', task: null, manual: true };
  }
  if (project.archived_at) {
    return { status: 'gray', reason: 'Archived.', task: null };
  }

  const open = tasks.filter((t) => t.project_id === project.id && t.status === 'open');

  const overdue = open
    .filter((t) => t.due_at && daysUntil(t.due_at, now) < 0)
    .sort((a, b) => daysUntil(a.due_at, now) - daysUntil(b.due_at, now));
  if (overdue.length) {
    const t = overdue[0];
    const n = -daysUntil(t.due_at, now);
    return { status: 'red', reason: '"' + t.title + '" is ' + n + ' day' + (n === 1 ? '' : 's') + ' overdue.', task: t };
  }

  const urgent = open
    .filter((t) => t.priority === 'high' && t.due_at && daysUntil(t.due_at, now) === 0)
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
  if (urgent.length) {
    return { status: 'red', reason: '"' + urgent[0].title + '" is high priority and due within 24 hours.', task: urgent[0] };
  }

  const soon = open
    .filter((t) => t.due_at && daysUntil(t.due_at, now) >= 0 && daysUntil(t.due_at, now) <= 7)
    .sort((a, b) => daysUntil(a.due_at, now) - daysUntil(b.due_at, now));
  if (soon.length) {
    const t = soon[0];
    const n = daysUntil(t.due_at, now);
    return { status: 'yellow', reason: '"' + t.title + '" is due ' + (n === 0 ? 'today' : 'in ' + n + ' day' + (n === 1 ? '' : 's')) + '.', task: t };
  }

  const blocked = open.filter((t) => t.blocked);
  if (blocked.length) {
    return { status: 'yellow', reason: '"' + blocked[0].title + '" is blocked.', task: blocked[0] };
  }

  if (!open.length) {
    return { status: 'yellow', reason: 'No next task is set for this project.', task: null };
  }

  const next = open.slice().sort((a, b) => {
    if (!a.due_at && !b.due_at) return 0;
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return new Date(a.due_at) - new Date(b.due_at);
  })[0];
  return { status: 'green', reason: next.due_at ? '"' + next.title + '" is next, due ' + next.due_at + '.' : '"' + next.title + '" is next.', task: next };
}

function nextTask(project, tasks) {
  const open = tasks.filter((t) => t.project_id === project.id && t.status === 'open');
  if (!open.length) return null;
  return open.slice().sort((a, b) => {
    if (!a.due_at && !b.due_at) return 0;
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return new Date(a.due_at) - new Date(b.due_at);
  })[0];
}

// Reminder hierarchy, §4.3: task override, then project override, then the
// user's global default. Each layer is either null (inherit) or a full rule.
function effectiveReminder(task, project, user) {
  const parse = (s) => { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch (e) { return null; } };
  return parse(task.reminder) || parse(project.reminder_default) || parse(user.notification_defaults) || { mode: 'none' };
}

module.exports = { computeProjectStatus, nextTask, effectiveReminder, daysUntil, DAY };
