#!/usr/bin/env python3
"""Fetch GitHub PR review threads with resolution and inline context."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from typing import Any


PR_URL_RE = re.compile(
    r"^https://github\.com/(?P<owner>[^/]+)/(?P<repo>[^/]+)/pull/(?P<number>\d+)"
)
REPO_PR_RE = re.compile(r"^(?P<owner>[^/\s]+)/(?P<repo>[^#\s]+)#(?P<number>\d+)$")


QUERY = """
query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      number
      url
      title
      state
      reviewThreads(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          startLine
          diffSide
          startDiffSide
          originalLine
          originalStartLine
          resolvedBy {
            login
          }
          comments(first: 20) {
            nodes {
              id
              body
              createdAt
              updatedAt
              author {
                login
              }
            }
          }
        }
      }
    }
  }
}
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch GitHub PR review threads with isResolved/isOutdated state."
    )
    parser.add_argument("resource", nargs="?", help="PR URL or owner/repo#number")
    parser.add_argument("--repo", help="Repository in owner/name form")
    parser.add_argument("--pr", type=int, help="Pull request number")
    parser.add_argument(
        "--active-only",
        action="store_true",
        help="Only include unresolved, non-outdated review threads in the output.",
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Output compact thread summaries instead of the full GraphQL thread payload.",
    )
    return parser.parse_args()


def resolve_resource(args: argparse.Namespace) -> tuple[str, str, int]:
    if args.resource:
        url_match = PR_URL_RE.match(args.resource)
        if url_match:
            return (
                url_match.group("owner"),
                url_match.group("repo"),
                int(url_match.group("number")),
            )

        repo_pr_match = REPO_PR_RE.match(args.resource)
        if repo_pr_match:
            return (
                repo_pr_match.group("owner"),
                repo_pr_match.group("repo"),
                int(repo_pr_match.group("number")),
            )

    if args.repo and args.pr:
        if "/" not in args.repo:
            raise SystemExit("--repo must be in owner/name form")
        owner, repo = args.repo.split("/", 1)
        return owner, repo, args.pr

    raise SystemExit("Provide a PR URL, owner/repo#number, or --repo owner/repo --pr number")


def gh_graphql(variables: dict[str, Any]) -> dict[str, Any]:
    command = ["gh", "api", "graphql", "-f", f"query={QUERY}"]
    for key, value in variables.items():
        if value is None:
            continue
        flag = "-F" if isinstance(value, int) else "-f"
        command.extend([flag, f"{key}={value}"])

    result = subprocess.run(
        command,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        raise SystemExit(result.returncode)
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        print(f"Failed to parse GitHub GraphQL response as JSON: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc

    if payload.get("errors"):
        print("GitHub GraphQL returned errors:", file=sys.stderr)
        print(json.dumps(payload["errors"], indent=2), file=sys.stderr)
        raise SystemExit(1)

    if not isinstance(payload.get("data"), dict):
        print("GitHub GraphQL response is missing data.", file=sys.stderr)
        raise SystemExit(1)

    return payload


def extract_pull_request(payload: dict[str, Any], owner: str, repo: str, number: int) -> dict[str, Any]:
    repository = payload["data"].get("repository")
    if not isinstance(repository, dict):
        raise SystemExit(f"Repository not found: {owner}/{repo}")

    pull_request = repository.get("pullRequest")
    if not isinstance(pull_request, dict):
        raise SystemExit(f"PR not found: {owner}/{repo}#{number}")

    review_threads = pull_request.get("reviewThreads")
    if not isinstance(review_threads, dict):
        raise SystemExit("GitHub GraphQL response is missing reviewThreads.")

    return pull_request


def is_active_thread(thread: dict[str, Any]) -> bool:
    return not thread.get("isResolved") and not thread.get("isOutdated")


def thread_headline(thread: dict[str, Any]) -> str:
    comments = thread.get("comments")
    if not isinstance(comments, dict):
        return ""

    nodes = comments.get("nodes")
    if not isinstance(nodes, list) or not nodes:
        return ""

    first_comment = nodes[0]
    if not isinstance(first_comment, dict):
        return ""

    body = first_comment.get("body")
    if not isinstance(body, str):
        return ""

    lines = [line.strip() for line in body.splitlines() if line.strip()]
    if len(lines) > 1 and lines[0].startswith("<!--"):
        return lines[1]
    return lines[0] if lines else ""


def summarize_thread(thread: dict[str, Any]) -> dict[str, Any]:
    comments = thread.get("comments")
    nodes = comments.get("nodes", []) if isinstance(comments, dict) else []
    first_comment = nodes[0] if nodes and isinstance(nodes[0], dict) else {}
    author = first_comment.get("author") if isinstance(first_comment, dict) else {}

    return {
        "id": thread.get("id"),
        "path": thread.get("path"),
        "line": thread.get("line"),
        "isResolved": thread.get("isResolved"),
        "isOutdated": thread.get("isOutdated"),
        "author": author.get("login") if isinstance(author, dict) else None,
        "headline": thread_headline(thread),
    }


def count_threads(threads: list[dict[str, Any]]) -> dict[str, int]:
    resolved = sum(1 for thread in threads if thread.get("isResolved"))
    outdated = sum(1 for thread in threads if thread.get("isOutdated"))
    active_unresolved = sum(1 for thread in threads if is_active_thread(thread))
    unresolved = sum(1 for thread in threads if not thread.get("isResolved"))

    return {
        "total": len(threads),
        "resolved": resolved,
        "unresolved": unresolved,
        "outdated": outdated,
        "active_unresolved": active_unresolved,
    }


def main() -> None:
    args = parse_args()
    owner, repo, number = resolve_resource(args)
    cursor: str | None = None
    pull_request: dict[str, Any] | None = None
    threads: list[dict[str, Any]] = []

    while True:
        payload = gh_graphql(
            {
                "owner": owner,
                "repo": repo,
                "number": number,
                "cursor": cursor,
            }
        )
        pr = extract_pull_request(payload, owner, repo, number)

        pull_request = {
            "number": pr["number"],
            "url": pr["url"],
            "title": pr["title"],
            "state": pr["state"],
            "owner": owner,
            "repo": repo,
        }
        review_threads = pr["reviewThreads"]
        threads.extend(review_threads["nodes"])
        page_info = review_threads["pageInfo"]
        if not page_info["hasNextPage"]:
            break
        cursor = page_info["endCursor"]

    output_threads = (
        [thread for thread in threads if is_active_thread(thread)]
        if args.active_only
        else threads
    )
    counts = count_threads(threads)

    if args.summary:
        payload = {
            "pull_request": pull_request,
            "counts": counts,
            "active_unresolved_count": counts["active_unresolved"],
            "review_threads": [summarize_thread(thread) for thread in output_threads],
        }
    else:
        payload = {
            "pull_request": pull_request,
            "counts": counts,
            "active_unresolved_count": counts["active_unresolved"],
            "review_threads": output_threads,
        }

    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
