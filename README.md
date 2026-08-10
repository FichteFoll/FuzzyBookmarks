# FuzzyBookmarks

A Firefox extension for filing the current page as a bookmark
into a folder chosen via fuzzy matching,
entirely keyboard-driven.

## About

FuzzyBookmarks replaces the click-heavy bookmark dialog
with a popup built around a single fuzzy folder search:
type a few characters of the target folder's path,
pick a match with the arrow keys,
and press Enter.
Existing bookmarks are edited or moved instead of duplicated.

This addon was written with AI assistance.

## Usage

_To be documented once the popup behavior lands._

## Keyboard shortcut

_To be documented once the Ctrl+D binding lands._

## Settings

_To be documented once the options page lands._

## Development

The toolchain is pinned with [mise](https://mise.jdx.dev/)
(node and pnpm versions in `mise.toml`),
and dependencies are managed with pnpm:

```sh
mise install
pnpm install
```

### Package scripts

| Script              | Purpose                                        |
| ------------------- | ---------------------------------------------- |
| `pnpm build`        | Bundle the extension into `dist/` with esbuild |
| `pnpm watch`        | Rebuild on source changes                      |
| `pnpm start`        | Run the built extension via `web-ext run`      |
| `pnpm lint`         | ESLint (flat config, type-checked rules)       |
| `pnpm format`       | Format everything with Prettier                |
| `pnpm format:check` | Verify formatting                              |
| `pnpm typecheck`    | `tsc --noEmit`                                 |
| `pnpm test`         | Vitest unit tests                              |

### web-ext workflow

`pnpm build` writes a loadable extension to `dist/`;
`web-ext` is configured via `web-ext-config.mjs` to use it as its source dir.
Use `pnpm start` to launch a temporary Firefox profile with the addon,
and `pnpm exec web-ext lint --source-dir dist` to validate the build output.
For iterative work, run `pnpm watch` and `pnpm start` side by side.
