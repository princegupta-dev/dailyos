# DailyOS

The idea behind DailyOS is to create one personal operating system for how you plan, execute, learn, and improve. Instead of managing your tasks in one app, learning notes in another, and daily reflections somewhere else, you connect everything in one place.

An iPhone-first, local-first personal learning and execution system.

> Plan intentionally. Capture what you learn. Record what you do. Review honestly. Improve continuously.

DailyOS is a Progressive Web App built with React, TypeScript, and Vite. There is no backend.
Your records live in your browser's IndexedDB, and you can download a JSON backup and restore it from Settings.

## Status

Tasks, daily planning (intention, top outcomes, planned tasks), habits, the learning journal, and daily/weekly/monthly reviews work and are saved locally. Screens that aren't built yet say
so explicitly.

| Milestone                         | Status      |
| --------------------------------- | ----------- |
| 1. Foundation                     | Done        |
| 2. Database and tasks             | Done        |
| 3. Habits and daily planning      | Done        |
| 4. Learning journal               | Done        |
| 5. Daily, weekly, monthly reviews | Done        |
| 6. Backup and PWA (offline)       | Done        |
| 7. Polish and release readiness   | Not started |

## Use it on your phone

DailyOS is published free on GitHub Pages at **https://princegupta-dev.github.io/dailyos/**.
Every push to `main` runs all checks and redeploys only if they pass
(`.github/workflows/deploy.yml`).

- **iPhone:** open the link in Safari → Share → **Add to Home Screen**, then always open DailyOS
  from that icon. It runs full screen and works offline.
- **Android:** open the link in Chrome → menu → **Install app**.

The home-screen app keeps its own storage, separate from the browser tab, and data never leaves
the device. To move data between devices or browsers, download a backup in Settings on one and
restore it on the other.

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
Clearing your browser's site data removes it, so download a backup regularly from
**Settings → Your data**. Restoring checks the whole file first and either adds only what's new or,
after confirmation, replaces everything.
