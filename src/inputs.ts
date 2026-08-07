import * as core from '@actions/core';

export function getCommitMessage(): string {
  return core.getInput('commit_message').trim() || 'Automatic compilation';
}

export function getAdditionalFilesFromInput(): string[] {
  return core
    .getInput('additional_files')
    .split(',')
    .map((file) => file.trim())
    .filter(Boolean);
}

export function shouldUpdateMajorMinorTags(): boolean {
  const value = core.getInput('update_major_minor_tags').trim().toLowerCase();
  return value === '' || value === 'true';
}

export function isDryRun(): boolean {
  return core.getInput('dry_run').trim().toLowerCase() === 'true';
}
