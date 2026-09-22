# SnipTeX

A Firefox extension that copies any part of a Claude reply on claude.ai as Markdown. Math stays as LaTeX instead of turning into garbled glyphs.

- Inline math → `$…$`, display math → `$$…$$`, read from KaTeX's `<annotation encoding="application/x-tex">`
- If a selection starts or ends inside an equation, it grows to include the whole equation. It does the same for tables, unless you're selecting inside a single cell.
- Headings, lists, bold/italic, links, GFM tables, and fenced code blocks with the language (`language-xxx` class) are converted by [Turndown](https://github.com/mixmark-io/turndown) and its GFM plugin (bundled in `vendor/`)

## Usage

Select text in a Claude reply, then either:

- press **Ctrl+Alt+C** (⌘⌥C on macOS), or
- right-click → **Copy as Markdown**

A small toast confirms the copy.

### Changing the shortcut

Use either of these:

- **Extension options:** `about:addons` → SnipTeX → *Preferences*. Click the box, press the new combination, then click *Save*. *Reset to default* restores Ctrl+Alt+C.
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

### Conversion test

`test/harness.html` runs the conversion on a hand-written KaTeX fixture and prints the Markdown for each case. Open it in a browser, or run:

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
test/                offline conversion harness
```

## Caveats

- claude.ai's markup can change. The KaTeX annotation is stable, but code-block language detection depends on a `language-xxx` class being present.
- The extension only runs on claude.ai. Other sites that use KaTeX should work if you add them to `host_permissions` and the content script's `matches`.
