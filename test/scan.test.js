import { mkdir, writeFile } from 'node:fs/promises';
import { chmod } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';

import { formatReport, scanPath } from '../src/index.js';

const execFileAsync = promisify(execFile);

test('scanPath reports no findings for a safe executable hook', async () => {
  const repo = await createRepo('safe');
  await writeHook(repo, 'pre-commit', '#!/usr/bin/env sh\nprintf "ok\\n"\n', 0o755);

  const report = await scanPath(repo);

  assert.equal(report.summary.total, 0);
  assert.deepEqual(report.findings, []);
});

test('scanPath reports portability warnings for brittle hooks and scripts', async () => {
  const repo = await createRepo('warn');
  await writeHook(repo, 'pre-push', '[[ -f /Users/alex/.toolrc ]] && node scripts/check.js\n', 0o644);
  await writeFile(path.join(repo, 'package.json'), JSON.stringify({
    scripts: {
      prepare: 'curl https://example.com/install.sh | sh',
    },
  }));

  const report = await scanPath(repo, { severity: 'warn' });
  const rules = report.findings.map((finding) => finding.rule);

  assert.ok(rules.includes('missing-shebang'));
  assert.ok(rules.includes('not-executable'));
  assert.ok(rules.includes('absolute-path'));
  assert.ok(rules.includes('brittle-shell-feature'));
  assert.ok(rules.includes('network-command'));
  assert.equal(report.summary.error, 0);
});

test('scanPath reports destructive commands as errors', async () => {
  const repo = await createRepo('danger');
  await writeHook(repo, 'pre-commit', '#!/usr/bin/env bash\nrm -rf dist\n', 0o755);

  const report = await scanPath(repo);

  assert.equal(report.summary.error, 1);
  assert.equal(report.findings[0].rule, 'destructive-command');
});

test('formatReport emits markdown', async () => {
  const repo = await createRepo('markdown');
  await writeHook(repo, 'pre-commit', 'node check.js\n', 0o644);

  const report = await scanPath(repo, { severity: 'warn' });
  const markdown = formatReport(report, 'markdown');

  assert.match(markdown, /^# HookDoctor Report/);
  assert.match(markdown, /\| Severity \| Rule \| Source \| Path \| Message \|/);
});

test('CLI help exits cleanly with usage text', async () => {
  const { stdout } = await execFileAsync(process.execPath, ['src/cli.js', '--help'], { cwd: process.cwd() });

  assert.match(stdout, /Usage:/);
  assert.match(stdout, /hookdoctor scan/);
});

test('CLI exits 2 and emits JSON for error-severity findings', async () => {
  const repo = await createRepo('cli-danger');
  await writeHook(repo, 'pre-commit', '#!/usr/bin/env bash\nrm -rf dist\n', 0o755);

  await assert.rejects(
    execFileAsync(process.execPath, ['src/cli.js', 'scan', repo, '--severity', 'error'], { cwd: process.cwd() }),
    (error) => {
      assert.equal(error.code, 2);
      const parsed = JSON.parse(error.stdout);
      assert.equal(parsed.summary.error, 1);
      assert.equal(parsed.findings[0].rule, 'destructive-command');
      return true;
    }
  );
});

async function createRepo(name) {
  const repo = path.join(tmpdir(), `hookdoctor-${name}-${process.pid}-${Math.random().toString(16).slice(2)}`);
  await mkdir(path.join(repo, '.git', 'hooks'), { recursive: true });
  return repo;
}

async function writeHook(repo, name, content, mode) {
  const hookPath = path.join(repo, '.git', 'hooks', name);
  await writeFile(hookPath, content);
  await chmod(hookPath, mode);
}
