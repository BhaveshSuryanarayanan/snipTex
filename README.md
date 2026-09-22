# SnipTeX

A Firefox extension that copies any part of an AI chat reply as Markdown. Math stays as LaTeX instead of turning into garbled glyphs.

Supported sites: **claude.ai**, **chatgpt.com**, **gemini.google.com**.

- Inline math → `$…$`, display math → `$$…$$` (or `\(…\)` / `\[…\]`, see [Math format](#math-format)). The source is read from KaTeX's `<annotation encoding="application/x-tex">` (Claude, ChatGPT) or the `data-math` attribute (Gemini).
- If a selection starts or ends inside an equation, it grows to include the whole equation. It does the same for tables, unless you're selecting inside a single cell.
- Code blocks come out as clean fences. Claude's language label and Copy button are removed, and the label is used as the fence language when the code has no `language-xxx` class
- Claude's web-search source badges become citations after the text: `claim ([site](url))`. Source links on other sites come through as ordinary Markdown links.
- Headings, lists, bold/italic, links, and GFM tables are converted by [Turndown](https://github.com/mixmark-io/turndown) and its GFM plugin (bundled in `vendor/`)

## Usage

Select text in a reply on any supported site, then either:

- press **Ctrl+Alt+C** (⌘⌥C on macOS), or
- right-click → **Copy as Markdown**

A small toast confirms the copy.

### Copy one equation

Right-click any equation → **Copy LaTeX** copies just its source, e.g. `\int_0^1 x^2\,dx`, with no `$` or other delimiters. It's ready to paste into Overleaf or a `.tex` file. The menu item only appears when you right-click an equation.

### Math format

Choose the default delimiters in the extension options (`about:addons` → SnipTeX → *Preferences*):

| Format | Inline | Display | Good for |
| --- | --- | --- | --- |
| Dollar (default) | `$…$` | `$$…$$` | Obsidian, Typora, GitHub, Jupyter |
| Bracket | `\(…\)` | `\[…\]` | LaTeX documents, Pandoc |

You can still copy in the other format for a single copy:

- right-click → **Copy as Markdown with …** (the menu names the other format), or
- the second command, *Copy selection as Markdown (other math format)*. It has no shortcut by default; set one on the options page.

### Changing shortcuts

Use either of these:

- **Extension options:** `about:addons` → SnipTeX → *Preferences*. Each command has its own row. Click the box, press the new combination, then click *Save*. *Reset to default* restores the original (Ctrl+Alt+C for the main copy, none for the other-format copy).
- **Firefox's built-in page:** `about:addons` → ⚙ → *Manage Extension Shortcuts*.

A shortcut needs one or two modifiers plus a key. Shift can't be the only modifier. F1–F12 work on their own.

> **AltGr layouts:** On Windows and Linux, some keyboard layouts (Polish, for example) treat Ctrl+Alt as AltGr. With those layouts, Ctrl+Alt+C types a character (e.g. `ć`) and the shortcut may not fire. Pick another combination, such as Alt+Shift+C.

## Development

You need Firefox and Node.js (only for Mozilla's `web-ext` tool).

```sh
npm install          # installs web-ext
npm start            # web-ext run: temporary install in a fresh profile, opens claude.ai
npm run lint         # web-ext lint
npm run build        # zip into web-ext-artifacts/
```

Without Node, load it as a temporary add-on: `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on…* → pick `manifest.json`. Firefox removes it when it restarts.

### Offline checks

`test/` has pages that run without installing the extension:

- `harness.html`: converts a hand-written KaTeX fixture and prints the Markdown for each case (selection expansion, both math formats, tables, code, Copy LaTeX lookup)
- `background.html`: loads `background.js` against a fake WebExtension API (`stub.js`)
- `options.html`: the real options page with scripted key presses, save/reset, and a format change

Open them in a browser, or run all three:

```sh
./test/run-harness.sh   # headless Chromium, prints results to stdout
```

## Permanent install (self-distributed, unlisted)

Release Firefox only installs signed add-ons. To sign for personal use without a public listing:

1. Create an account at <https://addons.mozilla.org> and generate API credentials at <https://addons.mozilla.org/developers/addon/api/key/>.
2. Change `browser_specific_settings.gecko.id` in `manifest.json` from `sniptex@local` to an ID of your own (e.g. `sniptex@yourname`). IDs must be unique on AMO.
3. Sign:
   ```sh
   export WEB_EXT_API_KEY=user:12345:67
   export WEB_EXT_API_SECRET=…
   npm run sign          # web-ext sign --channel=unlisted
   ```
4. Install the `.xpi` from `web-ext-artifacts/` by dragging it into Firefox.

Bump `version` in `manifest.json` before each new signing.

Firefox Developer Edition and Nightly can run unsigned builds if you set `xpinstall.signatures.required` to `false` in `about:config`.

## Layout

```
manifest.json        MV3 manifest (Firefox 140+)
background.js        context menu + keyboard command → message the tab; clipboard fallback
content.js           selection → LaTeX + Markdown → clipboard; toast
options/             shortcut settings page
vendor/              Turndown 7.2.4 + turndown-plugin-gfm 1.0.2 (unmodified, MIT)
test/                offline checks (conversion, background, options)
```

## Caveats

- The sites' markup can change. The KaTeX annotation is stable. Gemini support is based on its `data-math` attribute and has not been checked against every kind of reply. Code-block cleanup is a heuristic: it removes up to three wrapper levels of empty elements and one-word labels directly before a `<pre>`, so a real one-word line placed right before a code block can be mistaken for its label.
- To add another site that uses KaTeX, add it to `host_permissions` and the content script's `matches` in `manifest.json`, and to `SITE_PATTERNS` in `background.js`.
