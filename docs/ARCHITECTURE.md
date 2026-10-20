# Architecture

## One file, no build

The entire application — the book text, the interface, the logic and the fonts —
lives in a single `index.html` of about **292 KB**. There is no bundler, no
transpiler, no package manager, and no dependencies. Open the file and it runs.

The file contains four things:

1. a `<style>` block — the book's stylesheet, the app's stylesheet, and the
   embedded (subset) webfonts;
2. `<script id="bookdata" type="application/json">` — the whole book as data;
3. a `<script>` — the application logic;
4. the HTML shell (header, tabs, dock, modal, toast).

## Data model

The book is embedded as JSON: `meta`, `parts` (12), `chapters` (74, each with its
verse, practice, questions and rendered HTML), `matter`, and `glossary`. The app
renders chapters by injecting their stored HTML into the reader.

## State

Everything the user does is kept in one object in `localStorage`, under the key
`rlt.v2`:

```
read     { [chapter]: true }          chapters marked read
moves    [ { n, text, done{}, ... } ] practices kept, with the days done
notes    { "chapter:question": text }  written answers
seven    { start, done{} }            the seven-day practice
days     [ "YYYY-MM-DD", ... ]        days opened
streak   number                       consecutive days
xp       number                       total XP
level    number                       last seen level (for level-ups)
earned   { [eventKey]: true }         one-off XP guards (prevents farming)
ach      [ id, ... ]                  achievements unlocked
```

## The interface

Four tabs — **Today**, **Read**, **Practice**, **You** — plus a chapter reader
and the front/back matter. The active screen is reflected in the URL hash
(`#today`, `#chapter:12`), so any screen can be linked or bookmarked.

## Offline

`sw.js` is a cache-first service worker. Its cache name is derived from a hash of
the built HTML, so a new build invalidates the old cache automatically. The app
shell is precached on install; everything else is cached on first use.

## Fonts

**EB Garamond** and **Cinzel** are embedded as base64 WOFF2. Each is a single
*variable* font (it carries a weight axis), declared once per family and style
with a weight range, and **subset** to only the glyphs the app can display. See
[AUDIT.md](AUDIT.md).

## Browser support

Any browser from 2021 onward. Uses standard APIs only: `localStorage`, service
workers, `navigator.clipboard` (with a fallback), CSS custom properties and grid.
