# Build and Tag

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/iShark5060/actions-build-and-tag/actions/workflows/ci.yml/badge.svg)](https://github.com/iShark5060/actions-build-and-tag/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/Node-%3E%3D24-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178C6?logo=typescript&logoColor=white)
[![Cursor](https://img.shields.io/badge/Cursor-IDE-141414?logo=cursor&logoColor=white)](https://cursor.com)

Publish JavaScript GitHub Actions to release tags and floating version tags (`v1`, `v1.2`).

> **Fork notice:** Maintained fork of [JasonEtco/build-and-tag-action](https://github.com/JasonEtco/build-and-tag-action) by Jason Etco (MIT License).

> **Always reference a published version tag** (e.g. `@v1`). The bundled action code (`dist/index.js`) is only committed to release tags, so referencing `@main` will not work.

## Usage

```yaml
name: Release

on:
  release:
    types: [published]

jobs:
  build-and-tag:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout
        uses: actions/checkout@v7
        with:
          ref: ${{ github.event.release.tag_name }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build action
        run: pnpm run build

      - uses: iShark5060/actions-build-and-tag@v1
        env:
          GITHUB_TOKEN: ${{ github.token }}
```

You can also provide `tag_name` explicitly for other events:

```yaml
- uses: iShark5060/actions-build-and-tag@v1
  with:
    tag_name: ${{ steps.releaser.outputs.tag_name }}
  env:
    GITHUB_TOKEN: ${{ github.token }}
```

## Consumer `package.json`

Set `main` to your compiled bundle and add a `build` script:

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

## Requirements

- Node.js 24+
- pnpm 11+

## Scripts

| Script              | Description                               |
| ------------------- | ----------------------------------------- |
| `pnpm run validate` | Format check, lint, typecheck, and tests. |
| `pnpm run build`    | Bundle `src/` into `dist/index.js` (CJS). |

## Development

Agent-oriented docs: [openwiki/quickstart.md](openwiki/quickstart.md).

Engineering standards: AppBase `docs/org-standards/` with [personal-repos.md](https://github.com/Dark-Avian-Labs/AppBase/blob/main/docs/org-standards/personal-repos.md) (GitHub-hosted runners).

## License

MIT. See [LICENSE](LICENSE).
