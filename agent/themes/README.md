# slop

A warm, earthy pi theme: terracotta primary (`#d67858`), warm-white text (`#f5f2ee`), covering all 51 pi color tokens including syntax highlighting, diff colors, and thinking level indicators.

Activate inside pi via `/settings → Theme → slop`, or set `"theme": "slop"` in `~/.pi/agent/settings.json`.

## Packaging note

The theme ships as part of the single [`pikit`](https://www.npmjs.com/package/pikit) package — not published standalone. The root `package.json` `pi.themes` block points at `./agent/themes/slop.json`, so there's no per-theme manifest here. Pi's theme auto-discovery scans this directory for non-hidden `*.json` files; only `slop.json` is present, so nothing else needs ignoring.
