/* ==== truck.js ==== */
/* DEAD HAUL - recovery truck: driving, collisions, clingers, enter/exit, recovery */
(function () {
  'use strict';
  const DH = window.DH;
  const M = DH.M, T = DH.T, G = DH.G;

  const Truck = (DH.Truck = {});
  const HALF_SEG = 1.62, HW = 1.15;
  Truck.HW = HW; Truck.HALF_SEG = HALF_SEG;
  const OFFS = [-1.75, -0.9, 0, 0.9, 1.75];

  Truck.dir = () => { const t = G.run.truck; return { x: Math.cos(t.ang), y: Math.sin(t.ang) }; };
  Truck.seg = () => { const t = G.run.truck, c = Math.cos(t.ang), s = Math.sin(t.ang); return { ax: t.x - c * HALF_SEG, ay: t.y - s * HALF_SEG, bx: t.x + c * HALF_SEG, by: t.y + s * HALF_SEG }; };
  Truck.distToHull = (x, y) => { const s = Truck.seg(); const q = M.closestOnSeg(x, y, s.ax, s.ay, s.bx, s.by); return M.dist(x, y, q.x, q.y) - HW; };
  Truck.closestHullPoint = (x, y) => {
    const s = Truck.seg(); const q = M.closestOnSeg(x, y, s.ax, s.ay, s.bx, s.by);
    const d = M.dist(x, y, q.x, q.y) || 1;
    return { x: q.x + ((x - q.x) / d) * HW, y: q.y + ((y - q.y) / d) * HW };
  };
  // local coordinates of a point relative to truck (fwd, right)
  Truck.local = (x, y) => { const t = G.run.truck, c = Math.cos(t.ang), s = Math.sin(t.ang); const dx = x - t.x, dy = y - t.y; return { f: dx * c + dy * s, r: -dx * s + dy * c }; };
  Truck.toWorld = (f, r) => { const t = G.run.truck, c = Math.cos(t.ang), s = Math.sin(t.ang); return { x: t.x + c * f - s * r, y: t.y + s * f + c * r }; };

  Truck.pushOut = (e, r) => {
    const run = G.run;
    if (!run) return false;
    const s = Truck.seg();
    const q = M.closestOnSeg(e.x, e.y, s.ax, s.ay, s.bx, s.by);
    const dx = e.x - q.x, dy = e.y - q.y; const d = Math.hypot(dx, dy);
    const min = HW + r;
    if (d >= min) return false;
    if (d < 1e-4) { const t = run.truck; e.x += -Math.sin(t.ang) * min; e.y += Math.cos(t.ang) * min; }
    else { e.x += (dx / d) * (min - d); e.y += (dy / d) * (min - d); }
    G.W.resolveCircle(e, r);
    return true;
  };

  Truck.damage = (amount, kind) => {
    const run = G.run, t = run.truck;
    if (t.disabled || amount <= 0) return;
    if (kind === 'collision' || kind === 'ram') amount *= G.upg.bumper ? 0.65 : 1;
    t.dur = Math.max(0, t.dur - amount);
    t.hurtT = 0.3;
    DH.bus.emit('truckHit', amount, kind);
    if (t.dur <= 0) {
      t.disabled = true; t.engine = false; t.speed = 0;
      for (const c of t.clingers.slice()) { const z = run.zombies.find((q) => q.id === c.zid); if (z) DH.Z.detach(z, false); }
      t.clingers = [];
      G.msg('TRUCK DISABLED. Cargo is still in the bed. Repair kit (4 s) or evacuate on foot.', 'danger', 5);
      DH.bus.emit('truckDisabled');
    }
  };

  Truck.attach = (z) => {
    const t = G.run.truck;
    if (t.clingers.length >= 2 || t.clingers.some((c) => c.zid === z.id)) return false;
    const l = Truck.local(z.x, z.y);
    let side = l.r >= 0 ? 1 : -1;
    const taken = t.clingers.map((c) => c.side + ':' + c.slot);
    let slot = l.f > -0.2 ? 0 : 1;
    if (taken.indexOf(side + ':' + slot) >= 0) slot = 1 - slot;
    if (taken.indexOf(side + ':' + slot) >= 0) { side = -side; slot = 0; if (taken.indexOf(side + ':' + slot) >= 0) slot = 1; }
    t.clingers.push({ zid: z.id, side, slot });
    z.attached = { side, slot };
    z.state = 'attached';
    Truck.placeClinger(z);
    G.msg('Clinger on the ' + (side > 0 ? 'passenger' : 'driver') + ' side! Stop, exit and knock it off.', 'danger', 3);
    DH.bus.emit('clingerOn', z);
    return true;
  };
  Truck.placeClinger = (z) => {
    if (!z.attached) return;
    const p = Truck.toWorld(z.attached.slot === 0 ? 0.7 : -1.3, z.attached.side * (HW + 0.22));
    z.x = p.x; z.y = p.y;
    z.face = G.run.truck.ang - z.attached.side * Math.PI / 2;
  };

  Truck.rearSpot = (r) => {
    const W = G.W;
    for (const [f, rr] of [[-3.6, 0], [-3.6, 0.9], [-3.6, -0.9], [-4.4, 0], [-2.2, 2.0], [-2.2, -2.0]]) {
      const p = Truck.toWorld(f, rr);
      if (W.circleFree(p.x, p.y, r || 0.45) && Truck.distToHull(p.x, p.y) > (r || 0.45)) return p;
    }
    return null;
  };
  Truck.rearPoint = () => Truck.toWorld(-3.3, 0);
  Truck.inRearZone = (x, y) => { const l = Truck.local(x, y); return l.f < -2.0 && l.f > -4.8 && Math.abs(l.r) < 1.9; };

  // ---------- Enter / exit ----------
  Truck.enter = () => {
    const run = G.run, p = run.player, t = run.truck;
    if (p.hauling) { G.msg('Release the ' + DH.Cargo.label(DH.Cargo.hauled(run) || { kind: 'generator' }).toLowerCase() + ' first (X).', 'warn', 1.6); return; }
    p.inTruck = true; p.action = null; p.reload = 0;
    G.transferOpen = false;
    t.engine = !t.disabled;
    t.stuckT = 0;
    DH.bus.emit('enterTruck');
    if (!run.truckIntroShown) { run.truckIntroShown = true; DH.bus.emit('truckIntro'); }
    if (t.disabled) G.msg('The truck is disabled. Repair it from outside with a kit.', 'warn', 2.5);
  };
  Truck.exitSpot = () => {
    const run = G.run, W = G.W;
    const cands = [[0.5, -(HW + 0.6)], [0.5, HW + 0.6], [-1.2, -(HW + 0.6)], [-1.2, HW + 0.6], [-3.5, 0], [3.5, 0], [1.6, -(HW + 0.7)], [1.6, HW + 0.7]];
    for (const [f, r] of cands) {
      const q = Truck.toWorld(f, r);
      if (!W.circleFree(q.x, q.y, T.player.radius + 0.02)) continue;
      if (W.raycast(run.truck.x, run.truck.y, q.x, q.y) >= 0) continue;
      let blocked = false;
      for (const z of run.zombies) if (!z.dead && !z.attached && M.dist(z.x, z.y, q.x, q.y) < 1.1) { blocked = true; break; }
      if (blocked) continue;
      return q;
    }
    return null;
  };
  Truck.exit = () => {
    const run = G.run, p = run.player, t = run.truck;
    if (Math.abs(t.speed) > 0.8) { G.msg('Slow down to get out.', 'warn', 1.4); return false; }
    const q = Truck.exitSpot();
    if (!q) { G.msg('No safe place to step out here.', 'warn', 1.8); return false; }
    p.inTruck = false; p.x = q.x; p.y = q.y; p.iframes = Math.max(p.iframes, 0.4);
    t.engine = false; t.speed = 0;
    DH.bus.emit('exitTruck');
    DH.Survivor.onPlayerExit();
    return true;
  };

  // ---------- Recovery ----------
  Truck.fits = (x, y, ang) => {
    const W = G.W, c = Math.cos(ang), s = Math.sin(ang);
    for (const o of OFFS) { if (!W.circleFree(x + c * o, y + s * o, HW + 0.05, { truck: true })) return false; }
    for (const z of G.run.zombies) if (!z.dead && !z.attached && M.dist(z.x, z.y, x, y) < 3.2) return false;
    return true;
  };
  Truck.recover = () => {
    const run = G.run, W = G.W, t = run.truck;
    if (Math.abs(t.speed) > 0.4) return false;
    const cands = [];
    const cx = Math.floor(t.x), cy = Math.floor(t.y);
    const RR = run.perks && run.perks.winch ? 32 : 22;
    for (let dy = -RR; dy <= RR; dy++) for (let dx = -RR; dx <= RR; dx++) {
      const x = cx + dx, y = cy + dy;
      if (!W.inB(x, y)) continue;
      if (W.level === 1 ? W.floor[W.idx(x, y)] !== DH.FLOOR.ROAD : !W.isRoadFloor(x, y)) continue;
      const d = Math.hypot(dx, dy);
      if (d < 2.5 || d > RR) continue;
      cands.push({ x: x + 0.5, y: y + 0.5, d });
    }
    cands.sort((a, b) => a.d - b.d);
    const angs = [t.ang, 0, Math.PI / 2, Math.PI, -Math.PI / 2];
    for (const c of cands) {
      for (const a of angs) {
        if (Truck.fits(c.x, c.y, a)) {
          // no exit-zone teleports
          if (G.W.exits.some((z) => G.inZone(z, c.x, c.y))) continue;
          t.x = c.x; t.y = c.y; t.ang = a; t.speed = 0; t.stuckT = 0;
          for (const cl of t.clingers) { const z = run.zombies.find((q) => q.id === cl.zid); if (z) Truck.placeClinger(z); }
          G.msg('Truck repositioned to open road.', 'info', 2);
          DH.bus.emit('truckRecovered');
          return true;
        }
      }
    }
    G.msg('No clear road nearby to recover to.', 'warn', 2);
    return false;
  };

  // ---------- Update ----------
  Truck.update = (dt, inp) => {
    const run = G.run, W = G.W, t = run.truck, p = run.player;
    t.hurtT = Math.max(0, (t.hurtT || 0) - dt);
    t.recoverT = Math.max(0, t.recoverT - dt);
    // clinger damage
    if (t.clingers.length && !t.disabled) {
      t.clingAcc = (t.clingAcc || 0) + dt * 3 * t.clingers.length;
      if (t.clingAcc >= 1) { const d = Math.floor(t.clingAcc); t.clingAcc -= d; Truck.damage(d, 'clinger'); }
    }
    t.engine = p.inTruck && !t.disabled;
    const drive = inp.drive || {};
    const wantMove = p.inTruck && !t.disabled && G.state === 'play';
    const throttle = wantMove ? drive.throttle || 0 : 0;
    const brake = wantMove ? drive.brake || 0 : 0;
    const steerIn = wantMove ? drive.steer || 0 : 0;
    const hb = wantMove ? !!drive.handbrake : false;
    const D = T.truck;
    let v = t.speed;
    if (throttle > 0) { if (v < -0.2) v = M.approach(v, 0, D.brake * dt); else v += D.accel * throttle * dt * (v > 7 ? 0.55 : 1); }
    if (brake > 0) { if (v > 0.3) v = M.approach(v, 0, D.brake * dt); else v -= D.accel * 0.7 * brake * dt; }
    if (!throttle && !brake) v = M.approach(v, 0, 1.3 * dt);
    if (hb) v = M.approach(v, 0, 13 * dt);
    if (!p.inTruck || t.disabled) v = M.approach(v, 0, 10 * dt);
    const wetT = W.isWater(Math.floor(t.x), Math.floor(t.y));
    t.wet = wetT;
    v = M.clamp(v, -D.maxRev, wetT ? D.maxFwd * 0.6 : D.maxFwd);
    t.steer = M.approach(t.steer, steerIn, dt * 4.5);
    const yaw = t.steer * Math.min(Math.abs(v) / 4.8, 1.55) * Math.sign(v);
    t.ang = M.normAng(t.ang + yaw * dt);
    const ox = t.x, oy = t.y;
    t.x += Math.cos(t.ang) * v * dt; t.y += Math.sin(t.ang) * v * dt;
    t.speed = v;
    // collisions vs world
    let impactN = null;
    for (let it = 0; it < 2; it++) {
      for (const o of OFFS) {
        const c = Math.cos(t.ang), s = Math.sin(t.ang);
        const e = { x: t.x + c * o, y: t.y + s * o };
        const bx = e.x, by = e.y;
        W.resolveCircle(e, HW, { truck: true });
        const px = e.x - bx, py = e.y - by;
        if (px || py) { t.x += px; t.y += py; const l = Math.hypot(px, py); if (l > 0.001) impactN = { x: px / l, y: py / l }; }
      }
    }
    if (impactN) {
      const vx = Math.cos(t.ang) * v, vy = Math.sin(t.ang) * v;
      const vn = -(vx * impactN.x + vy * impactN.y); // speed into obstacle
      if (vn > 0.3) {
        const head = Math.abs(Math.cos(t.ang) * impactN.x + Math.sin(t.ang) * impactN.y);
        t.speed *= 1 - 0.75 * head;
        if (vn > 2.4 && G.time - t.lastHit > 0.5) {
          t.lastHit = G.time;
          const cost = Math.min(D.sceneryMax, (vn - 2.0) * 3.4);
          Truck.damage(cost, 'collision');
          G.emitNoise(t.x, t.y, T.noise.impact, 'impact', 0.5);
          DH.bus.emit('truckCrash', vn);
          if (DH.FX) DH.FX.shake(Math.min(0.5, vn * 0.05));
          // alarm car bump
          const ac = W.alarmCar;
          if (ac && M.dist(t.x, t.y, ac.x, ac.y) < 4.8) DH.World.triggerAlarm(true);
        }
      }
    }
    // stuck detection
    const moved = M.dist(ox, oy, t.x, t.y);
    if (p.inTruck && (throttle || brake) && moved < 0.5 * dt) t.stuckT += dt; else if (moved > 1.0 * dt) t.stuckT = Math.max(0, t.stuckT - dt * 2);
    // zombies: ramming and pushing
    const seg = Truck.seg();
    for (const z of run.zombies) {
      if (z.dead || z.attached) continue;
      const zr = DH.ZTYPES[z.type].radius;
      const q = M.closestOnSeg(z.x, z.y, seg.ax, seg.ay, seg.bx, seg.by);
      const d = M.dist(z.x, z.y, q.x, q.y);
      if (d > HW + zr + 0.05) continue;
      const nx = (z.x - q.x) / (d || 1), ny = (z.y - q.y) / (d || 1);
      const vx = Math.cos(t.ang) * t.speed, vy = Math.sin(t.ang) * t.speed;
      const closing = vx * nx + vy * ny; // speed toward zombie
      if (closing > 1.2 && (z.ramT || 0) < G.time) {
        // any real push hurts: ~4.6 m/s kills a drifter outright, slower hits knock down and wound
        z.ramT = G.time + 0.6;
        const hard = closing > 3.5;
        DH.Z.damage(z, closing * 12, t.x, t.y, 'truck');
        if (hard) Truck.damage(D.lightHitCost, 'ram');
        t.speed *= hard ? 0.88 : 0.93;
        if (!z.dead) { z.stagImmune = 0; DH.Z.stagger(z, hard ? 1.0 : 0.7, q.x, q.y, false); }
        G.W.moveCircle(z, nx * (1.0 + closing * 0.18), ny * (1.0 + closing * 0.18), zr);
        if (DH.FX) { DH.FX.blood(z.x, z.y, Math.atan2(ny, nx)); if (hard) DH.FX.shake(0.12); }
        DH.bus.emit('ram', z);
      } else {
        z.x = q.x + nx * (HW + zr + 0.05); z.y = q.y + ny * (HW + zr + 0.05);
        W.resolveCircle(z, zr);
      }
    }
    // keep player / survivor out of the hull
    if (!p.inTruck) Truck.pushOut(p, T.player.radius);
    for (const sv of run.survivors) if (sv.recruited && !sv.boarded && !sv.safe) Truck.pushOut(sv, 0.3);
    for (const id in run.items) {
      const g = run.items[id];
      if (DH.Cargo.heavy(g) && (g.loc === 'world' || g.loc === 'hauled')) { const e = { x: g.x, y: g.y }; if (Truck.pushOut(e, 0.45)) { g.x = e.x; g.y = e.y; } }
    }
    if (wetT && Math.abs(t.speed) > 1.5 && DH.FX && Math.random() < dt * 14) DH.FX.splash(t.x - Math.cos(t.ang) * 2 + (Math.random() - 0.5) * 2, t.y - Math.sin(t.ang) * 2 + (Math.random() - 0.5) * 2);
    // engine noise, bounded (merged events)
    if (t.engine) {
      t.noiseT = (t.noiseT || 0) - dt;
      if (t.noiseT <= 0) {
        t.noiseT = 0.5;
        const r = (Math.abs(t.speed) > 0.8 ? T.noise.truckMove : T.noise.truckIdle) * G.truckNoiseMul() * (wetT && Math.abs(t.speed) > 0.8 ? 1.15 : 1);
        G.emitNoise(t.x, t.y, r, 'truck', 0.7);
        p.noiseLevel = Math.max(p.noiseLevel, r);
      }
    }
    // clingers follow
    for (const c of t.clingers) { const z = run.zombies.find((q) => q.id === c.zid); if (z) Truck.placeClinger(z); }
    t.clingers = t.clingers.filter((c) => { const z = run.zombies.find((q) => q.id === c.zid); return z && !z.dead; });
    // rasterize the truck footprint for human pathfinding (survivor, routing)
    if (!t._rx || M.dist(t._rx, t._ry, t.x, t.y) > 0.15 || Math.abs(M.angDiff(t._ra, t.ang)) > 0.05) {
      t._rx = t.x; t._ry = t.y; t._ra = t.ang;
      for (const i of W.truckCells) W.truckBlock[i] = 0;
      W.truckCells.length = 0;
      const sg = Truck.seg();
      for (let y = Math.floor(t.y - 4); y <= Math.floor(t.y + 4); y++) for (let x = Math.floor(t.x - 4); x <= Math.floor(t.x + 4); x++) {
        if (!W.inB(x, y)) continue;
        const q = M.closestOnSeg(x + 0.5, y + 0.5, sg.ax, sg.ay, sg.bx, sg.by);
        if (M.dist(x + 0.5, y + 0.5, q.x, q.y) < HW + 0.15) { const i = W.idx(x, y); W.truckBlock[i] = 1; W.truckCells.push(i); }
      }
    }
    // driving-only inputs
    if (p.inTruck && G.state === 'play') {
      if (inp.interactPressed && !inp._consumed) { Truck.exit(); inp._consumed = true; }
      if (inp.recover && t.stuckT > 1.0) Truck.recover();
      if (inp.depart && G.inExit && (G.inExit.kind === 'truck' || G.inExit.kind === 'ferry')) G.openDepart(G.inExit);
      if (inp.command) DH.Survivor.command();
    }
  };
})();

