---
name: tuturuuu-cli
description: Tuturuuu CLI workflow guidance. Use when installing, verifying, publishing, debugging, or using the `ttr` or `tuturuuu` CLI for browser login, copy-token login, workspace discovery, task listing, task mutation, compact task output, or autonomous agent workflows.
---

# Tuturuuu CLI

## Core Workflow

Use this skill when a task involves the native Tuturuuu CLI package published as
`tuturuuu` and invoked primarily as `ttr`.

Before changing CLI code, inspect the owning surfaces:

- `packages/sdk/src/cli/*` for command parsing, login, config, rendering, and update checks.
- `packages/sdk/src/platform.ts` for authenticated user-client helpers.
- `packages/internal-api/src/*` for shared route helpers used by the CLI.
- `apps/web/src/app/api/cli/auth/*` for browser login and token exchange.
- `apps/docs/reference/packages/sdk.mdx` and `packages/sdk/README.md` for durable usage documentation.

## Install Or Repair The CLI

Prefer using an existing `bun` on `PATH`. If `bun` is missing and the user asks
for autonomous installation, install Bun with the platform-native command:

- macOS/Linux: `curl -fsSL https://bun.sh/install | bash`
- Windows: `powershell -c "irm bun.sh/install.ps1 | iex"`

Then install or update the CLI:

```bash
bun i -g tuturuuu
```

After installation, verify the command path with:

```bash
ttr help
```

Inside the Tuturuuu monorepo root, `bun ttr ...` runs the local workspace
script. Outside the repo or after global installation, use `ttr ...` directly.
Do not diagnose `bun ttr login` as a registry install problem; Bun treats that
form as a package script lookup.

## Login UX

Use `ttr login` for browser login. It should:

- open a browser to the web auth start route
- create a dedicated Supabase session labeled `Tuturuuu CLI`
- show account email in the terminal and browser confirmation when available
- store config in the OS app config directory, or `TUTURUUU_CONFIG` when set
- select `personal` as the default workspace after login and whenever no
  workspace has been selected

Use `ttr login --copy` for headless environments. The web copy-token page should
render a browser-friendly token page, while JSON clients may request the token
with `Accept: application/json`.

## Keyboard Selection

The CLI should support keyboard selection for human terminal workflows. Omit an
id from `use`, `get`, `update`, `delete`, or `move` commands to choose with
up/down or `j`/`k`, then space/enter. Escape or `q` cancels.

Keep selection disabled for `--json` and non-TTY sessions so agent scripts get a
clear error instead of mixed prompt output.

Persist selected workspace, board, list, task, label, and project IDs in the CLI
config so repeated commands can use the current context.

## Task Defaults

Read-oriented groups list by default:

- `ttr workspaces`
- `ttr boards`
- `ttr labels`
- `ttr projects`
- `ttr tasks`

`ttr tasks` should show open tasks by default by excluding rows with
`completed_at` or `closed_at`. Keep these filters available:

- `--all`
- `--done`
- `--closed`
- `--include-done`
- `--include-closed`
- `--compact`

Compact task output is for agent workflows and should display only task title,
task list name, and workspace name unless the user asks for JSON.

## Verification

For CLI changes, run focused checks first:

```bash
bun --cwd packages/sdk test src/cli/auth.test.ts src/cli/browser.test.ts src/cli/package.test.ts
bun --cwd packages/sdk type-check
```

If task helper queries changed, also run:

```bash
bun --cwd packages/internal-api test src/tasks.test.ts
```

If browser login pages changed, also run the focused web auth test:

```bash
bun --cwd apps/web test src/app/api/cli/auth/start/route.test.ts
```

Finish TypeScript or package changes with `bun ff` and `bun check`.
