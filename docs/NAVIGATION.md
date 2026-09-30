# Smarty — screen-by-screen navigation

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

**3 · About you.** What Mimi (the voice guide, §7) should call you, age
range (single choice), current life stage (multiple, tap to toggle — with
an "Other" option that opens a free-text field on both this and Main
Goal), and your main goal (multiple) — every one optional, with a standing
`Skip this` beneath the primary button. These only shape suggestions and
personalize Mimi's own questions; nothing here is required to continue.

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
ambiguous date is kept undated rather than guessed. Which segment a task
lands in is decided by matching words from your segment names against
what you typed — "pay the electricity bill" matches "Home" because it
shares a word with a segment named that; "apply for fellowship" matches
nothing, since no segment name shares a word with it, so it comes back
**"Choose a segment"** with a row of your segments to tap instead of
guessing — it is never silently dropped into whichever segment happens
to be first. `Go to my dashboard` finishes onboarding once at least one
task exists and every task has a segment.

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
> from any dashboard state" asks for — and, beside it, a second button for
> **Mimi** (her own turtle avatar, matching the app's logo, on a light
> circle — not a generic mic icon), that opens a different, conversational
> flow: it takes what you say or type in one shot ("add finish amazon
> application today"), and only asks about whatever it genuinely can't
> resolve on its own — which segment, if nothing matched by name, or which
> date, if the phrasing was truly ambiguous — addressing you by the name
> given in onboarding (§3) if one was given. Everything else (priority,
> reminder) is filled in from the phrase itself or your defaults without
> asking, and the whole thing lands on one combined "Got it — sound right?"
> check with a **Priority** and **Reminder** quick-adjust if either needs a
> tweak, rather than a chain of separate questions. Nothing is saved until
> that check is confirmed. When "Read answers aloud" is on in Settings
> (on by default), Mimi speaks her own side of this conversation as well
> as showing it, using the browser's own text-to-speech.

**8 · Segment detail** — tap any segment card to land here: the same card,
larger, with its full description, kind badge, and (for a project) the same
turtle path and estimated-finish note at the top; below it, **Tasks to do**
(tap the circle to complete — matching the doc's "completing a task updates
the dashboard without requiring a manual refresh") and then **Past · Done**,
the segment's completed history. The **⋮** menu renames, edits the
description, recolors, changes its kind (with a short explanation of what
each one means), sets or edits a project's estimated finish date, hides,
archives/restores, or permanently deletes the segment.

Four more destinations sit in the persistent bottom tab bar alongside
Dashboard, per §3.4's "clear navigation between Dashboard, Upcoming,
Completed, and Settings" — plus a Calendar tab added on later feedback,
for the same tasks laid out by date instead of by state:

- **Upcoming** — every open task across all segments, grouped Overdue /
  Approaching / Pending.
- **Calendar** — a stat row (Today / Tomorrow / Next 7 days) for an
  at-a-glance read on how loaded the week is, then a month grid where
  every day carries a small colored dot per open task due that day (the
  same priority palette as the dashboard tiles), so a busy day is visible
  without opening it. Tapping a day shows its task list below the grid;
  arrows step the grid a month at a time. This is the same open-task data
  Upcoming shows, just organized by calendar date rather than by
  overdue/approaching/pending.
- **Completed** — this week's finished tasks, then everything earlier.
- **Settings** — a "Start over" control at the very top, one tap and no
  confirmation dialog, that wipes the current run and returns to Welcome —
  meant for testers doing repeated run-throughs, not a rare destructive
  act; then profile and age range, the default reminder (see below) and
  notification permission, voice preferences (read answers aloud, and a
  private mode that keeps individual task details out of anything spoken),
  calendar connection, and data controls (view your data as JSON, sign
  out, delete the account).

A task's reminder is customizable everywhere a task can be created, not
just the full add/edit form or the default in Settings — the manual add
form, onboarding's first-tasks list, a typed/spoken quick-add's "Confirm
before saving" screen, and Mimi's own conversation each offer the same
choices right where the task is being made: no reminder, at the deadline,
15/30/60 minutes before, a day before at 9:00, a fully custom date and
time, or a weekly repeat (Mimi's version skips the custom date/time
sub-form, for a quick chat flow — set that from the task's own edit
screen after). A dated task is also offered to your calendar
automatically, right when it's created — from the manual add form, a
typed/spoken quick-add, onboarding's first tasks, or Mimi — with a one-tap
**Add to Calendar** action in that moment's own confirmation (a toast, or
right in Mimi's own reply), so there's nothing to turn on first. The same
export stays available any time after, in the task's own edit screen:
**Add to Google Calendar →** opens Google's own pre-filled "quick add"
page, and **Download for Apple Calendar (.ics)** hands over a real
calendar file that opens straight into Apple Calendar's own add-event
screen on iOS — both one-tap, one-way exports, needing no Google/Apple
sign-in of their own.

The **＋** quick-add also answers direct questions in place — "what's
overdue?", "what should I do next?" — with the matching tasks listed
underneath and, if "read answers aloud" is on, spoken through the same
summary line shown on screen, never more.

A **search** icon on the dashboard rounds out the loop and isn't a separate
top-level screen, matching the doc's "modals and system permission dialogs
don't count" allowance.
