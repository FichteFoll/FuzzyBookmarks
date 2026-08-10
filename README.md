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

Open the popup on the page you want to bookmark;
focus starts in the folder input
and the folder list below it is always visible.
With an empty input it shows recently used folders first
(and, when editing an existing bookmark, its current folder on top).

Type a few characters of the target folder's path
to fuzzy-filter the list;
matched characters are highlighted,
and ArrowUp/ArrowDown move the selection.
Press Enter anywhere in the form to file the bookmark
into the selected folder.
If the page is already bookmarked,
Enter moves the existing bookmark there instead of duplicating it,
and Shift+Enter files a copy while leaving the original untouched.

Pressing Enter without typing or navigating
files a new bookmark into the configured default folder,
or saves an existing bookmark in place
(title edits included).

Tab and Shift+Tab cycle through
the folder input, the title input,
and the Remove and Create/Save buttons.
Remove deletes the bookmark being edited and closes the popup;
it is disabled while the page is not bookmarked.

When the query matches no folder exactly,
the list ends with a `Create folder "<query>"` entry.
The query may be a `/`-separated path such as `dev/js/new`:
the longest existing prefix is reused
and the missing folders are created as a nested chain.
A leading `Menu`, `Toolbar`, `Other`, or `Mobile` segment
anchors the path at that bookmark root;
otherwise it is created under the default folder.

If several bookmarks exist for the current URL,
a selector listing title, folder, and date added
appears before the form;
pick the bookmark to edit with ArrowUp/ArrowDown and Enter.

## Keyboard shortcut

The addon binds Ctrl+D in two complementary ways:

- The extension command (`_execute_action`) suggests Ctrl+D,
  but Firefox does not reliably let extensions
  override its built-in shortcuts,
  and the behavior differs between platforms.
  You can (re)assign the shortcut yourself under
  about:addons -> gear menu -> Manage Extension Shortcuts.
- A content script intercepts Ctrl+D on normal web pages
  and opens the popup,
  covering the cases where the built-in binding wins.
  It cannot run on privileged pages
  (`about:*` pages, `addons.mozilla.org`, the built-in PDF viewer);
  there only the extension command applies.
  Pages that handle Ctrl+D themselves
  (e.g. a spreadsheet's fill-down) keep their behavior.

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
