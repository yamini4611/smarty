# Ballast — Technical Specification

**Feature-level design and implementation notes for the personal life
dashboard.** Version 2. Supersedes *Cadence — Technical Specification v1*
where the two disagree; carries most of it forward unchanged.

---

## 1. How to read this

There are three documents in play, and it's worth being precise about what
each one is now:

| Document | Status |
| --- | --- |
| Product brief (personal commitments dashboard) | The **product intent**, confirmed by the client |
| *Cadence — Technical Specification v1* | The **engineering foundation** — most of it survives, repositioned |
| This document | The **merge**: what gets built, on what platform, in what order |
| `app/` in this repo | The **UI reference prototype** — a working web build of the dashboard, used as the visual and interaction spec for the mobile app. Not the shipping product. |

Organised by feature, not by schedule; build order is §15. Each feature
section keeps the Cadence shape — what it does, how it works, what breaks,
how you know it's finished — because that shape is what made the Cadence
document useful.

Everything here is scoped to the first release. Deferred items are §16.

### 1.1 Vocabulary

Three documents use overlapping words. These are the definitions that hold
from here on:

| Term | Meaning |
| --- | --- |
| **Domain** | A life area — Work, Home, Family, Social, Personal Growth, Hobbies. Rendered in the UI as "life area"; `Domain` in the schema. Cadence's Domain and the brief's life area are the same object. |
| **Commitment** | Anything the user is on the hook for: a task, a deadline, a follow-up. **The hub of the data model.** |
| **Event** | A calendar event, mirrored from or written to Google. A commitment *may* have one attached; most won't. |
| **Note** | A captured thought — voice or text — retained as a durable, searchable artifact. New in v2. |
| **Action** | A proposed change, with a lifecycle and a risk tier. Unchanged from Cadence §8. |

---

## 2. What changed, and why

The client reviewed the Cadence direction and asked for a **personal life
dashboard** — something that keeps him on top of everything — rather than a
calendar assistant. That is not a cosmetic reframing, and it is not a
rewrite either. Concretely:

| Cadence v1 | Ballast v2 | Why |
| --- | --- | --- |
| `Event` is the hub; everything is a calendar write | `Commitment` is the hub; `Event` is one optional attachment | Most of what a person is on the hook for never becomes a calendar entry. "Chase the insurance claim" has a deadline and an owner but no meeting. A calendar-shaped hub silently drops the majority of the user's real load. |
| Success = the assistant scheduled the thing correctly | Success = the user opens the app and knows what deserves attention | The dashboard is the deliverable. Scheduling is one action it can take. |
| Voice is a command shortcut, consumed into an intent | Voice is **capture** (a note that persists) *and* **retrieval** (a question answered from what was captured) | §7 and §8. This is the largest genuinely new surface. |
| Google Calendar is the system of record | Ballast's own Postgres is the system of record; Google is a **source and sink** | A dashboard that can only hold what Google can represent is a calendar with extra steps. |
| Offline mode deferred (Cadence §13) | **Offline capture is required** in v1 | See §13.3. The brief's core promise is capture in under 15 seconds from anywhere; a capture path that fails on a train breaks the product's central claim. This is the one Cadence deferral this document overturns. |

**What carries over untouched, and should:** the three-tier split with all
intelligence server-side (§3), the domain policy engine (§9), structured
tool-use intent parsing with strict validation (§10), the action queue and
the model-classifies-intent / code-classifies-risk separation (§11), the
Google sync mechanics and every one of their documented failure modes
(§12), the daily sweep (§13), and the testing discipline (§14). That
machinery was designed around safety and timezone correctness, and neither
concern changed.

---

## 3. System overview

Three tiers, and the Cadence rule still governs: **all intelligence and all
secrets live on the server.** The mobile app renders state and captures
input. It never holds an API key, never talks to Google or a model
provider directly, and never decides what the assistant is allowed to do.

| Tier | Responsibility |
| --- | --- |
| Mobile app (React Native / Expo) | Rendering, input capture, **offline capture queue**, local UI state |
| Backend (Python / FastAPI) | Auth, sync, policy, intent parsing, retrieval, action lifecycle |
| External services | Google Calendar, an LLM for parsing and answer composition, a speech-to-text provider, object storage for audio |

