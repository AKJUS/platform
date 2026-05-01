---
name: tuturuuu-platform
description: Tuturuuu platform monorepo workflow guidance. Use when Codex works in /Users/vhpx/Documents/GitHub/platform or the tutur3u/platform repo, especially for apps/web Next.js changes, packages/* shared code, apps/database Supabase migrations, apps/docs documentation, translations, navigation, TanStack Query data fetching, repo verification, or Conventional Commit/branch follow-through.
---

# Tuturuuu Platform

## Core Workflow

Start by reading the nearest `AGENTS.md` instructions and any task-local docs before editing. Treat those instructions as authoritative for this checkout.

Map the request to the smallest owning surface:

- `apps/web`: Next.js App Router platform UI and API routes.
- `apps/mobile`: Flutter mobile app.
- `apps/database`: Supabase migrations, config, reset scripts, and pgTAP.
- `apps/docs`: Mintlify docs and team-facing operational guidance.
- `packages/*`: shared UI, types, internal API clients, auth, Supabase helpers, and utilities.

Prefer existing patterns over new abstractions. Search with `rg` before introducing new APIs, types, routes, or copy. If a user-facing change adds strings, update both English and Vietnamese translations in the relevant message files.

## Hard Rules

- Do not run `bun dev`, `bun run build`, `bun build`, `bun sb:push`, or `bun sb:linkpush` unless the user explicitly requests it.
- Do not manually edit `package.json` to add dependencies. Use the package manager command for the owning workspace.
- Do not use native browser dialogs, hard-coded Tailwind color classes, emojis in UI code, client-side raw `fetch('/api/...')`, or `useEffect` for data fetching.
- Use TanStack Query for client fetching and mutation. Put shared app API access behind `packages/internal-api/src/*`.
- For schema changes, apply local migrations before typegen when possible, then run `bun sb:typegen`. Prefer DB types from `@tuturuuu/types/db`.
- For route additions, update the relevant `navigation.tsx` aliases, children, icons, and permissions.
- For docs-worthy operational or architectural changes, update `apps/docs` in the same session and add new pages to `apps/docs/docs.json`.

## Implementation Notes

Read `references/platform-checklist.md` for the compact checklist before making code changes. Use it to catch translation, navigation, docs, and verification follow-through that are easy to miss.

Use the more focused plugin skills when they match the task:

- `$tuturuuu-database` for Supabase schema, RLS, API write, storage, or generated type changes.
- `$tuturuuu-ci-docs` for workflow files, validators, docs pages, and docs navigation.
- `$tuturuuu-mobile-task-board` for Flutter task-board date, routing, assignee, detail, or version bump work.

For web dashboard surfaces, default to thin server gates plus client shells backed by TanStack Query, `@tuturuuu/internal-api`, and `nuqs` when the UI needs search, sorting, pagination, explorer navigation, or frequent mutation.

For protected or authenticated app CRUD from client/shared UI code, add or extend API routes and internal-api helpers instead of reading Supabase directly from client components.

For shared data shapes reused beyond one callback, export them from `packages/types/src/db.ts` and consume them through `@tuturuuu/types`.

## Verification

Scope verification to the files and risk first, then follow repo requirements:

- Run formatters required for touched files before final checks.
- If TypeScript, JavaScript, or root scripts/config changed, finish with `bun check`.
- If messages changed, run `bun i18n:sort` before `bun check`.
- If Flutter localization ARB keys changed, run `flutter gen-l10n` before Flutter analysis or tests.
- If mobile Flutter tests collide on `build/unit_test_assets`, rerun the focused tests sequentially.

When the user asks for review, lead with findings and exact file/line references. When no issues are found, say that clearly and mention residual test gaps.
