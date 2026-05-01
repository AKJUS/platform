# CI And Docs Checklist

Use this checklist when changing CI, validators, docs, or repo automation.

## CI

- Inspect nearby workflows before adding a new one.
- Use `.github/workflows/ci-check.yml` when the workflow should respect the repo-level `tuturuuu.ts` switchboard.
- Add the workflow filename to `tuturuuu.ts`.
- Prefer `permissions: contents: read` for validation-only jobs.
- Prefer standard-library validators for plugin, docs, and repository metadata checks.
- Keep path-sensitive checks deterministic and run them from the repo root.

## Docs

- Add new docs pages to `apps/docs/docs.json`.
- Mention exact validator commands next to the system they validate.
- Document known local dependency requirements instead of hiding them in CI.
- Keep docs focused on operational behavior: what to run, where files live, what the check catches, and what to do when it fails.

## Verification

- Run changed validators locally.
- Parse touched JSON with `python3 -m json.tool`.
- Run `bun ff` on touched docs, scripts, config, and workflow files.
- Run `git diff --check`.
- Run `bun check` when root TypeScript config or repo-wide script/config behavior changed.
