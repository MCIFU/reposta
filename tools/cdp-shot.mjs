#!/usr/bin/env node
// Capturas fiables para la revisión visual (incluido el mapa WebGL), vía Chrome DevTools Protocol.
// Requiere un Edge/Chrome con --remote-debugging-port. Sin dependencias (Node >= 22: fetch + WebSocket).
//
//   msedge --headless=new --remote-debugging-port=9333 --use-angle=swiftshader --enable-unsafe-swiftshader
//   node tools/cdp-shot.mjs <url> <salida.png> [ancho] [alto] [light|dark] [esperaMs] [densidad]
import { writeFileSync } from 'node:fs';

const [url, out, w = '1440', h = '900', scheme = 'light', waitMs = '9000', dpr = '1'] = process.argv.slice(2);
if (!url || !out) {
  console.error('Uso: node tools/cdp-shot.mjs <url> <salida.png> [ancho] [alto] [light|dark] [esperaMs]');
  process.exit(1);
}
const port = process.env.CDP_PORT ?? '9333';
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let seq = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });

const mobile = Number(w) < 768;
await send('Emulation.setDeviceMetricsOverride', { width: Number(w), height: Number(h), deviceScaleFactor: Number(dpr), mobile });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
await send('Page.enable');
await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, Number(waitMs)));
const { data } = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(data, 'base64'));
await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
ws.close();
console.log(`captura: ${out} (${w}x${h} @${dpr}x, ${scheme})`);
