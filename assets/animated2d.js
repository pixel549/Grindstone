/* Grindstone shared 2D sprite-sheet animation helper.
 * One renderer-owned clock drives every animation; this module owns no timers.
 */
(function (root) {
  'use strict';

  const imageCache = Object.create(null);
  const manifests = Object.create(null);
  const manifestPromises = Object.create(null);
  const metadataPromises = Object.create(null);
  const failed = Object.create(null);

  function image(src) {
    if (imageCache[src]) return imageCache[src];
    const entry = { image: null, ready: false, failed: false };
    imageCache[src] = entry;
    const im = new Image();
    im.onload = () => { entry.image = im; entry.ready = true; };
    im.onerror = () => { entry.failed = true; };
    im.src = src;
    return entry;
  }

  function init(url) {
    url = url || '2d/animated/manifest.json';
    if (manifests[url]) return Promise.resolve(manifests[url]);
    if (manifestPromises[url]) return manifestPromises[url];
    if (failed[url]) return Promise.resolve(null);
    manifestPromises[url] = fetch(url).then((r) => {
      if (!r.ok) throw new Error('Animated asset manifest: ' + url);
      return r.json();
    }).then((manifest) => {
      const slash = url.lastIndexOf('/');
      manifest.__base = slash >= 0 ? url.slice(0, slash + 1) : '';
      manifest.__assets = manifest.assets || {};
      manifests[url] = manifest;
      return manifest;
    }).catch((e) => {
      failed[url] = true;
      delete manifestPromises[url];
      return null;
    });
    return manifestPromises[url];
  }

  function loadPackedMetadata(manifest, asset) {
    if (asset.frameData) return true;
    if (!asset.metadata) return false;
    const url = manifest.__base + asset.metadata;
    if (!metadataPromises[url]) {
      metadataPromises[url] = fetch(url).then((r) => {
        if (!r.ok) throw new Error('Animated frame metadata: ' + url);
        return r.json();
      }).then((meta) => {
        asset.frameData = meta.frames || [];
        asset.frames = asset.frameData.length;
        asset.pivot = meta.pivot || asset.pivot;
        if (!asset.frameDurationsMs && asset.frameData.length) {
          asset.frameDurationsMs = asset.frameData.map((frame) => {
            const d = frame.duration || {};
            return (Number(d.numerator_ms) || 0) / Math.max(1, Number(d.denominator) || 1);
          });
        }
        if (asset.loop == null) asset.loop = meta.loop_mode !== 'none';
        return true;
      }).catch(() => false);
    }
    return false;
  }

  function frameAt(asset, elapsed) {
    const durations = asset.frameDurationsMs;
    if (durations && durations.length) {
      const total = durations.reduce((sum, n) => sum + Math.max(1, n), 0);
      let t = Math.max(0, elapsed * 1000);
      if (asset.loop !== false) t = total ? t % total : 0;
      else t = Math.min(t, Math.max(0, total - 0.001));
      let i = 0;
      while (i < durations.length - 1 && t >= durations[i]) { t -= durations[i]; i++; }
      return i;
    }
    const count = Math.max(1, asset.frames | 0);
    const fps = Math.max(0.01, Number(asset.fps) || 1);
    const raw = Math.floor(Math.max(0, elapsed) * fps);
    return asset.loop === false ? Math.min(count - 1, raw) : raw % count;
  }

  function draw(ctx, id, anchorX, anchorY, elapsed, options) {
    options = options || {};
    const manifestUrl = options.manifest || '2d/animated/manifest.json';
    const manifest = manifests[manifestUrl];
    if (!manifest) {
      init(manifestUrl);
      return false;
    }
    const asset = manifest.__assets[id];
    if (!asset) return false;
    const src = manifest.__base + asset.sheet;
    const loaded = image(src);
    if (!loaded.ready) return false;

    const phase = Number(options.phase) || 0;
    const time = Math.max(0, Number(elapsed) || 0) + phase;
    const index = frameAt(asset, time);
    const scale = Math.max(0.125, Number(options.scale) || 1);
    const pivot = asset.pivot || [0, asset.frameHeight || 0];
    let sx, sy, sw, sh, px = pivot[0], py = pivot[1], trimScale = 1;

    if (asset.layout === 'packed') {
      if (!asset.frameData && !loadPackedMetadata(manifest, asset)) return false;
      const frame = asset.frameData && asset.frameData[index];
      if (!frame) return true;
      if (frame.visibleBounds === null || frame.visible_bounds === null) return true;
      const rect = frame.sheet || frame.rect || {};
      sx = rect.x; sy = rect.y; sw = rect.width; sh = rect.height;
      const tp = frame.trimmedPivot || frame.trimmed_pivot || pivot;
      px = tp[0]; py = tp[1]; trimScale = Number(rect.scale) || 1;
    } else if (asset.layout === 'grid') {
      const fw = asset.frameWidth, fh = asset.frameHeight, cols = Math.max(1, asset.columns || 8);
      sx = (index % cols) * fw; sy = Math.floor(index / cols) * fh; sw = fw; sh = fh;
    } else {
      const fw = asset.frameWidth, fh = asset.frameHeight;
      sx = index * fw; sy = 0; sw = fw; sh = fh;
    }

    if (![sx, sy, sw, sh].every(Number.isFinite) || sw <= 0 || sh <= 0) return false;
    const dx = Math.round(anchorX - px * trimScale * scale + (Number(options.offsetX) || 0));
    const dy = Math.round(anchorY - py * trimScale * scale + (Number(options.offsetY) || 0));
    ctx.save();
    if (options.alpha != null) ctx.globalAlpha *= Math.max(0, Math.min(1, options.alpha));
    ctx.imageSmoothingEnabled = false;
    if (options.flipX) {
      ctx.translate(dx * 2 + sw * scale, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(loaded.image, sx, sy, sw, sh, dx, dy, sw * scale, sh * scale);
    } else {
      ctx.drawImage(loaded.image, sx, sy, sw, sh, dx, dy, sw * scale, sh * scale);
    }
    ctx.restore();
    return true;
  }

  root.Animated2D = { init: init, draw: draw, clear: function () {
    Object.keys(imageCache).forEach((k) => delete imageCache[k]);
    Object.keys(manifests).forEach((k) => delete manifests[k]);
    Object.keys(manifestPromises).forEach((k) => delete manifestPromises[k]);
    Object.keys(metadataPromises).forEach((k) => delete metadataPromises[k]);
    Object.keys(failed).forEach((k) => delete failed[k]);
  } };
})(typeof window !== 'undefined' ? window : globalThis);
