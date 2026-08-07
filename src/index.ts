import * as core from '@actions/core';

import { createContext } from './context';
import buildAndTagAction from './lib';

async function run() {
  try {
    const result = await buildAndTagAction(createContext());
    core.setOutput('commit_sha', result.commit_sha);
    core.setOutput('files_published', result.files_published.join('\n'));
    core.setOutput('tags_updated', result.tags_updated.join('\n'));
    core.setOutput('dry_run', String(result.dry_run));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    core.setFailed(message);
  }
}

if (!process.env.VITEST) {
  run();
}
