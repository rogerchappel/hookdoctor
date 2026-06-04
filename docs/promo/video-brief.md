# Video brief: "Is your pre-commit hook about to rm -rf something? — HookDoctor demo"

## Angle

Show HookDoctor catching portability and safety problems in hooks before a repo
is handed to another developer or agent.

## Target

- Length: 1–2 minute screencast
- Audience: git hook users, CI engineers, developers who inherit repos with hooks

## Hook (first 5 seconds)

- Show a hook file with `rm -rf $HOME` — no shebang, not executable
- Voiceover/text: "This hook has four problems. Nobody noticed."

## Demo beats

1. Open `fixtures/high-risk/.husky/pre-commit`.
2. Run `node src/cli.js scan fixtures/warn --format markdown --severity warn`.
3. Point out the absolute path, missing shebang, non-executable bit, and shell syntax findings.
4. Open `fixtures/high-risk/.husky/pre-commit`.
5. Run `node src/cli.js scan fixtures/high-risk --severity error` and call out exit code `2` for error findings.
6. Run `node src/cli.js scan . --out hook-report.json` in a real repo and open the JSON report.

## Grounded talking points

- HookDoctor inspects `.git/hooks`, `.husky`, package scripts, and GitHub Actions run blocks.
- It emits JSON or Markdown — structured, parseable output.
- Multiple severity levels: info, warn, error.
- It is read-only — does not execute, rewrite, or delete hooks.
- `npx hookdoctor scan .` — no install required.

## File references (all exist in repo)

- `src/index.js` — scan engine
- `src/rules/` — rule definitions
- `fixtures/` — small test repos (safe, warn, high-risk)
- `examples/ci-hook-audit.md` — CI recipe

## Call to action

- Open source: <https://github.com/rogerchappel/hookdoctor>
- PRs welcome — especially new rule contributions

## Claims to avoid

- Do not call it a complete security scanner.
- Do not claim it proves hooks are safe.
- Do not claim it fixes hook files automatically.
- Keep it grounded: it's a linter for hooks.
