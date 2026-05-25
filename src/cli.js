#!/usr/bin/env node
import { scanPath, writeReport } from './index.js';

const usage = `Usage:
  hookdoctor scan [path] [--format json|markdown] [--severity info|warn|error] [--out file]

Examples:
  hookdoctor scan ./fixtures/warn --format markdown
  hookdoctor scan . --severity warn --out hook-report.json`;

async function main(argv) {
  const [command] = argv;
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(`${usage}\n`);
    return 0;
  }

  if (command !== 'scan') {
    throw new Error(`Unknown command: ${command}\n\n${usage}`);
  }

  const args = parseArgs(argv.slice(1));
  const report = await scanPath(args.targetPath, { severity: args.severity });
  await writeReport(report, args.format, args.out);
  return report.summary.error > 0 ? 2 : 0;
}

function parseArgs(args) {
  const parsed = {
    format: 'json',
    severity: 'info',
    out: undefined,
    targetPath: '.',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];

    if (arg === '--format') {
      parsed.format = readValue(arg, value);
      index += 1;
    } else if (arg === '--severity') {
      parsed.severity = readValue(arg, value);
      index += 1;
    } else if (arg === '--out') {
      parsed.out = readValue(arg, value);
      index += 1;
    } else if (!arg.startsWith('--') && parsed.targetPath === '.') {
      parsed.targetPath = arg;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!['json', 'markdown'].includes(parsed.format)) {
    throw new Error(`Unsupported format: ${parsed.format}`);
  }

  if (!['info', 'warn', 'error'].includes(parsed.severity)) {
    throw new Error(`Unsupported severity: ${parsed.severity}`);
  }

  return parsed;
}

function readValue(name, value) {
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value`);
  }

  return value;
}

main(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
