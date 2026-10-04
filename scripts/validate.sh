#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

failed=0
ran_checks=0

pass() {
  printf 'PASS: %s\n' "$1"
}

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  failed=1
}

note() {
  printf 'NOTE: %s\n' "$1"
}

check_file() {
  if [ -f "$1" ]; then
    pass "required file exists: $1"
  else
    fail "missing required file: $1"
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    pass "required directory exists: $1"
  else
    fail "missing required directory: $1"
  fi
}

run_check() {
  local label="$1"
  shift
  ran_checks=$((ran_checks + 1))

  if "$@"; then
    pass "$label"
  else
    fail "$label"
  fi
}

package_script_exists() {
  local script_name="$1"
  node -e "const fs=require('node:fs'); const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); process.exit(pkg.scripts && pkg.scripts[process.argv[1]] ? 0 : 1)" "$script_name"
}

validate_smoke_script() {
  node --input-type=module <<'NODE'
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const smoke = pkg.scripts?.smoke;
if (!smoke) throw new Error('package.json must define scripts.smoke');
const match = smoke.match(/^node src\/cli\.js scan (\S+) --format json >\/tmp\/hookdoctor-smoke\.json$/);
if (!match) throw new Error(`Unexpected smoke command: ${smoke}`);
const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hookdoctor-smoke-')), 'report.json');
const command = smoke.replace('>/tmp/hookdoctor-smoke.json', `>${output}`);
const result = spawnSync(command, { shell: true, encoding: 'utf8' });
if (result.status !== 0) {
  process.stderr.write(result.stderr || '');
  throw new Error(`smoke command exited with status ${result.status}`);
}
const report = JSON.parse(fs.readFileSync(output, 'utf8'));
if (!report || typeof report !== 'object' || !report.summary) {
  throw new Error('smoke output is not a Hookdoctor JSON report');
}
console.log('smoke command succeeded and wrote valid JSON');
NODE
}

choose_package_manager() {
  if [ -f "pnpm-lock.yaml" ] && command -v pnpm >/dev/null 2>&1; then
    printf 'pnpm\n'
    return
  fi

  if [ -f "package-lock.json" ] && command -v npm >/dev/null 2>&1; then
    printf 'npm\n'
    return
  fi

  if [ -f "yarn.lock" ] && command -v yarn >/dev/null 2>&1; then
    printf 'yarn\n'
    return
  fi

  if [ -f "bun.lock" ] && command -v bun >/dev/null 2>&1; then
    printf 'bun\n'
    return
  fi

  if command -v pnpm >/dev/null 2>&1; then
    printf 'pnpm\n'
    return
  fi

  if command -v npm >/dev/null 2>&1; then
    printf 'npm\n'
    return
  fi

  if command -v yarn >/dev/null 2>&1; then
    printf 'yarn\n'
    return
  fi

  if command -v bun >/dev/null 2>&1; then
    printf 'bun\n'
    return
  fi

  return 1
}

run_package_script() {
  local package_manager="$1"
  local script_name="$2"

  case "$package_manager" in
    pnpm)
      pnpm "$script_name"
      ;;
    npm)
      npm run "$script_name"
      ;;
    yarn)
      yarn "$script_name"
      ;;
    bun)
      bun run "$script_name"
      ;;
    *)
      return 1
      ;;
  esac
}

printf 'Checking /Users/roger/Developer/my-opensource/hookdoctor required files...\n'

check_file "README.md"
check_file "AGENTS.md"
check_file "CONTRIBUTING.md"
check_file "SECURITY.md"
check_file ".github/pull_request_template.md"
check_file "scripts/validate.sh"

printf '\nChecking /Users/roger/Developer/my-opensource/hookdoctor required directories...\n'

check_dir ".github"
check_dir "docs"
check_dir "scripts"

printf '\nRunning local project checks where present...\n'

if [ -f "package.json" ]; then
  if package_manager="$(choose_package_manager)"; then
    note "using package manager: $package_manager"

    if package_script_exists "smoke"; then
      run_check "smoke command succeeds and writes valid JSON" validate_smoke_script
    fi

    for script_name in check lint test build release:check; do
      if package_script_exists "$script_name"; then
        run_check "package script: $script_name" run_package_script "$package_manager" "$script_name"
      fi
    done
  else
    fail "package.json exists but no supported package manager was found on PATH"
  fi
else
  note "no package.json detected; skipping JavaScript package scripts"
fi

if command -v agent-qc >/dev/null 2>&1; then
  run_check "optional agent-qc ready" agent-qc ready
else
  note "agent-qc not installed; skipping optional agent check"
fi

if [ "$ran_checks" -eq 0 ]; then
  note "no runnable local checks were detected"
fi

if [ "$failed" -ne 0 ]; then
  printf '\nValidation failed.\n' >&2
  exit 1
fi

printf '\nValidation passed.\n'
