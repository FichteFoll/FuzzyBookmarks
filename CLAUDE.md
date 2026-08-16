# CLAUDE.md

## Project

FuzzyBookmarks is a Firefox-only WebExtension (Manifest V3, TypeScript)
whose popup files the current page as a bookmark
into a folder chosen via fuzzy matching,
entirely keyboard-driven.
Other browsers are a non-goal and must not steer decisions.

## Required reading

[CONTRIBUTING.md](CONTRIBUTING.md) is binding for this repository
and covers the package scripts, project layout,
code style, module contracts and commit conventions.
Read it before changing code,
and keep it in sync when a convention changes.

## Working agreements

- Run the checks CONTRIBUTING.md lists for the kind of change made:
  style checks on every commit,
  code checks whenever code is touched,
  and the slow build plus `web-ext lint` before a release
  or as a final verification.
- Do not edit `scripts/build.mjs` to register new entry points;
  a new extension part is `src/<part>/main.ts` plus assets.
- Do not edit a version number by hand; `pnpm version` owns it.
- Every agent-authored commit carries a Co-Authored-By footer
  naming the model that did the work, e.g.
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
