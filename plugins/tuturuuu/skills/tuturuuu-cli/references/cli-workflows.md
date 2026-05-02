# Tuturuuu CLI Workflows

## Installation

Use an existing Bun runtime when available. If Bun is missing and autonomous
installation is appropriate, run the platform-specific installer:

```bash
curl -fsSL https://bun.sh/install | bash
```

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Then install the published CLI:

```bash
bun i -g tuturuuu
```

Verify:

```bash
ttr help
ttr --version
ttr tasks --help
```

Inside the Tuturuuu monorepo, use `bun ttr ...` to run the local package script.
After global installation, use `ttr ...` directly.

Upgrade an existing global install with:

```bash
ttr upgrade
```

## Scoped Help

Help is intentionally scoped so humans and agents can ask for the smallest
relevant surface before running a mutation:

```bash
ttr --help
ttr upgrade --help
ttr workspaces --help
ttr tasks --help
ttr tasks create --help
ttr tasks done --help
ttr tasks close --help
ttr tasks update --help
ttr tasks move --help
ttr help tasks create
```

Help commands should not require login, should not read or write the CLI config,
and should not check the npm registry for updates. This keeps `--help` safe in
first-run, CI, and headless environments.

## Common Commands

```bash
ttr login
ttr login --copy
ttr upgrade
ttr -v
ttr whoami
ttr whoami --json
ttr workspaces
ttr workspaces --json --no-update-check
ttr workspaces use
ttr tasks
ttr tasks --json --no-update-check
ttr tasks use
ttr tasks create "Add Tuturuuu CLI"
ttr tasks done <task-id>
ttr tasks close <task-id>
ttr tasks update <task-id> --json-payload '{"completed":true}'
ttr tasks --compact
ttr tasks --all
ttr tasks --done
ttr tasks --closed
```

`ttr tasks` orders rows by priority and then due date. Human table output should
show compact due labels such as `Today`, `Tomorrow`, or `May 10`.

Use JSON output for agent workflows:

```bash
ttr whoami --json --no-update-check
ttr tasks --json --no-update-check
ttr tasks --compact --json --no-update-check
```

Use human output for interactive work:

```bash
ttr whoami
ttr workspaces use
ttr boards use
ttr lists use
ttr tasks create "Write CLI docs"
```

Omit IDs in a TTY to select with the keyboard:

```bash
ttr workspaces use
ttr boards use
ttr lists use
ttr tasks use
ttr tasks get
ttr tasks move
```

The CLI defaults to the `personal` workspace after login and when no workspace
has been selected.

Interactive picker rows use one-based indexes and tier/status badges before the
name, such as `[FREE] Tuturuuu` or `[PRO] Personal`.

## Monorepo Behavior

The Tuturuuu monorepo contains a workspace package named `tuturuuu` under
`packages/sdk`. From the repo root, Bun resolves that package name to the local
workspace package. Use `bun ttr ...` for the local script and `ttr ...` for the
globally installed CLI.

## Mutation Examples

Create a task with the current selected board/list, or prompt for one when a TTY
is available:

```bash
ttr tasks create "Add Tuturuuu CLI"
```

Create directly into a known task list:

```bash
ttr tasks create --list <list-id> --name "Write release notes"
```

Mark completed and let Tuturuuu choose the first `done` list:

```bash
ttr tasks done <task-id>
```

Mark completed into a specific done destination:

```bash
ttr tasks done <task-id> --list <done-list-id>
```

Use a raw update payload when the agent needs to combine completion with other
field changes:

```bash
ttr tasks update <task-id> --json-payload '{"completed":true}'
```

Mark closed and let Tuturuuu choose the first `closed` list when available:

```bash
ttr tasks close <task-id>
```

Mark closed into a specific closed destination:

```bash
ttr tasks close <task-id> --list <closed-list-id>
```

Move with a picker, or move directly:

```bash
ttr tasks move
ttr tasks move <task-id> --list <list-id>
ttr tasks move <task-id> --target-board <board-id> --list <list-id>
```
