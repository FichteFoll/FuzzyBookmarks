# CLAUDE.md

## Project

FuzzyBookmarks is a Firefox-only WebExtension (Manifest V3, TypeScript)
whose popup files the current page as a bookmark
into a folder chosen via fuzzy matching,
entirely keyboard-driven.
Other browsers are a non-goal and must not steer decisions.

## Commands

All commands run from the repository root via pnpm.

- Style checks (every commit): `pnpm lint`, `pnpm format:check`
- Code checks (commits touching code): `pnpm typecheck`, `pnpm test`
- Slow checks (before release / final verification):
  `pnpm build`, then `pnpm exec web-ext lint --source-dir dist`

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
  in `resolveCommitKind` in `src/lib/bookmark-actions.ts`;
  UI captions derive from that kind
  instead of re-deriving the create/update/move/copy conditions.
- `storage.local` keys: `settings`, `queryMemory`, `folderRecency`.
- `package.json` is the single source of truth for the version;
  release it with `pnpm version`, never by editing a version by hand.

## Commits

- Short imperative subject, no prefix convention.
- Every agent-authored commit must carry a Co-Authored-By footer
  identifying the agent, e.g.
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
