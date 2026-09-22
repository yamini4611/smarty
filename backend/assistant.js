'use strict';

// The two jobs the requirements doc gives the assistant, §5:
//   parse(text, ...)  — turn a brain dump into proposed projects/tasks. Never
//                        commits anything; the caller shows a confirmation.
//   answer(text, ...) — read-only retrieval, e.g. "what's due this week?".
//                        Counting and filtering happen in code over the real
//                        records, never guessed by this layer.
//
// In the real build this file is replaced by a call to Claude with the same
// contract; the shape it returns does not change.

const { computeProjectStatus, daysUntil } = require('./status.js');

const WD = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const TASK_VERBS = /^(call|pay|submit|book|schedule|tour|prepare|review|send|confirm|finish|complete|apply|buy|renew|sign|visit|email|draft|file|attend|pick up|drop off|order|check|arrange|follow up|register|update|clean|fix|pack|meet|interview)\b/i;
const REMINDER_PHRASE = /\bremind me\b|\breminder\b/i;
const HIGH_PRIORITY = /\burgent\b|\basap\b|\bimmediately\b|\bcritical\b/i;

const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// Resolves a date phrase. `ambiguous: true` marks a phrase that names more
// than one day without saying which — per §5.2, that becomes a follow-up
// question instead of a silent guess, rather than a value we hand back.
function resolveDate(t, today) {
  const add = (n) => { const x = new Date(today); x.setDate(x.getDate() + n); return x; };
  let m;
  if (/\btomorrow\b/.test(t)) return { date: add(1) };
  if (/\btoday\b|\btonight\b/.test(t)) return { date: add(0) };
  if ((m = t.match(/\bin (\d+) days?\b/))) return { date: add(parseInt(m[1], 10)) };
  if ((m = t.match(/\bnext (sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/))) {
    let delta = (WD.indexOf(m[1]) - today.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    delta += 7;
    return { date: add(delta) };
  }
  if ((m = t.match(/\b(?:on |by )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/))) {
    let delta = (WD.indexOf(m[1]) - today.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    const nearest = add(delta);
    const following = add(delta + 7);
    return {
      date: nearest,
      ambiguous: true,
      question: 'Do you mean this ' + cap(m[1]) + ' (' + fmt(nearest) + '), or the ' + cap(m[1]) + ' after (' + fmt(following) + ')?',
      alt: following
    };
  }
  if ((m = t.match(/\b(?:on |by |the )(\d{1,2})(?:st|nd|rd|th)\b/))) {
    const day = parseInt(m[1], 10);
    let x = new Date(today.getFullYear(), today.getMonth(), day);
    if (x < today) x = new Date(today.getFullYear(), today.getMonth() + 1, day);
    return { date: x };
  }
  if (/\bnext week\b/.test(t)) {
    return { date: add(7), ambiguous: true, question: 'Which day next week?' };
  }
  if (/\bend of the month\b|\bthis month\b/.test(t)) {
    return { date: new Date(today.getFullYear(), today.getMonth() + 1, 0), ambiguous: true, question: 'Which day this month?' };
  }
  return {};
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (d) => d.getDate() + ' ' + MON[d.getMonth()];

function reminderFrom(clause) {
  if (!REMINDER_PHRASE.test(clause)) return null;
  if (/\bday before\b|\bthe day before\b/i.test(clause)) return { mode: 'before', offsetDays: 1, atHour: 9, needsConfirm: true };
  if (/\bmorning of\b|\bsame day\b/i.test(clause)) return { mode: 'at_deadline', needsConfirm: true };
  return { mode: 'before', offsetDays: 1, atHour: 9, needsConfirm: true };
}

function splitClauses(text) {
  const parts = String(text)
    .split(/\s+and (?:then )?(?=\w)|[;.]\s+|,\s+(?:and\s+)?(?:also|then)\s+/i)
    .map((c) => c.trim())
    .filter((c) => c.length > 2);
  // A trailing "...and remind me..." is part of the task before it, not a
  // separate responsibility — reattach it rather than treat it as its own item.
  const merged = [];
  parts.forEach((c) => {
    if (/^remind me\b/i.test(c) && merged.length) merged[merged.length - 1] += ' and ' + c;
    else merged.push(c);
  });
  return (merged.length ? merged : [String(text)]).slice(0, 4);
}

function cleanTitle(raw) {
  return raw.trim()
    .replace(/^(i need to|i have to|i must|i should|please|can you|remind me to|remember to|don'?t forget to|i want to)\s+/i, '')
    .replace(/^for (?:my |our |the )?[^,]{1,40},\s*/i, '')
    .replace(/,?\s*(?:and\s+)?remind me (?:the day before|of it|about it)\b.*/i, '')
    .replace(/\b(?:on |by )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, '')
    .replace(/\b(tomorrow|today|tonight|next week|this month|end of the month)\b/gi, '')
    .replace(/\bin \d+ days?\b/gi, '')
    .replace(/\b(?:on |by |before )?the \d{1,2}(?:st|nd|rd|th)\b/gi, '')
    .replace(/,?\s*\b(?:urgent|asap|immediately|critical)\b\.?/gi, '')
    .replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').replace(/[,\s]+$/, '').trim();
}

// Matches a clause against the user's existing projects by name or life area
// keyword overlap. Returns the project or null.
function matchProject(clause, projects) {
  const t = clause.toLowerCase();
  let best = null, bestScore = 0;
  for (const p of projects) {
    if (p.archived_at) continue;
    const words = p.name.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const score = words.filter((w) => t.includes(w)).length + (p.life_area && t.includes(p.life_area.toLowerCase()) ? 1 : 0);
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return bestScore > 0 ? best : null;
}

function parse(text, opts) {
  const today = opts.today || new Date();
  const projects = opts.projects || [];
  const clauses = splitClauses(text);

  return clauses.map((raw, i) => {
    const t = raw.toLowerCase();
    const when = resolveDate(t, today);
    const project = matchProject(raw, projects);
    const title = cap(cleanTitle(raw)) || cap(raw.trim());

    // "Stay on top of X" names an ongoing area of responsibility, not a
    // single step — propose a project for X rather than parsing it as a task.
    if (!project) {
      const mgmt = t.match(/\b(?:stay|keep|staying|keeping)\s+(?:on top of|current on|up to date on)\s+(.+)$|\b(?:manage|managing|track|tracking|handle|handling)\s+(.+)$/i);
      if (mgmt) {
        const rem = (mgmt[1] || mgmt[2] || '').trim();
        return { id: 'p' + (i + 1), kind: 'project', title: rem ? cap(rem) : title, followUp: null };
      }
    }

    const isTaskShaped = TASK_VERBS.test(t.trim()) || when.date || /\bappointment\b|\bmeeting\b/.test(t);
    if (isTaskShaped) {
      return {
        id: 'p' + (i + 1),
        kind: 'task',
        title,
        projectId: project ? project.id : null,
        projectName: project ? project.name : null,
        needsProjectChoice: !project,
        date: when.date ? iso(when.date) : null,
        dateAmbiguous: !!when.ambiguous,
        followUp: when.question || null,
        priority: HIGH_PRIORITY.test(t) ? 'high' : 'normal',
        reminder: reminderFrom(raw)
      };
    }

    // A short noun phrase that doesn't match anything existing reads as a new
    // area of responsibility, not a step inside one — propose a project.
    if (!project && raw.trim().split(/\s+/).length <= 5) {
      return { id: 'p' + (i + 1), kind: 'project', title, followUp: null };
    }

    return {
      id: 'p' + (i + 1),
      kind: 'ambiguous',
      title,
      followUp: 'Is "' + title + '" a new project, or a task inside ' + (project ? project.name : 'an existing project') + '?',
      projectId: project ? project.id : null,
      projectName: project ? project.name : null
    };
  });
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const count = (n, sing, plur) => (n < 10 ? WORDS[n] : n) + ' ' + (n === 1 ? sing : plur);
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function answer(text, ctx) {
  const t = String(text).toLowerCase();
  const now = ctx.today || new Date();
  const projects = ctx.projects || [];
  const tasks = ctx.tasks || [];
  const open = (pid) => tasks.filter((tk) => tk.project_id === pid && tk.status === 'open');

  if (/falling behind|overdue|late|behind|slipping|missed/.test(t)) {
    const rows = projects
      .filter((p) => !p.archived_at)
      .map((p) => ({ p, s: computeProjectStatus(p, tasks, now) }))
      .filter((r) => r.s.status === 'red');
    return {
      title: 'FALLING BEHIND',
      lead: rows.length
        ? cap1(count(rows.length, 'project needs', 'projects need')) + ' attention right now.'
        : 'Nothing is red. Everything still has time on it.',
      list: rows.map((r) => ({ project: r.p.name, reason: r.s.reason, taskId: r.s.task ? r.s.task.id : null }))
    };
  }

  if (/due this week|this week|next few days|coming up/.test(t)) {
    const soon = tasks.filter((tk) => tk.status === 'open' && tk.due_at && daysUntil(tk.due_at, now) >= 0 && daysUntil(tk.due_at, now) <= 7)
      .sort((a, b) => daysUntil(a.due_at, now) - daysUntil(b.due_at, now));
    return {
      title: 'DUE THIS WEEK',
      lead: soon.length ? cap1(count(soon.length, 'task falls', 'tasks fall')) + ' inside the next seven days.' : 'Nothing is due in the next seven days.',
      ids: soon.map((tk) => tk.id)
    };
  }

  if (/\btoday\b/.test(t)) {
    const dueToday = tasks.filter((tk) => tk.status === 'open' && tk.due_at && daysUntil(tk.due_at, now) === 0);
    return { title: 'DUE TODAY', lead: dueToday.length ? cap1(count(dueToday.length, 'task is', 'tasks are')) + ' due today.' : 'Nothing is due today.', ids: dueToday.map((tk) => tk.id) };
  }

  const words = t.split(/\W+/).filter((w) => w.length > 3);
  const hitTasks = tasks.filter((tk) => tk.status === 'open' && words.some((w) => tk.title.toLowerCase().includes(w) || (tk.notes || '').toLowerCase().includes(w)));
  const hitProjects = projects.filter((p) => !p.archived_at && words.some((w) => p.name.toLowerCase().includes(w)));
  if (hitProjects.length && !hitTasks.length) {
    const p = hitProjects[0];
    const s = computeProjectStatus(p, tasks, now);
    return { title: p.name.toUpperCase(), lead: s.reason, ids: open(p.id).map((tk) => tk.id) };
  }
  return {
    title: hitTasks.length ? 'WHAT I FOUND' : 'NOTHING MATCHED',
    lead: hitTasks.length ? cap1(count(hitTasks.length, 'task looks', 'tasks look')) + ' like what you asked about.' : 'Try a project name, a date, or a word from the task itself.',
    ids: hitTasks.map((tk) => tk.id)
  };
}

module.exports = { parse, answer, resolveDate, splitClauses };
