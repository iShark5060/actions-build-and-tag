import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIN_NODE_MAJOR = 24;
const MIN_PNPM_MAJOR = 12;

function fail(message) {
  console.error(`\n[preflight] ${message}\n`);
  process.exit(1);
}

function parseMajor(version) {
  const match = /^v?(\d+)/.exec(String(version));
  return match ? Number(match[1]) : 0;
}

const nodeMajor = parseMajor(process.version);
if (nodeMajor < MIN_NODE_MAJOR) {
  fail(
    `Node ${MIN_NODE_MAJOR}+ required (current: ${process.version}). Install Node ${MIN_NODE_MAJOR}+ before running quality checks.`,
  );
}

try {
  const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url));
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const manager = typeof pkg.packageManager === 'string' ? pkg.packageManager : '';
  const pnpmMatch = /^pnpm@(\d+)/.exec(manager);
  if (pnpmMatch) {
    const requiredMajor = Number(pnpmMatch[1]);
    if (requiredMajor < MIN_PNPM_MAJOR) {
      fail(`pnpm ${MIN_PNPM_MAJOR}+ required per packageManager (${manager}).`);
    }
  }
} catch {
  // ignore
}

console.log(`[preflight] OK — Node ${process.version}`);
