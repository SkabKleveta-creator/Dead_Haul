/* ==== zombies.js ==== */
/* DEAD HAUL - zombie perception, navigation and archetype behaviour */
(function () {
  'use strict';
  const DH = window.DH;
  const M = DH.M, T = DH.T, G = DH.G;

  const Z = (DH.Z = {});
  const ACTIVE = { chase: 1, windup: 1, lunge: 1, recover: 1, howl: 1, leap: 1, attached: 1, batter: 0 };

  Z.make = (run, type, x, y, rng, reserve) => {
    const d = DH.ZTYPES[type];
    const r = rng ? rng.next : Math.random;
    return {
      id: 'z' + (run.nextZid++), type, x, y, hp: d.hp, maxHp: d.hp, state: 'idle', t: r() * 4, face: r() * Math.PI * 2,
      walkPhase: r() * 10, homeX: x, homeY: y, tx: x, ty: y, target: null, lastSeen: -99, senseOff: r() * 0.2, senseT: r() * 0.2,
      atkCd: 0, stagImmune: 0, howlCd: 0, speedMul: 0.88 + r() * 0.24, dead: false, deathT: 0, visible: false, seenA: 0,
      attached: null, reserve: !!reserve, flash: 0, pathT: 0, lod: 0, stuckT: 0, lx: x, ly: y, strikeHit: false,
    };
  };

  const targetPos = (z) => {
    const run = G.run;
    if (z.target === 'player') return run.player.inTruck ? null : run.player;
    if (z.target === 'truck') return run.player.inTruck ? DH.Truck.closestHullPoint(z.x, z.y) : null;
    if (z.target === 'survivor') { const s = z.sid ? G.findSurvivor(run, z.sid) : run.survivors[0]; return s && DH.Survivor.active(s) ? s : null; }
    return null;
  };
  Z.targetPos = targetPos;

  Z.damage = (z, dmg, sx, sy, kind) => {
    if (z.dead) return;
    z.hp -= dmg;
    z.flash = 0.12;
    if (z.hp <= 0) { Z.kill(z, sx, sy); return; }
    // alert toward attacker
    const run = G.run;
    if (!run.player.inTruck && kind !== 'truck') {
      z.target = 'player'; z.tx = run.player.x; z.ty = run.player.y; z.lastSeen = G.time;
      if (z.state === 'idle' || z.state === 'search' || z.state === 'investigate' || z.state === 'lurk') { z.state = 'chase'; Z.onChase(z); }
    }
    DH.bus.emit('zhit', z, kind);
  };
  Z.kill = (z, sx, sy) => {
    z.dead = true; z.deathT = 0; z.hp = 0;
    if (z.attached) Z.detach(z, false);
    z.state = 'dead';
    z.deathFace = sx != null ? Math.atan2(z.y - sy, z.x - sx) : z.face;
    G.run.stats.kills++;
    DH.bus.emit('zdie', z);
  };
  Z.stagger = (z, dur, sx, sy, melee) => {
    if (z.dead || z.attached) return;
    if (z.stagImmune > 0) { if (z.state === 'howl') { z.state = 'stagger'; z.t = 0.2; z.howlCd = 4; } return; }
    const wasHowl = z.state === 'howl';
    z.state = 'stagger'; z.t = dur;
    z.stagImmune = melee ? T.melee.staggerImmunity : 0.35;
    if (wasHowl) { z.howlCd = 4; DH.bus.emit('howlInterrupted', z); G.msg('Howl interrupted.', 'good', 1.2); }
    const a = Math.atan2(z.y - sy, z.x - sx);
    G.W.moveCircle(z, Math.cos(a) * (melee ? 0.45 : 0.18), Math.sin(a) * (melee ? 0.45 : 0.18), DH.ZTYPES[z.type].radius);
  };
  Z.detach = (z, knock) => {
    const tr = G.run.truck;
    tr.clingers = tr.clingers.filter((c) => c.zid !== z.id);
    z.attached = null;
    if (!z.dead) {
      const spot = G.W.findFreeNear(z.x, z.y, 0.3, 3) || { x: z.x, y: z.y };
      z.x = spot.x; z.y = spot.y;
      z.state = knock ? 'stagger' : 'recover'; z.t = knock ? 0.6 : 0.8;
    }
    DH.bus.emit('clingerOff', z);
  };
  Z.onChase = (z) => {
    const run = G.run;
    if (!z.visible) {
      const p = DH.Player.pos();
      const d = M.dist(p.x, p.y, z.x, z.y);
      if (d < 22 && (!Z._cueT || G.time - Z._cueT > 3)) { Z._cueT = G.time; G.cue(z.type === 'runner' ? 'Footfalls' : 'Groan', z.x, z.y, z.type === 'runner' ? 'danger' : 'warn'); }
    }
    if (z.type === 'runner' && run) DH.bus.emit('runnerChase', z);
  };

  // ---------- Perception ----------
  const sense = (z) => {
    const run = G.run, W = G.W;
    const p = run.player;
    const cands = [];
    if (!p.dead) cands.push(p.inTruck ? 'truck' : 'player');
    for (const s of run.survivors) if (DH.Survivor.active(s)) cands.push(s);
    let best = null, bestD = 1e9;
    for (const c of cands) {
      const tp = c === 'player' ? p : c === 'truck' ? DH.Truck.closestHullPoint(z.x, z.y) : c;
      const d = M.dist(z.x, z.y, tp.x, tp.y);
      let range = c === 'truck' ? 24 : 20;
      if (c === 'truck' && run.truck.engine) range = 28;
      if (d > range) continue;
      if (d > 1.6) {
        if (d > 6) { const a = Math.atan2(tp.y - z.y, tp.x - z.x); if (Math.abs(M.angDiff(z.face, a)) > 1.5 && z.state !== 'chase') continue; }
        if (!W.los(z.x, z.y, tp.x, tp.y)) continue;
      }
      const sv = typeof c === 'object';
      const score = d * (sv ? 1.15 : 1);
      if (score < bestD) { bestD = score; best = { c: sv ? 'survivor' : c, sid: sv ? c.id : null, tp, d }; }
    }
    return best;
  };
  const hear = (z) => {
    const W = G.W;
    let best = null, bestS = 0;
    for (const n of G.noise) {
      const d = M.dist(z.x, z.y, n.x, n.y);
      if (d > n.r) continue;
      let eff = n.r * (z.deaf || 1);
      if (d > 3 && !W.los(z.x, z.y, n.x, n.y)) eff *= 0.7;
      if (d > eff) continue;
      const s = (eff - d) + (n.kind === 'howl' || n.kind === 'alarm' || n.kind === 'machine' ? 6 : 0) + (n.kind === 'noisemaker' ? 4 : 0);
      if (s > bestS) { bestS = s; best = n; }
    }
    return best;
  };

  // ---------- Movement helpers ----------
  const moveToward = (z, wx, wy, speed, dt) => {
    const dx = wx - z.x, dy = wy - z.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.05) return 0;
    const wm = G.W.isWater(Math.floor(z.x), Math.floor(z.y));
    const step = Math.min(d, speed * (wm === 2 ? 0.6 : wm ? 0.8 : 1) * dt);
    const vx = (dx / d) * step, vy = (dy / d) * step;
    const ox = z.x, oy = z.y;
    G.W.moveCircle(z, vx, vy, DH.ZTYPES[z.type].radius);
    DH.Truck.pushOut(z, DH.ZTYPES[z.type].radius);
    const moved = M.dist(ox, oy, z.x, z.y);
    z.walkPhase += moved * 2.4;
    z.face = M.normAng(z.face + M.angDiff(z.face, Math.atan2(dy, dx)) * Math.min(1, dt * 7));
    return moved;
  };

  // Returns next waypoint {x,y,door?} toward goal; uses flow for main target, A* otherwise
  const nextWaypoint = (z, gx, gy, useFlow) => {
    const W = G.W;
    const r = DH.ZTYPES[z.type].radius;
    if (M.dist(z.x, z.y, gx, gy) < 1.2 || (M.dist(z.x, z.y, gx, gy) < 14 && W.walkLine(z.x, z.y, gx, gy, r * 0.9))) return { x: gx, y: gy };
    if (useFlow && G.flow.ver >= 0) {
      const st = W.flowStep(G.flow, z.x, z.y);
      if (st) return st;
    }
    // A* (budgeted)
    if (!z.path || z.pathT <= 0 || M.dist(z.pathGX, z.pathGY, gx, gy) > 2.5 || z.pathVer !== W.version) {
      if (Z.budget > 0) {
        Z.budget--;
        z.path = W.findPath(z.x, z.y, gx, gy, true, 4000);
        z.pathI = 0; z.pathT = 2.5; z.pathGX = gx; z.pathGY = gy; z.pathVer = W.version;
        if (!z.path) { z.path = []; z.pathT = 1.5; }
      } else if (!z.path) return null;
    }
    const path = z.path;
    while (z.pathI < path.length - 1 && M.dist(z.x, z.y, path[z.pathI].x, path[z.pathI].y) < 0.7) z.pathI++;
    // skip ahead if visible
    while (z.pathI < path.length - 1 && W.walkLine(z.x, z.y, path[z.pathI + 1].x, path[z.pathI + 1].y, r * 0.9)) z.pathI++;
    return path[z.pathI] || null;
  };

  // Check if moving toward waypoint requires breaking a door/shelf
  const blockerAt = (x, y) => {
    const W = G.W;
    const tx = Math.floor(x), ty = Math.floor(y);
    if (!W.inB(tx, ty)) return null;
    const i = W.idx(tx, ty);
    if (W.doorClosed(i)) return { kind: 'door', idx: W.doorAt[i] - 1, x: tx + 0.5, y: ty + 0.5 };
    if (W.dynBlock[i]) return { kind: 'shelf', x: tx + 0.5, y: ty + 0.5 };
    return null;
  };

  // ---------- Update all ----------
  Z.budget = 4;
  Z.updateAll = (dt) => {
    const run = G.run, W = G.W;
    Z.budget = 5;
    const pp = DH.Player.pos();
    // flow field toward the player / truck
    G.flowT = (G.flowT || 0) - dt;
    if (G.flowT <= 0 || G.flow.ver !== W.version) {
      const fx = Math.floor(pp.x), fy = Math.floor(pp.y);
      if (G.flow.ver !== W.version || fx !== Math.floor(G.flow.tx) || fy !== Math.floor(G.flow.ty)) W.computeFlow(G.flow, pp.x, pp.y, 70);
      G.flowT = 0.35;
    }
    // active slot management
    Z.slotT = (Z.slotT || 0) - dt;
    if (Z.slotT <= 0) {
      Z.slotT = 0.5;
      const act = run.zombies.filter((z) => !z.dead && (ACTIVE[z.state] || z.state === 'lurk')).sort((a, b) => M.dist2(a.x, a.y, pp.x, pp.y) - M.dist2(b.x, b.y, pp.x, pp.y));
      act.forEach((z, i) => {
        if (i >= T.zombies.maxActive && z.state === 'chase') { z.state = 'lurk'; }
        else if (i < T.zombies.maxActive && z.state === 'lurk') { z.state = 'chase'; }
      });
      Z.activeCount = Math.min(act.length, T.zombies.maxActive);
    }
    // spatial hash for separation
    const hash = Z.hash || (Z.hash = new Map());
    hash.clear();
    for (const z of run.zombies) {
      if (z.dead || z.attached) continue;
      const k = (Math.floor(z.x / 2) << 8) | Math.floor(z.y / 2);
      let l = hash.get(k); if (!l) hash.set(k, (l = [])); l.push(z);
    }
    // update
    for (const z of run.zombies) {
      if (z.dead) { z.deathT += dt; continue; }
      z.flash = Math.max(0, z.flash - dt);
      z.stagImmune = Math.max(0, z.stagImmune - dt);
      z.howlCd = Math.max(0, z.howlCd - dt);
      z.atkCd = Math.max(0, z.atkCd - dt);
      const far = M.dist2(z.x, z.y, pp.x, pp.y) > 48 * 48 && (z.state === 'idle' || z.state === 'search');
      if (far) { z.lod += dt; if (z.lod < 0.3) continue; Z.think(z, z.lod); z.lod = 0; }
      else Z.think(z, dt);
    }
    // separation & player push
    const p = run.player;
    for (const z of run.zombies) {
      if (z.dead || z.attached) continue;
      const rz = DH.ZTYPES[z.type].radius;
      const kx = Math.floor(z.x / 2), ky = Math.floor(z.y / 2);
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const l = hash.get(((kx + i) << 8) | (ky + j)); if (!l) continue;
        for (const o of l) {
          if (o === z || o.id < z.id) continue;
          const ro = DH.ZTYPES[o.type].radius;
          const dx = o.x - z.x, dy = o.y - z.y; const d = Math.hypot(dx, dy); const min = rz + ro + 0.06;
          if (d < min && d > 1e-4) {
            const push = (min - d) * 0.5; const nx = dx / d, ny = dy / d;
            z.x -= nx * push; z.y -= ny * push; o.x += nx * push; o.y += ny * push;
          } else if (d <= 1e-4) { z.x += 0.05; }
        }
      }
      if (!p.inTruck && !p.dead) {
        const dx = z.x - p.x, dy = z.y - p.y; const d = Math.hypot(dx, dy); const min = rz + T.player.radius + 0.04;
        if (d < min && d > 1e-4) { const push = min - d; z.x += (dx / d) * push * 0.8; z.y += (dy / d) * push * 0.8; p.x -= (dx / d) * push * 0.2; p.y -= (dy / d) * push * 0.2; }
      }
      for (const s of run.survivors) if (s.recruited && !s.boarded) { const dx = z.x - s.x, dy = z.y - s.y; const d = Math.hypot(dx, dy); const min = rz + 0.3; if (d < min && d > 1e-4) { const push = min - d; z.x += (dx / d) * push; z.y += (dy / d) * push; } }
      W.resolveCircle(z, rz);
    }
    if (!p.inTruck) W.resolveCircle(p, T.player.radius);
    // remove long-dead corpses
    for (let i = run.zombies.length - 1; i >= 0; i--) if (run.zombies[i].dead && run.zombies[i].deathT > 30) run.zombies.splice(i, 1);
    // visibility for render
    Z.visT = (Z.visT || 0) - dt;
    if (Z.visT <= 0) {
      Z.visT = 0.08;
      const pl = run.player, fl = !pl.inTruck, aim = pl.aim;
      for (const z of run.zombies) {
        const d = M.dist(z.x, z.y, pp.x, pp.y);
        // unlit interiors: only close range or the flashlight cone reveals them
        let range = 38;
        if (W.dark[W.idx(Math.floor(z.x), Math.floor(z.y))] && !z.lit) range = fl && Math.abs(M.angDiff(aim, Math.atan2(z.y - pp.y, z.x - pp.x))) < 0.42 ? 13 : 5.5;
        z.visible = z.attached ? true : d < 1.8 || (d < range && W.los(pp.x, pp.y, z.x, z.y));
      }
    }
    for (const z of run.zombies) z.seenA = M.approach(z.seenA, z.visible ? 1 : 0, dt * 5);
  };

  Z.think = (z, dt) => {
    const run = G.run, W = G.W, def = DH.ZTYPES[z.type];
    z.t -= dt;
    // perception
    z.senseT -= dt;
    let perceived = null;
    if (z.senseT <= 0 && z.state !== 'attached') {
      z.senseT = 0.2;
      perceived = sense(z);
      if (perceived) {
        const was = z.state;
        z.target = perceived.c; z.sid = perceived.sid; z.tx = perceived.tp.x; z.ty = perceived.tp.y; z.lastSeen = G.time;
        if (was === 'idle' || was === 'search' || was === 'investigate') { z.state = 'chase'; Z.onChase(z); }
      } else if (z.state === 'idle' || z.state === 'search' || z.state === 'investigate' || z.state === 'lurk' || (z.state === 'chase' && G.time - z.lastSeen > 0.8)) {
        const n = hear(z);
        if (n && (z.state !== 'chase' || G.time - z.lastSeen > 2)) {
          const jitter = n.kind === 'step' ? 0.5 : 1.5;
          const nx = n.fx + (Math.random() - 0.5) * jitter, ny = n.fy + (Math.random() - 0.5) * jitter;
          if (z.state !== 'investigate' || M.dist(nx, ny, z.tx, z.ty) > 3) { z.tx = nx; z.ty = ny; z.path = null; }
          if (z.state !== 'investigate') { z.state = 'investigate'; z.t = 25; }
          z.investKind = n.kind;
        }
      }
    }
    const tp = z.target ? targetPos(z) : null;
    if (z.target && !tp && (z.state === 'chase' || z.state === 'windup' || z.state === 'lurk')) {
      // target no longer valid (entered truck etc.) -> investigate last known
      z.target = null; z.state = 'investigate'; z.t = 10;
    }
    const baseSpeed = def.speed * z.speedMul;
    switch (z.state) {
      case 'idle': {
        if (z.t <= 0) {
          z.t = 4 + Math.random() * 5;
          const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 5;
          const wx = z.homeX + Math.cos(a) * r, wy = z.homeY + Math.sin(a) * r;
          if (W.walkLine(z.x, z.y, wx, wy, 0.3)) { z.wx = wx; z.wy = wy; } else { z.wx = z.x; z.wy = z.y; }
        }
        if (z.wx != null) moveToward(z, z.wx, z.wy, baseSpeed * 0.35, dt);
        break;
      }
      case 'investigate': case 'search': {
        if (z.state === 'search') {
          if (z.t <= 0) { z.state = 'idle'; z.homeX = z.x; z.homeY = z.y; z.t = 1; break; }
          if (!z.wx || M.dist(z.x, z.y, z.wx, z.wy) < 0.5 || Math.random() < dt * 0.4) {
            const a = Math.random() * Math.PI * 2; z.wx = z.tx + Math.cos(a) * 2.5; z.wy = z.ty + Math.sin(a) * 2.5;
            if (!W.walkLine(z.x, z.y, z.wx, z.wy, 0.3)) { z.wx = z.x; z.wy = z.y; }
          }
          moveToward(z, z.wx, z.wy, baseSpeed * 0.5, dt);
          break;
        }
        if (M.dist(z.x, z.y, z.tx, z.ty) < 1.4 || z.t <= 0) { z.state = 'search'; z.t = 5; z.wx = null; break; }
        const wp = nextWaypoint(z, z.tx, z.ty, false);
        if (wp) { if (!Z.tryBatter(z, wp)) Z.stepMove(z, wp, baseSpeed * (z.type === 'runner' ? 0.6 : z.type === 'clinger' ? 0.75 : 0.95), dt); }
        break;
      }
      case 'lurk': {
        if (!tp) { z.state = 'idle'; break; }
        const d = M.dist(z.x, z.y, tp.x, tp.y);
        if (d > 10) { const wp = nextWaypoint(z, tp.x, tp.y, z.target !== 'survivor'); if (wp) Z.stepMove(z, wp, baseSpeed * 0.6, dt); }
        else z.face = Math.atan2(tp.y - z.y, tp.x - z.x);
        break;
      }
      case 'chase': {
        if (!tp) break;
        const seenRecently = G.time - z.lastSeen < 0.8;
        const gx = seenRecently ? tp.x : z.tx, gy = seenRecently ? tp.y : z.ty;
        if (!seenRecently && G.time - z.lastSeen > 1.2) { z.state = 'investigate'; z.t = 12; break; }
        const d = M.dist(z.x, z.y, tp.x, tp.y);
        // archetype actions
        if (z.type === 'howler' && seenRecently && z.howlCd <= 0 && d < 22 && d > 2.2) { z.state = 'howl'; z.t = 1.5; DH.bus.emit('howlStart', z); break; }
        if (z.type === 'clinger' && z.target === 'truck') {
          const tr = run.truck;
          const hd = DH.Truck.distToHull(z.x, z.y);
          if (hd < 2.6 && tr.clingers.length < 2 && !tr.disabled && z.atkCd <= 0) { z.state = 'leap'; z.t = 0.7; DH.bus.emit('clingerTell', z); break; }
        }
        const targetR = z.target === 'truck' ? 0.1 : 0.32;
        if (z.target !== 'truck' || (z.type !== 'clinger' && Math.abs(run.truck.speed) < 1.5)) {
          if (z.type === 'runner' && z.target !== 'truck') {
            if (d < def.reach && z.atkCd <= 0 && seenRecently) { z.state = 'windup'; z.t = def.windup; z.face = Math.atan2(tp.y - z.y, tp.x - z.x); break; }
          } else if (d < def.reach + targetR && z.atkCd <= 0) { z.state = 'windup'; z.t = def.windup; z.face = Math.atan2(tp.y - z.y, tp.x - z.x); DH.bus.emit('windup', z); break; }
        }
        // spacing: if crowd around target, hold at a ring
        let speed = baseSpeed;
        if (d < 1.6) speed *= 0.4;
        const wp = nextWaypoint(z, gx, gy, z.target !== 'survivor');
        if (wp) { if (!Z.tryBatter(z, wp)) Z.stepMove(z, wp, speed, dt); }
        break;
      }
      case 'windup': {
        if (tp) z.face = M.normAng(z.face + M.angDiff(z.face, Math.atan2(tp.y - z.y, tp.x - z.x)) * Math.min(1, dt * 4));
        if (z.t > 0) break;
        if (z.type === 'runner') { z.state = 'lunge'; z.t = 0.28; z.strikeHit = false; z.lx = Math.cos(z.face); z.ly = Math.sin(z.face); DH.bus.emit('lunge', z); break; }
        Z.strike(z, tp, def);
        z.state = 'recover'; z.t = def.cooldown; z.atkCd = def.cooldown;
        break;
      }
      case 'lunge': {
        const ox = z.x, oy = z.y;
        G.W.moveCircle(z, z.lx * 9 * dt, z.ly * 9 * dt, def.radius);
        z.walkPhase += M.dist(ox, oy, z.x, z.y) * 2;
        if (!z.strikeHit && tp && M.dist(z.x, z.y, tp.x, tp.y) < 0.95) { z.strikeHit = true; Z.hitTarget(z, def.dmg); }
        if (z.t <= 0) { z.state = 'recover'; z.t = def.cooldown; z.atkCd = def.cooldown; }
        break;
      }
      case 'recover': {
        if (z.t <= 0) { z.state = z.target ? 'chase' : 'idle'; break; }
        if (tp) { const d = M.dist(z.x, z.y, tp.x, tp.y); if (d > 1.1) { const wp = nextWaypoint(z, tp.x, tp.y, z.target !== 'survivor'); if (wp) Z.stepMove(z, wp, baseSpeed * (z.type === 'runner' ? 0.35 : 0.5), dt); } }
        break;
      }
      case 'stagger': {
        if (z.t <= 0) z.state = z.target ? 'chase' : 'investigate';
        break;
      }
      case 'howl': {
        if (tp) z.face = Math.atan2(tp.y - z.y, tp.x - z.x);
        if (z.t <= 0) {
          const focus = tp ? { x: tp.x, y: tp.y } : { x: z.x, y: z.y };
          G.emitNoise(z.x, z.y, T.noise.howl, 'howl', 1.4, focus);
          z.howlCd = 10; z.state = 'chase';
          G.cue('HOWL', z.x, z.y, 'danger');
          DH.bus.emit('howl', z);
        }
        break;
      }
      case 'leap': {
        const tr = run.truck;
        if (!run.player.inTruck || tr.disabled) { z.state = 'chase'; break; }
        const hp = DH.Truck.closestHullPoint(z.x, z.y);
        z.face = Math.atan2(hp.y - z.y, hp.x - z.x);
        if (z.t > 0) { moveToward(z, hp.x, hp.y, Math.min(baseSpeed, Math.abs(tr.speed) + 1.5), dt); break; }
        const hd = DH.Truck.distToHull(z.x, z.y);
        if (hd < 3.2 && tr.clingers.length < 2) DH.Truck.attach(z);
        else { z.state = 'recover'; z.t = 1.0; z.atkCd = 1.5; DH.bus.emit('leapMiss', z); }
        break;
      }
      case 'attached': {
        DH.Truck.placeClinger(z);
        // with the driver gone, a clinger lets go to hunt them once they wander off
        if (!run.player.inTruck && !run.player.dead && M.dist(z.x, z.y, run.player.x, run.player.y) > 6.5) { DH.Z.detach(z, false); z.target = 'player'; z.state = 'chase'; z.lastSeen = G.time; break; }
        // swipe at the player if they are standing next to the truck
        const p = run.player;
        if (!p.inTruck && !p.dead) {
          const d = M.dist(z.x, z.y, p.x, p.y);
          if (z.swipeT > 0) { z.swipeT -= dt; if (z.swipeT <= 0) { if (d < 1.7) DH.Player.damage(def.dmg, z.x, z.y, z); z.atkCd = def.cooldown; } }
          else if (d < 1.5 && z.atkCd <= 0) { z.swipeT = def.windup; DH.bus.emit('windup', z); }
        }
        break;
      }
      case 'batter': {
        const b = z.batter;
        if (!b || Z.blockerGone(b)) { z.state = z.target ? 'chase' : 'investigate'; z.batter = null; z.path = null; break; }
        z.face = Math.atan2(b.y - z.y, b.x - z.x);
        if (M.dist(z.x, z.y, b.x, b.y) > 1.3) moveToward(z, b.x, b.y, baseSpeed, dt);
        if (z.t <= 0) {
          z.t = 1.3;
          DH.World.damageBlocker(b, z.type === 'runner' ? 10 : 14, z);
        }
        // give up battering if the target is visible via another route
        if (perceived && M.dist(z.x, z.y, perceived.tp.x, perceived.tp.y) < 12 && W.walkLine(z.x, z.y, perceived.tp.x, perceived.tp.y, 0.3)) { z.state = 'chase'; z.batter = null; }
        break;
      }
    }
    // stuck detection -> repath
    if (z.state === 'chase' || z.state === 'investigate') {
      z.stuckT += dt;
      if (z.stuckT > 1.5) {
        if (M.dist(z.x, z.y, z.sx0 || 0, z.sy0 || 0) < 0.3) { z.path = null; z.pathT = 0; z.nudge = 0.6; }
        z.sx0 = z.x; z.sy0 = z.y; z.stuckT = 0;
      }
    }
  };

  Z.stepMove = (z, wp, speed, dt) => {
    if (z.nudge > 0) { // sidestep to break deadlocks
      z.nudge -= dt;
      const a = Math.atan2(wp.y - z.y, wp.x - z.x) + (z.id.charCodeAt(z.id.length - 1) % 2 ? 1.2 : -1.2);
      moveToward(z, z.x + Math.cos(a), z.y + Math.sin(a), speed, dt);
      return;
    }
    moveToward(z, wp.x, wp.y, speed, dt);
  };

  Z.tryBatter = (z, wp) => {
    // look at the tile between us and the waypoint
    const dx = wp.x - z.x, dy = wp.y - z.y; const d = Math.hypot(dx, dy) || 1;
    const b = blockerAt(z.x + (dx / d) * Math.min(d, 0.9), z.y + (dy / d) * Math.min(d, 0.9)) || blockerAt(wp.x, wp.y);
    if (!b) return false;
    if (M.dist(z.x, z.y, b.x, b.y) > 1.45) return false;
    z.state = 'batter'; z.batter = b; z.t = 0.6;
    return true;
  };
  Z.blockerGone = (b) => {
    const run = G.run;
    if (b.kind === 'door') { const d = run.doors[b.idx]; return d.open || d.broken; }
    if (b.kind === 'shelf') return !run.shelf || run.shelf.broken || run.shelf.state !== 'block';
    return true;
  };

  Z.strike = (z, tp, def) => {
    if (!tp) return;
    const d = M.dist(z.x, z.y, tp.x, tp.y);
    const targetR = z.target === 'truck' ? 0.1 : 0.32;
    if (d > def.reach + targetR + 0.35) { DH.bus.emit('whiff', z); return; }
    Z.hitTarget(z, def.dmg);
  };
  Z.hitTarget = (z, dmg) => {
    const run = G.run;
    if (z.target === 'player') DH.Player.damage(dmg, z.x, z.y, z);
    else if (z.target === 'survivor') { const s = z.sid ? G.findSurvivor(run, z.sid) : run.survivors[0]; if (s) DH.Survivor.damage(s, dmg); }
    else if (z.target === 'truck') DH.Truck.damage(2, 'claw');
    DH.bus.emit('zstrike', z);
  };

  // Serialisation helper: strip transient fields
  Z.clean = (z) => { delete z.path; return z; };
})();

