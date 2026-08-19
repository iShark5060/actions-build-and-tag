import { existsSync, readFileSync } from 'fs';
import path from 'path';

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';

export interface ActionContext {
  workspace: string;
  github: ReturnType<typeof getOctokit>;
  repo: { owner: string; repo: string };
  sha: string;
  eventName: string;
  payload: Record<string, unknown>;
  getPackageJSON<T extends object>(): T;
}

function readPayload(): Record<string, unknown> {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && existsSync(eventPath)) {
    return JSON.parse(readFileSync(eventPath, { encoding: 'utf8' }));
  }
  return {};
}

export function resolvePublishWorkspace(githubWorkspace: string, workingDirectory: string): string {
  if (!workingDirectory) {
    return githubWorkspace;
  }

  const root = path.resolve(githubWorkspace);
  const resolved = path.resolve(root, workingDirectory);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(
      `working_directory must stay within the GitHub workspace (got: ${workingDirectory})`,
    );
  }
  return resolved;
}

export function createContext(): ActionContext {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN is required');
  }

  const [owner = '', repo = ''] = (process.env.GITHUB_REPOSITORY || '').split('/');
  const githubWorkspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const workingDirectory = core.getInput('working_directory').trim();
  const workspace = resolvePublishWorkspace(githubWorkspace, workingDirectory);

  return {
    workspace,
    github: getOctokit(token),
    repo: { owner, repo },
    sha: process.env.GITHUB_SHA || '',
    eventName: process.env.GITHUB_EVENT_NAME || '',
    payload: readPayload(),
    getPackageJSON<T extends object>() {
      const packagePath = path.join(workspace, 'package.json');
      return JSON.parse(readFileSync(packagePath, { encoding: 'utf8' })) as T;
    },
  };
}

export function getTagNameInput(): string {
  return core.getInput('tag_name');
}
