# Ballast — a personal commitments dashboard

> ### Current build: Smart Life Tracker — a canvas of color-coded segments, plus a guided voice assistant
>
> The structure still follows the client's UI requirements doc — a **Life
> Segment → Task** model, four purely date-driven task states (Overdue,
> Approaching, Pending, Completed), onboarding that asks age range, life
> stage, and goals — and the visual system has now been redirected three
> times on direct feedback after seeing it run. First: warmer, not clinical
> — big rounded cards, a cream-and-sage soft-shadowed palette. Then: real
> next tasks tagged High/Medium/Low instead of abstract counts, with every
> segment card staying on screen regardless of which filter is selected.
> Now, per the latest round of feedback:
>
> - **A canvas, not a stack.** The dashboard is a two-column grid of small
>   colored tiles — one per segment, tinted in that segment's own color —
>   instead of full-width cards, so the whole board reads at a glance like
>   a wall of color-coded windows.
> - **Tasks are color-coded by importance**, not just labeled: a small dot
>   next to every task carries its own priority color (independent of the
>   overdue/approaching/pending state colors, so "urgent" and "important"
>   never get visually confused).
> - **A second, separate assistant button** sits beside the usual **+**
>   quick-add — a voice-guide that has an actual back-and-forth: say (or
>   type) "add finish amazon application today," and it proposes which
>   segment that belongs under, waits for you to confirm or correct it,
>   then asks for a priority level, before it ever saves anything.
> - **The turtle stays** — a temporary project still gets its start-to-
>   finish progress path, now with a compact version that fits inside a
>   tile as well as the full one in segment detail.
> - **One-tap reset.** Since this is a build for repeated test runs, a
>   "Start over" control in Settings wipes the current run and drops you
>   back at Welcome — no confirmation dialog — and a real sign-in
>   afterward now lands on genuine onboarding instead of silently
>   re-seeding the sample data.
>
> - **App:** [`prototype/tracker.html`](prototype/tracker.html) — all eight
>   core screens plus the Upcoming/Completed/Settings tabs, working end to
>   end, with a real client-side parser and task-state engine for the
>   no-backend case.
> - **Backend:** [`backend/`](backend/server.js) — Node + the built-in
>   `node:sqlite`, no install step. See [`backend/README.md`](backend/README.md)
>   for the data model, the task-state engine, the assistant (including the
>   five supported voice questions), and every endpoint.
> - **How to navigate it, screen by screen:**
>   [`docs/NAVIGATION.md`](docs/NAVIGATION.md).
> - **Run it:** `node backend/server.js`, then open `http://localhost:4000`
>   (prints a LAN address too, for a phone on the same wifi). Or open
>   `prototype/tracker.html` directly / share its published link — it works
>   with no backend at all, keeping state in the browser.
>
> Everything below this point describes earlier directions (`app/`, the
> Executive Brief mockups in `design/`, and the prior Project/Task build)
> and is kept as design history, not the current spec.

---

Ballast is a working prototype of the "Personal Commitments Manager" described
in the product brief: a single, trustworthy place to capture the things a
busy person is responsible for — across work, home, family, social life,
personal growth, and hobbies — and see clearly what deserves attention next.

This document is the technical/product rationale behind what's in `app/`:
the problem it's solving, the decisions made and why, how it's built, and
what's deliberately left out of this version.

