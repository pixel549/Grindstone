// Shared animated sprite helper: timing, sheet slicing, caching and one-shot completion.
const assert = require('assert');
const path = require('path');
let imageCount = 0;
class FakeImage {
  constructor() { imageCount++; this.onload = null; this.onerror = null; }
  set src(value) { this._src = value; queueMicrotask(() => { this.width = 512; this.height = 64; if (this.onload) this.onload(); }); }
  get src() { return this._src; }
}
global.Image = FakeImage;
const manifest = {
  assets: {
    strip: { sheet: 'strip.png', layout: 'strip', frameWidth: 32, frameHeight: 32, frames: 8, fps: 8, loop: true, pivot: [16, 32] },
    grid: { sheet: 'grid.png', layout: 'grid', frameWidth: 64, frameHeight: 64, columns: 8, frames: 8, frameDurationsMs: [80,80,80,80,80,80,80,80], loop: false, pivot: [32,32] },
    packed: { sheet: 'packed.png', metadata: 'packed.json', layout: 'packed', loop: false, pivot: [10,10] }
  }
};
const packedMetadata = {
  loop_mode: 'none', pivot: [10,10],
  frames: [
    { duration: { numerator_ms: 100, denominator: 1 }, visible_bounds: [1,1,8,8], trimmed_pivot: [3,4], sheet: { x: 8, y: 4, width: 12, height: 10, scale: 2 } },
    { duration: { numerator_ms: 100, denominator: 1 }, visible_bounds: null, trimmed_pivot: [10,10], sheet: { x: 24, y: 4, width: 1, height: 1, scale: 1 } }
  ]
};
global.fetch = async (url) => url.endsWith('packed.json')
  ? ({ ok: true, json: async () => packedMetadata })
  : ({ ok: true, json: async () => manifest });
require('../assets/animated2d.js');
const A = global.Animated2D;
const calls = [];
const ctx = {
  globalAlpha: 1, imageSmoothingEnabled: true,
  save() {}, restore() {}, translate() {}, scale() {},
  drawImage(...args) { calls.push(args); }
};
(async () => {
  const loaded = await A.init('fixture/manifest.json');
  assert(loaded && loaded.assets.strip, 'manifest loads');
  assert.strictEqual(A.draw(ctx, 'strip', 20, 40, 0.25, { manifest: 'fixture/manifest.json' }), false, 'first draw waits for image');
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(A.draw(ctx, 'strip', 20, 40, 0.25, { manifest: 'fixture/manifest.json' }), true, 'strip draws after load');
  assert.strictEqual(calls[calls.length - 1][1], 64, 'strip frame index uses elapsed time');
  assert.strictEqual(calls[calls.length - 1][2], 0, 'strip remains on first row');
  assert.strictEqual(ctx.imageSmoothingEnabled, false, 'pixel smoothing disabled');
  assert.strictEqual(A.draw(ctx, 'strip', 20, 40, 0.5, { manifest: 'fixture/manifest.json' }), true, 'same image reused');
  assert.strictEqual(imageCount, 1, 'sheet image cached');
  assert.strictEqual(A.draw(ctx, 'grid', 40, 60, 0.4, { manifest: 'fixture/manifest.json' }), false, 'grid image loads lazily');
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(A.draw(ctx, 'grid', 40, 60, 0.4, { manifest: 'fixture/manifest.json' }), true, 'grid draws');
  assert.strictEqual(calls[calls.length - 1][1], 320, 'grid uses eight-column row-major slicing');
  assert.strictEqual(A.draw(ctx, 'grid', 40, 60, 1, { manifest: 'fixture/manifest.json' }), true, 'one-shot holds final frame');
  assert.strictEqual(calls[calls.length - 1][1], 448, 'one-shot clamps to its final frame');
  assert.strictEqual(A.draw(ctx, 'packed', 100, 100, 0.05, { manifest: 'fixture/manifest.json' }), false, 'packed metadata loads lazily');
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(A.draw(ctx, 'packed', 100, 100, 0.05, { manifest: 'fixture/manifest.json' }), false, 'packed image loads lazily');
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(A.draw(ctx, 'packed', 100, 100, 0.05, { manifest: 'fixture/manifest.json' }), true, 'packed frame draws');
  const packedCall = calls[calls.length - 1];
  assert.deepStrictEqual(packedCall.slice(1, 5), [8, 4, 12, 10], 'packed source rectangle comes from metadata');
  assert.deepStrictEqual(packedCall.slice(5), [94, 92, 24, 20], 'packed trimmed pivot and scale preserve its anchor');
  const beforeEmpty = calls.length;
  assert.strictEqual(A.draw(ctx, 'packed', 100, 100, 0.15, { manifest: 'fixture/manifest.json' }), true, 'transparent packed frame retains its timing');
  assert.strictEqual(calls.length, beforeEmpty, 'transparent packed frame draws nothing');
  assert.strictEqual(A.draw(ctx, 'missing', 0, 0, 0, { manifest: 'fixture/manifest.json' }), false, 'unknown asset safely falls back');
  console.log('PASS animated2d manifest, strip/grid/packed slicing, timing, caching, pivots and one-shots');
})().catch((e) => { console.error(e); process.exitCode = 1; });
