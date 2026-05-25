# HookDoctor PRD

Status: in-progress

## Summary

HookDoctor audits Git hooks, package scripts, and CI preflight commands for portability and safety. It tells maintainers when hooks assume missing tools, use brittle shell features, or hide risky network/destructive behavior.

## Problem

Local hooks are useful until they become invisible build traps. Agents and new contributors need a fast way to see what will run before commits, pushes, releases, or CI jobs.

## V1 Scope

- Inspect `.git/hooks`, `.husky`, package scripts, and GitHub Actions workflow commands.
- Detect missing shebangs, non-executable hooks, absolute paths, destructive commands, network commands, and unpinned tool assumptions.
- Emit JSON and Markdown reports with severity.
- Include fixtures for safe, warning, and high-risk hooks.

## Non-Goals

- Running hooks automatically.
- Rewriting user hooks.
- Full shell AST parsing.

## CLI

```bash
hookdoctor scan ./fixtures/repo --format markdown
hookdoctor scan . --severity warn --out hook-report.json
```

## Source Attribution

Inspired by pre-commit, husky, and CI linting practices, reframed as a read-only hook audit tool for local and agentic contributors.
