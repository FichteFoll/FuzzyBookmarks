# Deployment

FuzzyBookmarks is distributed as a Mozilla-signed `.xpi`,
built and signed by the `release` workflow
and attached to a GitHub release.

Signing is gated behind a GitHub environment with a required reviewer,
so no credential reaches a runner
until a human approves the run.

## Pipeline

`.github/workflows/release.yml` triggers on tags matching `v*.*.*`
and runs three jobs in sequence:

| Job       | Token scope       | What it does                                                                                           |
| --------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| `verify`  | `contents: read`  | Lint, format check, typecheck, test, build, `web-ext lint`; uploads `dist/` as an artifact             |
| `sign`    | `contents: read`  | Gated on the `amo-release` environment; signs `dist/` via the AMO API and uploads the resulting `.xpi` |
| `release` | `contents: write` | Attaches the `.xpi` to the GitHub release for the tag                                                  |

The gate sits between building and signing,
so the approval prompt only appears once the build is already green
and the credentials are never exposed to a run that would have failed anyway.

### Design notes

- Mozilla's AMO API has no OIDC trusted-publishing equivalent to PyPI's.
  It only accepts a JWT issuer/secret pair,
  so the credentials must be stored;
  scoping them to a protected environment
  is the closest available equivalent.
- Workflows declare `permissions: {}` at the top level
  and grant each job only the scope it needs,
  so a compromised step cannot write to the repository
  unless it is the release job.
- Third-party actions are pinned to commit hashes
  with the matching version in a trailing comment,
  so a moved tag cannot silently change what runs.
- GitHub ships no maintained first-party release action
  (`actions/create-release` is archived),
  so the release job calls the preinstalled GitHub CLI
  (`gh release create`) against the Releases API.

## One-time setup

### 1. AMO API credentials

1. Sign in at <https://addons.mozilla.org> with a Firefox account.
2. Generate a JWT issuer and secret at
   <https://addons.mozilla.org/developers/addon/api/key/>.
   The secret is shown exactly once.

The `browser_specific_settings.gecko.id` in `manifest.json`
(`fuzzybookmarks@fichtefoll`)
must stay stable across versions,
otherwise AMO treats every submission as a brand new add-on.

### 2. Protected environment

In the repository under Settings -> Environments:

1. Create an environment named `amo-release`.
2. Under "Deployment protection rules",
   enable "Required reviewers" and add yourself.
3. Optionally add a wait timer
   for a mandatory delay even after approval.
4. Under "Deployment branches and tags",
   restrict to the tag pattern `v*.*.*`
   so only release tags can request the environment.
5. Add the credentials as **environment** secrets on `amo-release`
   (not repository secrets, which every job could read):
   - `AMO_JWT_ISSUER`
   - `AMO_JWT_SECRET`

## Cutting a release

`package.json` is the only place the version is written.
`scripts/build.mjs` injects it into `dist/manifest.json` at build time,
and `pnpm version` writes it, commits and tags in one step,
so a release needs no manual version editing anywhere.

1. From a clean working tree on `main`, bump the version:

   ```zsh
   pnpm version minor   # or major / patch / an explicit 0.2.0
   ```

   This rewrites `package.json`,
   commits the change
   and creates the matching `v0.2.0` tag.
   AMO rejects a version number it has already seen,
   so every signing run needs a fresh bump.

2. Push the commit and the tag:

   ```zsh
   git push --follow-tags origin main
   ```

3. The workflow starts and runs `verify`.
4. When `sign` is reached,
   the run pauses with "Review pending deployments" in the Actions tab.
   Approve it to release the credentials to the runner.
5. AMO signs the package.
   The first submission to a channel
   can take anywhere from minutes to a few days
   if it is picked up for manual review;
   later ones are usually automated and quick.
6. `release` attaches the signed `.xpi`
   to the GitHub release for the tag,
   with auto-generated notes.

## Installing the result

The signed `.xpi` from the GitHub release installs in release Firefox
via drag-and-drop into the browser window,
or through `about:addons` -> gear icon -> "Install Add-on From File".

The workflow signs with `--channel unlisted`,
meaning the add-on is self-distributed
and does not appear in AMO's public catalogue.
Switch to `--channel listed` to publish it there instead.

## Local development

No signing involved:

```zsh
pnpm build
pnpm exec web-ext run --source-dir dist
```

Or load `dist/manifest.json` manually via
`about:debugging` -> This Firefox -> Load Temporary Add-on.
Temporary add-ons are dropped when Firefox restarts.
