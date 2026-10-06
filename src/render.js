/* ==== render.js ==== */
/* DEAD HAUL - isometric renderer: camera, ground chunks, depth-sorted scene, fades, lighting */
(function () {
  'use strict';
  const DH = window.DH;
  const M = DH.M, G = DH.G, SP = DH.SP, F = DH.FLOOR;
  const HX = DH.TW / 2, HY = DH.TH / 2, HZ = DH.HZ;

  const R = (DH.R = {
    canvas: null, ctx: null, dpr: 1, Wb: 0, Hb: 0, cssW: 0, cssH: 0,
    cam: { x: 27, y: 100, zoom: 1, base: 1 },
    chunks: new Map(), alpha: new Map(), quality: 1, frameMs: 16, fpsHist: [],
    S: 1, f: 1, camSX: 0, camSY: 0, shx: 0, shy: 0,
    light: null, lctx: null,
  });
  const CH = 12;
  DH.bus.on('worldChanged', () => { R.chunks.clear(); R.alpha.clear(); if (SP.staticCache) SP.staticCache.clear(); R._roofPat = null; });

  R.init = (canvas) => {
    R.canvas = canvas;
    R.ctx = canvas.getContext('2d', { alpha: false });
    R.light = document.createElement('canvas');
    R.lctx = R.light.getContext('2d');
    R.resize();
  };
  R.resize = () => {
    const c = R.canvas;
    R.cssW = Math.max(1, c.clientWidth || window.innerWidth);
    R.cssH = Math.max(1, c.clientHeight || window.innerHeight);
    const maxDpr = R.quality < 0.8 ? 1 : 2;
    R.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    R.Wb = Math.round(R.cssW * R.dpr); R.Hb = Math.round(R.cssH * R.dpr);
    c.width = R.Wb; c.height = R.Hb;
    R.cam.base = M.clamp(Math.min(R.cssW / 1366, R.cssH / 768) * 1.3, R.cssH < 450 ? 0.72 : 0.8, 1.6);
    if (!R.cam.zoom || R.cam.zoom < 0.3) R.cam.zoom = R.cam.base;
    const S = R.cam.base * R.dpr;
    if (SP.setScale(S)) R.chunks.clear();
    R.S = SP.S;
    R.light.width = Math.ceil(R.Wb / 2); R.light.height = Math.ceil(R.Hb / 2);
  };

  // ---------- coordinate transforms ----------
  const PS = (x, y, z) => [(x - y) * HX * R.S, ((x + y) * HY - (z || 0) * HZ) * R.S]; // S-space
  R.PS = PS;
  R.toScreen = (x, y, z) => { const p = PS(x, y, z); return { x: (R.f * (p[0] - R.camSX) + R.Wb / 2 + R.shx) / R.dpr, y: (R.f * (p[1] - R.camSY) + R.Hb / 2 + R.shy) / R.dpr }; };
  R.screenToWorld = (cx, cy, z) => {
    const bx = cx * R.dpr, by = cy * R.dpr;
    const sx = (bx - R.Wb / 2 - R.shx) / R.f + R.camSX, sy = (by - R.Hb / 2 - R.shy) / R.f + R.camSY;
    return DH.iso.toWorld(sx / R.S, sy / R.S, z || 0);
  };
  G.onScreen = (x, y, margin) => { if (!R.Wb) return false; const s = R.toScreen(x, y, 0); const m = (margin || 0) * 30; return s.x > -m && s.y > -m - 60 && s.x < R.cssW + m && s.y < R.cssH + m; };
  // Pick a visible zombie whose sprite covers the pointer (torso-first targeting)
  R.pickZombie = (cx, cy) => {
    const run = G.run; if (!run) return null;
    let best = null, bd = 1e9;
    const z0 = R.f * R.S / R.dpr;
    for (const z of run.zombies) {
      if (z.dead || !z.visible) continue;
      const feet = R.toScreen(z.x, z.y, 0);
      const hw = 0.42 * HX * z0 * 1.2, top = 1.85 * HZ * z0;
      if (cx > feet.x - hw && cx < feet.x + hw && cy < feet.y + 4 && cy > feet.y - top) {
        const d = Math.abs(cy - (feet.y - top * 0.55)) + Math.abs(cx - feet.x);
        if (d < bd) { bd = d; best = z; }
      }
    }
    return best;
  };

  // ---------- Camera ----------
  R.updateCamera = (dt, snap) => {
    const run = G.run; if (!run) return;
    const p = run.player, t = run.truck;
    let tx = p.inTruck ? t.x + Math.cos(t.ang) * t.speed * 0.35 : p.x;
    let ty = p.inTruck ? t.y + Math.sin(t.ang) * t.speed * 0.35 : p.y;
    if (!p.inTruck) { tx += Math.cos(p.aim) * 0.9; ty += Math.sin(p.aim) * 0.9; }
    const zt = R.cam.base * (p.inTruck ? 0.8 : 1);
    if (snap) { R.cam.x = tx; R.cam.y = ty; R.cam.zoom = zt; }
    else { R.cam.x = M.smooth(R.cam.x, tx, 5.5, dt); R.cam.y = M.smooth(R.cam.y, ty, 5.5, dt); R.cam.zoom = M.smooth(R.cam.zoom, zt, 2.6, dt); }
    R.cam.zoom = M.clamp(R.cam.zoom, R.cam.base * 0.78, R.cam.base * 1.02);
  };

  // ---------- Ground chunks ----------
  const FCOL = {};
  FCOL[F.GRASS] = '#363d30'; FCOL[F.ROAD] = '#35373a'; FCOL[F.WALK] = '#6f6e68'; FCOL[F.LOT] = '#3f4144';
  FCOL[F.TILE] = '#b7bbb4'; FCOL[F.CHECKER] = '#cfcabb'; FCOL[F.WOOD] = '#5f4632'; FCOL[F.GRAVEL] = '#5f594e';
  FCOL[F.FORECOURT] = '#7a7a74'; FCOL[F.CONCRETE_IN] = '#6d6c66'; FCOL[F.LINO] = '#7f8c84';
  FCOL[F.WATER] = '#27363d'; FCOL[F.FROST] = '#aebdc4'; FCOL[F.DIRT] = '#4a4235'; FCOL[F.METAL] = '#565b5e'; FCOL[F.DOCK] = '#5a4a38';
  FCOL[F.SEA] = '#0d1820'; FCOL[F.VOID] = '#06080b'; FCOL[F.TRENCH] = '#262826'; FCOL[F.MUD] = '#3b372d'; FCOL[F.QUAY] = '#5b5d5f';
  const PAVED = {}; for (const f of [F.ROAD, F.LOT, F.GRAVEL, F.FORECOURT, F.QUAY, F.METAL, F.DIRT, F.DOCK, F.WATER, F.MUD]) PAVED[f] = 1;
  const buildChunk = (cx, cy) => {
    const W = G.W, S = R.S;
    const x0 = cx * CH, y0 = cy * CH;
    const bx = (x0 - y0 - CH) * HX * S - 2, by = (x0 + y0) * HY * S - 2;
    const c = SP.mk(2 * CH * HX * S + 4, 2 * CH * HY * S + 4), g = c.getContext('2d');
    g.setTransform(HX * S, HY * S, -HX * S, HY * S, -bx, -by);
    const N = W.N;
    const x1 = Math.min(N, x0 + CH), y1 = Math.min(N, y0 + CH);
    // base tiles
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = W.idx(x, y); let f = W.floor[i];
      if (W.doorAt[i]) f = W.floor[i];
      const h = SP.hash(x, y);
      let col = FCOL[f] || '#444';
      g.fillStyle = SP.shade(col, (h - 0.5) * (f === F.GRASS || f === F.DIRT || f === F.MUD ? 0.16 : f === F.VOID ? 0.02 : 0.06));
      g.fillRect(x - 0.01, y - 0.01, 1.02, 1.02);
      if (f >= F.WATER) { R.floorDetail(g, f, x, y, h, W); continue; }
      if (f === F.CHECKER) { g.fillStyle = '#2b2b2e'; g.fillRect(x, y, 0.5, 0.5); g.fillRect(x + 0.5, y + 0.5, 0.5, 0.5); }
      else if (f === F.TILE) { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 0.03; g.strokeRect(x, y, 1, 1); }
      else if (f === F.WOOD) { g.fillStyle = 'rgba(0,0,0,0.18)'; for (let k = 0; k < 4; k++) g.fillRect(x, y + k * 0.25, 1, 0.025); }
      else if (f === F.WALK || f === F.FORECOURT) { g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 0.035; if ((x + y) % 2 === 0) g.strokeRect(x, y, 1, 1); }
      else if (f === F.GRAVEL) { g.fillStyle = 'rgba(30,26,22,0.35)'; for (let k = 0; k < 5; k++) g.fillRect(x + SP.hash(x * 3 + k, y) * 0.9, y + SP.hash(x, y * 3 + k) * 0.9, 0.08, 0.08); }
      else if (f === F.GRASS) { if (h > 0.7) { g.fillStyle = 'rgba(80,70,50,0.35)'; g.beginPath(); g.ellipse(x + 0.5, y + 0.5, 0.45, 0.35, h * 6, 0, 7); g.fill(); } g.fillStyle = 'rgba(90,110,70,0.25)'; for (let k = 0; k < 4; k++) g.fillRect(x + SP.hash(k, x + y * 7) * 0.9, y + SP.hash(y, x + k) * 0.9, 0.04, 0.12); }
      else if (f === F.ROAD || f === F.LOT) { if (h > 0.9) { g.strokeStyle = 'rgba(15,15,15,0.5)'; g.lineWidth = 0.04; g.beginPath(); g.moveTo(x + 0.1, y + h * 0.8); g.lineTo(x + 0.6, y + 0.3); g.lineTo(x + 0.9, y + 0.6); g.stroke(); } }
    }
    // curbs: road tile next to non-road
    g.lineWidth = 0.09;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = W.idx(x, y); if (W.floor[i] !== F.ROAD) continue;
      const nb = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const [dx, dy] of nb) {
        const nx = x + dx, ny = y + dy; if (!W.inB(nx, ny)) continue;
        const nf = W.floor[W.idx(nx, ny)];
        if (PAVED[nf]) continue;
        g.strokeStyle = '#9a978d';
        g.beginPath();
        if (dx === 0) { const yy = dy < 0 ? y + 0.03 : y + 0.97; g.moveTo(x, yy); g.lineTo(x + 1, yy); } else { const xx = dx < 0 ? x + 0.03 : x + 0.97; g.moveTo(xx, y); g.lineTo(xx, y + 1); }
        g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.06; g.beginPath();
        if (dx === 0) { const yy = dy < 0 ? y + 0.12 : y + 0.88; g.moveTo(x, yy); g.lineTo(x + 1, yy); } else { const xx = dx < 0 ? x + 0.12 : x + 0.88; g.moveTo(xx, y); g.lineTo(xx, y + 1); }
        g.stroke(); g.lineWidth = 0.09;
      }
    }
    // road markings
    g.save();
    g.beginPath(); g.rect(x0, y0, CH, CH); g.clip();
    const inter = (x, y) => W.roads.filter((r) => x >= r[0] && x <= r[2] + 1 && y >= r[1] && y <= r[3] + 1).length > 1;
    for (const r of W.roads) {
      const horiz = r[2] - r[0] > r[3] - r[1];
      g.fillStyle = 'rgba(200,170,70,0.55)';
      if (horiz) { const cy2 = (r[1] + r[3] + 1) / 2; for (let x = r[0]; x < r[2]; x += 3) { if (inter(x + 0.75, cy2)) continue; g.fillRect(x, cy2 - 0.06, 1.5, 0.12); } }
      else { const cx2 = (r[0] + r[2] + 1) / 2; for (let y = r[1]; y < r[3]; y += 3) { if (inter(cx2, y + 0.75)) continue; g.fillRect(cx2 - 0.06, y, 0.12, 1.5); } }
    }
    R.paintMarks(g, W);
    // exit zones
    for (const z of W.exits) {
      const foot = z.kind === 'foot';
      const ferry = z.kind === 'ferry';
      g.fillStyle = foot ? 'rgba(80,200,120,0.18)' : ferry ? 'rgba(90,190,240,0.16)' : 'rgba(240,180,60,0.16)';
      g.fillRect(z.x1, z.y1, z.x2 - z.x1, z.y2 - z.y1);
      g.strokeStyle = foot ? 'rgba(110,230,150,0.7)' : ferry ? 'rgba(120,210,255,0.75)' : 'rgba(250,190,70,0.75)'; g.lineWidth = 0.15;
      g.setLineDash([0.6, 0.4]); g.strokeRect(z.x1 + 0.1, z.y1 + 0.1, z.x2 - z.x1 - 0.2, z.y2 - z.y1 - 0.2); g.setLineDash([]);
      // chevrons pointing outwards
      g.fillStyle = foot ? 'rgba(120,235,160,0.55)' : ferry ? 'rgba(130,215,255,0.55)' : 'rgba(250,200,80,0.55)';
      const cxm = (z.x1 + z.x2) / 2, cym = (z.y1 + z.y2) / 2;
      const out = z.out || (z.id === 'sw' ? [-1, 0] : z.id === 'ne' ? [0, -1] : [0, 1]);
      for (let k = -1; k <= 1; k++) {
        const bx2 = cxm + out[0] * k * 1.4, by2 = cym + out[1] * k * 1.4;
        g.beginPath();
        if (out[0]) { g.moveTo(bx2 + out[0] * 0.6, by2); g.lineTo(bx2 - out[0] * 0.3, by2 - 1.2); g.lineTo(bx2 - out[0] * 0.3, by2 - 0.6); g.lineTo(bx2 + out[0] * 0.2, by2); g.lineTo(bx2 - out[0] * 0.3, by2 + 0.6); g.lineTo(bx2 - out[0] * 0.3, by2 + 1.2); }
        else { g.moveTo(bx2, by2 + out[1] * 0.6); g.lineTo(bx2 - (foot ? 0.6 : 1.2), by2 - out[1] * 0.3); g.lineTo(bx2 - (foot ? 0.3 : 0.6), by2 - out[1] * 0.3); g.lineTo(bx2, by2 + out[1] * 0.2); g.lineTo(bx2 + (foot ? 0.3 : 0.6), by2 - out[1] * 0.3); g.lineTo(bx2 + (foot ? 0.6 : 1.2), by2 - out[1] * 0.3); }
        g.closePath(); g.fill();
      }
    }
    // decals
    for (const d of W.decals) {
      if (d.x < x0 - 2 || d.x > x1 + 2 || d.y < y0 - 2 || d.y > y1 + 2) continue;
      const f = W.floor[W.idx(Math.floor(d.x), Math.floor(d.y))];
      if (W.bld[W.idx(Math.floor(d.x), Math.floor(d.y))] || W.ground[W.idx(Math.floor(d.x), Math.floor(d.y))] || f === F.WATER) continue;
      g.save(); g.translate(d.x, d.y); g.rotate(d.a);
      if (d.k === 0 && (f === F.ROAD || f === F.LOT)) { g.fillStyle = 'rgba(10,10,12,0.35)'; g.beginPath(); g.ellipse(0, 0, 0.9, 0.5, 0, 0, 7); g.fill(); }
      else if (d.k === 1) { g.fillStyle = 'rgba(200,190,170,0.35)'; g.fillRect(-0.15, -0.1, 0.3, 0.2); g.fillRect(0.3, 0.2, 0.2, 0.12); }
      else if (d.k === 2) { g.strokeStyle = 'rgba(15,15,15,0.45)'; g.lineWidth = 0.05; g.beginPath(); g.moveTo(-0.8, 0); g.lineTo(-0.2, 0.15); g.lineTo(0.3, -0.1); g.lineTo(0.9, 0.2); g.stroke(); }
      else if (d.k === 3 && f === F.ROAD) { g.fillStyle = '#26282a'; g.beginPath(); g.arc(0, 0, 0.35, 0, 7); g.fill(); g.strokeStyle = 'rgba(120,120,120,0.4)'; g.lineWidth = 0.04; g.stroke(); }
      else if (d.k === 4) { g.fillStyle = 'rgba(60,30,25,0.3)'; g.beginPath(); g.ellipse(0, 0, 0.5, 0.3, 0, 0, 7); g.fill(); }
      g.restore();
    }
    // wall-base ambient occlusion on floors
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (W.wall[W.idx(x, y)]) continue;
      const sw = (tx, ty) => { if (!W.inB(tx, ty)) return false; const m = W.wall[W.idx(tx, ty)]; return m && !DH.MAT_INFO[m].see; };
      if (sw(x, y - 1)) g.fillRect(x, y, 1, 0.3);
      if (sw(x - 1, y)) g.fillRect(x, y, 0.3, 1);
      if (sw(x, y + 1)) g.fillRect(x, y + 0.75, 1, 0.25);
      if (sw(x + 1, y)) g.fillRect(x + 0.75, y, 0.25, 1);
    }
    g.restore();
    // grit overlay
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.35;
    const nz = SP.noise();
    for (let yy = 0; yy < c.height; yy += 128) for (let xx = 0; xx < c.width; xx += 128) g.drawImage(nz, xx, yy);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    return { c, bx, by };
  };
  // per-floor static detail (drawn in tile space: 1 unit = 1 m)
  R.floorDetail = (g, f, x, y, h, W) => {
    const hs = SP.hash;
    switch (f) {
      case F.WATER: {
        g.fillStyle = 'rgba(120,150,160,0.10)';
        for (let k = 0; k < 2; k++) { const yy = y + hs(x * 5 + k, y) * 0.9; g.fillRect(x + hs(x, y * 3 + k) * 0.4, yy, 0.5, 0.035); }
        if (h > 0.8) { g.fillStyle = 'rgba(70,60,40,0.35)'; g.fillRect(x + h * 0.5, y + 0.3, 0.25, 0.08); }
        break;
      }
      case F.FROST: {
        g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 0.03; g.strokeRect(x, y, 1, 1);
        g.fillStyle = 'rgba(240,250,255,0.35)';
        for (let k = 0; k < 4; k++) g.fillRect(x + hs(x * 3 + k, y) * 0.9, y + hs(x, y * 3 + k) * 0.9, 0.06, 0.06);
        break;
      }
      case F.DIRT: case F.MUD: {
        g.fillStyle = f === F.MUD ? 'rgba(20,24,22,0.35)' : 'rgba(30,26,20,0.3)';
        for (let k = 0; k < 4; k++) g.fillRect(x + hs(x * 3 + k, y) * 0.9, y + hs(x, y * 3 + k) * 0.9, 0.1, 0.07);
        if (f === F.MUD && h > 0.75) { g.fillStyle = 'rgba(60,72,76,0.45)'; g.beginPath(); g.ellipse(x + 0.5, y + 0.5, 0.42, 0.3, h * 4, 0, 7); g.fill(); }
        break;
      }
      case F.METAL: {
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.03; g.strokeRect(x, y, 1, 1);
        g.fillStyle = 'rgba(200,200,200,0.12)';
        for (let a = 0.17; a < 1; a += 0.33) for (let b = 0.17; b < 1; b += 0.33) g.fillRect(x + a - 0.05, y + b - 0.015, 0.1, 0.03);
        break;
      }
      case F.DOCK: {
        g.fillStyle = 'rgba(0,0,0,0.3)';
        for (let k = 0; k < 4; k++) g.fillRect(x + k * 0.25, y, 0.03, 1);
        if (h > 0.85) { g.fillStyle = 'rgba(30,20,10,0.4)'; g.fillRect(x + 0.4, y + h * 0.6, 0.2, 0.06); }
        break;
      }
      case F.SEA: {
        g.strokeStyle = 'rgba(90,130,150,0.12)'; g.lineWidth = 0.04;
        if (h > 0.5) { g.beginPath(); g.moveTo(x + 0.1, y + h); g.quadraticCurveTo(x + 0.5, y + h - 0.2, x + 0.9, y + h); g.stroke(); }
        break;
      }
      case F.VOID: {
        // distant town far below the ridge: sparse warm windows
        if (h > 0.965) { g.fillStyle = h > 0.993 ? 'rgba(255,200,120,0.9)' : 'rgba(255,180,90,0.55)'; g.fillRect(x + hs(y, x) * 0.8, y + hs(x + 9, y) * 0.8, 0.12, 0.12); }
        else if (h < 0.02) { g.fillStyle = 'rgba(200,220,255,0.35)'; g.fillRect(x + 0.5, y + 0.5, 0.08, 0.08); }
        break;
      }
      case F.TRENCH: {
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y, 1, 1);
        g.strokeStyle = 'rgba(30,30,30,0.9)'; g.lineWidth = 0.09;
        g.beginPath(); g.moveTo(x + 0.35, y); g.lineTo(x + 0.35, y + 1); g.moveTo(x + 0.62, y); g.lineTo(x + 0.62, y + 1); g.moveTo(x, y + 0.35); g.lineTo(x + 1, y + 0.35); g.stroke();
        break;
      }
      case F.QUAY: {
        g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 0.035;
        if (x % 3 === 0) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 1); g.stroke(); }
        if (y % 3 === 0) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y); g.stroke(); }
        if (h > 0.93) { g.fillStyle = 'rgba(120,70,40,0.25)'; g.beginPath(); g.ellipse(x + 0.5, y + 0.5, 0.5, 0.3, h * 5, 0, 7); g.fill(); }
        break;
      }
    }
  };
  // painted ground markings (level data)
  R.paintMarks = (g, W) => {
    for (const m of W.marks) {
      switch (m.k) {
        case 'crosswalk':
          g.fillStyle = 'rgba(200,198,190,0.35)';
          for (let k = 0; k < m.n; k++) { if (m.dir === 'x') g.fillRect(m.x + k * 1.05, m.y, 0.55, 1.2); else g.fillRect(m.x, m.y + k * 1.05, 1.2, 0.55); }
          break;
        case 'stallsH':
          g.strokeStyle = m.col || 'rgba(220,220,210,0.4)'; g.lineWidth = 0.08;
          for (let y = m.y1; y <= m.y2; y += m.step) { g.beginPath(); g.moveTo(m.x1, y); g.lineTo(m.x2, y); g.stroke(); }
          break;
        case 'stallsV':
          g.strokeStyle = m.col || 'rgba(220,220,210,0.4)'; g.lineWidth = 0.08;
          for (let x = m.x1; x <= m.x2; x += m.step) { g.beginPath(); g.moveTo(x, m.y1); g.lineTo(x, m.y2); g.stroke(); }
          break;
        case 'line':
          g.strokeStyle = m.col || 'rgba(230,200,80,0.6)'; g.lineWidth = m.w || 0.12; if (m.dash) g.setLineDash(m.dash);
          g.beginPath(); g.moveTo(m.x1, m.y1); g.lineTo(m.x2, m.y2); g.stroke(); g.setLineDash([]);
          break;
        case 'rect':
          g.strokeStyle = m.col || 'rgba(230,200,80,0.6)'; g.lineWidth = m.w || 0.12; if (m.dash) g.setLineDash(m.dash);
          g.strokeRect(m.x1, m.y1, m.x2 - m.x1, m.y2 - m.y1); g.setLineDash([]);
          if (m.fill) { g.fillStyle = m.fill; g.fillRect(m.x1, m.y1, m.x2 - m.x1, m.y2 - m.y1); }
          break;
        case 'hatch': {
          g.save(); g.beginPath(); g.rect(m.x1, m.y1, m.x2 - m.x1, m.y2 - m.y1); g.clip();
          g.strokeStyle = m.col || 'rgba(230,190,40,0.55)'; g.lineWidth = 0.25;
          for (let k = m.x1 - (m.y2 - m.y1); k < m.x2; k += 1.0) { g.beginPath(); g.moveTo(k, m.y2); g.lineTo(k + (m.y2 - m.y1), m.y1); g.stroke(); }
          g.restore();
          break;
        }
        case 'text': {
          g.save(); g.translate(m.x, m.y); g.rotate(m.rot || 0); g.scale(1 / 30, 1 / 30);
          g.fillStyle = m.col || 'rgba(230,220,200,0.45)'; g.font = 'bold ' + (m.size || 40) + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(m.text, 0, 0); g.restore();
          break;
        }
        case 'stain':
          g.fillStyle = m.col || 'rgba(20,16,12,0.3)'; g.beginPath(); g.ellipse(m.x, m.y, m.rx, m.ry, m.a || 0, 0, 7); g.fill();
          break;
      }
    }
  };
  const getChunk = (cx, cy) => {
    const k = cx * 100 + cy;
    let e = R.chunks.get(k);
    if (e) { R.chunks.delete(k); R.chunks.set(k, e); return e; }
    e = buildChunk(cx, cy);
    R.chunks.set(k, e);
    if (R.chunks.size > 40) R.chunks.delete(R.chunks.keys().next().value);
    return e;
  };

  // ---------- Static sprite builders ----------
  const propSprite = (p) => {
    const key = 'prop|' + G.W.key + '|' + p.id + '|' + R.S;
    let e = SP.staticCache.get(key);
    if (e) return e;
    const S = R.S;
    const ext = (p.sprR || (p.shape === 'box' ? Math.hypot(p.hl, p.hw) : p.r || 0.5)) + 0.6;
    const hgt = p.h || 1;
    const w = ext * 2 * HX * S * 1.05 + 8, h = ext * 2 * HY * S + hgt * HZ * S + 30 * S;
    const c = SP.mk(w, h), x = c.getContext('2d');
    const ox = w / 2, oy = h - ext * HY * S - 4;
    const proj = (wx, wy, wz) => { const q = SP.P(wx - p.x, wy - p.y, wz, S); return [q[0] + ox, q[1] + oy]; };
    drawProp(x, proj, p, S);
    e = { c, ox, oy };
    SP.staticCache.set(key, e);
    return e;
  };
  const drawProp = (x, proj, p, S) => {
    const t = p.type;
    if (t === 'car' || t === 'van') { SP.drawCar(x, proj, p, S); return; }
    const col = p.color;
    const B = (cx, cy, z0, hl, hw, h, c2, o) => SP.box(x, proj, cx, cy, z0, hl, hw, h, p.ang || 0, c2, o);
    switch (t) {
      case 'dumpster': B(p.x, p.y, 0, p.hl, p.hw, p.h, col || '#2f4a3a', { top: '#22352a' }); break;
      case 'pump': B(p.x, p.y, 0.25, p.hl, p.hw, p.h - 0.25, '#b9b4a8', { faceFn: (f, a, b, c3, d) => { x.fillStyle = '#20262a'; x.fillRect((a[0] + c3[0]) / 2 - 3 * S, (a[1] + c3[1]) / 2 - 6 * S, 6 * S, 5 * S); } }); break;
      case 'pumpIsland': B(p.x, p.y, 0, p.hl, p.hw, 0.25, '#9a978e'); break;
      case 'post': B(p.x, p.y, 0, 0.16, 0.16, p.h, '#cfcac0'); break;
      case 'bollard': B(p.x, p.y, 0, 0.13, 0.13, 0.9, '#c9a23a', { top: '#e0b84a' }); break;
      case 'jersey': B(p.x, p.y, 0, p.hl, p.hw, p.h, '#9c988e'); break;
      case 'aisle': case 'rack': {
        B(p.x, p.y, 0, p.hl, p.hw, p.h, col || '#8a8a88', { faceFn: (f, a, b, c3, d) => {
          const cols = ['#a33', '#2a6db0', '#d8b23a', '#3a8a5a', '#e6e2d8'];
          for (let k = 1; k < 4; k++) { const tt = k / 4; for (let m = 0; m < 8; m++) { const u = (m + 0.5) / 8; const px1 = a[0] + (b[0] - a[0]) * u + (d[0] - a[0]) * tt, py1 = a[1] + (b[1] - a[1]) * u + (d[1] - a[1]) * tt; x.fillStyle = cols[(m * 3 + k + (p.id.length)) % 5]; x.fillRect(px1 - 2 * S, py1 - 3 * S, 3.2 * S, 3 * S); } }
        } });
        break;
      }
      case 'counter': B(p.x, p.y, 0, p.hl, p.hw, p.h, col || '#7a6a54', { top: '#b9b2a3' }); break;
      case 'washer': B(p.x, p.y, 0, p.hl, p.hw, p.h, col || '#d9dcdc', { faceFn: (f, a, b, c3, d) => { const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]); const n = Math.max(1, Math.round(len / 0.9)); for (let m = 0; m < n; m++) { const u = (m + 0.5) / n; x.fillStyle = '#3a4448'; x.beginPath(); x.ellipse(a[0] + (b[0] - a[0]) * u + (d[0] - a[0]) * 0.5, a[1] + (b[1] - a[1]) * u + (d[1] - a[1]) * 0.5, 4 * S, 4 * S, 0, 0, 7); x.fill(); } } }); break;
      case 'table': { B(p.x, p.y, 0, 0.08, 0.08, 0.72, '#555'); const q = proj(p.x, p.y, 0.75); x.fillStyle = '#b8b0a0'; x.beginPath(); x.ellipse(q[0], q[1], p.r * HX * S * 1.4, p.r * HY * S * 1.4, 0, 0, 7); x.fill(); x.strokeStyle = '#6a2a26'; x.lineWidth = 2 * S; x.stroke(); break; }
      case 'stove': B(p.x, p.y, 0, p.hl, p.hw, p.h, '#6c6f72', { top: '#2a2a2a' }); break;
      case 'fridge': B(p.x, p.y, 0, p.hl, p.hw, p.h, '#c4c8c8'); break;
      case 'bed': B(p.x, p.y, 0, p.hl, p.hw, 0.5, '#5b5f6a', { top: '#8a8c9a' }); break;
      case 'sofa': B(p.x, p.y, 0, p.hl, p.hw, 0.45, col || '#5a4b3f'); B(p.x - Math.sin(p.ang || 0) * 0.3, p.y + Math.cos(p.ang || 0) * -0.3, 0.45, p.hl, 0.15, 0.4, SP.shade(col || '#5a4b3f', -0.1)); break;
      case 'lumber': for (let k = 0; k < 3; k++) B(p.x, p.y, k * p.h / 3, p.hl, p.hw - k * 0.08, p.h / 3 - 0.02, ['#a07a4a', '#8d6a40', '#b08a58'][k]); break;
      case 'pallets': for (let k = 0; k < 4; k++) B(p.x, p.y, k * 0.2, p.hl, p.hw, 0.16, k % 2 ? '#8b6b45' : '#7a5c3a'); B(p.x, p.y, 0.8, p.hl * 0.8, p.hw * 0.8, 0.3, '#5a6448'); break;
      case 'boxes': B(p.x, p.y, 0, p.hl, p.hw, p.h * 0.55, '#9a7a52'); B(p.x + 0.1, p.y - 0.1, p.h * 0.55, p.hl * 0.75, p.hw * 0.75, p.h * 0.45, '#a88760'); break;
      case 'cabinet': B(p.x, p.y, 0, p.hl, p.hw, p.h, '#4f5a52', { faceFn: (f, a, b, c3, d) => { x.fillStyle = 'rgba(140,170,160,0.35)'; x.beginPath(); x.moveTo(a[0] * 0.85 + c3[0] * 0.15, a[1] * 0.85 + c3[1] * 0.15); x.lineTo(b[0] * 0.85 + d[0] * 0.15, b[1] * 0.85 + d[1] * 0.15); x.lineTo(c3[0] * 0.85 + a[0] * 0.15, c3[1] * 0.85 + a[1] * 0.15); x.lineTo(d[0] * 0.85 + b[0] * 0.15, d[1] * 0.85 + b[1] * 0.15); x.fill(); } }); break;
      case 'gshed': B(p.x, p.y, 0, p.hl, p.hw, p.h, '#6b5b4a', { top: '#3c3430' }); break;
      case 'toolbox': B(p.x, p.y, 0, p.hl, p.hw, p.h, '#a83228'); break;
      case 'lift': B(p.x, p.y, 0, p.hl, p.hw, 0.3, '#c9a23a'); break;
      case 'bench': B(p.x, p.y, 0, p.hl, p.hw, p.h, col || '#5a4a3a', { top: '#7a6a54' }); break;
      case 'lamp': {
        B(p.x, p.y, 0, 0.09, 0.09, 5.0, '#2c2e30');
        const a1 = proj(p.x, p.y, 5.0), a2 = proj(p.x + 0.7, p.y + 0.7, 5.05);
        x.strokeStyle = '#2c2e30'; x.lineWidth = 3 * S; x.beginPath(); x.moveTo(a1[0], a1[1]); x.lineTo(a2[0], a2[1]); x.stroke();
        x.fillStyle = '#3a3a36'; x.beginPath(); x.ellipse(a2[0], a2[1] + 2 * S, 6 * S, 3 * S, 0, 0, 7); x.fill();
        break;
      }
      case 'priceSign': {
        B(p.x, p.y, 0, 0.12, 0.12, 4.0, '#3a3c40');
        const q = proj(p.x, p.y, 4.6);
        x.fillStyle = '#23262a'; x.fillRect(q[0] - 26 * S, q[1] - 22 * S, 52 * S, 40 * S);
        x.fillStyle = '#f2c14e'; x.font = 'bold ' + Math.round(9 * S) + 'px system-ui, sans-serif'; x.textAlign = 'center'; x.fillText('QUIK FUEL', q[0], q[1] - 10 * S);
        x.fillStyle = '#d24a3a'; x.font = Math.round(9 * S) + 'px monospace'; x.fillText('--.--', q[0], q[1] + 4 * S); x.fillText('--.--', q[0], q[1] + 14 * S);
        break;
      }
      case 'exitSign': {
        B(p.x, p.y, 0, 0.07, 0.07, p.h, '#3a3c40');
        const q = proj(p.x, p.y, p.h + 0.2);
        x.fillStyle = p.green ? '#1f5a35' : '#7a5a14'; x.fillRect(q[0] - 30 * S, q[1] - 16 * S, 60 * S, 30 * S);
        x.strokeStyle = p.green ? '#7fe3a0' : '#ffd36a'; x.lineWidth = 2 * S; x.strokeRect(q[0] - 30 * S, q[1] - 16 * S, 60 * S, 30 * S);
        x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = 'bold ' + Math.round(11 * S) + 'px system-ui, sans-serif'; x.fillText(p.text, q[0], q[1] - 2 * S);
        x.font = Math.round(7 * S) + 'px system-ui, sans-serif'; x.fillText(p.sub, q[0], q[1] + 9 * S);
        break;
      }
      case 'bush': {
        const q = proj(p.x, p.y, 0.4);
        for (let k = 0; k < 6; k++) { x.fillStyle = ['#3a4733', '#425038', '#34402e'][k % 3]; x.beginPath(); x.ellipse(q[0] + (SP.hash(k, p.x | 0) - 0.5) * 30 * S, q[1] + (SP.hash(p.y | 0, k) - 0.5) * 12 * S - 6 * S, 16 * S, 11 * S, 0, 0, 7); x.fill(); }
        break;
      }
      case 'forklift': {
        const a = p.ang || 0, c = Math.cos(a), sn = Math.sin(a);
        const L = (f, r) => [p.x + f * c - r * sn, p.y + f * sn + r * c];
        for (const [f, r] of [[0.55, 0.45], [0.55, -0.45], [-0.6, 0.42], [-0.6, -0.42]]) { const q = L(f, r); B(q[0], q[1], 0, 0.2, 0.08, 0.4, '#1b1b1c'); }
        B(p.x, p.y, 0.2, 0.85, 0.5, 0.6, '#d8a21c', { top: '#e8b93a' });
        const cw = L(-0.7, 0); B(cw[0], cw[1], 0.2, 0.2, 0.48, 0.7, '#3a3a3a');
        for (const r of [0.3, -0.3]) { const q = L(0.2, r); B(q[0], q[1], 0.8, 0.04, 0.04, 1.2, '#2a2a2a'); const q2 = L(-0.45, r); B(q2[0], q2[1], 0.8, 0.04, 0.04, 1.2, '#2a2a2a'); }
        { const q = L(-0.12, 0); B(q[0], q[1], 2.0, 0.42, 0.44, 0.06, '#d8a21c'); }
        for (const r of [0.38, -0.38]) { const q = L(1.0, 0); B(q[0], q[1], 0, 0.08, 0.5, 2.1, '#3b3b3b'); const f2 = L(1.45, r); B(f2[0], f2[1], 0.1, 0.45, 0.05, 0.05, '#555'); }
        break;
      }
      case 'palletjack': { B(p.x, p.y, 0, p.hl, p.hw, 0.12, '#d8a21c'); const a = p.ang || 0; B(p.x - Math.cos(a) * p.hl, p.y - Math.sin(a) * p.hl, 0, 0.12, 0.12, 1.0, '#c7951a'); break; }
      case 'condenser': B(p.x, p.y, 0, p.hl, p.hw, p.h, '#8d9396', { top: '#5c6266', faceFn: (f, a, b, c3, d) => { x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 1 * S; for (let k = 1; k < 8; k++) { const tt = k / 8; x.beginPath(); x.moveTo(a[0] + (b[0] - a[0]) * tt, a[1] + (b[1] - a[1]) * tt); x.lineTo(d[0] + (c3[0] - d[0]) * tt, d[1] + (c3[1] - d[1]) * tt); x.stroke(); } } }); { const n = Math.max(1, Math.round(p.hl / 0.8)); for (let k = 0; k < n; k++) { const f = -p.hl + (k + 0.5) * (2 * p.hl / n); const q = proj(p.x + Math.cos(p.ang || 0) * f, p.y + Math.sin(p.ang || 0) * f, p.h); x.fillStyle = '#1e2224'; x.beginPath(); x.ellipse(q[0], q[1], 0.32 * HX * S * 1.3, 0.32 * HY * S * 1.3, 0, 0, 7); x.fill(); x.strokeStyle = '#9aa0a3'; x.lineWidth = 1 * S; x.stroke(); } } break;
      case 'reefer': {
        const a = p.ang || 0, c = Math.cos(a), sn = Math.sin(a);
        for (const f of [-p.hl + 1.2, -p.hl + 2.4]) for (const r of [p.hw * 0.85, -p.hw * 0.85]) { const q = [p.x + f * c - r * sn, p.y + f * sn + r * c]; B(q[0], q[1], 0, 0.45, 0.14, 0.9, '#161616'); }
        B(p.x, p.y, 0.9, p.hl, p.hw, p.h - 0.9, col || '#d9dad6', { top: SP.shade(col || '#d9dad6', -0.08), faceFn: (f, a1, b1, c3, d1) => { if (p.logo) { x.fillStyle = p.logo; const mx = (a1[0] + c3[0]) / 2, my = (a1[1] + c3[1]) / 2; x.fillRect(mx - 14 * S, my - 3 * S, 28 * S, 6 * S); } } });
        { const q = [p.x + (p.hl - 0.25) * c, p.y + (p.hl - 0.25) * sn]; B(q[0], q[1], 1.4, 0.25, p.hw * 0.75, 1.2, '#9ea3a6'); }
        break;
      }
      case 'leveler': B(p.x, p.y, 0, p.hl, p.hw, 0.05, '#4a4a46', { top: '#3c3c38', noTop: false }); { const a1 = proj(p.x - p.hl, p.y + p.hw, 0.06), b1 = proj(p.x + p.hl, p.y + p.hw, 0.06); x.strokeStyle = '#d8b23a'; x.lineWidth = 3 * S; x.setLineDash([5 * S, 5 * S]); x.beginPath(); x.moveTo(a1[0], a1[1]); x.lineTo(b1[0], b1[1]); x.stroke(); x.setLineDash([]); } break;
      case 'hirack': {
        const a = p.ang || 0;
        B(p.x, p.y, 0, p.hl, p.hw, 0.08, '#c76b1f');
        for (let lv = 0; lv < 3; lv++) { B(p.x, p.y, 0.1 + lv * 1.05, p.hl * 0.96, p.hw * 0.9, 0.75, ['#a98a5e', '#8b8f6a', '#b9b4a6', '#7a6a50'][(lv + (p.x | 0)) % 4], { top: '#c2a978' }); B(p.x, p.y, 0.95 + lv * 1.05, p.hl, p.hw, 0.08, '#c76b1f'); }
        for (const f of [-p.hl, 0, p.hl]) B(p.x + Math.cos(a) * f, p.y + Math.sin(a) * f, 0, 0.06, p.hw, 3.2, '#2c5b8a');
        break;
      }
      case 'strips': break; // drawn live (translucent)
      case 'pumpunit': B(p.x, p.y, 0, p.hl, p.hw, 0.25, '#4b4f52'); B(p.x, p.y, 0.25, p.hl * 0.6, p.hw * 0.8, 0.9, '#2f6d8c', { top: '#3c86aa' }); B(p.x + p.hl * 0.6, p.y, 0.4, p.hl * 0.35, p.hw * 0.5, 0.6, '#686c6e'); break;
      case 'pipe': B(p.x, p.y, p.z || 0.2, p.hl, p.hw, p.hw * 2, col || '#6d7e86', { top: SP.shade(col || '#6d7e86', 0.15) }); break;
      case 'valve': B(p.x, p.y, 0, 0.15, 0.15, 0.9, '#5a5f62'); { const q = proj(p.x, p.y, 1.0); x.strokeStyle = '#c0392b'; x.lineWidth = 3 * S; x.beginPath(); x.ellipse(q[0], q[1], 9 * S, 4.5 * S, 0, 0, 7); x.stroke(); } break;
      case 'beacon': case 'speaker': {
        B(p.x, p.y, 0, 0.07, 0.07, p.h, '#3a3c40');
        if (t === 'beacon') { const q = proj(p.x, p.y, p.h + 0.1); x.fillStyle = '#5a4a1a'; x.beginPath(); x.ellipse(q[0], q[1], 4 * S, 6 * S, 0, 0, 7); x.fill(); }
        else { for (const da of [-0.6, 0.6]) { const aa = (p.ang || 0) + da; const q0 = proj(p.x, p.y, p.h - 0.2), q1 = proj(p.x + Math.cos(aa) * 0.7, p.y + Math.sin(aa) * 0.7, p.h - 0.1); x.strokeStyle = '#2a2c2e'; x.lineWidth = 5 * S; x.beginPath(); x.moveTo(q0[0], q0[1]); x.lineTo(q1[0], q1[1]); x.stroke(); x.fillStyle = '#4a4e52'; x.beginPath(); x.ellipse(q1[0], q1[1], 5 * S, 4 * S, 0, 0, 7); x.fill(); } }
        break;
      }
      case 'dish': {
        B(p.x, p.y, 0, 0.6, 0.6, 0.4, '#7c8084');
        B(p.x, p.y, 0.4, 0.18, 0.18, p.h * 0.45, '#9a9ea2');
        const a = p.ang || 0; const cq = proj(p.x + Math.cos(a) * 0.4, p.y + Math.sin(a) * 0.4, p.h * 0.62);
        const rr = (p.dr || 2.2) * HX * S;
        x.save(); x.translate(cq[0], cq[1]); x.rotate(-0.5 + Math.sin(a) * 0.2);
        x.fillStyle = '#cfd3d4'; x.beginPath(); x.ellipse(0, 0, rr * 0.55, rr, 0, 0, 7); x.fill();
        x.strokeStyle = '#8c9094'; x.lineWidth = 2 * S; x.stroke();
        x.fillStyle = 'rgba(0,0,0,0.15)'; x.beginPath(); x.ellipse(rr * 0.08, 0, rr * 0.4, rr * 0.82, 0, 0, 7); x.fill();
        x.strokeStyle = '#6d7174'; x.lineWidth = 2 * S; x.beginPath(); x.moveTo(0, 0); x.lineTo(rr * 0.9, -rr * 0.1); x.stroke();
        x.restore();
        break;
      }
      case 'tank': {
        const r = p.r || 1.2, hh = p.h || 2.5;
        const q0 = proj(p.x, p.y, 0), q1 = proj(p.x, p.y, hh);
        const rx = r * HX * S * 1.41, ry = r * HY * S * 1.41;
        x.fillStyle = SP.shade(col || '#5d7f93', -0.15); x.fillRect(q0[0] - rx, q1[1], rx * 2, q0[1] - q1[1]);
        x.beginPath(); x.ellipse(q0[0], q0[1], rx, ry, 0, 0, Math.PI); x.fill();
        const gr = x.createLinearGradient(q0[0] - rx, 0, q0[0] + rx, 0); gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)');
        x.fillStyle = gr; x.fillRect(q0[0] - rx, q1[1], rx * 2, q0[1] - q1[1]);
        x.fillStyle = col || '#5d7f93'; x.beginPath(); x.ellipse(q1[0], q1[1], rx, ry, 0, 0, 7); x.fill();
        x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 1.5 * S; x.stroke();
        break;
      }
      case 'sandbags': for (let k = 0; k < 3; k++) B(p.x, p.y, k * 0.28, p.hl - k * 0.1, p.hw, 0.27, ['#8a7a58', '#7d6f50', '#958560'][k], { top: '#a39270' }); break;
      case 'boat': { const a = p.ang || 0; B(p.x, p.y, 0, p.hl, p.hw, 0.45, col || '#a35b3a', { top: '#4a3a2c' }); B(p.x + Math.cos(a) * 0.4, p.y + Math.sin(a) * 0.4, 0.3, 0.12, p.hw * 0.9, 0.12, '#6b5640'); break; }
      case 'debris': { const r = DH.RNG((p.x * 13 + p.y * 7) | 0); for (let k = 0; k < 5; k++) { const dx = (r.next() - 0.5) * p.hl * 2, dy = (r.next() - 0.5) * p.hw * 2; B(p.x + dx, p.y + dy, 0, 0.3 + r.next() * 0.3, 0.05 + r.next() * 0.1, 0.06 + r.next() * 0.12, ['#5a4a38', '#6b6b66', '#3e3a33', '#7a5a3a'][k % 4]); } break; }
      case 'panel': case 'breaker': case 'console': {
        B(p.x, p.y, 0, p.hl, p.hw, p.h, col || (t === 'breaker' ? '#5d6a5e' : '#4c5459'), { top: '#2e3337', faceFn: (f, a1, b1, c3, d1) => {
          const mx = (a1[0] + c3[0]) / 2, my = (a1[1] + c3[1]) / 2;
          if (t === 'breaker') { x.fillStyle = '#c0392b'; x.fillRect(mx - 2 * S, my - 8 * S, 4 * S, 11 * S); x.fillStyle = '#222'; x.fillRect(mx - 5 * S, my + 3 * S, 10 * S, 3 * S); }
          else { for (let k = 0; k < 4; k++) { x.fillStyle = ['#d8b23a', '#7fe3a0', '#c0392b', '#8cd6ff'][k]; x.fillRect(mx - 7 * S + k * 4 * S, my - 4 * S, 2.4 * S, 2.4 * S); } x.fillStyle = 'rgba(140,200,220,0.25)'; x.fillRect(mx - 7 * S, my + 1 * S, 14 * S, 5 * S); }
        } });
        break;
      }
      case 'drum': { const q0 = proj(p.x, p.y, 0), q1 = proj(p.x, p.y, 0.9); const rx = 0.3 * HX * S * 1.41, ry = 0.3 * HY * S * 1.41; x.fillStyle = SP.shade(col || '#3e6a4a', -0.2); x.fillRect(q0[0] - rx, q1[1], rx * 2, q0[1] - q1[1]); x.beginPath(); x.ellipse(q0[0], q0[1], rx, ry, 0, 0, Math.PI); x.fill(); x.fillStyle = col || '#3e6a4a'; x.beginPath(); x.ellipse(q1[0], q1[1], rx, ry, 0, 0, 7); x.fill(); break; }
      case 'rock': { const r = p.r || 1; const q = proj(p.x, p.y, 0); x.fillStyle = col || '#4a4a48'; x.beginPath(); x.ellipse(q[0], q[1] - r * HZ * S * 0.4, r * HX * S * 1.3, r * HZ * S * 0.75, 0.1, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,0.07)'; x.beginPath(); x.ellipse(q[0] - r * 6 * S, q[1] - r * HZ * S * 0.7, r * HX * S * 0.6, r * HZ * S * 0.3, 0.1, 0, 7); x.fill(); break; }
      case 'mooring': B(p.x, p.y, 0, 0.25, 0.25, 0.7, '#2b2d2f', { top: '#e0b84a' }); break;
      case 'spool': { const q0 = proj(p.x, p.y, 0.6); x.fillStyle = '#7a5a3a'; x.beginPath(); x.ellipse(q0[0], q0[1], 0.7 * HX * S, 0.6 * HZ * S, 0.6, 0, 7); x.fill(); x.fillStyle = '#2a2a2a'; x.beginPath(); x.ellipse(q0[0], q0[1], 0.4 * HX * S, 0.35 * HZ * S, 0.6, 0, 7); x.fill(); break; }
      default:
        if (p.parts) { const a = p.ang || 0, c = Math.cos(a), sn = Math.sin(a); for (const q of p.parts) { const wx = p.x + q[0] * c - q[1] * sn, wy = p.y + q[0] * sn + q[1] * c; SP.box(x, proj, wx, wy, q[2], q[3], q[4], q[5], a + (q[7] && q[7].rot || 0), q[6], q[7]); } break; }
        B(p.x, p.y, 0, p.hl || 0.4, p.hw || 0.4, p.h || 1, col || '#777');
    }
  };

  // Roof sprite per building (or canopy)
  const roofSprite = (b, canopy) => {
    const key = 'roof|' + G.W.key + '|' + (canopy ? 'canopy' + (b.cid || '') : b.id) + '|' + R.S;
    let e = SP.staticCache.get(key);
    if (e) return e;
    const S = R.S;
    const x1 = b.x1, y1 = b.y1, x2 = b.x2 + 1, y2 = b.y2 + 1;
    const h = canopy ? b.h : DH.MAT_INFO[b.mat].h;
    const pts = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]].map(([x, y]) => PS(x, y, h));
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const q of pts) { minx = Math.min(minx, q[0]); miny = Math.min(miny, q[1]); maxx = Math.max(maxx, q[0]); maxy = Math.max(maxy, q[1]); }
    const pad = 40 * S;
    const c = SP.mk(maxx - minx + pad * 2, maxy - miny + pad * 2 + (canopy ? 0.5 * HZ * S : 0)), x = c.getContext('2d');
    const ox = -minx + pad, oy = -miny + pad;
    const proj = (wx, wy, wz) => { const q = PS(wx, wy, wz); return [q[0] + ox, q[1] + oy]; };
    if (canopy) {
      // fascia
      const f1 = proj(x1, y2, h), f2 = proj(x2, y2, h), f3 = proj(x2, y2, h - 0.5), f4 = proj(x1, y2, h - 0.5);
      x.fillStyle = b.fascia || '#c03a2e'; x.beginPath(); x.moveTo(f1[0], f1[1]); x.lineTo(f2[0], f2[1]); x.lineTo(f3[0], f3[1]); x.lineTo(f4[0], f4[1]); x.fill();
      const g1 = proj(x2, y1, h), g3 = proj(x2, y2, h - 0.5), g4 = proj(x2, y1, h - 0.5);
      x.fillStyle = SP.shade(b.fascia || '#c03a2e', -0.12); x.beginPath(); x.moveTo(g1[0], g1[1]); x.lineTo(f2[0], f2[1]); x.lineTo(g3[0], g3[1]); x.lineTo(g4[0], g4[1]); x.fill();
      x.fillStyle = '#f0ece0'; x.font = 'bold ' + Math.round(10 * S) + 'px system-ui'; x.save(); x.translate(f4[0], f4[1]); x.transform(HX / Math.hypot(HX, HY), HY / Math.hypot(HX, HY), 0, 1, 0, 0); x.fillText(b.text || '', 20 * S, -3 * S); x.restore();
    }
    x.beginPath(); pts.forEach((q, i) => { const a = q[0] + ox, bb = q[1] + oy; if (i) x.lineTo(a, bb); else x.moveTo(a, bb); }); x.closePath();
    x.fillStyle = canopy ? b.top || '#d9d4c8' : b.roof || '#3e3e3e'; x.fill();
    x.save(); x.clip();
    x.globalAlpha = 0.5; const nz = SP.noise(); for (let yy = 0; yy < c.height; yy += 128) for (let xx = 0; xx < c.width; xx += 128) x.drawImage(nz, xx, yy); x.globalAlpha = 1;
    x.restore();
    // parapet edge
    x.strokeStyle = canopy ? '#b8b2a4' : SP.shade(b.roof || '#3e3e3e', 0.25); x.lineWidth = 3 * S; x.stroke();
    if (!canopy) {
      // roof details: AC units / vents
      const r = DH.RNG(b.id * 31 + 5);
      const n = Math.max(1, Math.floor((x2 - x1) * (y2 - y1) / 70));
      for (let k = 0; k < n; k++) {
        const ax = x1 + 2 + r.next() * (x2 - x1 - 4), ay = y1 + 2 + r.next() * (y2 - y1 - 4);
        SP.box(x, proj, ax, ay, h, 0.7, 0.5, 0.6, 0, '#8a8c88');
        x.fillStyle = '#2c2c2c'; const q = proj(ax, ay, h + 0.6); x.beginPath(); x.ellipse(q[0], q[1], 7 * S, 3.5 * S, 0, 0, 7); x.fill();
      }
      for (let k = 0; k < 2; k++) { const ax = x1 + 1.5 + r.next() * (x2 - x1 - 3), ay = y1 + 1.5 + r.next() * (y2 - y1 - 3); SP.box(x, proj, ax, ay, h, 0.18, 0.18, 0.35, 0, '#6a6a66'); }
      // tar patches
      x.fillStyle = 'rgba(0,0,0,0.18)'; for (let k = 0; k < 4; k++) { const q = proj(x1 + r.next() * (x2 - x1), y1 + r.next() * (y2 - y1), h); x.beginPath(); x.ellipse(q[0], q[1], 14 * S, 6 * S, 0, 0, 7); x.fill(); }
    }
    e = { c, ox, oy };
    SP.staticCache.set(key, e);
    return e;
  };

  const signSprite = (sg) => {
    const key = 'sign|' + sg.text + '|' + R.S;
    let e = SP.staticCache.get(key);
    if (e) return e;
    const S = R.S;
    const L = sg.len, H = 0.55;
    const dir = sg.face === 'S' ? 1 : -1;
    const w = L * HX * S + 4, h = L * HY * S + H * HZ * S + 4;
    const c = SP.mk(w, h), x = c.getContext('2d');
    const ox = sg.face === 'S' ? 2 : w - 2;
    x.setTransform(dir * HX * S, HY * S, 0, -HZ * S, ox, H * HZ * S + 2);
    if (sg.face === 'E') { x.translate(L, 0); x.scale(-1, 1); }
    x.fillStyle = sg.bg; x.fillRect(0, 0, L, H);
    x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, 0, L, 0.05);
    // text in local units: scale so 1 unit = 1/40 m
    x.save(); x.translate(L / 2, H * 0.27); x.scale(1 / 40, -1 / 40);
    x.fillStyle = sg.color; x.textAlign = 'center'; x.font = 'bold 15px system-ui, Arial, sans-serif';
    x.shadowColor = sg.color; x.shadowBlur = 6;
    const tw = x.measureText(sg.text).width;
    const maxw = L * 40 * 0.92;
    if (tw > maxw) x.scale(maxw / tw, 1);
    x.fillText(sg.text, 0, 0);
    x.restore();
    e = { c, ox, oy: H * HZ * S + 2, w };
    SP.staticCache.set(key, e);
    return e;
  };

  // pickup / cargo sprites
  const itemSprite = (kind, sub) => {
    const key = 'item|' + kind + '|' + (sub || '') + '|' + R.S;
    let e = SP.staticCache.get(key);
    if (e) return e;
    const S = R.S;
    const w = 3 * HX * S, h = 2 * HY * S + 1.4 * HZ * S + 10;
    const c = SP.mk(w, h), x = c.getContext('2d');
    const ox = w / 2, oy = h - 1.5 * HY * S;
    const proj = (wx, wy, wz) => { const q = SP.P(wx, wy, wz, S); return [q[0] + ox, q[1] + oy]; };
    const B = (cx, cy, z0, hl, hw, hh, col, o) => SP.box(x, proj, cx, cy, z0, hl, hw, hh, 0.35, col, o);
    switch (kind) {
      case 'case': B(0, 0, 0, 0.3, 0.2, 0.32, '#d8d4c8', { top: '#ece8de', faceFn: (f, a, b, c3, d) => { x.fillStyle = '#c4302a'; const mx = (a[0] + c3[0]) / 2, my = (a[1] + c3[1]) / 2; x.fillRect(mx - 1.5 * S, my - 4.5 * S, 3 * S, 9 * S); x.fillRect(mx - 4.5 * S, my - 1.5 * S, 9 * S, 3 * S); } }); { const q = proj(0, 0, 0.34); x.fillStyle = '#c4302a'; x.fillRect(q[0] - 1.5 * S, q[1] - 4 * S, 3 * S, 8 * S); x.fillRect(q[0] - 4 * S, q[1] - 1.5 * S, 8 * S, 3 * S); } break;
      case 'salvage': B(0, 0, 0, 0.32, 0.26, 0.3, '#5a6448', { top: '#6e7858' }); { const q = proj(0, 0, 0.31); x.strokeStyle = '#2a2a22'; x.lineWidth = 1.5 * S; x.beginPath(); x.moveTo(q[0] - 8 * S, q[1]); x.lineTo(q[0] + 8 * S, q[1]); x.stroke(); } break;
      case 'generator': {
        B(0, 0, 0, 0.55, 0.38, 0.12, '#2a2a2a');
        for (const [a, b] of [[0.45, 0.4], [0.45, -0.4], [-0.45, 0.4], [-0.45, -0.4]]) { const q = proj(a, b, 0.08); x.fillStyle = '#111'; x.beginPath(); x.arc(q[0], q[1], 3 * S, 0, 7); x.fill(); }
        B(0, 0, 0.12, 0.48, 0.34, 0.55, '#d9a520', { top: '#2c2c2c', faceFn: (f, a, b, c3, d) => { x.fillStyle = '#2b2b2b'; x.fillRect((a[0] + c3[0]) / 2 - 4 * S, (a[1] + c3[1]) / 2 - 3 * S, 8 * S, 6 * S); } });
        const h1 = proj(-0.55, 0, 0.3), h2 = proj(-1.05, 0, 0.95); x.strokeStyle = '#7a7d80'; x.lineWidth = 2.5 * S; x.beginPath(); x.moveTo(h1[0], h1[1]); x.lineTo(h2[0], h2[1]); x.stroke();
        break;
      }
      case 'weapon': {
        const len = { pistol: 0.3, shotgun: 1.0, smg: 0.6, rifle: 1.1 }[sub] || 0.6;
        const a = proj(-len / 2, 0.1, 0.06), b = proj(len / 2, -0.1, 0.06);
        x.lineCap = 'round'; x.strokeStyle = '#111'; x.lineWidth = 6 * S; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke();
        x.strokeStyle = sub === 'shotgun' || sub === 'rifle' ? '#6b4a2a' : '#3b3d40'; x.lineWidth = 3.5 * S; x.stroke();
        x.strokeStyle = '#555a5e'; x.lineWidth = 2 * S; x.beginPath(); x.moveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); x.lineTo(b[0], b[1]); x.stroke();
        break;
      }
      case 'medstock': B(0, 0, 0, 0.3, 0.22, 0.34, '#e8ecee', { top: '#3a7fc0' }); { const q = proj(0, 0, 0.36); x.fillStyle = '#fff'; x.fillRect(q[0] - 1.2 * S, q[1] - 3.5 * S, 2.4 * S, 7 * S); x.fillRect(q[0] - 3.5 * S, q[1] - 1.2 * S, 7 * S, 2.4 * S); } break;
      case 'assembly': {
        B(0, 0, 0, 0.6, 0.45, 0.1, '#7a5c3a');
        B(0, 0, 0.1, 0.55, 0.4, 0.6, '#cfd3d4', { top: '#9ca1a4', faceFn: (f, a, b, c3, d) => { x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 1 * S; for (let k = 1; k < 6; k++) { const tt = k / 6; x.beginPath(); x.moveTo(a[0] + (d[0] - a[0]) * tt, a[1] + (d[1] - a[1]) * tt); x.lineTo(b[0] + (c3[0] - b[0]) * tt, b[1] + (c3[1] - b[1]) * tt); x.stroke(); } } });
        const q = proj(0, 0, 0.71); x.fillStyle = '#2a2e30'; x.beginPath(); x.ellipse(q[0], q[1], 9 * S, 4.5 * S, 0, 0, 7); x.fill(); x.strokeStyle = '#b87333'; x.lineWidth = 2.2 * S; x.beginPath(); x.moveTo(q[0] + 10 * S, q[1] + 2 * S); x.quadraticCurveTo(q[0] + 18 * S, q[1] + 10 * S, q[0] + 12 * S, q[1] + 16 * S); x.stroke();
        break;
      }
      case 'filtration': {
        B(0, 0, 0, 0.6, 0.4, 0.1, '#55595c');
        for (const dx of [-0.28, 0.28]) { const q0 = proj(dx, 0, 0.1), q1 = proj(dx, 0, 0.8); const rx = 0.24 * HX * S * 1.41, ry = 0.24 * HY * S * 1.41; x.fillStyle = '#2f6d8c'; x.fillRect(q0[0] - rx, q1[1], rx * 2, q0[1] - q1[1]); x.beginPath(); x.ellipse(q0[0], q0[1], rx, ry, 0, 0, Math.PI); x.fill(); x.fillStyle = '#4a96bb'; x.beginPath(); x.ellipse(q1[0], q1[1], rx, ry, 0, 0, 7); x.fill(); }
        const a1 = proj(-0.28, 0, 0.6), b1 = proj(0.28, 0, 0.6); x.strokeStyle = '#9aa0a3'; x.lineWidth = 2.5 * S; x.beginPath(); x.moveTo(a1[0], a1[1]); x.lineTo(b1[0], b1[1]); x.stroke();
        break;
      }
      case 'powerpack': {
        B(0, 0, 0, 0.55, 0.4, 0.12, '#2a2a2a');
        B(0, 0, 0.12, 0.5, 0.36, 0.55, '#d4621e', { top: '#2e2e2e', faceFn: (f, a, b, c3, d) => { x.fillStyle = '#1e1e1e'; x.fillRect((a[0] + c3[0]) / 2 - 5 * S, (a[1] + c3[1]) / 2 - 3 * S, 10 * S, 6 * S); } });
        const h1 = proj(0.5, 0.2, 0.4), h2 = proj(0.9, 0.5, 0.05); x.strokeStyle = '#151515'; x.lineWidth = 2.5 * S; x.beginPath(); x.moveTo(h1[0], h1[1]); x.quadraticCurveTo(h2[0], h1[1], h2[0], h2[1]); x.stroke();
        break;
      }
      case 'supplies': B(0, 0, 0, 0.32, 0.26, 0.36, '#6a5a3a', { top: '#86734c', faceFn: (f, a, b, c3, d) => { x.fillStyle = 'rgba(240,230,200,0.75)'; x.fillRect((a[0] + c3[0]) / 2 - 5 * S, (a[1] + c3[1]) / 2 - 2 * S, 10 * S, 4 * S); } }); break;
      case 'note': B(0, 0, 0, 0.18, 0.13, 0.03, '#e8e2cf'); { const q = proj(0, 0, 0.04); x.strokeStyle = '#3a3a3a'; x.lineWidth = 0.8 * S; for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(q[0] - 4 * S, q[1] + k * 2 * S); x.lineTo(q[0] + 4 * S, q[1] + k * 2 * S); x.stroke(); } } break;
      case 'crate': B(0, 0, 0, 0.45, 0.35, 0.5, '#4b5a3a', { top: '#5b6a48', faceFn: (f, a, b, c3, d) => { x.fillStyle = '#d8d2a0'; x.font = 'bold ' + Math.round(6 * S) + 'px monospace'; x.fillText('SMG', (a[0] + c3[0]) / 2 - 7 * S, (a[1] + c3[1]) / 2 + 2 * S); } }); break;
      case 'ammo': B(0, 0, 0, 0.18, 0.12, 0.14, sub === 'shell' ? '#8a2d22' : sub === 'r30' ? '#3c5a2c' : sub === 'smg' ? '#2c3e5a' : '#6b5a2a', { top: '#c9b98a' }); break;
      case 'medkit': B(0, 0, 0, 0.2, 0.14, 0.14, '#e8e4dc', { top: '#f4f1ea' }); { const q = proj(0, 0, 0.15); x.fillStyle = '#c4302a'; x.fillRect(q[0] - 1.2 * S, q[1] - 3.5 * S, 2.4 * S, 7 * S); x.fillRect(q[0] - 3.5 * S, q[1] - 1.2 * S, 7 * S, 2.4 * S); } break;
      case 'noisemaker': B(0, 0, 0, 0.08, 0.08, 0.18, '#3a3e44'); { const q = proj(0, 0, 0.2); x.fillStyle = '#9fd'; x.beginPath(); x.arc(q[0], q[1], 1.8 * S, 0, 7); x.fill(); } break;
      case 'repairkit': B(0, 0, 0, 0.26, 0.15, 0.2, '#d26b1e', { top: '#e88a3a' }); { const q = proj(0, 0, 0.22); x.strokeStyle = '#333'; x.lineWidth = 2 * S; x.beginPath(); x.moveTo(q[0] - 5 * S, q[1]); x.lineTo(q[0] + 5 * S, q[1]); x.stroke(); } break;
    }
    e = { c, ox, oy };
    SP.staticCache.set(key, e);
    return e;
  };
  R.itemSprite = itemSprite;

  // ---------- Fade state ----------
  const fade = (id, target, dt) => {
    let a = R.alpha.get(id);
    if (a == null) a = 1;
    a = M.approach(a, target, dt * 3.2);
    R.alpha.set(id, a);
    return a;
  };

  // ---------- Frame ----------
  const list = [];
  let order = 0;
  const push = (o) => { o.o = order++; list.push(o); };
  const keyAgainst = (a, b) => {
    if (a.seg && (!b.seg || a.segAlways)) { const q = M.closestOnSeg(b.px, b.py, a.seg[0], a.seg[1], a.seg[2], a.seg[3]); return q.x + q.y + (a.segBias || 0); }
    return a.k;
  };
  const cmp = (a, b) => { const ka = keyAgainst(a, b), kb = keyAgainst(b, a); if (Math.abs(ka - kb) > 1e-6) return ka - kb; return (a.pri || 0) - (b.pri || 0) || a.o - b.o; };

  R.render = (dt) => {
    const ctx = R.ctx, run = G.run, W = G.W;
    const t0 = performance.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d0f12';
    ctx.fillRect(0, 0, R.Wb, R.Hb);
    if (!run || !W) return;
    R.S = SP.S;
    R.f = (R.cam.zoom * R.dpr) / R.S;
    const cs = PS(R.cam.x, R.cam.y, 0);
    R.camSX = cs[0]; R.camSY = cs[1];
    const FX = DH.FX;
    if (FX.shakeT > 0) { R.shx = (Math.random() - 0.5) * FX.shakeA * 18 * R.dpr; R.shy = (Math.random() - 0.5) * FX.shakeA * 18 * R.dpr; } else { R.shx = R.shy = 0; }
    const f = R.f;
    const setT = () => ctx.setTransform(f, 0, 0, f, R.Wb / 2 - f * R.camSX + R.shx, R.Hb / 2 - f * R.camSY + R.shy);
    setT();
    // visible world bounds
    const corners = [[0, 0, 0], [R.cssW, 0, 0], [0, R.cssH, 7], [R.cssW, R.cssH, 7], [0, R.cssH, 0], [R.cssW, R.cssH, 0]];
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const c of corners) { const w = R.screenToWorld(c[0], c[1], c[2]); minX = Math.min(minX, w.x); maxX = Math.max(maxX, w.x); minY = Math.min(minY, w.y); maxY = Math.max(maxY, w.y); }
    minX = Math.max(0, Math.floor(minX) - 2); minY = Math.max(0, Math.floor(minY) - 2); maxX = Math.min(W.N - 1, Math.ceil(maxX) + 2); maxY = Math.min(W.N - 1, Math.ceil(maxY) + 2);
    // screen-diamond test helper: is world point roughly on screen
    const vis = (x, y, z, m) => { const s = R.toScreen(x, y, z || 0); const mm = m || 120; return s.x > -mm && s.x < R.cssW + mm && s.y > -mm && s.y < R.cssH + mm * 2.5; };

    // ---- ground ----
    const cx0 = Math.floor(minX / CH), cx1 = Math.floor(maxX / CH), cy0 = Math.floor(minY / CH), cy1 = Math.floor(maxY / CH);
    R.prof = R.prof || {}; const PT = () => performance.now(); let _t = PT(); const mark = (k) => { const n = PT(); R.prof[k] = (R.prof[k] || 0) + n - _t; _t = n; };
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      { // exact screen-rect test of the chunk diamond's bounding box
        const x0 = cx * CH, y0 = cy * CH, S0 = R.S;
        const bx = (x0 - y0 - CH) * HX * S0, by = (x0 + y0) * HY * S0, bw = 2 * CH * HX * S0, bh = 2 * CH * HY * S0;
        const sx0 = f * (bx - R.camSX) + R.Wb / 2, sy0 = f * (by - R.camSY) + R.Hb / 2;
        if (sx0 > R.Wb + 40 || sy0 > R.Hb + 40 || sx0 + bw * f < -40 || sy0 + bh * f < -40) continue;
      }
      const ch = getChunk(cx, cy);
      ctx.drawImage(ch.c, ch.bx, ch.by);
    }
    mark('ground');
    R.drawWater(ctx, minX, minY, maxX, maxY, vis);
    // ---- ground dynamic: decals, rings, shadows ----
    for (const d of FX.decals) {
      if (!vis(d.x, d.y)) continue;
      const p = PS(d.x, d.y);
      ctx.globalAlpha = Math.min(1, d.t / 6) * 0.75;
      ctx.fillStyle = '#3a0e0c';
      ctx.beginPath(); ctx.ellipse(p[0], p[1], d.r * HX * R.S * 1.2, d.r * HY * R.S * 1.2, 0, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // broken doors / shelf debris
    W.doors.forEach((d, i) => { if (!run.doors[i].broken) return; const p = PS(d.cx, d.cy); ctx.fillStyle = 'rgba(90,70,50,0.8)'; for (let k = 0; k < 5; k++) ctx.fillRect(p[0] + (SP.hash(k, i) - 0.5) * 30 * R.S, p[1] + (SP.hash(i, k) - 0.5) * 14 * R.S, 7 * R.S, 2 * R.S); });
    if (run.shelf && run.shelf.broken && W.shelf) { const p = PS(W.shelf.block.x, W.shelf.block.y); ctx.fillStyle = 'rgba(150,150,140,0.8)'; for (let k = 0; k < 7; k++) ctx.fillRect(p[0] + (SP.hash(k, 3) - 0.5) * 40 * R.S, p[1] + (SP.hash(3, k) - 0.5) * 16 * R.S, 8 * R.S, 3 * R.S); }
    // interaction highlight rings
    const pl = run.player;
    const ppos = DH.Player.pos();
    const tnow = performance.now() / 1000;
    const ring = (x, y, r, col, a) => { const p = PS(x, y, 0.02); ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.lineWidth = 2 * R.S; ctx.beginPath(); ctx.ellipse(p[0], p[1], r * HX * R.S * 1.41, r * HY * R.S * 1.41, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; };
    const hlA = 0.45 + Math.sin(tnow * 4) * 0.2;
    for (const k of run.pickups) if (!k.taken && M.dist(ppos.x, ppos.y, k.x, k.y) < 9) ring(k.x, k.y, 0.45, '#f0b54a', hlA);
    for (const id in run.items) { const it = run.items[id]; const idef = DH.ITEMS[it.kind] || {}; if (it.loc === 'world' && M.dist(ppos.x, ppos.y, it.x, it.y) < (idef.primary ? 14 : 9)) ring(it.x, it.y, idef.heavy ? 0.9 : 0.5, idef.primary ? '#ff6b5a' : '#f0b54a', idef.primary ? 0.75 : hlA); }
    for (const sv of run.survivors) {
      if (!sv.recruited && !sv.hidden && M.dist(ppos.x, ppos.y, sv.x, sv.y) < 9) ring(sv.x, sv.y, 0.55, '#7fe3a0', hlA);
      if (sv.state === 'downed') ring(sv.x, sv.y, 0.7, '#ff6b5a', 0.6 + Math.sin(tnow * 8) * 0.3);
    }
    const ac = W.alarmCar; if (ac && M.dist(ppos.x, ppos.y, ac.x, ac.y) < 10 && run.alarm.cooldown <= 0 && run.alarm.active <= 0) ring(ac.x, ac.y, 1.8, '#f0b54a', hlA * 0.6);
    const LV = G.L();
    if (LV.highlights) for (const h of LV.highlights(run)) if (M.dist(ppos.x, ppos.y, h.x, h.y) < (h.d || 10)) ring(h.x, h.y, h.r || 0.8, h.col || '#f0b54a', h.a != null ? h.a : hlA * 0.8);
    if (!pl.inTruck && DH.Interact.primary && !DH.Interact.primary.disabled) { const ip = DH.Interact.primary; ring(ip.x, ip.y, 0.7, '#ffffff', 0.7); }
    if (!pl.inTruck && DH.Truck.distToHull(pl.x, pl.y) < 5) { const rp = DH.Truck.rearPoint(); ring(rp.x, rp.y, 0.9, 'rgba(240,181,74,0.8)', 0.35); }
    // noise rings (visual equivalent of sound)
    for (const r of FX.rings) { const k = 1 - r.t / r.max; ring(r.x, r.y, r.r * (0.2 + 0.8 * k), r.color, (1 - k) * 0.7); }
    // contact shadows
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    const shadow = (x, y, rx, ry) => { const p = PS(x, y, 0); ctx.beginPath(); ctx.ellipse(p[0], p[1], rx * HX * R.S, ry * HY * R.S, 0, 0, 7); ctx.fill(); };
    if (!pl.inTruck) shadow(pl.x, pl.y, 0.55, 0.55);
    for (const sv of run.survivors) if (!sv.boarded && !sv.hidden) shadow(sv.x, sv.y, 0.5, 0.5);
    for (const z of run.zombies) if (!z.dead && z.seenA > 0.02 && !z.attached) { ctx.globalAlpha = z.seenA; shadow(z.x, z.y, 0.55, 0.55); }
    ctx.globalAlpha = 1;
    { const t = run.truck; const c = Math.cos(t.ang), s = Math.sin(t.ang); ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); for (const [fw, rr] of [[3.0, 1.3], [3.0, -1.3], [-3.0, -1.3], [-3.0, 1.3]]) { const p = PS(t.x + c * fw - s * rr, t.y + s * fw + c * rr, 0); ctx.lineTo(p[0], p[1]); } ctx.closePath(); ctx.fill(); }

    mark('gdyn');
    // ---- collect drawables ----
    list.length = 0; order = 0;
    const pk = pl.inTruck ? run.truck.x + run.truck.y : pl.x + pl.y;
    const playerB = R.playerScreenBox(pl.inTruck ? run.truck.x : pl.x, pl.inTruck ? run.truck.y : pl.y);
    const inBld = pl.inTruck ? 0 : W.bld[W.idx(Math.floor(pl.x), Math.floor(pl.y))];
    const curB = inBld ? W.buildings[inBld - 1] : null;
    const insideB = curB && pl.x > curB.x1 + 0.2 && pl.x < curB.x2 + 0.8 && pl.y > curB.y1 + 0.2 && pl.y < curB.y2 + 0.8 ? curB : null;
    R.playerOccluded = false;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const i = W.idx(x, y);
      const m = W.wall[i];
      if (!m) continue;
      if (!vis(x + 0.5, y + 0.5, 1.5, 160)) continue;
      push({ t: 'wall', x, y, px: x + 0.5, py: y + 0.5, k: x + y + 1, pri: 1 });
    }
    W.doors.forEach((d, i) => {
      if (!vis(d.cx, d.cy, 1, 160)) return;
      const seg = d.orient === 'h' ? [d.x + 0.5, d.y + 0.5, d.x + d.w - 0.5, d.y + 0.5] : [d.x + 0.5, d.y + 0.5, d.x + 0.5, d.y + d.w - 0.5];
      push({ t: 'door', d, i, px: d.cx, py: d.cy, k: d.cx + d.cy, seg, pri: 1.5 });
    });
    for (const sg of W.signs) {
      const seg = sg.face === 'S' ? [sg.x, sg.y + 0.5, sg.x + sg.len, sg.y + 0.5] : [sg.x + 0.5, sg.y, sg.x + 0.5, sg.y + sg.len];
      push({ t: 'sign', sg, px: (seg[0] + seg[2]) / 2, py: (seg[1] + seg[3]) / 2, k: (seg[0] + seg[2]) / 2 + (seg[1] + seg[3]) / 2, seg, pri: 2 });
    }
    for (const b of W.buildings) {
      if (!vis((b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2, 3, 900)) continue;
      push({ t: 'roof', b, px: b.x2 + 1, py: b.y2 + 1, k: b.x2 + b.y2 + 2, pri: 3 });
    }
    const cans = W.canopies || (W.canopy ? [W.canopy] : []);
    cans.forEach((can, ci) => { if (vis((can.x1 + can.x2) / 2, (can.y1 + can.y2) / 2, 3, 600)) push({ t: 'canopy', b: can, ci, px: can.x2 + 1, py: can.y2 + 1, k: can.x2 + can.y2 + 2, pri: 3 }); });
    for (const p of W.props) {
      if (!vis(p.x, p.y, 1, 200)) continue;
      const long = p.shape === 'box' && p.hl > 1.1 && !p.segDef;
      const o = { t: 'prop', p, px: p.x, py: p.y, k: p.x + p.y + (p.kOff || 0), pri: p.pri || 0.5 };
      if (p.segDef) { o.seg = p.segDef; o.segBias = p.segBias || 0; o.segAlways = !!p.segAlways; }
      if (long) { const c = Math.cos(p.ang), s = Math.sin(p.ang); o.seg = [p.x - c * (p.hl - 0.3), p.y - s * (p.hl - 0.3), p.x + c * (p.hl - 0.3), p.y + s * (p.hl - 0.3)]; }
      push(o);
    }
    // shelf
    if (run.shelf && !run.shelf.broken) { const bx = W.dynBoxes[0]; if (bx) push({ t: 'shelf', b: bx, px: bx.x, py: bx.y, k: bx.x + bx.y, seg: [bx.x - bx.hl + 0.2, bx.y, bx.x + bx.hl - 0.2, bx.y], pri: 0.6 }); }
    // truck
    { const t = run.truck; const c = Math.cos(t.ang), s = Math.sin(t.ang); push({ t: 'truck', px: t.x, py: t.y, k: t.x + t.y, seg: [t.x - c * 2.2, t.y - s * 2.2, t.x + c * 2.2, t.y + s * 2.2], pri: 0.7 }); }
    // items
    for (const id in run.items) { const it = run.items[id]; if ((it.loc === 'world' || it.loc === 'hauled') && vis(it.x, it.y)) push({ t: 'item', it, px: it.x, py: it.y, k: it.x + it.y - 0.2, pri: 0.2 }); }
    for (const k of run.pickups) if (!k.taken && vis(k.x, k.y)) push({ t: 'pickup', kk: k, px: k.x, py: k.y, k: k.x + k.y - 0.25, pri: 0.2 });
    for (const n of run.noisemakers) push({ t: 'nm', n, px: n.x, py: n.y, k: n.x + n.y, pri: 0.3 });
    // characters
    if (!pl.inTruck) push({ t: 'player', px: pl.x, py: pl.y, k: pl.x + pl.y, pri: 0.9 });
    for (const sv of run.survivors) if (!sv.boarded && !sv.hidden && vis(sv.x, sv.y)) push({ t: 'survivor', sv, px: sv.x, py: sv.y, k: sv.x + sv.y - (sv.state === 'downed' ? 0.4 : 0), pri: 0.85 });
    for (const z of run.zombies) {
      if (z.seenA <= 0.01 || !vis(z.x, z.y)) continue;
      push({ t: z.dead ? 'corpse' : 'zombie', z, px: z.x, py: z.y, k: z.x + z.y - (z.dead ? 0.6 : 0), pri: z.dead ? 0.1 : 0.8 });
    }
    list.sort(cmp);
    mark('collect');

    // ---- draw sorted ----
    const S = R.S;
    const occl = (id, bx0, by0, bx1, by1, key, extraRect) => {
      const pb = extraRect || playerB;
      if (key <= pk + 0.05) return false;
      const ow = Math.min(bx1, pb[2]) - Math.max(bx0, pb[0]), oh = Math.min(by1, pb[3]) - Math.max(by0, pb[1]);
      return ow > (pb[2] - pb[0]) * 0.25 && oh > (pb[3] - pb[1]) * 0.3;
    };
    const near = insideB ? R.playerScreenBox(pl.x, pl.y, 3.2) : null;
    for (const d of list) {
      switch (d.t) {
        case 'wall': R.drawWall(ctx, d, dt, occl, near, insideB); break;
        case 'door': R.drawDoor(ctx, d, dt, occl, near, insideB); break;
        case 'sign': { const sg = d.sg; const e = signSprite(sg); const base = sg.face === 'S' ? PS(sg.x, sg.y + 1, sg.z + 0.55) : PS(sg.x + 1, sg.y, sg.z + 0.55); const a = R.alpha.get('w' + (Math.floor(d.px) + Math.floor(d.py) * 1000)); ctx.globalAlpha = a == null ? 1 : a; ctx.drawImage(e.c, base[0] - e.ox, base[1] - 2); ctx.globalAlpha = 1; break; }
        case 'roof': {
          const b = d.b; const big = (b.x2 - b.x1) * (b.y2 - b.y1) > 330; const e = big ? null : roofSprite(b, false);
          let target = 1;
          if (insideB === b) target = 0;
          else {
            const p1 = PS(b.x1, b.y1, 3), p2 = PS(b.x2 + 1, b.y2 + 1, 3), p3 = PS(b.x1, b.y2 + 1, 3), p4 = PS(b.x2 + 1, b.y1, 3);
            const bx0 = Math.min(p3[0], p1[0]), bx1 = Math.max(p4[0], p2[0]), by0 = p1[1], by1 = p2[1];
            if (pk < d.k - 0.5 && bx1 > playerB[0] && bx0 < playerB[2] && by1 > playerB[1] && by0 < playerB[3]) {
              // player is behind the building: only fade if actually overlapping the roof polygon area
              const pp = PS(ppos.x, ppos.y, 1);
              const w = DH.iso.toWorld(pp[0] / S, pp[1] / S, DH.MAT_INFO[b.mat].h);
              if (w.x > b.x1 - 0.5 && w.x < b.x2 + 1.5 && w.y > b.y1 - 0.5 && w.y < b.y2 + 1.5) { target = 0.3; R.playerOccluded = true; }
            }
          }
          const a = fade('r' + b.id, target, dt);
          if (a > 0.01) { ctx.globalAlpha = a; if (big) R.drawRoofDirect(ctx, b); else ctx.drawImage(e.c, -e.ox, -e.oy); ctx.globalAlpha = 1; }
          break;
        }
        case 'canopy': {
          const b = d.b; b.cid = b.cid || 'c' + d.ci; const e = roofSprite(b, true);
          const under = ppos.x > b.x1 - 0.5 && ppos.x < b.x2 + 1.5 && ppos.y > b.y1 - 0.5 && ppos.y < b.y2 + 1.5;
          let target = under ? 0.25 : 1;
          if (!under) { const pp = PS(ppos.x, ppos.y, 1); const w = DH.iso.toWorld(pp[0] / S, pp[1] / S, b.h); if (pk < d.k && w.x > b.x1 && w.x < b.x2 + 1 && w.y > b.y1 && w.y < b.y2 + 1) { target = 0.35; R.playerOccluded = true; } }
          const a = fade('canopy' + d.ci, target, dt);
          ctx.globalAlpha = a; ctx.drawImage(e.c, -e.ox, -e.oy); ctx.globalAlpha = 1;
          break;
        }
        case 'prop': R.drawProp(ctx, d, dt, occl); break;
        case 'shelf': { const b = d.b; const proj = (x, y, z) => PS(x, y, z); const st = run.shelf; SP.box(ctx, proj, b.x, b.y, 0, b.hl, b.hw, b.h, b.ang, st.hp < st.maxHp * 0.5 ? '#7a6e5e' : '#8e8676', { faceFn: (fc, a, bb, c, dd) => { ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5 * S; for (let k = 1; k < 4; k++) { const tt = k / 4; ctx.beginPath(); ctx.moveTo(a[0] + (dd[0] - a[0]) * tt, a[1] + (dd[1] - a[1]) * tt); ctx.lineTo(bb[0] + (c[0] - bb[0]) * tt, bb[1] + (c[1] - bb[1]) * tt); ctx.stroke(); } } }); break; }
        case 'truck': {
          const t = run.truck;
          const tl = DH.Cargo.list(run, 'truck');
          const cargo = tl.filter((i) => !DH.Cargo.heavy(i)).map((i) => i.kind);
          const heavy = tl.find((i) => DH.Cargo.heavy(i));
          const pas = DH.Survivor.passenger();
          const tk = d.k;
          const tb = R.truckScreenBox();
          let target = 1;
          if (!pl.inTruck && occl('truck', tb[0], tb[1], tb[2], tb[3], tk + 1.2)) { const l = DH.Truck.local(pl.x, pl.y); if (l.r < -1.0 || l.f < -2.6) { target = 0.45; R.playerOccluded = true; } }
          const a = fade('truck', target, dt) * (t.cineA != null ? t.cineA : 1);
          ctx.globalAlpha = a;
          SP.drawTruck(ctx, (x, y, z) => PS(x, y, z), t, S, { cargo, generator: !!heavy, heavy: heavy ? heavy.kind : null, passenger: !!pas, pfig: pas ? pas.fig : null, bumper: G.upg.bumper, winch: run.perks && run.perks.winch });
          ctx.globalAlpha = 1;
          if (t.hurtT > 0) { const p = PS(t.x, t.y, 1.5); ctx.fillStyle = 'rgba(255,80,60,' + t.hurtT + ')'; ctx.beginPath(); ctx.arc(p[0], p[1], 10 * S, 0, 7); ctx.fill(); }
          break;
        }
        case 'item': R.drawItem(ctx, d.it, tnow); break;
        case 'pickup': {
          const k = d.kk; const kind = k.kind === 'weapon' ? (k.crate ? 'crate' : 'weapon') : k.kind; const e = itemSprite(kind, k.wtype || k.atype);
          const p = PS(k.x, k.y, 0); ctx.drawImage(e.c, p[0] - e.ox, p[1] - e.oy);
          break;
        }
        case 'nm': {
          const n = d.n; let x = n.x, y = n.y, z = 0;
          if (!n.landed) { const tt = n.flight / n.flightDur; x = M.lerp(n.sx, n.x, tt); y = M.lerp(n.sy, n.y, tt); z = 1.2 + Math.sin(tt * Math.PI) * 1.6 - tt * 1.2; }
          const e = itemSprite('noisemaker'); const p = PS(x, y, z); ctx.drawImage(e.c, p[0] - e.ox, p[1] - e.oy);
          if (n.landed && (tnow * 2) % 1 < 0.5) { ctx.fillStyle = '#7fffd0'; ctx.beginPath(); ctx.arc(p[0], p[1] - 6 * S, 3 * S, 0, 7); ctx.fill(); }
          break;
        }
        case 'player': R.drawPlayer(ctx, pl); break;
        case 'survivor': R.drawSurvivor(ctx, d.sv); break;
        case 'zombie': R.drawZombie(ctx, d.z); break;
        case 'corpse': { const z = d.z; const e = SP.body(z.type === 'drifter' ? 'drifter' + (z.id.charCodeAt(1) % 3) : z.type, z.deathFace || z.face, false); const p = PS(z.x, z.y, 0); ctx.globalAlpha = Math.min(1, (30 - z.deathT) / 4) * z.seenA; ctx.drawImage(e.c, p[0] - e.ox, p[1] - e.oy); ctx.globalAlpha = 1; break; }
      }
    }
    mark('draw');
    // ---- occlusion outlines ----
    if (!pl.inTruck && R.playerOccluded) { R.drawPlayer(ctx, pl, 'rgba(140,220,255,0.95)'); }
    for (const z of run.zombies) {
      if (z.dead || !z.visible || z.attached) continue;
      if (R.occludedAt(z.x, z.y, insideB)) R.drawZombie(ctx, z, 'rgba(255,90,70,0.9)');
    }
    for (const sv of run.survivors) if (sv.recruited && !sv.boarded && R.occludedAt(sv.x, sv.y, insideB)) R.drawSurvivor(ctx, sv, 'rgba(120,240,160,0.9)');

    // ---- particles / tracers / flashes ----
    for (const tr of FX.tracers) {
      const a = PS(tr.x0, tr.y0, 1.25), b = PS(tr.x1, tr.y1, 1.25);
      ctx.strokeStyle = 'rgba(255,230,170,' + (tr.t / 0.07) * 0.8 + ')'; ctx.lineWidth = (tr.type === 'rifle' ? 2.2 : 1.4) * S;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    for (const p of FX.parts) {
      const q = PS(p.x, p.y, p.z); ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color;
      if (p.kind === 'dust') { ctx.beginPath(); ctx.arc(q[0], q[1], p.size * S * (1.5 - p.life / p.max), 0, 7); ctx.fill(); }
      else ctx.fillRect(q[0] - p.size * S / 2, q[1] - p.size * S / 2, p.size * S, p.size * S);
    }
    ctx.globalAlpha = 1;
    const reducedFlash = DH.Save.settings().reducedFlashes;
    for (const fl of FX.flashes) {
      const q = PS(fl.x, fl.y, 1.25);
      const sz = (fl.type === 'shotgun' || fl.type === 'rifle' ? 9 : 6) * S * (reducedFlash ? 0.6 : 1);
      ctx.fillStyle = reducedFlash ? 'rgba(255,220,150,0.6)' : 'rgba(255,236,180,0.95)';
      ctx.beginPath(); const dx = Math.cos(fl.ang), dy = Math.sin(fl.ang); const sdx = (dx - dy) * HX, sdy = (dx + dy) * HY; const l = Math.hypot(sdx, sdy) || 1;
      ctx.ellipse(q[0] + (sdx / l) * sz, q[1] + (sdy / l) * sz, sz * 1.2, sz * 0.55, Math.atan2(sdy, sdx), 0, 7); ctx.fill();
    }

    mark('outlines+fx0');
    // ---- lighting ----
    R.drawLighting(ctx, run, tnow);
    mark('light');

    R.drawWeather(ctx, run, tnow);
    // ---- after-light readability layer ----
    setT();
    R.drawTells(ctx, run, tnow);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    R.drawCues(ctx, run, tnow);
    mark('tells');
    R.frameMs = R.frameMs * 0.9 + (performance.now() - t0) * 0.1;
  };

  // ---------- Water: flood channels fill/drain smoothly; shimmer on open water ----------
  R.drawWater = (ctx, minX, minY, maxX, maxY, vis) => {
    const W = G.W, run = G.run, S = R.S;
    const t = performance.now() / 1000;
    const quad = (x1, y1, x2, y2, z) => { const a = PS(x1, y1, z), b = PS(x2, y1, z), c = PS(x2, y2, z), d = PS(x1, y2, z); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); };
    for (const g of W.gates) {
      if (g.kind !== 'flood') continue;
      const on = run.gates[g.id] && run.gates[g.id].on;
      let a = R.alpha.get('g' + g.id); if (a == null) a = on ? 1 : 0;
      a = M.approach(a, on ? 1 : 0, (1 / 60) * 0.45); R.alpha.set('g' + g.id, a);
      for (const r of g.rects) {
        if (r[2] < minX || r[0] > maxX || r[3] < minY || r[1] > maxY) continue;
        if (a > 0.01) { ctx.fillStyle = 'rgba(26,56,70,' + (0.72 * a).toFixed(3) + ')'; quad(r[0], r[1], r[2] + 1, r[3] + 1, 0.02); ctx.fill(); }
        // channel edge paint so players can see which area will change
        ctx.strokeStyle = on ? 'rgba(120,200,240,0.55)' : 'rgba(120,200,240,0.4)'; ctx.lineWidth = 2 * S; ctx.setLineDash([8 * S, 6 * S]);
        quad(r[0] + 0.1, r[1] + 0.1, r[2] + 0.9, r[3] + 0.9, 0.03); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    if (!W.hasWater) return;
    ctx.lineWidth = 1.4 * S;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const i = W.idx(x, y), f = W.floor[i];
      if (f !== F.WATER && f !== F.SEA && !W.deep[i]) continue;
      const h = SP.hash(x * 3 + 1, y * 7 + 2);
      if (h < 0.5) continue;
      const a = Math.pow(Math.max(0, Math.sin(t * 1.1 + h * 40)), 6) * (f === F.SEA ? 0.28 : 0.4);
      if (a < 0.03) continue;
      const yy = y + SP.hash(x, y) * 0.8 + 0.1;
      const p1 = PS(x + 0.15, yy, 0.03), p2 = PS(x + 0.75, yy, 0.03);
      ctx.strokeStyle = 'rgba(170,205,220,' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
    }
  };

  // Large roofs are drawn directly (a cached sprite would be tens of megabytes)
  R.drawRoofDirect = (ctx, b) => {
    const S = R.S, h = DH.MAT_INFO[b.mat].h;
    const x1 = b.x1, y1 = b.y1, x2 = b.x2 + 1, y2 = b.y2 + 1;
    const pts = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]].map(([x, y]) => PS(x, y, h));
    ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath();
    ctx.fillStyle = b.roof || '#3e3e3e'; ctx.fill();
    ctx.save(); ctx.clip();
    if (!R._roofPat) R._roofPat = ctx.createPattern(SP.noise(), 'repeat');
    const ga = ctx.globalAlpha; ctx.globalAlpha = ga * 0.45; ctx.fillStyle = R._roofPat;
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    ctx.fillRect(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    ctx.globalAlpha = ga;
    if (b.ribs) { ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1.2 * S; for (let x = x1 + 1; x < x2; x += 1.2) { const a = PS(x, y1, h), c = PS(x, y2, h); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); } }
    if (b.skylights) { ctx.fillStyle = 'rgba(150,175,190,0.32)'; for (let x = x1 + 3; x < x2 - 2; x += 6) { const a = PS(x, y1 + 2, h), bb = PS(x + 1.4, y1 + 2, h), c = PS(x + 1.4, y2 - 2, h), d = PS(x, y2 - 2, h); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(bb[0], bb[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill(); } }
    ctx.restore();
    ctx.strokeStyle = SP.shade(b.roof || '#3e3e3e', 0.25); ctx.lineWidth = 3 * S;
    ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.stroke();
    const r = DH.RNG(b.id * 31 + 5);
    const n = Math.max(1, Math.floor((x2 - x1) * (y2 - y1) / 140));
    const proj = (x, y, z) => PS(x, y, z);
    for (let k = 0; k < n; k++) {
      const ax = x1 + 2 + r.next() * (x2 - x1 - 4), ay = y1 + 2 + r.next() * (y2 - y1 - 4);
      SP.box(ctx, proj, ax, ay, h, 0.9, 0.6, 0.7, 0, '#8a8c88');
      const q = PS(ax, ay, h + 0.7); ctx.fillStyle = '#2c2c2c'; ctx.beginPath(); ctx.ellipse(q[0], q[1], 8 * S, 4 * S, 0, 0, 7); ctx.fill();
    }
  };

  // ---------- Weather (screen space, after lighting) ----------
  R.drawWeather = (ctx, run, tnow) => {
    const TH = G.W.theme, d = R.dpr;
    if (TH.rain) {
      const n = Math.round((R.cssW * R.cssH) / 9000 * (R.quality < 0.8 ? 0.5 : 1));
      ctx.strokeStyle = 'rgba(175,195,215,0.22)'; ctx.lineWidth = 1 * d;
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const sx = (SP.hash(k, 3) * R.cssW + tnow * 60) % R.cssW, sy = (SP.hash(7, k) * R.cssH + tnow * (520 + SP.hash(k, k) * 160)) % R.cssH;
        ctx.moveTo(sx * d, sy * d); ctx.lineTo((sx - 3) * d, (sy + 13) * d);
      }
      ctx.stroke();
    }
    if (TH.wind) {
      const n = Math.round((R.cssW * R.cssH) / 40000);
      ctx.strokeStyle = 'rgba(200,210,220,0.10)'; ctx.lineWidth = 1 * d;
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const sp = 300 + SP.hash(k, 5) * 300;
        const sx = (SP.hash(k, 9) * R.cssW * 1.3 + tnow * sp) % (R.cssW * 1.3) - R.cssW * 0.15, sy = SP.hash(3, k) * R.cssH + Math.sin(tnow + k) * 6;
        ctx.moveTo(sx * d, sy * d); ctx.lineTo((sx - 40 - SP.hash(k, 1) * 40) * d, (sy - 4) * d);
      }
      ctx.stroke();
    }
    if (TH.haze) { const g = ctx.createLinearGradient(0, 0, 0, R.Hb * 0.4); g.addColorStop(0, TH.haze); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, R.Wb, R.Hb * 0.4); }
  };

  // player screen box in S-space: [x0,y0,x1,y1]
  R.playerScreenBox = (x, y, grow) => {
    const p = PS(x, y, 0), S = R.S, g = grow || 0;
    return [p[0] - (0.5 + g) * 2 * HX * S * 0.5, p[1] - (1.9 + g * 0.6) * HZ * S, p[0] + (0.5 + g) * 2 * HX * S * 0.5, p[1] + (0.2 + g * 0.5) * HY * S];
  };
  R.truckScreenBox = () => { const t = G.run.truck; const p = PS(t.x, t.y, 0), S = R.S; return [p[0] - 3.2 * HX * S, p[1] - 2.6 * HZ * S, p[0] + 3.2 * HX * S, p[1] + 2.6 * HY * S]; };

  // Is a ground point visually covered by opaque scenery in front of it?
  R.occludedAt = (x, y, insideB) => {
    const W = G.W, run = G.run;
    const fx = Math.floor(x), fy = Math.floor(y);
    const cells = [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2], [3, 2], [2, 3]];
    for (const [dx, dy] of cells) {
      const tx = fx + dx, ty = fy + dy; if (!W.inB(tx, ty)) continue;
      const i = W.idx(tx, ty);
      const m = W.wall[i];
      if (m && DH.MAT_INFO[m].opaque && DH.MAT_INFO[m].h > 2) { const a = R.alpha.get('w' + (tx + ty * 1000)); if (a == null || a > 0.5) return true; }
      const b = W.bld[i];
      if (b && (!insideB || insideB.id !== b)) { const a = R.alpha.get('r' + b); if ((a == null || a > 0.5) && !(W.bld[W.idx(fx, fy)] === b)) return true; }
    }
    return false;
  };

  R.drawWall = (ctx, d, dt, occl, near, insideB) => {
    const W = G.W, S = R.S;
    const x = d.x, y = d.y, i = W.idx(x, y), m = W.wall[i];
    const bid = W.bld[i];
    const b = bid ? W.buildings[bid - 1] : null;
    const h = b && (m === 8 || DH.MAT_INFO[m].h >= 2.8) ? DH.MAT_INFO[b.mat].h : DH.MAT_INFO[m].h;
    const wallAt = (tx, ty) => W.inB(tx, ty) && W.wall[W.idx(tx, ty)] > 0;
    const showS = !wallAt(x, y + 1), showE = !wallAt(x + 1, y);
    const top = PS(x, y, h);
    const id = 'w' + (x + y * 1000);
    // fade if this wall occludes the player
    const bx0 = PS(x, y + 1, 0)[0], bx1 = PS(x + 1, y, 0)[0], by0 = top[1], by1 = PS(x + 1, y + 1, 0)[1];
    let target = 1;
    const cutable = DH.MAT_INFO[m].opaque && h > 2.4;
    if (DH.MAT_INFO[m].opaque && h > 1.6) {
      const pk = R.pk();
      if (occl(id, bx0, by0, bx1, by1, d.k)) { target = cutable ? 0 : 0.3; R.playerOccluded = R.playerOccluded || !cutable; }
      else if (near && insideB && bid === insideB.id && d.k > pk && x + 1.5 > G.run.player.x && y + 1.5 > G.run.player.y && bx1 > near[0] && bx0 < near[2] && by1 > near[1] && by0 < near[3]) target = cutable ? 0 : 0.35;
    }
    const a = fade(id, target, dt);
    const variant = Math.floor(SP.hash(x, y) * 3);
    const inside = (tx, ty) => bid && W.inB(tx, ty) && W.bld[W.idx(tx, ty)] === bid && !W.wall[W.idx(tx, ty)] && tx > b.x1 && tx < b.x2 && ty > b.y1 && ty < b.y2;
    const drawAt = (hh, alpha, cut) => {
      ctx.globalAlpha = alpha;
      if (showS) {
        const intr = inside(x, y + 1) ? 1 : 0;
        const e = SP.wallFace(m === 8 ? 8 : m, 'S', !cut && W.win[i] && !intr ? 1 : 0, intr || m === 8 ? 1 : 0, variant, hh);
        const p = PS(x, y + 1, hh);
        ctx.drawImage(e.c, p[0], p[1]);
      }
      if (showE) {
        const intr = inside(x + 1, y) ? 1 : 0;
        const e = SP.wallFace(m === 8 ? 8 : m, 'E', !cut && W.win[i] && !intr ? 1 : 0, intr || m === 8 ? 1 : 0, variant, hh);
        const p = PS(x + 1, y, hh);
        ctx.drawImage(e.c, p[0] - e.w, p[1]);
      }
      if (!DH.MAT_INFO[m].see) { const tp = PS(x, y, hh); const e = SP.wallTop(m === 8 && b ? b.mat : m, hh); ctx.drawImage(e.c, tp[0] - HX * S - 1, tp[1] - 1); }
    };
    // cutaway: a waist-high stub stays solid while the full wall fades out
    if (cutable && a < 0.999) drawAt(0.7, 1, true);
    if (a > 0.01) drawAt(h, a, false);
    ctx.globalAlpha = 1;
  };
  R.pk = () => { const run = G.run, p = run.player; return p.inTruck ? run.truck.x + run.truck.y : p.x + p.y; };

  R.drawDoor = (ctx, d, dt, occl, near, insideB) => {
    const run = G.run, W = G.W, S = R.S;
    const door = d.d, st = run.doors[d.i];
    const b = W.buildings.find((q) => q.key === door.bld);
    const h = b ? DH.MAT_INFO[b.mat].h : 3;
    const proj = (x, y, z) => PS(x, y, z);
    const id = 'door' + d.i;
    let target = 1;
    const p0 = PS(door.cx, door.cy, h);
    if (occl(id, p0[0] - door.w * HX * S, p0[1], p0[0] + door.w * HX * S, p0[1] + h * HZ * S + 20, d.k)) target = 0.3;
    else if (near && insideB && b === insideB && d.k > R.pk() && door.cx + 1 > G.run.player.x && door.cy + 1 > G.run.player.y) target = 0.4;
    const a = fade(id, target, dt);
    ctx.globalAlpha = a;
    const horiz = door.orient === 'h';
    const len = door.w;
    const cx = door.cx, cy = door.cy;
    const lh = horiz ? [len / 2, 0.5] : [0.5, len / 2];
    const lockMark = () => { if (!st.locked || st.open || st.broken) return; const q = PS(cx, cy, 1.25); ctx.fillStyle = '#1a1a1a'; ctx.fillRect(q[0] - 5 * S, q[1] - 3 * S, 10 * S, 8 * S); ctx.strokeStyle = '#d8b23a'; ctx.lineWidth = 1.6 * S; ctx.beginPath(); ctx.arc(q[0], q[1] - 3 * S, 3.4 * S, Math.PI, 0); ctx.stroke(); ctx.fillStyle = '#d8b23a'; ctx.fillRect(q[0] - 4 * S, q[1] - 2 * S, 8 * S, 6 * S); };
    if (door.gate) {
      // free-standing fence gate: no lintel
      const gh = door.gateH || 1.9, col = door.color || '#7a7f84';
      if (!st.broken) {
        if (!st.open) SP.box(ctx, proj, cx, cy, 0, horiz ? len / 2 : 0.05, horiz ? 0.05 : len / 2, gh, 0, col, { faceFn: (f, p1, p2, p3, p4) => { ctx.strokeStyle = 'rgba(20,20,20,0.5)'; ctx.lineWidth = 1 * S; for (let k = 1; k < 6; k++) { const tt = k / 6; ctx.beginPath(); ctx.moveTo(p1[0] + (p2[0] - p1[0]) * tt, p1[1] + (p2[1] - p1[1]) * tt); ctx.lineTo(p4[0] + (p3[0] - p4[0]) * tt, p4[1] + (p3[1] - p4[1]) * tt); ctx.stroke(); } } });
        else if (horiz) SP.box(ctx, proj, door.x + 0.1, cy + 0.5 * (len - 0.2), 0, 0.05, len / 2 * 0.9, gh, 0, col);
        else SP.box(ctx, proj, cx + 0.5 * (len - 0.2), door.y + 0.1, 0, len / 2 * 0.9, 0.05, gh, 0, col);
      }
      lockMark();
      ctx.globalAlpha = 1;
      return;
    }
    if (door.shutter) {
      const sh = Math.min(h - 0.2, 3.0);
      SP.box(ctx, proj, cx, cy, sh, lh[0], lh[1], h - sh, 0, SP.MATCOL[b ? b.mat : 3] || '#777', { top: SP.shade(SP.MATCOL[b ? b.mat : 3] || '#777', -0.2) });
      if (!st.broken) {
        if (!st.open) SP.box(ctx, proj, cx, cy, 0, horiz ? len / 2 : 0.07, horiz ? 0.07 : len / 2, sh, 0, '#8b9196', { faceFn: (f, p1, p2, p3, p4) => { ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.2 * S; for (let k = 1; k < 12; k++) { const tt = k / 12; ctx.beginPath(); ctx.moveTo(p1[0] + (p4[0] - p1[0]) * tt, p1[1] + (p4[1] - p1[1]) * tt); ctx.lineTo(p2[0] + (p3[0] - p2[0]) * tt, p2[1] + (p3[1] - p2[1]) * tt); ctx.stroke(); } ctx.fillStyle = 'rgba(230,190,40,0.8)'; ctx.fillRect((p1[0] + p2[0]) / 2 - 6 * S, (p1[1] + p2[1]) / 2 - 3 * S, 12 * S, 2 * S); } });
        else SP.box(ctx, proj, cx, cy, sh - 0.45, horiz ? len / 2 : 0.22, horiz ? 0.22 : len / 2, 0.45, 0, '#6d7378');
      }
      lockMark();
      ctx.globalAlpha = 1;
      return;
    }
    // lintel
    SP.box(ctx, proj, cx, cy, 2.35, lh[0], lh[1], h - 2.35, 0, SP.MATCOL[b ? b.mat : 3] || '#777', { top: SP.shade(SP.MATCOL[b ? b.mat : 3] || '#777', -0.2) });
    if (!st.broken) {
      const col = door.color || (door.label.indexOf('Loading') >= 0 ? '#5b6670' : door.label.indexOf('Front') >= 0 && door.bld !== 'pharmacy' ? '#6a5038' : '#4d5660');
      const dmg = 1 - st.hp / door.maxHp;
      if (!st.open) {
        SP.box(ctx, proj, cx, cy, 0, horiz ? len / 2 : 0.08, horiz ? 0.08 : len / 2, 2.32, 0, col, { faceFn: (f, p1, p2, p3, p4) => {
          ctx.fillStyle = 'rgba(160,190,200,0.25)'; ctx.fillRect((p1[0] + p3[0]) / 2 - 4 * S, (p1[1] + p3[1]) / 2 - 12 * S, 8 * S, 9 * S);
          if (dmg > 0.2) { ctx.strokeStyle = 'rgba(20,10,5,0.8)'; ctx.lineWidth = 1.5 * S; ctx.beginPath(); ctx.moveTo(p1[0] * 0.6 + p3[0] * 0.4, p1[1] * 0.6 + p3[1] * 0.4); ctx.lineTo(p1[0] * 0.4 + p3[0] * 0.6 + 4, p1[1] * 0.45 + p3[1] * 0.55); if (dmg > 0.6) ctx.lineTo(p2[0] * 0.5 + p4[0] * 0.5, p2[1] * 0.5 + p4[1] * 0.5); ctx.stroke(); }
        } });
      } else {
        // swung open: panel perpendicular, hinged at the first cell, opening toward the interior (+y / +x side)
        const inSign = b ? (horiz ? (cy < (b.y1 + b.y2) / 2 ? 1 : -1) : (cx < (b.x1 + b.x2) / 2 ? 1 : -1)) : 1;
        if (horiz) SP.box(ctx, proj, door.x + 0.1, cy + inSign * (len / 2 - 0.1) * 0.9, 0, 0.06, len / 2 * 0.85, 2.3, 0, col);
        else SP.box(ctx, proj, cx + inSign * (len / 2 - 0.1) * 0.9, door.y + 0.1, 0, len / 2 * 0.85, 0.06, 2.3, 0, col);
      }
    }
    lockMark();
    ctx.globalAlpha = 1;
  };

  R.drawProp = (ctx, d, dt, occl) => {
    const p = d.p, S = R.S;
    if (p.direct) { R.drawDirect(ctx, d, dt, occl); return; }
    if (p.type === 'strips') { R.drawStrips(ctx, p); return; }
    let e;
    if (p.type === 'tree') e = SP.tree(p.seed || 1); else e = propSprite(p);
    const base = PS(p.x, p.y, 0);
    let target = 1;
    const tall = (p.h || 1) > 1.7 || p.type === 'tree';
    if (tall) {
      const bx0 = base[0] - e.ox, by0 = base[1] - e.oy, bx1 = bx0 + e.c.width, by1 = by0 + e.c.height;
      const pp0 = DH.Player.pos(); const k = d.seg ? (() => { const q = M.closestOnSeg(pp0.x, pp0.y, d.seg[0], d.seg[1], d.seg[2], d.seg[3]); return q.x + q.y; })() : d.k;
      if (p.shape === 'box' && p.hl > 1.5) {
        // long boxes (trailers, racks): test the player's torso against the box's projected outline, not its sprite bounds
        if (k > R.pk() + 0.05 && R.boxCovers(p, pp0.x, pp0.y)) { target = 0.4; R.playerOccluded = true; }
      } else if (occl('p' + p.id, bx0 + e.c.width * 0.2, by0, bx1 - e.c.width * 0.2, by1 - 10, k)) { target = p.type === 'tree' ? 0.35 : 0.4; R.playerOccluded = true; }
    }
    const a = fade('p' + p.id, target, dt);
    ctx.globalAlpha = a;
    ctx.drawImage(e.c, base[0] - e.ox, base[1] - e.oy);
    ctx.globalAlpha = 1;
    if (p.type === 'car' && p.alarm && G.run.alarm.active > 0 && (performance.now() / 250) % 2 < 1) { const q = PS(p.x, p.y, 1.0); ctx.fillStyle = 'rgba(255,190,80,0.9)'; ctx.beginPath(); ctx.arc(q[0] - 14 * S, q[1], 4 * S, 0, 7); ctx.arc(q[0] + 14 * S, q[1], 4 * S, 0, 7); ctx.fill(); }
  };

  // translucent plastic strip curtain across a doorway
  R.drawStrips = (ctx, p) => {
    const S = R.S, h = p.h || 2.6, n = Math.round(p.len / 0.32);
    const horiz = p.orient === 'h';
    ctx.fillStyle = 'rgba(205,225,235,0.28)'; ctx.strokeStyle = 'rgba(230,245,255,0.35)'; ctx.lineWidth = 1 * S;
    for (let k = 0; k < n; k++) {
      const u = p.x0 + (k + 0.1) * (p.len / n), u2 = p.x0 + (k + 0.9) * (p.len / n);
      const sway = Math.sin(performance.now() / 700 + k) * 0.03;
      const a = horiz ? PS(u, p.y0, h) : PS(p.y0, u, h), b = horiz ? PS(u2, p.y0, h) : PS(p.y0, u2, h);
      const c = horiz ? PS(u2 + sway, p.y0, 0.05) : PS(p.y0, u2 + sway, 0.05), d = horiz ? PS(u + sway, p.y0, 0.05) : PS(p.y0, u + sway, 0.05);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  };
  // Very large or animated structures drawn every frame (no giant cached sprites)
  R.drawDirect = (ctx, d, dt, occl) => {
    const p = d.p, S = R.S, run = G.run;
    const proj = (x, y, z) => PS(x, y, z);
    const base = PS(p.x, p.y, 0), top = PS(p.x, p.y, p.h || 4);
    let target = 1;
    const ext = (p.sprR || 3) * HX * S;
    const pp0 = DH.Player.pos(); const k = d.seg ? (() => { const q = M.closestOnSeg(pp0.x, pp0.y, d.seg[0], d.seg[1], d.seg[2], d.seg[3]); return q.x + q.y; })() : d.k;
    if (p.fade !== false && occl('p' + p.id, base[0] - ext * 0.6, top[1], base[0] + ext * 0.6, base[1], k + (p.kOff || 0))) { target = 0.3; R.playerOccluded = true; }
    const a = fade('p' + p.id, target, dt);
    ctx.globalAlpha = a;
    if (p.type === 'tower') {
      const H = p.h, bw = p.bw || 1.6;
      const leg = (sx, sy) => { const b0 = PS(p.x + sx * bw, p.y + sy * bw, 0), t0 = PS(p.x + sx * 0.3, p.y + sy * 0.3, H); return [b0, t0]; };
      const legs = [leg(-1, -1), leg(1, -1), leg(1, 1), leg(-1, 1)];
      ctx.strokeStyle = '#2b2f33'; ctx.lineWidth = 3 * S;
      for (const [b0, t0] of legs) { ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(t0[0], t0[1]); ctx.stroke(); }
      ctx.lineWidth = 1.3 * S; ctx.strokeStyle = 'rgba(70,76,82,0.95)';
      const lerp = (q0, q1, tt) => [q0[0] + (q1[0] - q0[0]) * tt, q0[1] + (q1[1] - q0[1]) * tt];
      for (let s2 = 0; s2 < 10; s2++) {
        const t1 = s2 / 10, t2 = (s2 + 1) / 10;
        for (let li = 0; li < 4; li++) { const A = legs[li], B2 = legs[(li + 1) % 4]; const p1 = lerp(A[0], A[1], t1), p2 = lerp(B2[0], B2[1], t2), p3 = lerp(A[0], A[1], t2), p4 = lerp(B2[0], B2[1], t1); ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.moveTo(p4[0], p4[1]); ctx.lineTo(p3[0], p3[1]); ctx.stroke(); }
      }
      for (const tt of [0.35, 0.7]) { const z = H * tt, w = bw - (bw - 0.3) * tt + 0.4; SP.box(ctx, proj, p.x, p.y, z, w, w, 0.12, 0, '#3a3f44'); }
      const tp = PS(p.x, p.y, H); ctx.strokeStyle = '#2b2f33'; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.moveTo(tp[0], tp[1]); ctx.lineTo(tp[0], tp[1] - 3 * HZ * S); ctx.stroke();
      for (const [dx, dy, z] of [[0.6, 0, H * 0.8], [-0.5, 0.4, H * 0.62]]) { const q = PS(p.x + dx, p.y + dy, z); ctx.fillStyle = '#b9bec2'; ctx.beginPath(); ctx.ellipse(q[0], q[1], 7 * S, 9 * S, 0.3, 0, 7); ctx.fill(); }
      const on = (performance.now() / 900) % 1 < 0.5;
      const bq = PS(p.x, p.y, H + 3); ctx.fillStyle = on ? '#ff3b2b' : '#5a1510'; ctx.beginPath(); ctx.arc(bq[0], bq[1], 3.5 * S, 0, 7); ctx.fill();
    } else if (p.type === 'ferry') {
      // hull along y with the bow door facing +y (the quay)
      const hw = p.hl, hl = p.hw; // hull: hw across (x), hl along (y)
      SP.box(ctx, proj, p.x, p.y, -0.6, hw, hl, 3.4, 0, '#7a2822', { top: '#4a4a48', faceFn: (f, p1, p2, p3, p4) => { ctx.fillStyle = 'rgba(235,235,230,0.92)'; ctx.beginPath(); ctx.moveTo(p4[0], p4[1]); ctx.lineTo(p3[0], p3[1]); ctx.lineTo(p3[0] + (p2[0] - p3[0]) * 0.32, p3[1] + (p2[1] - p3[1]) * 0.32); ctx.lineTo(p4[0] + (p1[0] - p4[0]) * 0.32, p4[1] + (p1[1] - p4[1]) * 0.32); ctx.fill(); } });
      // bow door opening (dark when open)
      const open = run && run.flags.rampDown;
      const bA = PS(p.x - hw * 0.55, p.y + hl + 0.02, 0.2), bB = PS(p.x + hw * 0.55, p.y + hl + 0.02, 0.2), bC = PS(p.x + hw * 0.55, p.y + hl + 0.02, 2.6), bD = PS(p.x - hw * 0.55, p.y + hl + 0.02, 2.6);
      ctx.fillStyle = open ? '#0c0f12' : '#5d2620'; ctx.beginPath(); ctx.moveTo(bA[0], bA[1]); ctx.lineTo(bB[0], bB[1]); ctx.lineTo(bC[0], bC[1]); ctx.lineTo(bD[0], bD[1]); ctx.closePath(); ctx.fill();
      if (open) { ctx.fillStyle = 'rgba(255,220,150,0.25)'; ctx.fill(); }
      // superstructure toward the stern
      SP.box(ctx, proj, p.x, p.y - hl * 0.45, 2.8, hw * 0.8, hl * 0.4, 3.2, 0, '#e2e0d8', { top: '#c9c6bc', faceFn: (f, p1, p2, p3, p4) => { ctx.fillStyle = 'rgba(30,45,60,0.9)'; const n = 6; for (let k2 = 0; k2 < n; k2++) { const tt = (k2 + 0.3) / n; ctx.fillRect(p1[0] + (p2[0] - p1[0]) * tt - 2 * S, p1[1] + (p2[1] - p1[1]) * tt - (p1[1] - p4[1]) * 0.7, 5 * S, 4 * S); } } });
      SP.box(ctx, proj, p.x, p.y - hl * 0.55, 6.0, 0.7, 0.9, 1.8, 0, '#2c2c2c', { top: '#c0392b' });
      const lt = PS(p.x, p.y - hl * 0.5, 6.4); ctx.fillStyle = (performance.now() / 1200) % 1 < 0.5 ? '#7fe3a0' : '#2b5a3a'; ctx.beginPath(); ctx.arc(lt[0], lt[1], 3 * S, 0, 7); ctx.fill();
      SP.box(ctx, proj, p.x, p.y + hl * 0.2, 2.8, hw * 0.98, hl * 0.62, 0.15, 0, '#6b6b66');
    } else if (p.type === 'ramp') {
      const down = run && run.flags.rampDown;
      const z1 = down ? 0.05 : 0.05, z2 = down ? 0.25 : 2.6;
      const hw = p.hw, y1 = p.y + p.hl, y2 = p.y - p.hl;
      const A = PS(p.x - hw, y1, z1), B2 = PS(p.x + hw, y1, z1), C = PS(p.x + hw, y2, z2), D = PS(p.x - hw, y2, z2);
      ctx.fillStyle = '#5a5e60'; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B2[0], B2[1]); ctx.lineTo(C[0], C[1]); ctx.lineTo(D[0], D[1]); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#d8b23a'; ctx.lineWidth = 2.5 * S; ctx.setLineDash([6 * S, 6 * S]); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(D[0], D[1]); ctx.moveTo(B2[0], B2[1]); ctx.lineTo(C[0], C[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1 * S; for (let k2 = 1; k2 < 8; k2++) { const tt = k2 / 8; ctx.beginPath(); ctx.moveTo(A[0] + (D[0] - A[0]) * tt, A[1] + (D[1] - A[1]) * tt); ctx.lineTo(B2[0] + (C[0] - B2[0]) * tt, B2[1] + (C[1] - B2[1]) * tt); ctx.stroke(); }
    } else if (p.type === 'gantry') {
      const H = p.h, hl = p.hl, hw = p.hw, a0 = p.ang || 0, c = Math.cos(a0), sn = Math.sin(a0);
      const L = (f, r) => [p.x + f * c - r * sn, p.y + f * sn + r * c];
      for (const f of [-hl, hl]) for (const r of [-hw, hw]) { const q = L(f, r); SP.box(ctx, proj, q[0], q[1], 0, 0.35, 0.35, H, a0, '#c48a1e', { top: '#d8a21c' }); }
      for (const r of [-hw, hw]) { const q = L(0, r); SP.box(ctx, proj, q[0], q[1], H, hl + 0.4, 0.4, 0.8, a0, '#d8a21c'); }
      for (const f of [-hl, hl]) { const q = L(f, 0); SP.box(ctx, proj, q[0], q[1], H - 0.2, 0.4, hw + 0.4, 0.6, a0, '#b37d1a'); }
      const sp = L(p.trolley || 0, 0); SP.box(ctx, proj, sp[0], sp[1], H - 1.4, 1.0, 1.2, 1.2, a0, '#3a3a3a');
      const q0 = PS(sp[0], sp[1], H - 1.4), q1 = PS(sp[0], sp[1], 3.4); ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 1.5 * S; ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  // does the projected solid of box prop p cover the screen point of a character standing at (x,y)?
  R.boxCovers = (p, x, y) => {
    const c = Math.cos(p.ang || 0), sn = Math.sin(p.ang || 0), h = p.h || 1;
    const pts = [];
    for (const [f, r] of [[p.hl, p.hw], [p.hl, -p.hw], [-p.hl, -p.hw], [-p.hl, p.hw]]) { const wx = p.x + f * c - r * sn, wy = p.y + f * sn + r * c; pts.push(PS(wx, wy, 0), PS(wx, wy, h)); }
    // convex hull (gift wrap) of the 8 projected corners
    let start = pts.reduce((a, b) => (b[0] < a[0] ? b : a));
    const hull = []; let cur = start;
    for (let guard = 0; guard < 10; guard++) {
      hull.push(cur); let nxt = pts[0];
      for (const q of pts) { if (nxt === cur) { nxt = q; continue; } const cr = (nxt[0] - cur[0]) * (q[1] - cur[1]) - (nxt[1] - cur[1]) * (q[0] - cur[0]); if (cr < 0) nxt = q; }
      cur = nxt; if (cur === start) break;
    }
    const tp = PS(x, y, 0.9);
    let pos = 0, neg = 0;
    for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; const cr = (b[0] - a[0]) * (tp[1] - a[1]) - (b[1] - a[1]) * (tp[0] - a[0]); if (cr > 0) pos++; else if (cr < 0) neg++; }
    return hull.length >= 3 && (pos === 0 || neg === 0);
  };
  R.drawItem = (ctx, it, tnow) => {
    const S = R.S;
    const e = itemSprite(it.kind);
    const p = PS(it.x, it.y, 0);
    if (DH.Cargo.heavy(it)) {
      ctx.drawImage(e.c, p[0] - e.ox, p[1] - e.oy);
    } else {
      const bob = DH.ITEMS[it.kind] && DH.ITEMS[it.kind].primary && it.kind !== 'medstock' ? Math.sin(tnow * 3) * 2 * S : 0;
      ctx.drawImage(e.c, p[0] - e.ox, p[1] - e.oy - bob);
    }
  };

  const weaponPose = (w) => (!w ? 'default' : w.type === 'pistol' ? 'aim_pistol' : 'aim_long');
  R.drawPlayer = (ctx, pl, tint) => {
    const w = DH.Player.weapon();
    let pose = weaponPose(w), weapon = w ? w.type : null, swing = null;
    if (pl.hauling) { pose = 'haul'; weapon = null; }
    if (pl.meleeT > 0) { pose = 'swing'; weapon = 'crowbar'; swing = M.clamp(1 - pl.meleeT / 0.3, 0, 1); }
    if (pl.action && pl.action.kind !== 'loadGen') { pose = 'cower'; weapon = null; }
    if (pl.reload > 0 && pose !== 'swing') pose = 'cower';
    const e = SP.figure('player', pl.face, pose, pl.walkPhase, pl.moving, weapon, swing);
    const p = PS(pl.x, pl.y, 0);
    if (tint) { ctx.globalAlpha = 1; ctx.drawImage(SP.outline(e, tint), p[0] - e.ox, p[1] - e.oy); return; }
    if (pl.iframes > 0 && Math.floor(pl.iframes * 20) % 2 === 0) ctx.globalAlpha = 0.55;
    ctx.drawImage(e.c, p[0] - e.ox, p[1] - e.oy);
    ctx.globalAlpha = 1;
    if (pl.hurtT > 0) { ctx.globalAlpha = pl.hurtT * 1.6; ctx.drawImage(SP.silhouette(e, '#ff5a46'), p[0] - e.ox, p[1] - e.oy); ctx.globalAlpha = 1; }
  };
  R.drawSurvivor = (ctx, s, tint) => {
    const p = PS(s.x, s.y, 0);
    if (s.state === 'downed') { const e = SP.body('survivor', s.face, true); if (!tint) ctx.drawImage(e.c, p[0] - e.ox, p[1] - e.oy); return; }
    const pose = !s.recruited ? 'cower' : 'default';
    const moving = s.recruited && s.walkPhase !== s._lw; s._lw = s.walkPhase;
    const e = SP.figure('survivor', s.face, pose, s.walkPhase, moving, null, null);
    if (tint) { ctx.drawImage(SP.outline(e, tint), p[0] - e.ox, p[1] - e.oy); return; }
    ctx.drawImage(e.c, p[0] - e.ox, p[1] - e.oy);
    if (s.hurtT > 0) { ctx.globalAlpha = s.hurtT * 1.6; ctx.drawImage(SP.silhouette(e, '#ff5a46'), p[0] - e.ox, p[1] - e.oy); ctx.globalAlpha = 1; }
  };
  const ZPOSE = { idle: 'default', investigate: 'default', search: 'default', chase: 'reach', lurk: 'reach', windup: 'windup', lunge: 'lunge', recover: 'reach', stagger: 'stagger', howl: 'howl', leap: 'leap', attached: 'cling', batter: 'windup' };
  R.drawZombie = (ctx, z, tint) => {
    const kind = z.type === 'drifter' ? 'drifter' + (z.id.charCodeAt(1) % 3) : z.type;
    let pose = ZPOSE[z.state] || 'default';
    if (z.state === 'batter' && z.t > 0.65) pose = 'reach';
    const moving = z.walkPhase !== z._lw; z._lw = z.walkPhase;
    const e = SP.figure(kind, z.face, pose, z.walkPhase, moving || z.state === 'lunge', null, null);
    const p = PS(z.x, z.y, z.attached ? 0.35 : 0);
    if (tint) { ctx.globalAlpha = 0.95 * z.seenA; ctx.drawImage(SP.outline(e, tint), p[0] - e.ox, p[1] - e.oy); ctx.globalAlpha = 1; return; }
    ctx.globalAlpha = z.seenA;
    ctx.drawImage(e.c, p[0] - e.ox, p[1] - e.oy);
    if (z.flash > 0) { ctx.globalAlpha = z.flash * 6 * z.seenA; ctx.drawImage(SP.silhouette(e, '#fff2e0'), p[0] - e.ox, p[1] - e.oy); }
    ctx.globalAlpha = 1;
  };

  // ---------- Lighting ----------
  R.drawLighting = (ctx, run, tnow) => {
    const l = R.lctx, lw = R.light.width, lh = R.light.height, W = G.W;
    const sc = 0.5; // light canvas scale vs backing
    const toL = (x, y, z) => { const p = PS(x, y, z || 0); return [(R.f * (p[0] - R.camSX) + R.Wb / 2 + R.shx) * sc, (R.f * (p[1] - R.camSY) + R.Hb / 2 + R.shy) * sc]; };
    const mPx = R.f * R.S * HX * 1.414 * sc; // px per meter (x) in light canvas
    l.globalCompositeOperation = 'source-over';
    const TH = W.theme;
    l.fillStyle = TH.dark;
    l.clearRect(0, 0, lw, lh);
    l.fillRect(0, 0, lw, lh);
    // unlit interiors are darker still
    if (W.darkRects.length) {
      l.fillStyle = 'rgba(0,0,4,0.55)';
      for (const r of W.darkRects) {
        const a = toL(r.x1, r.y1), b = toL(r.x2, r.y1), c = toL(r.x2, r.y2), d = toL(r.x1, r.y2);
        if (Math.max(a[0], b[0], c[0], d[0]) < 0 || Math.min(a[0], b[0], c[0], d[0]) > lw || Math.max(a[1], b[1], c[1], d[1]) < 0 || Math.min(a[1], b[1], c[1], d[1]) > lh) continue;
        l.beginPath(); l.moveTo(a[0], a[1]); l.lineTo(b[0], b[1]); l.lineTo(c[0], c[1]); l.lineTo(d[0], d[1]); l.closePath(); l.fill();
      }
    }
    l.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a, z) => {
      const p = toL(x, y, z || 0); const rx = r * mPx;
      if (p[0] < -rx || p[1] < -rx || p[0] > lw + rx || p[1] > lh + rx) return;
      l.save(); l.translate(p[0], p[1]); l.scale(1, 0.5);
      const g = l.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(0.55, 'rgba(0,0,0,' + a * 0.6 + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g; l.beginPath(); l.arc(0, 0, rx, 0, 7); l.fill(); l.restore();
    };
    const p = run.player, pp = DH.Player.pos();
    const inDark = !p.inTruck && W.dark[W.idx(Math.floor(pp.x), Math.floor(pp.y))];
    hole(pp.x, pp.y, p.inTruck ? 9 : inDark ? 4.2 : TH.lightR, 0.95);
    // flashlight cone (always on; it matters in unlit interiors)
    if (!p.inTruck && (inDark || TH.flashlight)) {
      const a0 = toL(pp.x, pp.y), L = inDark ? 12 : 9;
      const q1 = toL(pp.x + Math.cos(p.aim - 0.42) * L, pp.y + Math.sin(p.aim - 0.42) * L), q2 = toL(pp.x + Math.cos(p.aim + 0.42) * L, pp.y + Math.sin(p.aim + 0.42) * L);
      const g = l.createRadialGradient(a0[0], a0[1], 0, a0[0], a0[1], L * mPx * 0.85);
      g.addColorStop(0, 'rgba(0,0,0,' + (inDark ? 0.92 : 0.6) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g; l.beginPath(); l.moveTo(a0[0], a0[1]); l.lineTo(q1[0], q1[1]); l.lineTo(q2[0], q2[1]); l.closePath(); l.fill();
    }
    const lampOn = (lp) => !lp.power || run.flags[lp.power];
    W.lamps.forEach((lp, i) => { if (!lampOn(lp)) return; const fl = SP.hash(i, 7) > 0.85 ? (Math.sin(tnow * 13 + i) > 0.3 ? 1 : 0.3) : 1; if (!lp.power && SP.hash(i, 3) > 0.93) return; hole(lp.x + 0.7, lp.y + 0.7, lp.r, 0.85 * fl); });
    // headlights
    const t = run.truck;
    if (t.engine) {
      const c = Math.cos(t.ang), s = Math.sin(t.ang);
      const fx = t.x + c * 2.9, fy = t.y + s * 2.9;
      const a0 = toL(fx, fy);
      const L = 15;
      const q1 = toL(fx + Math.cos(t.ang - 0.38) * L, fy + Math.sin(t.ang - 0.38) * L), q2 = toL(fx + Math.cos(t.ang + 0.38) * L, fy + Math.sin(t.ang + 0.38) * L);
      const g = l.createRadialGradient(a0[0], a0[1], 0, a0[0], a0[1], L * mPx * 0.9);
      g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g; l.beginPath(); l.moveTo(a0[0], a0[1]); l.lineTo(q1[0], q1[1]); l.lineTo(q2[0], q2[1]); l.closePath(); l.fill();
    }
    for (const fl of DH.FX.flashes) hole(fl.x, fl.y, 5, 0.9);
    if (W.alarmCar && run.alarm.active > 0 && (tnow * 4) % 2 < 1) hole(W.alarmCar.x, W.alarmCar.y, 6, 0.8);
    for (const n of run.noisemakers) if (n.landed) hole(n.x, n.y, 2.2, 0.6);
    const roofHides = (gw) => { if (gw.inside == null) { const b = W.bld[W.idx(Math.floor(gw.x), Math.floor(gw.y))]; gw.inside = b || 0; } if (!gw.inside) return false; const a = R.alpha.get('r' + gw.inside); return a == null || a > 0.6; };
    const glowOn = (gw) => (!gw.power || run.flags[gw.power]) && (!gw.off || !run.flags[gw.off]) && (!gw.emitter || (G.emitter(run, gw.emitter) || {}).on) && !roofHides(gw);
    const blink = (gw) => !gw.blink || ((tnow * gw.blink + (gw.ph || 0)) % 1) < 0.5;
    for (const gw of W.glows) if (gw.hole && glowOn(gw) && blink(gw)) hole(gw.hole.x, gw.hole.y, gw.hole.r, gw.hole.a, gw.hole.z);
    for (const z of W.exits) if ((z.kind === 'truck' || z.kind === 'ferry') && G.exitOpen(z)) hole((z.x1 + z.x2) / 2, (z.y1 + z.y2) / 2, 5, 0.5);
    for (const e of run.emitters) if (e.on && e.light !== false) hole(e.x, e.y, 3.5, (tnow * 2) % 1 < 0.5 ? 0.75 : 0.35);
    // warm tints (drawn into the half-res light layer instead of full-res additive passes)
    l.globalCompositeOperation = 'source-over';
    const glow = (x, y, r, col, a, z) => {
      const q = toL(x, y, z || 0); const rx = r * mPx;
      if (q[0] < -rx || q[1] < -rx || q[0] > lw + rx || q[1] > lh + rx) return;
      l.save(); l.translate(q[0], q[1]); l.scale(1, 0.5);
      const g = l.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0));
      l.fillStyle = g; l.beginPath(); l.arc(0, 0, rx, 0, 7); l.fill(); l.restore();
    };
    W.lamps.forEach((lp, i) => { if (!lampOn(lp) || (!lp.power && SP.hash(i, 3) > 0.93)) return; const fl = SP.hash(i, 7) > 0.85 ? (Math.sin(tnow * 13 + i) > 0.3 ? 1 : 0.3) : 1; glow(lp.x + 0.7, lp.y + 0.7, 6, lp.col || TH.lamp, 0.13 * fl); });
    const rf = DH.Save.settings().reducedFlashes;
    for (const fl of DH.FX.flashes) glow(fl.x, fl.y, 4, 'rgba(255,214,150,A)', rf ? 0.08 : 0.2);
    if (W.alarmCar && run.alarm.active > 0) glow(W.alarmCar.x, W.alarmCar.y, 5, 'rgba(255,140,40,A)', (tnow * 4) % 2 < 1 ? 0.2 : 0.04);
    for (const gw of W.glows) { if (!glowOn(gw)) continue; const on = blink(gw); const a = gw.a * (gw.pulse ? 1 + Math.sin(tnow * gw.pulse) * 0.25 : 1) * (on ? 1 : 0.15) * (rf && gw.blink ? 0.5 : 1); glow(gw.x, gw.y, gw.r, gw.col, a, gw.z); }
    for (const e of run.emitters) if (e.on && e.light !== false) glow(e.x, e.y, 4, e.glow || 'rgba(255,170,50,A)', (tnow * 2) % 1 < 0.5 ? (rf ? 0.1 : 0.22) : 0.05);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(R.light, 0, 0, R.Wb, R.Hb);
    ctx.globalCompositeOperation = 'source-over';
  };

  // ---------- Attack tells & readability ----------
  R.drawTells = (ctx, run, tnow) => {
    const S = R.S;
    for (const z of run.zombies) {
      if (z.dead || z.seenA < 0.2) continue;
      const def = DH.ZTYPES[z.type];
      const p = PS(z.x, z.y, 0);
      // eye glints for readability in the dark
      const head = PS(z.x + Math.cos(z.face) * 0.08, z.y + Math.sin(z.face) * 0.08, def === DH.ZTYPES.clinger ? 1.35 : 1.62);
      ctx.fillStyle = 'rgba(235,230,190,' + 0.55 * z.seenA + ')';
      ctx.fillRect(head[0] - 2.5 * S, head[1] - 1 * S, 1.6 * S, 1.6 * S); ctx.fillRect(head[0] + 1 * S, head[1] - 1 * S, 1.6 * S, 1.6 * S);
      if (z.state === 'windup' || z.swipeT > 0) {
        const k = z.state === 'windup' ? 1 - z.t / def.windup : 1 - z.swipeT / def.windup;
        ctx.strokeStyle = 'rgba(255,70,50,' + (0.5 + k * 0.5) + ')'; ctx.lineWidth = 2.5 * S;
        ctx.beginPath(); ctx.ellipse(p[0], p[1], (0.4 + k * 0.6) * HX * S * 1.41, (0.4 + k * 0.6) * HY * S * 1.41, 0, 0, 7); ctx.stroke();
        if (z.type === 'runner') {
          const e = PS(z.x + Math.cos(z.face) * 2.6, z.y + Math.sin(z.face) * 2.6, 0);
          ctx.strokeStyle = 'rgba(255,80,60,' + (0.4 + k * 0.5) + ')'; ctx.lineWidth = 3 * S; ctx.setLineDash([6 * S, 4 * S]);
          ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(e[0], e[1]); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      if (z.state === 'howl') {
        const k = 1 - z.t / 1.5;
        const hp = PS(z.x, z.y, 1.4);
        for (let r = 0; r < 3; r++) { const rr = ((k * 3 + r) % 3) / 3; ctx.strokeStyle = 'rgba(255,200,80,' + (1 - rr) * 0.8 + ')'; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.arc(hp[0], hp[1], (8 + rr * 26) * S, 0, 7); ctx.stroke(); }
        ctx.fillStyle = '#ffcf6a'; ctx.font = 'bold ' + Math.round(11 * S) + 'px system-ui'; ctx.textAlign = 'center'; ctx.fillText('INHALING', hp[0], hp[1] - 40 * S);
      }
      if (z.state === 'leap') {
        const k = 1 - z.t / 0.7; const hpt = DH.Truck.closestHullPoint(z.x, z.y); const e = PS(hpt.x, hpt.y, 0.6);
        ctx.strokeStyle = 'rgba(255,170,60,' + (0.4 + k * 0.6) + ')'; ctx.lineWidth = 3 * S; ctx.setLineDash([5 * S, 4 * S]);
        ctx.beginPath(); ctx.moveTo(p[0], p[1] - 10 * S); ctx.lineTo(e[0], e[1]); ctx.stroke(); ctx.setLineDash([]);
      }
      if (z.attached) { ctx.strokeStyle = 'rgba(255,70,50,' + (0.5 + Math.sin(tnow * 10) * 0.3) + ')'; ctx.lineWidth = 2 * S; const q = PS(z.x, z.y, 1.0); ctx.beginPath(); ctx.arc(q[0], q[1], 16 * S, 0, 7); ctx.stroke(); }
      if (z.state === 'batter') { const q = PS(z.x, z.y, 2.0); if ((tnow * 3) % 1 < 0.5) { ctx.fillStyle = '#ffb347'; ctx.font = 'bold ' + Math.round(10 * S) + 'px system-ui'; ctx.textAlign = 'center'; ctx.fillText('BANG', q[0], q[1]); } }
    }
    // action progress above player
    const pl = run.player;
    if (pl.action && !pl.inTruck) {
      const q = PS(pl.x, pl.y, 2.25); const k = M.clamp(pl.action.t / pl.action.dur, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(q[0] - 26 * S, q[1] - 4 * S, 52 * S, 8 * S);
      ctx.fillStyle = '#f0b54a'; ctx.fillRect(q[0] - 25 * S, q[1] - 3 * S, 50 * S * k, 6 * S);
    }
    if (pl.reload > 0 && !pl.inTruck) {
      const w = DH.Player.weapon(); const def = DH.WEAPONS[w.type];
      const q = PS(pl.x, pl.y, 2.2); const k = 1 - pl.reload / def.reload;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3 * S; ctx.beginPath(); ctx.arc(q[0], q[1], 7 * S, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
    }
    // waiting survivor markers
    for (const sv of run.survivors) {
      if (sv.hidden) continue;
      if (sv.recruited && !sv.boarded && sv.state !== 'downed' && !sv.safe && sv.mode === 'wait') { const q = PS(sv.x, sv.y, 2.1); ctx.fillStyle = '#f0b54a'; ctx.font = 'bold ' + Math.round(9 * S) + 'px system-ui'; ctx.textAlign = 'center'; ctx.fillText('WAIT', q[0], q[1]); }
      if (sv.state === 'downed') { const q = PS(sv.x, sv.y, 1.0); ctx.fillStyle = '#ff6b5a'; ctx.font = 'bold ' + Math.round(10 * S) + 'px system-ui'; ctx.textAlign = 'center'; ctx.fillText('DOWNED', q[0], q[1]); }
      if (!sv.recruited && sv.call && M.dist(sv.x, sv.y, pl.x, pl.y) < 22) { const q = PS(sv.x, sv.y, 2.3); ctx.fillStyle = '#7fe3a0'; ctx.font = 'bold ' + Math.round(10 * S) + 'px system-ui'; ctx.textAlign = 'center'; if ((tnow * 1.5) % 1 < 0.7) ctx.fillText('HELP', q[0], q[1]); }
    }
    // level labels floating over equipment (e.g. flood channel previews)
    const LV = G.L();
    if (LV.labels) for (const lb of LV.labels(run)) { const q = PS(lb.x, lb.y, lb.z || 1.6); ctx.font = 'bold ' + Math.round((lb.size || 10) * S) + 'px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(lb.text, q[0] + S, q[1] + S); ctx.fillStyle = lb.col || '#ffd36a'; ctx.fillText(lb.text, q[0], q[1]); }
  };

  // Directional danger cues and objective pointer (screen space, CSS px * dpr)
  R.drawCues = (ctx, run, tnow) => {
    const pp = DH.Player.pos();
    const c = R.toScreen(pp.x, pp.y, 1.0);
    const d = R.dpr;
    const rad = Math.min(R.cssW, R.cssH) * 0.22;
    const arrow = (wx, wy, col, label, alpha) => {
      const s = R.toScreen(wx, wy, 1.0);
      const a = Math.atan2(s.y - c.y, s.x - c.x);
      const x = (c.x + Math.cos(a) * rad) * d, y = (c.y + Math.sin(a) * rad) * d;
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(14 * d, 0); ctx.lineTo(-6 * d, -9 * d); ctx.lineTo(-2 * d, 0); ctx.lineTo(-6 * d, 9 * d); ctx.closePath(); ctx.fill();
      ctx.restore();
      if (label) { ctx.save(); ctx.globalAlpha = alpha; ctx.font = 'bold ' + 11 * d + 'px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(label, x + 1 * d, y - 13 * d + 1 * d); ctx.fillStyle = col; ctx.fillText(label, x, y - 13 * d); ctx.restore(); }
    };
    for (const q of G.cues) arrow(q.x, q.y, q.kind === 'danger' ? '#ff5a46' : '#ffb347', q.label, Math.min(1, q.t));
    // objective pointer
    const obj = R.objectiveTarget(run);
    if (obj) {
      const s = R.toScreen(obj.x, obj.y, 0);
      const off = s.x < 30 || s.y < 30 || s.x > R.cssW - 30 || s.y > R.cssH - 30;
      if (off || M.dist(pp.x, pp.y, obj.x, obj.y) > 18) arrow(obj.x, obj.y, obj.col, obj.label, 0.85);
    }
  };
  R.objectiveTarget = (run) => { const L = G.L(); return L.pointer ? L.pointer(run) : G.exitPointer(run); };
})();

