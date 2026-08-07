import { describe, test, expect, beforeEach, vi } from 'vitest';

import type { ActionContext } from '../src/context';
import buildAndTagAction from '../src/lib';
import { createMockGithub, generateContext } from './helpers';
import { resetReleaseFixture } from './setup';

describe('actions-build-and-tag', () => {
  let ctx: ActionContext;

  beforeEach(() => {
    resetReleaseFixture();
    process.env.INPUT_TAG_NAME = '';
    process.env.INPUT_UPDATE_MAJOR_MINOR_TAGS = '';
    process.env.INPUT_COMMIT_MESSAGE = '';
    process.env.INPUT_DRY_RUN = '';
    process.env.INPUT_WORKING_DIRECTORY = '';
    ctx = generateContext();
  });

  test('updates existing release, minor, and major refs', async () => {
    ctx = generateContext({
      github: createMockGithub({
        getRef: vi.fn().mockResolvedValue({ data: { ref: 'refs/tags/v1.0.0' } }),
      }),
    });

    await buildAndTagAction(ctx);

    expect(ctx.github.rest.git.updateRef).toHaveBeenCalledTimes(3);
    expect(ctx.github.rest.git.createRef).not.toHaveBeenCalled();
  });

  test('creates release, minor, and major refs when none exist', async () => {
    await buildAndTagAction(ctx);

    expect(ctx.github.rest.git.createRef).toHaveBeenCalledTimes(3);
    expect(ctx.github.rest.git.updateRef).not.toHaveBeenCalled();
  });

  test('does not update floating tags if the release is a draft', async () => {
    ctx = generateContext({
      payload: {
        release: { draft: true, prerelease: false, tag_name: 'v1.0.0' },
      },
    });

    await buildAndTagAction(ctx);

    expect(ctx.github.rest.git.createRef).toHaveBeenCalledTimes(1);
    expect(ctx.github.rest.git.updateRef).not.toHaveBeenCalled();
    expect(ctx.github.rest.git.getRef).toHaveBeenCalledTimes(1);
  });

  test('does not update floating tags if the release is a prerelease', async () => {
    ctx = generateContext({
      payload: {
        release: { draft: false, prerelease: true, tag_name: 'v1.0.0' },
      },
    });

    await buildAndTagAction(ctx);

    expect(ctx.github.rest.git.createRef).toHaveBeenCalledTimes(1);
    expect(ctx.github.rest.git.updateRef).not.toHaveBeenCalled();
    expect(ctx.github.rest.git.getRef).toHaveBeenCalledTimes(1);
  });

  test('does not update floating tags for semver prerelease tag names', async () => {
    process.env.INPUT_TAG_NAME = 'v2.0.0-beta.1';
    ctx = generateContext({ eventName: 'workflow_dispatch' });

    await buildAndTagAction(ctx);

    expect(ctx.github.rest.git.getRef).toHaveBeenCalledTimes(1);
    expect(ctx.github.rest.git.createRef).toHaveBeenCalledTimes(1);
  });

  test('skips floating tags when update_major_minor_tags is false', async () => {
    process.env.INPUT_UPDATE_MAJOR_MINOR_TAGS = 'false';

    await buildAndTagAction(ctx);

    expect(ctx.github.rest.git.createRef).toHaveBeenCalledTimes(1);
    expect(ctx.github.rest.git.getRef).toHaveBeenCalledTimes(1);
  });

  test('skips floating tags for non-semver tag names', async () => {
    process.env.INPUT_TAG_NAME = 'not-a-version';
    ctx = generateContext({ eventName: 'workflow_dispatch' });

    await buildAndTagAction(ctx);

    expect(ctx.github.rest.git.getRef).toHaveBeenCalledTimes(1);
    expect(ctx.github.rest.git.createRef).toHaveBeenCalledTimes(1);
  });

  test('creates refs for an event other than release', async () => {
    process.env.INPUT_TAG_NAME = 'v2.0.0';
    ctx = generateContext({ eventName: 'pull_request' });

    await buildAndTagAction(ctx);

    expect(ctx.github.rest.git.createRef).toHaveBeenCalledTimes(3);
    expect(ctx.github.rest.git.updateRef).not.toHaveBeenCalled();
  });

  test('returns the new commit sha and published metadata', async () => {
    const result = await buildAndTagAction(ctx);
    expect(result.commit_sha).toBe('123abc');
    expect(result.tags_updated).toEqual(['v1.0.0', 'v1.0', 'v1']);
    expect(result.dry_run).toBe(false);
    expect(result.files_published.length).toBeGreaterThan(0);
  });

  test('dry_run skips ref mutations and reports planned tags', async () => {
    process.env.INPUT_DRY_RUN = 'true';
    const result = await buildAndTagAction(ctx);
    expect(result.dry_run).toBe(true);
    expect(result.commit_sha).toBe('');
    expect(result.tags_updated).toEqual(['v1.0.0', 'v1.0', 'v1']);
    expect(ctx.github.rest.git.createRef).not.toHaveBeenCalled();
    expect(ctx.github.rest.git.updateRef).not.toHaveBeenCalled();
    expect(ctx.github.rest.git.createCommit).not.toHaveBeenCalled();
  });
});
