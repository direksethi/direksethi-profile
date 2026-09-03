const worker = (await import("../src/index.js")).default;

const env = {
  ASSETS: {
    fetch: async (req) =>
      new Response("asset:" + new URL(req.url).pathname, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
  },
};

// The edge reports the visitor's scheme; local dev sends neither header.
const edge = (scheme) => ({ "cf-visitor": JSON.stringify({ scheme }) });

let fail = 0;
async function check(label, url, { method = "GET", headers = {} } = {}, want) {
  const res = await worker.fetch(new Request(url, { method, headers }), env);
  const got = { status: res.status, location: res.headers.get("location") };
  const ok =
    got.status === want.status &&
    (want.location === undefined || got.location === want.location);
  console.log(
    `${ok ? "ok  " : "FAIL"} ${label.padEnd(46)} ${got.status} ${got.location ?? ""}`,
  );
  if (!ok) { console.log(`     wanted ${JSON.stringify(want)}`); fail++; }
}

// host canonicalisation
await check("www -> apex, path+query kept", "https://www.direksethi.com/some/path?q=1", { headers: edge("https") },
  { status: 301, location: "https://direksethi.com/some/path?q=1" });
await check("www root -> apex", "https://www.direksethi.com/", { headers: edge("https") },
  { status: 301, location: "https://direksethi.com/" });
await check("workers.dev -> apex", "https://direksethi.workers.dev/og.png", { headers: edge("https") },
  { status: 301, location: "https://direksethi.com/og.png" });

// scheme upgrade, driven by the edge headers
await check("http apex -> https", "https://direksethi.com/", { headers: edge("http") },
  { status: 301, location: "https://direksethi.com/" });
await check("http www -> https apex", "https://www.direksethi.com/x", { headers: edge("http") },
  { status: 301, location: "https://direksethi.com/x" });
await check("x-forwarded-proto http -> https", "https://direksethi.com/og.png",
  { headers: { "x-forwarded-proto": "http" } },
  { status: 301, location: "https://direksethi.com/og.png" });

// canonical requests are served
await check("https apex serves", "https://direksethi.com/", { headers: edge("https") }, { status: 200 });
await check("hashed font serves", "https://direksethi.com/f/geist.8c11c909.woff2", { headers: edge("https") }, { status: 200 });
await check("/index.html -> /", "https://direksethi.com/index.html", { headers: edge("https") },
  { status: 301, location: "https://direksethi.com/" });
await check("POST rejected", "https://direksethi.com/", { method: "POST", headers: edge("https") }, { status: 405 });

// local dev: no edge headers, so no scheme upgrade and no redirect loop
await check("local dev http serves", "http://localhost:8787/", {}, { status: 200 });
await check("dev under route host serves", "http://direksethi.com/", {}, { status: 200 });

// cache policy
const cc = async (u) =>
  (await worker.fetch(new Request(u, { headers: edge("https") }), env)).headers.get("cache-control");
const font = await cc("https://direksethi.com/f/geist.8c11c909.woff2");
const html = await cc("https://direksethi.com/");
const pdf = await cc("https://direksethi.com/recommendations/evaheld.pdf");
console.log(`\nfont cache-control: ${font}`);
console.log(`html cache-control: ${html}`);
console.log(`pdf  cache-control: ${pdf}`);
if (!font.includes("immutable")) { console.log("FAIL font not immutable"); fail++; }
if (html.includes("immutable")) { console.log("FAIL html must not be immutable"); fail++; }
if (pdf.includes("immutable") || !pdf.includes("max-age=3600")) { console.log("FAIL pdf should be cached for an hour, not immutable"); fail++; }

console.log(fail === 0 ? "\nALL ASSERTIONS PASSED" : `\n${fail} ASSERTION(S) FAILED`);
process.exit(fail ? 1 : 0);
