# Development

## Requirements

- Node.js ≥ 20.12 (see `.nvmrc`). The project is pinned to Vite 6 and Vitest 3 because Vite 7+
  needs Node ≥ 20.19. Upgrading Node to 22 LTS lets us move to current Vite.
- pnpm 10. Commit `pnpm-lock.yaml` whenever dependencies change.

## Scripts

| Command             | Purpose                                                 |
| ------------------- | ------------------------------------------------------- |
| `pnpm dev`          | Start the Vite dev server                               |
| `pnpm build`        | Typecheck (project references) and production build     |
| `pnpm preview`      | Serve the production build locally                      |
| `pnpm typecheck`    | Strict TypeScript check without emitting                |
| `pnpm lint`         | ESLint (type-aware, React hooks, jsx-a11y)              |
| `pnpm format`       | Format with Prettier                                    |
| `pnpm format:check` | Verify formatting                                       |
| `pnpm test`         | Run Vitest once                                         |
| `pnpm test:watch`   | Vitest in watch mode                                    |
| `pnpm check`        | All of the above in sequence. Must pass before a commit |

## Testing on a phone

Run `pnpm dev --host` and open the printed network URL on a device on the same Wi-Fi network.
Service workers and some storage APIs need a secure context. Plain-HTTP LAN URLs are fine for
layout checks, but offline behavior must be tested over HTTPS or on `localhost` (Milestone 6).

## Git workflow

- `main` is the default branch. Each milestone is developed on its own `feature/dailyos-*` branch.
- Run `pnpm check` and review `git diff` before committing. Use conventional commit messages.
- Never commit `.env*` files, `node_modules/`, `dist/`, or personal data exports.
- No force-pushes, and no merging into `main` without review.

## Conventions

- Import from `src` with the `@/` alias.
- Domain logic (dates, validation, aggregation) lives in `src/lib` and `src/services`, outside
  React components, so it can be unit-tested directly.
- UI code may not import `dexie`, `@/db/database`, or `@/db/schema`. ESLint enforces this.
