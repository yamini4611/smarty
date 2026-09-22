# Smart Life Tracker — screen-by-screen navigation

This walks the eight core screens defined in the client UI requirements
doc, in the order a real person moves through them: onboarding once, then
the daily loop after. It describes `prototype/tracker.html` exactly as
built — a clean, task-first interface inspired by Todoist's scanability
(flat rows, circular checkboxes, colored due-date text), with its own
palette, typography, and layout rather than Todoist's own.

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
a fully custom one in the field at the bottom. `Continue with N segments`
moves on once at least one exists.

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
bell, and a profile avatar. Below that: four stat tiles (Overdue,
Approaching, Pending, Done this week), then filter chips (`All` /
`Overdue` / `Approaching` / `Pending` / `Completed`), then every active
segment as a row — colored dot, name, and its counts in the state words
themselves (never color alone) — sorted with segments carrying overdue work
first. A persistent circular **＋** button opens quick add from here or from
Upcoming, by typing or speaking, exactly as the doc's "global quick-add...
from any dashboard state" asks for.

**8 · Segment detail** — tap any segment row to land here: a progress bar
split by state, the same four counts scoped to this segment, its effective
reminder, then its open tasks (tap the circle to complete — matching the
doc's "completing a task updates the dashboard without requiring a manual
refresh") and completed tasks below. The **⋮** menu renames, recolors,
hides, archives/restores, or permanently deletes the segment.

Three more destinations sit in the persistent bottom tab bar alongside
Dashboard, per §3.4's "clear navigation between Dashboard, Upcoming,
Completed, and Settings":

- **Upcoming** — every open task across all segments, grouped Overdue /
  Approaching / Pending.
- **Completed** — this week's finished tasks, then everything earlier.
- **Settings** — profile and age range, the default reminder and
  notification permission, voice preferences (read answers aloud, and a
  private mode that keeps individual task details out of anything spoken),
  calendar connection, and data controls (view your data as JSON, sign out,
  delete the account).

The **＋** quick-add also answers direct questions in place — "what's
overdue?", "what should I do next?" — with the matching tasks listed
underneath and, if "read answers aloud" is on, spoken through the same
summary line shown on screen, never more.

A **search** icon on the dashboard rounds out the loop and isn't a separate
top-level screen, matching the doc's "modals and system permission dialogs
don't count" allowance.
