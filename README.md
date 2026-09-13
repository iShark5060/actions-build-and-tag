# Build and Tag

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/iShark5060/actions-build-and-tag/ci.yml?style=flat-square&label=CI)](https://github.com/iShark5060/actions-build-and-tag/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/Node-%3E%3D24-339933?logo=node.js&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178C6?logo=typescript&logoColor=white&style=flat-square)
[![Cursor](https://img.shields.io/badge/Cursor-IDE-141414?logo=cursor&logoColor=white&style=flat-square)](https://cursor.com)

<<<<<<< Updated upstream
Publishes a JavaScript GitHub Action onto a release tag and floating version tags (`v1`, `v1.2`). Maintained fork of [JasonEtco/build-and-tag-action](https://github.com/JasonEtco/build-and-tag-action).
=======
Publish JavaScript GitHub Actions to release tags and floating version tags (`v1`, `v1.2`). Build once, move the major tag, consumers on `@v1` pick it up.

This is a maintained fork of [JasonEtco/build-and-tag-action](https://github.com/JasonEtco/build-and-tag-action) by Jason Etco (MIT License). I use it so the Discord / release / MSVC actions in this folder actually have a `dist/` on the tag.

> **Always reference a published version tag** (e.g. `@v1`). The bundled action code (`dist/index.js`) is only committed to release tags, so referencing `@main` will not work.

## Usage
>>>>>>> Stashed changes

```yaml
- uses: actions/checkout@v7
  with:
    ref: ${{ github.event.release.tag_name }}
- run: pnpm install --frozen-lockfile && pnpm run build
- uses: iShark5060/actions-build-and-tag@v1
  env:
    GITHUB_TOKEN: ${{ github.token }}
```

Needs `permissions: contents: write`. Inputs live in `action.yml`.

## Gotchas

<<<<<<< Updated upstream
- Reference a **published tag** (`@v1`). `dist/index.js` is only on release tags; `@main` will not work.
- The publish commit contains **only** the resolved files, not the full repo tree. Tag refs are force-updated.
- Floating major/minor tags are skipped for drafts, pre-releases, and tags with a prerelease suffix.
- `additional_files` and `package.json` `files` are literal paths (directories walked recursively). Globs are not expanded. Composite actions (`using: composite`) are not auto-discovered.
- For other events, pass `tag_name` explicitly. `working_directory` must stay inside `GITHUB_WORKSPACE`.
=======
```json
{
  "name": "your-action-name",
  "main": "dist/index.js",
  "scripts": {
    "build": "esbuild src/index.ts --bundle --platform=node --format=cjs --target=node24 --outfile=dist/index.js --minify"
  }
}
```

Point `action.yml` at the same file:

```yaml
runs:
  using: node24
  main: dist/index.js
```

## Permissions

Grant **`contents: write`** to `GITHUB_TOKEN` so tag updates can succeed.

## Inputs

| Input                     | Required | Default                 | Description                                                                                          |
| ------------------------- | -------- | ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `tag_name`                | No       | release tag             | Tag to update. Defaults to `release.tag_name` on `release` events.                                   |
| `commit_message`          | No       | `Automatic compilation` | Commit message for the release tag update.                                                           |
| `additional_files`        | No       | —                       | Comma-separated extra files or directories (merged with `package.json` `files`). Literal paths only. |
| `update_major_minor_tags` | No       | `true`                  | Update floating major/minor tags (e.g. `v1`, `v1.0`).                                                |
| `working_directory`       | No       | workspace root          | Subdirectory containing `action.yml` / `package.json` for nested action layouts.                     |
| `dry_run`                 | No       | `false`                 | Resolve and log files/tags without creating commits or updating refs.                                |

## Outputs

| Output            | Description                                                     |
| ----------------- | --------------------------------------------------------------- |
| `commit_sha`      | SHA of the newly created commit (empty when `dry_run` is true). |
| `files_published` | Newline-separated list of files included in the publish tree.   |
| `tags_updated`    | Newline-separated list of tags that were (or would be) updated. |
| `dry_run`         | `true` when dry-run mode was used.                              |

## Behavior

- Entrypoints from `runs.main`, `runs.pre`, and `runs.post` in `action.yml` are included automatically (JS/Node action style). True composite actions (`using: composite` + `runs.steps`) are not auto-discovered.
- `additional_files` and `package.json` `files` are literal paths or directories (walked recursively). Glob patterns are **not** expanded.
- Files are uploaded as base64 blobs so binary assets are not corrupted.
- Floating major/minor tags are skipped for draft and pre-release releases.
- `GITHUB_TOKEN` is required via `env` (standard `github.token`).
>>>>>>> Stashed changes

## License

MIT. See [LICENSE](LICENSE).
