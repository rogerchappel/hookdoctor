#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

echo "hookdoctor demo: warning fixture as Markdown"
node src/cli.js scan fixtures/warn --format markdown --severity warn

echo ""
echo "hookdoctor demo: high-risk fixture exit code"
set +e
node src/cli.js scan fixtures/high-risk --severity error >tmp-hookdoctor-high-risk.json
exit_code=$?
set -e

node - tmp-hookdoctor-high-risk.json "$exit_code" <<'NODE'
const fs = require("node:fs");
const report = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const exitCode = process.argv[3];

console.log(`exit: ${exitCode}`);
console.log(`errors: ${report.summary.error}`);
for (const finding of report.findings) {
  console.log(`- ${finding.rule}: ${finding.message}`);
}
NODE

rm -f tmp-hookdoctor-high-risk.json
