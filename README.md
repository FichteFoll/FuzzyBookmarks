# FuzzyBookmarks

A Firefox extension for filing the current page as a bookmark
into a folder chosen via fuzzy matching,
entirely keyboard-driven.

## Features

- Fuzzy folder search over the full `/`-separated folder path,
  powered by [fuzzysort](https://github.com/farzher/fuzzysort),
  with matched characters highlighted.
- Fully keyboard-driven: type, select, Enter. No mouse needed.
- Recency-ordered folder list when the query is empty.
- Edits or moves an existing bookmark instead of duplicating it,
  with Shift+Enter to file a copy.
- Creates missing folders from the query,
  including nested chains such as `dev/js/new`.
- Ctrl+D binding, both as an extension command
  and via a content script for the cases Firefox does not hand over.
- Toolbar icon reflects the current page's state:
  filled when bookmarked,
  a theme-following outline when not.
- Configurable default folder for one-keypress filing.

This addon was written with AI assistance.

## Usage

1. Open the popup on the page you want to bookmark (Ctrl+D).
   Focus starts in the folder input,
   below the editable bookmark name.
2. Type a few characters of the target folder's path.
   The always-visible folder list filters as you type.
3. Move the selection with ArrowUp/ArrowDown.
4. Press Enter to file the bookmark into the selected folder.

Pressing Enter without typing or navigating
files the bookmark into the configured default folder,
or, for a page that is already bookmarked,
saves it in place including name edits.

### Commit actions

The commit button's caption names the action it will perform:

| Caption  | When                                                              |
| -------- | ----------------------------------------------------------------- |
| `Create` | The page is not bookmarked yet                                    |
| `Save`   | Bookmarked, no other folder targeted, and the name was not edited |
| `Rename` | Bookmarked, no other folder targeted, and the name was edited     |
| `Move`   | Bookmarked and a different folder is targeted                     |
| `Copy`   | Same as `Move`, but with Shift held                               |

"No other folder targeted" includes highlighting the bookmark's own current folder,
not just leaving the list unnarrowed.
Shift is ignored when the highlighted folder is the one the bookmark is already in,
so a bookmark cannot be duplicated into its own folder from the popup.

The caption follows the Shift key and the name input live,
and holding Shift applies whether the action is triggered
by Enter or by clicking the button.
While a commit would change nothing at all
(the caption stays `Save`),
the button is disabled;
Enter still closes the popup.

### Creating folders

When the query matches no folder exactly,
the list ends with a `Create folder "<resolved path>"` entry
showing the full target path the query resolves to.
The query may be a `/`-separated path such as `dev/js/new`:
the longest existing prefix is reused
and the missing folders are created as a nested chain.
A leading `Menu`, `Toolbar`, `Other`, or `Mobile` segment
anchors the path at that bookmark root;
otherwise it is created under the default folder.

### Other keys and controls

Tab and Shift+Tab cycle through
the name input, the folder input,
and the Remove and commit buttons.
Remove deletes the bookmark being edited and closes the popup;
it is disabled while the page is not bookmarked.

If several bookmarks exist for the current URL,
a selector listing name, folder path, and date added
replaces the popup's contents,
plus a trailing "New bookmark for this page" row;
pick the bookmark to edit,
or that row to file another bookmark for the page,
with ArrowUp/ArrowDown and Enter.
Enter only picks here,
it does not commit anything
and it does not close the popup.
The name and location form appears in its place
once a bookmark was picked.

### Keyboard shortcut

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

### Settings

The addon's options page (about:addons -> FuzzyBookmarks -> Preferences)
offers a single setting: the default folder.
It lists every bookmark folder by its full path,
plus a "Firefox default (Other)" entry for the unfiled bookmarks root.
The choice is saved immediately when changed.

The default folder is where a bookmark ends up
when Enter is pressed without narrowing the folder list
(empty query, no arrow-key selection)
on a page that is not bookmarked yet.
For a page that is already bookmarked,
Enter without narrowing instead keeps the bookmark in its current folder.

## Installation

Signed `.xpi` builds are attached to the
[GitHub releases](https://github.com/FichteFoll/FuzzyBookmarks/releases).
Install one by dragging it into a Firefox window,
or via about:addons -> gear icon -> "Install Add-on From File".

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for the toolchain, package scripts,
project layout and code conventions,
and [docs/deploy.md](docs/deploy.md) for the release pipeline.

## License

MIT, see [LICENSE](LICENSE).
