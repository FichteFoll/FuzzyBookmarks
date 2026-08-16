# Contributing

FuzzyBookmarks is a Firefox-only WebExtension (Manifest V3, TypeScript).
Other browsers are a non-goal and must not steer decisions.

## Setup

The toolchain is pinned with [mise](https://mise.jdx.dev/)
(node and pnpm versions in `mise.toml`),
and dependencies are managed with pnpm:

```sh
mise install
pnpm install
```

## Package scripts

All commands run from the repository root.

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

Which checks to run when:

- Style checks (every commit): `pnpm lint`, `pnpm format:check`
- Code checks (commits touching code): `pnpm typecheck`, `pnpm test`
- Slow checks (before release / final verification):
  `pnpm build`, then `pnpm exec web-ext lint --source-dir dist`

## web-ext workflow

`pnpm build` writes a loadable extension to `dist/`;
`web-ext` is configured via `web-ext-config.mjs` to use it as its source dir.
Use `pnpm start` to launch a temporary Firefox profile with the addon,
and `pnpm exec web-ext lint --source-dir dist` to validate the build output.
For iterative work, run `pnpm watch` and `pnpm start` side by side.

Alternatively, load `dist/manifest.json` manually via
about:debugging -> This Firefox -> Load Temporary Add-on.
Temporary add-ons are dropped when Firefox restarts.

## Tests

Tests run in Vitest's default `node` environment.
DOM-dependent popup tests run against
[happy-dom](https://github.com/capricorn86/happy-dom) instead,
opted into per file with a `// @vitest-environment happy-dom` docblock
on the file's first line.

## Layout

```
manifest.json            MV3, Firefox-only; carries no "version" key
mise.toml                pins node and pnpm
scripts/build.mjs        esbuild: every src/*/main.ts is an entry point;
                         copies *.html, *.css, icons/ to dist/ and writes
                         dist/manifest.json with the package.json version
docs/deploy.md           release pipeline and AMO signing setup
src/background/main.ts   event page (MV3 "background.scripts" in Firefox)
src/popup/               popup.html, popup.css, main.ts, ...
src/lib/                 pure logic modules, unit-tested
dist/                    build output, gitignored; web-ext runs from here
```

New extension parts (options page, content script, ...)
are added as `src/<part>/main.ts` plus assets
and picked up by the build script's glob;
do not edit `scripts/build.mjs` to register entry points.

## Code style

- TypeScript strict mode; ESLint and Prettier output is authoritative.
- Use early exits; keep the expected path unindented.
- Pure logic lives in `src/lib` with colocated `*.test.ts` files (Vitest);
  UI code stays a thin layer over it.
- All browser access uses the native `browser.*` promise API,
  typed via `@types/firefox-webext-browser`;
  no webextension-polyfill.
- Only `src/lib` modules read/write `storage.local` keys;
  UI code goes through those modules.

## Module contracts

- Folder identity is always the `BookmarkTreeNode.id`.
- Folder display strings always use the `/`-separated `path`
  from `src/lib/folders.ts`,
  with the bookmark root titles aliased as
  `Menu`, `Toolbar`, `Other`, and `Mobile`;
  the alias mapping is defined exactly once, in `folders.ts`.
- Every user-visible bookmark mutation (create/move/copy/remove)
  goes through `applyCommit` in `src/lib/bookmark-actions.ts`.
- The commit plan kind is decided exactly once,
  in `resolveCommitKind` in `src/lib/bookmark-actions.ts`,
  which follows the resolved target folder from `resolveTarget`,
  so no UI layer compares folders on its own;
  UI captions derive from that kind
  instead of re-deriving the create/update/rename/move/copy conditions.
- `storage.local` keys: `settings`, `queryMemory`, `folderRecency`.
- `package.json` is the single source of truth for the version;
  release it with `pnpm version`, never by editing a version by hand.

## Commits

- Short imperative subject, no prefix convention.
- Every agent-authored commit must carry a Co-Authored-By footer
  identifying the agent, e.g.
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Releasing

See [docs/deploy.md](docs/deploy.md)
for the tag-triggered signing pipeline and the AMO setup it needs.
