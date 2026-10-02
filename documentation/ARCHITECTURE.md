# Architecture

DailyOS is a frontend-only, local-first PWA. The browser is the whole system: there is no server,
account, or sync in the MVP. A future HTTP API is described in [API_CONTRACT.md](API_CONTRACT.md). The
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

### Habits

- **Schedules:** `daily`, `selected_days` (chosen weekdays), and `weekly` (once per week, any
  day counts; the week start comes from settings).
- **Entries:** at most one status (`completed`, `skipped`, `missed`) per habit per date. A
  unique compound index enforces this, and writes upsert inside a transaction. Clearing a
  status deletes the entry.
- **Occurrences are derived, never stored.** A past occurrence without an entry counts as
  missed. Today's (or this week's) is _pending_, not a failure. Future occurrences aren't
  eligible yet.
- **Skipping is neutral.** Completion rate is `completed / (completed + missed)`. Streaks count
  consecutive completed occurrences: skipped ones neither extend nor break a streak, and a
  pending one today doesn't break it.
- **Counted in occurrences and calendar dates**, never in 24-hour periods. Weekly occurrences
  belong to the range containing the first day of their week, so adjacent weekly or monthly
  ranges never count a week twice.
- **Ending a habit** sets `archivedOn`. It stops counting from that date and its history stays.
  Ending is permanent, because resuming would make the gap look like missed days.
- **Known limitation:** editing a habit's schedule re-evaluates its past occurrences under the
  new schedule. Entries themselves are never changed.

### Learning journal

- **Quick captures need one sentence.** The title is optional and falls back to the first line.
  An entry's `format` is derived: filling any structured field (explanation, example,
  questions, application, source) makes it `structured`.
- **Topics** are free text, whitespace-normalized, and matched case- and accent-insensitively.
- **Search runs in memory** over all entries: every term must appear in some field. A
  personal journal stays in the thousands of entries, where scanning is fast and avoids
  maintaining a full-text index in IndexedDB.
- **Review dates** are a list of `{ date, completedAt? }`. Entries due on or before today show
  under "Due for review" until each date is ticked off. Editing an entry keeps the completion
  state of review dates that stay scheduled.
- **Related tasks** are validated on save. A multi-entry index lets a task list the entries
  that reference it.
- **Archive vs delete:** archived entries leave lists and search but can be restored. Delete is
  permanent and asks for confirmation. Nothing else references learning entries, so deleting
  one can't break other records.

### Reviews and summaries

- **One review per period.** A unique `[periodType+periodStart]` index plus an upsert in one
  transaction prevents duplicates. Route params are normalized to the real period start (any
  date in a week opens that week's review). Periods that haven't started can't be reviewed.
- **Summaries are computed, never stored** (`services/analytics.service.ts`). One flat loader
  reads the records for a range, and pure functions compute:
  - **Daily: planned vs. actual.** Each planned item's outcome comes from task history, plus
    tasks completed without being planned, top outcomes, habit statuses, and learning
    captured that day.
  - **Weekly and monthly:**
    - Tasks completed: distinct tasks with a completion in the range that were still done at
      its end.
    - Plan kept: `done / (done + not done + open)`; rescheduled and cancelled items are excluded.
    - Habit consistency, learning topics, and average daily rating.
    - Recurring blockers from daily reviews and reschedule notes, grouped ignoring case,
      accents, bullets, and punctuation.
  - **Month view:** a week-by-week table, with each week clipped to the month so the weeks add
    up to the month.
- **Historical integrity:** summaries use plan snapshots and rebuilt past statuses. Editing,
  reopening, or rescheduling a task later doesn't change an earlier summary (tested).
- **Carry-forward without copies:**
  - Open actions stay where they were created and show in later reviews ("Still open from
    earlier"), on the Review hub, and on Today until marked done.
  - An action can be turned into an inbox task, which is linked once.
  - Each review's "focus for next period" is shown at the top of the following review.
- **Editing a saved review:** the form remounts whenever the stored review or its actions
  change, so a later save never resurrects stale action ids or statuses.

### Daily plans

The intention and up to three top outcomes live on the day's `DailyPlan`, which is created on
first edit. Plans for today and later are editable. Yesterday's is too, as a grace period for a
late-night review. Older plans are read-only.

### Opening the database safely

`openWithVersionCheck` opens IndexedDB and runs pending migrations. If the stored schema is
newer than the code (the data was written by a newer app version), Dexie 4 would open it
anyway. Instead, DailyOS closes the connection and asks for a reload, leaving the data
untouched. Migration tests upgrade every earlier version to the current one with data in
place.

## Dates and time

- A **date key** (`YYYY-MM-DD`) identifies a local calendar day. It is always derived from an
  instant plus an explicit IANA time zone (`toLocalDateKey`), so "today" matches the user's wall
  calendar regardless of UTC offset.
- **Event timestamps** are ISO-8601 instants.
- Calendar arithmetic operates on date keys, never by adding 24-hour multiples, because local
  days are 23 or 25 hours long across DST changes. DST and midnight boundaries are tested.
- The Today screen re-derives the date key every minute and whenever the page becomes visible,
  because installed PWAs are often resumed rather than reloaded across midnight.
- The active time zone is the Settings preference, or the device zone when none is set. Each
  `DailyPlan` records the zone it was created in.

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
