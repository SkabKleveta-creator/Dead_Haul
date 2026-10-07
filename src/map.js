/* DEAD HAUL - map kit: materials, floors, world arrays and authoring helpers shared by every level */
(function () {
  'use strict';
  const DH = window.DH;

  // Materials (wall tiles)
  const MAT = (DH.MAT = {
    NONE: 0, BRICK: 1, STUCCO: 2, BLOCK: 3, SIDING: 4, BARRICADE: 5, WOODFENCE: 6, CHAIN: 7, INTERIOR: 8, CREAM: 9, TEAL: 10,
    CORR: 11, COLD: 12, CONCRETE: 13, ROCK: 14, RAIL: 15, CONT_R: 16, CONT_B: 17, CONT_G: 18, LEVEE: 19, WETSIDING: 20, CONT_Y: 21,
  });
  // see: see-through mesh/railing (no wall top, no floor shadow)
  DH.MAT_INFO = {
    1: { h: 3.3, opaque: 1, name: 'brick' },
    2: { h: 3.0, opaque: 1, name: 'stucco' },
    3: { h: 3.2, opaque: 1, name: 'block' },
    4: { h: 2.9, opaque: 1, name: 'siding' },
    5: { h: 2.2, opaque: 1, name: 'barricade' },
    6: { h: 1.8, opaque: 1, name: 'woodfence' },
    7: { h: 2.0, opaque: 0, name: 'chainlink', see: 1 },
    8: { h: 3.0, opaque: 1, name: 'interior' },
    9: { h: 3.0, opaque: 1, name: 'cream' },
    10: { h: 3.0, opaque: 1, name: 'teal' },
    11: { h: 3.6, opaque: 1, name: 'corrugated' },
    12: { h: 3.4, opaque: 1, name: 'coldpanel' },
    13: { h: 3.2, opaque: 1, name: 'concrete' },
    14: { h: 2.6, opaque: 1, name: 'rock' },
    15: { h: 1.1, opaque: 0, name: 'railing', see: 1 },
    16: { h: 2.6, opaque: 1, name: 'container' },
    17: { h: 2.6, opaque: 1, name: 'container' },
    18: { h: 2.6, opaque: 1, name: 'container' },
    19: { h: 1.3, opaque: 0, name: 'levee' },
    20: { h: 2.9, opaque: 1, name: 'wet siding' },
    21: { h: 2.6, opaque: 1, name: 'container' },
  };
  // Floors
  const F = (DH.FLOOR = {
    GRASS: 0, ROAD: 1, WALK: 2, LOT: 3, TILE: 4, CHECKER: 5, WOOD: 6, GRAVEL: 7, FORECOURT: 8, CONCRETE_IN: 9, LINO: 10,
    WATER: 11, FROST: 12, DIRT: 13, METAL: 14, DOCK: 15, SEA: 16, VOID: 17, TRENCH: 18, MUD: 19, QUAY: 20,
  });
  DH.FLOOR_WATER = (f) => f === F.WATER;

  // Create an empty world with authoring helpers. Each level's build() fills it and calls K.finish().
  DH.MapKit = function (key, opts) {
    opts = opts || {};
    const N = opts.N || DH.WORLD;
    const size = N * N;
    const W = {
      key, N,
      wall: new Uint8Array(size),
      win: new Uint8Array(size),
      floor: new Uint8Array(size),
      bld: new Int8Array(size),
      propBlock: new Uint8Array(size), // static props that block movement (nav raster)
      propOpaque: new Uint8Array(size),
      doorAt: new Int16Array(size),   // door index + 1
      dynBlock: new Uint8Array(size), // shelf etc.
      dynOpaque: new Uint8Array(size),
      truckBlock: new Uint8Array(size), // truck footprint for human (player/survivor) paths
      ground: new Uint8Array(size),   // impassable ground that is not a wall (sea, cliff drop)
      truckWallS: new Uint8Array(size), // static: blocks only the truck (narrow foot paths, steps)
      truckWall: new Uint8Array(size),  // static + dynamic truck-only blockers (flooded channels)
      zoneBlock: new Uint8Array(size),  // dynamic gates that block everything
      softOpaque: new Uint8Array(size), // strip curtains: block sight, not movement
      deep: new Uint8Array(size),       // currently flooded (deep) water
      dark: new Uint8Array(size),       // unlit interior (cold wing)
      truckCells: [],
      doors: [],
      buildings: [],
      props: [],
      lamps: [],
      signs: [],
      decals: [],
      glows: [],
      gates: [],
      exits: [],
      landmarks: [],
      zombieGroups: [],
      reserveEntries: [],
      safeZones: [],
      roads: [],
      marks: [],     // painted ground markings: {k:'rect'|'line'|'stalls'|'text', ...}
      darkRects: [],
      theme: Object.assign({ dark: 'rgba(8,12,30,0.64)', lamp: 'rgba(255,165,60,A)', lightR: 8.5 }, opts.theme || {}),
      version: 0, // bumps when blocking state changes
    };
    const idx = (x, y) => y * N + x;
    W.idx = idx;
    const inB = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
    W.inB = inB;
    const K = { W, N, idx, inB, MAT, F };
    const rect = (K.rect = (x1, y1, x2, y2, fn) => { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) if (inB(x, y)) fn(x, y, idx(x, y)); });
    K.fill = (x1, y1, x2, y2, f) => rect(x1, y1, x2, y2, (x, y, i) => (W.floor[i] = f));
    K.setFloor = K.fill;
    K.wallLine = (x1, y1, x2, y2, mat) => rect(Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2), (x, y, i) => (W.wall[i] = mat));
    K.clearWall = (x1, y1, x2, y2) => rect(x1, y1, x2, y2, (x, y, i) => { W.wall[i] = 0; W.win[i] = 0; });
    K.windows = (x1, y1, x2, y2) => rect(x1, y1, x2, y2, (x, y, i) => { if (W.wall[i]) W.win[i] = 1; });
    K.ground = (x1, y1, x2, y2, f) => rect(x1, y1, x2, y2, (x, y, i) => { W.ground[i] = 1; if (f != null) W.floor[i] = f; });
    K.unground = (x1, y1, x2, y2) => rect(x1, y1, x2, y2, (x, y, i) => { W.ground[i] = 0; });
    K.truckOnly = (x1, y1, x2, y2) => rect(x1, y1, x2, y2, (x, y, i) => { W.truckWallS[i] = 1; });
    K.curtain = (x1, y1, x2, y2) => rect(x1, y1, x2, y2, (x, y, i) => { W.softOpaque[i] = 1; });
    K.darkRect = (x1, y1, x2, y2) => { rect(x1, y1, x2, y2, (x, y, i) => { W.dark[i] = 1; }); W.darkRects.push({ x1, y1, x2: x2 + 1, y2: y2 + 1 }); };
    K.road = (x1, y1, x2, y2, walk) => { W.roads.push([x1, y1, x2, y2]); if (walk !== false) K.fill(x1 - 2, y1 - 2, x2 + 2, y2 + 2, F.WALK); };
    K.paveRoads = () => { for (const r of W.roads) K.fill(r[0], r[1], r[2], r[3], F.ROAD); };
    K.perimeter = (mat) => { K.wallLine(0, 0, N - 1, 0, mat); K.wallLine(0, N - 1, N - 1, N - 1, mat); K.wallLine(0, 0, 0, N - 1, mat); K.wallLine(N - 1, 0, N - 1, N - 1, mat); };

    K.building = (name, bkey, x1, y1, x2, y2, mat, floor, roof, o) => {
      const id = W.buildings.length + 1;
      const b = Object.assign({ id, key: bkey, name, x1, y1, x2, y2, mat, roof, rooms: [] }, o || {});
      W.buildings.push(b);
      rect(x1, y1, x2, y2, (x, y, i) => { W.bld[i] = id; });
      K.fill(x1, y1, x2, y2, floor);
      K.wallLine(x1, y1, x2, y1, mat); K.wallLine(x1, y2, x2, y2, mat);
      K.wallLine(x1, y1, x1, y2, mat); K.wallLine(x2, y1, x2, y2, mat);
      return b;
    };
    K.door = (bKey, x, y, w, orient, o) => {
      const d = Object.assign({ id: 'd' + W.doors.length, x, y, w, orient, open: false, hp: 90, maxHp: 90, broken: false, bld: bKey, label: 'Door' }, o || {});
      d.cells = [];
      d.initLocked = !!d.locked;
      for (let k = 0; k < w; k++) {
        const cx = orient === 'h' ? x + k : x, cy = orient === 'h' ? y : y + k;
        d.cells.push([cx, cy]);
        W.wall[idx(cx, cy)] = 0; W.win[idx(cx, cy)] = 0;
        W.doorAt[idx(cx, cy)] = W.doors.length + 1;
      }
      d.cx = orient === 'h' ? x + w / 2 : x + 0.5;
      d.cy = orient === 'h' ? y + 0.5 : y + w / 2;
      W.doors.push(d);
      return d;
    };
    K.sign = (text, x, y, face, len, color, bg, z) => W.signs.push({ text, x, y, face, len, color, bg, z: z || 2.35 });
    K.P = (type, x, y, o) => { const p = Object.assign({ type, x, y, id: 'p' + W.props.length }, o || {}); W.props.push(p); return p; };
    K.box = (type, x, y, hl, hw, ang, h, o) => K.P(type, x, y, Object.assign({ shape: 'box', hl, hw, ang, h, solid: true }, o || {}));
    K.circ = (type, x, y, r, h, o) => K.P(type, x, y, Object.assign({ shape: 'circle', r, h, solid: true }, o || {}));
    K.car = (x, y, ang, color, o) => K.box('car', x, y, 2.2, 0.95, ang, 1.45, Object.assign({ color, wreck: ((x * 7 + y * 3) | 0) % 2 === 0 }, o || {}));
    K.tree = (x, y, o) => { if (W.wall[idx(Math.floor(x), Math.floor(y))] || W.ground[idx(Math.floor(x), Math.floor(y))]) return null; return K.circ('tree', x, y, 0.3, 5.5, Object.assign({ seed: x * 7 + y }, o || {})); };
    K.lamp = (x, y, o) => { const i = W.lamps.length; K.circ('lamp', x, y, 0.13, 5.2, { lampIdx: i }); W.lamps.push(Object.assign({ x, y, on: true, flicker: 0, r: 7.5 }, o || {})); };
    K.glow = (x, y, r, col, a, o) => W.glows.push(Object.assign({ x, y, r, col, a }, o || {}));
    // Predefined switchable tile sets. kind 'flood': deep water (blocks the truck, slows people). 'barrier': blocks everything.
    K.gate = (id, kind, rects, o) => {
      const g = Object.assign({ id, kind, rects, cells: [], set: new Uint8Array(size), initial: false, label: id }, o || {});
      for (const r of rects) rect(r[0], r[1], r[2], r[3], (x, y, i) => { if (!g.set[i]) { g.set[i] = 1; g.cells.push(i); } });
      W.gates.push(g);
      return g;
    };
    K.decals = (n, seed) => { for (let i = 0; i < n; i++) W.decals.push({ x: 2 + ((i * 37.3 + (seed || 0)) % (N - 4)), y: 2 + ((i * 53.7 + (seed || 0) * 3) % (N - 4)), k: i % 5, a: i * 1.3 }); };

    // Rasterize solid props into nav grid
    W.rasterProp = function (p, grid, val, inflate) {
      const inf = inflate == null ? 0.25 : inflate;
      const ext = p.shape === 'box' ? Math.hypot(p.hl, p.hw) + inf : p.r + inf;
      const x1 = Math.floor(p.x - ext), x2 = Math.floor(p.x + ext), y1 = Math.floor(p.y - ext), y2 = Math.floor(p.y + ext);
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) {
        if (!inB(x, y)) continue;
        const cx = x + 0.5, cy = y + 0.5;
        let hit = false;
        if (p.shape === 'box') {
          const c = Math.cos(-p.ang), s = Math.sin(-p.ang);
          const lx = (cx - p.x) * c - (cy - p.y) * s, ly = (cx - p.x) * s + (cy - p.y) * c;
          hit = Math.abs(lx) <= p.hl + inf - 0.2 && Math.abs(ly) <= p.hw + inf - 0.2;
          if (!hit) hit = Math.abs(lx) <= p.hl && Math.abs(ly) <= p.hw;
          // thin props (racks, pipes, counters) can miss every tile center yet still wall off a tile: sample its middle
          if (!hit && grid === W.propBlock && Math.min(p.hl, p.hw) < 0.5) {
            for (let sy = -0.3; sy <= 0.31 && !hit; sy += 0.3) for (let sx = -0.3; sx <= 0.31 && !hit; sx += 0.3) {
              const qx = (cx + sx - p.x) * c - (cy + sy - p.y) * s, qy = (cx + sx - p.x) * s + (cy + sy - p.y) * c;
              if (Math.abs(qx) <= p.hl + 0.05 && Math.abs(qy) <= p.hw + 0.05) hit = true;
            }
          }
        } else hit = Math.hypot(cx - p.x, cy - p.y) <= p.r + inf - 0.3;
        if (hit) grid[idx(x, y)] = val;
      }
    };
    const THIN = { bollard: 1, post: 1, lamp: 1, tree: 1, priceSign: 1 };
    K.finish = () => {
      for (const p of W.props) {
        if (!p.solid || THIN[p.type] || p.thin) continue;
        W.rasterProp(p, W.propBlock, 1, 0.1);
        if (p.opaque) W.rasterProp(p, W.propOpaque, 1, -0.1);
      }
      W.truckWall.set(W.truckWallS);
      return W;
    };
    return K;
  };

  // Level 1 world builder (kept as DH.buildMap for compatibility)
  DH.buildMap = () => DH.LEVELS[1].build();
})();
