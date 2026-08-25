# actions-build-and-tag

## Org standards

CI/README/validate conventions live in AppBase `docs/org-standards/` with personal-repo overrides (`personal-repos.md`). GitHub-hosted runners, not Blacksmith. Action-publish track: `release` event → build-and-tag. Quality gate: `pnpm run validate`.

## Overview

Publishes a JS/TS action’s compiled entrypoints onto a release tag and floating major/minor tags (`v1`, `v1.2`). Maintained fork of JasonEtco/build-and-tag-action. Inputs and usage: `README.md` / `action.yml`.

## Publish contract

Bundled `dist/index.js` exists only on **published release tags**. Consumers must use `@v1` (or an exact tag), never `@main`. This repo’s own release workflow uses `uses: ./` after `pnpm run build`; other action repos call `iShark5060/actions-build-and-tag@v1`. The workflow also pushes a companion `${tag}-src` at the pre-publish source SHA.

The publish commit’s tree has **no `base_tree`**: the tag points at a commit that contains **only** the resolved publish files (plus parent SHA history), not the full repo tree. Tag refs are force-updated.

Floating major/minor tags update only when all of these hold: `update_major_minor_tags` is not `false`, the release event is not draft/prerelease, and the tag is clean semver without a prerelease suffix.

`additional_files` and `package.json` `files` are literal paths or directories (walked recursively). Glob patterns are not expanded. Missing paths warn and skip. True composite actions (`using: composite` + `runs.steps`) are not auto-discovered; only `runs.main` / `pre` / `post`. `working_directory` must resolve inside `GITHUB_WORKSPACE`.
