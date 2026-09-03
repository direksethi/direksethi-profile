/**
 * direksethi.com — static site on Cloudflare Workers.
 *
 * Responsibilities beyond serving assets:
 *   1. canonical host: www.direksethi.com -> direksethi.com (301, path + query preserved)
 *   2. cache policy: immutable for content-hashed fonts, edge-cached HTML
 *   3. security headers
 */

const CANONICAL = "direksethi.com";

// Hashes of the inline <script>/<style> blocks in public/*.html.
// Regenerate with `npm run csp` after editing any inline block.
const CSP_SCRIPT = "'sha256-Dv0qEWZ7UCd4sY6Uu2wTZnf9XM2AdYqpQZBcOIGOybU=' 'sha256-NBg3ch/D7XAZMIraaKRRQ16WXBy2iVPX/bEJkbIroXA='"; /* AUTO:script */
const CSP_STYLE = "'sha256-3Avv9NKO4UAK4HezOnmYoLTxsKACpslOaXCpBbw4vq0=' 'sha256-O+OFkwf0+Y7TjQGrfSK7V8cNAhVd5WfRnHdM3ZlEaoc='"; /* AUTO:style */

const SECURITY = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy":
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  "Content-Security-Policy": [
    "default-src 'none'",
    `script-src ${CSP_SCRIPT}`,
    `style-src ${CSP_STYLE}`,
    "font-src 'self'",
    "img-src 'self' data:",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; "),
};

/** Cache-Control by asset class. Fonts carry a content hash, so they are immutable. */
function cacheControl(pathname) {
  if (/\.[0-9a-f]{8}\.woff2$/.test(pathname)) {
    return "public, max-age=31536000, immutable";
  }
  if (/\.(png|svg|ico)$/.test(pathname)) {
    return "public, max-age=86400, stale-while-revalidate=604800";
  }
  if (/\.(xml|txt|webmanifest|pdf)$/.test(pathname)) {
    return "public, max-age=3600, stale-while-revalidate=86400";
  }
  // HTML: revalidate quickly in the browser, serve hot from the edge.
  return "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800, must-revalidate";
}

const isLocal = (host) =>
  host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");

/**
 * The scheme the visitor actually used, as reported by the Cloudflare edge.
 * Returns null when those headers are absent (local dev), so the HTTPS upgrade
 * stays inert there instead of fighting the dev server's own URL rewriting.
 */
function visitorScheme(request) {
  const visitor = request.headers.get("cf-visitor");
  if (visitor) {
    try {
      const scheme = JSON.parse(visitor).scheme;
      if (scheme) return scheme;
    } catch {
      /* malformed header: fall through */
    }
  }
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim();
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Force the canonical origin: https + apex host.
    //    Covers www, *.workers.dev and any plain-http entry point.
    const wrongHost = url.hostname !== CANONICAL;
    const wrongScheme = visitorScheme(request) === "http";
    if ((wrongHost || wrongScheme) && !isLocal(url.hostname)) {
      url.hostname = CANONICAL;
      url.protocol = "https:";
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }

    // 2. Only GET/HEAD make sense for a static site.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD", ...SECURITY },
      });
    }

    // 3. Collapse /index.html to / so there is a single canonical URL.
    if (url.pathname === "/index.html") {
      url.pathname = "/";
      return Response.redirect(url.toString(), 301);
    }

    const asset = await env.ASSETS.fetch(request);
    const response = new Response(asset.body, asset);

    response.headers.set("Cache-Control", cacheControl(url.pathname));
    for (const [key, value] of Object.entries(SECURITY)) {
      response.headers.set(key, value);
    }
    if (/\.woff2$/.test(url.pathname)) {
      response.headers.set("Access-Control-Allow-Origin", "*");
    }
    response.headers.delete("X-Powered-By");

    return response;
  },
};