Deployment is intentionally **not** part of this pass — see
[Running it locally](#running-it-locally) and
[Deploying it later](#deploying-it-later) at the bottom.

> ### Status: this web build is now the UI reference, not the product
>
> The shipping product is a **mobile app (Expo/React Native) with a
> Python/FastAPI backend**, adding voice notes and voice retrieval, per
> **[`docs/TECHNICAL-SPEC.md`](docs/TECHNICAL-SPEC.md)** — which merges
> this brief with the *Cadence* technical specification and the client's
> confirmed direction (a personal life dashboard rather than a calendar
> assistant).
>
> What's in `app/` stays useful and stays maintained: it is the working
> visual and interaction spec the mobile screens are built against, and
> its capture parser is the stage-1 backend implementation. Sections 1–4
> and 7 below (problem, user, product decisions, views) carry over intact.
> Sections 3.7 and 8 describe this prototype's storage and limits
> specifically, and are superseded by the spec for the product itself.

---

## 1. The problem

Busy professionals hold commitments across six or more domains at once —
work projects, household and remodeling logistics, family obligations,
social plans, career/personal development, hobbies — and that information
lives scattered across calendars, notes apps, email, group chats, and
memory. The result, as the brief frames it, is predictable:

- Tasks, deadlines, and follow-ups get forgotten.
- People react to whatever is loudest instead of planning intentionally.
- Long-term, non-urgent goals (fitness, learning, relationships) lose out
  to short-term noise, because nothing is forcing a look at them.
- The tools meant to help — a calendar, a to-do list, a notes app — each
  cover one slice of life and require constant manual upkeep to stay
  useful, which is its own tax on attention.

**Why this isn't "just build a better calendar":** a calendar answers
*when*. It doesn't answer *what matters right now*, *what life area is
being neglected*, or *did I actually deal with this*. Todoist and Apple
Reminders answer *what*, but not *which of my six lives does this belong
to* or *am I keeping every part of my life in view*. Notion can model
anything, at the cost of the user building and maintaining the system
themselves — which the brief calls out directly as a failure mode
("users may stop maintaining the system if it requires too much manual
correction"). None of them are opinionated about the actual question this
product exists to answer:

> "I need one trusted place to capture everything on my mind and
> understand what I should do, when I should do it, and how it fits into
> the rest of my life."

That's a dashboard problem, not a scheduling problem. Ballast's job is to
turn capture into a small number of decisions — *now, soon, or later; which
life area; part of which project* — and then get out of the way.

## 2. Who this is for, and what "useful" means here

One individual managing their own commitments — not a team, not a shared
calendar. Useful means, concretely, the metrics the brief sets out:

- Capturing a commitment takes under 15 seconds, from any device, without
  deciding first where it "belongs."
- Anything captured can be found again — nothing quietly rots in an app
  that isn't checked.
- Opening the app answers "what actually needs me today?" in one glance,
  not a scroll through everything that's ever been added.
- Deadlines and follow-ups get tracked reliably enough that a person stops
  needing a mental backup system.
- Life areas that don't shout for attention (growth, hobbies, relationships)
  still get surfaced, instead of being permanently crowded out by whatever
  is due soonest.

## 3. Key product decisions

### 3.1 Hybrid dashboard, not time-first or area-first

The brief poses this as the open decision. Ballast implements the hybrid:
**Today / Upcoming / Overdue is the primary axis** (a segmented control),
and **life areas are a secondary filter row** underneath it, plus the
organizing structure for Projects and the weekly Review.

Reasoning: time is what forces action (a due-today item needs handling
regardless of area), so it has to be the default lens or the dashboard
turns into six separate to-do lists a person has to mentally merge every
morning. But a pure time-first view quietly starves whatever doesn't have
looming deadlines — which is exactly how "Personal Growth" and "Hobbies"
get abandoned. Area becomes a filter for *when you want to look at one
slice* (planning a home-projects afternoon) and the organizing axis for
**Review**, whose whole job is to check that every active life area got a
fair share of the week — the one place area-first thinking actually
belongs.

### 3.2 Priority is computed, not asked for

Todoist-style manual priority flags rot the same way manual filing does —
people stop maintaining them. Ballast derives **Now / Soon / Later** from
due-date proximity (due today → Now; within ~2 days → Soon; further out or
undated → Later) and from urgency language in the capture text itself
("urgent", "asap"). The result is always shown and always editable in the
confirmation sheet — automatic, but never invisible or final, per the
brief's "trustworthy" and "forgiving" principles.

### 3.3 The Inbox is "captured but not yet scheduled," not "everything"

An item without a due date lands in **Inbox** and stays out of
Today/Upcoming/Overdue entirely. This keeps the dashboard from being
polluted by half-formed thoughts, while still guaranteeing nothing typed
in gets lost — it's one tab away, waiting for a date or a decision. This
is the literal Capture → Organize boundary from the brief's core loop.

### 3.4 "Ask before scheduling" is a first-class, default-on setting

Every capture can go one of two ways, and the user picks which, in
Settings (mirroring the mockup's own toggle):

- **On (default):** every capture opens an editable confirmation sheet —
  title, date, time, life area, project, priority, recurrence — before
  anything is saved. This is what makes automatic classification
  trustworthy: the user sees the guess before it becomes real state.
- **Off:** captures save immediately with a toast that includes an
  **Edit** action, for someone who has learned to trust the guesses and
  wants raw capture speed instead.

### 3.5 Recurrence rolls forward instead of piling up

Marking a recurring item done doesn't create a done+pending pair sitting
in the data forever — it advances that same item's due date to the next
occurrence (day/week/month) and leaves it open. Simpler data model, and it
matches how a recurring commitment actually feels: not a queue of separate
tasks, one continuing obligation.

### 3.6 Projects are optional grouping, not mandatory hierarchy

A task doesn't need a project. Saying "about the kitchen cabinets" in a
capture is enough to spin up a **Kitchen Cabinets** project automatically
(via a trailing `about|regarding|re:` phrase in the parser); a project can
also be created empty ahead of time from the Projects tab. This keeps the
common case (a bare task) frictionless while still giving multi-step
efforts (a remodel, a job search) a home.

### 3.7 Local-first storage, on purpose *(prototype only — see the spec)*

Everything is written to the browser's `localStorage` on the device it
runs on. Nothing is transmitted anywhere. This is a direct answer to the
brief's "privacy-conscious: personal data should remain under the user's
control" principle, and it's why **Export as JSON** and **Clear all data**
exist as real, unconditional controls in Settings rather than aspirational
copy. The tradeoff — no sync between devices in this version — is called
out explicitly in [Limitations](#6-known-limitations--whats-next).

In the product, this becomes a server-side store (Postgres) with the same
user-facing guarantees kept as explicit, enforced commitments — configurable
audio retention, whole-archive export, and delete that reaches object
storage and the embedding index. See §14 of the technical spec.

## 4. What Ballast deliberately does *not* do (v0 non-goals)

Straight from the brief, and worth restating because it's easy to scope-
creep a dashboard into a second calendar or a second Notion:

- No calendar replacement — no month grid, no meeting scheduling, no
  attendee invites.
- No email/messaging client, no financial tracking, no team/multi-user
  features, no social layer.
- No "productivity framework" with weighted scoring, streaks, or
  gamification — the brief explicitly wants *calm*, not another system to
  feed.

## 5. Architecture

**Stack:** vanilla HTML/CSS/JS, zero build step, zero dependencies, zero
server. Three files:

```
app/
  index.html   structure: nav rail + mobile tab bar, five views
               (Today, Inbox, Projects, Review, Settings), onboarding
               overlay, capture-confirmation sheet, new-project sheet
  styles.css   design tokens (light + dark, via CSS custom properties),
               layout, and every component
  app.js       state, the capture parser, rendering, and all interaction
```

This is deliberate for a v0: the whole app is inspectable in three files,
runs by opening `index.html` (or serving the folder statically — see
below), and has no framework version, package manager, or build tool to
rot. It also means it is trivially portable to whatever hosting is chosen
later (see [Deploying it later](#deploying-it-later)) without any
adaptation.

**State shape** (persisted as one JSON blob under `localStorage` key
`ballast.v1`):

```jsonc
{
  "onboarded": true,
  "settings": {
    "areas": ["work", "home", "family", "social", "growth", "hobbies"],
    "dailyStart": "08:00",
    "weeklyReviewDay": 0,          // 0=Sun, 1=Mon, 5=Fri, 6=Sat
    "reminderStyle": "gentle",     // gentle | standard | assertive
    "dailyBriefing": true,
    "askBeforeScheduling": true
  },
  "items": [
    {
      "id": "…", "title": "Call the contractor",
      "area": "home", "areaGuessed": false,
      "projectId": "…" /* or null */,
      "dueDate": "2026-09-15" /* or null → Inbox */,
      "dueTime": "15:00" /* or null */,
      "priority": "now",           // now | soon | later
      "recurring": { "freq": "weekly" },  // none | daily | weekly | monthly
      "done": false,
      "rawInput": "call the contractor next tuesday about the cabinets",
      "createdAt": 1234567890
    }
  ],
  "projects": [{ "id": "…", "name": "Kitchen Cabinets", "area": "home" }]
}
```

Life areas are a fixed set of six (`work`, `home`, `family`, `social`,
`growth`, `hobbies`) matching the brief's MVP list; a user activates a
subset during onboarding (editable later in Settings), and inactive areas
disappear from filters, pickers, and the weekly review.

## 6. The capture pipeline

This is the part of the brief that reads "should identify the task, date,
topic, life area, and likely project" — worth documenting honestly.

**What it is:** a deterministic, offline, regex-and-keyword heuristic
parser (`parseCapture()` in `app.js`), not a machine-learning model. Given
raw text (typed, or transcribed from the browser's `SpeechRecognition`
API), it strips out and interprets, in order:

1. **Recurrence** — `every day`/`daily`, `every <weekday>`, `every
   week`/`weekly`, `every month`/`monthly`.
2. **Date** — `today`, `tomorrow`, `in N days/weeks`, `next <weekday>`,
   a bare weekday (treated as the *next* occurrence, never today),
   `YYYY-MM-DD`, `Month Day`, `M/D[/YYYY]`.
3. **Time** — `at 3pm`, `3:30pm`, `15:00`, or the words `morning` /
   `afternoon` / `evening` / `night` mapped to representative hours.
4. **Urgency** — `urgent`, `asap`, `immediately`, `right away` → forces
   **Now** priority regardless of date.
5. **Project/topic** — a trailing `about|regarding|re: …` phrase becomes
   the project name (title-cased), and is removed from the task title.
6. **Filler removal** — leading phrases like "remind me to", "I need to",
   "don't forget to" are stripped so the title reads as an imperative.
7. **Life area** — keyword matching (a curated list per area) against
   whichever areas the user actually activated; if nothing matches, it
   falls back to the user's first active area and is flagged `Guessed` in
   the UI so it's visibly a guess, never presented as certain.
8. **Priority** — computed as in [3.2](#32-priority-is-computed-not-asked-for)
   if urgency language wasn't already decisive.

**Why heuristics instead of an LLM call for v0:** it's instant, free,
works fully offline, and — critically for a "trustworthy" product — is
*legible*: every decision traces to a specific phrase in the input, which
makes the confirm-and-correct loop meaningful instead of a black box. The
explicit tradeoff is coverage: it will not understand phrasing outside its
patterns ("the Tuesday after next," implied dates from context, multi-task
utterances). That's a known, acceptable v0 limitation, not an oversight —
see below for where this goes next.

## 7. The five views

- **Today** — greeting, optional daily-briefing banner, the capture bar,
  the Today/Upcoming/Overdue segmented control, the area-filter chip row,
  and the resulting list. Today itself groups into **Focus now / Also
  today / Make space for / Done today** (Now/Soon/Later/completed);
  Upcoming groups into **This week / Later**; Overdue is a flat,
  oldest-first list.
- **Inbox** — every item without a due date. Editing one and giving it a
  date moves it out automatically; there's no separate "move to Today"
  action because a date *is* the move.
- **Projects** — a card per project (auto-created from capture, or made
  explicitly) with a completion bar; clicking one shows just its tasks.
- **Review** — **Daily**: done/open/overdue counts today plus the open
  list, for a quick end-of-day pass. **Weekly**: a per-area count of
  what's due in the next 7 days, with a called-out banner for any active
  area that has *nothing* scheduled — the mechanism that protects
  long-term, non-urgent goals from being crowded out, per the brief's
  stated risk.
- **Settings** — active life areas, rhythm (daily start time, weekly
  review day, reminder style), the two behavior toggles from §3.4, and
  data controls (export the full JSON, or clear everything).

## 8. Known limitations & what's next

Limitations of **this web prototype**, in priority order. Each is resolved
by the product architecture in
[`docs/TECHNICAL-SPEC.md`](docs/TECHNICAL-SPEC.md) — the section reference
after each one says where.

1. **No cross-device sync.** `localStorage` is per-browser, per-device.
   The data model here was kept flat and JSON-serializable specifically so
   the swap to a server store is additive rather than a rewrite.
   → *spec §3, §4*
2. **No real reminders/notifications.** "Reminders" here means *the item
   shows up when you open the app*; there's no push or background alert.
   → *spec §13, and deliberately still deferred there until suggestion
   quality earns an interruption*
3. **Parser coverage is heuristic, not general.** See §6. The upgrade is
   routing capture through an LLM for extraction while keeping the same
   confirm/edit sheet as the trust boundary — the UI doesn't change, only
   what fills it in. The heuristic parser stays on as the stage-1
   implementation and the fallback path. → *spec §10, §16*
4. **Voice is browser-dependent and capture-only.** It uses the Web
   `SpeechRecognition` API where available and degrades to a visible "type
   instead" prompt where it isn't — never a silent failure. Nothing here
   records or retains a voice *note*, and there's no retrieval by voice.
   → *spec §7, §8*
5. **Six life areas are fixed**, not user-defined, matching the brief's
   MVP list exactly. Custom areas are a reasonable ask once the fixed set
   proves the concept. → *spec §9*

## 9. Running it locally

No build, no install:

```bash
cd app
python3 -m http.server 8080   # or: npx serve .
# open http://localhost:8080
```

Or just open `app/index.html` directly in a browser — everything except
the Google Fonts link (which degrades gracefully to system fonts offline)
works with no network at all.

## 10. Deploying it later

Because it's a static, dependency-free site, deployment — when it's
time — is a non-event: point Vercel, Netlify, GitHub Pages, or any static
host at the `app/` folder and it runs as-is. That step is deliberately not
done in this pass, per direction to document the *why* first.

For the mobile product, "deployment" means something different — Expo on a
physical device without store submission, with the backend hosted
separately. See [`docs/TECHNICAL-SPEC.md`](docs/TECHNICAL-SPEC.md) §3
and §16.
