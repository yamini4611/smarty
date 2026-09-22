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
file to put the demo back to the seeded data in `seed.js`: four projects
(Job Search, Move to a New Apartment, Health, Client Launch) with a mix of
overdue, due-soon, blocked, no-deadline, and completed tasks, so the
dashboard is legible the moment it loads rather than an empty shell.

## The data model

`schema.sql` implements the six entities from the requirements doc, §6, as
real tables with foreign keys: `users`, `projects`, `tasks`, `reminders`,
`activity_log`, `integrations`. Every mutating request writes an
`activity_log` row — the foundation the doc asks for under "supports weekly
accomplishments and undo/history."

## The status engine

`status.js` implements the deterministic rules from §4.2 exactly — red,
yellow, green, gray — as one pure function, `computeProjectStatus`. It is
imported by the server for `/api/dashboard` and `/api/projects`, and ported
line-for-line into `prototype/tracker.html` for the no-backend fallback, so
the two modes never disagree about what's overdue or blocked. Every result
carries the specific task and date that caused it (`reason`), never a bare
color — which is what lets the UI "explain why a project is red or yellow
using stored dates and statuses, not generic language" (§5.2), and satisfies
the acceptance criterion that color is never the only status signal.

A project's `status_override` field lets a person override the computed
status directly, per §4.2's "the user may override a project status
manually if the rules do not reflect reality."

## The assistant

`assistant.js` is the stand-in for the language model, with the same two
jobs the doc gives it in §5:

- `parse(text, ...)` — a brain dump in, proposed projects/tasks out. It
  never writes anything; the client always shows a confirmation first
  (§5.2's first guardrail). Multiple responsibilities in one sentence become
  separate, individually editable proposals. A bare weekday ("Friday") is
  genuinely ambiguous — which Friday? — so it comes back with a follow-up
  question and two concrete choices rather than a silent guess; an explicit
  phrase ("next Friday") resolves outright. A short noun phrase that matches
  no existing project ("job search", "stay on top of my health") is offered
  as a new **project**, not forced into a task.
- `answer(text, ...)` — read-only retrieval ("what's due this week?", "what's
  falling behind?"). Counting and filtering happen in `server.js`/`status.js`
  over the real rows; this file only decides *what's being asked*.

In the real build this file is replaced by a call to Claude with the same
input/output contract — the shape the client consumes doesn't change.

## Endpoints

| | |
|---|---|
| `GET /api/health` | `{ trackerApp: true }` — how the page detects a backend |
| `POST /api/auth/sign-in` / `POST /api/auth/sign-out` | mock session (single demo user) |
| `DELETE /api/account` | wipes everything, per FR1's account deletion |
| `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:id` | project CRUD |
| `POST /api/projects/:id/archive` / `.../restore` | FR2 |
| `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/:id` | task CRUD, with `?project_id=&status=&q=` filters (FR12) |
| `POST /api/tasks/:id/complete` / `.../reopen` / `.../archive` | FR3, FR9 |
| `POST/DELETE /api/tasks/:id/calendar-export` | one external event id per task, reused not duplicated (§4.5) |
| `GET /api/dashboard` | summary counts, decorated projects, the attention list (§4.1) |
| `GET /api/summary/weekly` | completed this week, overdue carryover, next week's highlights (FR10) |
| `PUT /api/settings/reminder` / `PUT /api/settings/calendar` | global reminder default, calendar connection |
| `POST /api/assistant/parse` / `POST /api/assistant/query` | the two assistant jobs above |
| `GET /api/search?q=` | FR12 |

```bash
curl localhost:4000/api/dashboard

curl -X POST localhost:4000/api/assistant/parse \
  -H 'Content-Type: application/json' \
  -d '{"text":"For my apartment move, call the utility company Friday and remind me the day before","today":"2026-09-22"}'

curl -X POST localhost:4000/api/assistant/query \
  -H 'Content-Type: application/json' \
  -d '{"text":"what is falling behind?","today":"2026-09-22"}'
```

## Without the server

`prototype/tracker.html` works standalone too — open it from a file, or from
a shared artifact link. At boot it probes `/api/health`; when nothing
answers, it keeps state in the browser's `localStorage` and runs the same
parser and status engine client-side (ported, not simplified). Same
screens, same wording, same guardrails — the only difference is where the
data lives, which is also why a shared link is safe to hand to more than one
person: each viewer gets their own clean run-through instead of editing a
copy the others can see.
