# DailyOS

The idea behind DailyOS is to create one personal operating system for how you plan, execute, learn, and improve. Instead of managing your tasks in one app, learning notes in another, and daily reflections somewhere else, you connect everything in one place.

An iPhone-first, local-first personal learning and execution system.

> Plan intentionally. Capture what you learn. Record what you do. Review honestly. Improve continuously.

DailyOS is a Progressive Web App built with React, TypeScript, and Vite. There is no backend.
Your records will live in your browser's IndexedDB, and you'll be able to export or restore them as JSON.

## Status

Tasks, daily planning (intention, top outcomes, planned tasks), habits, the learning journal, and daily/weekly/monthly reviews work and are saved locally. Screens that aren't built yet say
so explicitly.

| Milestone                         | Status      |
| --------------------------------- | ----------- |
| 1. Foundation                     | Done        |
| 2. Database and tasks             | Not started |
| 3. Habits and daily planning      | Not started |
| 4. Learning journal               | Not started |
| 5. Daily, weekly, monthly reviews | Not started |
| 6. Backup and PWA (offline)       | Not started |
| 7. Polish and release readiness   | Not started |

## Quick start

Requires Node.js ≥ 20.12 and pnpm 10.

```sh
pnpm install
pnpm dev        # http://localhost:5173
```

Run every check (the same set a milestone must pass):

```sh
pnpm check      # lint, format check, typecheck, tests, production build
```

See [documentation/DEVELOPMENT.md](documentation/DEVELOPMENT.md) for the full workflow and
[documentation/ARCHITECTURE.md](documentation/ARCHITECTURE.md) for design decisions.

## Privacy

DailyOS makes no network requests for your data. Everything stays on the device you use.
Clearing your browser's site data removes it, so you should export backups regularly once export
is available (Milestone 6).
