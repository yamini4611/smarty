# Smart Life Tracker — screen-by-screen navigation

This walks the nine core screens defined in the MVP requirements doc, in the
order a real person moves through them: first-time setup once, then the
returning-user loop every day after. It describes `prototype/tracker.html`
exactly as built — every action named here is a real, working control, not
a mockup label.

Try it hands-on at the shared link, or run `node backend/server.js` and open
`http://localhost:4000` — see the main [README](../README.md) for both.

## First run (once)

**1 · Welcome and sign in.** One sentence of value proposition, then
`Continue with Google`, `Continue with Apple`, or `Try the demo without an
account`. Any of the three moves on — this build doesn't gate on a real
OAuth flow, but hooks are in place (`/api/auth/sign-in`) for the real one.

**2 · How it works.** A worked example — three project rows in red, yellow,
and green, each with the specific task that caused its color — before you're
asked to set anything up. Explains the one-way calendar relationship up
front: dated tasks *can* export, the tracker is never replaced by one.
`Continue` moves on.

**3 · Choose life areas.** A plain checklist — Work, Personal, Health, Home,
School, Travel, Finances — tap to toggle, type your own into the field at
the bottom and hit `Add`. `Skip for now` is a real, working option, per the
doc's "optional, editable, easy to dismiss" requirement.

**4 · Add initial projects.** Say or type several responsibilities at once
— "job search, moving apartments, and staying on top of my health" — via the
capture bar; each becomes its own editable project in the list below, with a
`Remove` on each. Add one more by hand in the field underneath. `Continue
with N projects` moves on once at least one exists.

**5 · Project setup**, one project at a time, with a stepper showing
progress (`PROJECT 1 OF 3`): what does success look like (a free-text
description), what's the next milestone (becomes the project's first task,
with an optional deadline), and whether reminders should use the default or
be customized for this project. `Skip` or `Next project` advances; after the
last project, this becomes `Go to dashboard`.

## Every day after (returning user)

Opens straight to the dashboard — steps 1–5 never appear again once a
project exists.

**6 · Add task** — reached from the **＋** button on the dashboard, or "Add
task to *Project*" on any project detail page. Two ways into the same
screen:
- **Type or speak.** Tap the mic row — "pay the deposit for the venue by
  Friday and remind me the day before" — and it's parsed into an editable
  proposal: title, project (asked for if it can't be inferred), date,
  priority, reminder. A vague date ("Friday" — which one?) comes back as a
  follow-up question with two concrete choices, never a guess. Multiple
  responsibilities in one sentence become separate proposals you can accept,
  edit, or discard individually. Nothing saves until you tap `Save`.
- **Fill in the form directly** — title, project, deadline (or an explicit
  *No deadline*), priority, reminder, notes, and a calendar-export toggle
  that's only available once a deadline is set.

The same screen also answers direct questions — "what's due this week?",
"what's falling behind?" — with the matching tasks listed underneath, worked
out from your actual data, never a canned line.

**7 · Dashboard** — the home screen. Header: today's date, a greeting, a
search icon, a notification bell (flags if permission is off), and a profile
initial that opens Progress. Below that: four counts (due today, overdue,
needs attention, done this week), a **Needs attention** list — red projects
first, each showing the exact task and reason — then **All projects** with
`All` / `Attention` / `Upcoming` filters, each row showing status, next
task, nearest date, and a completion bar. `+ Add project` sits at the
bottom of the list.

**8 · Project detail** — tap any project row to land here: full status with
its reason, the description from setup, open/done/overdue counts and a
progress bar, the effective reminder, then open tasks (tap the checkbox to
complete — that's the "two taps from the dashboard" the doc's success
criteria ask for: one to open the project, one to check it off) and
completed tasks below. The **⋮** menu edits the project, overrides its
status manually, archives or restores it, or deletes it permanently (with a
confirmation).

**9 · Progress and settings** — reached from the bottom tab or the profile
initial. This week's completed tasks, what's carried over as overdue, and
what's coming up next; then reminder defaults, notification permission
state (with a real `Enable` action), Google Calendar connection, profile
details, and data controls — download everything as JSON, sign out, or
delete the account entirely.

A **search** icon on the dashboard and a lightweight **add project** form
round out the loop; both are reachable in one tap and aren't separate
top-level screens, matching the doc's "modals and system permission dialogs
don't count" allowance.
