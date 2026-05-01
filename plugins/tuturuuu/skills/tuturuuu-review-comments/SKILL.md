---
name: tuturuuu-review-comments
description: Use when inspecting, re-checking, validating, fixing, resolving, or committing pending and unresolved GitHub pull request review comments for Tuturuuu resources or PR URLs.
---

# Tuturuuu Review Comments

Use this skill when the user asks to check, re-check, revalidate, fix, resolve, or commit pending/unresolved comments for a GitHub PR or review resource.

## Core Rules

- Treat thread-aware review data as authoritative. Flat PR comments are useful context, but unresolved inline review threads decide what remains pending.
- Verify every comment against current code before changing anything. If a comment is stale, duplicated, non-actionable, or wrong, say so and draft a response instead of forcing a code change.
- After fixing and validating actionable threads, resolve the addressed review threads by default unless the user explicitly says not to.
- Do not reply on GitHub, push, or commit unless the user explicitly asks for that write action.
- If the user asks to "fix comments", interpret that as all unresolved, non-outdated, actionable review threads unless they narrow the scope.
- Keep unrelated working-tree changes intact. Include them in a commit only when the user explicitly asks to include them.

## Resolve The Resource

1. If the user gives a PR URL, use it directly.
2. If they give `owner/repo#123`, split it into repo and PR number.
3. If they refer to the current branch, run:
   - `gh auth status`
   - `gh pr view --json number,url,headRefName,baseRefName,title,state`
4. Check out the PR only when fixes are requested:
   - `gh pr checkout <number-or-url>`

Run `gh` commands with network access if sandboxing blocks GitHub.

## Fetch Thread-Aware Comments

Prefer the bundled script:

```bash
python3 <skill-dir>/scripts/fetch_review_threads.py --repo owner/repo --pr 123 > /tmp/pr123-review-threads.json
```

Useful summaries:

```bash
jq -r '[.review_threads[] | select(.isResolved == false and .isOutdated == false)] | length' /tmp/pr123-review-threads.json
jq -r '.review_threads[] | select(.isResolved == false and .isOutdated == false) | [.id, .path, (.line // 0), (.comments.nodes[0].body | split("\n") | map(select(length > 0)) | .[1] // .[0])] | @tsv' /tmp/pr123-review-threads.json
```

If the script is unavailable, use `gh api graphql` to fetch `reviewThreads`, including `id`, `isResolved`, `isOutdated`, `path`, `line`, and `comments.nodes.body`.

## Fix Workflow

1. Cluster active threads by file and behavior.
2. Inspect local code around each anchor before editing.
3. Implement the smallest code changes that directly address the validated comments.
4. Update tests, docs, translations, generated files, or migrations when required by the touched surface.
5. Run focused validation first, then the repo-required final check.
6. Resolve review threads that were fixed or confirmed no longer actionable.
7. Re-fetch review threads and report the remaining active unresolved count.

For `/Users/vhpx/Documents/GitHub/platform`, combine this skill with the focused Tuturuuu skills when relevant:

- `$tuturuuu-platform` for repo-wide web/shared-code rules and final checks.
- `$tuturuuu-database` for Supabase migrations, RLS, generated types, and workspace-scoped API writes.
- `$tuturuuu-ci-docs` for CI, docs, and validator changes.
- `$tuturuuu-mobile-task-board` for Flutter mobile task-board behavior.

## Resolving Threads

Resolve addressed review threads after fixes are validated unless the user says not to. Do not resolve ambiguous, intentionally deferred, or still-failing threads.

Resolve exact thread IDs:

```bash
for thread_id in <ids>; do
  gh api graphql \
    -f query='mutation($threadId: ID!) { resolveReviewThread(input: {threadId: $threadId}) { thread { id isResolved } } }' \
    -F threadId="$thread_id" \
    --jq '.data.resolveReviewThread.thread | [.id, (.isResolved|tostring)] | @tsv'
done
```

Then re-fetch thread state and confirm the remaining active unresolved count:

```bash
python3 <skill-dir>/scripts/fetch_review_threads.py --repo owner/repo --pr 123 > /tmp/pr123-review-threads-postresolve.json
jq -r '[.review_threads[] | select(.isResolved == false and .isOutdated == false)] | length' /tmp/pr123-review-threads-postresolve.json
```

## Commit Workflow

Only commit when explicitly asked.

1. Run `git status --short` and `git diff --cached --stat` or `git diff --stat` to confirm scope.
2. Stage intentionally. If the user says to include unrelated files, include exactly those files too.
3. Use Conventional Commits, for example:
   - `fix(education): address module group review feedback`
   - `chore(ci): address review comments`
4. Report commit hash, resolved thread count, remaining active unresolved thread count, and validation results.
