# pikit-theme-slop — warm earthy color theme for [pi.dev](https://pi.dev)

A warm, earthy pi theme: terracotta primary (`#d67858`), warm-white text (`#f5f2ee`), covering all 51 pi color tokens including syntax highlighting, diff colors, and thinking level indicators.

Activate inside pi via `/settings → Theme → slop`, or set `"theme": "slop"` in `~/.pi/agent/settings.json`.

## Install

```bash
pi install npm:pikit-theme-slop
```

> [!TIP]
> Or grab the entire [pikit](https://github.com/adrianapan/pikit) setup, an opinionated pi.dev configuration that includes this theme.

## Packaging note

This directory doubles as the npm package [`pikit-theme-slop`](https://www.npmjs.com/package/pikit-theme-slop). The `.ignore` file keeps pi's theme auto-discovery from trying to parse `package.json` as a theme; git ignores neither.
