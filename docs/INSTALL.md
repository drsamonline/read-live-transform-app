# Install

The app is one self-contained file. There is nothing to build.

## Try it

Open `index.html` in any modern browser — Chrome, Edge, Safari or Firefox. It
works immediately and fully offline.

## Install it as an app

A PWA can be installed to the home screen when it is served over `http://localhost`
or `https://`. From the repository root:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

| Platform | How to install |
|---|---|
| **Android / Chrome** | Menu (⋮) → *Install app* / *Add to Home screen* |
| **iPhone / Safari** | Share → *Add to Home Screen* |
| **Desktop Chrome / Edge** | The install icon in the address bar |
| **Desktop Safari** | File → *Add to Dock* |

Once installed it opens full-screen, works with no internet, and keeps your data.

## Live copy

Published with GitHub Pages:

**https://drsamonline.github.io/read-live-transform-app/**

Open that on a phone and add it to the home screen — no server of your own needed.

## Hosting it yourself

Any static host works (GitHub Pages, Netlify, Cloudflare Pages, an S3 bucket, a
folder on your own server). Upload `index.html`, `manifest.webmanifest`,
`sw.js`, `icon-192.png` and `icon-512.png` together, at the same path.

## Requirements

- A modern browser (2021 or newer). No account, no internet, no install.
