# Architecture

DailyOS is a frontend-only, local-first PWA. The browser is the whole system: there is no server,
account, or sync in the MVP. A future HTTP API will be described in `API_CONTRACT.md`. The
current app never calls it.

## Layers

```
features/*  components/*  app/*      React UI: rendering and user interaction only
        │
        ▼
services/*  db/repositories/*         typed operations, validation, transactions, aggregation
        │
        ▼
db/database.ts  db/schema.ts          Dexie instance and versioned IndexedDB schema
lib/*                                 pure helpers (dates, validation) usable by every layer
```

- **UI never touches IndexedDB directly.** An ESLint `no-restricted-imports` rule blocks `dexie`,
  `@/db/database`, and `@/db/schema` imports from `src/app`, `src/components`, and `src/features`.
- **Writes** go through repository functions (`src/db/repositories/*`). Each validates input with
  Zod, runs related writes in one Dexie transaction, and throws an `AppError` with a `kind`
  (`validation`, `not_found`, `invalid_operation`, `conflict`, `quota`, `unavailable`, `version`,
  `unknown`) and field-level issues for forms.
- **Reads** are plain async functions that the UI subscribes to with `useLiveData`, built on
  Dexie `liveQuery`. They re-run automatically when the data they read changes, including
  writes from other tabs.

### Live-query pitfall

Dexie tracks what a live query reads through an async context. That context is lost if a
read awaits nested native `async` helpers and then reads again, so the query silently stops
updating. Read functions therefore call Dexie directly, without wrappers, and take values like
`today` as parameters instead of looking them up. `tests/db/live.test.ts` subscribes to every
read used by the UI and fails if any of them stops re-emitting after a write.

## Source layout

| Path             | Contents                                                    |
| ---------------- | ----------------------------------------------------------- |
| `src/app`        | Router, app shell, route-level error and not-found screens  |
| `src/components` | Shared presentational components                            |
| `src/features/*` | One folder per product area (dashboard, tasks, learning, …) |
| `src/hooks`      | Reusable React hooks                                        |
| `src/lib`        | Pure, framework-free helpers                                |
| `src/styles`     | Design tokens, global styles, component styles              |
| `tests`          | Vitest + React Testing Library tests, mirroring `src`       |

## Data model (current)

| Store        | Purpose                                       | Notable indexes                   |
| ------------ | --------------------------------------------- | --------------------------------- |
| `tasks`      | Current state of each task                    | `status`, `dueDate`               |
| `taskEvents` | Append-only task history                      | `taskId`, `localDate`, `type`     |
| `dailyPlans` | One plan per local date                       | `&date` (unique)                  |
| `planItems`  | A task placed on a day, with frozen snapshots | `planId`, `date`, `[taskId+date]` |
| `settings`   | Single `app` record: time zone, week start    |                                   |

The schema is versioned in `src/db/schema.ts`. Versions are append-only, and each new version
lists only the stores it changes.

### Task history and plans

- **Status changes are actions** (`start`, `complete`, `cancel`, `reopen`) with an explicit
  transition table. Each action updates the task and appends a `TaskEvent` carrying `fromStatus`
  and `toStatus` in one transaction, so a status can't change without a history entry.
- **Events are the history.** A task's status at the end of any past day is rebuilt from its
  events (`statusAtEndOf`). Plan outcomes (`done`, `cancelled`, `rescheduled`, `not_done`,
  `open`) are derived on read, never stored. Reopening a task next week therefore can't change
  last week's results.
- **Plan items are never deleted.**
  - Unplanning sets `removedAt`.
  - Rescheduling sets `rescheduledTo` on the original item and adds a new item on the target day.
  - Snapshot fields (`titleSnapshot`, `prioritySnapshot`, `plannedMinutes`) freeze what was
    planned.
  - Past plans can't be edited at all.
- **Unfinished work** (open tasks whose latest plan is before today) is shown on Today with a
  "Move to today" action. It is never moved automatically.
- **Archiving vs deleting:** tasks are archived, not deleted, because plans and history refer
  to them. Archived tasks are hidden from lists and can be restored.

## Dates and time

- A **date key** (`YYYY-MM-DD`) identifies a local calendar day. It is always derived from an
  instant plus an explicit IANA time zone (`toLocalDateKey`), so "today" matches the user's wall
  calendar regardless of UTC offset.
- **Event timestamps** are ISO-8601 instants.
- Calendar arithmetic operates on date keys, never by adding 24-hour multiples, because local
  days are 23 or 25 hours long across DST changes. DST and midnight boundaries are tested.
- The Today screen re-derives the date key every minute and whenever the page becomes visible,
  because installed PWAs are often resumed rather than reloaded across midnight.
- Milestone 1 uses the device time zone. A user preference arrives with Settings.

## Design system

- All colors, spacing, type sizes, radii, and shadows are CSS custom properties in
  `src/styles/tokens.css`. Components use tokens, not raw values.
- Forest green (`#2d5a3d`) on warm ivory (`#faf7f0`). Text contrast ratios are documented in the
  token file and exceed WCAG AA.
- Fonts are system stacks (an editorial serif for headings, the platform sans for body), so no
  font is fetched over the network and offline rendering matches online rendering.
- Mobile-first: a bottom tab bar that respects `env(safe-area-inset-*)` (`viewport-fit=cover`)
  becomes a left rail at ≥ 768px. Touch targets are at least 44px.

## Decisions

| Decision                   | Reason                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| React Router (data router) | Well-known, gives per-route error boundaries. Four screens plus Settings don't justify anything bigger |
| Vite 6 / Vitest 3          | The installed Node (20.12) predates Vite 7's minimum (20.19)                                           |
| ESLint 9                   | ESLint 10 needs Node 20.19 and `eslint-plugin-jsx-a11y` doesn't support it yet                         |
| No CSS framework           | A small token-based stylesheet keeps the bundle and dependency list small                              |
| Disabled controls + notice | Unbuilt functionality is shown as unavailable, never as working                                        |
