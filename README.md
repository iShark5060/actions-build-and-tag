# Build and Tag

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/iShark5060/actions-build-and-tag/ci.yml?style=flat-square&label=CI)](https://github.com/iShark5060/actions-build-and-tag/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/Node-%3E%3D24-339933?logo=node.js&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178C6?logo=typescript&logoColor=white&style=flat-square)
[![Cursor](https://img.shields.io/badge/Cursor-IDE-141414?logo=cursor&logoColor=white&style=flat-square)](https://cursor.com)

Publish JavaScript GitHub Actions to release tags and floating version tags (`v1`, `v1.2`). Build once, move the major tag, consumers on `@v1` pick it up.

This is a maintained fork of [JasonEtco/build-and-tag-action](https://github.com/JasonEtco/build-and-tag-action) by Jason Etco (MIT License). I use it so the Discord / release / MSVC actions in this folder actually have a `dist/` on the tag.

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

- Reference a **published tag** (`@v1`). `dist/index.js` is only on release tags; `@main` will not work.
- The publish commit contains **only** the resolved files, not the full repo tree. Tag refs are force-updated.
- Floating major/minor tags are skipped for drafts, pre-releases, and tags with a prerelease suffix.
- `additional_files` and `package.json` `files` are literal paths (directories walked recursively). Globs are not expanded. Composite actions (`using: composite`) are not auto-discovered.
- For other events, pass `tag_name` explicitly. `working_directory` must stay inside `GITHUB_WORKSPACE`.

## License

MIT. See [LICENSE](LICENSE).
