/* 2.8: emoji drawn as pixel art. Every emoji that lands in the page is redrawn small (16 px), its edges hardened and its
 * colours stepped, then shown blown up with hard pixels, so icons sit with the sprites. One canvas, results cached per emoji.
 * Canvases (the house, the crawl) and form fields are left alone. */
(function () {
  'use strict';
  const SIZE = 16, cache = {};
  let RE;
  try { RE = new RegExp('(?:\\p{Regional_Indicator}{2}|\\p{Extended_Pictographic}(?:\\uFE0F|\\u200D\\p{Extended_Pictographic}|[\\u{1F3FB}-\\u{1F3FF}])*)', 'gu'); } catch (e) { return; }
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, CANVAS: 1, SVG: 1 };
  const plain = (ch) => ch.codePointAt(0) < 0x203c || /^[™ℹ↩↪↔-↙▪▫▶◀★☆✓✔✖✎✏✦-✨➕-➗➡]$/.test(ch) && ch !== '✨';
  const cv = document.createElement('canvas'); cv.width = cv.height = SIZE * 2;
  const big = cv.getContext('2d', { willReadFrequently: true });
  const sm = document.createElement('canvas'); sm.width = sm.height = SIZE;
  const ctx = sm.getContext('2d', { willReadFrequently: true });
  function draw(ch) {
    if (cache[ch] !== undefined) return cache[ch];
    try {
      big.clearRect(0, 0, SIZE * 2, SIZE * 2);
      big.font = (SIZE * 2 - 6) + 'px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      big.textAlign = 'center'; big.textBaseline = 'middle';
      big.fillText(ch, SIZE, SIZE + 1);
      ctx.clearRect(0, 0, SIZE, SIZE); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(cv, 0, 0, SIZE, SIZE);
      const im = ctx.getImageData(0, 0, SIZE, SIZE), d = im.data;
      let ink = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
        d[i + 3] = 255; ink++;
        for (let c = 0; c < 3; c++) d[i + c] = Math.min(255, Math.round(d[i + c] / 36) * 36);   // stepped colours
      }
      if (ink < 6) return (cache[ch] = null);   // the phone has no picture for it: leave the text
      // a dark outline where the picture meets nothing, the way the sprites have
      const a = (x, y) => (x < 0 || y < 0 || x >= SIZE || y >= SIZE ? 0 : d[(y * SIZE + x) * 4 + 3]);
      const edge = [];
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (a(x, y) && (!a(x - 1, y) || !a(x + 1, y) || !a(x, y - 1) || !a(x, y + 1))) edge.push((y * SIZE + x) * 4);
      edge.forEach((i) => { d[i] = Math.round(d[i] * 0.45); d[i + 1] = Math.round(d[i + 1] * 0.45); d[i + 2] = Math.round(d[i + 2] * 0.45); });
      ctx.putImageData(im, 0, 0);
      return (cache[ch] = sm.toDataURL('image/png'));
    } catch (e) { return (cache[ch] = null); }
  }
  // By request: wherever the number 69 turns up on its own, it gets a (Nice!). Not 169, not 6.9, and never twice.
  let NICE = null;
  try { NICE = new RegExp('(?<![\\d.,:#])69(%?)(?!\\d|[.,:]\\d|%? \\(Nice!\\))', 'g'); } catch (e) { NICE = null; }
  // 2.20.2: symbols drawn by hand on the font's own pixel grid. Pixelify Sans has no ✦ ◈ ★ → and the like, so the phone fell
  // back to a smooth font for them; and emoji redrawn from the emoji font came out finer than the lettering around them.
  // Each glyph is a bitmap; one glyph pixel is one font pixel (about 0.095em), snapped to whole device pixels so nothing smears.
  // Plain symbols ('#') take the colour of the text they sit in (a CSS mask over currentColor); the element icons have their own
  // palette and a dark outline ('k'), like the sprites. The character stays in the page inside the span, so copying and reading
  // the text still work. y: how many glyph pixels the bottom row sits above the baseline.
  const GLY = {
    '✦': { y: -1, m: ['....#....', '....#....', '...###...', '..#####..', '#########', '..#####..', '...###...', '....#....', '....#....'] },
    '✧': { y: -1, m: ['....#....', '....#....', '...#.#...', '..#...#..', '##.....##', '..#...#..', '...#.#...', '....#....', '....#....'] },
    '★': { y: 0, m: ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '##...##'] },
    '⭐': { y: 0, c: 1, p: { y: '#f2c94c' }, m: ['...k...', '..kyk..', 'kkkykkk', 'kyyyyyk', '.kyyyk.', '.kykyk.', 'kk...kk'] },
    '☆': { y: 0, m: ['...#...', '..#.#..', '###.###', '.#...#.', '..#.#..', '.##.##.', '##...##'] },
    '◈': { y: 0, m: ['...#...', '..#.#..', '.#.#.#.', '#.###.#', '.#.#.#.', '..#.#..', '...#...'] },
    '◆': { y: 0, m: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'] },
    '✓': { y: 0, m: ['......#', '.....##', '#...##.', '##.##..', '.###...', '..#....'] },
    '✔': { y: 0, m: ['......#', '.....##', '#...##.', '##.##..', '.###...', '..#....'] },
    '✕': { y: 1, m: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'] },
    '✖': { y: 1, m: ['##..##', '######', '.####.', '.####.', '######', '##..##'] },
    '✎': { y: 0, m: ['.....##', '....#.#', '...#.#.', '..#.#..', '.#.#...', '#.#....', '##.....'] },
    '✏': { y: 0, m: ['.....##', '....#.#', '...#.#.', '..#.#..', '.#.#...', '#.#....', '##.....'] },
    '→': { y: 1, m: ['....#..', '.....#.', '#######', '.....#.', '....#..'] },
    '←': { y: 1, m: ['..#....', '.#.....', '#######', '.#.....', '..#....'] },
    '↻': { y: 0, m: ['..###.#', '.#...##', '#...###', '#......', '#.....#', '.#...#.', '..###..'] },
    '↺': { y: 0, m: ['#.###..', '##...#.', '###...#', '......#', '#.....#', '.#...#.', '..###..'] },
    '↶': { y: 0, m: ['#.###..', '##...#.', '###...#', '......#', '......#', '.....#.', '...##..'] },
    '▾': { y: 1, m: ['#####', '.###.', '..#..'] },
    '▴': { y: 2, m: ['..#..', '.###.', '#####'] },
    '▸': { y: 1, m: ['#..', '##.', '###', '##.', '#..'] },
    '▫': { y: 1, m: ['###', '#.#', '###'] },
    '♪': { y: 0, m: ['..##.', '..#.#', '..#..', '..#..', '.##..', '###..', '.#...'] },
    '♫': { y: 0, m: ['.#####', '.#...#', '.#...#', '.#...#', '##..##', '##.###', '#..##.'] },
    '∞': { y: 1, m: ['.##.##.', '#..#..#', '#..#..#', '.##.##.'] },
    '◎': { y: 0, m: ['..###..', '.#...#.', '#..#..#', '#.###.#', '#..#..#', '.#...#.', '..###..'] },
    '⌂': { y: 0, m: ['...#...', '..#.#..', '.#...#.', '#.....#', '#.....#', '#######'] },
    '☾': { y: 0, m: ['..##.', '.##..', '##...', '##...', '##...', '.##..', '..##.'] },
    '✚': { y: 0, m: ['..###..', '..###..', '#######', '#######', '#######', '..###..', '..###..'] },
    '＋': { y: 1, m: ['..#..', '..#..', '#####', '..#..', '..#..'] },
    '➕': { y: 1, m: ['..#..', '..#..', '#####', '..#..', '..#..'] },
    '♥': { y: 0, m: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'] },
    '⑂': { y: 0, m: ['#.....#', '#.....#', '.#...#.', '..#.#..', '...#...', '...#...', '...#...'] },
    '⇋': { y: 1, m: ['.#.....', '#######', '.......', '#######', '.....#.'] },
    '∅': { y: 0, m: ['..###.#', '.#...#.', '#...#.#', '#..#..#', '#.#...#', '.#...#.', '#.###..'] },
    '⌕': { y: 0, m: ['.###...', '#...#..', '#...#..', '#...#..', '.###...', '....##.', '.....##'] },
    // the elements, in colour: storm, fire, frost, rot, holy
    '⚡': { y: -1, c: 1, p: { y: '#ffd84a', w: '#fff3b0', o: '#e0a020' }, m: ['...yyyy', '..ywyy.', '..yyy..', '.yyyyyy', '.oyyyy.', '...yyo.', '..yyo..', '.yyo...', '.yo....'] },
    '🔥': { y: -1, c: 1, p: { r: '#d8432a', o: '#f08a24', y: '#ffd84a' }, m: ['....k....', '...krk...', '...krrk.k', '..krorkkk', '.krrookrk', '.kroyyork', 'kroyyyyrk', '.kroyyok.', '..kkkkk..'] },
    '❄': { y: 0, c: 1, p: { b: '#a9dcff', w: '#ffffff' }, m: ['...b...', '.b.b.b.', '..bwb..', 'bbwwwbb', '..bwb..', '.b.b.b.', '...b...'] },
    '☠': { y: -1, c: 1, p: { w: '#ece6d6', s: '#b8ae98' }, m: ['.wwwww.', 'wwwwwww', 'wkkwkkw', 'wkkwkkw', 'wwwkwww', '.swwws.', '.w.w.w.', '..sss..'] },
    '✨': { y: -1, c: 1, p: { y: '#ffd84a', w: '#fff6c8' }, m: ['...y....', '...y....', '..yyy..w', 'yyywyyy.', '..yyy...', '...y..y.', '...y.yyy', '......y.'] },
  };
  const GU = 0.095, gcache = {};
  const canMask = typeof CSS !== 'undefined' && CSS.supports && (CSS.supports('mask-image', 'url(x.png)') || CSS.supports('-webkit-mask-image', 'url(x.png)'));
  function glyphUrl(ch) {
    if (gcache[ch] !== undefined) return gcache[ch];
    const G = GLY[ch], h = G.m.length, w = Math.max.apply(null, G.m.map((r) => r.length));
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    G.m.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const k = row[x]; if (k === '.' || k === ' ') continue; g.fillStyle = k === '#' ? '#fff' : k === 'k' ? '#1a1410' : (G.p && G.p[k]) || '#fff'; g.fillRect(x, y, 1, 1); } });
    return (gcache[ch] = { url: c.toDataURL('image/png'), w: w, h: h });
  }
  function glyphSpan(ch, raw, parent) {
    const G = GLY[ch], U = glyphUrl(ch);
    if (!G.c && !canMask) return null;
    const fs = parseFloat(getComputedStyle(parent).fontSize) || 15, dpr = window.devicePixelRatio || 1;
    const px = Math.max(1, Math.round(fs * GU * dpr)) / dpr;   // one glyph pixel, in whole device pixels
    const sp = document.createElement('span');
    sp.className = 'pxg' + (G.c ? ' pxgc' : '');
    sp.textContent = raw;
    const st = sp.style, url = 'url("' + U.url + '")';
    st.width = U.w * px + 'px'; st.height = U.h * px + 'px'; st.verticalAlign = (G.y || 0) * px + 'px'; st.margin = '0 ' + px + 'px';
    if (G.c) st.backgroundImage = url;
    else { st.webkitMaskImage = url; st.maskImage = url; }
    return sp;
  }
  let GRE = null;
  try { GRE = new RegExp('(?:' + Object.keys(GLY).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\uFE0F?|' + RE.source, 'gu'); } catch (e) { GRE = null; }
  function swap(node) {
    if (NICE && node.nodeValue && node.nodeValue.indexOf('69') >= 0) { const v = node.nodeValue.replace(NICE, '69$1 (Nice!)'); if (v !== node.nodeValue) node.nodeValue = v; }
    const txt = node.nodeValue, R = GRE || RE;
    R.lastIndex = 0;
    if (!txt || !R.test(txt)) return;
    R.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, m, changed = false;
    while ((m = R.exec(txt))) {
      const ch = m[0], base = ch.replace(/\uFE0F/g, '');
      let el = null;
      if (GLY[base]) el = glyphSpan(base, ch, node.parentNode);
      else { const url = plain(ch) ? null : draw(ch); if (url) { el = document.createElement('img'); el.className = 'pxe'; el.src = url; el.alt = ch; el.draggable = false; } }
      if (!el) continue;
      if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
      frag.appendChild(el); last = m.index + ch.length; changed = true;
    }
    if (!changed) return;
    if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
  function sweep(root) {
    if (!root || (root.nodeType === 1 && SKIP[root.nodeName.toUpperCase()])) return;
    if (root.nodeType === 3) { const p = root.parentNode; if (p && !SKIP[p.nodeName.toUpperCase()] && !(p.classList && p.classList.contains('pxg'))) swap(root); return; }
    if (root.nodeType !== 1) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => { for (let p = n.parentNode; p && p !== root.parentNode; p = p.parentNode) if (SKIP[p.nodeName.toUpperCase()] || (p.classList && p.classList.contains('pxg'))) return NodeFilter.FILTER_REJECT; return NodeFilter.FILTER_ACCEPT; } });
    const list = []; while (w.nextNode()) list.push(w.currentNode);
    list.forEach(swap);
  }
  // 2.12: gear icons. They are drawn as smooth vector pictures; here each is redrawn on a 24-pixel grid, its edges hardened,
  // colours stepped and outlined, and shown with hard pixels like everything else. Kept per picture.
  const GRID = 24, icache = {};
  function pixelIcon(svg, grid) {
    if (!svg || !svg.parentNode || svg.dataset.px) return;
    // 2.15: relics and coffers too, on a finer grid and at their own shape
    const vb = (svg.getAttribute('viewBox') || '').split(/[ ,]+/).map(Number), GW = grid || GRID, GH = grid && vb.length === 4 && vb[2] > 0 ? Math.max(8, Math.round(GW * vb[3] / vb[2])) : GW;
    svg.dataset.px = '1';
    let src = svg.outerHTML;
    if (src.indexOf('xmlns=') < 0) src = src.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    const key = GW + ':' + src.replace(/ig\d+/g, 'ig').replace(/data-px="1"/, '');
    const put = (url) => { if (!url || !svg.parentNode) return; const im = document.createElement('img'); im.className = grid ? 'pxi pxbig' : 'icon pxi'; im.src = url; im.alt = ''; im.draggable = false; svg.parentNode.replaceChild(im, svg); };
    if (icache[key] !== undefined) { put(icache[key]); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = GW; c.height = GH; const g = c.getContext('2d', { willReadFrequently: true });
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, GW, GH);
        const im = g.getImageData(0, 0, GW, GH), d = im.data;
        for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 120) { d[i + 3] = 0; continue; } d[i + 3] = 255; for (let k = 0; k < 3; k++) d[i + k] = Math.min(255, Math.round(d[i + k] / 40) * 40); }
        const a = (x, y) => (x < 0 || y < 0 || x >= GW || y >= GH ? 0 : d[(y * GW + x) * 4 + 3]), edge = [];
        for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (a(x, y) && (!a(x - 1, y) || !a(x + 1, y) || !a(x, y - 1) || !a(x, y + 1))) edge.push((y * GW + x) * 4);
        // thin things (a blade, a haft) are nearly all edge: shade the rim lightly, and lift everything a little off the dark tile
        if (!grid) for (let i = 0; i < d.length; i += 4) if (d[i + 3]) for (let k = 0; k < 3; k++) d[i + k] = Math.min(255, Math.round(d[i + k] * 1.25 + 14));
        edge.forEach((i) => { d[i] = Math.round(d[i] * 0.68); d[i + 1] = Math.round(d[i + 1] * 0.68); d[i + 2] = Math.round(d[i + 2] * 0.68); });
        g.putImageData(im, 0, 0);
        icache[key] = c.toDataURL('image/png');
      } catch (e) { icache[key] = null; }
      put(icache[key]);
    };
    img.onerror = () => { icache[key] = null; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src.replace(/ data-px="1"/, '').replace('<svg', '<svg width="' + GW * 4 + '" height="' + GH * 4 + '"'));
  }
  const BIG = '.rp > svg, .dprev > svg, .cs > svg';
  const icons = (root) => { if (root.nodeType !== 1) return; if (root.matches && root.matches('svg.icon')) pixelIcon(root); else if (root.matches && root.matches(BIG)) pixelIcon(root, root.parentNode.classList.contains('cs') ? 40 : 32); else if (root.querySelectorAll) { root.querySelectorAll('svg.icon').forEach((x) => pixelIcon(x)); root.querySelectorAll(BIG).forEach((x) => pixelIcon(x, x.parentNode.classList.contains('cs') ? 40 : 32)); } };
  window.Pix = { sweep: sweep, draw: draw, on: true, GLY: GLY, glyphUrl: glyphUrl };
  const start = () => {
    sweep(document.body); icons(document.body);
    new MutationObserver((muts) => {
      if (!window.Pix.on) return;
      muts.forEach((mu) => {
        if (mu.type === 'characterData') sweep(mu.target);
        else mu.addedNodes.forEach((n) => { if (!(n.nodeType === 1 && (n.className === 'pxe' || n.className === 'icon pxi' || (n.classList && n.classList.contains('pxg'))))) { sweep(n); icons(n); } });
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
