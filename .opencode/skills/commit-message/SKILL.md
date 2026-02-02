---
name: commit-message
description: Create Conventional Commit messages and commit safely: operate on staged changes only when present, otherwise stage the relevant set once and proceed.
---

# commit-message

## Description

- Generate Conventional Commit messages from staged changes and commit via a temp file (message + commit, not message-only).

## When to Use

- Staged changes need a commit message or atomicity guidance for this Vite/Frontend repo.

## Inputs

- Staged diff preferred; if nothing is staged, stage only the intended changes once.

## Repository Conventions

- Preferred types: feat, fix, docs, style, refactor, test, chore, build, ci (others allowed if fitting Conventional Commits).
- Scope follows top-level folder or feature: e.g., src, parser, renderer, editor, styles, completion, config, build, docs, deps; omit if none fits.
- Title highlights intent; imperative mood, no trailing period.

## Process

1. Check atomicity: avoid mixing unrelated areas (e.g., editor vs styles vs docker config). If mixed, request separate commits. Do not touch `node_modules`, `dist`, build artifacts.
2. Operate only on staged changes; if none, stage just the intended files once. Never auto-stage unrelated files. If `.env*` is staged, ask to unstage instead of committing.
3. Title format `<type>(<scope>): <subject>`; scope optional; subject imperative, no period, 50–72 chars.
4. Body optional; 1–3 short lines at 72 chars for intent/impact when useful; default to title-only. Keep commit message in English; any Chinese explanation is for user only.
5. Execution: ensure correct staged set → write draft to `.commit-message` → run `git commit -F .commit-message` → if success, delete the file; if hooks fail, report and keep the file.
6. Work only with staged content; never amend unless user requests.

## Examples

- `feat(editor): add anchor navigation for lifecycle stages`
- `fix(renderer): handle missing stage titles`
- `style(styles): refine timeline colors`
- `chore(config): adjust docker compose ports`
- Complex body: Title `fix(parser): handle empty markdown sections`; Body notes behavior (e.g., default section title, skip empty blocks, keep original order).

## Notes

- Preserve scope naming/formatting; prefer why/behavior over file lists.
- If nothing staged, stage the relevant files once before drafting.
- Enforce separate commits for different areas; handle one staged group per run.
