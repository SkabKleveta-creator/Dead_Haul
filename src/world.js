/* ==== world.js ==== */
/* DEAD HAUL - doors, shelf, alarm, reserve spawns */
(function () {
  'use strict';
  const DH = window.DH;
  const M = DH.M, T = DH.T, G = DH.G;
  const World = (DH.World = {});

  const occupied = (cells) => {
    const run = G.run;
    const ents = [];
    if (!run.player.inTruck) ents.push([run.player, 0.32]);
    for (const z of run.zombies) if (!z.dead && !z.attached) ents.push([z, DH.ZTYPES[z.type].radius]);
    for (const sv of run.survivors) if (sv.recruited && !sv.boarded) ents.push([sv, 0.3]);
    for (const id in run.items) { const g = run.items[id]; if (DH.Cargo.heavy(g) && (g.loc === 'world' || g.loc === 'hauled')) ents.push([g, 0.45]); }
    for (const [e, r] of ents) for (const [cx, cy] of cells) {
      const qx = M.clamp(e.x, cx, cx + 1), qy = M.clamp(e.y, cy, cy + 1);
      if (M.dist(e.x, e.y, qx, qy) < r - 0.02) return true;
    }
    return false;
  };

  World.setDoor = (i, open, by) => {
    const run = G.run, W = G.W, d = W.doors[i], st = run.doors[i];
    if (st.broken) return false;
    if (!open && occupied(d.cells)) { if (by === 'player') G.msg('Something is in the doorway.', 'warn', 1.4); return false; }
    st.open = open; d.open = open;
    W.version++;
    G.emitNoise(d.cx, d.cy, d.shutter ? 16 : 3, 'door', d.shutter ? 1.0 : 0.3);
    DH.bus.emit(d.shutter ? 'shutter' : 'door', open, d.cx, d.cy);
    return true;
  };

  World.damageBlocker = (b, dmg, z) => {
    const run = G.run, W = G.W;
    if (b.kind === 'door') {
      const st = run.doors[b.idx], d = W.doors[b.idx];
      if (st.open || st.broken) return;
      st.hp -= dmg;
      G.emitNoise(d.cx, d.cy, T.noise.door, 'bang', 0.5);
      DH.bus.emit('bang', d.cx, d.cy);
      if (st.hp <= 0) {
        st.broken = true; st.hp = 0; d.broken = true; W.version++;
        const pp = DH.Player.pos();
        if (M.dist(pp.x, pp.y, d.cx, d.cy) < 25) G.msg('A door gave way!', 'danger', 2);
        DH.bus.emit('doorBroken', d.cx, d.cy);
      }
    } else if (b.kind === 'shelf') {
      const s = run.shelf;
      if (s.broken || s.state !== 'block') return;
      s.hp -= dmg;
      const def = W.shelf.block;
      G.emitNoise(def.x, def.y, T.noise.door, 'bang', 0.5);
      DH.bus.emit('bang', def.x, def.y);
      if (s.hp <= 0) {
        s.broken = true; s.hp = 0;
        G.applyShelf();
        G.msg('The shelf barricade collapsed.', 'danger', 2);
        DH.bus.emit('doorBroken', def.x, def.y);
      }
    }
  };

  World.toggleShelf = () => {
    const run = G.run, W = G.W, s = run.shelf;
    if (s.broken) return;
    const to = s.state === 'aside' ? 'block' : 'aside';
    if (to === 'block' && occupied(W.shelf.clear)) { G.msg('Clear the doorway first.', 'warn', 1.4); return; }
    s.state = to;
    G.applyShelf();
    // make sure nobody is embedded in the shelf after moving
    const box = W.dynBoxes[0];
    if (box) {
      const ents = [run.player].concat(run.zombies.filter((z) => !z.dead && !z.attached));
      for (const e of ents) W.resolveCircle(e, 0.32);
    }
    G.msg(to === 'block' ? 'Shelf pushed across the ' + W.shelf.label.toLowerCase() + '.' : 'Shelf dragged aside.', 'info', 1.8);
    G.emitNoise(W.shelf.block.x, W.shelf.block.y, 6, 'bang', 0.4);
    DH.bus.emit('shelf', to);
  };

  World.triggerAlarm = (bump) => {
    if (!G.W.alarmCar) return false;
    const a = G.run.alarm;
    if (a.active > 0) return false;
    if (a.cooldown > 0) { if (!bump) G.msg('Alarm resetting (' + Math.ceil(a.cooldown) + ' s).', 'info', 1.5); return false; }
    a.active = T.alarm.dur; a.triggered++; a.beat = 0;
    G.msg('Car alarm blaring! The dead will come to it.', 'objective', 2.5);
    DH.bus.emit('alarm', true);
    return true;
  };

  World.update = (dt) => {
    const run = G.run, W = G.W;
    // alarm
    const a = run.alarm;
    World.updateEmitters(dt);
    if (a.active > 0 && W.alarmCar) {
      a.active -= dt; a.beat -= dt;
      if (a.beat <= 0) { a.beat = 1; G.emitNoise(W.alarmCar.x, W.alarmCar.y, T.noise.alarm, 'alarm', 1.2); }
      if (a.active <= 0) { a.active = 0; a.cooldown = T.alarm.cooldown; DH.bus.emit('alarm', false); }
    } else if (a.cooldown > 0) a.cooldown = Math.max(0, a.cooldown - dt);
    // reserve
    World.updateReserve(dt);
  };

  // Machinery and speakers: a warm-up telegraph, then periodic loud pulses that pull the dead toward them.
  World.startEmitter = (id, dur, opts) => {
    const run = G.run, e = G.emitter(run, id);
    if (!e) return null;
    e.on = true; e.warm = e.warmup || 0; e.t = dur || e.dur || 0; e.beat = 0; e.started = (e.started || 0) + 1;
    if (opts) Object.assign(e, opts);
    G.cue(e.cueLabel || 'NOISE', e.x, e.y, 'warn');
    DH.bus.emit('emitter', e, true);
    return e;
  };
  World.stopEmitter = (id) => { const e = G.emitter(G.run, id); if (!e || !e.on) return; e.on = false; e.t = 0; DH.bus.emit('emitter', e, false); };
  World.updateEmitters = (dt) => {
    const run = G.run;
    for (const e of run.emitters) {
      if (!e.on) continue;
      if (e.warm > 0) {
        e.warm -= dt; e.beat -= dt;
        if (e.beat <= 0) { e.beat = 0.7; G.emitNoise(e.x, e.y, e.r * 0.35, 'machine', 0.6); if (DH.FX) DH.FX.ring(e.x, e.y, 5, e.color || 'rgba(255,200,90,1)', 0.7); }
        if (e.warm <= 0) { e.beat = 0; DH.bus.emit('emitterLive', e); }
        continue;
      }
      e.beat -= dt;
      if (e.beat <= 0) { e.beat = e.period; G.emitNoise(e.x, e.y, e.r, 'machine', e.period + 0.3); if (DH.FX) DH.FX.ring(e.x, e.y, e.r * 0.6, e.color || 'rgba(255,200,90,1)', 1.1); }
      if (e.t > 0) { e.t -= dt; if (e.t <= 0) { e.on = false; e.t = 0; DH.bus.emit('emitter', e, false); if (e.after) { const L = G.L(); if (L.onAction) L.onAction(run, e.after, e); } } }
    }
  };
  // Pull a tagged group toward a point (used by scripted machinery). Staggered so movement reads as a crowd approaching.
  World.drawGroup = (tag, x, y, spread) => {
    const run = G.run; let n = 0;
    for (const z of run.zombies) {
      if (z.dead || z.attached || z.tag !== tag) continue;
      if (z.state === 'chase' || z.state === 'windup' || z.state === 'lunge') continue;
      z.state = 'investigate'; z.t = 40; z.path = null;
      z.tx = x + (Math.random() - 0.5) * (spread || 4); z.ty = y + (Math.random() - 0.5) * (spread || 4);
      z.investKind = 'machine';
      n++;
    }
    return n;
  };

  World.entryValid = (e) => {
    const run = G.run, W = G.W;
    const pp = DH.Player.pos();
    if (M.dist(e.x, e.y, pp.x, pp.y) < T.zombies.reserveMinDist) return false;
    if (G.onScreen && G.onScreen(e.x, e.y, 2)) return false;
    return W.circleFree(e.x, e.y, 0.4);
  };

  World.updateReserve = (dt) => {
    const run = G.run, r = run.reserve, W = G.W;
    r.heat = Math.max(0, r.heat - dt * 2.2);
    if (r.remaining <= 0) return;
    if (r.pending) {
      r.pending.t -= dt;
      if (r.pending.t > 0) return;
      const e = W.reserveEntries[r.pending.entry];
      if (!World.entryValid(e)) {
        const alt = W.reserveEntries.findIndex((q) => World.entryValid(q));
        if (alt < 0) { r.pending.t = 4; return; } // defer
        r.pending.entry = alt;
      }
      const ent = W.reserveEntries[r.pending.entry];
      const n = Math.min(r.remaining, r.groups % 2 === 0 ? 3 : 4);
      const pp = DH.Player.pos();
      for (let k = 0; k < n; k++) {
        const type = k === 0 && r.groups % 2 === 1 ? 'runner' : 'drifter';
        const spot = W.findFreeNear(ent.x + (k % 2) * 0.9, ent.y + Math.floor(k / 2) * 0.9, 0.35, 3) || { x: ent.x, y: ent.y };
        const z = DH.Z.make(run, type, spot.x, spot.y, null, true);
        z.state = 'investigate'; z.tx = pp.x + (Math.random() - 0.5) * 6; z.ty = pp.y + (Math.random() - 0.5) * 6; z.t = 40;
        run.zombies.push(z);
      }
      r.remaining -= n; r.groups++; r.lastT = run.time; r.heat = 0; r.pending = null;
      DH.bus.emit('hordeSpawn', ent);
      return;
    }
    if (run.time - r.lastT < T.zombies.reserveGap) return;
    const due = r.heat >= 90 || run.time >= 210 + r.groups * 110;
    if (!due) return;
    const pp = DH.Player.pos();
    const opts = W.reserveEntries.map((e, i) => ({ e, i, d: M.dist(e.x, e.y, pp.x, pp.y) })).filter((o) => World.entryValid(o.e)).sort((a, b) => a.d - b.d);
    if (!opts.length) { r.lastT = run.time - T.zombies.reserveGap + 5; return; } // retry in 5 s
    const pick = opts[Math.min(opts.length - 1, 1)];
    r.pending = { entry: pick.i, t: run.perks && run.perks.relay ? 8 : 5 };
    r.lastT = run.time;
    G.cue('HORDE', pick.e.x, pick.e.y, 'danger');
    if (run.perks && run.perks.wes && DH.Story) G.radio('wes', 'Movement on the ' + pick.e.name + ' side. A group, heading in.', null, 3.5);
    else G.msg('More of them moving in from the ' + pick.e.name + ' edge.', 'danger', 3.5);
    DH.bus.emit('hordeWarn', pick.e);
  };
})();