The one addition to the Cadence tier table is object storage for voice
note audio, and it inherits the same rule: the app uploads through the
backend, never with a direct-to-bucket credential.

### Technology choices

Unchanged from Cadence unless the Δ column says otherwise.

| Layer | Choice | Δ |
| --- | --- | --- |
| Mobile framework | Expo (React Native) | — |
| Navigation | expo-router | — |
| Audio capture | expo-audio (**not** expo-av, removed in SDK 54+) | — |
| Secure storage | expo-secure-store | — |
| Server state | TanStack Query | — |
| Offline queue | TanStack Query persistence + SQLite (expo-sqlite) outbox | **New** — §13.3 |
| Dates | Luxon | — |
| Backend | FastAPI + Pydantic v2 | — |
| Database | PostgreSQL 16 + **pgvector** | pgvector added for note retrieval (§8); no new infrastructure, it's an extension on the database already chosen |
| ORM / migrations | SQLAlchemy 2.0 + Alembic | — |
| Calendar | google-api-python-client | — |
| Intent parsing | An LLM with tool-use / structured output | — |
| Speech to text | A hosted transcription API | — |
| Object storage | S3-compatible bucket, server-issued URLs | **New** — voice note audio |
| Scheduling | APScheduler, in-process | — |

---

## 4. Data model

Additions and changes against Cadence §3. `User`, `Account` and `Domain`
are unchanged; `Event` loses its position as hub but keeps its shape.

```
User(id, email, tz, created_at)

Account(id, user_id, provider, google_sub, access_token,
        refresh_token, token_expiry, calendar_id, sync_token)

Domain(id, user_id, name, color, account_id, policy_json)

Commitment(id, user_id, domain_id, project_id,
           title, notes,
           due_date, due_time, due_tz,          -- nullable: undated → Inbox
           priority,                             -- now | soon | later
           status,                               -- open | done | archived
           recurrence_json,                      -- null | {freq, interval, anchor}
           event_id,                             -- nullable FK → Event
           source,                               -- voice | text | sweep | calendar | email
           source_note_id,                       -- nullable FK → Note
           confidence, classified_by,            -- model | user | rule
           created_at, completed_at)

Project(id, user_id, domain_id, name, status, created_at)

Note(id, user_id, domain_id,
     kind,                                       -- voice | text
     audio_key, audio_retained, duration_ms,     -- audio_key null when transcript-only
     transcript, transcript_confidence,
     embedding VECTOR(1536),
     tsv TSVECTOR,                               -- lexical half of hybrid search
     linked_commitment_id, linked_project_id,
     captured_at, captured_tz)

Event(id, user_id, domain_id, account_id, external_id, etag,
      title, description, location,
      start_utc, end_utc, start_tz, is_all_day,
      recurring_event_id, status, synced_at)

Action(id, user_id, domain_id, type, risk_tier, origin,
       payload_json, diff_text, status,
       idempotency_key, created_at, resolved_at, error_text)
```

**The two Cadence rules still apply and still matter most.** All
timestamps are `TIMESTAMP WITH TIME ZONE` stored in UTC, with the
originating IANA zone kept alongside as a string (`due_tz`, `start_tz`,
`captured_tz`); convert at render time only. `is_all_day` stays a real
column, never inferred from midnight.

**Three rules the new tables add:**

`Commitment.due_date` is nullable, and null is meaningful — it is the
Inbox. An undated commitment is not a defect to be cleaned up; it is a
thought that has been captured but not yet placed, and the UI treats it as
a first-class state (§6.2). Do not backfill it with a default date.

`Note` is never deleted by a successful parse. When a voice note produces
a commitment, the note persists and the commitment carries
`source_note_id` back to it. This is what makes "what did I actually say?"
answerable three weeks later, and it is the difference between a notes
product and a command line.

