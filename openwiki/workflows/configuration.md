# Configuration Reference

## Overview

This document provides detailed specifications for all configuration options available in the build-and-tag-action. It covers inputs, outputs, environment variables, and action metadata.

## Action Metadata

### Basic Information

```yaml
# From /action.yml
name: Build and Tag
description: Properly tags your GitHub Action
author: JasonEtco
runs:
  using: node24
  main: dist/index.js
branding:
  icon: archive
  color: blue
```

### Runtime Requirements

- **Node.js**: Version 24 (as specified in `action.yml`)
- **Permissions**: `contents: write` (minimum)
- **Event Types**: Any, but optimized for `release` events

## Input Parameters

### `tag_name`

**Description**: The tag to update. If the workflow event is `release`, it will use the `tag_name` from the event payload.

| Property     | Value                              |
| ------------ | ---------------------------------- |
| **Required** | No                                 |
| **Default**  | None (falls back to release event) |
| **Type**     | String                             |
| **Examples** | `v1.0.0`, `latest`, `beta-1`       |

**Usage Examples**:

```yaml
# Explicit tag name
- uses: iShark5060/build-and-tag-action@v1
  with:
    tag_name: v1.2.3

# Use release event tag (default for release events)
- uses: iShark5060/build-and-tag-action@v1
  # tag_name automatically set to release.tag_name

# Custom logic
- uses: iShark5060/build-and-tag-action@v1
  with:
    tag_name: ${{ steps.version.outputs.tag }}
```

**Behavior**:

1. If provided, uses this value as the tag to update
2. If not provided and event is `release`, uses `release.tag_name`
3. If not provided and event is not `release`, throws error

**Source**: `/src/lib/get-tag-name.ts`

### `commit_message`

**Description**: Commit message for the release tag update.

| Property     | Value                                  |
| ------------ | -------------------------------------- |
| **Required** | No                                     |
| **Default**  | `Automatic compilation`                |
| **Type**     | String                                 |
| **Examples** | `Build v1.0.0`, `Update action bundle` |

**Usage Examples**:

```yaml
- uses: iShark5060/build-and-tag-action@v1
  with:
    commit_message: 'Build version ${{ github.ref_name }}'
```

**Behavior**:

- If empty or not provided, uses default value
- Included in Git commit metadata

**Source**: `/src/inputs.ts` (lines 1-5)

### `additional_files`

**Description**: Comma-separated list of extra files to include in the release tag (merged with `package.json` `files`).

| Property     | Value                           |
| ------------ | ------------------------------- |
| **Required** | No                              |
| **Default**  | Empty string                    |
| **Type**     | String (comma-separated paths)  |
| **Examples** | `docs/,LICENSE,assets/icon.png` |

**Usage Examples**:

```yaml
# Single file
- uses: iShark5060/build-and-tag-action@v1
  with:
    additional_files: LICENSE

# Multiple files
- uses: iShark5060/build-and-tag-action@v1
  with:
    additional_files: |
      README.md,
      docs/,
      assets/

# With package.json files field
# package.json: { "files": ["dist/", "action.yml"] }
- uses: iShark5060/build-and-tag-action@v1
  with:
    additional_files: CHANGELOG.md,assets/
```

**Behavior**:

1. Split by commas (supports multi-line YAML with trailing commas)
2. Each path trimmed of whitespace
3. Missing files generate warnings but don't fail action
4. Directories expanded recursively
5. Merged with other file sources (action.yml, package.json)

**Path Resolution**:

- Relative to workspace root
- Forward slashes recommended (backslashes normalized)
- Supports literal paths and directories from the `package.json` `files` field; glob patterns are not expanded

**Source**: `/src/inputs.ts` (lines 7-13), `/src/lib/resolve-publishable-files.ts`

### `update_major_minor_tags`

**Description**: Update floating major and minor version tags (for example v1 and v1.0).

| Property         | Value            |
| ---------------- | ---------------- |
| **Required**     | No               |
| **Default**      | `true`           |
| **Type**         | Boolean (string) |
| **Valid Values** | `true`, `false`  |

