// Serves assets/ under https://grindstone.local/ exactly like MainActivity.shouldInterceptRequest, then opens the Hearth.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const ROOT = '/home/claude/grindstone/assets/';
const MIME = (p) => p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'application/javascript' : p.endsWith('.css') ? 'text/css' : p.endsWith('.glb') ? 'model/gltf-binary' : p.endsWith('.png') ? 'image/png' : 'text/plain';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 393, height: 851 } });
  const errs = [], served = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route('https://grindstone.local/**', (route) => {
    let u = new URL(route.request().url()).pathname; if (u === '/' || !u) u = '/index.html';
    const f = path.join(ROOT, u.slice(1));
    if (u.includes('..') || !fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
    served.push(u);
    route.fulfill({ status: 200, contentType: MIME(u), headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(f) });
  });
  await p.goto('https://grindstone.local/index.html');
  await p.click('[data-m="c-save"]'); await p.click('[data-m="pet-save"]');  /* 2.26: the pets step */ await p.waitForTimeout(500);
  const c = await p.$('[data-m="again"]'); if (c) { await c.click(); await p.waitForTimeout(1200); await p.click('[data-m="equip-close"]'); }
  await p.click('[data-act="tab"][data-v="hearth"]');
  await p.waitForSelector('#h3slot.ready', { timeout: 180000 });
  console.log('served:', served.join(' '));
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close();
})();
