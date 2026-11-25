/* DEAD HAUL - second truck for the Long Haul convoy: follows your tracks, carries cargo, can board the ferry */
(function () {
  'use strict';
  const DH = window.DH;
  const M = DH.M, T = DH.T, G = DH.G;
  const C = (DH.Convoy = {});
  const HALF_SEG = 1.62, HW = 1.15;
  const OFFS = [-1.75, -0.9, 0, 0.9, 1.75];

  C.DRIVERS = {
    marta: { name: 'Marta', fig: 'marta', gap: 11, maxSpeed: 7.5, dur: 200, desc: 'steady, keeps her distance' },
    nell: { name: 'Nell', fig: 'survivor', gap: 8, maxSpeed: 9, dur: 200, desc: 'ex-delivery driver: tight and quick' },
    tomas: { name: 'Tomas', fig: 'tomas', gap: 11, maxSpeed: 7, dur: 260, desc: 'takes hits, loads fast' },
  };
  C.make = (x, y, ang, driver) => {
    const d = C.DRIVERS[driver] || C.DRIVERS.marta;
    return { x, y, ang, speed: 0, dur: d.dur, maxDur: d.dur, disabled: false, driver: driver || 'marta', driverName: d.name, fig: d.fig, crumbs: [], rolling: false, hurtT: 0, stuckT: 0 };
  };
  C.setDriver = (run, key) => {
    const c = run.convoy, d = C.DRIVERS[key];
    if (!c || !d || c.rolling) return false;
    const frac = c.dur / c.maxDur;
    c.driver = key; c.driverName = d.name; c.fig = d.fig; c.maxDur = d.dur; c.dur = Math.round(d.dur * frac);
    G.msg(d.name + ' takes the second truck: ' + d.desc + '.', 'good', 2.6);
    DH.bus.emit('convoyDriver', key);
    return true;
  };
  const seg = (c) => { const co = Math.cos(c.ang), s = Math.sin(c.ang); return { ax: c.x - co * HALF_SEG, ay: c.y - s * HALF_SEG, bx: c.x + co * HALF_SEG, by: c.y + s * HALF_SEG }; };
  C.distToHull = (x, y) => { const c = G.run.convoy; if (!c) return 1e9; const s = seg(c); const q = M.closestOnSeg(x, y, s.ax, s.ay, s.bx, s.by); return M.dist(x, y, q.x, q.y) - HW; };
  C.toWorld = (f, r) => { const c = G.run.convoy, co = Math.cos(c.ang), s = Math.sin(c.ang); return { x: c.x + co * f - s * r, y: c.y + s * f + co * r }; };
  C.rearPoint = () => C.toWorld(-3.3, 0);
  C.inRear = (x, y) => { const c = G.run.convoy, co = Math.cos(c.ang), s = Math.sin(c.ang); const dx = x - c.x, dy = y - c.y; const f = dx * co + dy * s, r = -dx * s + dy * co; return f < -2.0 && f > -4.8 && Math.abs(r) < 1.9; };

  // keep a person (or zombie) out of the second truck's hull
  C.pushOut = (e, r) => {
    const run = G.run, c = run && run.convoy;
    if (!c) return false;
    const s = seg(c), q = M.closestOnSeg(e.x, e.y, s.ax, s.ay, s.bx, s.by);
    const dx = e.x - q.x, dy = e.y - q.y, d = Math.hypot(dx, dy), min = HW + r;
    if (d >= min) return false;
    if (d < 1e-4) { e.x += -Math.sin(c.ang) * min; e.y += Math.cos(c.ang) * min; }
    else { e.x += (dx / d) * (min - d); e.y += (dy / d) * (min - d); }
    G.W.resolveCircle(e, r);
    return true;
  };
  // the player's truck cannot drive through the second truck; returns a contact normal for the crash logic
  C.pushTruck = (t) => {
    const c = G.run.convoy;
    if (!c) return null;
    const a = seg(c), co = Math.cos(t.ang), s = Math.sin(t.ang);
    let n = null;
    for (const o of OFFS) {
      const ex = t.x + co * o, ey = t.y + s * o;
      const q = M.closestOnSeg(ex, ey, a.ax, a.ay, a.bx, a.by);
      const dx = ex - q.x, dy = ey - q.y, d = Math.hypot(dx, dy), min = HW * 2;
      if (d < min && d > 1e-4) { const k = min - d; t.x += (dx / d) * k; t.y += (dy / d) * k; n = { x: dx / d, y: dy / d }; }
    }
    return n;
  };

  C.damage = (amount) => {
    const c = G.run.convoy;
    if (!c || c.disabled || amount <= 0) return;
    c.dur = Math.max(0, c.dur - amount); c.hurtT = 0.3;
    if (c.dur <= 0) {
      c.disabled = true; c.speed = 0;
      G.msg('The second truck is wrecked. ' + c.driverName + ' climbs out: whatever it carried stays here.', 'danger', 5);
      DH.bus.emit('convoyDown');
    } else if (c.dur < c.maxDur * 0.35 && !c._lowMsg) { c._lowMsg = true; G.radio(c.driver === 'nell' ? 'nell' : c.driver === 'tomas' ? 'tomas' : 'marta', 'Second truck is taking a beating back here. Clear me a path.', 'convoyLow'); }
  };

  // is the second truck close enough to the ferry (or the exit) to leave with you?
  C.aboard = (run, mode) => {
    const c = run.convoy;
    if (!c || c.disabled) return false;
    const z = G.W && G.W.exits.find((e) => e.kind === mode) || null;
    const t = run.truck;
    if (z) { const zx = (z.x1 + z.x2) / 2, zy = (z.y1 + z.y2) / 2; if (M.dist(c.x, c.y, zx, zy) < 26) return true; }
    return M.dist(c.x, c.y, t.x, t.y) < 22;
  };

  C.load = (run, id) => {
    const it = run.items[id];
    if (!it || !run.convoy || run.convoy.disabled) return { ok: false, msg: 'The second truck is out of action.' };
    const u = DH.Cargo.units(it);
    if (DH.Cargo.free(run, 'convoy') < u) return { ok: false, msg: 'Second truck needs ' + u + ' free units (has ' + DH.Cargo.free(run, 'convoy') + ').' };
    it.loc = 'convoy';
    return { ok: true };
  };

  C.update = (dt) => {
    const run = G.run, c = run.convoy, t = run.truck, W = G.W;
    if (!c) return;
    c.hurtT = Math.max(0, c.hurtT - dt);
    // breadcrumbs from the lead truck
    const last = c.crumbs[c.crumbs.length - 1];
    if (!last || M.dist(last.x, last.y, t.x, t.y) > 0.9) { c.crumbs.push({ x: t.x, y: t.y }); if (c.crumbs.length > 900) c.crumbs.shift(); }
    if (c.disabled) { c.speed = 0; return; }
    const d = C.DRIVERS[c.driver] || C.DRIVERS.marta;
    if (!c.rolling) {
      // rolls once you lead off: the lead truck must be underway and clear of the second truck
      if (run.player.inTruck && M.dist(t.x, t.y, c.x, c.y) > d.gap + 3 && Math.abs(t.speed) > 1) { c.rolling = true; G.radio(c.driver === 'nell' ? 'nell' : c.driver === 'tomas' ? 'tomas' : 'marta', 'Rolling. Right behind you.', 'convoyRoll'); }
      else return;
    }
    // drop crumbs we have passed
    while (c.crumbs.length > 2 && M.dist(c.x, c.y, c.crumbs[0].x, c.crumbs[0].y) < 2.2) c.crumbs.shift();
    // path distance to the lead truck along the crumbs
    let pd = 0, px = c.x, py = c.y;
    for (const q of c.crumbs) { pd += M.dist(px, py, q.x, q.y); px = q.x; py = q.y; }
    const target = c.crumbs[0] || { x: t.x, y: t.y };
    const blocked = run.zombies.some((z) => !z.dead && !z.attached && z.type === 'brute' && M.dist(z.x, z.y, c.x + Math.cos(c.ang) * 3, c.y + Math.sin(c.ang) * 3) < 2.2);
    let want = pd > d.gap ? Math.min(d.maxSpeed, (pd - d.gap) * 0.8 + 1) : 0;
    if (blocked) want = Math.min(want, 0.8);
    const a = Math.atan2(target.y - c.y, target.x - c.x);
    const da = M.angDiff(c.ang, a);
    if (Math.abs(da) > 1.0) want = Math.min(want, 2.5);
    c.speed = M.approach(c.speed, want, (want > c.speed ? 5 : 9) * dt);
    c.ang = M.normAng(c.ang + M.clamp(da * 2.4, -1.6, 1.6) * Math.min(1, Math.abs(c.speed) / 3 + 0.2) * dt);
    const ox = c.x, oy = c.y;
    c.x += Math.cos(c.ang) * c.speed * dt; c.y += Math.sin(c.ang) * c.speed * dt;
    // never through walls (crumbs come from a truck that fit, so this only trims corners)
    for (const o of OFFS) {
      const co = Math.cos(c.ang), s = Math.sin(c.ang);
      const e = { x: c.x + co * o, y: c.y + s * o }, bx = e.x, by = e.y;
      W.resolveCircle(e, HW, { truck: true });
      c.x += e.x - bx; c.y += e.y - by;
    }
    // and never through the lead truck
    const lt = DH.Truck.seg(), sg = seg(c);
    for (const o of [sg.ax, sg.bx].map((x, k) => ({ x, y: k ? sg.by : sg.ay }))) {
      const q = M.closestOnSeg(o.x, o.y, lt.ax, lt.ay, lt.bx, lt.by), dd = M.dist(o.x, o.y, q.x, q.y);
      if (dd < HW * 2 && dd > 1e-4) { const k = HW * 2 - dd; c.x += ((o.x - q.x) / dd) * k; c.y += ((o.y - q.y) / dd) * k; c.speed *= 0.5; }
    }
    const moved = M.dist(ox, oy, c.x, c.y);
    if (want > 1 && moved < 0.3 * dt) c.stuckT += dt; else c.stuckT = Math.max(0, c.stuckT - dt);
    // shoved along the crumb trail if wedged for a while (it is a scripted follower, not a puzzle)
    if (c.stuckT > 3 && c.crumbs.length > 4) { const q = c.crumbs[2]; if (DH.Truck.fits(q.x, q.y, c.ang)) { c.x = q.x; c.y = q.y; c.crumbs.splice(0, 2); } c.stuckT = 0; }
    // the dead: rammed out of the way, or they claw at it while it waits
    const s2 = seg(c);
    for (const z of run.zombies) {
      if (z.dead || z.attached) continue;
      const zr = DH.ZTYPES[z.type].radius;
      const q = M.closestOnSeg(z.x, z.y, s2.ax, s2.ay, s2.bx, s2.by);
      const dd = M.dist(z.x, z.y, q.x, q.y);
      if (dd > HW + zr + 0.6) continue;
      const nx = (z.x - q.x) / (dd || 1), ny = (z.y - q.y) / (dd || 1);
      const closing = (Math.cos(c.ang) * nx + Math.sin(c.ang) * ny) * c.speed;
      if (closing > 1.5 && (z.ramT || 0) < G.time) {
        z.ramT = G.time + 0.6;
        DH.Z.damage(z, closing * (z.type === 'brute' ? 5 : 11), c.x, c.y, 'truck');
        C.damage(z.type === 'brute' ? 12 : closing > 3.5 ? 3 : 0);
        c.speed *= z.type === 'brute' ? 0.3 : 0.85;
      } else if (dd < HW + zr + 0.4 && (z.state === 'chase' || z.state === 'investigate' || z.state === 'search') && (z.clawT || 0) < G.time) {
        z.clawT = G.time + 1.3;
        C.damage(z.type === 'brute' ? 5 : 1);
      }
      if (dd < HW + zr + 0.05) { z.x = q.x + nx * (HW + zr + 0.05); z.y = q.y + ny * (HW + zr + 0.05); W.resolveCircle(z, zr); }
    }
    if (c.speed > 0.8) {
      c.noiseT = (c.noiseT || 0) - dt;
      if (c.noiseT <= 0) { c.noiseT = 0.6; G.emitNoise(c.x, c.y, T.noise.truckMove * 0.8, 'truck', 0.7); }
    }
  };

  // tailgate prompts: load heavy gear, stow light cargo, choose the driver before you roll
  C.interact = (run, add, p) => {
    const c = run.convoy;
    if (!c) return;
    const hd = C.distToHull(p.x, p.y);
    if (hd > 1.8) return;
    if (c.disabled) { add('convoyDead', 'Second truck: wrecked', c.x, c.y, 1.2, () => {}, { disabled: true }); return; }
    const rp = C.rearPoint(), rear = C.inRear(p.x, p.y);
    const hauled = DH.Cargo.hauled(run);
    if (p.hauling && hauled && rear) {
      const lt = DH.Interact.loadTime(run, hauled) * (c.driver === 'tomas' ? 0.6 : 1);
      const free = DH.Cargo.free(run, 'convoy');
      if (Math.abs(c.speed) > 0.3) add('loadConvoy', 'Second truck is moving', rp.x, rp.y, -2, () => {}, { disabled: true });
      else if (free < DH.Cargo.units(hauled)) add('loadConvoy', 'Second truck: no room (' + free + ' free)', rp.x, rp.y, -2, () => {}, { disabled: true });
      else add('loadConvoy', 'Hold E: Load ' + DH.Cargo.label(hauled) + ' into the second truck (' + (Math.round(lt * 10) / 10) + ' s)', rp.x, rp.y, -2.2, () => DH.Player.startAction('loadConvoy', Math.round(lt * 10) / 10, 'Loading the second truck'), { hold: true });
    }
    if (rear && !p.hauling) {
      const pack = DH.Cargo.list(run, 'backpack').filter((i) => !DH.Cargo.heavy(i));
      if (pack.length && DH.Cargo.free(run, 'convoy') > 0) add('convoyStow', 'Stow backpack cargo in the second truck', rp.x, rp.y, -0.6, () => {
        let n = 0;
        for (const it of pack) { if (DH.Cargo.free(run, 'convoy') < DH.Cargo.units(it)) break; it.loc = 'convoy'; n++; }
        G.msg(n ? 'Stowed ' + n + ' item(s) in the second truck.' : 'Second truck is full.', n ? 'good' : 'warn', 1.8);
      });
    }
    if (!c.rolling && run.convoyDrivers) {
      for (const k of run.convoyDrivers) if (k !== c.driver) add('driver_' + k, 'Hand the wheel to ' + C.DRIVERS[k].name + ' (' + C.DRIVERS[k].desc + ')', c.x, c.y, 1.4, () => C.setDriver(run, k));
    }
  };
})();
