# Privacy

**Nothing leaves your device.**

- There is **no account**, no sign-in, and no server.
- There are **no analytics**, no tracking, no cookies, and no third-party scripts.
- The app makes **no network requests at all** — the only `http` string in the
  file is the SVG namespace.

## What is stored, and where

Your reading progress, kept practices, notes, streak, XP and achievements are
stored in your browser's **local storage**, on your device, under the key
`rlt.v2`. They are not transmitted anywhere.

## Removing your data

- **In the app:** *You → Reset my data* clears everything.
- **In the browser:** clearing site data for the page does the same.

## The service worker

The service worker caches the app's own files so it works offline. It caches only
this app's assets, and never sends anything anywhere.
