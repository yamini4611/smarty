'use strict';

// Stands in for the language model. In the real build this file is replaced by
// a call to Claude with the same contract: text in, proposals out, each one
// carrying its own uncertainty so the interface can show what was guessed.

const SEG_WORDS = {
  home: ['contractor','builder','house','home','kitchen','bathroom','tile','floor','flooring','plumber','electrician','renovation','remodel','remodelling','inspection','roof','garden','extension','quote','skirting'],
  wedding: ['wedding','photographer','venue','caterer','catering','guest','bridesmaid','florist','ceremony','reception','honeymoon','tasting','cake','registrar','suit','dress'],
  finance: ['tax','mortgage','bill','insurance','bank','loan','accountant','invoice','pension','council','utilities','refinance'],
  invest: ['invest','investment','isa','stock','shares','portfolio','fund','advisor','adviser','dividend','broker'],
  family: ['mum','mom','dad','family','birthday','anniversary','school','kids','children','sister','brother','parents'],
  travel: ['flight','hotel','trip','passport','visa','travel','airport','booking'],
  health: ['doctor','dentist','gp','prescription','gym','physio','optician','vaccination'],
  work: ['client','presentation','report','promotion','appraisal','standup','colleague','manager'],
  docs: ['document','certificate','deed','contract','warranty','policy','licence','paperwork']
};
const TYPE_WORDS = [
  ['Payment', ['pay ','payment','deposit','invoice','transfer','settle','bill','owe','£']],
  ['Deadline', ['deadline','due by','expires','cut-off','cutoff','last day','submit by']],
  ['Event', ['meeting','visit','appointment','dinner','lunch','viewing','ceremony','call with']],
  ['Reminder', ['remind me', "don't forget", 'dont forget']],
  ['Note', ['remember that','note that','i prefer','prefer ','for the record']]
];
const WD = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

function dateFrom(t, today) {
  const add = (n) => { const x = new Date(today); x.setDate(x.getDate() + n); return x; };
  const weekday = (name, skip) => {
    let delta = (WD.indexOf(name) - today.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    if (skip && delta < 7) delta += 7;
    return add(delta);
  };
  let m;
  if (/\btomorrow\b/.test(t)) return { date: add(1) };
  if (/\b(today|tonight)\b/.test(t)) return { date: add(0) };
  if ((m = t.match(/\bin (\d+) days?\b/))) return { date: add(parseInt(m[1], 10)) };
  if ((m = t.match(/\bnext (sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/))) return { date: weekday(m[1], true) };
  if ((m = t.match(/\b(?:this |on |by |)(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/))) return { date: weekday(m[1], false) };
  if ((m = t.match(/\b(?:on |by |the )(\d{1,2})(?:st|nd|rd|th)\b/))) {
    const day = parseInt(m[1], 10);
    let x = new Date(today.getFullYear(), today.getMonth(), day);
    if (x < today) x = new Date(today.getFullYear(), today.getMonth() + 1, day);
    return { date: x };
  }
  if (/\bnext week\b/.test(t)) return { date: add(7), guess: true };
  if (/\b(this|end of the|end of this) month\b/.test(t)) return { date: new Date(today.getFullYear(), today.getMonth() + 1, 0), guess: true };
  if (/\bnext month\b/.test(t)) return { date: new Date(today.getFullYear(), today.getMonth() + 2, 0), guess: true };
  if (/\bthis week\b/.test(t)) return { date: weekday('friday', false), guess: true };
  return {};
}

function clause(raw, today, allowed, n) {
  const t = raw.toLowerCase();
  let type = 'Task';
  outer: for (const [name, words] of TYPE_WORDS) {
    for (const w of words) if (t.includes(w)) { type = name; break outer; }
  }
  if (/^(check|find out|see|ask|confirm|look up|chase|work out)\b/.test(t)) type = 'Task';

  let segId = null, best = 0;
  for (const id of Object.keys(SEG_WORDS)) {
    if (!allowed.includes(id)) continue;
    const hits = SEG_WORDS[id].filter((w) => t.includes(w)).length;
    if (hits > best) { best = hits; segId = id; }
  }

  const when = dateFrom(t, today);
  const am = raw.match(/£\s?([\d,]+(?:\.\d{1,2})?)/) || raw.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:pounds|quid|gbp)/i);

  const title = raw.trim()
    .replace(/^(i need to|i have to|i must|i should|please|can you|remind me to|remember to|don'?t forget to)\s+/i, '')
    .replace(/\b(?:next |this |on |by )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, '')
    .replace(/\b(tomorrow|today|tonight|next week|this week|next month|this month|end of the month)\b/gi, '')
    .replace(/\bin \d+ days?\b/gi, '')
    .replace(/\b(?:on |by )?the \d{1,2}(?:st|nd|rd|th)\b/gi, '')
    .replace(/£\s?[\d,]+(?:\.\d{1,2})?/g, '')
    .replace(/\b[\d,]+(?:\.\d{1,2})?\s*(?:pounds|quid|gbp)\b/gi, '')
    .replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').replace(/[,\s]+$/, '').trim();

  const shown = title || raw.trim();
  return {
    id: 'p' + n,
    title: shown.charAt(0).toUpperCase() + shown.slice(1),
    type,
    seg: segId || allowed[0] || 'home',
    segGuess: !segId,
    date: when.date ? iso(when.date) : null,
    dateGuess: !!when.guess,
    amount: am ? parseFloat(am[1].replace(/,/g, '')) : null
  };
}

function parse(text, today, allowed) {
  const clauses = String(text)
    .split(/\s+and (?:then )?(?=\w)|[;.]\s+|,\s+(?:and\s+)?(?:also|then)\s+/i)
    .map((c) => c.trim())
    .filter((c) => c.length > 3);
  const list = clauses.length ? clauses : [String(text)];
  return list.slice(0, 4).map((c, i) => clause(c, today, allowed, i + 1));
}

module.exports = { parse, SEG_WORDS };
