#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

pack_json="$tmp_dir/pack.json"
npm pack --dry-run --json >"$pack_json"
npm pack --pack-destination "$tmp_dir" >/dev/null

node - "$pack_json" <<'NODE'
const fs = require('node:fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))[0];
const packed = new Set(payload.files.map((file) => file.path));
const required = [
  'src/cli.js',
  'src/index.js',
  'fixtures/warn/.husky/pre-push',
  'fixtures/safe/.husky/pre-commit',
  'fixtures/high-risk/.husky/pre-commit',
  'examples/demo-hook-audit.sh',
  'docs/tutorials/pre-commit-hook-audit.md',
  'README.md',
  'LICENSE',
  'SECURITY.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md'
];
const missing = required.filter((file) => !packed.has(file));
if (missing.length) {
  console.error(`Missing package files: ${missing.join(', ')}`);
  process.exit(1);
}
NODE

node src/cli.js --help >/dev/null
node src/cli.js --version >/dev/null

package_tgz="$(find "$tmp_dir" -maxdepth 1 -name 'hookdoctor-*.tgz' -print -quit)"
test -n "$package_tgz"

mkdir -p "$tmp_dir/app"
cd "$tmp_dir/app"
npm init -y >/dev/null
npm install "$package_tgz" >/dev/null

installed_version="$(./node_modules/.bin/hookdoctor --version)"
test "$installed_version" = "$(node -p "require('./node_modules/hookdoctor/package.json').version")"
./node_modules/.bin/hookdoctor --help >/dev/null
./node_modules/.bin/hookdoctor scan node_modules/hookdoctor/fixtures/warn --format json >/dev/null
node --input-type=module -e "import('hookdoctor').then((mod) => { if (typeof mod.scanPath !== 'function') process.exit(1); })"

echo 'hookdoctor package smoke passed'
