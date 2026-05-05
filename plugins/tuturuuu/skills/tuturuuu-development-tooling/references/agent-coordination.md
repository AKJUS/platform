# Shared Worktree Agent Coordination

Use this protocol when humans or multiple agents may be working in the same
checkout.

## Preflight

1. Run `git status --short` before editing.
2. Treat unknown dirty and untracked files as user-owned or other-agent-owned.
3. If `tmp/agent-coordination/` exists, read recent notes before choosing a
   write set.
4. Avoid broad format, cleanup, or staging commands when unrelated dirty files
   are present.

## Conversation Notes

Use `tmp/agent-coordination/` for live agent-to-agent notes. The directory is
ignored by git, so coordination state stays local and is not committed.

Create a note when work is long-running, touches broad surfaces, or might
overlap with another agent:

```md
# Coordination Note

Agent: <agent name or session id>
Timestamp: <local ISO timestamp>
Intent: <one-line task summary>
Owned paths:
- <path or directory>
Observed dirty paths:
- <path owned by someone else>
Status: working | blocked | handoff | done
Needs: <specific question or response requested>
```

Name notes with a sortable timestamp and short task slug, for example
`tmp/agent-coordination/20260505-142300-mobile-routing.md`.

## Conflict Handling

- If another note claims the same files, do not race or overwrite.
- Choose a disjoint slice when possible.
- Leave a response note in `tmp/agent-coordination/` when another agent needs
  context.
- Ask the human partner to arbitrate when both tasks truly need the same files.
- Before final response or handoff, update your note to `done` or `handoff`
  with remaining risks and commands already run.

## Commit Hygiene

- Stage explicit paths only.
- Commit only files you intentionally changed.
- If repo-wide checks or commit hooks fail on unrelated files, do not fix those
  files unless the human explicitly expands your task. Report the blocker and
  keep your own diff scoped.
