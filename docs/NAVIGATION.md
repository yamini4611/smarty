# Smart Life Tracker — screen-by-screen navigation

This walks the eight core screens defined in the client UI requirements
doc, in the order a real person moves through them: onboarding once, then
the daily loop after. It describes `prototype/tracker.html` exactly as
built — a warm, calm visual system on top of the same task-first structure:
big rounded cards instead of thin rows, a cream background, soft shadows
instead of hard borders, and a rounded display face (Quicksand/Nunito) —
built to feel inviting rather than clinical, while still making overdue
work impossible to miss.

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
a fully custom one in the field at the bottom. Each one also gets a choice
right here: **Ongoing** (a standing part of life, like Work or Health —
never "finishes") or **Temporary project** (something with an actual end,
like a kitchen remodel or a wedding — gets its own start-to-finish tracker).
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
segment as its own big rounded card — an icon, its name, the description
you gave it, and its counts in the state words themselves (never color
alone) — sorted with segments carrying overdue work first. A project's card
shows a small turtle on a dashed path from **Start** to **Finish**,
positioned by how much of its work is done; an ongoing segment shows a
quiet "All caught up here" once nothing's outstanding, rather than staying
silent about it. A persistent circular **＋** button opens quick add from
here or from Upcoming, by typing or speaking, exactly as the doc's "global
quick-add... from any dashboard state" asks for.

**8 · Segment detail** — tap any segment card to land here: the same card,
larger, with its full description and (for a project) the same turtle path
at the top; below it, **Tasks to do** (tap the circle to complete —
matching the doc's "completing a task updates the dashboard without
requiring a manual refresh") and then **Past · Done**, the segment's
completed history. The **⋮** menu renames, edits the description, recolors,
switches it between ongoing and project, hides, archives/restores, or
permanently deletes the segment.

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
