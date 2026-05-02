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
```

## Common Commands

```bash
ttr login
ttr login --copy
ttr whoami
ttr workspaces
ttr workspaces use
ttr tasks
ttr tasks use
ttr tasks --compact
ttr tasks --all
ttr tasks --done
ttr tasks --closed
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

## Monorepo Behavior

The Tuturuuu monorepo contains a workspace package named `tuturuuu` under
`packages/sdk`. From the repo root, Bun resolves that package name to the local
workspace package. Use `bun ttr ...` for the local script and `ttr ...` for the
globally installed CLI.
