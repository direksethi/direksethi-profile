# direksethi.com

Static site for direksethi.com, served by a Cloudflare Worker (`direksethi`) that
handles the `www` -> apex redirect, HTTPS upgrade, cache policy and security headers
before falling through to the assets in `public/`.

## Layout

| Path                | What it is                                                    |
| ------------------- | ------------------------------------------------------------- |
| `public/`           | The site itself — HTML, fonts, icons, sitemap, robots.txt      |
| `src/index.js`      | The Worker: redirects, `Cache-Control`, CSP + security headers |
| `scripts/csp.mjs`   | Regenerates the CSP hashes for the inline `<script>`/`<style>` |
| `test/routing.test.mjs` | Redirect, method and cache-policy assertions (no deps)     |
| `test/visual.mjs`   | Local-only screenshots via Chrome CDP (macOS path, not in CI)  |

## Local

```sh
npm install
npm run dev     # wrangler dev on http://localhost:8787
npm test        # routing + cache-policy assertions
```

## Editing inline `<script>` or `<style>` in public/*.html

The CSP allows those blocks by hash. After any edit to an inline block:

```sh
npm run csp     # rewrites CSP_SCRIPT / CSP_STYLE in src/index.js
```

Commit the resulting `src/index.js` change. CI fails the build if you forget —
without it the browser blocks the block and the page renders unstyled.

## Fonts

Both faces in `public/f/` are self-hosted because the CSP sets `font-src 'self'`,
and are subset to only the characters the headings use. The filename carries a
content hash, which `cacheControl()` in the Worker keys the immutable one-year
`Cache-Control` off, so a new file needs a new hash in its name.

| File | Face | Used for |
| ---- | ---- | -------- |
| `geist.8c11c909.woff2` | Geist, variable 100-900 | body, `--sans` |
| `title.fd630d84.woff2` | Source Serif 4, `wght` 400 / `opsz` 24 | headings, `--title` |

`opsz` is instanced to 24 to match the 1.5rem `h1`. Regenerating the heading font
needs the variable original from google/fonts and fonttools:

```sh
pyftsubset SourceSerif4-400-opsz24.ttf \
  --text="Direk Sethi Software Developer & AI Engineer404Pagntfud" \
  --layout-features="kern,liga,calt" --flavor=woff2 \
  --no-hinting --desubroutinize --name-IDs="0,1,2,3,4,5,6" \
  --output-file=title.woff2
```

The `--text` string is the union of the `h1` text on `index.html` and `404.html`.
Changing a heading means re-subsetting, or the new characters fall back to Arial.

The `"Title Fallback"` / `"Sans Fallback"` `@font-face` blocks are metric overrides
against Arial that hold the layout still during the swap. `size-adjust` is the
font's average character width over `aaabcdeeeefghiijklmnnoopqrstuuvwxyz` plus six
spaces, divided by Arial's; `ascent-override` and friends are the hhea metrics
divided by that ratio. Recompute them if either face changes.

## Deploying

Push to `main`. `.github/workflows/deploy.yml` runs the tests and the CSP check,
then `wrangler deploy`. Nothing to run by hand, from any machine.

Pull requests run the same tests but do not deploy.

Manual deploy, if you ever need it:

```sh
npm run deploy  # needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
```

CI credentials live in the repo's Actions secrets (`CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`).

## On the devbox

`wrangler dev` binds to localhost by default, which is unreachable over the
tailnet. Use the LAN script so you can hit it from another machine:

```sh
npm run dev:lan     # http://devbox:8787
```

Node lives under nvm there, so a non-interactive shell needs
`. ~/.nvm/nvm.sh` before `npm` is on PATH.
