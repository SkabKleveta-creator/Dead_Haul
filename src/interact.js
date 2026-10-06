/* DEAD HAUL - context interactions (priority by proximity + facing) */
(function () {
  'use strict';
  const DH = window.DH;
  const M = DH.M, T = DH.T, G = DH.G;
  const I = (DH.Interact = { primary: null, alts: [] });
  const CAPS = { medkits: 4, noisemakers: 4, repairkits: 2 };

  I.loadTime = (run, it) => {
    const base = (DH.ITEMS[it.kind] && DH.ITEMS[it.kind].load) || T.generator.load;
    let t = base * (G.upg.gear ? T.generator.loadGear / T.generator.load : 1);
    if (run.perks && run.perks.crew) t *= 0.6;
    return Math.round(t * 10) / 10;
  };
  I.repairTime = (run) => (run.perks && run.perks.winch ? T.repair.timeWinch : T.repair.time);

  I.releaseHaul = () => {
    const run = G.run, p = run.player, g = DH.Cargo.hauled(run);
    if (!p.hauling) return;
    p.hauling = false; p.haulId = null;
    if (g && g.loc === 'hauled') {
      g.loc = 'world';
      const e = { x: g.x, y: g.y };
      G.W.resolveCircle(e, 0.45);
      g.x = e.x; g.y = e.y;
    }
    if (p.action && p.action.kind === 'loadGen') p.action = null;
    G.msg((g ? DH.Cargo.label(g) : 'Load') + ' released.', 'info', 1.2);
    DH.bus.emit('release');
  };
  I.releaseGenerator = I.releaseHaul;
  I.startHaul = (it) => {
    const run = G.run, p = run.player;
    p.hauling = true; p.haulId = it.id; it.loc = 'hauled'; p.reload = 0;
    run.seen[it.id] = true; if (it.kind === 'generator') run.seenGenerator = true;
    G.msg('Hauling the ' + DH.Cargo.label(it).toLowerCase() + '. ' + (it.haulTip || 'Get it to the back of the stopped truck.') + ' X releases.', 'objective', 3.5);
    DH.bus.emit('haul', it);
  };

  I.takePickup = (k) => {
    const run = G.run, p = run.player;
    if (k.taken) return;
    if (k.kind === 'weapon') {
      const def = DH.WEAPONS[k.wtype];
      const have = p.weapons.findIndex((w) => w.type === k.wtype);
      const addAmmo = (n) => { const room = def.cap - p.ammo[def.ammo]; const take = Math.min(room, n); p.ammo[def.ammo] += take; return take; };
      if (have >= 0) {
        const got = addAmmo(k.mag + (k.reserve || 0));
        if (got <= 0) { G.msg(def.name + ' ammo is full.', 'info', 1.5); return; }
        let left = k.mag + (k.reserve || 0) - got;
        k.mag = Math.min(k.mag, left); k.reserve = Math.max(0, left - k.mag);
        if (left <= 0) k.taken = true;
        G.msg('+' + got + ' ' + DH.AMMO_NAMES[def.ammo] + ' from the spare ' + def.name + '.', 'good', 1.8);
        DH.bus.emit('pickup', 'ammo');
        return;
      }
      if (k.reserve) { addAmmo(k.reserve); k.reserve = 0; }
      const nw = { type: k.wtype, mag: k.mag };
      if (p.weapons.length < 2) { p.weapons.push(nw); p.cur = p.weapons.length - 1; k.taken = true; }
      else {
        const old = p.weapons[p.cur];
        p.weapons[p.cur] = nw;
        const spot = G.W.findFreeNear(p.x + Math.cos(p.aim + Math.PI) * 0.6, p.y + Math.sin(p.aim + Math.PI) * 0.6, 0.2, 2, p.x, p.y) || { x: p.x, y: p.y };
        k.wtype = old.type; k.mag = old.mag; k.reserve = 0; k.x = spot.x; k.y = spot.y; k.cabinet = false; k.crate = false; k.dropped = true;
        G.msg('Dropped the ' + DH.WEAPONS[old.type].name + '.', 'info', 1.6);
      }
      p.reload = 0; p.fireCd = 0.3;
      G.msg('Picked up ' + def.name + ' (' + DH.AMMO_NAMES[def.ammo] + ' ' + (nw.mag + p.ammo[def.ammo]) + ').', 'good', 2.2);
      DH.bus.emit('pickup', 'weapon');
      return;
    }
    if (k.kind === 'ammo') {
      const def = Object.values(DH.WEAPONS).find((w) => w.ammo === k.atype);
      const room = def.cap - p.ammo[k.atype];
      if (room <= 0) { G.msg(DH.AMMO_NAMES[k.atype] + ' pouch full.', 'info', 1.4); return; }
      const take = Math.min(room, k.n);
      p.ammo[k.atype] += take; k.n -= take;
      if (k.n <= 0) k.taken = true;
      G.msg('+' + take + ' ' + DH.AMMO_NAMES[k.atype] + ' ammo.', 'good', 1.6);
      DH.bus.emit('pickup', 'ammo');
      return;
    }
    if (k.kind === 'note') {
      k.taken = true;
      run.flags['note_' + (k.key || k.id)] = true;
      G.msg(k.text, 'note', Math.min(9, 4 + k.text.length / 30));
      DH.bus.emit('pickup', 'note');
      const L = G.L(); if (L.onAction) L.onAction(run, 'note', k);
      return;
    }
    const field = k.kind === 'medkit' ? 'medkits' : k.kind === 'noisemaker' ? 'noisemakers' : 'repairkits';
    if (p[field] >= CAPS[field]) { G.msg('Carrying the maximum (' + CAPS[field] + ').', 'info', 1.4); return; }
    p[field] += k.n; k.taken = true;
    G.msg('+1 ' + (k.kind === 'medkit' ? 'medical kit' : k.kind === 'noisemaker' ? 'noise maker' : 'truck repair kit') + '.', 'good', 1.6);
    DH.bus.emit('pickup', k.kind);
  };

  const pickupLabel = (k) => {
    if (k.kind === 'weapon') return (k.cabinet ? 'Take ' : k.crate ? 'Open crate: ' : 'Take ') + DH.WEAPONS[k.wtype].name;
    if (k.kind === 'ammo') return 'Take ' + DH.AMMO_NAMES[k.atype] + ' ammo (' + k.n + ')';
    if (k.kind === 'medkit') return 'Take Medical Kit';
    if (k.kind === 'noisemaker') return 'Take Noise Maker';
    if (k.kind === 'note') return 'Read ' + (k.label || 'note');
    return 'Take Truck Repair Kit';
  };

  I.candidates = () => {
    const run = G.run, W = G.W, p = run.player, t = run.truck;
    const out = [];
    const face = p.face;
    const add = (id, label, x, y, base, fn, extra) => {
      const d = M.dist(p.x, p.y, x, y);
      const a = Math.atan2(y - p.y, x - p.x);
      const pen = d > 0.5 ? (Math.abs(M.angDiff(face, a)) / Math.PI) * 0.8 : 0;
      out.push(Object.assign({ id, label, x, y, score: base + d + pen, run: fn }, extra || {}));
    };
    I.add = add;
    for (const k of run.pickups) if (!k.taken && M.dist(p.x, p.y, k.x, k.y) < 1.4 && W.los(p.x, p.y, k.x, k.y)) add(k.id, pickupLabel(k), k.x, k.y, k.kind === 'note' ? 0.3 : 0, () => I.takePickup(k));
    // cargo
    for (const id in run.items) {
      const it = run.items[id];
      if (it.loc !== 'world') continue;
      if (DH.Cargo.heavy(it)) {
        if (!p.hauling && M.dist(p.x, p.y, it.x, it.y) < 1.7) add(id === 'generator' ? 'gen' : 'haul_' + id, 'Haul ' + DH.Cargo.label(it) + ' (slow, no firing)', it.x, it.y, -0.1, () => I.startHaul(it));
        continue;
      }
      if (M.dist(p.x, p.y, it.x, it.y) < 1.4 && W.los(p.x, p.y, it.x, it.y)) add(id, 'Take ' + DH.Cargo.label(it), it.x, it.y, -0.3, () => { const r = DH.Cargo.pickUp(run, id); const prim = DH.ITEMS[it.kind].primary; G.msg(r.msg, r.ok ? (prim ? 'objective' : 'good') : 'warn', r.ok && prim ? 3.5 : 1.8); if (r.ok) DH.bus.emit('cargoPickup', it.kind, it); });
    }
    const hauled = DH.Cargo.hauled(run);
    if (p.hauling && hauled) add('release', 'Release ' + DH.Cargo.label(hauled), hauled.x, hauled.y, 2.5, () => I.releaseHaul());
    // doors
    W.doors.forEach((d, i) => {
      const st = run.doors[i];
      if (st.broken) return;
      if (M.dist(p.x, p.y, d.cx, d.cy) > (d.w > 2 ? 2.6 : 1.8)) return;
      if (st.locked && !st.open) {
        if (d.pry) add(d.id, 'Hold E: Pry open ' + d.label + ' (' + d.pry + ' s, loud)', d.cx, d.cy, 0.1, () => DH.Player.startAction('pry', d.pry, 'Prying ' + d.label, { door: i, hold: true, noise: 6 }), { hold: true });
        else add(d.id, d.lockedMsg || d.label + ' (locked)', d.cx, d.cy, 0.4, () => G.msg(d.lockedMsg || 'Locked.', 'warn', 1.6), { disabled: true });
        return;
      }
      if (d.needs && !run.flags[d.needs]) { add(d.id, d.label + ': ' + (d.needsMsg || 'no power'), d.cx, d.cy, 0.4, () => G.msg(d.needsMsg || 'No power.', 'warn', 1.8), { disabled: true }); return; }
      if (d.manualOnly === false) return;
      add(d.id, (st.open ? (d.shutter ? 'Lower ' : 'Close ') : (d.shutter ? 'Raise ' : 'Open ')) + d.label, d.cx, d.cy, 0.25, () => DH.World.setDoor(i, !st.open, 'player'));
    });
    // alarm
    const ac = W.alarmCar;
    if (ac && M.dist(p.x, p.y, ac.x, ac.y) < 2.9) {
      const a = run.alarm;
      const lbl = a.active > 0 ? 'Alarm is blaring' : a.cooldown > 0 ? 'Car Alarm (resetting ' + Math.ceil(a.cooldown) + ' s)' : 'Trigger Car Alarm';
      add('alarm', lbl, ac.x, ac.y, 0.6, () => DH.World.triggerAlarm(false), { disabled: a.active > 0 || a.cooldown > 0 });
    }
    // shelf
    const s = run.shelf;
    if (W.shelf && s && !s.broken) {
      const pos = s.state === 'block' ? W.shelf.block : W.shelf.aside;
      if (M.dist(p.x, p.y, pos.x, pos.y) < 2.0) add('shelf', s.state === 'aside' ? 'Push Shelf Across ' + W.shelf.label : 'Drag Shelf Aside', pos.x, pos.y, 0.5, () => DH.Player.startAction('shelf', 0.8, 'Moving shelf'));
    }
    // survivors
    run.survivors.forEach((sv, k) => {
      const sid = k === 0 ? '' : '_' + sv.id;
      if (!sv.recruited && M.dist(p.x, p.y, sv.x, sv.y) < 2.1 && W.los(p.x, p.y, sv.x, sv.y) && !sv.locked) add('recruit' + sid, 'Recruit ' + sv.name, sv.x, sv.y, -0.2, () => DH.Survivor.recruit(sv));
      if (sv.recruited && sv.state === 'downed' && M.dist(p.x, p.y, sv.x, sv.y) < 1.9) add('revive' + sid, p.medkits > 0 ? 'Revive ' + sv.name + ' (4 s, 1 medkit)' : 'Revive ' + sv.name + ' (needs a medkit)', sv.x, sv.y, -0.4, () => DH.Player.startAction('revive', T.survivor.revive, 'Reviving ' + sv.name, { sid: sv.id }), { disabled: p.medkits <= 0 });
    });
    // level-specific equipment, switches and sockets
    const L = G.L();
    if (L.interact) L.interact(run, add, p);
    // truck
    const hd = DH.Truck.distToHull(p.x, p.y);
    if (hd < 1.7) {
      const rear = DH.Truck.inRearZone(p.x, p.y);
      const rp = DH.Truck.rearPoint();
      const stopped = Math.abs(t.speed) < 0.3;
      for (const c of t.clingers) {
        const z = run.zombies.find((q) => q.id === c.zid);
        if (z && M.dist(p.x, p.y, z.x, z.y) < 2.2) add('clinger' + z.id, 'Remove Clinger', z.x, z.y, -1.5, () => DH.Player.startAction('removeClinger', 0.45, 'Prying clinger', { zid: z.id }));
      }
      if (p.hauling && rear && hauled) {
        const nm = DH.Cargo.label(hauled);
        const cl = DH.Cargo.canLoadHeavy(run, hauled.id);
        const near = M.dist(hauled.x, hauled.y, rp.x, rp.y) < 3.6;
        const lt = I.loadTime(run, hauled);
        if (!stopped) add('loadGen', 'Load ' + nm + ' (truck must be stopped)', rp.x, rp.y, -2, () => {}, { disabled: true });
        else if (!cl.ok) add('loadGen', 'Load ' + nm + ': ' + cl.msg, rp.x, rp.y, -2, () => G.msg(cl.msg, 'warn', 2), { disabled: true });
        else if (!near) add('loadGen', 'Bring the ' + nm.toLowerCase() + ' closer to the tailgate', rp.x, rp.y, -2, () => {}, { disabled: true });
        else add('loadGen', 'Hold E: Load ' + nm + ' (' + lt + ' s)', rp.x, rp.y, -2, () => DH.Player.startAction('loadGen', lt, 'Loading ' + nm.toLowerCase()), { hold: true });
      }
      if (rear && !p.hauling) add('transfer', 'Transfer Cargo (backpack ⇄ truck)', rp.x, rp.y, -0.8, () => { G.transferOpen = true; DH.bus.emit('transferOpen'); });
      if (rear && !p.hauling) for (const it of DH.Cargo.heavyInTruck(run)) add(it.id === 'generator' ? 'unloadGen' : 'unload_' + it.id, 'Hold E: Unload ' + DH.Cargo.label(it), rp.x, rp.y, 0.9, () => DH.Player.startAction('unloadGen', 1.2, 'Unloading ' + DH.Cargo.label(it).toLowerCase(), { id: it.id }), { hold: true });
      const tp = { x: t.x, y: t.y };
      add('enter', t.disabled ? 'Enter Truck (disabled)' : 'Enter Truck', tp.x, tp.y, rear ? 1.6 : -1.0, () => DH.Truck.enter());
      const rt = I.repairTime(run);
      if (t.dur < T.truck.durability) add('repair', p.repairkits > 0 ? 'Repair Truck (' + rt + ' s, 1 kit)' : 'Repair Truck (no kit)', tp.x, tp.y, t.disabled ? -1.2 : 1.2, () => { if (p.repairkits > 0) DH.Player.startAction('repair', rt, 'Repairing truck'); }, { disabled: p.repairkits <= 0 });
    }
    out.sort((a, b) => a.score - b.score);
    return out;
  };

  I.update = (dt, inp) => {
    const run = G.run, p = run.player;
    if (p.inTruck || p.dead) { I.primary = null; I.alts = []; G.transferOpen = false; return; }
    if (G.transferOpen && (!DH.Truck.inRearZone(p.x, p.y) || DH.Truck.distToHull(p.x, p.y) > 2.2)) { G.transferOpen = false; DH.bus.emit('transferClose'); }
    const c = I.candidates();
    I.primary = c[0] || null;
    I.alts = c.slice(1, 4);
    if (inp._consumed) return;
    // a press targets the prompt that was displayed (by id); if that action is gone this frame, nothing else runs
    const pick = (id, fallback) => (id == null ? fallback : c.find((q) => q.id === id) || null);
    const prim = pick(inp.primaryId, I.primary);
    if (inp.interactPressed && prim && !p.action) {
      if (prim.disabled) { if (prim.run) prim.run(); }
      else prim.run();
      inp._consumed = true;
    }
    if (inp.alt) for (let k = 0; k < 3; k++) {
      if (!inp.alt[k] || p.action || inp._consumed) continue;
      const a = pick(inp.altIds ? inp.altIds[k] : null, I.alts[k]);
      if (a && !a.disabled) { a.run(); if (p.action && a.hold) p.action.noHold = true; inp._consumed = true; }
    }
  };

  // ---------- Transfer panel operations ----------
  I.transfer = (id, to) => {
    const r = DH.Cargo.transfer(G.run, id, to);
    G.msg(r.msg, r.ok ? 'good' : 'warn', 1.6);
    if (r.ok) DH.bus.emit('transfer');
    return r;
  };
  I.stowAll = () => {
    const run = G.run; let n = 0, fail = null;
    for (const it of DH.Cargo.list(run, 'backpack')) { const r = DH.Cargo.transfer(run, it.id, 'truck'); if (r.ok) n++; else fail = r.msg; }
    G.msg(n ? 'Stowed ' + n + ' item(s) in the truck.' + (fail ? ' ' + fail : '') : fail || 'Backpack is empty.', n ? 'good' : 'warn', 2);
    if (n) DH.bus.emit('transfer');
  };
  I.takeAll = () => {
    const run = G.run; let n = 0, fail = null;
    const list = DH.Cargo.list(run, 'truck').filter((i) => !DH.Cargo.heavy(i)).sort((a, b) => (DH.ITEMS[a.kind].primary ? -1 : 1) - (DH.ITEMS[b.kind].primary ? -1 : 1));
    for (const it of list) { const r = DH.Cargo.transfer(run, it.id, 'backpack'); if (r.ok) n++; else fail = r.msg; }
    G.msg(n ? 'Took ' + n + ' item(s) into the backpack.' + (fail ? ' ' + fail : '') : fail || 'Nothing to take.', n ? 'good' : 'warn', 2);
    if (n) DH.bus.emit('transfer');
  };
})();
