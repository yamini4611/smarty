'use strict';

// The task-state rules from the requirements doc, §3.3. Deliberately simple
// and purely date-driven — no per-segment scoring, just four states a task
// can be in. "Color is not the only status signal" (§9 acceptance criteria)
// means every result carries the word (Overdue/Approaching/Pending), not
// just a color the caller has to interpret.

const DAY = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysUntil = (iso, now) => Math.round((new Date(iso + 'T00:00:00') - startOfDay(now)) / DAY);

// Returns one of: open task -> 'overdue' | 'approaching' | 'pending'; else 'completed'.
function taskState(task, now) {
  if (task.status === 'completed') return 'completed';
  if (task.status !== 'open') return task.status;
  if (!task.due_at) return 'pending';
  const n = daysUntil(task.due_at, now);
  if (n < 0) return 'overdue';
  if (n <= 7) return 'approaching';
  return 'pending';
}

function segmentCounts(segment, tasks, now) {
  const mine = tasks.filter((t) => t.segment_id === segment.id && t.status === 'open');
  const counts = { overdue: 0, approaching: 0, pending: 0 };
  let next = null, nextN = Infinity;
  for (const t of mine) {
    const s = taskState(t, now);
    counts[s]++;
    const n = t.due_at ? daysUntil(t.due_at, now) : Infinity;
    if (!next || n < nextN || (n === nextN && s === 'overdue')) { next = t; nextN = n; }
  }
  const done = tasks.filter((t) => t.segment_id === segment.id && t.status === 'completed').length;
  return { overdue: counts.overdue, approaching: counts.approaching, pending: counts.pending, completed: done, nextTask: next };
}

module.exports = { taskState, segmentCounts, daysUntil, DAY };
