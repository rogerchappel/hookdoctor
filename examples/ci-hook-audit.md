# HookDoctor — hook audit recipe for CI

This recipe runs `hookdoctor` as a pre-commit or CI check to catch risky Git
hooks before they land.

## CI example (GitHub Actions)

```yaml
name: hook-check
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npx hookdoctor scan . --severity warn --format markdown --out hook-report.md
      - name: Fail on errors
        run: |
          ERRORS=$(npx hookdoctor scan . --severity error --out /dev/stdout 2>&1 | grep '"error"' | wc -l)
          if [ "$ERRORS" -gt 0 ]; then
            echo "✗ HookDoctor found $ERRORS error(s)"
            exit 2
          fi
          echo "✓ All hooks clean"
```

## Pre-commit example (.husky/pre-commit)

```sh
#!/usr/bin/env sh
echo "▸ Running hookdoctor audit ..."
npx hookdoctor scan . --severity warn --format markdown
EXIT=$?
if [ "$EXIT" -eq 2 ]; then
  echo "✗ Hook audit found error-severity issues"
  echo "Review with: npx hookdoctor scan . --severity error"
  exit 1
fi
```

## What it catches

- Missing shebangs (e.g. a hook without `#!/usr/bin/env bash`)
- Non-executable hook files (`.git/hooks` files without +x)
- Absolute machine paths (`C:\Users\...` or `/Users/someone/...`)
- Destructive patterns (`rm -rf`, `git push --force`)
- Network commands without timeouts (`curl`, `wget` without `--connect-timeout`)
- Bashisms in `/bin/sh` scripts (`[[ ]]` instead of `[ ]`)
