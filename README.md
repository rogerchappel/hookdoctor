# HookDoctor

HookDoctor audits Git hooks, Husky hooks, package scripts, and GitHub Actions
run blocks for portability and safety issues. It is read-only: it reports what
looks risky without running or rewriting hooks.

## Status

This repository is early-stage. Confirm the current support, release, and
security posture before using it in production.

## Install

```sh
npm install
```

## Use

Scan a repository and print JSON:

```sh
npx hookdoctor scan .
```

Scan a fixture and print Markdown:

```sh
npx hookdoctor scan ./fixtures/warn --format markdown --severity warn
```

Write a report to disk:

```sh
npx hookdoctor scan . --severity warn --out hook-report.json
```

## Checks

HookDoctor inspects:

- `.git/hooks`
- `.husky`
- `package.json` scripts
- `.github/workflows/*.yml` and `.yaml` `run` commands

Rules currently cover:

- missing shebangs
- non-executable hook files
- absolute machine-specific paths
- destructive command patterns
- network command patterns
- bash-oriented shell syntax without an env bash shebang
- command assumptions that depend on tools being present on `PATH`

## Exit Codes

- `0`: scan completed with no error-severity findings
- `1`: invalid command, option, format, or runtime failure
- `2`: scan completed and found one or more error-severity findings

## Fixtures

The `fixtures/` directory includes small repositories for manual smoke checks:

```sh
node src/cli.js scan fixtures/safe
node src/cli.js scan fixtures/warn --format markdown --severity warn
node src/cli.js scan fixtures/high-risk --severity error
```

Run the guided fixture demo:

```sh
bash examples/demo-hook-audit.sh
```

See [Audit risky pre-commit hooks before sharing a repo](docs/tutorials/pre-commit-hook-audit.md)
for a CI-oriented walkthrough.

## Verify

Run the local validation script before opening a pull request:

```sh
bash scripts/validate.sh
```

`scripts/validate.sh` runs the repository's standard local checks when they are
defined and will also run `agent-qc ready` when `agent-qc` is installed. Missing
`agent-qc` is treated as a skip, not a failure.

## Development

Use the same local checks that back release readiness:

```sh
npm test
npm run build
npm run smoke
npm run package:smoke
npm run release:check
```

Run the narrower commands while iterating, then finish with the broadest available check before opening a PR.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution expectations. Changes
should be small, reviewable, and verified before review.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting guidance.

## Verification

Use the package scripts as the public smoke gates before publishing or changing CLI behavior.

- `npm run release:check`
- `npm run test`
- `npm run package:smoke`

## License

MIT
