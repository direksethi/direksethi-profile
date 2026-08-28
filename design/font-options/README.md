# Heading font options

Side by side comparison page used to pick the heading typeface for
direksethi.com, built 2026-08-28. Candidates were Instrument Serif, Newsreader,
Fraunces, EB Garamond, Spectral, Source Serif 4, Libre Baskerville, Crimson Pro,
Lora, and Playfair Display, set against Geist for body copy.

Outcome: Source Serif 4, shipped in commit 8837055.

`index.html` is the comparison grid. `after/index.html` is the chosen-font
preview of the real page. `f/` holds the two self-hosted woff2 files the live
site uses.

To view it, serve from the repo root and open over the tailnet, since localhost
is not reachable from the machine you browse on:

    setsid nohup python3 -m http.server 8080 --bind 0.0.0.0 \
      >/tmp/fonts.log 2>&1 < /dev/null &
    # http://devbox.tail661e11.ts.net:8080/design/font-options/
