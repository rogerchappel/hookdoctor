# Audit risky pre-commit hooks before sharing a repo

This recipe uses HookDoctor's fixture repositories to demonstrate the two
review modes that matter most for promotion: a readable Markdown report for
warnings and an error-gated JSON report for high-risk hooks.

## Run the demo

```sh
bash examples/demo-hook-audit.sh
```

The first scan reads `fixtures/warn/.husky/pre-push` and reports warnings for:

- an absolute machine-specific path
- bash-oriented shell syntax without an env bash shebang
- a missing shebang
- a non-executable hook file

The second scan reads `fixtures/high-risk/.husky/pre-commit`, detects the
destructive command pattern, and exits with code `2`.

## CI shape

Use warning output for review artifacts:

```sh
hookdoctor scan . --format markdown --severity warn --out hookdoctor-report.md
```

Use error severity when the pipeline should fail on dangerous patterns:

```sh
hookdoctor scan . --severity error
```

HookDoctor is read-only. It reports findings without running hooks, rewriting
files, or modifying Git configuration.
