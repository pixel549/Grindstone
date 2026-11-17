/* Grindstone — the hero: a full-body chibi rig built from their look + equipped gear.
 * The same rig is used on the paper doll, in previews, and walking around the house.
 * Named groups (.lgL .lgR .up .arL .arR .face .prop .tool .wpn) are animated by home.js. */
(function (root) {
  'use strict';
  const RC = (t) => G.RARITY[t].c;

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const mix = (c) => Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f);
    r = mix(r); g = mix(g); b = mix(b);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  const DEFS = `<defs>
    <linearGradient id="gsSteel" x1="0" x2="1"><stop offset="0" stop-color="#e2e5eb"/><stop offset=".5" stop-color="#a3a8b4"/><stop offset="1" stop-color="#666b77"/></linearGradient>
    <linearGradient id="gsSteel2" x1="0" x2="1"><stop offset="0" stop-color="#9aa0ab"/><stop offset=".55" stop-color="#787d88"/><stop offset="1" stop-color="#4c505a"/></linearGradient>
  </defs>`;

  // ---------- weapons (grip at 0,0, pointing up) ----------
  function weaponArt(it) {
    if (!it) return '';
    const a = RC(it.tier), wood = '#5a3d28';
    switch (it.art) {
      case 'blade':
        return `<rect x="-1.4" y="-2" width="2.8" height="7" rx="1" fill="${wood}"/><rect x="-6" y="-4.2" width="12" height="2.4" rx="1" fill="${a}"/>
          <path d="M-2.1,-4 L-2.1,-36 L0,-41 L2.1,-36 L2.1,-4 Z" fill="url(#gsSteel)"/><path d="M0,-6 L0,-36" stroke="#80858f" stroke-width=".6"/>
          <circle cx="0" cy="6.3" r="2" fill="${a}"/>`;
      case 'axe':
        return `<rect x="-1.2" y="-34" width="2.4" height="42" rx="1" fill="${wood}"/>
          <path d="M1,-33 C11,-36 15,-27 13.5,-18 C9,-21.5 5,-21.5 1,-21 Z" fill="url(#gsSteel)"/>
          <path d="M10,-34 C14,-29 15,-23 13.5,-18" stroke="#f0f2f6" stroke-width=".8" fill="none"/><rect x="-1.7" y="-15" width="3.4" height="4" fill="${a}"/>`;
      case 'blunt':
        return `<rect x="-1.2" y="-27" width="2.4" height="35" rx="1" fill="${wood}"/><rect x="-7" y="-37" width="14" height="11" rx="1.6" fill="url(#gsSteel)"/>
          <rect x="-7" y="-33.5" width="14" height="2" fill="${a}"/><rect x="-1.7" y="-16" width="3.4" height="3.5" fill="${a}"/>`;
      case 'polearm':
        return `<rect x="-1" y="-44" width="2" height="54" rx="1" fill="${wood}"/><path d="M-2.6,-44 L0,-57 L2.6,-44 Z" fill="url(#gsSteel)"/>
          <path d="M1,-43 C8,-44 11.5,-39 10.5,-33 C7.5,-36 4,-37 1,-37 Z" fill="url(#gsSteel)"/><rect x="-1.6" y="-44" width="3.2" height="3" fill="${a}"/>`;
      case 'staff':
        return `<path d="M0,10 C-1.5,-4 1.5,-18 -0.5,-30 C-1,-33 0.6,-35 0,-36" stroke="${wood}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
          <circle cx="0" cy="-40" r="7.5" fill="${a}" opacity=".28"/><rect x="-3.6" y="-44.5" width="7.2" height="9" rx="1.6" fill="${shade(a, -0.6)}" stroke="#c9b37a" stroke-width=".9"/>
          <circle cx="0" cy="-40" r="2.3" fill="${shade(a, 0.5)}"/><path d="M-3.6,-44.5 L0,-47.5 L3.6,-44.5" fill="none" stroke="#c9b37a" stroke-width=".9"/>`;
    }
    return '';
  }

  // ---------- body ----------
  function bodyColours(it, outfit) {
    if (!it) return { main: outfit, dark: shade(outfit, -0.35), trim: shade(outfit, 0.25), sleeve: outfit, steel: false };
    const a = RC(it.tier);
    switch (it.art) {
      case 'coat': return { main: shade(a, -0.58), dark: shade(a, -0.72), trim: a, sleeve: shade(a, -0.58) };
      case 'armour': return { main: 'url(#gsSteel2)', dark: '#4c505a', trim: a, sleeve: '#8d939e', steel: true };
      case 'robe': return { main: shade(a, -0.45), dark: shade(a, -0.65), trim: a, sleeve: shade(a, -0.45) };
      default: return { main: '#8a7254', dark: '#6a563e', trim: a, sleeve: '#8a7254' };
    }
  }

  function skirt(it, tw, c) {
    if (!it) return '';
    switch (it.art) {
      case 'coat':
        return `<path d="M${-tw + 1},-22 L${-tw - 1.5},-7 L-1,-7 L-0.6,-22 Z M${tw - 1},-22 L${tw + 1.5},-7 L1,-7 L0.6,-22 Z" fill="${c.dark}"/>
          <path d="M${-tw - 1.5},-7 L-1,-7 M${tw + 1.5},-7 L1,-7" stroke="${c.trim}" stroke-width="1"/>`;
      case 'armour':
        return `<path d="M${-tw + 1.5},-22 L${-tw},-13 L-1,-13 L-1,-22 Z M${tw - 1.5},-22 L${tw},-13 L1,-13 L1,-22 Z" fill="url(#gsSteel)" stroke="${c.trim}" stroke-width=".7"/>`;
      case 'robe':
        return `<path d="M${-tw + 1.5},-22 L${-tw - 3.5},-2.5 L${tw + 3.5},-2.5 L${tw - 1.5},-22 Z" fill="${c.main}"/>
          <path d="M${-tw - 3.5},-3 L${tw + 3.5},-3" stroke="${c.trim}" stroke-width="1.6"/><path d="M0,-22 L0,-3" stroke="${c.dark}" stroke-width="1"/>`;
      default:
        return `<path d="M${-tw + 1.5},-22 L${-tw - 0.5},-14.5 L${tw + 0.5},-14.5 L${tw - 1.5},-22 Z" fill="${c.dark}"/>`;
    }
  }

  function torso(it, tw, c) {
    const shape = `M${-tw},-40 C${-tw},-44 ${-tw + 3},-45.5 0,-45.5 C${tw - 3},-45.5 ${tw},-44 ${tw},-40 L${tw - 1.5},-21 L${-tw + 1.5},-21 Z`;
    let extra = '';
    if (!it) extra = `<path d="M-4,-45.3 L0,-39.5 L4,-45.3" fill="none" stroke="${c.dark}" stroke-width="1.4"/>`;
    else if (it.art === 'coat') extra = `<path d="M-5,-45 L0,-30 L5,-45 L3,-45.5 L0,-37 L-3,-45.5 Z" fill="${c.dark}"/><path d="M-5,-45 L0,-30 L5,-45" fill="none" stroke="${c.trim}" stroke-width=".9"/>
        <path d="M${-tw + 2},-41 L-6,-49 L-3,-44 Z M${tw - 2},-41 L6,-49 L3,-44 Z" fill="${c.main}" stroke="${c.trim}" stroke-width=".6"/><circle cx="2.5" cy="-27.5" r=".9" fill="${c.trim}"/><circle cx="2.5" cy="-32" r=".9" fill="${c.trim}"/>`;
    else if (it.art === 'armour') extra = `<path d="M0,-44 L0,-22" stroke="#555a64" stroke-width="1"/><path d="M${-tw + 3},-33 Q0,-29 ${tw - 3},-33" fill="none" stroke="#555a64" stroke-width=".8"/>`;
    else if (it.art === 'robe') extra = `<path d="M-5,-45.3 L0,-33 L5,-45.3 Z" fill="${c.dark}"/><path d="M-5,-45.3 L0,-33 L5,-45.3" fill="none" stroke="${c.trim}" stroke-width="1.1"/>`;
    else extra = `<path d="M${-tw + 1},-38 L${tw - 1},-38 M${-tw + 1},-33 L${tw - 1},-33 M${-tw + 1.5},-28 L${tw - 1.5},-28" stroke="#6a563e" stroke-width=".8"/><path d="M-4.5,-45.2 Q0,-41 4.5,-45.2" fill="none" stroke="${c.trim}" stroke-width="1.6"/>`;
    const belt = it && it.art === 'robe'
      ? `<rect x="${-tw + 1.6}" y="-25" width="${2 * tw - 3.2}" height="2.6" fill="${c.trim}"/>`
      : `<rect x="${-tw + 1.4}" y="-24.5" width="${2 * tw - 2.8}" height="3.4" fill="#2b1d14"/><rect x="-1.8" y="-24.8" width="3.6" height="4" rx=".6" fill="none" stroke="#c9b37a" stroke-width=".9"/>`;
    return `<path d="${shape}" fill="${c.main}"/>${extra}${belt}`;
  }

  function pauldrons(it, sx, c) {
    if (!it || it.art !== 'armour') return '';
    return `<ellipse cx="${-sx}" cy="-41.5" rx="6.6" ry="5" fill="url(#gsSteel)" stroke="${c.trim}" stroke-width=".9"/>
      <ellipse cx="${sx}" cy="-41.5" rx="6.6" ry="5" fill="url(#gsSteel)" stroke="${c.trim}" stroke-width=".9"/>`;
  }

  function charmArt(it) {
    if (!it) return '';
    const a = RC(it.tier);
    const gem = it.art === 'phial'
      ? `<rect x="-1.6" y="-38.5" width="3.2" height="4.6" rx="1.2" fill="${a}"/><rect x="-1" y="-40" width="2" height="1.6" fill="#c9b37a"/>`
      : `<circle cx="0" cy="-36.5" r="2.3" fill="${a}"/><circle cx="-.7" cy="-37.2" r=".7" fill="#fff" opacity=".7"/>`;
    return `<path d="M-5,-45 Q0,-38 5,-45" fill="none" stroke="#c9b37a" stroke-width=".6"/><circle cx="0" cy="-36.5" r="5" fill="${a}" opacity=".25"/>${gem}`;
  }

  // ---------- head ----------
  function backHair(L, hidden) {
    if (hidden) return '';
    const h = L.hairColour;
    switch (L.hair) {
      case 'long': return `<path d="M-15,-62 C-17,-46 -15,-38 -10,-35 L10,-35 C15,-38 17,-46 15,-62 Z" fill="${shade(h, -0.15)}"/>`;
      case 'ponytail': return `<path d="M9,-68 C21,-64 21,-48 16,-38 C15,-47 14,-56 9,-62 Z" fill="${shade(h, -0.1)}"/>`;
      case 'bun': return `<circle cx="0" cy="-74.5" r="5.5" fill="${shade(h, -0.08)}"/>`;
    }
    return '';
  }

  function frontHair(L, hidden) {
    if (hidden) return '';
    const h = L.hairColour;
    const cap = `M-14.5,-57 C-15,-71 -8,-74.5 0,-74.5 C8,-74.5 15,-71 14.5,-57 C12,-66 6,-67 0,-66 C-6,-67 -12,-66 -14.5,-57 Z`;
    switch (L.hair) {
      case 'bald': return '<ellipse cx="-4.5" cy="-67" rx="4.2" ry="2" fill="#fff" opacity=".22"/>';
      case 'buzz': return `<path d="M-14,-59 C-14,-70 -8,-73 0,-73 C8,-73 14,-70 14,-59 C11,-64 6,-66 0,-66 C-6,-66 -11,-64 -14,-59 Z" fill="${h}" opacity=".85"/>`;
      case 'short': return `<path d="M-14.5,-58 C-15,-71 -8,-74.5 0,-74.5 C8,-74.5 15,-71 14.5,-58 L12,-62.5 L9,-60.5 L6,-64.5 L2,-61.5 L-2,-64.5 L-6,-61.5 L-9,-64.5 L-12,-61.5 Z" fill="${h}"/>`;
      case 'swept': return `<path d="M-14.5,-55 C-16.5,-72 -6,-76.5 2,-75.5 C10,-74.5 16,-69 14.5,-57 C12,-63 8,-66 4,-66 C-2,-64 -8,-60 -14.5,-55 Z" fill="${h}"/>`;
      case 'mohawk': return `<path d="M-14,-59 C-14,-70 -8,-73 0,-73 C8,-73 14,-70 14,-59 C11,-64 6,-66 0,-66 C-6,-66 -11,-64 -14,-59 Z" fill="${h}" opacity=".25"/>
        <path d="M-3.2,-70 L-4.5,-80 L-1.2,-74.5 L0,-84 L1.2,-74.5 L4.5,-80 L3.2,-70 C2,-72.5 -2,-72.5 -3.2,-70 Z" fill="${h}"/>`;
      default: return `<path d="${cap}" fill="${h}"/>`; // long, ponytail, bun
    }
  }

  function facialHair(L) {
    const h = L.hairColour;
    const mo = `<path d="M-5.2,-52.4 Q-2.6,-54.6 0,-53 Q2.6,-54.6 5.2,-52.4 Q2.6,-51 0,-51.9 Q-2.6,-51 -5.2,-52.4 Z" fill="${shade(h, -0.1)}"/>`;
    switch (L.beard) {
      case 'stubble': return `<path d="M-12.5,-56 C-12.5,-46 -6,-43.5 0,-43.5 C6,-43.5 12.5,-46 12.5,-56 C9,-50 5,-49 0,-49 C-5,-49 -9,-50 -12.5,-56 Z" fill="${h}" opacity=".3"/>`;
      case 'moustache': return mo;
      case 'beard': return `<path d="M-12.8,-57 C-13.2,-45 -6,-41 0,-41 C6,-41 13.2,-45 12.8,-57 C10,-51 6,-50 3.4,-50 L-3.4,-50 C-6,-50 -10,-51 -12.8,-57 Z" fill="${h}"/>${mo}`;
      case 'long': return `<path d="M-12.8,-57 C-13.2,-44 -7,-35 0,-30 C7,-35 13.2,-44 12.8,-57 C10,-51 6,-50 3.4,-50 L-3.4,-50 C-6,-50 -10,-51 -12.8,-57 Z" fill="${h}"/>${mo}`;
    }
    return '';
  }

  function eyes(L) {
    const pupil = '#1b1418';
    const one = (x) => {
      if (L.eyes === 'narrow') return `<rect x="${x - 2.3}" y="-58.3" width="4.6" height="1.7" rx=".85" fill="${pupil}"/>`;
      if (L.eyes === 'sleepy') return `<ellipse cx="${x}" cy="-57" rx="1.7" ry="1.3" fill="${pupil}"/><path d="M${x - 2.4},-58.2 Q${x},-59.4 ${x + 2.4},-58.2" stroke="${pupil}" stroke-width="1.1" fill="none"/>`;
      return `<ellipse cx="${x}" cy="-57.5" rx="1.9" ry="2.4" fill="${pupil}"/><circle cx="${x + .6}" cy="-58.4" r=".7" fill="#fff"/>`;
    };
    const brow = L.hair === 'bald' ? shade(L.skin, -0.45) : shade(L.hairColour, -0.1);
    return one(-5) + one(5) + `<path d="M-7.5,-62 L-2.6,-62.8 M7.5,-62 L2.6,-62.8" stroke="${brow}" stroke-width="1.3" stroke-linecap="round"/>`;
  }

  function extras(L) {
    switch (L.extra) {
      case 'scar': return '<path d="M-8.5,-63 L-2.5,-52.5" stroke="#b5594a" stroke-width="1" opacity=".85"/>';
      case 'eyepatch': return '<path d="M-14,-62.5 L13.5,-67" stroke="#121014" stroke-width="1.1"/><ellipse cx="-5" cy="-57.5" rx="3.6" ry="3.1" fill="#121014"/>';
      case 'glasses': return '<g fill="#ffffff14" stroke="#18171c" stroke-width="1.1"><circle cx="-5" cy="-57.5" r="3.6"/><circle cx="5" cy="-57.5" r="3.6"/></g><path d="M-1.4,-58 L1.4,-58 M-8.6,-58 L-13,-59.5 M8.6,-58 L13,-59.5" stroke="#18171c" stroke-width="1"/>';
      case 'freckles': return '<g fill="#8a4a2e" opacity=".5"><circle cx="-8" cy="-53.5" r=".6"/><circle cx="-6.2" cy="-52.4" r=".6"/><circle cx="-9" cy="-51.8" r=".55"/><circle cx="8" cy="-53.5" r=".6"/><circle cx="6.2" cy="-52.4" r=".6"/><circle cx="9" cy="-51.8" r=".55"/></g>';
    }
    return '';
  }

  function headGear(it) {
    if (!it) return { back: '', front: '', hideHair: false, hideFace: false, hideMouth: false, hideEars: false };
    const a = RC(it.tier);
    switch (it.art) {
      case 'hood': return {
        back: `<circle cx="0" cy="-58" r="18.5" fill="${shade(a, -0.62)}"/><path d="M-17,-52 C-20,-40 -14,-36 -8,-38 L8,-38 C14,-36 20,-40 17,-52 Z" fill="${shade(a, -0.62)}"/>`,
        front: `<path d="M-16.5,-50 C-18.5,-71 -9,-77.5 0,-77.5 C9,-77.5 18.5,-71 16.5,-50 C15,-59 11,-68.5 0,-68.5 C-11,-68.5 -15,-59 -16.5,-50 Z" fill="${shade(a, -0.5)}"/>
          <path d="M-16.5,-50 C-15,-59 -11,-68.5 0,-68.5 C11,-68.5 15,-59 16.5,-50" fill="none" stroke="${a}" stroke-width="1.2"/>`,
        hideHair: true, hideEars: true };
      case 'hat': return {
        back: '', hideHair: false,
        front: `<ellipse cx="0" cy="-67.5" rx="21" ry="4.2" fill="${shade(a, -0.5)}" stroke="${shade(a, -0.15)}" stroke-width=".7"/>
          <path d="M-11,-68 C-11,-81 11,-81 11,-68 Z" fill="${shade(a, -0.38)}"/><rect x="-11" y="-72" width="22" height="3.2" fill="${a}"/>` };
      case 'helm': return {
        back: '', hideHair: true, hideFace: true, hideEars: true,
        front: `<path d="M-16,-55 C-17,-73 -9,-78.5 0,-78.5 C9,-78.5 17,-73 16,-55 L16,-46 C10,-41.5 -10,-41.5 -16,-46 Z" fill="url(#gsSteel)"/>
          <rect x="-11" y="-60" width="22" height="3.4" rx="1.4" fill="#0b0a0d"/><path d="M0,-78 L0,-60 M0,-56.6 L0,-42.5" stroke="#5d626c" stroke-width="1"/>
          <circle cx="-5" cy="-50" r=".8" fill="#2a2c32"/><circle cx="-2" cy="-48" r=".8" fill="#2a2c32"/><circle cx="2" cy="-48" r=".8" fill="#2a2c32"/><circle cx="5" cy="-50" r=".8" fill="#2a2c32"/>
          <path d="M0,-78 C4,-88 14,-90 20,-86.5 C13,-84.5 8,-80.5 6,-76.5 Z" fill="${a}"/>` };
      case 'crown': return {
        back: '', hideHair: false,
        front: `<path d="M-11,-68.5 L11,-68.5 L10.2,-75 L6,-71.5 L3,-79 L0,-72.5 L-3,-79 L-6,-71.5 L-10.2,-75 Z" fill="${shade(a, 0.15)}" stroke="${shade(a, -0.4)}" stroke-width=".6"/><circle cx="0" cy="-70.6" r="1.4" fill="${shade(a, -0.5)}"/>` };
      case 'mask': return {
        back: '', hideHair: false, hideMouth: true,
        front: `<path d="M-13.2,-56 C-13.2,-46 -6,-42 0,-42 C6,-42 13.2,-46 13.2,-56 C8,-53 4,-52.6 0,-52.6 C-4,-52.6 -8,-53 -13.2,-56 Z" fill="${shade(a, -0.55)}"/>
          <path d="M-13.2,-56 C-8,-53 -4,-52.6 0,-52.6 C4,-52.6 8,-53 13.2,-56" fill="none" stroke="${a}" stroke-width=".9"/><path d="M-7,-47.5 L7,-47.5" stroke="${shade(a, -0.3)}" stroke-width=".6"/>` };
    }
    return { back: '', front: '', hideHair: false };
  }

  function ears(L) {
    const c = shade(L.skin, -0.08);
    if (L.ears === 'pointed') return `<path d="M12.5,-60 L23,-68 L15.5,-53.5 Z M-12.5,-60 L-23,-68 L-15.5,-53.5 Z" fill="${c}"/>`;
    return `<ellipse cx="14" cy="-57" rx="3" ry="4" fill="${c}"/><ellipse cx="-14" cy="-57" rx="3" ry="4" fill="${c}"/>`;
  }

  // ---------- the rig ----------
  function itemsOf(s) {
    const o = {};
    G.SLOTS.forEach((sl) => { o[sl] = G.equipped(s, sl); });
    return o;
  }

  function rig(look, items) {
    const L = flat2d(G.normLook(look));
    const tw = L.build === 'broad' ? 13 : 11;
    const sx = tw - 0.5;
    const c = bodyColours(items.body, L.outfit);
    const hg = headGear(items.head);
    const pants = '#3a3340', boot = '#3b2a20';
    const leg = (x0, toe) => `<rect x="${x0}" y="-23" width="7" height="18.5" rx="2.6" fill="${pants}"/>
      <path d="M${x0 - (toe < 0 ? 1.2 : 0)},-6 h8.2 v4.2 q0,1.8 -1.8,1.8 h-6.6 q-1.8,0 -1.8,-1.8 Z" fill="${boot}"/>`;
    const arm = (cls, x, extra) => `<g class="${cls}" transform="translate(${x},-41)"><rect x="-3.2" y="-1.5" width="6.4" height="13.5" rx="3" fill="${c.sleeve}"/>
      <circle cx="0" cy="14" r="3.3" fill="${L.skin}"/>${extra || ''}</g>`;
    const face = hg.hideFace ? '' : `<g class="face">${eyes(L)}${extras(L)}${hg.hideMouth ? '' : facialHair(L)}${hg.hideMouth ? '' : '<path d="M-2.4,-50.6 Q0,-49 2.4,-50.6" stroke="#5a2a22" stroke-width="1.1" fill="none" stroke-linecap="round"/>'}</g>`;
    return `<g class="rig">
      <ellipse cx="0" cy="0" rx="15" ry="3.2" fill="#000" opacity=".28"/>
      <g class="lgL">${leg(-9.5, -1)}</g><g class="lgR">${leg(2.5, 1)}</g>
      <g class="up">
        ${hg.back}${backHair(L, hg.hideHair)}
        ${skirt(items.body, tw, c)}
        ${torso(items.body, tw, c)}
        ${arm('arL', -sx)}
        ${arm('arR', sx, `<g class="wpn" transform="translate(0,14) rotate(22)">${weaponArt(items.weapon)}</g><g class="tool" transform="translate(0,14)"></g>`)}
        ${pauldrons(items.body, sx, c)}
        ${charmArt(items.charm)}
        <rect x="-3.2" y="-49" width="6.4" height="6" fill="${shade(L.skin, -0.18)}"/>
        ${hg.hideEars ? '' : ears(L)}
        <circle cx="0" cy="-58" r="14" fill="${L.skin}"/>
        <path d="M0,-72 C8,-72 14,-66 14,-58 C14,-50 9,-44.5 4,-44 C9,-50 10,-65 0,-72 Z" fill="${shade(L.skin, -0.12)}" opacity=".55"/>
        ${face}${frontHair(L, hg.hideHair)}${hg.front}
        <g class="prop"></g>
      </g>
    </g>`;
  }

  // Full figure (paper doll / previews). s needs look, inv, eq.
  function figure(s, opts) {
    opts = opts || {};
    const vb = opts.viewBox || '-46 -96 92 102';
    return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" class="figure">${DEFS}${rig(s.look, itemsOf(s))}</svg>`;
  }

  // Head-and-shoulders badge for the top bar.
  function head(s) {
    const its = itemsOf(s);
    let best = -1;
    G.SLOTS.forEach((sl) => { if (its[sl] && its[sl].tier > best) best = its[sl].tier; });
    const ring = best >= 0 ? RC(best) : '#4a4152';
    const id = 'hb' + Math.random().toString(36).slice(2, 7);
    return `<svg viewBox="-22 -84 44 44" xmlns="http://www.w3.org/2000/svg" class="figure">${DEFS}
      <clipPath id="${id}"><circle cx="0" cy="-62" r="21"/></clipPath>
      <circle cx="0" cy="-62" r="21.5" fill="#2a2232"/>
      <g clip-path="url(#${id})">${rig(s.look, its)}</g>
      <circle cx="0" cy="-62" r="21" fill="none" stroke="${ring}" stroke-width="1.4"/></svg>`;
  }

  const CHEST = (gilded) => {
    const band = gilded ? '#f0c766' : '#8d8f96', wood = gilded ? '#6b3f22' : '#5a3a24';
    return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="92" rx="46" ry="6" fill="#000" opacity=".35"/>
      <path d="M12,42 C12,16 108,16 108,42 Z" fill="${wood}"/><rect x="12" y="42" width="96" height="46" rx="4" fill="${wood}"/>
      <path d="M12,42 L108,42" stroke="#2b1a10" stroke-width="3"/>
      <rect x="24" y="22" width="8" height="66" fill="${band}"/><rect x="88" y="22" width="8" height="66" fill="${band}"/>
      <rect x="50" y="36" width="20" height="22" rx="3" fill="${band}"/><circle cx="60" cy="45" r="3" fill="#1b130c"/><rect x="58.5" y="46" width="3" height="7" fill="#1b130c"/>
      <path d="M18,30 C40,20 80,20 102,30" stroke="#fff" stroke-width="2" opacity=".15" fill="none"/>
    </svg>`;
  };

  // ================= gothic set: silhouette hero, item icons, sigil =================
  const SIL_DEFS = (id) => `<defs>
    <linearGradient id="${id}f" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#0c0b0a"/><stop offset=".62" stop-color="#100e0c"/><stop offset="1" stop-color="#4d412c"/></linearGradient>
    <linearGradient id="${id}m" x1="0" x2="1"><stop offset="0" stop-color="#121316"/><stop offset=".62" stop-color="#1c1d21"/><stop offset="1" stop-color="#6a6253"/></linearGradient>
    <radialGradient id="${id}g" cx="50%" cy="58%" r="55%"><stop offset="0" stop-color="#4a3f2e" stop-opacity=".75"/><stop offset=".55" stop-color="#241d16" stop-opacity=".45"/><stop offset="1" stop-color="#0b0a09" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}l"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="currentColor" stop-opacity=".55"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient>
  </defs>`;

  function silWeapon(it, F, M) {
    if (!it) return '';
    const a = RC(it.tier);
    const glint = `<path d="M2.2,8 L2.2,62" stroke="${a}" stroke-width=".7" opacity=".55"/>`;
    switch (it.art) {
      case 'blade': return `<g transform="translate(27,-80) rotate(-18)"><rect x="-2" y="-8" width="4" height="12" fill="${F}"/><rect x="-9" y="3" width="18" height="3" rx="1" fill="${M}"/><path d="M-2.6,6 L-2.4,64 L0,72 L2.4,64 L2.6,6 Z" fill="${M}"/>${glint}<circle cx="0" cy="-10" r="2.6" fill="${M}"/></g>`;
      case 'axe': return `<g transform="translate(27,-80) rotate(-12)"><rect x="-1.6" y="-10" width="3.2" height="74" rx="1" fill="${F}"/><path d="M1.5,50 C14,46 20,58 18,72 C12,66 6,66 1.5,66 Z" fill="${M}"/><path d="M15,48 C20,56 20,64 18,72" stroke="${a}" stroke-width=".8" fill="none" opacity=".6"/></g>`;
      case 'blunt': return `<g transform="translate(27,-80) rotate(-10)"><rect x="-1.6" y="-10" width="3.2" height="62" rx="1" fill="${F}"/><rect x="-9" y="52" width="18" height="16" rx="2" fill="${M}"/><path d="M-9,56 H9" stroke="${a}" stroke-width=".8" opacity=".6"/></g>`;
      case 'polearm': return `<g transform="translate(29,-80)"><rect x="-1.4" y="-112" width="2.8" height="191" fill="${F}"/><path d="M-3.4,-112 L0,-134 L3.4,-112 Z" fill="${M}"/><path d="M1.4,-110 C11,-112 15,-104 14,-96 C10,-100 5,-101 1.4,-101 Z" fill="${M}"/><path d="M0,-130 L0,-114" stroke="${a}" stroke-width=".7" opacity=".7"/></g>`;
      case 'staff': return `<g transform="translate(29,-80)" style="color:${a}"><circle cx="0" cy="-118" r="26" fill="url(#SILl)"/><path d="M0,80 C-2,40 2,-20 -1,-104 C-1.5,-108 1,-110 0,-112" stroke="${F}" stroke-width="3.2" fill="none"/><rect x="-5" y="-126" width="10" height="13" rx="2" fill="${F}" stroke="#7a6a48" stroke-width=".8"/><circle cx="0" cy="-119.5" r="3" fill="${shade(a, 0.5)}"/></g>`;
    }
    return '';
  }

  // the 2D figure still knows the old hair names
  function flat2d(L) { const m = { cropped: 'buzz', parted: 'short', buns: 'bun', shorn: 'buzz' }; if (m[L.hair]) L.hair = m[L.hair]; return L; }
  function silhouette(s, opts) {
    opts = opts || {};
    const id = 'S' + Math.random().toString(36).slice(2, 7);
    const F = `url(#${id}f)`, M = `url(#${id}m)`;
    const L = flat2d(G.normLook(s.look));
    const its = itemsOf(s);
    const bw = L.build === 'broad' ? 1.12 : 1;
    const b = its.body && its.body.art, h = its.head && its.head.art;
    const ac = (it) => (it ? RC(it.tier) : '#8a7a58');
    let o = SIL_DEFS(id).replace(/SILl/g, id + 'l');
    o += `<ellipse cx="0" cy="-92" rx="78" ry="112" fill="url(#${id}g)"/><ellipse cx="0" cy="0" rx="58" ry="7" fill="#000" opacity=".55"/>`;
    // back hair / hood back
    const hidden = h === 'hood' || h === 'helm';
    if (!hidden && L.hair === 'long') o += `<path d="M-12,-172 C-15,-150 -13,-138 -6,-133 L6,-133 C13,-138 15,-150 12,-172 Z" fill="${F}"/>`;
    if (!hidden && L.hair === 'ponytail') o += `<path d="M8,-170 C20,-164 20,-146 15,-136 C14,-146 12,-156 7,-162 Z" fill="${F}"/>`;
    // weapon behind (polearm, staff) or in front later
    const behind = its.weapon && (its.weapon.art === 'polearm' || its.weapon.art === 'staff');
    if (behind) o += silWeapon(its.weapon, F, M);
    o += `<g transform="scale(${bw},1)">`;
    // legs + boots
    o += `<path d="M-15,-86 L-17,-7 L-5,-7 L-3,-86 Z M15,-86 L17,-7 L5,-7 L3,-86 Z" fill="${F}"/><path d="M-19,-9 h15 v9 h-18 Z M19,-9 h-15 v9 h18 Z" fill="${F}"/>`;
    // robe / coat skirts go over legs
    if (b === 'robe') o += `<path d="M-23,-138 L-37,-1 L37,-1 L23,-138 Z" fill="${F}"/><path d="M-37,-2 L37,-2" stroke="${ac(its.body)}" stroke-width="1" opacity=".55"/>`;
    if (b === 'coat') o += `<path d="M-25,-138 L-29,-92 L-34,-38 L-27,-31 L-21,-40 L-15,-33 L-8,-44 L-3,-86 L3,-86 L8,-44 L15,-33 L21,-40 L27,-31 L34,-38 L29,-92 L25,-138 Z" fill="${F}"/><path d="M-34,-38 L-27,-31 L-21,-40 L-15,-33 L-8,-44 M8,-44 L15,-33 L21,-40 L27,-31 L34,-38" stroke="${ac(its.body)}" stroke-width=".8" fill="none" opacity=".5"/>`;
    if (b === 'light') o += '<path d="M-25,-140 L-27,-70 L27,-70 L25,-140 Z" fill="' + F + '"/>';
    if (b === 'armour') o += `<path d="M-18,-90 L-25,-62 L-3,-64 L-2,-90 Z M18,-90 L25,-62 L3,-64 L2,-90 Z" fill="${M}"/>`;
    // torso
    o += `<path d="M-24,-142 C-27,-120 -20,-102 -16,-86 L16,-86 C20,-102 27,-120 24,-142 C14,-149 -14,-149 -24,-142 Z" fill="${b === 'armour' ? M : F}"/>`;
    // arms
    const sleeve = b === 'robe' ? `<path d="M-24,-140 C-33,-118 -36,-98 -38,-80 L-20,-80 C-21,-100 -20,-118 -18,-134 Z M24,-140 C33,-118 36,-98 38,-80 L20,-80 C21,-100 20,-118 18,-134 Z" fill="${F}"/>`
      : `<path d="M-24,-140 C-31,-120 -31,-100 -30,-83 L-22,-83 C-22,-100 -21,-118 -18,-134 Z M24,-140 C31,-120 31,-100 30,-83 L22,-83 C22,-100 21,-118 18,-134 Z" fill="${F}"/>`;
    o += sleeve + `<circle cx="-26" cy="-79" r="4.4" fill="${F}"/><circle cx="26" cy="-79" r="4.4" fill="${F}"/>`;
    if (b === 'armour') o += `<ellipse cx="-26" cy="-139" rx="11.5" ry="8" fill="${M}"/><ellipse cx="26" cy="-139" rx="11.5" ry="8" fill="${M}"/><path d="M-37,-138 Q-26,-148 -15,-138 M15,-138 Q26,-148 37,-138" stroke="${ac(its.body)}" stroke-width=".8" fill="none" opacity=".6"/>`;
    if (b === 'coat') o += `<path d="M-11,-147 L-17,-163 L-6,-150 Z M11,-147 L17,-163 L6,-150 Z" fill="${F}"/>`;
    o += '</g>';
    // neck + head
    o += `<path d="M-5,-151 L5,-151 L6,-141 L-6,-141 Z" fill="${F}"/><ellipse cx="0" cy="-163" rx="10.5" ry="13" fill="${F}"/>`;
    if (!hidden) {
      if (L.hair === 'mohawk') o += `<path d="M-3,-174 L-2,-184 L0,-178 L1,-188 L2,-178 L4,-184 L3,-174 Z" fill="${F}"/>`;
      if (L.hair === 'bun') o += `<circle cx="0" cy="-178" r="5.2" fill="${F}"/>`;
      if (['short', 'swept', 'long', 'ponytail', 'bun'].indexOf(L.hair) >= 0) o += `<path d="M-11.5,-164 C-12,-176 -6,-179 0,-179 C7,-179 13,-175 11.5,-163 C9,-170 4,-172 0,-172 C-5,-172 -9,-170 -11.5,-164 Z" fill="${F}"/>`;
      if (L.hair === 'swept') o += `<path d="M-12,-168 C-10,-180 4,-182 12,-174 C4,-176 -4,-174 -12,-168 Z" fill="${F}"/>`;
      if (L.beard === 'long' || L.beard === 'beard') o += `<path d="M-8,-158 C-8,-148 -4,${L.beard === 'long' ? -136 : -146} 0,${L.beard === 'long' ? -132 : -144} C4,${L.beard === 'long' ? -136 : -146} 8,-148 8,-158 Z" fill="${F}"/>`;
    }
    // head gear
    if (h === 'hood') o += `<path d="M-16,-150 C-18,-170 -10,-186 0,-191 C10,-186 18,-170 16,-150 C13,-141 -13,-141 -16,-150 Z M-16,-152 L-27,-139 L27,-139 L16,-152 Z" fill="${F}"/><circle cx="-3.6" cy="-162" r=".9" fill="${ac(its.head)}" opacity=".85"/><circle cx="3.6" cy="-162" r=".9" fill="${ac(its.head)}" opacity=".85"/>`;
    if (h === 'hat') o += `<path d="M-27,-171 Q0,-180 27,-171 Q0,-165 -27,-171 Z" fill="${F}"/><path d="M-11,-172 C-12,-188 12,-188 11,-172 Z" fill="${F}"/><path d="M-11,-174 H11" stroke="${ac(its.head)}" stroke-width=".8" opacity=".6"/>`;
    if (h === 'helm') o += `<path d="M-13,-150 C-14,-171 -9,-181 0,-181 C9,-181 14,-171 13,-150 L13,-146 L-13,-146 Z" fill="${M}"/><path d="M-9,-162 H9" stroke="${ac(its.head)}" stroke-width="1.3" opacity=".9"/><path d="M0,-181 C5,-195 17,-198 25,-192 C16,-190 10,-185 7,-178 Z" fill="${shade(ac(its.head), -0.45)}"/>`;
    if (h === 'crown') o += `<path d="M-10,-172 L-9.5,-183 L-5,-177 L0,-188 L5,-177 L9.5,-183 L10,-172 Z" fill="#6e5a32" stroke="#c8b27a" stroke-width=".7"/>`;
    if (h === 'mask') o += `<path d="M-10,-160 C-9,-150 -4,-147 0,-147 C4,-147 9,-150 10,-160 Z" fill="${M}"/><circle cx="-3.8" cy="-164" r=".9" fill="${ac(its.head)}"/><circle cx="3.8" cy="-164" r=".9" fill="${ac(its.head)}"/>`;
    // charm
    if (its.charm) { const a = RC(its.charm.tier); o += `<g style="color:${a}"><circle cx="0" cy="-128" r="10" fill="url(#${id}l)"/></g><circle cx="0" cy="-128" r="1.6" fill="${shade(a, 0.4)}"/>`; }
    if (!behind) o += silWeapon(its.weapon, F, M);
    const vb = opts.viewBox || '-80 -205 160 215';
    return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" class="figure sil">${o}</svg>`;
  }

  // ---------- item icons ----------
  const IC = { metal: '#cdc6b6', dark: '#7d766a', wood: '#7a5a3c', cloth: '#5a4a3e' };
  const ICON_ART = {
    blade: (a) => `<g transform="rotate(45 24 24)"><path d="M22.4,6 L24,2 L25.6,6 L25.6,30 L22.4,30 Z" fill="${IC.metal}"/><path d="M24,4 V30" stroke="${IC.dark}" stroke-width=".6"/><rect x="17" y="30" width="14" height="2.6" rx="1" fill="${a}"/><rect x="22.8" y="32.6" width="2.4" height="8" fill="${IC.wood}"/><circle cx="24" cy="42" r="1.9" fill="${a}"/></g>`,
    axe: (a) => `<g transform="rotate(35 24 24)"><rect x="22.8" y="6" width="2.4" height="38" rx="1" fill="${IC.wood}"/><path d="M25,8 C35,6 39,14 37,22 C33,19 29,19 25,19 Z" fill="${IC.metal}"/><path d="M34,7 C38,12 39,17 37,22" stroke="#fff" stroke-width=".7" fill="none" opacity=".6"/><rect x="22.4" y="26" width="3.2" height="3" fill="${a}"/></g>`,
    blunt: (a) => `<g transform="rotate(35 24 24)"><rect x="22.8" y="14" width="2.4" height="30" rx="1" fill="${IC.wood}"/><rect x="16" y="5" width="16" height="11" rx="1.5" fill="${IC.metal}"/><rect x="16" y="9" width="16" height="2" fill="${a}"/></g>`,
    polearm: (a) => `<g transform="rotate(40 24 24)"><rect x="23" y="10" width="2" height="36" fill="${IC.wood}"/><path d="M21.6,12 L24,1 L26.4,12 Z" fill="${IC.metal}"/><path d="M25,12 C31,11 34,16 33,21 C30,18 27,18 25,18 Z" fill="${IC.metal}"/><rect x="22.6" y="12" width="2.8" height="2.2" fill="${a}"/></g>`,
    staff: (a) => `<circle cx="24" cy="11" r="9" fill="${a}" opacity=".3"/><path d="M24,46 C22.5,34 25.5,24 23.5,16" stroke="${IC.wood}" stroke-width="2.6" fill="none"/><rect x="20" y="6" width="8" height="10" rx="1.6" fill="#2a241c" stroke="#b49a62" stroke-width=".9"/><circle cx="24" cy="11" r="2.4" fill="${shade(a, 0.5)}"/>`,
    hood: (a) => `<path d="M10,40 C9,22 14,8 24,5 C34,8 39,22 38,40 Z" fill="${IC.cloth}"/><path d="M15,38 C15,26 18,18 24,16 C30,18 33,26 33,38 Z" fill="#0d0b0a"/><path d="M15,38 C15,26 18,18 24,16 C30,18 33,26 33,38" stroke="${a}" stroke-width=".9" fill="none"/>`,
    hat: (a) => `<ellipse cx="24" cy="30" rx="20" ry="5" fill="${IC.cloth}"/><path d="M13,30 C13,14 35,14 35,30 Z" fill="#4a3c32"/><rect x="13" y="25" width="22" height="3" fill="${a}"/>`,
    helm: (a) => `<path d="M12,40 C11,20 16,8 24,8 C32,8 37,20 36,40 Z" fill="${IC.metal}"/><rect x="15" y="22" width="18" height="3" rx="1" fill="#141210"/><path d="M24,8 V22 M24,25 V40" stroke="${IC.dark}" stroke-width=".8"/><path d="M24,8 C27,2 34,1 38,3 C33,4 29,7 28,11 Z" fill="${a}"/>`,
    crown: (a) => `<path d="M10,34 L38,34 L37,18 L31,25 L24,10 L17,25 L11,18 Z" fill="#b8994e" stroke="#e6d3a3" stroke-width=".6"/><circle cx="24" cy="29" r="2.4" fill="${a}"/><rect x="10" y="34" width="28" height="4" fill="#8a7038"/>`,
    mask: (a) => `<path d="M9,20 C10,34 17,41 24,41 C31,41 38,34 39,20 C33,24 28,25 24,25 C20,25 15,24 9,20 Z" fill="${IC.metal}"/><path d="M9,20 C15,24 20,25 24,25 C28,25 33,24 39,20" stroke="${a}" stroke-width="1" fill="none"/><path d="M16,33 H32 M18,37 H30" stroke="${IC.dark}" stroke-width=".8"/>`,
    coat: (a) => `<path d="M14,8 L9,44 L22,44 L23,18 L25,18 L26,44 L39,44 L34,8 C30,6 18,6 14,8 Z" fill="${IC.cloth}"/><path d="M19,7 L24,22 L29,7" stroke="${a}" stroke-width="1" fill="none"/><path d="M9,44 L22,44 M26,44 L39,44" stroke="${a}" stroke-width="1"/>`,
    armour: (a) => `<path d="M15,12 C13,24 16,34 18,40 L30,40 C32,34 35,24 33,12 C28,9 20,9 15,12 Z" fill="${IC.metal}"/><ellipse cx="13" cy="14" rx="7" ry="5" fill="${IC.metal}" stroke="${a}" stroke-width=".8"/><ellipse cx="35" cy="14" rx="7" ry="5" fill="${IC.metal}" stroke="${a}" stroke-width=".8"/><path d="M24,12 V40 M17,26 Q24,29 31,26" stroke="${IC.dark}" stroke-width=".8" fill="none"/>`,
    robe: (a) => `<path d="M17,8 L8,44 L40,44 L31,8 C27,6 21,6 17,8 Z" fill="#4a3a52"/><path d="M19,8 L24,22 L29,8" fill="#2a2030"/><path d="M8,43 H40" stroke="${a}" stroke-width="1.6"/><rect x="17" y="24" width="14" height="2.4" fill="${a}"/>`,
    light: (a) => `<path d="M14,8 L12,40 L36,40 L34,8 C29,6 19,6 14,8 Z" fill="#8a7254"/><path d="M13,16 H35 M13,24 H35 M12.5,32 H35.5" stroke="#6a563e" stroke-width="1"/><path d="M19,8 Q24,13 29,8" stroke="${a}" stroke-width="1.6" fill="none"/>`,
    shield: (a) => `<path d="M10,8 H38 V24 C38,34 31,41 24,44 C17,41 10,34 10,24 Z" fill="${IC.metal}" stroke="${a}" stroke-width="1.2"/><path d="M24,8 V44 M10,22 H38" stroke="${IC.dark}" stroke-width="1"/><circle cx="24" cy="22" r="3.4" fill="${a}"/>`,
    lamp: (a) => `<circle cx="24" cy="27" r="13" fill="${a}" opacity=".22"/><path d="M18,8 Q24,2 30,8" stroke="#b49a62" stroke-width="1.6" fill="none"/><rect x="17" y="10" width="14" height="4" fill="#4a443a"/><rect x="16" y="14" width="16" height="22" rx="2" fill="#2a2620" stroke="#b49a62" stroke-width=".8"/><path d="M24,30 C20,26 23,22 24,18 C25,22 28,26 24,30 Z" fill="${a}"/><rect x="15" y="36" width="18" height="4" fill="#4a443a"/>`,
    book: (a) => `<path d="M9,10 H36 C38,10 39,11 39,13 V40 H12 C10,40 9,39 9,37 Z" fill="#4a3a52"/><path d="M12,40 C10,40 9,38.5 9,37 C9,35.5 10,34 12,34 H39 V40 Z" fill="#d8ccb0"/><rect x="15" y="15" width="18" height="12" fill="none" stroke="${a}" stroke-width="1.2"/><circle cx="24" cy="21" r="2.4" fill="${a}"/>`,
    glove: (a) => `<path d="M15,44 V26 L12,16 C11,13 14,12 15,15 L17,21 V9 C17,6 21,6 21,9 V19 V7 C21,4 25,4 25,7 V19 V9 C25,6 29,6 29,9 V21 V13 C29,10 33,10 33,13 V30 C33,36 31,40 30,44 Z" fill="${IC.cloth}" stroke="${IC.dark}" stroke-width=".8"/><rect x="15" y="38" width="15" height="3" fill="${a}"/>`,
    boot: (a) => `<path d="M17,6 H29 V26 C33,28 40,30 41,35 V40 H14 C13,30 17,24 17,16 Z" fill="${IC.cloth}" stroke="${IC.dark}" stroke-width=".8"/><rect x="13" y="40" width="29" height="3.4" fill="#141210"/><rect x="17" y="8" width="12" height="3" fill="${a}"/>`,
    pendant: (a) => `<path d="M12,6 Q24,30 36,6" stroke="#b49a62" stroke-width="1" fill="none"/><circle cx="24" cy="31" r="10" fill="${a}" opacity=".25"/><circle cx="24" cy="31" r="5.5" fill="${a}"/><circle cx="22.4" cy="29.4" r="1.6" fill="#fff" opacity=".7"/>`,
    phial: (a) => `<circle cx="24" cy="31" r="12" fill="${a}" opacity=".22"/><path d="M21,10 H27 V17 C33,20 34,26 34,30 C34,37 29,42 24,42 C19,42 14,37 14,30 C14,26 15,20 21,17 Z" fill="#2a2620" stroke="#b49a62" stroke-width=".8"/><path d="M15.5,30 C15.5,36 19,40.5 24,40.5 C29,40.5 32.5,36 32.5,30 Z" fill="${a}"/><rect x="20.5" y="7" width="7" height="3.5" rx="1" fill="#7a5a3c"/>`,
  };
  function icon(it) {
    if (!it) return '';
    const a = RC(it.tier);
    const art = ICON_ART[it.art] || ICON_ART.pendant;
    return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" class="icon"><defs><radialGradient id="ig${it.id}" cx="50%" cy="55%" r="60%"><stop offset="0" stop-color="${a}" stop-opacity=".28"/><stop offset="1" stop-color="${a}" stop-opacity="0"/></radialGradient></defs><rect width="48" height="48" fill="url(#ig${it.id})"/>${art(a)}</svg>`;
  }
  const SLOT_GLYPH = {
    weapon: '<path d="M14,34 L32,16 M30,14 L34,18 M17,31 L13,35 M16,28 L20,32" stroke="#4a443a" stroke-width="2" fill="none" stroke-linecap="round"/>',
    head: '<path d="M14,34 C13,20 18,13 24,13 C30,13 35,20 34,34 Z" fill="none" stroke="#4a443a" stroke-width="2"/><path d="M17,24 H31" stroke="#4a443a" stroke-width="2"/>',
    body: '<path d="M16,14 C14,24 16,32 18,36 L30,36 C32,32 34,24 32,14 C28,12 20,12 16,14 Z" fill="none" stroke="#4a443a" stroke-width="2"/>',
    off: '<path d="M14,13 H34 V25 C34,31 29,35 24,37 C19,35 14,31 14,25 Z" fill="none" stroke="#4a443a" stroke-width="2"/>',
    hands: '<path d="M17,36 V25 L15,19 M17,25 V15 M21,24 V13 M25,24 V14 M29,25 V17 V29 C29,33 28,35 27,36 Z" fill="none" stroke="#4a443a" stroke-width="2" stroke-linecap="round"/>',
    feet: '<path d="M19,12 H27 V25 C30,26 34,28 34,31 V34 H17 C17,28 19,24 19,18 Z" fill="none" stroke="#4a443a" stroke-width="2"/>',
    charm: '<path d="M15,14 Q24,30 33,14" stroke="#4a443a" stroke-width="2" fill="none"/><circle cx="24" cy="30" r="5" fill="none" stroke="#4a443a" stroke-width="2"/>',
  };
  const slotIcon = (sl) => `<svg viewBox="0 0 48 48" class="icon">${SLOT_GLYPH[sl]}</svg>`;
  const SIGIL = '<svg viewBox="0 0 48 48" class="sigil"><circle cx="24" cy="24" r="17" fill="none" stroke="#c8b27a" stroke-width="1.6"/><circle cx="24" cy="24" r="12.5" fill="none" stroke="#8a7a52" stroke-width=".8"/><g transform="rotate(45 24 24)"><path d="M22.6,7 L24,3 L25.4,7 V30 H22.6 Z" fill="#e6d3a3"/><rect x="18" y="30" width="12" height="2" fill="#c8b27a"/><rect x="23" y="32" width="2" height="8" fill="#8a7a52"/><circle cx="24" cy="42" r="1.8" fill="#c8b27a"/></g></svg>';

  root.Art = { rig, figure, head, itemsOf, CHEST, shade, DEFS, silhouette, icon, slotIcon, SIGIL };
})(typeof window !== 'undefined' ? window : globalThis);