`Commitment.classified_by` records whether a field was set by the model, a
rule, or the user. Two reasons: the UI must be able to mark a guess as a
guess (the brief's trustworthiness principle), and user corrections are
the training signal for the open question in Cadence §14 about learned
domain inference. Without this column that question stays unanswerable.

---

## 5. Feature: the dashboard

### WHAT IT DOES

Answers, on open, in one screen: what needs me now, what's coming, what
did I miss, and is any part of my life being quietly neglected.

### HOW IT WORKS

**Hybrid organisation — time first, domain as filter.** This was the open
decision in the brief and it is now settled. The primary axis is
**Today / Upcoming / Overdue**; life domains are a filter row underneath
it, and the organising axis inside Review (§5.2).

Reasoning: time forces action, so it has to be the default lens or the
dashboard becomes six to-do lists the user merges in their head every
morning. But a purely time-first view starves anything without a looming
deadline — which is precisely how Personal Growth and Hobbies get dropped.
Domain filtering serves the "plan my home-projects afternoon" case;
domain-grouped review serves the "did I neglect anything this week" case.
Neither belongs on the default screen.

**Today groups by priority, not by hour.** Sections are *Focus now* /
*Also today* / *Make space for*, from `Commitment.priority`. An hour-ruled
day grid is a calendar; this is a dashboard, and most commitments have a
date without a time.

**Priority is computed, then editable.** Due today or flagged urgent in
the capture text → `now`; within two days → `soon`; beyond, or undated →
`later`. Manual priority flags rot the same way manual filing does — but
the computed value is always visible and always overridable, and an
override sets `classified_by = user` so the sweep stops second-guessing it.

### 5.1 Views

| View | Contents |
| --- | --- |
| **Today** | Greeting, briefing line, capture bar, Today/Upcoming/Overdue control, domain filter chips, the grouped list |
| **Inbox** | Every commitment with `due_date IS NULL`, plus notes not yet linked to anything |
| **Projects** | A card per project with completion state; drill in for its commitments |
| **Review** | Daily: done / open / overdue counts and the open list. Weekly: per-domain counts for the next 7 days, **with an explicit callout for any active domain that has nothing scheduled** |
| **Settings** | Active domains, policy per domain (§9), rhythm, autonomy tiers (§11), data controls |

The weekly neglected-domain callout is the mechanism that delivers the
brief's "protect long-term goals" requirement. It is a feature, not a
statistic: it is the only part of the product that argues *for* work the
user did not ask about.

### WHAT BREAKS

**The same obligation arriving twice.** A dinner that exists as a Google
event and as a commitment the user spoke into the app will render twice
unless they are linked. Rule: a commitment created from a synced event
carries `event_id`; the sweep deduplicates on (domain, title similarity,
start time within 30 minutes) and links rather than creating. Render
`Commitment` rows; an `Event` with no commitment is projected into the
view as a read-only row, never duplicated into one.

**Dashboard volume.** Every list is bounded and sorted server-side.
"Overdue" over a year of use is unbounded by nature; cap the view and
offer an explicit archive sweep rather than rendering 400 rows of guilt.

### DONE WHEN

Opening the app shows today's commitments grouped by priority with domain
tags, filtering to a single domain works, and a domain with nothing
scheduled in the next seven days is called out by name in Review.

---

## 6. Feature: capture

### WHAT IT DOES

Gets a thought out of the user's head and into the system in under fifteen
seconds, from anywhere, with or without a network.

### HOW IT WORKS

One path, three entry points — text, voice (§7), and the share sheet.
Everything after transcription is shared code, exactly as Cadence §7
specified.

```
input → (transcribe if audio) → persist Note
      → intent parse (§10) → Action proposal (§11)
      → confirmation card
```

**The note is persisted before the parse runs, and independently of its
outcome.** If parsing fails, times out, or returns `unknown`, the user has
still captured something and it is still findable. This inverts Cadence's
model, where an unparseable utterance was simply an error.

### 6.1 Confirm before scheduling

Every capture surfaces an editable confirmation card — title, date, time,
domain, project, priority, recurrence — before anything is written. This
is the `ask_before_scheduling` preference, default on, and it is what
makes automatic classification trustworthy: the guess is visible before it
becomes state. Users who come to trust it can switch it off, in which case
captures commit immediately with a one-tap undo (Tier 1 handling, §11).

Fields the model guessed are marked as guesses in the card. A silent
correct guess and a silent wrong guess look identical, which is how users
learn to distrust a system.

### 6.2 The Inbox is a destination, not a failure state

A capture with no date goes to the Inbox and stays out of
Today/Upcoming/Overdue entirely. Giving it a date *is* the act of
scheduling it — there is no separate "move to Today" action. This keeps
the dashboard free of half-formed thoughts while guaranteeing nothing
captured is lost.

### WHAT BREAKS

**Capture latency is the product.** If the capture bar takes a round trip
before the user can type, the fifteen-second promise is gone. Capture
writes locally first, renders immediately, and syncs behind the UI.

**A confirmation card that blocks on the model.** The card renders from
the local optimistic record as soon as the transcript exists; parsed
fields populate into it as they arrive. Never show a spinner where the
user expects a text field.

### DONE WHEN

A commitment can be captured, confirmed and seen on the dashboard in under
fifteen seconds on a physical device, and the same flow completes in
airplane mode with the row syncing on reconnect.

---

## 7. Feature: voice notes

### WHAT IT DOES

Lets the user hold a button, speak freely, and keep the result — audio and
transcript — as a durable, searchable record, whether or not it contains
anything actionable.

### HOW IT WORKS

```
hold button → expo-audio records m4a
  → multipart upload to POST /notes/voice
  → transcription
  → return {note_id, transcript} immediately          [response 1]
  → persist Note (+ embedding, +tsv)
  → intent parse → Action proposal
  → return action card                                 [response 2]
```

**Two responses, not one** — carried directly from Cadence §7, for the
same two reasons: it roughly halves perceived latency, and a visible
transcript makes failures legible. When the result is wrong, the
transcript tells you instantly whether the fault was hearing or reasoning.

**Multipart upload, not base64.** Base64 inflates payload by a third and
hits request size limits on longer clips — and voice *notes* are longer
than voice *commands*, so this matters more here than it did in Cadence.

**Recording options are set explicitly on both platforms.** expo-audio
produces `.m4a` on iOS and either `.m4a` or `.3gp` on Android depending on
options; do not rely on defaults, and confirm the transcription provider
accepts the result.

**Audio retention is a user choice, per the brief's privacy principle.**
`audio_retained` defaults to true for 30 days, after which audio is purged
and the transcript kept. A transcript-only mode drops audio immediately
after transcription. Both settings are honoured server-side at write time,
not enforced by hiding a button in the UI.

### ENDPOINTS

`POST /notes/voice` · `POST /notes/text` · `GET /notes` · `GET /notes/{id}` · `DELETE /notes/{id}`

### WHAT BREAKS

**A missing iOS permission string crashes rather than prompts.**
`NSMicrophoneUsageDescription` must be in the app config; the failure mode
gives no useful error.

**Long recordings.** A command is four seconds; a note can be four
minutes. Chunked upload above a size threshold, a hard cap on duration
with a visible countdown, and a transcription provider selected on its
long-form pricing as well as its short-clip latency.

**Transcription errors compound silently.** A misheard proper noun becomes
a wrong title *and* a bad embedding, so it fails twice — once at capture,
once at retrieval. Surfacing the transcript converts the first into a
correctable error; editing a transcript must re-embed the note, or
retrieval keeps answering from the mistake.

**Recording while offline.** The clip is queued locally with its
idempotency key and uploaded on reconnect. The note appears immediately in
the UI as "transcribing" — never as a silent no-op.

### DONE WHEN

Speaking a thought on a physical device shows a transcript in under two
seconds and an action card in under four, the note remains findable after
the action is confirmed or discarded, and a note recorded in airplane mode
transcribes on reconnect.

---

## 8. Feature: voice retrieval

*The genuinely new surface. Cadence had `intent: query` as an enum value
and nothing behind it.*

### WHAT IT DOES

Lets the user ask a question out loud — "what did I say about the kitchen
cabinets?", "what's on my plate Thursday?", "when did I last speak to my
sister about the house?" — and get a grounded answer with its sources.

### HOW IT WORKS

**Two query classes, routed differently. This is the central design
decision of the feature.**

The intent parser (§10) gains a `query_kind` discriminator:

| `query_kind` | Resolved by | Example |
| --- | --- | --- |
| `structured` | A generated **filter**, executed against Postgres | "What's due Thursday?", "What's overdue in Home?", "How many open things in Work?" |
| `semantic` | **Hybrid search** over notes | "What did I say about the remodel budget?" |
| `mixed` | Both, merged | "What do I still owe my sister about the house?" |

**Structured queries never go through retrieval.** The model emits a
filter — date range, domain, status, priority — the backend executes it,
and the answer is rendered from the returned rows. The model does not
count, does not summarise totals, and does not decide what matched. If the
model is allowed to answer "you have four things due Thursday" from
memory of a retrieved blob, it will eventually say five, and a dashboard
that miscounts your obligations is worse than no dashboard.

**Semantic queries use hybrid search, not pure vector similarity.**
pgvector cosine similarity over `Note.embedding`, unioned with Postgres
full-text search over `Note.tsv`, fused by reciprocal rank. Embeddings are
mediocre at exact proper nouns — and personal notes are *full* of proper
nouns ("Kraftmaid", "Dr. Alvarez", "the Henderson thing"). Lexical search
catches precisely what vectors miss here.

**Retrieval is always scoped to the asking user, in SQL, in the same
statement as the similarity clause** — never as a post-filter on results.
This is the one line of this feature where a bug is a data breach.

**Every answer cites its sources.** The response returns the composed
answer *plus* the note and commitment records it drew on, rendered as
tappable cards with their capture dates. An unsourced spoken answer about
your own life is unfalsifiable — the user cannot tell recall from
invention, which is exactly the trust failure the brief's "trustworthy"
principle exists to prevent.

**Answer composition is grounded and refuses cleanly.** The model receives
only the retrieved records and is instructed to answer from them alone. If
they do not contain the answer, the correct output is "nothing captured
about that" — and the evaluation set (§14) must contain questions whose
answer is exactly that, or the model will learn to always produce
something.

**Voice in, text and cards out.** v1 returns a written answer and result
cards, not synthesised speech. Reading an answer is faster than hearing
it, TTS adds latency and cost to every query, and the failure mode of a
spoken wrong answer is worse — there is nothing to re-read. Spoken output
is an open question for the client (§17), not a silent omission.

### ENDPOINTS

`POST /assistant/query` (text) · `POST /assistant/voice` (audio; routes to
capture or query by parsed intent)

### WHAT BREAKS

**Prompt injection through the user's own content.** Cadence §6 flagged
this for calendar titles; retrieval widens it considerably, because notes
may contain pasted text from email, web pages or documents. Retrieved
content is passed as structurally separated data, never concatenated into
the instruction block, and **retrieval output never triggers execution** —
an answer can propose an action, which then goes through the ordinary
risk-tier path in §11 like any other.

**Stale embeddings.** Editing a transcript without re-embedding leaves
retrieval answering from the old text. Re-embed on transcript write, and
carry an `embedding_version` so a provider or model change can be
backfilled rather than silently mixed.

**Recency versus similarity.** "What did I say about the cabinets" almost
always means the *most recent* thing, but pure similarity is
time-blind and will happily surface a note from March. Apply a recency
weight in the fusion step, and always show capture dates on the cards so a
wrong ordering is visible rather than invisible.

**The empty-corpus cold start.** In week one there is nothing to retrieve,
and a confident empty answer reads as broken. Below a corpus threshold,
say so plainly: "Nothing captured about that yet."

### DONE WHEN

The evaluation set (§14) reports a retrieval hit rate and a groundedness
figure you would be willing to state publicly; a structured question
returns a count that matches the database exactly; and no question can
return another user's records.

---

## 9. Feature: life domains and the policy engine

Carried from Cadence §5 substantially unchanged — `policy_json`,
`validate_placement()`, JSONB so new dimensions need no migration, policy
evaluated in the user's local zone with a single conversion at the top of
the function.

**What the pivot changes:** policy now governs commitments as well as
calendar writes, and a domain without an attached `Account` is no longer
invalid — it simply cannot produce calendar events. A Hobbies domain that
never writes to Google is a perfectly ordinary configuration in a
dashboard, where it was a misconfiguration in a calendar assistant.
Validate "has an account" at the point of a calendar write, not at domain
creation.

### DONE WHEN

Proposing a Work event at 7am is rejected with a legible reason and a
suggested alternative slot; a domain with no calendar account can still
hold commitments and notes.

---

## 10. Feature: natural-language intent parsing

Carried from Cadence §6, which remains the correct design. Structured
output via tool-use rather than free-text JSON; current datetime and the
user's IANA zone injected into every prompt; every returned timestamp
validated as untrusted input; the model classifies intent and never risk.

**Extended tool schema:**

```
Tool: extract_intent
  intent: enum[create_commitment, create_event, reschedule, cancel,
               block_time, capture_note, query, unknown]
  query_kind: enum[structured, semantic, mixed] | null   # new, §8
  filter: {date_from, date_to, domain, status, priority} | null   # new
  domain: string
  title: string
  start: ISO8601 with offset | null
  duration_min: int | null
  confidence: float
  needs_clarification: bool
  clarifying_question: string | null
```

**Two additions worth naming.** `create_commitment` is now the default
intent for most captures — `create_event` is the exception, chosen only
when the user says something time-boxed and calendar-shaped. And a
capture that parses to `unknown` is no longer an error path: it becomes a
note in the Inbox, which is a genuinely useful outcome rather than a
failure (§6).

### WHAT BREAKS

As Cadence §6 — hallucinated fields, injection via content, silent
regression on prompt changes — plus one the new schema introduces:
**over-eager `query` classification.** "Remind me what I owe the
contractor" is a query; "remind me to pay the contractor" is a capture.
The evaluation set must contain both phrasings adjacently, or the router
will collapse them.

### DONE WHEN

The evaluation script reports an accuracy figure you would be willing to
state publicly, with capture-versus-query routing broken out separately.

---

## 11. Feature: the action queue and risk tiers

Carried from Cadence §8 in full, including the lifecycle
(`draft → proposed → confirmed → executed ↘ rejected`), the hardcoded
server-side tier lookup keyed on action type, `diff_text` generated by
application code rather than by the model, and re-validation against
policy at execution time.

**The tier table extends to dashboard-native actions:**

| Tier | Handling | Action types |
| --- | --- | --- |
| 0 | Executes immediately, appears in digest | `create_commitment`, `capture_note`, `classify_domain`, `block_focus_time`, `add_travel_buffer` |
| 1 | Executes, notifies with one-tap undo | `reschedule_commitment`, `complete_commitment`, `archive_note`, `move_own_private`, `create_from_email` |
| 2 | Staged, waits for approval | `create_event`, `reschedule_external`, `book_appointment` |
| 3 | Staged, never promotable | `cancel_event`, `hard_delete`, anything with a fee |

**The principle that sorts the table: third-party visibility and
reversibility — never how much the user dislikes the chore.** Creating a
commitment in the user's own dashboard is invisible to everyone else and
trivially undone, so it is Tier 0. Creating a calendar event other people
can see is neither, so it stays Tier 2 exactly as Cadence had it. The
dashboard pivot adds a lot of Tier 0 surface precisely because internal
state is cheap to get wrong.

**A design consequence worth stating explicitly:** make deletes soft.
A `hard_delete` is Tier 3 because it is irreversible — but a delete that
lands in a recoverable trash is reversible, and therefore Tier 1. The tier
table should push the design toward reversibility, not merely classify
whatever the design happens to produce.

### DONE WHEN

A Tier 2 request waits for confirmation, a Tier 0 request executes without
asking, and no input path — typed, spoken, swept or retrieved — can cause
a Tier 2 or Tier 3 action type to be handled as Tier 0.

---

## 12. Feature: calendar sync

Carried from Cadence §4 mechanically unchanged, and every failure mode
documented there still applies verbatim: request `access_type=offline`
with `prompt=consent` so the refresh token is always issued; catch `410
Gone` specifically and trigger a full resync; handle all three response
shapes (`start.dateTime`, `start.date`, `status: "cancelled"`); single
choke point for token refresh; conditional writes with `etag`;
client-generated `idempotency_key` on every create.

**What the pivot changes is position, not mechanics.** Google is no longer
the system of record — Ballast's Postgres is. Sync is bidirectional
mirroring into `Event`, and events surface on the dashboard through §5's
deduplication rule. A user who never connects Google gets a fully
functional dashboard, which was not true of Cadence.

`calendar.events` remains a restricted scope: testing mode permits 100
users with no review, which covers the first release and any demo, but
public distribution requires a security assessment. Known, not discovered.

---

## 13. Feature: the proactive daily sweep

Carried from Cadence §10 — one APScheduler job per user, at a user-chosen
time, producing `Action` rows with `origin = "sweep"` that follow ordinary
tier rules. The failure mode is still volume, not accuracy: one sweep per
day, in-app, no push notifications until the accept rate earns them, and
if that rate sits below roughly 30% the suggestions are wrong and
reducing frequency will not fix it.

**What the sweep does in a dashboard**, beyond Cadence's conflict and
deadline checks:

- Promotes Inbox items that have sat undated for more than a few days into
  a "these are still waiting" prompt in Review.
- Feeds the weekly neglected-domain callout (§5.1) — the sweep is what
  makes the dashboard argue for the user's long-term goals rather than
  just displaying them.
- Recomputes priority as due dates approach, skipping anything with
  `classified_by = user`.

### 13.3 Offline capture

**This overturns Cadence §13's deferral of offline mode, deliberately.**

Reads may be stale offline; **captures may not fail.** An `expo-sqlite`
outbox holds captures — text, and queued audio clips — each with a
client-generated idempotency key, replayed on reconnect through the same
endpoints. The UI renders the local record immediately with a pending
marker.

The justification is that the brief's central promise is capture in under
fifteen seconds from anywhere, and the moments a person most needs to
offload a commitment — a lift, a train, a parking garage — are
disproportionately the moments with no signal. A capture path that fails
there does not degrade the product; it falsifies its main claim.

Everything else stays deferred: offline *editing* and offline retrieval
are not in v1, and the UI says so plainly rather than failing obscurely.

---

## 14. Cross-cutting concerns

**Secrets.** `.gitignore` from the first commit. No key, token or client
secret reaches the mobile binary. A committed secret is rotated, not
deleted — removing the commit is not sufficient.

**Privacy, which is now a feature and not only a policy.** The brief lists
user control of personal data as a product principle, and voice notes
raise the stakes: this is a recording of the user's actual voice
discussing their family and finances. Three commitments, each enforced
server-side: audio retention is user-configurable with a default expiry
(§7); export produces everything — commitments, notes, transcripts,
audio — in one archive; delete means delete, including from object
storage and the embedding index, not just a hidden row.

**Error surfacing.** Policy violations, sync conflicts, transcription
failures, empty retrievals and execution errors each get a specific
user-facing message. A generic "something went wrong" in an app holding
your obligations trains users to distrust it, which is fatal here in a way
it is not in most products.

**Observability.** Log every action state transition with its tier and
origin, and log every retrieval with its query kind, source count and
latency. When something unexpected lands on a calendar or an answer looks
invented, these logs are the only way to reconstruct why.

---

## 15. Testing strategy

Coverage targets remain unhelpful. Four things are worth testing properly
— Cadence's three, plus one the new surface requires.

1. **The intent evaluation set** — at least 30 real phrasings, written
   before the prompt, run as a script that prints an accuracy percentage.
   Coverage must include absolute dates, relative dates, vague times,
   explicit durations, domain inference, reschedules, cancellations,
   deliberately ambiguous input that should trigger a question, garbage
   that should fail cleanly, and — new — capture-versus-query pairs that
   differ by one word.
2. **The retrieval evaluation set** — at least 30 questions over a fixed
   note corpus, each with its expected source note. Two numbers, tracked
   separately: **retrieval hit rate** (was the right note in the top-k)
   and **groundedness** (did the answer assert only what the sources
   support). Include questions with no answer in the corpus; an
   evaluation set where everything is answerable teaches the model to
   never say "nothing captured about that".
3. **Timezone and all-day conversions** — a handful of cases including a
   DST boundary and an all-day event at a month edge.
4. **Risk tier assignment** — that no input path, including a spoken
   query whose answer proposes an action, can produce a Tier 0
   classification for a Tier 2 or Tier 3 action type. A safety test, not a
   correctness test.

Everything else surfaces through daily use.

---

## 16. Build order

Unlike the feature sections, this one is a schedule. The ordering
principle is that each stage is independently demonstrable to the client.

| Stage | Contents | Demonstrates |
| --- | --- | --- |
| 1 | FastAPI + Postgres + auth; `Domain`, `Commitment`, `Project`; text capture with the heuristic parser ported from `app/` | The dashboard works end to end without any model spend |
| 2 | Expo shell, expo-router, the five screens built to the `app/` reference, TanStack Query, offline outbox | The real product on a real phone |
| 3 | LLM intent parsing (§10) + evaluation set; the confirmation card | Classification quality as a number |
| 4 | Voice notes (§7) — recording, transcription, two-response flow, retention | The capture experience the client asked for |
| 5 | Voice retrieval (§8) — hybrid search, routing, citations, evaluation set | The retrieval experience, with a quality number |
| 6 | Action queue + risk tiers (§11), then Google sync (§12) | Safe writes, then external writes |
| 7 | Daily sweep (§13), Review's neglected-domain callout | The app earns its place proactively |

Stage 1 deliberately reuses the heuristic parser already written in
`app/app.js` rather than starting with an LLM. It is free, deterministic,
and it makes the whole dashboard demonstrable before any prompt exists —
and it becomes the fallback path when the model is slow or unavailable.

---

## 17. Deferred

Listed so their absence reads as a decision.

| Deferred | Why |
| --- | --- |
| Spoken answers (TTS) | Reading is faster; adds latency and cost to every query; a spoken wrong answer cannot be re-read. Revisit once retrieval quality is measured — see §18 |
| Offline editing and offline retrieval | Capture is the promise; the rest can wait for network |
| Email-mediated rescheduling | Still the most valuable next feature; needs reliable reply parsing first |
| Outbound calls, browser agents | Demos well, breaks constantly, fails silently |
| Recurring series editing (Google RRULE) | Multi-day feature disguised as a checkbox. Ballast's own `recurrence_json` is in v1; editing Google's series is not |
| Multiple accounts per user | Schema supports it; UI and write routing do not |
| Teams, sharing, multi-user | Out of scope for a single-user product |
| Push notifications | Withheld until suggestion quality justifies an interruption |
| Habits, streaks, scoring | The brief asks for calm; gamification is the opposite of the product |

---

## 18. Open questions for the client

1. **Spoken answers.** Voice in, text out is the v1 recommendation above.
   Does the client expect the app to *talk back* — and if so, is that a
   hands-free/driving scenario, which changes the whole interaction model,
   or a preference?
2. **Audio retention default.** 30 days is proposed. Is retaining the
   original audio valuable to him at all, or is the transcript the
   artifact and the recording an unnecessary liability?
3. **Calendar in v1.** Google sync is stage 6 here. Is a dashboard without
   calendar sync demonstrable to him, or is seeing his real calendar the
   thing that makes it feel real?
4. **Whose commitments.** The brief and Cadence are both explicitly
   single-user. "Keep him on top of everything" often turns out to include
   things he has delegated to other people. Worth asking directly, because
   the answer changes the data model and it is much cheaper to know now.
5. **Domain inference, learned or prompted.** Carried from Cadence §14.
   `classified_by` (§4) now captures the corrections needed to answer it
   with data rather than opinion.
6. **Transcription provider**, on measured latency for both 3–8 second
   clips and multi-minute notes, rather than published benchmarks.