**Usage Examples**:

```yaml
# Update floating tags (default)
- uses: iShark5060/build-and-tag-action@v1
  with:
    update_major_minor_tags: true

# Skip floating tags
- uses: iShark5060/build-and-tag-action@v1
  with:
    update_major_minor_tags: false
```

**Behavior**:

- `'true'` (string): Updates floating tags
- `'false'` (string): Skips floating tags
- Empty or any other value: Defaults to `true`
- Combined with other rules (draft/pre-release checks)

**Floating Tag Rules**:
Even when `true`, floating tags are skipped if:

1. Release is a draft (`release.draft: true`)
2. Release is a pre-release (`release.prerelease: true`)
3. Tag contains pre-release identifier (e.g., `v1.0.0-alpha.1`)
4. Tag is not valid semver

**Source**: `/src/inputs.ts` (lines 15-18), `/src/lib/index.ts` (lines 17-40)

## Output Values

### `commit_sha`

**Description**: SHA of the commit newly created.

| Property    | Value                                      |
| ----------- | ------------------------------------------ |
| **Type**    | String                                     |
| **Format**  | Git commit SHA (40-character hex)          |
| **Example** | `a8fa90ee46ca27201cf30fa5bb3adf191bbef382` |

**Usage Examples**:

```yaml
- uses: iShark5060/build-and-tag-action@v1
  id: tagger

- name: Use commit SHA
  run: echo "Commit ${{ steps.tagger.outputs.commit_sha }} created"
```

**Behavior**:

- Set after successful commit creation
- Can be used for verification or downstream steps
- Corresponds to the commit containing compiled files

**Source**: `/src/index.ts` (line 8)

## Environment Variables

### `GITHUB_TOKEN`

**Description**: GitHub token for API authentication.

| Property        | Value                       |
| --------------- | --------------------------- |
| **Required**    | Yes                         |
| **Type**        | String                      |
| **Permissions** | `contents: write` (minimum) |

**Usage Examples**:

```yaml
- uses: iShark5060/build-and-tag-action@v1
  env:
    GITHUB_TOKEN: ${{ github.token }}
```

**Behavior**:

- Validated at action startup
- Used for all GitHub API calls
- Requires `contents: write` permission for tag operations

**Permission Requirements**:

```yaml
permissions:
  contents: write # Minimum required
```

**Source**: `/src/context.ts` (lines 8-13)

## File Resolution Configuration

### Automatic File Discovery

The action automatically discovers files from these sources (in order):

1. **Action Configuration** (`action.yml`/`action.yaml`)
   - The file itself
   - `runs.main` entrypoint
   - `runs.pre` entrypoint (if present)
   - `runs.post` entrypoint (if present)

2. **Package Configuration** (`package.json`)
   - `main` field (required if only one entrypoint)
   - `files` array (npm-style file patterns)

3. **User Input** (`additional_files`)
   - Comma-separated list
   - Merged with other sources

### `package.json` Configuration

**Required Fields**:

```json
{
  "main": "dist/index.js",
  "type": "module"
}
```

**Optional Fields**:

```json
{
  "files": ["dist/", "action.yml", "README.md"]
}
```

**Validation Rules**:

- `main` required if only one file found
- `files` patterns use npm semantics
- `type: "module"` recommended for ES modules

### `action.yml` Configuration

**Required Structure**:

```yaml
runs:
  using: node24
  main: dist/index.js # Will be automatically included
```

**Composite Actions**:

```yaml
runs:
  using: composite
  steps: [...]
  pre: dist/pre.js # Automatically included
  post: dist/post.js # Automatically included
```

## GitHub Event Configuration

### Release Events

**Optimal Configuration**:

```yaml
on:
  release:
    types: [published]
```

**Event Payload Usage**:

- `release.tag_name`: Used as default tag name
- `release.draft`: Skips floating tags if `true`
- `release.prerelease`: Skips floating tags if `true`

**Supported Release Types**:

- `published`: Full release (updates all tags)
- `prereleased`: Pre-release (updates only release tag)
- `released`: Generic release (same as published)
- `created`: New release created

