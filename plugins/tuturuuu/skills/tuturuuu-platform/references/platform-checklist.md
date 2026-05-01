# Tuturuuu Platform Checklist

Use this checklist before and after code changes in the current Tuturuuu platform checkout.

## Before Editing

- Read the task-local code and docs before proposing abstractions.
- Check for existing helpers in `packages/internal-api`, `packages/types`, `packages/ui`, and app-local utilities.
- Identify whether the change affects user-facing copy, route navigation, database schema, generated types, docs, or mobile localization.

## Web And Shared Code

- Server Components are the default. Add `'use client'` only for state, effects that are not data fetching, browser APIs, or interactivity.
- Client data fetching and mutation must use TanStack Query.
- Any `fetch` inside a query function should include `{ cache: 'no-store' }`.
- Shared UI or client code should call `packages/internal-api/src/*` helpers for app APIs instead of scattering raw route calls.
- Use `@tuturuuu/icons` for UI icons.
- Use `@tuturuuu/ui/dialog` instead of native browser dialogs.
- Use dynamic color tokens instead of hard-coded Tailwind color classes.

## Translations And Navigation

- Add user-facing strings to both English and Vietnamese bundles.
- Keep shared UI translation keys present in every app-level bundle that ships that shared UI.
- Run `bun i18n:sort` after editing message JSON.
- Add new dashboard routes to the relevant `navigation.tsx` aliases, children, icons, and permissions.

## Database And Types

- Prepare migrations but do not push production Supabase changes.
- Prefer additive migrations and runtime fallbacks when rollout order can vary.
- After schema changes, apply local migrations before `bun sb:typegen` when possible.
- Prefer importing shared DB row aliases from `@tuturuuu/types/db`.
- Do not hand-edit generated type files.

## Completion

- Format touched files with the repo-preferred command.
- Run focused tests for changed behavior.
- Run `bun check` for TypeScript, JavaScript, root script, or repo config changes.
- Update `apps/docs` for durable workflow, deployment, architecture, debugging, or operations knowledge.
- Use Conventional Commit style if asked to commit.
