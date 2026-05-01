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
    return json.loads(result.stdout)


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
        pr = payload["data"]["repository"]["pullRequest"]
        if pr is None:
            raise SystemExit(f"PR not found: {owner}/{repo}#{number}")

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

    print(
        json.dumps(
            {
                "pull_request": pull_request,
                "review_threads": threads,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
