import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const packagePaths = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'];
const workflowDir = '.forgejo/workflows';
const pullBody = [
  'Opened by the dependency update workflow.',
  '',
  'Comment `@actions rebase` to rebuild this branch from current main.',
].join('\n');

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

function rebaseCommand(body) {
  const line = String(body ?? '')
    .trim()
    .split(/\r?\n/, 1)[0]
    .trim();
  return line === '@actions rebase';
}

function requireEnv(names) {
  for (const name of names) {
    if (!process.env[name]) throw new Error(`missing ${name}`);
  }
}

function git(args, { trim = true } = {}) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || '');
    throw new Error(`git ${args[0]} failed`);
  }
  const stdout = result.stdout || '';
  return trim ? stdout.trim() : stdout;
}

function pnpm(args) {
  const result = spawnSync('pnpm', args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`pnpm ${args[0]} failed`);
}

function resetToMain() {
  git(['fetch', 'origin', 'main']);
  git(['checkout', 'main']);
  git(['reset', '--hard', 'origin/main']);
  git(['clean', '-fd']);
}

function tokenHeaders() {
  return {
    Accept: 'application/json',
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

async function api(pathname, { method = 'GET', body } = {}) {
  const init = { method, headers: tokenHeaders() };
  if (body !== undefined) init.body = JSON.stringify(body);
  const response = await fetch(`${process.env.GITHUB_API_URL}${pathname}`, init);
  if (!response.ok) {
    console.error(await response.text());
    const error = new Error(`${method} ${pathname} failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function publish(branch, message, paths) {
  assertUpdateBranch(branch);
  const present = paths.filter((item) => existsSync(item));
  if (present.length === 0) {
    console.log(`${branch}: no changes`);
    return false;
  }
  git(['add', '--', ...present]);
  const staged = git(['diff', '--cached', '--name-only']);
  if (!staged) {
    console.log(`${branch}: no changes`);
    return false;
  }

  git(['checkout', '-B', branch]);
  git(['commit', '-m', message]);
  // ponytail: deps/* branches are rewritten every run; stop if a group needs review history
  git(['push', '--force', 'origin', `HEAD:refs/heads/${branch}`]);
  await openPullRequest(branch, message);
  return true;
}

async function openPullRequest(branch, title) {
  const response = await fetch(
    `${process.env.GITHUB_API_URL}/repos/${process.env.GITHUB_REPOSITORY}/pulls`,
    {
      method: 'POST',
      headers: tokenHeaders(),
      body: JSON.stringify({
        base: 'main',
        body: pullBody,
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
    throw new Error(`open pull request failed (${response.status})`);
  }
  console.log(`${branch}: pull request opened`);
}

function collectDevelopment() {
  resetToMain();
  updateWithActions(['update', '--latest', '--dev', '--lockfile-only', '--include-github-actions']);
  const actionsPatch = git(['diff', '--', workflowDir], { trim: false });
  git(['checkout', '--', workflowDir]);
  return actionsPatch;
}

async function updateProduction() {
  resetToMain();
  pnpm(['update', '--latest', '--prod', '--lockfile-only']);
  git(['checkout', '--', workflowDir]);
  return publish('deps/production', 'chore(deps): update production dependencies', packagePaths);
}

async function updateDevelopment() {
  collectDevelopment();
  return publish('deps/development', 'chore(deps): update development dependencies', packagePaths);
}

async function publishActions(actionsPatch) {
  resetToMain();
  if (!actionsPatch.trim()) {
    console.log('deps/actions: no changes');
    return false;
  }
  const patchFile = path.join(tmpdir(), 'dal-actions.patch');
  writeFileSync(patchFile, actionsPatch);
  git(['apply', patchFile]);
  return publish('deps/actions', 'ci(deps): update actions', [workflowDir]);
}

async function updateGroup(branch) {
  if (branch === 'deps/production') return updateProduction();
  if (branch === 'deps/development') return updateDevelopment();
  if (branch === 'deps/actions') return publishActions(collectDevelopment());
  throw new Error(`unsupported branch ${branch}`);
}

async function comment(number, body) {
  await api(`/repos/${process.env.GITHUB_REPOSITORY}/issues/${number}/comments`, {
    method: 'POST',
    body: { body },
  });
}

async function hasWriteAccess(user) {
  let response;
  try {
    response = await api(
      `/repos/${process.env.GITHUB_REPOSITORY}/collaborators/${encodeURIComponent(user)}/permission`,
    );
  } catch (error) {
    if (error.status === 404) return false;
    throw error;
  }
  return (
    response?.permission === 'admin' ||
    response?.permission === 'write' ||
    response?.permission === 'owner'
  );
}

async function rebase() {
  requireEnv(['GITHUB_API_URL', 'GITHUB_REPOSITORY', 'GITHUB_TOKEN', 'PR_NUMBER', 'COMMENT_USER']);
  const number = process.env.PR_NUMBER;
  if (!/^[0-9]+$/.test(number)) throw new Error('bad pull request number');

  if (!(await hasWriteAccess(process.env.COMMENT_USER))) {
    await comment(number, 'Only people with write access can rebase this pull request.');
    return;
  }
  if (!rebaseCommand(process.env.COMMENT_BODY)) {
    await comment(number, 'The command is `@actions rebase`.');
    return;
  }

  const pull = await api(`/repos/${process.env.GITHUB_REPOSITORY}/pulls/${number}`);
  const branch = pull.head?.ref;
  const allowed =
    branch === 'deps/production' || branch === 'deps/development' || branch === 'deps/actions';
  if (
    pull.state !== 'open' ||
    pull.base?.ref !== 'main' ||
    pull.head?.repo?.full_name !== process.env.GITHUB_REPOSITORY ||
    !allowed
  ) {
    await comment(
      number,
      'This only rebases open `deps/production`, `deps/development`, and `deps/actions` pull requests targeting main.',
    );
    return;
  }

  await comment(number, `Rebasing \`${branch}\` onto main.`);
  let pushed;
  try {
    pushed = await updateGroup(branch);
  } catch (error) {
    try {
      await comment(number, 'Rebase failed. The workflow log has the error.');
    } catch (commentError) {
      console.error(commentError instanceof Error ? commentError.message : commentError);
    }
    throw error;
  }
  if (!pushed) {
    await api(`/repos/${process.env.GITHUB_REPOSITORY}/issues/${number}`, {
      method: 'PATCH',
      body: { state: 'closed' },
    });
    try {
      assertUpdateBranch(branch);
      git(['push', 'origin', '--delete', branch]);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    }
    await comment(number, 'Nothing left to update against main. Closed this pull request.');
    return;
  }
  await comment(number, `Rebuilt \`${branch}\` from current main.`);
}

async function main() {
  requireEnv(['GITHUB_API_URL', 'GITHUB_REPOSITORY', 'GITHUB_TOKEN']);
  await updateProduction();
  const actionsPatch = collectDevelopment();
  await publish('deps/development', 'chore(deps): update development dependencies', packagePaths);
  await publishActions(actionsPatch);
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
  if (!refused) throw new Error('self-check failed');
  if (!rebaseCommand('@actions rebase')) throw new Error('self-check failed');
  if (!rebaseCommand('  @actions rebase  \r\n')) throw new Error('self-check failed');
  if (rebaseCommand('@actions rebase please')) throw new Error('self-check failed');
  if (rebaseCommand('please\n@actions rebase')) throw new Error('self-check failed');
  if (rebaseCommand('@dal rebase')) throw new Error('self-check failed');
  if (rebaseCommand('@dependabot rebase')) throw new Error('self-check failed');
  console.log('self-check ok');
}

try {
  if (process.argv.includes('--self-check')) selfCheck();
  else if (process.argv.includes('--rebase')) await rebase();
  else await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
