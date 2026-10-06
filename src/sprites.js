/* ==== sprites.js ==== */
/* DEAD HAUL - procedural art: articulated characters, vehicles, props, wall faces (cached) */
(function () {
  'use strict';
  const DH = window.DH;
  const M = DH.M;
  const SP = (DH.SP = { S: 1, caches: {} });
  const HX = DH.TW / 2, HY = DH.TH / 2, HZ = DH.HZ;

  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  SP.mk = mk;

  // simple LRU cache
  const LRU = (max) => { const m = new Map(); return { get(k) { const v = m.get(k); if (v) { m.delete(k); m.set(k, v); } return v; }, set(k, v) { m.set(k, v); if (m.size > max) m.delete(m.keys().next().value); }, clear() { m.clear(); }, get size() { return m.size; } }; };
  SP.figCache = LRU(1400);
  SP.silCache = LRU(300);
  SP.staticCache = new Map();

  SP.setScale = (S) => {
    S = Math.round(S * 8) / 8;
    if (S === SP.S) return false;
    SP.S = S;
    SP.figCache.clear(); SP.silCache.clear(); SP.staticCache.clear();
    SP.noisePat = null;
    return true;
  };

  // ---------- color helpers ----------
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const shade = (h, f) => { const [r, g, b] = hex(h); const k = (v) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)))); return 'rgb(' + k(r) + ',' + k(g) + ',' + k(b) + ')'; };
  SP.shade = shade;
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  SP.hash = hash;

  // grit noise tile used as pattern
  SP.noise = () => {
    if (SP._noise) return SP._noise;
    const c = mk(128, 128), x = c.getContext('2d');
    const img = x.createImageData(128, 128);
    const r = DH.RNG(99);
    for (let i = 0; i < 128 * 128; i++) { const v = r.next(); const a = v < 0.5 ? 0 : (v - 0.5) * 2; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v < 0.75 ? 0 : 255; img.data[i * 4 + 3] = Math.floor(a * a * 110); }
    x.putImageData(img, 0, 0);
    SP._noise = c;
    return c;
  };

  // ---------- projection inside sprite space ----------
  // world offset (dx,dy,dz) meters -> sprite px (scale s)
  const P = (dx, dy, dz, s) => [(dx - dy) * HX * s, ((dx + dy) * HY - dz * HZ) * s];
  SP.P = P;

  // ---------- Articulated figures ----------
  const FIG = {
    player: { skin: '#c99a78', hair: '#3b2c22', shirt: '#56603f', jacket: '#4a5236', pants: '#3b3f47', shoes: '#262626', h: 1.0, lean: 0.02, pack: '#6b5236', cap: '#6a4a2e' },
    survivor: { skin: '#b98262', hair: '#6b2f1f', shirt: '#9b3a2f', jacket: '#8e3b30', pants: '#3f4d66', shoes: '#2a2626', h: 0.96, lean: 0, hairLong: true },
    drifter0: { skin: '#8f9a86', hair: '#2c2a26', shirt: '#6c6a74', pants: '#3e3b36', shoes: '#2a2724', h: 0.98, lean: 0.14, torn: true, zombie: true },
    drifter1: { skin: '#98927c', hair: '#4a3a2a', shirt: '#7a4f3c', pants: '#454c52', shoes: '#262422', h: 1.0, lean: 0.12, torn: true, zombie: true },
    drifter2: { skin: '#87947f', hair: '#1f1f1f', shirt: '#4d5a66', pants: '#3a3530', shoes: '#262422', h: 0.95, lean: 0.16, torn: true, zombie: true, apron: '#b8b09a' },
    runner: { skin: '#a4a88f', hair: '#1a1a1a', shirt: '#8a8a80', pants: '#2f3a44', shoes: '#39342e', h: 0.97, lean: 0.34, lean2: true, torn: true, zombie: true, thin: true },
    howler: { skin: '#9c8d85', hair: '#2a2420', shirt: '#6d3e3e', pants: '#3d3a3a', shoes: '#242020', h: 1.07, lean: 0.05, torn: true, zombie: true, big: true },
    clinger: { skin: '#8a9480', hair: '#141414', shirt: '#3c4038', pants: '#2c2e2a', shoes: '#1c1c1c', h: 0.86, lean: 0.45, torn: true, zombie: true, thin: true, longArms: true },
    marta: { skin: '#a8765a', hair: '#2a2420', shirt: '#4a5a6a', jacket: '#3b4a58', pants: '#3a3632', shoes: '#262626', h: 0.97, lean: 0, hairLong: true },
    tomas: { skin: '#c49270', hair: '#1e1a16', shirt: '#d8a21c', jacket: '#d8a21c', pants: '#2f3a48', shoes: '#262626', h: 1.02, lean: 0, big: true },
    ada: { skin: '#7a5236', hair: '#151210', shirt: '#7aa8b8', jacket: '#5e8a99', pants: '#3a3a44', shoes: '#262626', h: 0.95, lean: 0, hairLong: true },
    wes: { skin: '#d0a888', hair: '#8a6a3a', shirt: '#6b4a3a', jacket: '#4e5a3a', pants: '#3a3f47', shoes: '#262626', h: 1.0, lean: 0.03, thin: true, cap: '#2e4a6a' },
    june: { skin: '#b07e5c', hair: '#3a2a1a', shirt: '#2c4a6a', jacket: '#1f3a56', pants: '#2a2a2a', shoes: '#1e1e1e', h: 0.98, lean: 0, hairLong: true },
    ines: { skin: '#b98a68', hair: '#2a1a12', shirt: '#c45a2a', jacket: '#a8481e', pants: '#30343a', shoes: '#262626', h: 0.95, lean: 0, hairLong: true },
    ray: { skin: '#8a5a3e', hair: '#1a1a1a', shirt: '#4a6a4a', jacket: '#3a5a3a', pants: '#2f3a48', shoes: '#262626', h: 1.01, lean: 0 },
    bo: { skin: '#d6ae90', hair: '#a8a8a0', shirt: '#7a6a5a', jacket: '#6a5a4a', pants: '#3a3a3a', shoes: '#262626', h: 0.93, lean: 0.06, cap: '#7a2a22' },
  };
  SP.FIG = FIG;

  // pose builder -> joints in local frame (f forward, r right, z up)
  function joints(spec, pose, phase, extra) {
    const H = spec.h;
    const J = {};
    let lean = spec.lean || 0;
    let crouch = 0;
    if (pose === 'lunge') lean += 0.35;
    if (pose === 'windup') lean -= 0.1;
    if (pose === 'howl') lean = -0.18;
    if (pose === 'leap') { lean += 0.2; crouch = 0.22; }
    if (pose === 'stagger') lean = -0.25;
    if (pose === 'aim_pistol' || pose === 'aim_long' || pose === 'aim_smg') lean = 0.04;
    if (spec.longArms) crouch = Math.max(crouch, 0.12);
    const hipZ = 0.93 * H - crouch;
    const sw = Math.sin(phase), cw = Math.cos(phase);
    const moving = extra.moving;
    const stride = moving ? (pose === 'lunge' ? 0.42 : spec.zombie && !spec.thin ? 0.24 : 0.32) : 0.0;
    J.hip = [0, 0, hipZ];
    J.chest = [lean * 0.55, 0, hipZ + 0.45 * H];
    J.neck = [lean * 0.7 + 0.01, 0, hipZ + 0.56 * H];
    const headTilt = pose === 'howl' ? -0.08 : spec.zombie ? 0.08 : 0.02;
    J.head = [J.neck[0] + headTilt, 0, hipZ + 0.70 * H + (pose === 'howl' ? 0.04 : 0)];
    // legs
    for (const side of [-1, 1]) {
      const ph = side < 0 ? sw : -sw;
      const lift = moving ? Math.max(0, (side < 0 ? cw : -cw)) * 0.1 : 0;
      const hip = [0, side * 0.1, hipZ - 0.02];
      const foot = [ph * stride, side * (0.12 + (spec.big ? 0.03 : 0)), lift + 0.03];
      if (pose === 'leap') foot[0] = side * 0.12 - 0.1;
      const knee = [(hip[0] + foot[0]) / 2 + 0.07 + lift * 0.6 + crouch * 0.5, side * 0.11, (hip[2] + foot[2]) / 2 + 0.02];
      J['hip' + side] = hip; J['knee' + side] = knee; J['foot' + side] = foot;
    }
    // arms
    const shZ = hipZ + 0.47 * H;
    const shF = lean * 0.5;
    for (const side of [-1, 1]) {
      const sh = [shF, side * (spec.big ? 0.23 : spec.thin ? 0.17 : 0.19), shZ];
      let hand, elbow;
      const armSwing = moving ? (side < 0 ? -sw : sw) * 0.22 : 0;
      switch (pose) {
        case 'aim_pistol':
          hand = [0.55, 0.02 * side, shZ - 0.05]; elbow = [0.28, side * 0.14, shZ - 0.12]; break;
        case 'aim_long': case 'aim_smg':
          hand = side > 0 ? [0.22, 0.1, shZ - 0.2] : [0.52, -0.02, shZ - 0.1];
          elbow = side > 0 ? [0.02, 0.2, shZ - 0.28] : [0.3, -0.16, shZ - 0.2]; break;
        case 'swing': {
          const t = extra.swing; // 0..1
          if (side > 0) { const a = -1.2 + t * 2.6; hand = [0.3 + Math.cos(a) * 0.35, 0.1 + Math.sin(a) * 0.45, shZ + 0.15 - t * 0.3]; elbow = [(sh[0] + hand[0]) / 2, (sh[1] + hand[1]) / 2 + 0.05, (sh[2] + hand[2]) / 2 - 0.05]; }
          else { hand = [0.2, -0.22, shZ - 0.35]; elbow = [0.05, -0.24, shZ - 0.2]; }
          break;
        }
        case 'haul':
          hand = [-0.42, side * 0.16, hipZ + 0.02]; elbow = [-0.22, side * 0.22, shZ - 0.3]; break;
        case 'reach': case 'chase':
          hand = [0.5 + (side < 0 ? sw : -sw) * 0.06, side * 0.2, shZ - 0.08 + (side > 0 ? 0.04 : 0)]; elbow = [0.25, side * 0.23, shZ - 0.1]; break;
        case 'windup':
          hand = [0.2, side * 0.28, shZ + 0.38]; elbow = [0.05, side * 0.3, shZ + 0.14]; break;
        case 'lunge':
          hand = [0.62, side * 0.18, shZ - 0.02]; elbow = [0.32, side * 0.2, shZ - 0.02]; break;
        case 'howl':
          hand = [-0.2, side * 0.42, shZ - 0.12]; elbow = [-0.06, side * 0.36, shZ + 0.02]; break;
        case 'stagger':
          hand = [-0.1, side * 0.38, shZ - 0.2]; elbow = [-0.02, side * 0.3, shZ - 0.12]; break;
        case 'leap':
          hand = [0.5, side * 0.25, shZ + 0.1]; elbow = [0.28, side * 0.28, shZ + 0.02]; break;
        case 'cling':
          hand = [0.35, side * 0.3, shZ + 0.25]; elbow = [0.2, side * 0.3, shZ + 0.02]; break;
        case 'cower':
          hand = [0.2, side * 0.1, shZ + 0.05]; elbow = [0.18, side * 0.22, shZ - 0.15]; break;
        default:
          hand = [armSwing, side * 0.24, hipZ - 0.02 + (spec.longArms ? -0.12 : 0)]; elbow = [armSwing * 0.5 - 0.02, side * 0.23, (shZ + hipZ) / 2 + 0.02];
      }
      J['sh' + side] = sh; J['el' + side] = elbow; J['hand' + side] = hand;
    }
    return J;
  }

  const WEAPON_SHAPES = {
    pistol: { len: 0.24, w: 0.05, col: '#2b2b2e', grip: true },
    shotgun: { len: 0.95, w: 0.07, col: '#3a2c20', metal: '#2a2a2c' },
    smg: { len: 0.55, w: 0.08, col: '#232426', mag: true },
    rifle: { len: 1.05, w: 0.06, col: '#5a3d24', metal: '#2a2a2c' },
    crowbar: { len: 0.7, w: 0.04, col: '#8c2d23' },
  };

  // draw figure into ctx at origin (feet) with angle ang (world), scale s
  function drawFigure(ctx, spec, ang, pose, phase, extra, s) {
    const J = joints(spec, pose, phase, extra);
    const c = Math.cos(ang), sn = Math.sin(ang);
    const W = (p) => { const wx = p[0] * c - p[1] * sn, wy = p[0] * sn + p[1] * c; return { x: wx, y: wy, z: p[2], sx: (wx - wy) * HX * s, sy: ((wx + wy) * HY - p[2] * HZ) * s, d: wx + wy }; };
    const Q = {}; for (const k in J) Q[k] = W(J[k]);
    const px = (m) => Math.max(1, m * HZ * s);
    const outline = 'rgba(12,12,14,0.9)';
    const parts = [];
    const limb = (a, b, cc, th, col, d) => parts.push({ d: d != null ? d : (Q[a].d + Q[b].d + Q[cc].d) / 3, fn: () => {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(Q[a].sx, Q[a].sy); ctx.lineTo(Q[b].sx, Q[b].sy); ctx.lineTo(Q[cc].sx, Q[cc].sy);
      ctx.strokeStyle = outline; ctx.lineWidth = px(th) + 2 * s * 0.8; ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = px(th); ctx.stroke();
    } });
    const legCol = spec.pants, armCol = spec.jacket || spec.shirt;
    for (const sd of [-1, 1]) {
      limb('hip' + sd, 'knee' + sd, 'foot' + sd, spec.big ? 0.14 : spec.thin ? 0.095 : 0.12, legCol);
      // shoe
      const f = Q['foot' + sd];
      parts.push({ d: f.d + 0.01, fn: () => { const fw = W([J['foot' + sd][0] + 0.09, J['foot' + sd][1], 0.02]); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(f.sx, f.sy); ctx.lineTo(fw.sx, fw.sy); ctx.strokeStyle = outline; ctx.lineWidth = px(0.1) + 1.6 * s; ctx.stroke(); ctx.strokeStyle = spec.shoes; ctx.lineWidth = px(0.1); ctx.stroke(); } });
      const armTh = spec.big ? 0.11 : spec.thin ? 0.07 : 0.085;
      limb('sh' + sd, 'el' + sd, 'hand' + sd, armTh, armCol);
      const h = Q['hand' + sd];
      parts.push({ d: h.d + 0.005, fn: () => { ctx.beginPath(); ctx.arc(h.sx, h.sy, px(0.05), 0, 7); ctx.fillStyle = outline; ctx.fill(); ctx.beginPath(); ctx.arc(h.sx, h.sy, px(0.042), 0, 7); ctx.fillStyle = spec.skin; ctx.fill(); } });
    }
    // torso
    const torsoD = (Q.chest.d + Q.hip.d) / 2;
    parts.push({ d: torsoD, fn: () => {
      const hw = spec.big ? 0.24 : spec.thin ? 0.15 : 0.18;
      const a1 = W([J.chest[0], -hw, J.chest[2] + 0.06]), a2 = W([J.chest[0], hw, J.chest[2] + 0.06]);
      const b1 = W([J.hip[0], -hw * 0.82, J.hip[2] - 0.04]), b2 = W([J.hip[0], hw * 0.82, J.hip[2] - 0.04]);
      const f1 = W([J.chest[0] + 0.1 + (spec.big ? 0.06 : 0), 0, J.chest[2]]);
      ctx.beginPath(); ctx.moveTo(a1.sx, a1.sy); ctx.lineTo(a2.sx, a2.sy); ctx.lineTo(b2.sx, b2.sy); ctx.lineTo(b1.sx, b1.sy); ctx.closePath();
      ctx.lineJoin = 'round'; ctx.strokeStyle = outline; ctx.lineWidth = px(0.12) + 2 * s; ctx.stroke();
      ctx.fillStyle = spec.jacket || spec.shirt; ctx.fill(); ctx.strokeStyle = spec.jacket || spec.shirt; ctx.lineWidth = px(0.12); ctx.stroke();
      // chest front shading / shirt panel
      ctx.beginPath(); ctx.moveTo(a1.sx * 0.5 + a2.sx * 0.5, a1.sy * 0.5 + a2.sy * 0.5); ctx.lineTo(f1.sx, f1.sy); ctx.lineTo(b1.sx * 0.5 + b2.sx * 0.5, b1.sy * 0.5 + b2.sy * 0.5);
      ctx.strokeStyle = spec.jacket ? spec.shirt : shade(spec.shirt, -0.25); ctx.lineWidth = px(0.07); ctx.stroke();
      if (spec.torn) { ctx.strokeStyle = 'rgba(70,20,18,0.8)'; ctx.lineWidth = px(0.025); ctx.beginPath(); ctx.moveTo(b1.sx * 0.7 + a2.sx * 0.3, b1.sy * 0.7 + a2.sy * 0.3); ctx.lineTo(b1.sx * 0.4 + a2.sx * 0.6, b1.sy * 0.4 + a2.sy * 0.6 + px(0.05)); ctx.stroke(); }
      if (spec.apron) { ctx.fillStyle = spec.apron; const m1 = W([J.chest[0] + 0.12, -0.1, J.hip[2] + 0.25]), m2 = W([J.chest[0] + 0.12, 0.1, J.hip[2] + 0.25]), m3 = W([J.hip[0] + 0.13, 0.1, J.hip[2] - 0.2]), m4 = W([J.hip[0] + 0.13, -0.1, J.hip[2] - 0.2]); ctx.beginPath(); ctx.moveTo(m1.sx, m1.sy); ctx.lineTo(m2.sx, m2.sy); ctx.lineTo(m3.sx, m3.sy); ctx.lineTo(m4.sx, m4.sy); ctx.fill(); }
    } });
    // backpack
    if (spec.pack) {
      const bp = W([J.chest[0] - 0.2, 0, J.chest[2] - 0.12]);
      parts.push({ d: bp.d, fn: () => {
        const c1 = W([J.chest[0] - 0.16, -0.15, J.chest[2] + 0.05]), c2 = W([J.chest[0] - 0.16, 0.15, J.chest[2] + 0.05]), c3 = W([J.hip[0] - 0.2, 0.15, J.hip[2] + 0.12]), c4 = W([J.hip[0] - 0.2, -0.15, J.hip[2] + 0.12]);
        const c5 = W([J.chest[0] - 0.3, 0, J.chest[2] - 0.1]);
        ctx.beginPath(); ctx.moveTo(c1.sx, c1.sy); ctx.lineTo(c2.sx, c2.sy); ctx.lineTo(c3.sx, c3.sy); ctx.lineTo(c4.sx, c4.sy); ctx.closePath();
        ctx.strokeStyle = outline; ctx.lineWidth = px(0.1) + 2 * s; ctx.stroke(); ctx.fillStyle = spec.pack; ctx.fill(); ctx.strokeStyle = spec.pack; ctx.lineWidth = px(0.1); ctx.stroke();
        ctx.fillStyle = shade(spec.pack, -0.3); ctx.beginPath(); ctx.arc(c5.sx, c5.sy, px(0.07), 0, 7); ctx.fill();
      } });
    }
    // head
    parts.push({ d: Q.head.d + 0.02, fn: () => {
      const r = px(spec.big ? 0.125 : 0.112);
      const hx = Q.head.sx, hy = Q.head.sy;
      // neck
      ctx.strokeStyle = outline; ctx.lineWidth = px(0.08) + 2 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(Q.neck.sx, Q.neck.sy); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.strokeStyle = spec.skin; ctx.lineWidth = px(0.08); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(hx, hy, r * 0.92, r, 0, 0, 7); ctx.fillStyle = outline; ctx.fill();
      ctx.beginPath(); ctx.ellipse(hx, hy, r * 0.8, r * 0.88, 0, 0, 7); ctx.fillStyle = spec.skin; ctx.fill();
      // hair / cap on the back-top of the head
      const back = W([J.head[0] - 0.05, 0, J.head[2] + 0.04]);
      ctx.beginPath(); ctx.ellipse((hx + back.sx) / 2, (hy + back.sy) / 2 - r * 0.25, r * 0.8, r * 0.62, 0, 0, 7); ctx.fillStyle = spec.cap || spec.hair; ctx.fill();
      if (spec.cap) { const bill = W([J.head[0] + 0.14, 0, J.head[2] + 0.06]); ctx.beginPath(); ctx.ellipse(bill.sx, bill.sy, r * 0.45, r * 0.22, 0, 0, 7); ctx.fillStyle = shade(spec.cap, -0.2); ctx.fill(); }
      if (spec.hairLong) { const b2 = W([J.head[0] - 0.1, 0, J.head[2] - 0.12]); ctx.beginPath(); ctx.ellipse(b2.sx, b2.sy, r * 0.6, r * 0.7, 0, 0, 7); ctx.fillStyle = spec.hair; ctx.fill(); }
      // face hint (eyes) if facing camera
      const fx = W([J.head[0] + 0.1, -0.04, J.head[2] + 0.01]), fx2 = W([J.head[0] + 0.1, 0.04, J.head[2] + 0.01]);
      if (fx.d > Q.head.d) { ctx.fillStyle = spec.zombie ? '#e8e3c0' : '#1a1410'; ctx.beginPath(); ctx.arc(fx.sx, fx.sy, px(0.018), 0, 7); ctx.arc(fx2.sx, fx2.sy, px(0.018), 0, 7); ctx.fill(); }
      if (pose === 'howl') { const m = W([J.head[0] + 0.1, 0, J.head[2] - 0.05]); ctx.fillStyle = '#2a0c0c'; ctx.beginPath(); ctx.ellipse(m.sx, m.sy, px(0.04), px(0.05), 0, 0, 7); ctx.fill(); }
    } });
    // weapon
    if (extra.weapon) {
      const wsd = WEAPON_SHAPES[extra.weapon];
      let a, b;
      if (extra.weapon === 'crowbar') {
        const h = J.hand1;
        const dirA = pose === 'swing' ? (-1.2 + extra.swing * 2.6) : -0.6;
        a = [h[0], h[1], h[2]];
        b = pose === 'swing' ? [h[0] + Math.cos(dirA) * 0.55, h[1] + Math.sin(dirA) * 0.55, h[2] + 0.1] : [h[0] - 0.05, h[1] + 0.05, h[2] - 0.55];
      } else if (extra.weapon === 'pistol') { a = J.hand1; b = [J.hand1[0] + wsd.len, J.hand1[1], J.hand1[2] + 0.02]; }
      else { a = [J.hand1[0] - 0.12, J.hand1[1], J.hand1[2]]; b = [J.hand1[0] - 0.12 + wsd.len, J.hand1[1] - 0.1, J.hand1[2] + 0.07]; }
      const A = W(a), B = W(b);
      parts.push({ d: Math.max(A.d, B.d) + 0.03, fn: () => {
        ctx.lineCap = 'butt';
        ctx.strokeStyle = outline; ctx.lineWidth = px(wsd.w) + 2 * s; ctx.beginPath(); ctx.moveTo(A.sx, A.sy); ctx.lineTo(B.sx, B.sy); ctx.stroke();
        ctx.strokeStyle = wsd.col; ctx.lineWidth = px(wsd.w); ctx.stroke();
        if (wsd.metal) { const Mi = { sx: A.sx * 0.4 + B.sx * 0.6, sy: A.sy * 0.4 + B.sy * 0.6 }; ctx.strokeStyle = wsd.metal; ctx.lineWidth = px(wsd.w * 0.7); ctx.beginPath(); ctx.moveTo(Mi.sx, Mi.sy); ctx.lineTo(B.sx, B.sy); ctx.stroke(); }
        if (wsd.mag) { const m1 = W([a[0] + 0.22, a[1], a[2] - 0.02]), m2 = W([a[0] + 0.24, a[1], a[2] - 0.2]); ctx.strokeStyle = '#18191a'; ctx.lineWidth = px(0.05); ctx.beginPath(); ctx.moveTo(m1.sx, m1.sy); ctx.lineTo(m2.sx, m2.sy); ctx.stroke(); }
      } });
    }
    parts.sort((p, q) => p.d - q.d);
    for (const p of parts) p.fn();
  }
  SP.drawFigure = drawFigure;

  // Cached figure sprite. Returns {c, ox, oy} where (ox,oy) is the feet anchor inside the canvas.
  SP.figure = (kind, ang, pose, phase, moving, weapon, swing) => {
    if (!FIG[kind]) kind = 'survivor';
    const dirs = FIG[kind].zombie ? 8 : 16;
    const di = ((Math.round((M.normAng(ang) / (Math.PI * 2)) * dirs) % dirs) + dirs) % dirs;
    const frames = 8;
    const fi = moving ? ((Math.floor(((phase % (Math.PI * 2)) + Math.PI * 2) / (Math.PI * 2) * frames) % frames) + frames) % frames : 0;
    const si = swing != null ? Math.round(swing * 5) : 0;
    const key = kind + '|' + di + '|' + pose + '|' + fi + '|' + (moving ? 1 : 0) + '|' + (weapon || '') + '|' + si;
    let e = SP.figCache.get(key);
    if (e) return e;
    const s = SP.S;
    const w = 1.8 * HX * s * 1.2 + 8, h = 2.3 * HZ * s + 12;
    const c = mk(w, h), x = c.getContext('2d');
    const ox = w / 2, oy = h - 0.9 * HY * s - 4;
    x.translate(ox, oy);
    const qa = (di / dirs) * Math.PI * 2;
    drawFigure(x, FIG[kind], qa, pose, (fi / frames) * Math.PI * 2, { moving, weapon, swing: si / 5 }, s);
    e = { c, ox, oy, key };
    SP.figCache.set(key, e);
    return e;
  };
  // tinted silhouette of a cached sprite
  SP.silhouette = (e, color) => {
    const key = e.key + '#' + color;
    let c = SP.silCache.get(key);
    if (c) return c;
    c = mk(e.c.width, e.c.height);
    const x = c.getContext('2d');
    x.drawImage(e.c, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    SP.silCache.set(key, c);
    return c;
  };

  // outline ring (dilated silhouette minus the sprite) for "seen behind scenery" cues
  SP.outline = (e, color) => {
    const key = e.key + '@' + color;
    let c = SP.silCache.get(key);
    if (c) return c;
    const sil = SP.silhouette(e, color);
    c = mk(e.c.width, e.c.height);
    const x = c.getContext('2d');
    const r = Math.max(1.5, SP.S * 1.4);
    for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, -r * 0.7]]) x.drawImage(sil, dx, dy);
    x.globalCompositeOperation = 'destination-out';
    x.drawImage(e.c, 0, 0);
    x.globalCompositeOperation = 'source-over';
    x.globalAlpha = 0.22; x.drawImage(sil, 0, 0); x.globalAlpha = 1;
    SP.silCache.set(key, c);
    return c;
  };

  // lying body (dead zombie / downed survivor), cached
  SP.body = (kind, ang, downed) => {
    const di = ((Math.round((M.normAng(ang) / (Math.PI * 2)) * 8) % 8) + 8) % 8;
    const key = 'body|' + kind + '|' + di + '|' + (downed ? 1 : 0) + '|' + SP.S;
    let e = SP.staticCache.get(key);
    if (e) return e;
    const s = SP.S, spec = FIG[kind] || FIG.survivor;
    const w = 2.4 * HX * s + 10, h = 1.6 * HY * s + 30 * s;
    const c = mk(w, h), x = c.getContext('2d');
    const ox = w / 2, oy = h / 2 + 4 * s;
    x.translate(ox, oy);
    const a = (di / 8) * Math.PI * 2;
    const cs = Math.cos(a), sn = Math.sin(a);
    const Wp = (f, r, z) => { const wx = f * cs - r * sn, wy = f * sn + r * cs; return [(wx - wy) * HX * s, ((wx + wy) * HY - z * HZ) * s]; };
    const seg = (p1, p2, th, col) => { x.lineCap = 'round'; x.beginPath(); x.moveTo(p1[0], p1[1]); x.lineTo(p2[0], p2[1]); x.strokeStyle = 'rgba(10,10,12,0.85)'; x.lineWidth = th * HZ * s + 2 * s; x.stroke(); x.strokeStyle = col; x.lineWidth = th * HZ * s; x.stroke(); };
    // pool
    if (!downed) { x.fillStyle = 'rgba(40,10,10,0.45)'; x.beginPath(); x.ellipse(0, 0, 0.8 * HX * s, 0.5 * HY * s, 0, 0, 7); x.fill(); }
    seg(Wp(-0.1, -0.1, 0.08), Wp(-0.85, -0.18, 0.06), 0.12, spec.pants);
    seg(Wp(-0.1, 0.1, 0.08), Wp(-0.8, 0.25, 0.06), 0.12, spec.pants);
    seg(Wp(0.45, -0.18, 0.1), Wp(0.3, -0.5, 0.06), 0.085, spec.jacket || spec.shirt);
    seg(Wp(0.45, 0.18, 0.1), Wp(0.7, 0.4, 0.06), 0.085, spec.jacket || spec.shirt);
    seg(Wp(-0.05, 0, 0.12), Wp(0.45, 0, 0.12), 0.3, spec.jacket || spec.shirt);
    const hd = Wp(0.68, 0, 0.12);
    x.beginPath(); x.arc(hd[0], hd[1], 0.12 * HZ * s, 0, 7); x.fillStyle = 'rgba(10,10,12,0.9)'; x.fill();
    x.beginPath(); x.arc(hd[0], hd[1], 0.1 * HZ * s, 0, 7); x.fillStyle = spec.skin; x.fill();
    e = { c, ox, oy };
    SP.staticCache.set(key, e);
    return e;
  };

  // ---------- 3D box helper (world-aligned drawing into a ctx with projection fn) ----------
  // proj(wx,wy,wz) -> [sx,sy]
  SP.box = (ctx, proj, cx, cy, z0, hl, hw, h, ang, col, opts) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    const pts = [[hl, hw], [hl, -hw], [-hl, -hw], [-hl, hw]].map(([f, r]) => [cx + f * c - r * s, cy + f * s + r * c]);
    // faces: between pts i and i+1; outward normal
    const faces = [];
    for (let i = 0; i < 4; i++) {
      const a = pts[i], b = pts[(i + 1) % 4];
      const mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy;
      const vis = mx + my; // facing camera (+x+y)
      if (vis <= 0.0001) continue;
      faces.push({ a, b, vis, nx: mx, ny: my, d: (a[0] + b[0] + a[1] + b[1]) / 2 });
    }
    faces.sort((p, q) => p.d - q.d);
    const outline = opts && opts.outline;
    for (const f of faces) {
      const p1 = proj(f.a[0], f.a[1], z0), p2 = proj(f.b[0], f.b[1], z0), p3 = proj(f.b[0], f.b[1], z0 + h), p4 = proj(f.a[0], f.a[1], z0 + h);
      const l = Math.hypot(f.nx, f.ny) || 1;
      const lit = (f.nx / l) * 0.28 - (f.ny / l) * 0.05; // east faces brighter
      ctx.fillStyle = shade(col, -0.28 + lit);
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]); ctx.lineTo(p4[0], p4[1]); ctx.closePath(); ctx.fill();
      if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 1; ctx.stroke(); }
      if (opts && opts.faceFn) opts.faceFn(f, p1, p2, p3, p4);
    }
    if (!(opts && opts.noTop)) {
      ctx.fillStyle = opts && opts.top ? opts.top : shade(col, 0.08);
      ctx.beginPath();
      pts.forEach((p, i) => { const q = proj(p[0], p[1], z0 + h); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
      ctx.closePath(); ctx.fill();
      if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 1; ctx.stroke(); }
    }
    return pts;
  };

  // ---------- Vehicles ----------
  // draws a car centered at origin into ctx using proj
  SP.drawCar = (ctx, proj, car, s) => {
    const col = car.color || '#666';
    const cx = car.x, cy = car.y, a = car.ang;
    const c = Math.cos(a), sn = Math.sin(a);
    const L = (f, r) => [cx + f * c - r * sn, cy + f * sn + r * c];
    const van = car.type === 'van';
    const hl = car.hl, hw = car.hw;
    // wheels
    for (const [f, r] of [[hl * 0.62, hw * 0.95], [hl * 0.62, -hw * 0.95], [-hl * 0.62, hw * 0.95], [-hl * 0.62, -hw * 0.95]]) {
      const p = L(f, r); SP.box(ctx, proj, p[0], p[1], 0, 0.33, 0.12, 0.62, a, '#1b1b1c', { top: '#2a2a2a' });
    }
    SP.box(ctx, proj, cx, cy, 0.25, hl, hw, van ? 1.75 : 0.62, a, col, {
      faceFn: (f, p1, p2, p3, p4) => {
        // rust / dents
        if (car.wreck) { ctx.fillStyle = 'rgba(90,50,30,0.35)'; ctx.beginPath(); ctx.moveTo(p1[0] * 0.7 + p2[0] * 0.3, p1[1] * 0.7 + p2[1] * 0.3); ctx.lineTo(p1[0] * 0.5 + p2[0] * 0.5, p1[1] * 0.5 + p2[1] * 0.5); ctx.lineTo(p4[0] * 0.55 + p3[0] * 0.45, p4[1] * 0.55 + p3[1] * 0.45 + 3); ctx.fill(); }
        // lamps on short faces
        const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
        if (len < hw * 2.2) {
          const front = (f.nx * c + f.ny * sn) > 0;
          ctx.fillStyle = front ? '#d8d0a8' : '#7a1f1a';
          for (const t of [0.15, 0.85]) { const x = p1[0] + (p2[0] - p1[0]) * t, y = p1[1] + (p2[1] - p1[1]) * t - (p1[1] - p4[1]) * 0.55; ctx.fillRect(x - 2 * s, y - 1.5 * s, 4 * s, 3 * s); }
        }
      },
    });
    if (!van) {
      const p = L(-hl * 0.12, 0);
      SP.box(ctx, proj, p[0], p[1], 0.87, hl * 0.52, hw * 0.86, 0.52, a, shade(col, -0.05), {
        top: shade(col, 0.02),
        faceFn: (f, p1, p2, p3, p4) => { ctx.fillStyle = car.wreck ? 'rgba(30,38,44,0.95)' : 'rgba(40,52,62,0.95)'; const k = 0.14; ctx.beginPath(); ctx.moveTo(p1[0] + (p2[0] - p1[0]) * k, p1[1] + (p2[1] - p1[1]) * k - (p1[1] - p4[1]) * 0.18); ctx.lineTo(p2[0] - (p2[0] - p1[0]) * k, p2[1] - (p2[1] - p1[1]) * k - (p2[1] - p3[1]) * 0.18); ctx.lineTo(p3[0] - (p3[0] - p4[0]) * k, p3[1] - (p3[1] - p4[1]) * k + (p2[1] - p3[1]) * 0.12); ctx.lineTo(p4[0] + (p3[0] - p4[0]) * k, p4[1] + (p3[1] - p4[1]) * k + (p1[1] - p4[1]) * 0.12); ctx.fill(); if (car.wreck) { ctx.strokeStyle = 'rgba(200,210,220,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo((p1[0] + p3[0]) / 2 - 4, (p1[1] + p3[1]) / 2 - 3); ctx.lineTo((p1[0] + p3[0]) / 2 + 3, (p1[1] + p3[1]) / 2 + 2); ctx.stroke(); } },
      });
    } else {
      // van windscreen band
      const p = L(hl * 0.78, 0);
      SP.box(ctx, proj, p[0], p[1], 1.1, 0.24, hw * 0.9, 0.6, a, '#2b3640', { top: shade(col, 0) });
    }
    if (car.alarm) { const p = proj(cx, cy, 1.45); ctx.fillStyle = '#ffcf6a'; ctx.fillRect(p[0] - 2 * s, p[1] - 2 * s, 4 * s, 3 * s); }
  };

  // Truck (live draw). t = truck state; opts: {cargo:[kinds], passenger, clingers}
  SP.drawTruck = (ctx, proj, t, s, opts) => {
    const cx = t.x, cy = t.y, a = t.ang, c = Math.cos(a), sn = Math.sin(a);
    const L = (f, r) => [cx + f * c - r * sn, cy + f * sn + r * c];
    const body = t.disabled ? '#5a4a3e' : '#b8752c';
    const dark = '#23201d';
    const parts = [];
    let layer = 0;
    const add = (f, r, z0, hl, hw, h, col, o) => { const p = L(f, r); parts.push({ d: layer * 1000 + p[0] + p[1], fn: () => SP.box(ctx, proj, p[0], p[1], z0, hl, hw, h, a, col, o) }); };
    for (const [f, r] of [[1.85, 1.02], [1.85, -1.02], [-1.7, 1.02], [-1.7, -1.02]]) add(f, r, 0, 0.42, 0.17, 0.84, '#161616', { top: '#262626' });
    // chassis
    layer = 1;
    add(0, 0, 0.42, 2.75, 1.08, 0.5, '#2f2c28');
    // bumper
    add(2.86, 0, 0.35, opts.bumper ? 0.2 : 0.1, opts.bumper ? 1.18 : 1.1, opts.bumper ? 0.55 : 0.38, opts.bumper ? '#5b5f63' : '#3a3a3a', { top: opts.bumper ? '#7b8084' : '#4a4a4a' });
    layer = 2;
    // hood
    add(2.25, 0, 0.92, 0.55, 1.02, 0.42, body, { faceFn: (f, p1, p2, p3, p4) => {
      const front = (f.nx * c + f.ny * sn) > 0.5;
      if (front) { ctx.fillStyle = t.engine ? '#fff3c4' : '#9c9477'; for (const tt of [0.14, 0.86]) { const x = p1[0] + (p2[0] - p1[0]) * tt, y = p1[1] + (p2[1] - p1[1]) * tt - (p1[1] - p4[1]) * 0.55; ctx.beginPath(); ctx.arc(x, y, 2.4 * s, 0, 7); ctx.fill(); } ctx.fillStyle = '#1d1d1d'; const gx = (p1[0] + p2[0]) / 2, gy = (p1[1] + p2[1]) / 2 - (p1[1] - p4[1]) * 0.5; ctx.fillRect(gx - 5 * s, gy - 2 * s, 10 * s, 4 * s); }
    } });
    // cab
    add(1.15, 0, 0.92, 0.62, 1.05, 1.18, body, { top: shade(body, 0.1), faceFn: (f, p1, p2, p3, p4) => {
      ctx.fillStyle = 'rgba(28,36,44,0.95)';
      const k = 0.12; ctx.beginPath(); ctx.moveTo(p4[0] + (p3[0] - p4[0]) * k, p4[1] + (p3[1] - p4[1]) * k + (p1[1] - p4[1]) * 0.12); ctx.lineTo(p3[0] - (p3[0] - p4[0]) * k, p3[1] - (p3[1] - p4[1]) * k + (p2[1] - p3[1]) * 0.12); ctx.lineTo(p2[0] - (p2[0] - p1[0]) * k, p2[1] - (p2[1] - p1[1]) * k - (p2[1] - p3[1]) * 0.45); ctx.lineTo(p1[0] + (p2[0] - p1[0]) * k, p1[1] + (p2[1] - p1[1]) * k - (p1[1] - p4[1]) * 0.45); ctx.fill();
      ctx.fillStyle = 'rgba(160,190,210,0.12)'; ctx.fill();
    } });
    // beacon bar
    add(1.15, 0, 2.1, 0.12, 0.7, 0.12, '#333', { top: t.engine ? (Math.floor(performance.now() / 350) % 2 ? '#ffb347' : '#8a5a20') : '#6a4a20' });
    // bed floor
    add(-1.35, 0, 0.92, 1.4, 1.06, 0.08, '#3c3833', { top: '#4a4540' });
    parts[parts.length - 1].d -= 500;
    // bed walls
    add(-1.35, 1.0, 1.0, 1.4, 0.07, 0.5, shade(body, -0.1));
    add(-1.35, -1.0, 1.0, 1.4, 0.07, 0.5, shade(body, -0.1));
    add(-2.72, 0, 1.0, 0.06, 1.06, 0.5, shade(body, -0.15), { faceFn: (f, p1, p2, p3, p4) => { const back = (f.nx * c + f.ny * sn) < -0.5; if (back) { ctx.fillStyle = '#8a1e18'; for (const tt of [0.1, 0.9]) { const x = p1[0] + (p2[0] - p1[0]) * tt, y = p1[1] + (p2[1] - p1[1]) * tt - (p1[1] - p4[1]) * 0.5; ctx.fillRect(x - 2 * s, y - 2 * s, 4 * s, 4 * s); } } } });
    add(-0.08, 0, 1.0, 0.08, 1.06, 0.62, shade(body, -0.2));
    // cargo in bed
    const slots = [[-0.6, 0.55], [-0.6, -0.55], [-1.35, 0.55], [-1.35, -0.55], [-2.1, 0.55], [-2.1, -0.55]];
    let si = 0;
    if (opts.generator) {
      const hk = opts.heavy || 'generator';
      const HC = { generator: ['#d9a520', '#e8b93a'], assembly: ['#cfd3d4', '#9ca1a4'], filtration: ['#2f6d8c', '#4a96bb'], powerpack: ['#d4621e', '#2e2e2e'] }[hk] || ['#d9a520', '#e8b93a'];
      add(-1.9, 0, 1.0, 0.6, 0.55, 0.62, HC[0], { top: HC[1] }); si = 2;
    }
    for (const k of opts.cargo || []) {
      if (si >= slots.length) break;
      const sl = slots[si++];
      if (k === 'case') add(sl[0], sl[1], 1.0, 0.28, 0.22, 0.3, '#c9372c', { top: '#e9e6df' });
      else if (k === 'medstock') add(sl[0], sl[1], 1.0, 0.28, 0.22, 0.32, '#e8ecee', { top: '#3a7fc0' });
      else if (k === 'supplies') add(sl[0], sl[1], 1.0, 0.3, 0.26, 0.34, '#6a5a3a', { top: '#86734c' });
      else add(sl[0], sl[1], 1.0, 0.3, 0.3, 0.28, '#5a6448', { top: '#6b7556' });
    }
    if (opts.winch) add(2.95, 0, 0.55, 0.12, 0.35, 0.3, '#3a3a3a', { top: '#d8b23a' });
    parts.sort((p, q) => p.d - q.d);
    for (const p of parts) p.fn();
    if (opts.passenger) { const hp = L(1.15, 0.45); const q = proj(hp[0], hp[1], 1.75); ctx.fillStyle = (FIG[opts.pfig] || FIG.survivor).hair; ctx.beginPath(); ctx.arc(q[0], q[1], 3.2 * s, 0, 7); ctx.fill(); }
  };

  // ---------- Wall faces (cached per material/face/window/interior/variant) ----------
  const MATCOL = { 1: '#7d4a3a', 2: '#a79a86', 3: '#8a8578', 4: '#6f6a5f', 5: '#77736a', 6: '#6b5236', 7: '#8a9096', 8: '#8f9088', 9: '#b9ac8d', 10: '#5d8583',
    11: '#7d8489', 12: '#d5dadb', 13: '#8d8d88', 14: '#57534c', 15: '#9aa0a5', 16: '#9a3a2c', 17: '#2f5a7a', 18: '#3e6a46', 19: '#7d7b74', 20: '#55625f', 21: '#c08a2a' };
  SP.MATCOL = MATCOL;
  SP.wallFace = (mat, face, win, interior, variant, h) => {
    const s = SP.S;
    const key = 'wf|' + mat + '|' + face + '|' + win + '|' + interior + '|' + variant + '|' + h + '|' + s;
    let e = SP.staticCache.get(key);
    if (e) return e;
    const w = HX * s, hh = HY * s + h * HZ * s;
    const c = mk(w + 2, hh + 2), x = c.getContext('2d');
    // face local coords: u in [0,1] along face, v in [0,h] up
    const dir = face === 'S' ? 1 : -1; // S face goes right-down, E face goes left-down
    const ox = face === 'S' ? 0 : w;
    const toS = (u, v) => [ox + dir * u * HX * s, u * HY * s + (h - v) * HZ * s];
    x.save();
    // transform so that fillRect(u, v) maps correctly
    x.setTransform(dir * HX * s, HY * s, 0, -HZ * s, ox, h * HZ * s);
    let base = MATCOL[mat] || '#777';
    const see = DH.MAT_INFO[mat] && DH.MAT_INFO[mat].see;
    if (interior) base = see ? base : mat === 12 ? '#c4ccce' : mat === 11 ? '#6a6f72' : '#4b5654';
    const lit = face === 'E' ? 0.08 : -0.12;
    x.fillStyle = shade(base, lit + (variant % 3 - 1) * 0.012);
    if (!see) x.fillRect(0, 0, 1.001, h);
    if (mat === 15) {
      // railing: posts, top rail and mid rail
      x.fillStyle = '#7d848a'; x.fillRect(0, 0, 0.06, h); x.fillRect(0, h - 0.07, 1, 0.07); x.fillRect(0, h * 0.5, 1, 0.04);
    } else if (mat === 7) {
      // chain-link: posts + mesh
      x.strokeStyle = 'rgba(160,168,176,0.55)'; x.lineWidth = 0.015;
      for (let i = -8; i < 10; i++) { x.beginPath(); x.moveTo(i * 0.12, 0); x.lineTo(i * 0.12 + h * 0.5, h); x.stroke(); x.beginPath(); x.moveTo(i * 0.12 + h * 0.5, 0); x.lineTo(i * 0.12, h); x.stroke(); }
      x.fillStyle = '#6b7075'; x.fillRect(0, 0, 0.05, h); x.fillRect(0, h - 0.05, 1, 0.05);
    } else if (!interior && (mat === 11 || mat === 16 || mat === 17 || mat === 18 || mat === 21)) {
      // corrugated metal: warehouse cladding and shipping containers
      x.fillStyle = 'rgba(0,0,0,0.16)'; for (let u = 0; u < 1; u += 0.125) x.fillRect(u, 0, 0.05, h);
      x.fillStyle = 'rgba(255,255,255,0.05)'; for (let u = 0.06; u < 1; u += 0.125) x.fillRect(u, 0, 0.025, h);
      if (mat !== 11) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, 1, 0.1); x.fillRect(0, h - 0.12, 1, 0.12); x.fillStyle = 'rgba(120,60,30,' + (0.12 + variant * 0.06) + ')'; x.fillRect(0.2 * variant, 0.1, 0.3, 0.5); }
      else { x.fillStyle = 'rgba(0,0,0,0.2)'; x.fillRect(0, 0, 1, 0.5); x.fillStyle = 'rgba(210,160,40,0.5)'; if (variant === 1) x.fillRect(0, 0.05, 1, 0.08); }
    } else if (mat === 12) {
      // insulated cold-store panel
      x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, 0, 0.025, h); for (let v = 0.9; v < h; v += 0.9) x.fillRect(0, v, 1, 0.02);
      x.fillStyle = 'rgba(160,190,205,0.25)'; x.fillRect(0, 0, 1, 0.35);
      if (!interior) { x.fillStyle = 'rgba(80,60,40,0.12)'; x.fillRect(0.3 + variant * 0.15, 0.4, 0.05, h - 1.2); }
    } else if (!interior && mat === 13) {
      x.fillStyle = 'rgba(0,0,0,0.1)'; for (let v = 0.6; v < h; v += 0.6) x.fillRect(0, v, 1, 0.02); x.fillRect(0, 0, 0.02, h);
      x.fillStyle = 'rgba(0,0,0,0.15)'; for (const u of [0.25, 0.75]) { x.beginPath(); x.arc(u, 0.3 + variant * 0.6, 0.025, 0, 7); x.fill(); }
      x.fillStyle = 'rgba(60,50,40,0.18)'; x.fillRect(0, 0, 1, 0.3);
    } else if (mat === 14) {
      // rock face
      x.fillStyle = 'rgba(0,0,0,0.22)'; for (let k = 0; k < 6; k++) { const yy = (hash(variant, k) * h), xx = hash(k, variant + 3); x.fillRect(xx * 0.8, yy, 0.25 + hash(k, k) * 0.3, 0.04); }
      x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(0, h - 0.25, 1, 0.12);
      x.fillStyle = 'rgba(60,80,50,0.35)'; x.fillRect(0, h - 0.08, 1, 0.08);
    } else if (mat === 19) {
      x.fillStyle = 'rgba(0,0,0,0.15)'; x.fillRect(0, 0, 1, 0.35); x.fillRect(0, 0, 0.02, h);
      x.fillStyle = 'rgba(40,70,80,0.3)'; x.fillRect(0, 0, 1, 0.5);
    } else if (!interior && mat === 20) {
      x.fillStyle = 'rgba(0,0,0,0.2)'; for (let v = 0; v < h; v += 0.22) x.fillRect(0, v, 1, 0.03);
      x.fillStyle = 'rgba(20,30,30,0.35)'; x.fillRect(0, 0, 1, 0.8);
      x.fillStyle = 'rgba(80,70,50,0.45)'; x.fillRect(0, 0.78, 1, 0.05);
    } else if (!interior && (mat === 1)) {
      // brick courses
      x.fillStyle = 'rgba(0,0,0,0.16)';
      for (let v = 0, row = 0; v < h; v += 0.2, row++) { x.fillRect(0, v, 1, 0.022); for (let u = (row % 2) * 0.2; u < 1; u += 0.4) x.fillRect(u, v, 0.018, 0.2); }
      x.fillStyle = 'rgba(255,220,200,0.05)'; x.fillRect(0, h - 0.35, 1, 0.12);
    } else if (!interior && (mat === 3 || mat === 5)) {
      x.fillStyle = 'rgba(0,0,0,0.12)';
      for (let v = 0, row = 0; v < h; v += 0.4, row++) { x.fillRect(0, v, 1, 0.025); for (let u = (row % 2) * 0.5; u < 1; u += 1) x.fillRect(u, v, 0.02, 0.4); }
      if (mat === 5) { x.fillStyle = 'rgba(210,160,40,0.55)'; for (let u = 0; u < 1; u += 0.5) { x.beginPath(); x.moveTo(u, 0.5); x.lineTo(u + 0.25, 0.5); x.lineTo(u + 0.45, 0.8); x.lineTo(u + 0.2, 0.8); x.fill(); } }
    } else if (!interior && (mat === 4 || mat === 6)) {
      x.fillStyle = 'rgba(0,0,0,0.18)';
      if (mat === 4) for (let v = 0; v < h; v += 0.22) x.fillRect(0, v, 1, 0.03);
      else for (let u = 0; u < 1; u += 0.16) x.fillRect(u, 0, 0.025, h);
      if (mat === 6) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, h * 0.25, 1, 0.05); x.fillRect(0, h * 0.75, 1, 0.05); }
    } else if (!interior) {
      // stucco: stains
      x.fillStyle = 'rgba(0,0,0,0.1)'; x.fillRect(0, 0, 1, 0.4);
      x.fillStyle = 'rgba(60,50,40,0.15)'; x.fillRect(0.3 + variant * 0.1, 0.4, 0.06, h - 0.9);
      if (mat === 9) { x.fillStyle = '#8c3a32'; x.fillRect(0, 0.95, 1, 0.12); }
      if (mat === 10) { x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(0, 1.0, 1, 0.1); }
    } else {
      // interior: baseboard, wainscot, picture rail
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 0, 1, 0.14);
      x.fillStyle = '#6d6a5e'; x.fillRect(0, 0.14, 1, 0.85);
      x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, 0.97, 1, 0.05);
      x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(0, h - 0.5, 1, 0.06);
    }
    if (win && !interior && !see) {
      const top = Math.min(h - 0.35, 2.35);
      x.fillStyle = '#2a2b2c'; x.fillRect(0.06, 0.55, 0.88, top - 0.55);
      const lit2 = variant === 1;
      const g = x.createLinearGradient(0, 0.6, 0, top);
      g.addColorStop(0, lit2 ? 'rgba(255,196,110,0.55)' : 'rgba(40,58,70,0.95)'); g.addColorStop(1, lit2 ? 'rgba(160,110,60,0.7)' : 'rgba(20,28,36,0.95)');
      x.fillStyle = g; x.fillRect(0.1, 0.6, 0.8, top - 0.65);
      if (variant === 2) { x.fillStyle = '#5b4a36'; x.fillRect(0.1, 0.9, 0.8, 0.14); x.fillRect(0.1, 1.5, 0.8, 0.14); x.save(); x.translate(0.5, 1.2); x.rotate(0.3); x.fillRect(-0.45, -0.07, 0.9, 0.14); x.restore(); }
      else { x.fillStyle = 'rgba(200,220,235,0.12)'; x.beginPath(); x.moveTo(0.15, top - 0.1); x.lineTo(0.35, top - 0.1); x.lineTo(0.15, 0.9); x.fill(); }
      x.fillStyle = 'rgba(20,20,20,0.6)'; x.fillRect(0.06, 0.5, 0.88, 0.06);
    }
    // grit
    x.restore();
    x.globalAlpha = 0.5;
    x.globalCompositeOperation = 'source-atop';
    x.drawImage(SP.noise(), variant * 17, variant * 11, 40, 40 * hh / w, 0, 0, w, hh);
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    // bottom AO
    const g2 = x.createLinearGradient(0, hh, 0, hh - 12 * s);
    g2.addColorStop(0, 'rgba(0,0,0,0.35)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = g2; x.fillRect(0, 0, w + 2, hh + 2); x.globalCompositeOperation = 'source-over';
    e = { c, w, hh, face };
    SP.staticCache.set(key, e);
    return e;
  };
  SP.wallTop = (mat, h) => {
    const s = SP.S;
    const key = 'wt|' + mat + '|' + s;
    let e = SP.staticCache.get(key);
    if (e) return e;
    const c = mk(2 * HX * s + 2, 2 * HY * s + 2), x = c.getContext('2d');
    x.translate(HX * s + 1, 1);
    x.beginPath(); x.moveTo(0, 0); x.lineTo(HX * s, HY * s); x.lineTo(0, 2 * HY * s); x.lineTo(-HX * s, HY * s); x.closePath();
    x.fillStyle = DH.MAT_INFO[mat] && DH.MAT_INFO[mat].see ? 'rgba(0,0,0,0)' : shade(MATCOL[mat] || '#777', mat === 1 ? -0.35 : -0.15);
    x.fill();
    e = { c };
    SP.staticCache.set(key, e);
    return e;
  };

  // Tree (cached)
  SP.tree = (seed) => {
    const s = SP.S;
    const key = 'tree|' + (seed % 5 | 0) + '|' + s;
    let e = SP.staticCache.get(key);
    if (e) return e;
    const w = 5 * HX * s, h = 7 * HZ * s;
    const c = mk(w, h), x = c.getContext('2d');
    const ox = w / 2, oy = h - 2.2 * HY * s;
    x.translate(ox, oy);
    const r = DH.RNG(seed * 13 + 7);
    x.strokeStyle = '#2a211a'; x.lineWidth = 0.22 * HZ * s; x.lineCap = 'round';
    x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -2.6 * HZ * s); x.stroke();
    x.lineWidth = 0.1 * HZ * s;
    for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(0, -1.8 * HZ * s); x.lineTo((r.next() - 0.5) * 2 * HX * s, (-2.6 - r.next() * 1.4) * HZ * s); x.stroke(); }
    const cols = ['#3b4a34', '#44543a', '#34422f', '#4d5a3e'];
    for (let i = 0; i < 22; i++) {
      const a = r.next() * Math.PI * 2, rr = r.next() * 1.5;
      const bx = Math.cos(a) * rr * HX * s * 0.9, by = (-3.5 + Math.sin(a) * rr * 0.55 - r.next() * 1.2) * HZ * s;
      x.fillStyle = cols[i % 4]; x.globalAlpha = 0.9;
      x.beginPath(); x.ellipse(bx, by, (0.6 + r.next() * 0.5) * HX * s, (0.5 + r.next() * 0.4) * HZ * s * 0.6, 0, 0, 7); x.fill();
    }
    x.globalAlpha = 1;
    e = { c, ox, oy };
    SP.staticCache.set(key, e);
    return e;
  };
})();

