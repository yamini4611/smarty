'use strict';

// The two jobs the requirements doc gives voice/typed interaction, §6:
//   parse(text, ...)  — turn a sentence into a proposed task. Never commits
//                        anything; the caller always shows a confirmation.
//   answer(text, ...) — voice retrieval, mapped to the five supported
//                        questions in §6.3. Counting and filtering happen in
//                        code over the real records, never guessed here.
//
// In the real build this file is replaced by a call to Claude with the same
// contract; the shape it returns does not change.

const { taskState, daysUntil } = require('./status.js');

const WD = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const REMINDER_PHRASE = /\bremind me\b|\breminder\b/i;
const HIGH_PRIORITY = /\burgent\b|\basap\b|\bimmediately\b|\bcritical\b/i;
const LOW_PRIORITY = /\bwhenever\b|\bno rush\b|\blow priority\b/i;

const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (d) => d.getDate() + ' ' + MON[d.getMonth()];

// Resolves a date phrase. `ambiguous: true` marks a phrase that names more
// than one day without saying which — per §5.1, that becomes a follow-up
// question instead of a silent guess, rather than a value handed back.
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
  if (/\bnext week\b/.test(t)) return { date: add(7), ambiguous: true, question: 'Which day next week?' };
  if (/\bend of the month\b|\bthis month\b/.test(t)) return { date: new Date(today.getFullYear(), today.getMonth() + 1, 0), ambiguous: true, question: 'Which day this month?' };
  return {};
}

function reminderFrom(clause) {
  if (!REMINDER_PHRASE.test(clause)) return null;
  return { mode: 'before', offsetDays: 1, atHour: 9, needsConfirm: true };
}

function splitClauses(text) {
  const parts = String(text)
    .split(/\s+and (?:then )?(?=\w)|[;.]\s+|,\s+(?:and\s+)?(?:also|then)\s+/i)
    .map((c) => c.trim())
    .filter((c) => c.length > 2);
  const merged = [];
  parts.forEach((c) => {
    if (/^remind me\b/i.test(c) && merged.length) merged[merged.length - 1] += ' and ' + c;
    else merged.push(c);
  });
  return (merged.length ? merged : [String(text)]).slice(0, 4);
}

// The onboarding "add first tasks" screen invites a plain list — "pay the
// bill, book the dentist" — so it splits on bare commas too, not just the
// clause-boundary punctuation a full sentence needs elsewhere.
function splitList(text) {
  const parts = String(text).split(/\s*,\s*|\s+and\s+/i).map((c) => c.trim()).filter((c) => c.length > 2);
  return (parts.length ? parts : [String(text)]).slice(0, 6);
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
    .replace(/,?\s*\b(?:urgent|asap|immediately|critical|whenever|no rush|low priority)\b\.?/gi, '')
    .replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').replace(/[,\s]+$/, '').trim();
}

