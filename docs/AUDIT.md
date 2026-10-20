# Code audit and size

A deep pass over the app: correctness, security, offline integrity,
accessibility, and size. Every change was re-tested afterwards.

## Size

| | Before | After |
|---|---|---|
| `index.html` (the whole app) | 909 KB | **292 KB** |
| — of which embedded fonts | 640 KB | 94 KB |
| — of which book data | 212 KB | 149 KB |
| gzip of `index.html` | — | 117 KB |

The app is still one self-contained file; nothing was moved out of it.

## What was wrong, and what was fixed

**1. Fonts were embedded three to four times over.** Each family is a single
*variable* font (it carries a `wght` axis), but the CSS declared it once per
weight — EB Garamond five times, Cinzel four, Inter three — with the *identical*
file each time: 12 faces, 640 KB. Fixed: one face per family and style, declared
with a weight **range** (`font-weight: 400 700`) and **subset** to only the glyphs
the app can display. Result: 3 faces, 94 KB, and real variable weights.

**2. Dead weight in the book data.** The JSON carried fields the app never read,
and its HTML kept all the source indentation. Unused fields dropped, whitespace
collapsed, JSON written compact. 212 KB → 149 KB.

**3. CSS and JS shipped with comments and formatting.** Both are minified at build
time — safely: no spaces are removed around `:` or `>` in selectors, so descendant
selectors and pseudo-classes are untouched.

**4. A storage write on every keystroke.** Typing in a question box wrote the whole
state to `localStorage` per character. Now debounced (400 ms).

**5. `localStorage` could throw.** In private mode or with storage disabled,
`setItem` raises and would have broken the app. `save()` is guarded.

**6. The service worker could serve a stale app.** Its cache name was a hardcoded
string, so an updated build kept serving the old cached copy. It is now derived
from a hash of the built HTML.

**7. Accessibility.** Decorative icons are `aria-hidden`; the level-up panel is a
proper `role="dialog" aria-modal="true"`, labelled by its title, moves focus to
Continue, and locks background scroll while open. A `<meta name="description">`
was added.

## Verified

- **JavaScript syntax:** `node --check` on the extracted script — clean.
- **Service worker syntax:** `node --check` — clean.
- **Manifest:** valid JSON; icons (any + maskable), standalone display, colours.
- **Fully offline:** no external network references at all.
- **No injection path:** every user-entered value (notes) is escaped before it is
  rendered; no `eval`, `new Function` or `document.write`.
- **Functional test (simulated clicks, state read back):** the quest loop awards
  XP exactly as designed — Read +10, Keep +15, Done +5, quest +25; the seven-day
  practice +10/day with a +60 completion bonus; levels and ranks compute
  correctly; achievements unlock; the level-up panel shows and closes cleanly.

## Deliberate

- The storage key is `rlt.v2`; the schema changed with the level system.
- The book's stylesheet is kept identical to the printed editions', so the reader
  renders the book's own HTML exactly.
