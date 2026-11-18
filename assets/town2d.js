/* Grindstone 2.24 — the town, walked round. The streets and lots, the inside of each building, the people in them.
 * Same pixel scale and LPC people as the hearth (hearth2d.js). The layout and who's where come from G (town.js);
 * the app owns the talking (onTalk) and what going in or home means (onEnter, onGate). */
(function (root) {
  'use strict';
  const T = 32, FEET = 58;
  const DIRS = { up: 0, left: 1, down: 2, right: 3 };
  const SEASON = (d) => { const m = d.getMonth(); return m === 11 || m <= 1 ? 'summer' : m <= 4 ? 'autumn' : m <= 7 ? 'winter' : 'spring'; };
  const IDLE = ['☕', '🎵', '💭', '🍞', '🌿', '🙂', '👋', '🐟', '🌧️', '📜', '🥕', '😮'];
  const G = () => root.G;
  const px = (c) => c * T + 16;
  const hourNow = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
  const hsh = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + (s | 0) * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };

  const ASSETS = {};
  function assets(base) {
    base = base || '2d/';
    if (!ASSETS[base]) {
      const img = (f) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(f)); i.src = base + f; });
      ASSETS[base] = Promise.all([root.House2D.assets(base), img('town.png'), fetch(base + 'town.json').then((r) => r.json())])
        .then(([w, ta, tm]) => ({ atlas: w.atlas, spr: w.spr, tatlas: ta, tspr: tm }));
      ASSETS[base].catch(() => { delete ASSETS[base]; });
    }
    return ASSETS[base];
  }

  class Town2D {
    constructor(el, o) {
      this.el = el;
      this.o = Object.assign({ base: '2d/', world: { lots: [], people: [] } }, o || {});
      this.alive = true; this.active = true; this.t = 0;
      this.k = 0; this.cam = { x: 21 * T, y: 40 * T, manual: 0 };
      this.people = []; this.fx = [];
      this.scene = null;
      this.sceneArt = null;
      this.sceneArtKey = null;
      this.sceneArtFailed = {};
      this.canvas = document.createElement('canvas');
      this.canvas.className = 't2d';
      this.canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
      el.appendChild(this.canvas);
      this.g = this.canvas.getContext('2d');
      this.season = SEASON(new Date());
      this._bind();
      this.ready = assets(this.o.base).then((a) => {
        Object.assign(this, a);
        this.hero = this._actor('hero', 21, 44);
        this.hero.speed = 112;
        return this._buildHero();
      }).then(() => {
        this.setWorld(this.o.world);
        this.goScene(this.o.scene || 'town', this.o.at);
        this._resize();
        this._raf = requestAnimationFrame((t) => this._frame(t));
        if (this.o.onReady) this.o.onReady();
        return this;
      }).catch((e) => { if (this.o.onError) this.o.onError(e); throw e; });
    }

    // ---------------------------------------------------------------- people
    _actor(id, cx, cy) { return { id: id, x: px(cx), y: px(cy), dir: 'down', path: [], ft: 0, next: 1 + Math.random() * 3, bub: null }; }
    _sheets(look, gear) {
      const d = root.LPC.dress(look || {}, gear || {}, { kit: false });
      return { sig: JSON.stringify([d.spec, d.body]), p: () => root.LPC.build(d.spec, d.body, ['walk', 'idle']) };
    }
    _buildHero() {
      const b = this._sheets(this.o.look, this.o.gear);
      if (this.hero.sig === b.sig) return Promise.resolve();
      return b.p().then((h) => { this.hero.sig = b.sig; this.hero.sheets = h.sheets; }).catch(() => {});
    }
    setLook(look, gear) { this.o.look = look; this.o.gear = gear; return this.ready.then(() => this._buildHero()); }
    // world: { lots, people } from G.townLots / G.townPeople
    setWorld(w) {
      this.o.world = w || { lots: [], people: [] };
      if (!this.atlas) return;
      const want = this.o.world.people || [];
      this.people = this.people.filter((a) => want.some((p) => p.id === a.id && p.scene === a.p.scene));
      want.forEach((p) => {
        let a = this.people.find((x) => x.id === p.id);
        if (!a) { a = this._actor(p.id, p.at[0], p.at[1]); a.home = p.at.slice(); a.dir = p.dir || 'down'; this.people.push(a); }
        a.p = p; a.speed = 34 + (hsh(p.id.length, p.id.charCodeAt(p.id.length - 1), 7) % 14);
        const gear = G().npcGear({ garb: p.garb, hat: p.hat }), b = this._sheets(G().normLook(p.look), gear);
        if (a.sig !== b.sig) { a.sig = b.sig; b.p().then((h) => { if (a.sig === b.sig) a.sheets = h.sheets; }).catch(() => {}); }
      });
      if (this.scene === 'town') this._layout();
    }

    // ---------------------------------------------------------------- the scene
    // Optional bespoke room backgrounds live at assets/2d/locations/<scene-key>.png.
    // They replace only the static room dressing; movement, NPCs, collision and taps stay game-driven.
    _loadSceneArt(key) {
      const cacheKey = (this.o.base || '2d/') + 'locations/' + key + '.png';
      this.sceneArt = null;
      this.sceneArtKey = key;
      if (this.sceneArtFailed[cacheKey] === true) return Promise.resolve(null);
      const cached = Town2D.sceneArtCache[cacheKey];
      if (cached) {
        this.sceneArt = cached;
        this._static();
        return Promise.resolve(cached);
      }
      if (this.sceneArtFailed[cacheKey] === 'loading') return Promise.resolve(null);
      this.sceneArtFailed[cacheKey] = 'loading';
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          Town2D.sceneArtCache[cacheKey] = img;
          this.sceneArtFailed[cacheKey] = false;
          if (this.scene !== 'town' && this.ik === key) {
            this.sceneArt = img;
            this.sceneArtKey = key;
            this._static();
          }
          resolve(img);
        };
        img.onerror = () => {
          this.sceneArtFailed[cacheKey] = true;
          if (this.ik === key) { this.sceneArt = null; this._static(); }
          resolve(null); // Missing artwork is expected until the player supplies it.
        };
        img.src = cacheKey;
      });
    }
    goScene(scene, at) {
      this.scene = scene;
      this.sceneArt = null;
      this.sceneArtKey = null;
      this._layout();
      if (scene !== 'town') this._loadSceneArt(scene.slice(3));
      const H = this.hero;
      let c = at;
      if (!c) c = scene === 'town' ? G().TMAP.spawn : G().TMAP.exit.slice();
      if (scene !== 'town' && c[1] >= G().TMAP.inH - 1) c = [c[0], c[1] - 1];
      const ok = this._ok(c[0], c[1]) ? c : this._nearestOk(c[0], c[1]) || c;
      H.x = px(ok[0]); H.y = px(ok[1]); H.path = []; H.goal = null; H.dir = scene === 'town' && at ? 'down' : 'up';
      const [cx, cy] = this._camTarget(); this.cam.x = cx; this.cam.y = cy; this.cam.manual = 0;
      if (this.o.onScene) this.o.onScene(scene);
    }
    _layout() {
      const M = G().TMAP;
      if (this.scene === 'town') {
        this.W = M.w; this.H = M.h;
        const gr = G().townGround(), walk = new Uint8Array(M.w * M.h), objs = [];
        for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) walk[y * M.w + x] = gr[y * M.w + x] === 3 || x === 0 || y === 0 || x === M.w - 1 || y === M.h - 1 ? 0 : 1;
        M.gate.forEach((c) => { walk[c[1] * M.w + c[0]] = 1; });
        M.props.forEach((p) => {
          const s = p[0].replace('*', this.season), r = this.spr[s]; if (!r) return;
          objs.push({ s: s, ax: px(p[1]) + p[4], ay: (p[2] + 1) * T, w: r[2], h: r[3] });
          const x0 = p[1] - Math.floor((p[3] - 1) / 2);
          for (let i = 0; i < p[3]; i++) if (x0 + i >= 0 && x0 + i < M.w) walk[p[2] * M.w + x0 + i] = 0;
        });
        (this.o.world.lots || []).forEach((L) => {
          if (L.built && L.f) {
            const tw = L.f.indexOf('w:') === 0, r = tw ? this.spr[L.f.slice(2)] : this.tspr[L.f];
            if (r) objs.push({ s: tw ? L.f.slice(2) : null, ts: tw ? null : L.f, lot: L, ax: L.x * T + r[2] / 2, ay: (L.y + L.h) * T, w: r[2], h: r[3], x0: L.x * T, y0: (L.y + L.h) * T - r[3] });
            for (let y = L.y; y < L.y + L.h; y++) for (let x = L.x; x < L.x + L.w; x++) walk[y * M.w + x] = 0;
          } else if (L.k) objs.push({ s: 'sign', ax: px(L.door[0]) - 8, ay: L.door[1] * T - 2, w: 24, h: 30, sign: L });
          else if (L.taken) objs.push({ s: 'x.mailbox', ax: px(L.door[0]) + 6, ay: L.door[1] * T - 2, w: 16, h: 32, sign: L });   // someone's, not for sale
        });
        this.walk = walk; this.objs = objs;
        this._static();
      } else {
        const k = this.scene.slice(3), I = M.inside[k];
        this.W = M.inW; this.H = M.inH; this.inside = I; this.ik = k;
        const walk = new Uint8Array(M.inW * M.inH), objs = [];
        for (let y = 2; y < M.inH - 1; y++) for (let x = 0; x < M.inW; x++) walk[y * M.inW + x] = 1;
        walk[M.exit[1] * M.inW + M.exit[0]] = 1;
        (I ? I.props : []).forEach((p) => {
          const r = this.spr[p[0]]; if (!r) return;
          const wide = Math.max(1, p[3]), cx = p[1] * T + (wide * T) / 2;
          objs.push({ s: p[0], ax: p[0] === 'mat' ? px(p[1]) : cx, ay: (p[2] + 1) * T, w: r[2], h: r[3], flat: p[3] === 0, wall: p[2] <= 2 && r[3] > 40 });
          for (let j = 0; j < (p[4] || 1); j++) for (let i = 0; i < p[3]; i++) if (p[2] - j >= 2) walk[(p[2] - j) * M.inW + p[1] + i] = 0;
        });
        if (I) walk[I.keeper[1] * M.inW + I.keeper[0]] = 0;
        this.walk = walk; this.objs = objs;
        this._static();
      }
    }
    _ok(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H && this.walk[y * this.W + x] === 1; }
    _nearestOk(x, y) {
      for (let r = 0; r < 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (this._ok(x + dx, y + dy) && !this._busy(x + dx, y + dy)) return [x + dx, y + dy];
      }
      return null;
    }
    // someone stands there (the keepers don't move; anyone else will step aside)
    _busy(x, y) { return this.people.some((a) => a.p.still && a.p.scene === this.scene && this._cellOf(a)[0] === x && this._cellOf(a)[1] === y); }
    _cellOf(a) { return [Math.floor(a.x / T), Math.floor(a.y / T)]; }
    _path(sx, sy, tx, ty) {
      if (!this._ok(tx, ty)) return null;
      if (sx === tx && sy === ty) return [];
      const W = this.W, N = W * this.H, came = new Int32Array(N).fill(-1), q = [sy * W + sx];
      came[sy * W + sx] = sy * W + sx;
      const goal = ty * W + tx;
      for (let h = 0; h < q.length; h++) {
        const cur = q[h]; if (cur === goal) break;
        const cx = cur % W, cy = (cur / W) | 0;
        for (let d = 0; d < 4; d++) {
          const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0);
          if (!this._ok(nx, ny)) continue;
          const ni = ny * W + nx; if (came[ni] >= 0) continue;
          came[ni] = cur; q.push(ni);
        }
      }
      if (came[goal] < 0) return null;
      const out = [];
      for (let i = goal; i !== sy * W + sx; i = came[i]) out.unshift([i % W, (i / W) | 0]);
      return out;
    }

    // ---------------------------------------------------------------- the ground, drawn once per scene
    _tile(g, k, x, y, atlas) { const r = (atlas === 't' ? this.tspr : this.spr)[k]; if (r) g.drawImage(atlas === 't' ? this.tatlas : this.atlas, r[0], r[1], 32, 32, x, y, 32, 32); }
    _static() {
      const c = this.stat || (this.stat = document.createElement('canvas'));
      c.width = this.W * T; c.height = this.H * T;
      const g = c.getContext('2d'), M = G().TMAP;
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#0d0b09'; g.fillRect(0, 0, c.width, c.height);
      if (this.scene === 'town') {
        const gr = G().townGround(), sea = this.season;
        for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
          const v = gr[y * M.w + x], h = hsh(x, y, 3);
          if (v === 1) this._tile(g, 'dirt.' + sea, x * T, y * T);
          else if (v === 4) { this._tile(g, 'dirt.' + sea, x * T, y * T); g.fillStyle = 'rgba(170,66,38,0.5)'; g.fillRect(x * T, y * T, T, T); g.fillStyle = 'rgba(255,246,226,0.55)'; g.fillRect(x * T + 15, y * T + 15, 2, 2); }
          else if (v === 2) this._tile(g, 'g.cobble.' + (h % 3), x * T, y * T, 't');
          else if (v === 3) this._tile(g, 'water.' + sea, x * T, y * T);
          else this._tile(g, 'grass.' + sea + '.' + (h % 7 < 4 ? 0 : h % 7 < 6 ? 1 : 2), x * T, y * T);
          if (v === 0 && h % 23 === 0) { const f = this.spr['flower.' + sea + '.' + (h % 2)]; if (f) g.drawImage(this.atlas, f[0], f[1], f[2], f[3], x * T + (h % 17), y * T + (h % 13), f[2], f[3]); }
        }
        // the edge of a road: a darker line where the grass meets it
        g.fillStyle = 'rgba(30,24,12,0.22)';
        for (let y = 1; y < M.h; y++) for (let x = 0; x < M.w; x++) { const a = gr[(y - 1) * M.w + x], b = gr[y * M.w + x]; if (a === 0 && b && b !== 3) g.fillRect(x * T, y * T, T, 3); }
        // lots waiting to be built: string and stakes
        (this.o.world.lots || []).forEach((L) => {
          if (L.built) return;
          const x0 = L.x * T + 6, y0 = L.y * T + 10, x1 = (L.x + L.w) * T - 6, y1 = (L.y + L.h) * T - 6;
          g.fillStyle = L.taken ? 'rgba(122,92,48,0.30)' : 'rgba(80,70,40,0.12)'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
          g.strokeStyle = L.taken || L.k ? 'rgba(236,224,190,0.75)' : 'rgba(236,224,190,0.3)'; g.lineWidth = 1; g.setLineDash([4, 3]); g.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0, y1 - y0); g.setLineDash([]);
          [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach((p) => { g.fillStyle = '#5a3d22'; g.fillRect(p[0] - 1, p[1] - 6, 3, 8); g.fillStyle = '#8a6a3e'; g.fillRect(p[0] - 1, p[1] - 6, 3, 2); });
        });
      } else {
        const I = this.inside || {}, W = this.W;
        if (this.sceneArt && this.sceneArtKey === this.ik) {
          // Artwork targets the room's 11:9 world ratio (352 × 288 at native tile scale).
          // Centre-crop rather than distort if the generator returns a slightly different canvas ratio.
          // Nearest-neighbour scaling preserves hard pixel edges on every phone size.
          g.imageSmoothingEnabled = false;
          const iw = this.sceneArt.naturalWidth || this.sceneArt.width, ih = this.sceneArt.naturalHeight || this.sceneArt.height;
          const target = (W * T) / (this.H * T);
          let sx = 0, sy = 0, sw = iw, sh = ih;
          if (iw / ih > target) { sw = Math.round(ih * target); sx = Math.floor((iw - sw) / 2); }
          else if (iw / ih < target) { sh = Math.round(iw / target); sy = Math.floor((ih - sh) / 2); }
          g.drawImage(this.sceneArt, sx, sy, sw, sh, 0, 0, W * T, this.H * T);
        } else {
          for (let y = 2; y < this.H - 1; y++) for (let x = 0; x < W; x++) {
            const r = this.spr[I.floor] || this.spr['floor.0'];
            g.drawImage(this.atlas, r[0], r[1] + ((y * 32) % r[3]), 32, 32, x * T, y * T, 32, 32);
          }
          for (let x = 0; x < W; x++) { const r = this.spr[I.wall] || this.spr['wall.0']; g.drawImage(this.atlas, r[0], r[1], 32, 64, x * T, 0, 32, 64); }
        }
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 2 * T, W * T, 4);
        // the front wall, with the doorway
        g.fillStyle = '#2a2420'; g.fillRect(0, (this.H - 1) * T, W * T, T);
        g.fillStyle = '#3d342c'; g.fillRect(0, (this.H - 1) * T, W * T, 6);
        const ex = M.exit[0] * T;
        const fr = this.spr[I.floor] || this.spr['floor.0'];
        g.drawImage(this.atlas, fr[0], fr[1], 32, 32, ex, (this.H - 1) * T, 32, 32);
        g.fillStyle = 'rgba(255,236,190,0.18)'; g.fillRect(ex + 4, (this.H - 1) * T + 6, 24, 26);
        g.fillStyle = '#6b3d24'; g.fillRect(ex + 4, (this.H - 1) * T + 16, 24, 12);
        g.fillStyle = '#8a5434'; g.fillRect(ex + 6, (this.H - 1) * T + 18, 20, 8);
      }
    }

    // ---------------------------------------------------------------- moving about
    walkTo(cx, cy, then) {
      const H = this.hero, [sx, sy] = this._cellOf(H);
      let c = this._ok(cx, cy) ? [cx, cy] : this._nearestOk(cx, cy);
      if (!c) return false;
      const p = this._path(sx, sy, c[0], c[1]);
      if (!p) return false;
      H.path = p; H.goal = then || null;
      if (!p.length && then) { H.goal = null; then(); }
      return true;
    }
    // Walk up to someone (or something) and do then: the nearest free cell beside them
    _approach(cx, cy, then, reach) {
      reach = reach || 1;
      const H = this.hero, [hx, hy] = this._cellOf(H);
      if (Math.abs(hx - cx) <= reach && Math.abs(hy - cy) <= reach && (hx !== cx || hy !== cy)) { this._face(H, px(cx), px(cy)); then(); return; }
      let best = null, bd = 1e9;
      for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
        if (!dx && !dy) continue;
        const x = cx + dx, y = cy + dy; if (!this._ok(x, y)) continue;
        const p = this._path(hx, hy, x, y); if (!p) continue;
        const d = p.length + (dx && dy ? 0.5 : 0); if (d < bd) { bd = d; best = [x, y]; }
      }
      if (!best) { if (reach < 3) this._approach(cx, cy, then, reach + 1); return; }
      this.walkTo(best[0], best[1], () => { this._face(H, px(cx), px(cy)); then(); });
    }
    _face(a, x, y) { const dx = x - a.x, dy = y - a.y; a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
    _step(a, dt) {
      if (!a.path || !a.path.length) return false;
      const c = a.path[0], tx = px(c[0]), ty = px(c[1]), dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy), v = (a.speed || 40) * dt;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      if (d <= v) { a.x = tx; a.y = ty; a.path.shift(); } else { a.x += (dx / d) * v; a.y += (dy / d) * v; }
      a.ft += dt;
      return true;
    }
    _update(dt) {
      this.t += dt;
      const H = this.hero;
      if (H.path.length) { this._step(H, dt); if (!H.path.length && H.goal) { const g = H.goal; H.goal = null; g(); } }
      else H.ft = 0;
      // gone through the south gate
      if (this.scene === 'town') { const [cx, cy] = this._cellOf(H); if (cy >= this.H - 1 && !H.path.length && !this.gated) { this.gated = true; if (this.o.onGate) this.o.onGate(); } else if (cy < this.H - 1) this.gated = false; }
      this.people.forEach((a) => {
        if (a.p.scene !== this.scene) return;
        if (a.talking > 0) { a.talking -= dt; a.path = []; this._face(a, H.x, H.y); return; }
        if (a.path.length) { this._step(a, dt); return; }
        a.ft = 0;
        if ((a.next -= dt) > 0) return;
        a.next = 2.5 + Math.random() * 6;
        if (!a.p.roam) { a.dir = a.p.dir || 'down'; return; }
        if (Math.random() < 0.18 && !a.bub) { a.bub = { icon: IDLE[Math.floor(Math.random() * IDLE.length)], t: 0, dur: 2.4 }; return; }
        const [cx, cy] = this._cellOf(a), R = a.p.roam;
        for (let i = 0; i < 8; i++) {
          const x = a.home[0] + Math.round((Math.random() * 2 - 1) * R), y = a.home[1] + Math.round((Math.random() * 2 - 1) * R);
          if (!this._ok(x, y) || (x === cx && y === cy)) continue;
          const p = this._path(cx, cy, x, y); if (p && p.length <= R * 3) { a.path = p; break; }
        }
      });
    }

    // ---------------------------------------------------------------- the frame
    _resize() {
      const r = this.el.getBoundingClientRect(), dev = Math.min(3, window.devicePixelRatio || 1);
      const k0 = Math.max(1, Math.round((r.width * dev) / 400)), dpr = this.o.fullRes ? dev : dev * Math.min(k0, 2) / k0;
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
      this.dpr = dpr;
    }
    _scale() {
      const W = this.canvas.width, Hh = this.canvas.height;
      if (this.scene !== 'town') {   // a room fills the view: whole steps when they come close, else as near as fits
        const fit = Math.min(W / (this.W * T), Hh / ((this.H + 0.6) * T)), whole = Math.floor(fit);
        return Math.max(0.5, Math.min(4, whole >= fit * 0.85 ? whole : fit));
      }
      if (this.k) return this.k;
      return Math.max(1, Math.round(W / 420));
    }
    zoom() { const opts = [0, 1, 2, 3]; this.k = opts[(opts.indexOf(this.k) + 1) % opts.length]; return this.k; }
    follow() { this.cam.manual = 0; }
    _camTarget() { const H = this.hero; return [H.x, H.y - 20]; }
    _clamp(cx, cy, W, Hh, k) {
      const vw = W / k, vh = Hh / k, WW = this.W * T, WH = this.H * T;
      cx = vw >= WW ? WW / 2 : Math.max(vw / 2, Math.min(WW - vw / 2, cx));
      cy = vh >= WH ? WH / 2 : Math.max(vh / 2, Math.min(WH - vh / 2, cy));
      return [cx, cy];
    }
    _frame(now) {
      if (!this.alive) return;
      this._raf = requestAnimationFrame((t) => this._frame(t));
      if (!this.active || document.hidden) { this.last = now; return; }
      const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
      if (dt < 1 / 62 && this.last) return;
      this.last = now;
      this._resize();
      this._update(dt);
      if (this.cam.manual > 0) this.cam.manual -= dt;
      else { const [tx, ty] = this._camTarget(); this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 4); this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 4); }
      this.render(this.g, this.canvas.width, this.canvas.height, this._scale());
    }
    _drawActor(g, a) {
      const sh = a.sheets; if (!sh) return;
      const moving = a.path && a.path.length, anim = moving ? 'walk' : 'idle', sheet = sh[anim] || sh.walk, A = root.LPC.ANIM[anim];
      const f = moving ? 1 + Math.floor(a.ft * 11) % 8 : Math.floor((this.t + (a.x % 7)) * 1.6) % 2;
      const row = DIRS[a.dir] == null ? 2 : DIRS[a.dir], x = Math.round(a.x - 32), y = Math.round(a.y - FEET);
      g.fillStyle = 'rgba(15,10,18,0.28)'; g.beginPath(); g.ellipse(x + 32, y + FEET, 9, 3, 0, 0, Math.PI * 2); g.fill();
      g.drawImage(sheet, (f % A.n) * 64, row * 64, 64, 64, x, y, 64, 64);
    }
    _drawObj(g, ob) {
      // The generated room background already contains its static furniture and architecture.
      // Keep the legacy objects in the scene data for collision/interaction, but don't double-draw them.
      if (this.scene !== 'town' && this.sceneArt && this.sceneArtKey === this.ik) return;
      if (ob.ts) { const r = this.tspr[ob.ts]; g.drawImage(this.tatlas, r[0], r[1], r[2], r[3], ob.x0, ob.y0, r[2], r[3]); return; }
      const r = this.spr[ob.s]; if (!r) return;
      if (ob.lot) { g.drawImage(this.atlas, r[0], r[1], r[2], r[3], ob.x0, ob.y0, r[2], r[3]); return; }
      g.drawImage(this.atlas, r[0], r[1], r[2], r[3], Math.round(ob.ax - r[2] / 2), Math.round(ob.ay - r[3]), r[2], r[3]);
    }
    render(g, W, Hh, k) {
      const [cx, cy] = this.cam.manual > 0 ? [this.cam.x, this.cam.y] : this._clamp(this.cam.x, this.cam.y, W, Hh, k);
      if (this.cam.manual <= 0) { this.cam.x = cx; this.cam.y = cy; }
      const ox = Math.round(W / 2 - cx * k), oy = Math.round(Hh / 2 - cy * k);
      this.view = { ox: ox, oy: oy, k: k };
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#0d0b09'; g.fillRect(0, 0, W, Hh);
      g.imageSmoothingEnabled = false;
      g.setTransform(k, 0, 0, k, ox, oy);
      { // only the part of the ground on screen
        const sx0 = Math.max(0, Math.floor(-ox / k)), sy0 = Math.max(0, Math.floor(-oy / k)), sx1 = Math.min(this.stat.width, Math.ceil((W - ox) / k) + 1), sy1 = Math.min(this.stat.height, Math.ceil((Hh - oy) / k) + 1);
        if (sx1 > sx0 && sy1 > sy0) g.drawImage(this.stat, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0, sy0, sx1 - sx0, sy1 - sy0);
      }
      const vx0 = -ox / k - 160, vx1 = (W - ox) / k + 160, vy0 = -oy / k - 40, vy1 = (Hh - oy) / k + 260;
      const items = this.objs.filter((o) => o.ax > vx0 && o.ax < vx1 && o.ay > vy0 && o.ay < vy1).map((o) => ({ y: o.flat ? -1e6 : o.wall ? o.ay - 2000 : o.ay, ob: o }));
      items.push({ y: this.hero.y + 0.2, actor: this.hero });
      this.people.forEach((a) => { if (a.p.scene === this.scene && a.sheets) items.push({ y: a.y + 0.1, actor: a }); });
      items.sort((a, b) => a.y - b.y);
      items.forEach((it) => (it.actor ? this._drawActor(g, it.actor) : this._drawObj(g, it.ob)));
      // night
      const hr = hourNow(), night = hr >= 20.5 || hr < 5 ? 1 : hr >= 18.5 ? (hr - 18.5) / 2 : hr < 6.5 ? (6.5 - hr) / 1.5 : 0;
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (night > 0 && this.scene === 'town') {
        g.fillStyle = 'rgba(16,20,52,' + (0.4 * night).toFixed(3) + ')'; g.fillRect(0, 0, W, Hh);
        g.globalCompositeOperation = 'lighter';
        this.objs.forEach((o) => {
          if (o.s !== 'gardenlamp') return;
          const sx = ox + o.ax * k, sy = oy + (o.ay - 66) * k, R = 54 * k, gr = g.createRadialGradient(sx, sy, 0, sx, sy, R);
          gr.addColorStop(0, 'rgba(255,170,80,' + (0.3 * night).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,170,80,0)');
          g.fillStyle = gr; g.fillRect(sx - R, sy - R, R * 2, R * 2);
        });
        g.globalCompositeOperation = 'source-over';
      }
      this._labels(g, ox, oy, k);
      this._bubbles(g, ox, oy, k);
    }
    // names over the empty lots and the companions' homes, and over everyone you can talk to
    _labels(g, ox, oy, k) {
      const u = Math.max(2.4 * (this.dpr || 1) / 1.6, k * 1.15), fs = Math.round(8.5 * u);
      g.font = '600 ' + fs + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
      const tag = (txt, x, y, col) => {
        const w = g.measureText(txt).width + 8 * u;
        g.fillStyle = 'rgba(12,10,8,0.72)'; g.fillRect(Math.round(x - w / 2), Math.round(y - fs - 3 * u), Math.round(w), Math.round(fs + 4 * u));
        g.fillStyle = col || '#f1e6c8'; g.fillText(txt, Math.round(x), Math.round(y));
      };
      if (this.scene === 'town') (this.o.world.lots || []).forEach((L) => {
        if (L.built && !L.npc) return;
        if (!L.built && !L.k && !L.taken) return;
        const x = ox + (L.x + L.w / 2) * T * k, y = oy + (L.y + (L.built ? 0.6 : L.h / 2)) * T * k;
        tag(L.k && !L.built ? L.icon + ' ' + L.name : L.name, x, y, L.k ? '#f1e6c8' : '#ffd88a');
      });
    }
    _bubbles(g, ox, oy, k) {
      const u = Math.max(2.4 * (this.dpr || 1) / 1.6, k * 1.15);
      this.people.forEach((a) => {
        const b = a.bub; if (!b || a.p.scene !== this.scene) return;
        if ((b.t += 1 / 30) >= b.dur) { a.bub = null; return; }
        const al = Math.min(1, b.t * 5, (b.dur - b.t) * 3), bw = 20 * u, bh = 17 * u;
        const sx = Math.round(ox + (a.x + 4) * k), sy = Math.round(oy + (a.y - 50) * k - bh);
        g.globalAlpha = al; g.fillStyle = '#faf6ec'; g.strokeStyle = '#3c3230'; g.lineWidth = Math.max(1, k * 0.8);
        g.beginPath(); g.roundRect ? g.roundRect(sx, sy, bw, bh, 6 * u) : g.rect(sx, sy, bw, bh); g.fill(); g.stroke();
        g.font = Math.round(10.5 * u) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000';
        g.fillText(b.icon, sx + bw / 2, sy + bh * 0.55);
        g.globalAlpha = 1;
      });
      // who you can talk to, a small marker that pulses
      const pulse = 0.65 + 0.35 * Math.sin(this.t * 4);
      this.people.forEach((a) => {
        if (a.p.scene !== this.scene || !a.sheets || !a.p.mark) return;
        const sx = ox + a.x * k, sy = oy + (a.y - 60) * k;
        g.globalAlpha = pulse; g.fillStyle = '#ffd24a'; g.strokeStyle = '#3c2a10'; g.lineWidth = Math.max(1, u * 0.7);
        g.font = '700 ' + Math.round(13 * u) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
        g.strokeText('!', sx, sy); g.fillText('!', sx, sy); g.globalAlpha = 1;
      });
    }

    // ---------------------------------------------------------------- taps and drags
    _bind() {
      const c = this.canvas;
      let start = null, moved = false;
      const pt = (e) => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * (this.dpr || 1), y: (e.clientY - r.top) * (this.dpr || 1) }; };
      c.addEventListener('pointerdown', (e) => { start = { p: pt(e), cam: { x: this.cam.x, y: this.cam.y } }; moved = false; try { c.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } });
      c.addEventListener('pointermove', (e) => {
        if (!start) return;
        const p = pt(e), k = this._scale(), dx = p.x - start.p.x, dy = p.y - start.p.y;
        if (Math.hypot(dx, dy) > 10 * (this.dpr || 1)) moved = true;
        if (moved && this.scene === 'town') { const [x, y] = this._clamp(start.cam.x - dx / k, start.cam.y - dy / k, c.width, c.height, k); this.cam.x = x; this.cam.y = y; this.cam.manual = 6; }
      });
      c.addEventListener('pointerup', (e) => { if (start && !moved) this._tap(pt(e)); start = null; });
      c.addEventListener('pointercancel', () => { start = null; });
      c.addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
      this._onResize = () => this._resize();
      window.addEventListener('resize', this._onResize);
    }
    // what's at a world point: a person, a building or lot, the way out, or just ground
    hitAt(wx, wy) {
      const near = (a) => a.sheets && Math.abs(wx - a.x) < 13 && wy > a.y - 50 && wy < a.y + 6;
      const who = this.people.filter((a) => a.p.scene === this.scene && near(a)).sort((a, b) => b.y - a.y)[0];
      if (who) return { kind: 'person', a: who };
      const cx = Math.floor(wx / T), cy = Math.floor(wy / T);
      if (this.scene === 'town') {
        if (G().TMAP.gate.some((g) => g[0] === cx && g[1] === cy) || (cx === 20 && cy === 44)) return { kind: 'gate' };
        for (const o of this.objs) if (o.lot && wx >= o.x0 && wx < o.x0 + o.w && wy >= o.y0 + 12 && wy < o.ay) return { kind: 'lot', lot: o.lot };
        for (const o of this.objs) if (o.sign && Math.abs(wx - o.ax) < 14 && wy > o.ay - 30 && wy < o.ay + 4) return { kind: 'lot', lot: o.sign };
        for (const L of this.o.world.lots || []) if (!L.built && cx >= L.x && cx < L.x + L.w && cy >= L.y && cy < L.y + L.h) return { kind: 'lot', lot: L };
      } else {
        const M = G().TMAP;
        if (cy >= M.inH - 1 && Math.abs(cx - M.exit[0]) <= 1) return { kind: 'exit' };
      }
      return { kind: 'ground', x: cx, y: cy };
    }
    _tap(p) {
      const v = this.view; if (!v || !this.hero) return;
      const wx = (p.x - v.ox) / v.k, wy = (p.y - v.oy) / v.k, h = this.hitAt(wx, wy);
      this.cam.manual = 0;
      if (this.o.busy && this.o.busy()) return;
      this.people.forEach((b) => { if (b.talking > 0) b.talking = 0; });
      if (h.kind === 'person') { this.talkTo(h.a.id); return; }
      if (h.kind === 'gate') { this.walkTo(21, 44, () => { if (this.o.onTalk) this.o.onTalk('gate'); }); return; }
      if (h.kind === 'lot') {
        const L = h.lot;
        this.walkTo(L.door[0], L.door[1], () => {
          this.hero.dir = 'up';
          if (L.built) { if (this.o.onEnter) this.o.onEnter(L.id, L); } else if (this.o.onTalk) this.o.onTalk(L.id);
        });
        return;
      }
      if (h.kind === 'exit') { const M = G().TMAP; this.walkTo(M.exit[0], M.exit[1], () => { if (this.o.onLeave) this.o.onLeave(this.ik); }); return; }
      this.walkTo(h.x, h.y);
    }
    talkTo(id) {
      const a = this.people.find((x) => x.id === id && x.p.scene === this.scene);
      if (!a) return false;
      this.people.forEach((b) => { if (b !== a && b.talking > 0 && b.talking < 31) b.talking = 0; });
      a.talking = 25; a.path = [];   // waits for him (let go when the talking ends, or he heads off elsewhere)
      const [cx, cy] = this._cellOf(a);
      this._approach(cx, cy, () => { a.talking = 6; this._face(a, this.hero.x, this.hero.y); if (this.o.onTalk) this.o.onTalk(id); });
      return true;
    }
    // Keep someone facing him while the talking's on screen (the app calls this until the box shuts)
    hold(id, on) { const a = this.people.find((x) => x.id === id); if (a) a.talking = on ? 30 : 0; }
    setMarks(ids) { this.people.forEach((a) => { if (a.p) a.p.mark = ids.indexOf(a.id) >= 0; }); }
    setActive(a) { this.active = !!a; if (a) this._resize(); }
    dispose() { this.alive = false; cancelAnimationFrame(this._raf); window.removeEventListener('resize', this._onResize); if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas); }
  }
  Town2D.assets = assets;
  Town2D.sceneArtCache = {};
  root.Town2D = Town2D;
})(typeof window !== 'undefined' ? window : globalThis);
