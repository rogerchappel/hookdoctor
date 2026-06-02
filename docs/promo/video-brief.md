# Video brief: read-only Git hook safety audit

## Angle

Show HookDoctor catching portability and safety problems in hooks before a repo
is handed to another developer or agent.

## Demo beats

1. Open `fixtures/warn/.husky/pre-push`.
2. Run `node src/cli.js scan fixtures/warn --format markdown --severity warn`.
3. Point out the absolute path, missing shebang, non-executable bit, and shell
   syntax findings.
4. Open `fixtures/high-risk/.husky/pre-commit`.
5. Run `node src/cli.js scan fixtures/high-risk --severity error` and call out
   exit code `2` for error findings.

## Grounded talking points

- HookDoctor inspects `.git/hooks`, `.husky`, package scripts, and GitHub
  Actions run blocks.
- It emits JSON or Markdown.
- It is read-only and does not execute the hooks it audits.

## Claims to avoid

- Do not call it a complete security scanner.
- Do not claim it proves hooks are safe.
- Do not claim it fixes hook files automatically.
