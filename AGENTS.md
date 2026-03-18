# AGENTS.md

## Purpose

- This file guides agentic coding agents working in this repo.
- Follow repo conventions and the Cursor rules summarized below.

## Project Overview

- Vite + TypeScript (ESM) single-page editor.
- Entry: src/js/main.ts
- Modules: src/js/\*.ts
- Styles: src/styles/main.css
- Uses CodeMirror, Marked, Highlight.js.

## Commands (Prefer Docker)

### Docker (Recommended)

- Start dev server: `docker compose up -d`
- Rebuild dev server: `docker compose up -d --build`
- Stop services: `docker compose down`
- View logs: `docker compose logs -f`
- Shell inside container: `docker compose exec app sh`
- Dev server (inside container): `docker compose exec app npm run dev -- --host 0.0.0.0`
- Build (inside container): `docker compose exec app npm run build`
- Preview (inside container): `docker compose exec app npm run preview`
- Lint (inside container): `docker compose exec app npm run lint`
- Format (inside container): `docker compose exec app npm run format`

### Local (Only When Allowed)

- Dev server: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`
- Lint: `npm run lint`
- Format: `npm run format`

### Tests

- No test runner configured (no test script or test files).
- Single test: not available until a test framework is added.
- If you add tests, update this file with exact commands.

### Typecheck

- Build runs `tsc && vite build`.
- Standalone typecheck: `npx tsc -p tsconfig.json` (inside container).

## Cursor Rules (Always Apply)

### Build Verification (.cursor/rules/build.mdc)

- After any code change, run `docker compose up -d --build`.
- Build must succeed before confirming changes.
- Skip only for docs-only or comment-only changes.
- If build fails, fix and rerun until it passes.

### Dependency Management (.cursor/rules/development.mdc)

- Do NOT run `npm install` on the host.
- Run installs inside container: `docker compose exec app npm install`.
- Keep dependency changes aligned with container builds.

### Commit Messages (.cursor/rules/commit.mdc)

- Use Conventional Commits: `<type>(<scope>): <subject>`.
- Prefer title-only; add body only for complex changes.
- Subject is imperative, no trailing period, 50-72 chars.
- Commit via file: `git commit -F .commit-message`.
- Write `.commit-message` with file tools, then delete it.

## Code Style and Conventions

### Language / TypeScript

- TypeScript is strict; avoid `any`.
- Use explicit return types for exported functions.
- Prefer `type` for unions and `interface` for object shapes.
- Use `const` by default; `let` only when reassigned.
- Keep functions small with early returns for guard checks.
- Use `async/await`; return typed result objects when possible.

### Imports

- ESM only.
- Use explicit `.js` extension in relative imports.
- Group imports: external -> internal -> styles/types.
- Use `import type { ... }` for type-only imports.
- Avoid unused imports (tsconfig noUnusedLocals).

### Formatting (Prettier)

- 2-space indent, single quotes, semicolons.
- Trailing commas where valid (es5).
- Max line width 100.
- Arrow parens only when needed.

### Linting (ESLint)

- `no-console` warns (allow warn/error). Prefer `logger`.
- Follow `eslint:recommended` + `@typescript-eslint/recommended`.

### Naming

- camelCase for variables/functions.
- PascalCase for types/classes.
- UPPER_SNAKE for module-level constants.
- CSS class names use kebab-case.

### Error Handling

- Guard against missing DOM nodes; return early on null.
- Wrap network/storage access in try/catch.
- Prefer structured results (`{ ok, data, error }`).
- Log via `logger.error` / `logger.warn`.

### DOM / Events

- Use `getElementById` / `querySelector` with null checks.
- Cast with `as Type | null` when needed.
- Use event delegation for dynamic content.
- Use `void` for intentionally unhandled Promises.

### CSS

- Keep tokens in `:root` variables.
- Use state classes: `.active`, `.collapsed`, `.expanded`.
- Respect `prefers-reduced-motion` when adding animations.

## Repo Layout

- Entry: `src/js/main.ts`
- Editor logic: `src/js/editor.ts`
- Markdown parsing/rendering: `src/js/parser.ts`, `src/js/renderer.ts`
- GitHub storage: `src/js/githubClient.ts`, `src/js/githubConfig.ts`
- Local storage: `src/js/storage.ts`
- Logger: `src/js/logger.ts`
- Styles: `src/styles/main.css`
- Types: `src/types/*.d.ts`
- Config: `vite.config.ts`, `.eslintrc.json`, `.prettierrc`

## Operational Notes

- App version is generated from git in `vite.config.ts`.
- Docker image installs git to enable version generation.
- Dev server port is controlled by `PORT` (default random if unset).
- Docker maps host 25952 -> container 5173 (see docker-compose.yml).
- Base path is `/vulncycle/` (see Vite config).

## When Updating This Repo

- After code changes, run the build verification rule.
- After config or dependency updates, rebuild the container.
- Keep AGENTS.md up to date when adding tests or tooling.
