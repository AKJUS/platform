# Tuturuuu Improvement Loop

Use this loop when a task exposes durable workflow knowledge:

1. Capture the concrete evidence: command, error text, path, API, or behavior.
2. Decide the durable home: plugin skill, plugin reference, `apps/docs`, script,
   test, validator, or repo checklist.
3. Check whether the learning affects shared-worktree safety or multi-agent
   coordination, and update `AGENTS.md`, docs, and plugin skills together when
   it does.
4. Make a small update in that home during the same session.
5. Validate the update with the narrowest useful command.
6. Include the durable change in the commit when the user asked to commit.

Prefer exact retrieval handles over generic summaries. Good handles include
package names, CLI commands, file paths, route names, error strings, and test
commands.
