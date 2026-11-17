/* Grindstone 2.20: recolouring, in a structured way.
 * Every pixel is filed under a material family from its hue and saturation (wood, stone and metal, foliage, water and
 * ice, cloth and accents), and a scheme says what to do to each family: turn the hue, scale or add saturation, scale or
 * add brightness. Shading and outlines survive because only hue, saturation and brightness are moved, never the
 * light-to-dark order of a sprite's own ramp.
 *
 *   Recolor.atlas(img, rects, scheme, opts)   a recoloured copy of a sprite sheet (only the rects asked for)
 *   Recolor.tile(canvasOrImg, scheme)         one picture, recoloured
 *   (the finishes the estate sells are schemes too: G.FINISHES in core.js)
 *   Recolor.tierBoost(tier)                   the "rarer is a touch brighter and more vibrant" scheme
 *   Recolor.shift(hex, turns, sat, a)         a colour moved round the wheel (for tints)
 *
 * Everything runs once per sheet or tile and is cached; nothing is recoloured per frame. */
(function (root) {
  'use strict';
  function toHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) { if (mx === r) h = ((g - b) / d + 6) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6; }
    return [h, mx ? d / mx : 0, mx];
  }
  function toRgb(h, s, v) {
    h = ((h % 1) + 1) % 1;
    const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const m = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
    return [Math.round(m[0] * 255), Math.round(m[1] * 255), Math.round(m[2] * 255)];
  }
  // which material a pixel is made of
  function family(h, s, v) {
    if (s < 0.15) return 'stone';                          // stone, metal, plaster, glass
    if (h >= 0.03 && h < 0.15) return 'wood';             // wood, leather, earth, skin, brass and gilding
    if ((h >= 0.92 || h < 0.03) && v < 0.42) return 'wood'; // dark reds: mahogany, oxblood timber (bright reds stay cloth: cushions, velvet)
    if (h >= 0.17 && h < 0.45) return 'green';             // leaves, grass, moss
    if (h >= 0.45 && h < 0.70) return 'water';             // water, ice, cold cloth
    return 'cloth';                                        // red, pink, violet, bright yellow: fabric and trim
  }
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  // spec per family: dh (turn the hue), h (set the hue: for tinting stone), s (× saturation), ds (+ saturation), v (× brightness), dv (+ brightness)
  function move(h, s, v, t) {
    if (t.h != null) h = t.h; else if (t.dh) h += t.dh;
    s = clamp01(s * (t.s == null ? 1 : t.s) + (t.ds || 0));
    v = clamp01(v * (t.v == null ? 1 : t.v) + (t.dv || 0));
    return [h, s, v];
  }
  function recolorData(d, scheme) {
    const fams = ['stone', 'wood', 'green', 'water', 'cloth'];
    if (!scheme || !fams.some((f) => scheme[f]) && !scheme.all) return d;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      let [h, s, v] = toHsv(d[i], d[i + 1], d[i + 2]);
      const t = scheme[family(h, s, v)];
      if (t) [h, s, v] = move(h, s, v, t);
      if (scheme.all) [h, s, v] = move(h, s, v, scheme.all);
      const c = toRgb(h, s, v);
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
    }
    return d;
  }
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // ---- rarity: a touch brighter and more vibrant each step up, never loud ----
  const TIER = [null, { all: { s: 1.04, v: 1.01 } }, { all: { s: 1.08, v: 1.03 } }, { all: { s: 1.13, v: 1.05 } }, { all: { s: 1.19, v: 1.08 } }];
  const tierBoost = (t) => TIER[Math.max(0, Math.min(4, t | 0))] || null;

  // A recoloured copy of a sprite sheet. rects: { key: [x, y, w, h] }. pick(key) returns a scheme for that sprite, or null to leave it.
  function atlas(img, rects, pick) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const c = mkCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    Object.keys(rects).forEach((k) => {
      const sch = pick(k); if (!sch) return;
      const r = rects[k];
      const id = g.getImageData(r[0], r[1], r[2], r[3]);
      recolorData(id.data, sch);
      g.putImageData(id, r[0], r[1]);
    });
    return c;
  }
  // One picture (a tile, a sprite) recoloured onto a new canvas.
  function tile(src, scheme, sw, sh, sx, sy) {
    const w = sw || src.naturalWidth || src.width, h = sh || src.naturalHeight || src.height;
    const c = mkCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(src, sx || 0, sy || 0, w, h, 0, 0, w, h);
    if (!scheme) return c;
    const id = g.getImageData(0, 0, w, h);
    recolorData(id.data, scheme);
    g.putImageData(id, 0, 0);
    return c;
  }
  // A "#rrggbb" colour turned round the wheel, and its saturation and brightness scaled.
  function shift(hex, turns, sat, val) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex;
    const n = parseInt(m[1], 16), hsv = toHsv(n >> 16, (n >> 8) & 255, n & 255);
    const c = toRgb(hsv[0] + (turns || 0), clamp01(hsv[1] * (sat == null ? 1 : sat)), clamp01(hsv[2] * (val == null ? 1 : val)));
    return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  root.Recolor = { family, recolorData, atlas, tile, tierBoost, shift, toHsv, toRgb };
})(typeof window !== 'undefined' ? window : globalThis);
