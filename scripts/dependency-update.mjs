import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const packagePaths = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'];
const workflowDir = '.forgejo/workflows';

// ponytail: pnpm only rewrites .github/workflows. Mirror the Forgejo workflows
// there for the update, then delete the copy so it is never committed. Drop
// this when pnpm scans .forgejo/workflows.
function updateWithActions(args) {
  mkdirSync('.github/workflows', { recursive: true });
  cpSync(workflowDir, '.github/workflows', { recursive: true });
  try {
    pnpm(args);
    cpSync('.github/workflows', workflowDir, { recursive: true });
  } finally {
    rmSync('.github', { recursive: true, force: true });
  }
}

export function assertUpdateBranch(branch) {
  if (!/^deps\/[a-z0-9-]+$/.test(branch)) {
    throw new Error(`refusing to push ${branch}`);
  }
}

function git(args, { trim = true } = {}) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || '');
    process.exit(result.status ?? 1);
  }
  const stdout = result.stdout || '';
  return trim ? stdout.trim() : stdout;
}

function pnpm(args) {
  const result = spawnSync('pnpm', args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function resetToMain() {
  git(['fetch', 'origin', 'main']);
  git(['checkout', 'main']);
  git(['reset', '--hard', 'origin/main']);
  git(['clean', '-fd']);
}

async function publish(branch, message, paths) {
  assertUpdateBranch(branch);
  git(['add', '--', ...paths]);
  const staged = git(['diff', '--cached', '--name-only']);
  if (!staged) {
    console.log(`${branch}: no changes`);
    return;
  }

  git(['checkout', '-B', branch]);
  git(['commit', '-m', message]);
  // ponytail: deps/* branches are rewritten every run; stop if a group needs review history
  git(['push', '--force', 'origin', `HEAD:refs/heads/${branch}`]);
  await openPullRequest(branch, message);
}

async function openPullRequest(branch, title) {
  const response = await fetch(
    `${process.env.GITHUB_API_URL}/repos/${process.env.GITHUB_REPOSITORY}/pulls`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base: 'main',
        body: 'Opened by the dependency update workflow.',
        head: branch,
        title,
      }),
    },
  );
  if (response.status === 409) {
    console.log(`${branch}: pull request already open`);
    return;
  }
  if (!response.ok) {
    console.error(await response.text());
    process.exit(1);
  }
  console.log(`${branch}: pull request opened`);
}

async function main() {
  for (const name of ['GITHUB_API_URL', 'GITHUB_REPOSITORY', 'GITHUB_TOKEN']) {
    if (!process.env[name]) {
      console.error(`missing ${name}`);
      process.exit(1);
    }
  }

  resetToMain();
  pnpm(['update', '--latest', '--prod', '--lockfile-only']);
  git(['checkout', '--', workflowDir]);
  await publish(
    'deps/production',
    'chore(deps): update production dependencies',
    packagePaths.filter((file) => existsSync(file)),
  );

  resetToMain();
  updateWithActions(['update', '--latest', '--dev', '--lockfile-only', '--include-github-actions']);
  const actionsPatch = git(['diff', '--', workflowDir], { trim: false });
  git(['checkout', '--', workflowDir]);
  await publish(
    'deps/development',
    'chore(deps): update development dependencies',
    packagePaths.filter((file) => existsSync(file)),
  );

  resetToMain();
  if (!actionsPatch.trim()) {
    console.log('deps/actions: no changes');
    return;
  }
  const patchFile = path.join(tmpdir(), 'dal-actions.patch');
  writeFileSync(patchFile, actionsPatch);
  git(['apply', patchFile]);
  await publish('deps/actions', 'ci(deps): update actions', [workflowDir]);
}

function selfCheck() {
  assertUpdateBranch('deps/production');
  assertUpdateBranch('deps/development');
  assertUpdateBranch('deps/actions');
  let refused = false;
  try {
    assertUpdateBranch('main');
  } catch {
    refused = true;
  }
  if (!refused) {
    console.error('self-check failed');
    process.exit(1);
  }
  console.log('self-check ok');
}

if (process.argv.includes('--self-check')) {
  selfCheck();
} else {
  await main();
}
