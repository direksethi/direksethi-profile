// Recompute CSP hashes for the inline <script>/<style> blocks in public/*.html.
// Run after editing any inline block:  npm run csp
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

const sha = (s) => "'sha256-" + createHash("sha256").update(s, "utf8").digest("base64") + "'";
const pages = readdirSync("public").filter((f) => f.endsWith(".html"));

const collect = (tag) => {
  const out = new Set();
  for (const page of pages) {
    const html = readFileSync(`public/${page}`, "utf8");
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "g");
    for (const m of html.matchAll(re)) out.add(sha(m[1]));
  }
  return [...out].join(" ");
};

const scripts = collect("script");
const styles = collect("style");

// Replace only the string literal on the line carrying the AUTO marker.
const patch = (src, marker, value) =>
  src.replace(
    new RegExp(`(const ${marker} = )"[^"]*"(; /\\* AUTO:)`),
    `$1${JSON.stringify(value)}$2`,
  );

let worker = readFileSync("src/index.js", "utf8");
worker = patch(worker, "CSP_SCRIPT", scripts);
worker = patch(worker, "CSP_STYLE", styles);
writeFileSync("src/index.js", worker);

console.log(`${pages.length} page(s)\n  script-src ${scripts}\n  style-src  ${styles}`);
