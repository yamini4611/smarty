# Smart Life Tracker backend

The real backend behind `prototype/tracker.html` — Node's standard library
plus the built-in `node:sqlite` module only. No `npm install`, no external
database, no build step.

```
node backend/server.js          # http://localhost:4000
node backend/server.js 5000     # or pick a port
```

It prints a `localhost` address and a LAN address, so you can open it on a
phone on the same wifi — the app is designed at 390px and is worth looking
at on an actual screen that size.

State lives in `backend/data.sqlite`, a real SQLite database (Node prints one
`ExperimentalWarning` about `node:sqlite` on startup — harmless). Delete the
file to put the demo back to the seeded data in `seed.js`: five segments
(Work, Home, Health, Finances, and a Kitchen Remodel project) with
seventeen tasks — overdue, approaching, pending, and completed — so the
dashboard is legible the moment it loads, and the turtle has real progress
to show.

The seeded demo is only ever planted automatically on the server's very
first boot against an empty database file. After that, **"Start over" in
Settings** (or `DELETE /api/account` directly) wipes the account and the
next sign-in gets a genuinely blank one — no segments, no tasks — so
onboarding is actually re-testable, not just a re-seed of the same sample
data. This is meant for exactly that: a tester who wants to run through the
whole flow repeatedly, not a one-time reset.

## The data model

`schema.sql` implements the six entities from the client requirements doc,
§8, as real tables with foreign keys: `users`, `segments`, `tasks`,
`reminders`, `integrations`, `activity_log`. Every mutating request writes
an `activity_log` row.

Three fields go beyond the doc's own table, added for the client's
follow-up design feedback: `segments.description` (shown on its card),
`segments.kind` — one of `'permanent'` (a standing part of life, no finish
line), `'routine'` (a steady cadence, also no finish line, but distinct
enough from "permanent" to badge separately), or `'project'` (a temporary
effort with an actual start and finish) — and `segments.target_date`, a
project's own optional estimated finish date. Only a `'project'` gets the
turtle progress path, shown on the dashboard and in segment detail, driven
by `completed / total` tasks in that segment (slow and steady, not a race);
`target_date` labels the finish end of that same path and is cleared
automatically if the segment's kind changes away from `'project'`.

## The task-state engine

`status.js` implements the four states from §3.3 as one pure, purely
date-driven function, `taskState` — Overdue (incomplete, past its deadline),
Approaching (incomplete, due within 7 days), Pending (incomplete, everything
else), Completed. No per-segment scoring, unlike a project-status model —
just a date bucket per task. It's imported by the server for
`/api/dashboard` and `/api/segments`, and ported line-for-line into
`prototype/tracker.html` for the no-backend fallback, so the two modes never
disagree about what's overdue. The word (not just a color) is always in the
response, satisfying the acceptance criterion that "color is not the only
status signal."

## The assistant

`assistant.js` plays the two roles the doc gives voice/typed interaction,
§6:

- `parse(text, ...)` — a sentence in, a proposed task out. Never writes
  anything; the client always shows a confirmation first. Multiple
  responsibilities become separate, individually editable proposals. A bare
  weekday ("Friday") is genuinely ambiguous — which one? — so it comes back
  with a follow-up question and two concrete choices instead of a silent
  guess; "next Friday" resolves outright. Pass `listMode: true` (used by the
  "Add first tasks" onboarding screen) to split on a plain comma-separated
  list instead of full-sentence clause boundaries.
- `answer(text, ...)` — voice retrieval, mapped to the five supported
  questions in §6.3 exactly: *What is overdue?*, *What is due this week?*,
  *What do I have in \<Segment\>?*, *What should I do next?*, *How much did
  I complete this week?* Counting and filtering happen in
  `server.js`/`status.js` over the real rows; this file only decides what's
  being asked.

In the real build this file is replaced by a call to Claude with the same
input/output contract — the shape the client consumes doesn't change.

## Endpoints

| | |
|---|---|
| `GET /api/health` | `{ trackerApp: true }` — how the page detects a backend |
| `POST /api/auth/sign-in` / `POST /api/auth/sign-out` | mock session (single demo user); if no account exists yet it creates a blank one, never a reseed |
| `DELETE /api/account` | wipes everything, per FR1 — pairs with "Start over" in Settings for repeat test runs |
| `PUT /api/profile` | age range, life stage, goals |
| `GET/POST /api/segments`, `GET/PATCH/DELETE /api/segments/:id` | segment CRUD |
| `POST /api/segments/:id/archive` / `.../restore` / `.../hide` / `.../show` | FR5 |
| `PUT /api/segments/reorder` | FR5's "reorder" |
| `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/:id` | task CRUD, with `?segment_id=&state=&status=&q=` filters (FR13) |
| `POST /api/tasks/:id/complete` / `.../reopen` / `.../archive` | FR6 |
| `POST/DELETE /api/tasks/:id/calendar-export` | one external event id per task, reused not duplicated (§7.2) |
| `GET /api/dashboard` | summary counts and every active segment, attention-first (§3.2) |
| `GET /api/progress` | this week's completed tasks (FR14) |
| `PUT /api/settings/reminder` / `PUT /api/settings/voice` / `PUT /api/settings/calendar` | reminder default, voice/private-mode prefs, calendar connection |
| `POST /api/assistant/parse` / `POST /api/assistant/query` | the two assistant jobs above |
| `GET /api/search?q=` | FR13 |

```bash
curl localhost:4000/api/dashboard

curl -X POST localhost:4000/api/assistant/parse \
  -H 'Content-Type: application/json' \
  -d '{"text":"Renew passport before the 30th and pay rent, urgent","today":"2026-09-22"}'

curl -X POST localhost:4000/api/assistant/query \
  -H 'Content-Type: application/json' \
  -d '{"text":"what should I do next?","today":"2026-09-22"}'
```

## Without the server

`prototype/tracker.html` works standalone too — open it from a file, or from
a shared artifact link. At boot it probes `/api/health`; when nothing
answers, it keeps state in the browser's `localStorage` and runs the same
parser and task-state engine client-side (ported, not simplified). Same
screens, same wording, same guardrails — the only difference is where the
data lives, which is also why a shared link is safe to hand to more than one
person: each viewer gets their own clean run-through instead of editing a
copy the others can see.
