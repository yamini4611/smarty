# Ballast mock backend

A stand-in for the real API, written against Node's standard library only — no
`npm install`, no `package.json`, nothing to build.

```
node mock-api/server.js          # http://localhost:4000
node mock-api/server.js 5000     # or pick a port
```

It prints a `localhost` address for this computer and a LAN address you can
open on a phone on the same wifi, which is the honest way to look at a screen
designed at 390px.

State lives in `mock-api/data.json`, written on every change. Delete that file
(or `curl -X DELETE localhost:4000/api/state`) to put the demo back to the
seeded seventeen items in `seed.json`.

## What it serves

`GET /` returns `prototype/ballast.html` wrapped in an HTML document — the
prototype is authored to sit inside a skeleton supplied by its host, so the
server supplies the same one. The file is read per request, so editing the
prototype and reloading is enough; no restart.

## Endpoints

| | |
|---|---|
| `GET /api/health` | `{ ballast: true }` — how the page decides it has a backend |
| `GET /api/state` | everything: items, segments, settings, onboarding |
| `PUT /api/state` | replace it wholesale |
| `DELETE /api/state` | back to the seed |
| `GET /api/items` | the items alone |
| `POST /api/items` | add one; the id is assigned here |
| `PATCH /api/items/:id` | change fields — this is what ticking something off sends |
| `DELETE /api/items/:id` | remove one |
| `PUT /api/segments` | `{ segments: ["home", "wedding", ...] }` |
| `PUT /api/settings` | `{ settings: { brief: true, ... } }` |
| `POST /api/assistant/parse` | a sentence in, proposed items out |
| `POST /api/assistant/query` | a question in, an answer plus matching ids out |

```bash
curl localhost:4000/api/health

curl -X POST localhost:4000/api/assistant/parse \
  -H 'Content-Type: application/json' \
  -d '{"text":"pay the contractor £3,500 next Friday and book the florist tasting",
       "today":"2026-09-17","segments":["home","wedding","finance","invest","family"]}'

curl -X POST localhost:4000/api/assistant/query \
  -H 'Content-Type: application/json' \
  -d '{"text":"what payments do I have coming up?","today":"2026-09-17"}'
```

## The two halves of the assistant

`parse.js` stands in for the language model: text in, one proposal per clause
out, each carrying `segGuess` and `dateGuess` so the interface can show what
was inferred rather than presenting a guess as fact. In the real build this
file is replaced by a call to Claude with the same contract — the shape the
page consumes does not change.

The `query` half is deliberately *not* the model's job. Filtering, counting and
totalling happen in `server.js`, in code, over the actual records. The model
decides what is being asked; it never decides how many payments there are.

## Without the server

The page works on its own. At boot it probes `/api/health`; when nothing
answers — opened from a file, or from a shared link — it parses in the browser
and keeps state in `localStorage` instead. Same screens, same answers; the
state is per-browser, so everyone who opens a shared link gets their own run
through rather than editing a copy the others can see.
