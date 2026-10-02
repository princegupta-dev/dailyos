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
- `db/` and `services/` are created in Milestone 2, along with the first real data.

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