### Non-release Events

**Requires Explicit Tag**:

```yaml
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to tag'
        required: true
```

**Manual Tag Specification Required**:

```yaml
- uses: iShark5060/build-and-tag-action@v1
  with:
    tag_name: v${{ github.event.inputs.version }}
```

## Permission Configuration

### Minimal Permissions

```yaml
permissions:
  contents: write
```

### Extended Permissions (if needed)

```yaml
permissions:
  contents: write # Required for tags
  id-token: write # For attestations
  attestations: write # For artifact attestations
```

### Repository-wide Permissions

```yaml
# Top of workflow file
permissions:
  contents: write

# Or job-specific
jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
```

## Error Conditions and Codes

### Validation Errors (Pre-execution)

| Error Message                                                                       | Cause                                       | Solution                                         |
| ----------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------ |
| `No tag name provided`                                                              | No `tag_name` input and not a release event | Provide `tag_name` or trigger on release         |
| `Could not find action.yml or action.yaml in workspace`                             | Missing action configuration file           | Add `action.yml` to repository root              |
| `Only one file was found to publish, and package.json does not have a "main" field` | Insufficient files with missing `main`      | Add `main` to package.json or include more files |
| Missing `GITHUB_TOKEN`                                                              | No token provided                           | Add `GITHUB_TOKEN: ${{ github.token }}`          |

### Runtime Errors

| Error Type         | Cause                              | Solution                          |
| ------------------ | ---------------------------------- | --------------------------------- |
| GitHub API 404     | Tag doesn't exist (for update)     | Action creates tag automatically  |
| GitHub API 403     | Insufficient permissions           | Add `contents: write` permission  |
| GitHub API 422     | Invalid request data               | Check file paths and names        |
| File System ENOENT | Missing file in `additional_files` | Fix file path or remove from list |

### Warning Conditions

| Warning Message                                                          | Cause                                        | Action                                            |
| ------------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------- |
| `File not found: {file}`                                                 | Missing file in `additional_files`           | File skipped, action continues                    |
| `Skipping major/minor tag update: [{tagName}] is not a valid semver tag` | Non-semver tag with floating updates enabled | Consider using semver or disable floating updates |

## Default Values Reference

| Input                     | Default Value           | When Applied                    |
| ------------------------- | ----------------------- | ------------------------------- |
| `tag_name`                | `release.tag_name`      | Only on release events          |
| `commit_message`          | `Automatic compilation` | When input empty/missing        |
| `additional_files`        | Empty array             | When input empty/missing        |
| `update_major_minor_tags` | `true`                  | When input empty or not 'false' |

## TypeScript/JavaScript Interface

### Programmatic Usage (Advanced)

While primarily designed as a GitHub Action, the core logic can be used programmatically:

```typescript
import buildAndTagAction from './lib';
import { createContext } from './context';

// Create mock context for testing or programmatic use
const context = {
  github: mockOctokit,
  repo: { owner: 'owner', repo: 'repo' },
  workspace: '/path/to/workspace',
  sha: 'abc123',
  eventName: 'release',
  payload: { release: { tag_name: 'v1.0.0' } },
  getPackageJSON: async () => ({ main: 'dist/index.js' }),
};

const commitSha = await buildAndTagAction(context);
```

## Migration and Compatibility

### From Original Action (JasonEtco/build-and-tag-action)

**Backward Compatible**:

- Same input/output interface
- Same file resolution logic
- Same tag update behavior

**Differences**:

- Node.js 24 runtime (vs older versions)
- Updated dependencies
- Enhanced test coverage

### Version Compatibility

| Action Version   | Node Runtime | Key Changes             |
| ---------------- | ------------ | ----------------------- |
| `@v1` (current)  | Node.js 24   | Current maintained fork |
| `@v2` (original) | Node.js 16   | Original by JasonEtco   |
| `@v1` (original) | Node.js 12   | Initial release         |

---

**Related**: [Usage Patterns](usage.md) for practical examples, [Business Rules](../architecture/business-rules.md) for logic details.