// Matches a clause against the user's existing segments by name overlap.
function matchSegment(clause, segments) {
  const t = clause.toLowerCase();
  let best = null, bestScore = 0;
  for (const s of segments) {
    if (s.status !== 'active') continue;
    const words = s.name.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const score = words.filter((w) => t.includes(w)).length;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return bestScore > 0 ? best : null;
}

// Every clause becomes a proposed task — this doc's onboarding is what
// creates segments; typed/voice capture during daily use only adds tasks.
function parse(text, opts) {
  const today = opts.today || new Date();
  const segments = opts.segments || [];
  const clauses = opts.listMode ? splitList(text) : splitClauses(text);

  return clauses.map((raw, i) => {
    const t = raw.toLowerCase();
    const when = resolveDate(t, today);
    const segment = matchSegment(raw, segments);
    const title = cap(cleanTitle(raw)) || cap(raw.trim());
    let priority = 'normal';
    if (HIGH_PRIORITY.test(t)) priority = 'high';
    else if (LOW_PRIORITY.test(t)) priority = 'low';

    return {
      id: 'p' + (i + 1),
      title,
      segmentId: segment ? segment.id : null,
      segmentName: segment ? segment.name : null,
      needsSegmentChoice: !segment,
      date: when.date ? iso(when.date) : null,
      dateAmbiguous: !!when.ambiguous,
      followUp: when.question || null,
      priority,
      reminder: reminderFrom(raw)
    };
  });
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const count = (n, sing, plur) => (n < 10 ? WORDS[n] : n) + ' ' + (n === 1 ? sing : plur);
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// The five supported voice questions, §6.3 — matched in the order the table
// lists them; anything else falls back to a plain keyword search.
function answer(text, ctx) {
  const t = String(text).toLowerCase();
  const now = ctx.today || new Date();
  const segments = ctx.segments || [];
  const tasks = ctx.tasks || [];
  const open = tasks.filter((tk) => tk.status === 'open');
  const segName = (id) => { const s = segments.find((x) => x.id === id); return s ? s.name : ''; };

  if (/what is overdue|what'?s overdue|overdue\b/.test(t)) {
    const rows = open.filter((tk) => taskState(tk, now) === 'overdue').sort((a, b) => daysUntil(b.due_at, now) - daysUntil(a.due_at, now));
    return {
      title: 'OVERDUE',
      lead: rows.length ? cap1(count(rows.length, 'task is', 'tasks are')) + ' overdue.' : 'Nothing is overdue.',
      ids: rows.map((tk) => tk.id)
    };
  }

  // Checked before the plainer "this week" match below, since both phrases
  // contain "this week" but ask for opposite things.
  if (/how much did i complete|completed this week|what did i complete/.test(t)) {
    const done = tasks.filter((tk) => tk.status === 'completed' && tk.completed_at && daysUntil(tk.completed_at.slice(0, 10), now) >= -7);
    return {
      title: 'COMPLETED THIS WEEK',
      lead: done.length ? cap1(count(done.length, 'task', 'tasks')) + ' completed this week.' : 'Nothing completed yet this week.',
      ids: done.map((tk) => tk.id)
    };
  }

  if (/due this week|this week|next few days|approaching/.test(t)) {
    const rows = open.filter((tk) => taskState(tk, now) === 'approaching').sort((a, b) => daysUntil(a.due_at, now) - daysUntil(b.due_at, now));
    return {
      title: 'DUE THIS WEEK',
      lead: rows.length ? cap1(count(rows.length, 'task is', 'tasks are')) + ' approaching in the next seven days.' : 'Nothing is due in the next seven days.',
      ids: rows.map((tk) => tk.id)
    };
  }

  if (/what should i do next|do next|what next/.test(t)) {
    const urgent = open.filter((tk) => taskState(tk, now) === 'overdue' || taskState(tk, now) === 'approaching')
      .sort((a, b) => daysUntil(a.due_at, now) - daysUntil(b.due_at, now));
    if (urgent.length) {
      const tk = urgent[0];
      const state = taskState(tk, now);
      return { title: 'DO NEXT', lead: '"' + tk.title + '" in ' + segName(tk.segment_id) + ' — ' + (state === 'overdue' ? 'overdue' : 'due soon') + '.', ids: [tk.id] };
    }
    const byPriority = open.filter((tk) => taskState(tk, now) === 'pending').sort((a, b) => (b.priority === 'high') - (a.priority === 'high'));
    if (byPriority.length) return { title: 'DO NEXT', lead: '"' + byPriority[0].title + '" in ' + segName(byPriority[0].segment_id) + ' is your highest-priority open task.', ids: [byPriority[0].id] };
    return { title: 'DO NEXT', lead: 'Nothing open right now — you’re caught up.', ids: [] };
  }

  // "What do I have in <segment>?"
  const inMatch = t.match(/what do i have in ([a-z ]+)\??$/) || t.match(/\bin ([a-z ]+)\??$/);
  if (inMatch) {
    const needle = inMatch[1].trim();
    const seg = segments.find((s) => s.status === 'active' && s.name.toLowerCase().includes(needle));
    if (seg) {
      const rows = open.filter((tk) => tk.segment_id === seg.id);
      return { title: seg.name.toUpperCase(), lead: rows.length ? cap1(count(rows.length, 'active task', 'active tasks')) + ' in ' + seg.name + '.' : 'Nothing active in ' + seg.name + '.', ids: rows.map((tk) => tk.id) };
    }
  }

  const words = t.split(/\W+/).filter((w) => w.length > 3);
  const hits = open.filter((tk) => words.some((w) => tk.title.toLowerCase().includes(w) || (tk.notes || '').toLowerCase().includes(w)));
  return {
    title: hits.length ? 'WHAT I FOUND' : 'NOTHING MATCHED',
    lead: hits.length ? cap1(count(hits.length, 'task looks', 'tasks look')) + ' like what you asked about.' : 'Try a segment name, a date, or a word from the task itself.',
    ids: hits.map((tk) => tk.id)
  };
}

module.exports = { parse, answer, resolveDate, splitClauses };
