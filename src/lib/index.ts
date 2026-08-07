import * as core from '@actions/core';
import semver from 'semver';

import type { ActionContext } from '../context';
import { getCommitMessage, isDryRun, shouldUpdateMajorMinorTags } from '../inputs';
import createCommit, { resolvePublishPaths } from './create-commit';
import createOrUpdateRef from './create-or-update-ref';
import getTagName from './get-tag-name';

export type BuildAndTagResult = {
  commit_sha: string;
  files_published: string[];
  tags_updated: string[];
  dry_run: boolean;
};

export default async function buildAndTagAction(ctx: ActionContext): Promise<BuildAndTagResult> {
  const tagName = getTagName(ctx);
  const dryRun = isDryRun();
  core.info(`Updating tag [${tagName}]${dryRun ? ' (dry run)' : ''}`);

  if (dryRun) {
    const files = await resolvePublishPaths(ctx);
    const tags = plannedTags(ctx, tagName);
    core.info(`Dry run: would publish files:\n${files.map((f) => `  - ${f}`).join('\n')}`);
    core.info(`Dry run: would update tags:\n${tags.map((t) => `  - ${t}`).join('\n')}`);
    return {
      commit_sha: '',
      files_published: files,
      tags_updated: tags,
      dry_run: true,
    };
  }

  const { commit, files } = await createCommit(ctx, getCommitMessage());
  const commitSha = commit.sha!;
  const tagsUpdated: string[] = [];

  await createOrUpdateRef(ctx, commitSha, tagName);
  tagsUpdated.push(tagName);

  let rewriteMajorAndMinorRef = shouldUpdateMajorMinorTags();

  if (ctx.eventName === 'release') {
    const release = ctx.payload.release as { draft?: boolean; prerelease?: boolean } | undefined;
    if (release?.draft || release?.prerelease) {
      rewriteMajorAndMinorRef = false;
    }
  }

  if (semver.prerelease(tagName)) {
    rewriteMajorAndMinorRef = false;
  }

  if (rewriteMajorAndMinorRef) {
    const cleanTag = semver.clean(tagName);
    if (!cleanTag) {
      core.warning(`Skipping major/minor tag update: [${tagName}] is not a valid semver tag`);
    } else {
      const majorStr = semver.major(cleanTag).toString();
      const minorStr = semver.minor(cleanTag).toString();
      const minorTag = `v${majorStr}.${minorStr}`;
      const majorTag = `v${majorStr}`;
      await createOrUpdateRef(ctx, commitSha, minorTag);
      tagsUpdated.push(minorTag);
      await createOrUpdateRef(ctx, commitSha, majorTag);
      tagsUpdated.push(majorTag);
    }
  }

  return {
    commit_sha: commitSha,
    files_published: files,
    tags_updated: tagsUpdated,
    dry_run: false,
  };
}

function plannedTags(ctx: ActionContext, tagName: string): string[] {
  const tags = [tagName];
  let rewriteMajorAndMinorRef = shouldUpdateMajorMinorTags();

  if (ctx.eventName === 'release') {
    const release = ctx.payload.release as { draft?: boolean; prerelease?: boolean } | undefined;
    if (release?.draft || release?.prerelease) {
      rewriteMajorAndMinorRef = false;
    }
  }
  if (semver.prerelease(tagName)) {
    rewriteMajorAndMinorRef = false;
  }
  if (!rewriteMajorAndMinorRef) {
    return tags;
  }

  const cleanTag = semver.clean(tagName);
  if (!cleanTag) {
    return tags;
  }
  const majorStr = semver.major(cleanTag).toString();
  const minorStr = semver.minor(cleanTag).toString();
  tags.push(`v${majorStr}.${minorStr}`, `v${majorStr}`);
  return tags;
}
