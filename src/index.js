import { access, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const hookNames = new Set([
  'applypatch-msg',
  'commit-msg',
  'fsmonitor-watchman',
  'post-applypatch',
  'post-checkout',
  'post-commit',
  'post-merge',
  'post-receive',
  'post-rewrite',
  'post-update',
  'pre-applypatch',
  'pre-auto-gc',
  'pre-commit',
  'pre-merge-commit',
  'pre-push',
  'pre-rebase',
  'pre-receive',
  'prepare-commit-msg',
  'push-to-checkout',
  'sendemail-validate',
  'update',
]);

const destructivePatterns = [
  /\brm\s+(-[^\n;&|]*[rf][^\n;&|]*|-[^\n;&|]*[fr][^\n;&|]*)\b/,
  /\bgit\s+clean\s+-[^\n;&|]*f/,
  /\bgit\s+reset\s+--hard\b/,
  /\b(dropdb|docker\s+system\s+prune)\b/,
];

const networkPatterns = [
  /\b(curl|wget|scp|rsync|ssh)\b/,
  /\b(npm|pnpm|yarn|bun)\s+(install|add|publish)\b/,
  /\bhttps?:\/\//,
];

const absolutePathPattern = /(^|[\s"'=:])\/(?:Users|home|var|tmp|opt|usr\/local|Applications)\//;
const shellFeaturePattern = /(\[\[|source\s+|function\s+\w+|\$\{BASH_SOURCE\[)/;

const commandPattern = /^\s*(?:env\s+\S+\s+)*([A-Za-z0-9_.@/-]+)(?:\s|$)/;
const allowedCommands = new Set([
  '.',
  '[',
  'cd',
  'echo',
  'else',
  'exit',
  'export',
  'fi',
  'for',
  'if',
  'printf',
  'pwd',
  'read',
  'return',
  'set',
  'shift',
  'then',
  'test',
  'while',
]);

export async function scanPath(targetPath, options = {}) {
  const root = path.resolve(targetPath);
  const findings = [];

  await scanGitHooks(root, findings);
  await scanHusky(root, findings);
  await scanPackageScripts(root, findings);
  await scanGitHubActions(root, findings);

  const minimum = severityRank(options.severity ?? 'info');
  const filtered = findings.filter((finding) => severityRank(finding.severity) >= minimum);

  return {
    tool: 'hookdoctor',
    root,
    summary: summarize(filtered),
    findings: filtered.sort(compareFindings),
  };
}

export async function writeReport(report, format, outPath) {
  const body = formatReport(report, format);
  if (outPath) {
    await writeFile(outPath, body);
    return;
  }

  process.stdout.write(body);
  if (!body.endsWith('\n')) {
    process.stdout.write('\n');
  }
}

export function formatReport(report, format = 'json') {
  if (format === 'json') {
    return JSON.stringify(report, null, 2);
  }

  if (format === 'markdown') {
    return formatMarkdown(report);
  }

  throw new Error(`Unsupported format: ${format}`);
}

async function scanGitHooks(root, findings) {
  const hooksDir = path.join(root, '.git', 'hooks');
  for (const entry of await safeReadDir(hooksDir)) {
    if (entry.name.endsWith('.sample') || !hookNames.has(entry.name)) {
      continue;
    }

    const filePath = path.join(hooksDir, entry.name);
    if (!entry.isFile()) {
      continue;
    }

    const content = await readText(filePath);
    await addHookFileFindings(findings, root, filePath, content, 'git-hook');
  }
}

async function scanHusky(root, findings) {
  const huskyDir = path.join(root, '.husky');
  for (const entry of await safeReadDir(huskyDir)) {
    if (!entry.isFile() || entry.name.startsWith('_') || entry.name.endsWith('.md')) {
      continue;
    }

    const filePath = path.join(huskyDir, entry.name);
    const content = await readText(filePath);
    await addHookFileFindings(findings, root, filePath, content, 'husky-hook');
  }
}

async function scanPackageScripts(root, findings) {
  const packagePath = path.join(root, 'package.json');
  const content = await readText(packagePath);
  if (!content) {
    return;
  }

  let packageJson;
  try {
    packageJson = JSON.parse(content);
  } catch (error) {
    findings.push(finding('error', 'package-json-invalid', 'package-script', packagePath, `package.json could not be parsed: ${error.message}`));
    return;
  }

  for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
    scanCommandText(findings, root, packagePath, command, `package script "${name}"`, 'package-script');
  }
}

async function scanGitHubActions(root, findings) {
  const workflowsDir = path.join(root, '.github', 'workflows');
  for (const entry of await safeReadDir(workflowsDir)) {
    if (!entry.isFile() || !/\.(ya?ml)$/.test(entry.name)) {
      continue;
    }

    const filePath = path.join(workflowsDir, entry.name);
    const content = await readText(filePath);
    for (const command of extractWorkflowRunCommands(content)) {
      scanCommandText(findings, root, filePath, command, 'GitHub Actions run block', 'github-actions');
    }
  }
}

async function addHookFileFindings(findings, root, filePath, content, sourceType) {
  if (!content.startsWith('#!')) {
    findings.push(finding('warn', 'missing-shebang', sourceType, filePath, 'Hook file is missing a shebang, so it may run under an unexpected shell.'));
  }

  await scanExecutable(findings, filePath, sourceType);
  scanCommandText(findings, root, filePath, content, path.basename(filePath), sourceType);
}

async function scanExecutable(findings, filePath, sourceType) {
  try {
    await access(filePath, constants.X_OK);
  } catch {
    findings.push(finding('warn', 'not-executable', sourceType, filePath, 'Hook file is not executable on this filesystem.'));
  }
}

function scanCommandText(findings, root, filePath, content, label, sourceType) {
  if (destructivePatterns.some((pattern) => pattern.test(content))) {
    findings.push(finding('error', 'destructive-command', sourceType, filePath, `${label} contains a destructive command pattern.`));
  }

  if (networkPatterns.some((pattern) => pattern.test(content))) {
    findings.push(finding('warn', 'network-command', sourceType, filePath, `${label} appears to call the network.`));
  }

  if (absolutePathPattern.test(content)) {
    findings.push(finding('warn', 'absolute-path', sourceType, filePath, `${label} contains an absolute machine-specific path.`));
  }

  if (!content.startsWith('#!/usr/bin/env bash') && shellFeaturePattern.test(content)) {
    findings.push(finding('warn', 'brittle-shell-feature', sourceType, filePath, `${label} uses bash-oriented shell syntax without an env bash shebang.`));
  }

  for (const command of findUnpinnedCommands(content)) {
    findings.push(finding('info', 'tool-assumption', sourceType, filePath, `${label} assumes "${command}" is installed on PATH.`));
  }
}

function findUnpinnedCommands(content) {
  const commands = new Set();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || /^\w+=/.test(trimmed)) {
      continue;
    }

    const match = commandPattern.exec(trimmed);
    if (!match) {
      continue;
    }

    const command = path.basename(match[1]);
    if (allowedCommands.has(command) || command.includes('=')) {
      continue;
    }

    commands.add(command);
  }

  return [...commands].sort();
}

function extractWorkflowRunCommands(content) {
  const commands = [];
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const inline = line.match(/^\s*run:\s+(.+)$/);
    if (inline) {
      commands.push(inline[1].trim());
      continue;
    }

    const block = line.match(/^(\s*)run:\s*\|\s*$/);
    if (!block) {
      continue;
    }

    const baseIndent = block[1].length;
    const blockLines = [];
    for (index += 1; index < lines.length; index += 1) {
      const current = lines[index];
      const indent = current.match(/^\s*/)[0].length;
      if (current.trim() && indent <= baseIndent) {
        index -= 1;
        break;
      }
      blockLines.push(current.slice(Math.min(indent, baseIndent + 2)));
    }
    commands.push(blockLines.join('\n'));
  }

  return commands;
}

async function safeReadDir(dirPath) {
  try {
    return await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function readText(filePath) {
  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) {
      return '';
    }
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function finding(severity, rule, sourceType, filePath, message) {
  return {
    severity,
    rule,
    sourceType,
    path: filePath,
    message,
  };
}

function severityRank(severity) {
  return { info: 0, warn: 1, error: 2 }[severity] ?? 0;
}

function summarize(findings) {
  return findings.reduce(
    (summary, finding) => {
      summary[finding.severity] += 1;
      return summary;
    },
    { info: 0, warn: 0, error: 0, total: findings.length },
  );
}

function compareFindings(left, right) {
  return severityRank(right.severity) - severityRank(left.severity)
    || left.path.localeCompare(right.path)
    || left.rule.localeCompare(right.rule);
}

function formatMarkdown(report) {
  const lines = [
    '# HookDoctor Report',
    '',
    `Root: \`${report.root}\``,
    '',
    `Summary: ${report.summary.error} error, ${report.summary.warn} warning, ${report.summary.info} info`,
    '',
  ];

  if (report.findings.length === 0) {
    lines.push('No findings.');
    return `${lines.join('\n')}\n`;
  }

  lines.push('| Severity | Rule | Source | Path | Message |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const item of report.findings) {
    lines.push(`| ${item.severity} | ${item.rule} | ${item.sourceType} | \`${item.path}\` | ${item.message} |`);
  }

  return `${lines.join('\n')}\n`;
}
