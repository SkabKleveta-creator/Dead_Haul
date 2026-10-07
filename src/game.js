/* DEAD HAUL - run lifecycle, orchestration, snapshots */
(function () {
  'use strict';
  const DH = window.DH;
  const M = DH.M, T = DH.T;

  const G = (DH.G = {
    W: null,
    run: null,
    state: 'boot',
    noise: [],
    msgs: [],
    cues: [],
    fx: null,
    time: 0,
    upg: { quiet: false, bumper: false, gear: false },
    worlds: {},
    levelId: 1,
  });
  G.L = () => DH.LEVELS[(G.run && G.run.level) || G.levelId || 1];

  // Build (or reuse) the world for a level. Worlds are cached; dynamic state is reset per run.
  G.initWorld = (level) => {
    level = level || 1;
    if (G.W && G.W.level === level) return G.W;
    let W = G.worlds[level];
    if (!W) {
      W = DH.LEVELS[level].build();
      W.level = level;
      DH.initWorldQueries(W);
      W.dynBoxes = [];
      W._flow = W.makeFlow();
      G.worlds[level] = W;
    }
    G.W = W;
    G.levelId = level;
    G.flow = W._flow;
    DH.bus.emit('worldChanged', W);
    return W;
  };

  // ---------- Run construction helpers (used by level setup) ----------
  G.addItem = (run, id, kind, x, y, extra) => (run.items[id] = Object.assign({ id, kind, loc: 'world', x, y }, extra || {}));
  G.addPickup = (run, kind, x, y, data) => { const k = Object.assign({ id: 'k' + run.pickups.length, kind, x, y, taken: false }, data || {}); run.pickups.push(k); return k; };
  G.addSurvivor = (run, id, name, fig, x, y, extra) => {
    const s = Object.assign({ id, name, fig: fig || 'survivor', x, y, hp: T.survivor.hp, maxHp: T.survivor.hp, state: 'waiting', recruited: false, mode: 'follow', face: Math.PI / 2, walkPhase: 0, path: null, pathT: 0, stuckT: 0, lastX: x, lastY: y, boarded: false, safe: false }, extra || {});
    run.survivors.push(s);
    return s;
  };
  G.addEmitter = (run, e) => { const em = Object.assign({ on: false, t: 0, warm: 0, beat: 0, period: 1.0, r: T.noise.machine, dur: 0 }, e); run.emitters.push(em); return em; };
  G.emitter = (run, id) => run.emitters.find((e) => e.id === id);
  const NULL_SURV = Object.freeze({ id: 'none', name: 'Survivor', recruited: false, boarded: false, safe: false, state: 'none', mode: 'wait', x: -100, y: -100, hp: 0 });
  G.linkRun = (run) => {
    Object.defineProperty(run, 'survivor', { get() { return this.survivors[0] || NULL_SURV; }, enumerable: false, configurable: true });
    return run;
  };
  G.findSurvivor = (run, id) => run.survivors.find((s) => s.id === id) || null;

  // ---------- New run ----------
  G.newRun = (seed, upgrades, level, opts) => {
    opts = opts || {};
    level = level || 1;
    G.initWorld(level);
    G.resetWorldDynamic();
    const W = G.W, L = DH.LEVELS[level];
    seed = seed == null ? (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0 : seed >>> 0;
    const rng = DH.RNG(seed);
    const story = opts.story || (opts.backdrop ? null : DH.Save.story && DH.Save.story());
    const perks = opts.perks || (story && DH.Story ? DH.Story.perks(story) : {});
    const run = {
      v: 2,
      level,
      id: 'run-' + seed.toString(36) + '-' + Date.now().toString(36),
      seed,
      time: 0,
      upgrades: Object.assign({ quiet: false, bumper: false, gear: false }, upgrades || {}),
      perks: Object.assign({}, perks),
      player: null,
      truck: null,
      items: {},
      pickups: [],
      zombies: [],
      survivors: [],
      doors: W.doors.map((d) => ({ open: !!d.startOpen, hp: d.maxHp, broken: false, locked: !!d.initLocked })),
      shelf: W.shelf ? { state: 'aside', hp: W.shelf.maxHp, broken: false } : null,
      alarm: { active: 0, cooldown: 0, triggered: 0 },
      reserve: { remaining: L.reserve != null ? L.reserve : T.zombies.reserve, lastT: -999, heat: 0, pending: null, groups: 0 },
      discovered: {},
      explored: {},
      noisemakers: [],
      stats: { kills: 0, shots: 0, hits: 0, damageTaken: 0 },
      seenGenerator: false,
      seen: {},
      hints: {},
      nextZid: 1,
      truckIntroShown: false,
      flags: {},
      gates: {},
      emitters: [],
      said: {},
      timers: {},
    };
    for (const g of W.gates) run.gates[g.id] = { on: !!g.initial };
    // player
    const P0 = W.start.player;
    run.player = {
      x: P0.x, y: P0.y, hp: T.player.hp, aim: W.start.aim != null ? W.start.aim : Math.PI * 1.25, face: W.start.aim != null ? W.start.aim : Math.PI * 1.25,
      weapons: [{ type: 'pistol', mag: 12 }], cur: 0, ammo: { p9: 48, shell: 0, smg: 0, r30: 0 },
      medkits: 2 + (run.perks.medic ? 1 : 0), noisemakers: 2 + (run.perks.wes ? 1 : 0), repairkits: 1,
      inTruck: false, hauling: false, haulId: null, iframes: 0, fireCd: 0, meleeT: 0, meleeCd: 0, reload: 0, action: null, walkPhase: 0, moving: false, sprinting: false,
      noiseLevel: 0, dead: false, hurtT: 0,
    };
    run.truck = { x: W.start.truck.x, y: W.start.truck.y, ang: W.start.truck.ang, speed: 0, steer: 0, dur: T.truck.durability, disabled: false, engine: false, clingers: [], lastHit: 0, stuckT: 0, recoverT: 0, passenger: false, headlights: false };
    G.linkRun(run);
    L.setup(run, rng, story, opts);
    // zombies
    const start = W.start.player;
    for (const g of W.zombieGroups) {
      const o = g[4] || {};
      for (const type in g[3]) {
        for (let n = 0; n < g[3][type]; n++) {
          let pos = null;
          for (let tries = 0; tries < 30 && !pos; tries++) {
            const a = rng.next() * Math.PI * 2, r = rng.next() * g[2];
            const x = g[0] + Math.cos(a) * r, y = g[1] + Math.sin(a) * r;
            if (M.dist(x, y, start.x, start.y) < 20) continue;
            if (!W.circleFree(x, y, 0.35)) continue;
            pos = { x, y };
          }
          if (!pos) pos = W.findFreeNear(g[0], g[1], 0.35, 5) || { x: g[0], y: g[1] };
          const z = DH.Z.make(run, type, pos.x, pos.y, rng);
          if (o.tag) z.tag = o.tag;
          if (o.deaf) z.deaf = o.deaf;
          run.zombies.push(z);
        }
      }
    }
    G.run = run;
    G.upg = run.upgrades;
    G.applyRunToWorld();
    G.afterLoad();
    return run;
  };

  G.resetWorldDynamic = () => {
    const W = G.W;
    W.dynBlock.fill(0); W.dynOpaque.fill(0);
    W.dynBoxes.length = 0;
    W.truckBlock.fill(0); W.truckCells.length = 0;
    W.zoneBlock.fill(0); W.deep.fill(0); W.truckWall.set(W.truckWallS);
    for (const d of W.doors) { d.open = false; d.broken = false; d.locked = false; }
    W.version++;
  };

  // Push run door/shelf/gate state into world grid
  G.applyRunToWorld = () => {
    const W = G.W, run = G.run;
    W.doors.forEach((d, i) => { const st = run.doors[i] || (run.doors[i] = { open: false, hp: d.maxHp, broken: false }); d.open = st.open; d.broken = st.broken; d.locked = !!st.locked; });
    G.applyShelf();
    G.applyGates();
    W.version++;
  };
  G.applyShelf = () => {
    const W = G.W, s = G.run.shelf, def = W.shelf;
    W.dynBlock.fill(0); W.dynOpaque.fill(0);
    W.dynBoxes.length = 0;
    if (!def || !s || s.broken) { W.version++; return; }
    const pos = s.state === 'block' ? def.block : def.aside;
    const box = { type: 'shelf', x: pos.x, y: pos.y, hl: def.hl, hw: def.hw, ang: pos.ang, h: def.h, active: true, shape: 'box' };
    W.dynBoxes.push(box);
    if (s.state === 'block') {
      for (const [x, y] of def.tiles) { W.dynBlock[W.idx(x, y)] = 1; W.dynOpaque[W.idx(x, y)] = 1; }
    }
    W.version++;
  };
  // Gates are predefined tile sets: 'flood' (deep water: blocks the truck, slows people) or 'barrier' (blocks everything)
  G.applyGates = () => {
    const W = G.W, run = G.run;
    W.zoneBlock.fill(0); W.deep.fill(0); W.truckWall.set(W.truckWallS);
    for (const g of W.gates) {
      const st = run.gates[g.id];
      if (!st || !st.on) continue;
      for (const i of g.cells) {
        if (g.kind === 'flood') { W.deep[i] = 1; W.truckWall[i] = 1; } else W.zoneBlock[i] = 1;
      }
    }
    W.version++;
  };
  G.gateOccupied = (g) => {
    // returns what (if anything) would be trapped by switching this gate on
    const run = G.run, W = G.W;
    const inCells = (x, y, r) => { for (let yy = Math.floor(y - r); yy <= Math.floor(y + r); yy++) for (let xx = Math.floor(x - r); xx <= Math.floor(x + r); xx++) if (W.inB(xx, yy) && g.set[W.idx(xx, yy)]) return true; return false; };
    const t = run.truck;
    if (g.kind === 'flood') {
      const s = DH.Truck.seg();
      for (let k = 0; k <= 6; k++) { const x = s.ax + (s.bx - s.ax) * k / 6, y = s.ay + (s.by - s.ay) * k / 6; if (inCells(x, y, DH.Truck.HW)) return 'truck'; }
      return null;
    }
    if (!run.player.inTruck && inCells(run.player.x, run.player.y, 0.4)) return 'you';
    if (inCells(t.x, t.y, 2.5)) return 'truck';
    for (const s of run.survivors) if (s.recruited && !s.boarded && inCells(s.x, s.y, 0.4)) return s.name;
    for (const id in run.items) { const it = run.items[id]; if ((it.loc === 'world' || it.loc === 'hauled') && inCells(it.x, it.y, 0.5)) return DH.Cargo.label(it); }
    return null;
  };
  G.setGate = (id, on) => {
    const W = G.W, g = W.gates.find((q) => q.id === id), run = G.run;
    if (!g) return { ok: false };
    if (on) { const who = G.gateOccupied(g); if (who) return { ok: false, who }; }
    run.gates[id].on = !!on;
    G.applyGates();
    if (on) for (const z of run.zombies) if (!z.dead && g.kind !== 'flood' && g.set[W.idx(Math.floor(z.x), Math.floor(z.y))]) { const q = W.findFreeNear(z.x, z.y, 0.35, 4); if (q) { z.x = q.x; z.y = q.y; } }
    return { ok: true };
  };

  G.afterLoad = () => {
    G.noise.length = 0;
    G.msgs.length = 0;
    G.cues.length = 0;
    G.time = 0;
    G.flow.ver = -1;
    G.flowT = 0;
    G.interact = null;
    G.transferOpen = false;
    G.confirm = null;
    G.exitSuppress = {};
    G._discT = 0;
    if (DH.FX) DH.FX.reset();
    DH.bus.emit('runLoaded');
  };

  // ---------- Snapshot / restore ----------
  G.snapshot = () => {
    const r = G.run;
    if (!r) return null;
    const snap = JSON.parse(JSON.stringify(r, (k, v) => (k === 'path' || k === 'navT' || k === '_tmp' || k === '_lw' ? undefined : v)));
    snap.v = 2;
    snap.savedAt = Date.now();
    return snap;
  };
  // Convert a v1 (Level One only) snapshot into the v2 shape.
  G.upgradeSnapshot = (run) => {
    if (run.v === 2 && run.level) return run;
    run.v = 2; run.level = run.level || 1;
    if (!Array.isArray(run.survivors)) {
      const s = run.survivor;
      run.survivors = s ? [Object.assign({ id: 'nell', name: 'Nell', fig: 'survivor', where: 'Diner', landmark: 'diner', pron: 'her', safe: false, maxHp: T.survivor.hp }, s)] : [];
    }
    delete run.survivor;
    if (run.truck && run.truck.passenger === true) run.truck.passenger = run.survivors[0] ? run.survivors[0].id : false;
    if (run.player) run.player.haulId = run.player.hauling ? (run.player.haulId || 'generator') : null;
    for (const k of ['flags', 'gates', 'seen', 'said', 'timers', 'perks']) if (!run[k] || typeof run[k] !== 'object') run[k] = {};
    if (!Array.isArray(run.emitters)) run.emitters = [];
    if (run.seenGenerator) run.seen.generator = true;
    return run;
  };
  G.restore = (snap) => {
    const run = G.upgradeSnapshot(JSON.parse(JSON.stringify(snap)));
    if (!DH.LEVELS[run.level]) throw new Error('unknown level ' + run.level);
    if (!run.player || !run.truck || !run.items || typeof run.items !== 'object' || !Array.isArray(run.zombies) || !Array.isArray(run.survivors)) throw new Error('bad run snapshot');
    if (run.level === 1 && !run.items.case) throw new Error('bad run snapshot');
    G.initWorld(run.level);
    G.resetWorldDynamic();
    const W = G.W;
    if (!Array.isArray(run.doors) || run.doors.length !== W.doors.length) throw new Error('door state mismatch');
    for (const g of W.gates) if (!run.gates[g.id]) run.gates[g.id] = { on: !!g.initial };
    if (W.shelf && !run.shelf) run.shelf = { state: 'aside', hp: W.shelf.maxHp, broken: false };
    for (const z of run.zombies) { z.path = null; }
    for (const s of run.survivors) s.path = null;
    // a hauled item must belong to the player
    for (const id in run.items) { const it = run.items[id]; if (it.loc === 'hauled' && (!run.player.hauling || run.player.haulId !== id)) it.loc = 'world'; }
    if (run.player.hauling && (!run.items[run.player.haulId] || run.items[run.player.haulId].loc !== 'hauled')) { run.player.hauling = false; run.player.haulId = null; }
    // cancel transient actions
    run.player.action = null; run.player.reload = 0; run.player.meleeT = 0;
    run.player.iframes = 1.5; // fair resume protection
    G.linkRun(run);
    G.run = run;
    G.upg = run.upgrades || { quiet: false, bumper: false, gear: false };
    G.applyRunToWorld();
    G.afterLoad();
    // Safe position after load: nudge zombies that are too close to the player away
    const p = run.player, px = p.inTruck ? run.truck.x : p.x, py = p.inTruck ? run.truck.y : p.y;
    for (const z of run.zombies) {
      if (z.attached || z.dead) continue;
      const d = M.dist(z.x, z.y, px, py);
      if (d < 3.5) {
        const a = Math.atan2(z.y - py, z.x - px);
        const spot = G.W.findFreeNear(px + Math.cos(a) * 4.5, py + Math.sin(a) * 4.5, 0.35, 3);
        if (spot) { z.x = spot.x; z.y = spot.y; }
        z.state = 'recover'; z.t = 1.2;
      }
    }
    return run;
  };

  // ---------- Messages & cues ----------
  G.msg = (text, kind, dur) => {
    const last = G.msgs[G.msgs.length - 1];
    if (last && last.text === text && last.t > 0.5) { last.t = dur || 2.6; return; }
    G.msgs.push({ text, kind: kind || 'info', t: dur || 2.6 });
    if (G.msgs.length > 4) G.msgs.shift();
  };
  // Short radio line from a recurring character. once: key so the line is never repeated in this run.
  G.radio = (who, text, once, dur) => {
    const run = G.run;
    if (once && run) { if (run.said[once]) return false; run.said[once] = true; }
    const c = DH.Story && DH.Story.CAST[who];
    G.msgs.push({ text, who: c ? c.name : who, kind: 'radio', t: dur || Math.min(7, 3 + text.length / 22) });
    if (G.msgs.length > 4) G.msgs.shift();
    DH.bus.emit('radio', who);
    return true;
  };
  G.cue = (label, x, y, kind) => {
    const ex = G.cues.find((c) => c.label === label && M.dist(c.x, c.y, x, y) < 8);
    if (ex) { ex.t = 2.4; ex.x = x; ex.y = y; return; }
    G.cues.push({ label, x, y, kind: kind || 'danger', t: 2.4 });
    if (G.cues.length > 5) G.cues.shift();
  };

  // ---------- Noise ----------
  G.emitNoise = (x, y, r, kind, dur, focus) => {
    if (r <= 0) return;
    for (const n of G.noise) {
      if (n.kind === kind && Math.abs(n.x - x) < 1.5 && Math.abs(n.y - y) < 1.5) { n.r = Math.max(n.r, r); n.t = Math.max(n.t, dur || 0.4); n.x = x; n.y = y; if (focus) { n.fx = focus.x; n.fy = focus.y; } return n; }
    }
    const ev = { x, y, r, kind, t: dur || 0.4, fx: focus ? focus.x : x, fy: focus ? focus.y : y, id: Math.random() };
    G.noise.push(ev);
    if (G.noise.length > 40) G.noise.shift();
    const run = G.run;
    if (run && r >= 18 && kind !== 'truck' && kind !== 'machine') run.reserve.heat += r * 0.35;
    return ev;
  };

  G.truckNoiseMul = () => (G.upg.quiet ? 0.75 : 1);

  // ---------- Main update ----------
  G.update = (dt, input) => {
    const run = G.run;
    if (!run) return;
    run.time += dt;
    G.time += dt;
    for (let i = G.noise.length - 1; i >= 0; i--) { G.noise[i].t -= dt; if (G.noise[i].t <= 0) G.noise.splice(i, 1); }
    for (let i = G.msgs.length - 1; i >= 0; i--) { G.msgs[i].t -= dt; if (G.msgs[i].t <= 0) G.msgs.splice(i, 1); }
    for (let i = G.cues.length - 1; i >= 0; i--) { G.cues[i].t -= dt; if (G.cues[i].t <= 0) G.cues.splice(i, 1); }
    const L = DH.LEVELS[run.level];
    // a run can end synchronously inside a subsystem (e.g. an accepted departure); stop cleanly if so
    const systems = [() => DH.Player.update(dt, input), () => DH.Truck.update(dt, input), () => DH.Survivor.update(dt), () => DH.Z.updateAll(dt), () => DH.World.update(dt), () => DH.Interact.update(dt, input), () => DH.FX && DH.FX.update(dt), () => L.update && L.update(run, dt), () => G.checkExtraction(), () => G.discovery(dt)];
    for (const sys of systems) { sys(); if (G.run !== run) return; }
    if (run.player.hp <= 0 && !run.player.dead) {
      run.player.dead = true;
      G.endRun('death');
    }
  };

  G.discovery = (dt) => {
    const run = G.run, W = G.W;
    G._discT = (G._discT || 0) - dt;
    if (G._discT > 0) return;
    G._discT = 0.5;
    const p = run.player; const px = p.inTruck ? run.truck.x : p.x, py = p.inTruck ? run.truck.y : p.y;
    for (const l of W.landmarks) if (!run.discovered[l.id] && M.dist(px, py, l.x, l.y) < l.r + 8) { run.discovered[l.id] = true; if (G.state === 'play' && !l.quiet) G.msg('Discovered: ' + l.name, 'info', 2); DH.bus.emit('discover', l.id); }
    const bi = W.bld[W.idx(Math.floor(px), Math.floor(py))];
    if (bi) run.explored[bi] = true;
    for (const id in run.items) {
      const it = run.items[id];
      if (!it.spot || run.seen[id] || it.loc !== 'world') continue;
      if (M.dist(px, py, it.x, it.y) < 16 && W.los(px, py, it.x, it.y)) {
        run.seen[id] = true;
        if (it.kind === 'generator') run.seenGenerator = true;
        G.msg(it.spot, 'objective', 4.5);
      }
    }
  };

  // ---------- Extraction ----------
  G.inZone = (z, x, y) => x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2;
  G.exitOpen = (z) => { const L = G.L(); if (!L.exitOpen) return true; return L.exitOpen(z, G.run) === true; };
  const exitInside = (z) => {
    const run = G.run, p = run.player;
    const veh = z.kind === 'truck' || z.kind === 'ferry';
    if (veh) return p.inTruck && !run.truck.disabled && G.inZone(z, run.truck.x, run.truck.y);
    return !p.inTruck && G.inZone(z, p.x, p.y);
  };
  G.checkExtraction = () => {
    const run = G.run, W = G.W;
    if (G.state !== 'play' || G.confirm) return;
    G.inExit = null;
    for (const z of W.exits) {
      const inside = exitInside(z);
      if (!inside) { G.exitSuppress[z.id] = false; continue; }
      if (!G.exitOpen(z)) {
        const why = G.L().exitOpen(z, run);
        if (!G.exitSuppress[z.id]) { G.exitSuppress[z.id] = true; G.msg(typeof why === 'string' ? why : 'This exit is not open yet.', 'warn', 3); }
        continue;
      }
      G.inExit = z;
      if (!G.exitSuppress[z.id]) { G.openDepart(z); return; }
    }
  };
  G.exitPointer = (run) => {
    const W = G.W, p = run.player;
    if (p.inTruck) {
      if (run.truck.disabled) return null;
      let best = null, bd = 1e9;
      for (const z of W.exits) if ((z.kind === 'truck' || z.kind === 'ferry') && G.exitOpen(z)) { const d = M.dist(run.truck.x, run.truck.y, z.lx, z.ly) - (z.prefer || 0); if (d < bd) { bd = d; best = z; } }
      return best ? { x: (best.x1 + best.x2) / 2, y: (best.y1 + best.y2) / 2, label: best.kind === 'ferry' ? 'FERRY' : 'EXIT', col: '#ffd36a' } : null;
    }
    if (!run.truck.disabled) return { x: run.truck.x, y: run.truck.y, label: 'TRUCK', col: '#ffd36a' };
    const f = W.exits.find((z) => z.kind === 'foot' && G.exitOpen(z));
    return f ? { x: (f.x1 + f.x2) / 2, y: (f.y1 + f.y2) / 2, label: 'EVAC', col: '#7fe3a0' } : null;
  };
  G.extractCtx = (mode) => {
    const run = G.run, p = run.player;
    const out = [];
    for (const s of run.survivors) {
      if (!s.recruited || s.state === 'downed') continue;
      if (s.safe) { out.push(s.id); continue; }
      if (mode === 'truck' || mode === 'ferry') { if (s.boarded) out.push(s.id); }
      else if (!s.boarded && M.dist(s.x, s.y, p.x, p.y) <= 4) out.push(s.id);
    }
    const s0 = run.survivors[0];
    return {
      survivorsOut: out,
      survivorBoarded: !!(s0 && s0.recruited && s0.boarded),
      survivorNearMobile: !!(s0 && out.indexOf(s0.id) >= 0 && mode === 'foot'),
      survivorRecruited: !!(s0 && s0.recruited),
      survivorDowned: !!(s0 && s0.state === 'downed'),
      generatorFound: run.seenGenerator,
    };
  };
  G.openDepart = (zone) => {
    const mode = zone.kind;
    if (mode !== 'foot') { G.run.truck.speed = 0; }
    const ev = DH.Extract.evaluate(G.run, mode, G.extractCtx(mode));
    G.confirm = { zone, mode, ev };
    G.run.player.action = null;
    DH.bus.emit('confirmDepart', G.confirm);
  };
  G.cancelDepart = () => {
    if (!G.confirm) return;
    G.exitSuppress[G.confirm.zone.id] = true;
    G.confirm = null;
    DH.bus.emit('confirmClosed');
  };
  G.acceptDepart = () => {
    if (!G.confirm) return;
    const c = G.confirm;
    G.confirm = null;
    G.endRun(c.mode, c.zone);
  };

  G.endRun = (mode, zone) => {
    const run = G.run;
    const L = DH.LEVELS[run.level];
    const ctx = G.extractCtx(mode);
    const ev = DH.Extract.evaluate(run, mode === 'death' ? 'death' : mode, ctx);
    if (mode === 'death') ev.survivorsOut = [];
    const result = {
      runId: run.id, level: run.level, mode, status: ev.status, caseOut: ev.caseOut, survivorOut: ev.survivorOut, generatorOut: ev.generatorOut,
      salvageOut: ev.salvageOut, scrap: ev.status === 'failed' ? 0 : ev.scrap, time: run.time,
      truckDur: Math.round(run.truck.dur), truckState: mode === 'truck' || mode === 'ferry' ? (run.truck.dur < 60 ? 'Battered' : 'Serviceable') : mode === 'foot' ? 'Abandoned' : 'Lost',
      survivorRecruited: run.survivor.recruited, generatorSeen: run.seenGenerator, kills: run.stats.kills,
      leaving: ev.leaving, leftBehind: ev.leftBehind, got: ev.got, survivorsOut: ev.survivorsOut,
      rows: mode === 'death' ? [] : (L.resultRows ? L.resultRows(run, ev) : []),
      bonus: ev.bonus,
      outcome: mode === 'death' ? {} : (L.outcome ? L.outcome(run, ev, mode) : {}),
      zone: zone ? zone.id : null,
    };
    const fresh = DH.Save.commitResult(run.id, result);
    result.duplicate = !fresh;
    G.lastResult = result;
    G.lastRun = run;
    G.run = null;
    DH.bus.emit('runEnded', result);
  };
})();
