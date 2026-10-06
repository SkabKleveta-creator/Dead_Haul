/* ==== core.js ==== */
/* DEAD HAUL - core: namespace, constants, math, RNG, projection */
(function () {
  'use strict';
  const DH = (window.DH = window.DH || {});

  DH.VERSION = '2.0.0';
  DH.SAVE_KEY = 'skab.deadhaul.v1';

  // Isometric 2:1 projection. 1 world meter along an axis = (24,12) px at zoom 1.
  DH.TW = 48;              // tile diamond width px
  DH.TH = 24;              // tile diamond height px
  DH.HZ = 29.4;            // px per vertical meter (true dimetric for 2:1)
  DH.WORLD = 120;          // meters
  DH.DT = 1 / 60;          // fixed sim step

  const M = (DH.M = {});
  M.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  M.lerp = (a, b, t) => a + (b - a) * t;
  M.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  M.dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
  M.normAng = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  M.angDiff = (a, b) => M.normAng(b - a);
  M.approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
  M.smooth = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  // closest point on segment
  M.closestOnSeg = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay; const l2 = dx * dx + dy * dy || 1e-9;
    const t = M.clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return { x: ax + dx * t, y: ay + dy * t, t };
  };
  // ray (origin o, unit dir d, maxLen) vs circle; returns distance or -1
  M.rayCircle = (ox, oy, dx, dy, maxLen, cx, cy, r) => {
    const fx = ox - cx, fy = oy - cy;
    const b = fx * dx + fy * dy;
    const c = fx * fx + fy * fy - r * r;
    if (c <= 0) return 0;
    const disc = b * b - c;
    if (disc < 0) return -1;
    const t = -b - Math.sqrt(disc);
    if (t < 0 || t > maxLen) return -1;
    return t;
  };

  // Deterministic RNG (mulberry32)
  DH.RNG = function (seed) {
    let s = seed >>> 0;
    const next = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      range: (a, b) => a + (b - a) * next(),
      int: (a, b) => Math.floor(a + (b - a + 1) * next()),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      shuffle: (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
      get state() { return s; },
      set state(v) { s = v >>> 0; },
    };
  };

  // Projection helpers (camera-independent, zoom 1, origin 0)
  DH.iso = {
    // world -> screen offset at zoom 1
    x: (wx, wy) => (wx - wy) * (DH.TW / 2),
    y: (wx, wy, wz) => (wx + wy) * (DH.TH / 2) - (wz || 0) * DH.HZ,
    // screen offset (zoom 1, origin 0) -> world at height z
    toWorld: (sx, sy, z) => {
      const a = sx / (DH.TW / 2);             // wx - wy
      const b = (sy + (z || 0) * DH.HZ) / (DH.TH / 2); // wx + wy
      return { x: (a + b) / 2, y: (b - a) / 2 };
    },
    // screen-relative input (right, down) -> world direction (unnormalized)
    inputToWorld: (ix, iy) => ({ x: ix + 2 * iy, y: 2 * iy - ix }), // screen-direction preserving
  };

  // Simple event bus
  DH.bus = {
    h: {},
    on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); },
    emit(ev, a, b, c) { const l = this.h[ev]; if (l) for (const f of l) f(a, b, c); },
  };

  DH.uid = (() => { let n = 0; return (p) => (p || 'e') + (++n).toString(36) + Math.floor(Math.random() * 1e6).toString(36); })();

  DH.fmtTime = (s) => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  // Tunables in one place
  DH.T = {
    player: { hp: 100, walk: 4.5, sprint: 6.5, radius: 0.32, iframes: 0.6, haulMul: 0.55, haulMulJack: 0.7, waterMul: 0.72, deepMul: 0.5 },
    medkit: { heal: 40, time: 2 },
    repair: { amount: 60, time: 4, timeWinch: 2.5 },
    melee: { reach: 1.5, dmg: 30, recovery: 0.65, stagger: 0.35, arc: 1.9, staggerImmunity: 1.1, maxTargets: 3 },
    noise: { walk: 2, sprint: 7, splash: 5, splashSprint: 10, machine: 30, pry: 12, melee: 5, truckIdle: 12, truckMove: 22, pistol: 18, smg: 22, shotgun: 28, rifle: 28, noisemaker: 20, alarm: 30, howl: 32, door: 9, impact: 14 },
    alarm: { dur: 12, cooldown: 30 },
    noisemaker: { dur: 8, range: 10 },
    truck: { durability: 200, maxFwd: 11, maxRev: 4.5, accel: 6.5, brake: 9, drag: 0.6, steerRate: 1.9, width: 2.3, length: 5.6, lightHitCost: 4, sceneryMax: 20 },
    cargo: { backpack: 6, truck: 6, generatorUnits: 3 },
    generator: { load: 3, loadGear: 1.5 },
    survivor: { hp: 60, revive: 4 },
    zombies: { drifter: 30, runner: 6, howler: 3, clinger: 3, maxActive: 24, reserve: 12, reserveGap: 30, reserveMinDist: 25 },
    rewards: { case: 40, survivor: 25, generator: 35, salvage: 5, medstock: 15, assembly: 40, filtration: 35, supplies: 10, powerpack: 30, pumps: 20, relay: 60, crossing: 60 },
    upgrades: {
      quiet: { name: 'Quiet Exhaust', cost: 50, desc: 'Truck sound radii reduced by 25%.' },
      bumper: { name: 'Reinforced Bumper', cost: 50, desc: 'Collision durability loss reduced by 35%. Clinger damage unchanged.' },
      gear: { name: 'Loading Gear', cost: 40, desc: 'Heavy cargo loading time halved (generator 3 s to 1.5 s).' },
    },
  };

  DH.WEAPONS = {
    pistol: { name: 'Pistol', ammo: 'p9', dmg: 30, mag: 12, rof: 0.28, reload: 1.2, pellets: 1, spread: 0.02, range: 30, noise: 'pistol', startReserve: 48, cap: 96 },
    shotgun: { name: 'Shotgun', ammo: 'shell', dmg: 14, mag: 6, rof: 0.85, reload: 2.2, pellets: 6, spread: 0.16, range: 17, noise: 'shotgun', startReserve: 12, cap: 30 },
    smg: { name: 'SMG', ammo: 'smg', dmg: 13, mag: 30, rof: 0.10, reload: 1.6, pellets: 1, spread: 0.06, range: 26, noise: 'smg', startReserve: 60, cap: 150 },
    rifle: { name: 'Lever Rifle', ammo: 'r30', dmg: 75, mag: 6, rof: 0.95, reload: 2.3, pellets: 1, spread: 0.004, range: 45, noise: 'rifle', startReserve: 12, cap: 30 },
  };
  DH.AMMO_NAMES = { p9: '9mm', shell: '12ga', smg: '.45', r30: '.30-30' };

  DH.ZTYPES = {
    drifter: { hp: 55, speed: 1.2, dmg: 12, windup: 0.45, cooldown: 1.2, reach: 1.25, radius: 0.33 },
    runner: { hp: 40, speed: 4.6, dmg: 10, windup: 0.4, cooldown: 1.1, reach: 2.3, radius: 0.3 },
    howler: { hp: 70, speed: 0.9, dmg: 12, windup: 0.5, cooldown: 1.3, reach: 1.25, radius: 0.36 },
    clinger: { hp: 35, speed: 3.0, dmg: 6, windup: 0.45, cooldown: 1.2, reach: 1.2, radius: 0.28 },
  };
})();

