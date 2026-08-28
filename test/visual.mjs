// Measure + screenshot the page under real mobile emulation via CDP.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL_ = process.argv[2] || "http://localhost:8787/";
const PORT = 9333;

const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, "--disable-gpu",
  "--no-first-run", "--user-data-dir=/tmp/cdp-profile", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let list;
for (let i = 0; i < 40; i++) {
  try { list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (list.length) break; } catch {}
  await sleep(250);
}
const ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
};
const send = (method, params = {}) =>
  new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });

await send("Page.enable");
await send("Runtime.enable");

const cases = [
  { name: "mobile-390",  w: 390,  h: 844,  mobile: true,  scheme: "light" },
  { name: "mobile-320",  w: 320,  h: 568,  mobile: true,  scheme: "light" },
  { name: "tablet-768",  w: 768,  h: 1024, mobile: true,  scheme: "light" },
  { name: "desktop",     w: 1280, h: 800,  mobile: false, scheme: "light" },
  { name: "desktop-dark",w: 1280, h: 800,  mobile: false, scheme: "dark"  },
];

for (const c of cases) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: c.w, height: c.h, deviceScaleFactor: 2, mobile: c.mobile,
  });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: c.scheme }] });
  await send("Page.navigate", { url: URL_ });
  await sleep(1200);
  const { result } = await send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const d = document.documentElement;
      const over = [...document.querySelectorAll('*')]
        .filter(el => el.getBoundingClientRect().right > d.clientWidth + 0.5)
        .map(el => el.tagName + (el.className ? '.' + el.className : ''));
      return {
        clientWidth: d.clientWidth,
        scrollWidth: d.scrollWidth,
        overflows: d.scrollWidth > d.clientWidth,
        offenders: [...new Set(over)].slice(0, 6),
        clock: document.getElementById('t') ? document.getElementById('t').textContent : null,
        h1Font: getComputedStyle(document.querySelector('h1')).fontFamily.split(',')[0],
        bodyBg: getComputedStyle(document.body).backgroundColor,
        h1Size: getComputedStyle(document.querySelector('h1')).fontSize,
      };
    })()`,
  });
  const r = result.value;
  console.log(
    `${c.name.padEnd(13)} ${String(r.clientWidth).padStart(4)}px  scroll=${String(r.scrollWidth).padStart(4)} ` +
    `overflow=${r.overflows ? "YES -> " + r.offenders.join(", ") : "no"}  bg=${r.bodyBg} h1=${r.h1Size} ${r.h1Font} clock=${r.clock}`
  );
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`/tmp/v-${c.name}.png`, Buffer.from(shot.data, "base64"));
}

ws.close(); chrome.kill();
