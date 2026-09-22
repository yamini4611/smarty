# Smart Life Tracker — screen-by-screen navigation

This walks the eight core screens defined in the client UI requirements
doc, in the order a real person moves through them: onboarding once, then
the daily loop after. It describes `prototype/tracker.html` exactly as
built — a warm, calm visual system on top of the same task-first structure:
a cream background, soft shadows instead of hard borders, and a rounded
display face (Quicksand/Nunito) — built to feel inviting rather than
clinical, while still making overdue work impossible to miss. The
dashboard itself reads as a **canvas**: every segment is its own small,
color-tinted tile in a grid, not a stacked full-width card, so the whole
board is legible as a wall of color at a glance.

Try it hands-on at the shared link, or run `node backend/server.js` and open
`http://localhost:4000` — see the main [README](../README.md) for both.

## First run (once)

**1 · Welcome and sign in.** One sentence of value, then `Continue with
Google`, `Continue with Apple`, or `Already have an account? Sign in`.

**2 · Optional calendar.** Explains exactly what access would be used for
— creating a single event only when you explicitly choose it — before
asking. `Connect Google Calendar` or `Skip for now`, and it's reversible any
time from Settings either way.

**3 · About you.** Age range (single choice), current life stage (multiple,
tap to toggle), and your main goal (multiple) — every one optional, with a
standing `Skip this` beneath the primary button. These only shape
suggestions; nothing here is required to continue.

**4 · Suggested segments.** Eight broad starting points — Work, Education,
Health, Finances, Home, Family, Travel, Personal — each with its own color
dot and a `Select`/`Selected` toggle. Not a forced set: pick one, several,
or come back and add your own later.

**5 · Choose your segments.** The working list from step 4, editable inline
— rename any of them right in the row, `Remove` any you don't want, and add
a fully custom one in the field at the bottom. Each one also gets a kind,
chosen right here:

- **Permanent** — a standing part of life (Work, Finances). No finish line.
- **Routine** — kept up on a steady cadence (Health, chores). Doesn't
  "finish" either, just tended regularly.
- **Temporary project** — has an actual end (a kitchen remodel, a wedding).
  Gets its own start-to-finish turtle tracker, and an optional field appears
  right there to set when you're estimating you'll be done.

`Continue with N segments` moves on once at least one exists.

**6 · Add first tasks.** A capture bar — type or speak several things at
once, comma-separated or joined with "and": "pay the electricity bill
tomorrow, book dentist visit." Each becomes an editable task in the list
below; deadline and reminder stay optional exactly as required, and an
ambiguous date is kept undated rather than guessed. `Go to my dashboard`
finishes onboarding once at least one task exists.

## Every day after (returning user)

Opens straight to the dashboard — steps 1–6 never appear again once a
segment exists.

**7 · Dashboard.** Header: today's date, a greeting, search, a notification
bell, and a profile avatar. Below that: a soft stat card (Overdue,
Approaching, Pending, Done this week), then filter chips (`All` /
`Overdue` / `Approaching` / `Pending` / `Completed`), then every active
segment as its own small tile in a **two-column canvas grid**, tinted in
that segment's own color — an icon, its name, its kind badge (`Project` or
`Routine`; a permanent segment carries none, to keep it visually quiet),
and — the actual point of the tile — a short list of its real next tasks,
each carrying a small **colored dot for its priority** (high/medium/low
each get their own color, independent of the overdue/approaching/pending
state colors, so urgency and importance never blur together) next to its
title. A project's tile also shows a compact turtle on a dashed path,
positioned by how much of its work is done, with the percent and its
estimated finish date underneath. **Every segment stays on screen no
matter which filter chip is selected** — a filter only narrows which
tasks show in each tile's preview (a tile with nothing matching says so —
"Nothing overdue here" — rather than disappearing), so the grid stays a
stable, calm anchor of the screen. A dashed tile at the end of the grid is
always "Add segment."
>
> Two floating buttons sit over the grid: a persistent circular **＋**
> opens quick add — the same manual form as before, from here or from
> Upcoming, by typing or speaking, exactly as the doc's "global quick-add...
> from any dashboard state" asks for — and, beside it, a second **voice-
> guide** button (a mic icon on its own tinted circle) that opens a
> different, conversational flow: it takes what you say or type in one
> shot ("add finish amazon application today"), proposes which segment it
> thinks that belongs under, and waits for you to confirm or pick a
> different one; then it asks for a priority level; then, only if the
> phrasing was genuinely date-ambiguous, confirms which date you meant —
> and only after all of that does it actually create the task. Nothing is
> saved until every step is confirmed.

**8 · Segment detail** — tap any segment card to land here: the same card,
larger, with its full description, kind badge, and (for a project) the same
turtle path and estimated-finish note at the top; below it, **Tasks to do**
(tap the circle to complete — matching the doc's "completing a task updates
the dashboard without requiring a manual refresh") and then **Past · Done**,
the segment's completed history. The **⋮** menu renames, edits the
description, recolors, changes its kind (with a short explanation of what
each one means), sets or edits a project's estimated finish date, hides,
archives/restores, or permanently deletes the segment.

Three more destinations sit in the persistent bottom tab bar alongside
Dashboard, per §3.4's "clear navigation between Dashboard, Upcoming,
Completed, and Settings":

- **Upcoming** — every open task across all segments, grouped Overdue /
  Approaching / Pending.
- **Completed** — this week's finished tasks, then everything earlier.
- **Settings** — a "Start over" control at the very top, one tap and no
  confirmation dialog, that wipes the current run and returns to Welcome —
  meant for testers doing repeated run-throughs, not a rare destructive
  act; then profile and age range, the default reminder and notification
  permission, voice preferences (read answers aloud, and a private mode
  that keeps individual task details out of anything spoken), calendar
  connection, and data controls (view your data as JSON, sign out, delete
  the account).

The **＋** quick-add also answers direct questions in place — "what's
overdue?", "what should I do next?" — with the matching tasks listed
underneath and, if "read answers aloud" is on, spoken through the same
summary line shown on screen, never more.

A **search** icon on the dashboard rounds out the loop and isn't a separate
top-level screen, matching the doc's "modals and system permission dialogs
don't count" allowance.
