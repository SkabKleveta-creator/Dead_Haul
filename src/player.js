/* ==== player.js ==== */
/* DEAD HAUL - player movement, weapons, melee, supplies, timed actions */
(function () {
  'use strict';
  const DH = window.DH;
  const M = DH.M, T = DH.T, G = DH.G;

  const Player = (DH.Player = {});

  Player.weapon = () => { const p = G.run.player; return p.weapons[p.cur] || null; };
  Player.pos = () => { const r = G.run; return r.player.inTruck ? { x: r.truck.x, y: r.truck.y } : { x: r.player.x, y: r.player.y }; };

  Player.cancelAction = (why) => {
    const p = G.run.player;
    if (!p.action) return;
    const a = p.action;
    p.action = null;
    if (why) G.msg(a.label + ' interrupted' + (why === 'damage' ? ' by damage.' : '.'), 'warn', 1.8);
    DH.bus.emit('actionCancel', a);
  };
  Player.startAction = (kind, dur, label, data) => {
    const p = G.run.player;
    p.action = { kind, t: 0, dur, label, data: data || {}, hold: !!(data && data.hold), noise: (data && data.noise) || 0 };
    p.reload = 0;
    DH.bus.emit('actionStart', p.action);
  };

  Player.damage = (amount, sx, sy, src) => {
    const run = G.run, p = run.player;
    if (!run || p.dead || p.inTruck || p.iframes > 0 || G.state !== 'play') return false;
    p.hp = Math.max(0, p.hp - amount);
    p.iframes = T.player.iframes;
    p.hurtT = 0.35;
    run.stats.damageTaken += amount;
    if (p.action) Player.cancelAction('damage');
    if (sx != null) {
      const a = Math.atan2(p.y - sy, p.x - sx);
      G.W.moveCircle(p, Math.cos(a) * 0.35, Math.sin(a) * 0.35, T.player.radius);
    }
    DH.bus.emit('playerHurt', amount, src);
    return true;
  };

  // ---------- Shooting ----------
  const tmpHits = [];
  Player.shoot = (p, w) => {
    const run = G.run, W = G.W;
    const def = DH.WEAPONS[w.type];
    const ox0 = p.x, oy0 = p.y;
    const mx = ox0 + Math.cos(p.aim) * 0.55, my = oy0 + Math.sin(p.aim) * 0.55;
    const muzzleBlocked = W.raycast(ox0, oy0, mx, my) >= 0 || W.solidTile(Math.floor(mx), Math.floor(my));
    run.stats.shots++;
    const rng = Math.random;
    let anyHit = false;
    const staggerAcc = new Map();
    for (let k = 0; k < def.pellets; k++) {
      const ang = p.aim + (rng() - 0.5) * 2 * def.spread;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const ox = muzzleBlocked ? ox0 : mx, oy = muzzleBlocked ? oy0 : my;
      let maxLen = def.range;
      let wallHit = false;
      if (muzzleBlocked) { maxLen = 0.3; wallHit = true; }
      else {
        const wd = W.raycast(ox, oy, ox + dx * maxLen, oy + dy * maxLen);
        if (wd >= 0) { maxLen = wd; wallHit = true; }
      }
      // zombie volumes
      tmpHits.length = 0;
      for (const z of run.zombies) {
        if (z.dead) continue;
        const r = DH.ZTYPES[z.type].radius + 0.14; // small target tolerance
        const t = M.rayCircle(ox, oy, dx, dy, maxLen, z.x, z.y, r);
        if (t >= 0) tmpHits.push({ z, t });
      }
      tmpHits.sort((a, b) => a.t - b.t);
      const pierce = w.type === 'rifle' ? 2 : 1;
      let endLen = maxLen;
      let n = 0;
      for (const h of tmpHits) {
        let dmg = def.dmg;
        if (w.type === 'shotgun' && h.t > 9) dmg *= 0.6;
        DH.Z.damage(h.z, dmg, p.x, p.y, 'gun');
        staggerAcc.set(h.z, (staggerAcc.get(h.z) || 0) + dmg);
        anyHit = true;
        if (DH.FX) DH.FX.blood(ox + dx * h.t, oy + dy * h.t, ang);
        if (++n >= pierce) { endLen = h.t; wallHit = false; break; }
      }
      if (DH.FX) DH.FX.tracer(ox, oy, ox + dx * endLen, oy + dy * endLen, w.type);
      if (wallHit && DH.FX) DH.FX.spark(ox + dx * endLen, oy + dy * endLen);
    }
    for (const [z, d] of staggerAcc) if (d >= 25 && !z.dead) DH.Z.stagger(z, w.type === 'shotgun' ? 0.3 : 0.15, p.x, p.y);
    if (anyHit) run.stats.hits++;
    G.emitNoise(p.x, p.y, T.noise[def.noise], 'gun', 0.5);
    p.noiseLevel = Math.max(p.noiseLevel, T.noise[def.noise]);
    if (DH.FX) DH.FX.muzzle(mx, my, p.aim, w.type);
    DH.bus.emit('shot', w.type, p.x, p.y);
  };

  Player.melee = (p) => {
    const run = G.run, W = G.W;
    const Mt = T.melee;
    let hits = 0;
    const cands = run.zombies.filter((z) => !z.dead).map((z) => ({ z, d: M.dist(p.x, p.y, z.x, z.y) })).sort((a, b) => a.d - b.d);
    for (const c of cands) {
      if (hits >= Mt.maxTargets) break;
      const z = c.z;
      const reach = Mt.reach + DH.ZTYPES[z.type].radius;
      if (c.d > reach) break;
      const a = Math.atan2(z.y - p.y, z.x - p.x);
      if (Math.abs(M.angDiff(p.aim, a)) > Mt.arc / 2 && c.d > 0.7) continue;
      if (!W.shotClear(p.x, p.y, z.x, z.y)) continue;
      DH.Z.damage(z, Mt.dmg, p.x, p.y, 'melee');
      if (!z.dead) {
        if (z.attached) DH.Z.detach(z, true);
        DH.Z.stagger(z, Mt.stagger, p.x, p.y, true);
      }
      if (DH.FX) DH.FX.blood(z.x, z.y, a);
      hits++;
    }
    if (hits) { G.emitNoise(p.x, p.y, T.noise.melee, 'melee', 0.4); p.noiseLevel = Math.max(p.noiseLevel, T.noise.melee); }
    DH.bus.emit('melee', hits);
  };

  Player.throwNoise = (p, tx, ty) => {
    const W = G.W;
    let dx = tx - p.x, dy = ty - p.y;
    let d = Math.hypot(dx, dy);
    if (d < 0.5) { dx = Math.cos(p.aim); dy = Math.sin(p.aim); d = 6; tx = p.x + dx * d; ty = p.y + dy * d; }
    const maxR = T.noisemaker.range;
    if (d > maxR) { dx = (dx / d) * maxR; dy = (dy / d) * maxR; d = maxR; tx = p.x + dx; ty = p.y + dy; }
    // clamp to first wall
    const hit = W.raycast(p.x, p.y, tx, ty);
    if (hit >= 0) { const L = Math.max(0.4, hit - 0.45); tx = p.x + (dx / d) * L; ty = p.y + (dy / d) * L; }
    const spot = W.findFreeNear(tx, ty, 0.15, 2, p.x, p.y) || { x: p.x, y: p.y };
    p.noisemakers--;
    G.run.noisemakers.push({ id: DH.uid('n'), sx: p.x, sy: p.y, x: spot.x, y: spot.y, flight: 0, flightDur: 0.25 + d * 0.05, landed: false, t: T.noisemaker.dur });
    G.msg('Noise maker thrown.', 'info', 1.4);
    DH.bus.emit('throw');
  };

  // ---------- Update ----------
  Player.update = (dt, inp) => {
    const run = G.run, W = G.W, p = run.player;
    if (p.dead) return;
    p.iframes = Math.max(0, p.iframes - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.fireCd = Math.max(0, p.fireCd - dt);
    p.meleeCd = Math.max(0, p.meleeCd - dt);
    p.noiseLevel = Math.max(0, p.noiseLevel - dt * 10);
    // noise makers in flight / active
    for (let i = run.noisemakers.length - 1; i >= 0; i--) {
      const n = run.noisemakers[i];
      if (!n.landed) { n.flight += dt; if (n.flight >= n.flightDur) { n.landed = true; DH.bus.emit('noiseLand', n.x, n.y); } continue; }
      n.t -= dt;
      n.beep = (n.beep || 0) - dt;
      if (n.beep <= 0) { n.beep = 0.5; G.emitNoise(n.x, n.y, T.noise.noisemaker, 'noisemaker', 0.6); DH.bus.emit('beep', n.x, n.y); }
      if (n.t <= 0) run.noisemakers.splice(i, 1);
    }
    if (p.inTruck) { p.x = run.truck.x; p.y = run.truck.y; p.moving = false; return; }

    // ----- movement -----
    let ix = inp.move.x, iy = inp.move.y;
    const il = Math.hypot(ix, iy);
    if (il > 1) { ix /= il; iy /= il; }
    let wv = DH.iso.inputToWorld(ix, iy);
    const wl = Math.hypot(wv.x, wv.y);
    const mag = Math.min(1, il);
    if (wl > 0) { wv.x = (wv.x / wl) * mag; wv.y = (wv.y / wl) * mag; }
    const moving = mag > 0.15;
    const actionBlocksMove = p.action && (p.action.kind === 'loadGen' || p.action.kind === 'unloadGen' || p.action.hold);
    if (moving && p.action && !actionBlocksMove) Player.cancelAction('move');
    let speed = T.player.walk;
    p.sprinting = false;
    if (p.hauling) speed *= run.perks && run.perks.jack ? T.player.haulMulJack : T.player.haulMul;
    else if (inp.sprint && moving) { speed = T.player.sprint; p.sprinting = true; }
    const wet = W.isWater(Math.floor(p.x), Math.floor(p.y));
    if (wet) speed *= wet === 2 ? T.player.deepMul : T.player.waterMul;
    p.wet = wet;
    if (actionBlocksMove) speed = 0;
    const ox = p.x, oy = p.y;
    if (moving && speed > 0) {
      W.moveCircle(p, wv.x * speed * dt, wv.y * speed * dt, T.player.radius);
      DH.Truck.pushOut(p, T.player.radius);
    }
    // hauling tether
    const gen = DH.Cargo.hauled(run);
    if (p.hauling && gen && gen.loc === 'hauled') {
      const d = M.dist(p.x, p.y, gen.x, gen.y);
      const follow = 1.35;
      if (d > follow) {
        const k = (d - follow) / d;
        const gx = (p.x - gen.x) * k, gy = (p.y - gen.y) * k;
        const g2 = { x: gen.x, y: gen.y };
        W.moveCircle(g2, gx, gy, 0.45);
        gen.x = g2.x; gen.y = g2.y;
      }
      const d2 = M.dist(p.x, p.y, gen.x, gen.y);
      if (d2 > 2.3) { // generator snagged: hold player back
        const a = Math.atan2(p.y - gen.y, p.x - gen.x);
        p.x = gen.x + Math.cos(a) * 2.3; p.y = gen.y + Math.sin(a) * 2.3;
        W.resolveCircle(p, T.player.radius);
        if (!G._snagMsgT || G.time - G._snagMsgT > 3) { G._snagMsgT = G.time; G.msg(DH.Cargo.label(gen) + ' snagged. Back up or release it (X).', 'warn', 2); }
      }
    }
    const moved = M.dist(ox, oy, p.x, p.y);
    p.moving = moved > 0.002;
    p.walkPhase += moved * 2.2;
    p.stepAcc = (p.stepAcc || 0) + moved;
    const stepLen = p.sprinting ? 0.95 : 0.75;
    if (p.stepAcc >= stepLen) {
      p.stepAcc = 0;
      const r = wet ? (p.sprinting ? T.noise.splashSprint : T.noise.splash) : p.sprinting ? T.noise.sprint : T.noise.walk;
      G.emitNoise(p.x, p.y, r, 'step', 0.3);
      p.noiseLevel = Math.max(p.noiseLevel, r);
      DH.bus.emit('step', p.sprinting, p.x, p.y, wet);
      if (wet && DH.FX) DH.FX.splash(p.x, p.y);
    }

    // ----- aim -----
    let aimA = p.aim;
    if (inp.aimWorld) {
      const ax = inp.aimWorld.x, ay = inp.aimWorld.y;
      if (M.dist(ax, ay, p.x, p.y) > 0.3) aimA = Math.atan2(ay - p.y, ax - p.x);
      if (inp.aimZombie && !inp.aimZombie.dead) aimA = Math.atan2(inp.aimZombie.y - p.y, inp.aimZombie.x - p.x);
    } else if (inp.aimDir != null) aimA = inp.aimDir;
    else if (moving) aimA = Math.atan2(wv.y, wv.x);
    if (DH.Save.settings().aimAssist && (inp.aimDir != null || inp.aimWorld)) aimA = Player.assist(p, aimA, inp.aimDir != null ? 0.26 : 0.08);
    p.aim = aimA;
    p.face = M.normAng(p.face + M.angDiff(p.face, p.aim) * Math.min(1, dt * 18));

    // ----- actions in progress -----
    if (p.action) Player.tickAction(dt, inp);

    // ----- reload -----
    const w = Player.weapon();
    if (p.reload > 0) {
      p.reload -= dt;
      if (p.reload <= 0) {
        p.reload = 0;
        const def = DH.WEAPONS[w.type];
        const need = def.mag - w.mag;
        const take = Math.min(need, p.ammo[def.ammo]);
        w.mag += take; p.ammo[def.ammo] -= take;
        DH.bus.emit('reloadDone', w.type);
      }
    }
    if (inp.reload && w && p.reload <= 0 && !p.hauling) Player.startReload(p, w);
    if (inp.swap && p.weapons.length > 1 && !p.hauling) { p.cur = 1 - p.cur; p.reload = 0; p.fireCd = Math.max(p.fireCd, 0.25); DH.bus.emit('swap'); }

    // ----- fire -----
    if (inp.fire && w && !p.hauling && p.meleeT <= 0 && !p.action) {
      const def = DH.WEAPONS[w.type];
      if (p.reload <= 0 && p.fireCd <= 0) {
        if (w.mag > 0) { w.mag--; p.fireCd = def.rof; Player.shoot(p, w); if (w.mag === 0 && p.ammo[def.ammo] > 0) Player.startReload(p, w); }
        else if (p.ammo[def.ammo] > 0) Player.startReload(p, w);
        else if (inp.firePressed) { DH.bus.emit('dry'); G.msg('Out of ' + DH.AMMO_NAMES[def.ammo] + '. Swap (Q) or use the crowbar (F).', 'warn', 2); p.fireCd = 0.3; }
      }
    } else if (inp.firePressed && p.hauling) G.msg('Hands full: release the ' + DH.Cargo.label(DH.Cargo.hauled(run) || { kind: 'generator' }).toLowerCase() + ' (X) to fight.', 'warn', 1.6);

    // ----- melee -----
    if (p.meleeT > 0) {
      const before = p.meleeT;
      p.meleeT -= dt;
      if (before > 0.16 && p.meleeT <= 0.16) Player.melee(p);
    }
    if (inp.melee && p.meleeCd <= 0 && !p.hauling && !p.action) {
      p.meleeT = 0.3; p.meleeCd = T.melee.recovery; p.reload = 0;
      DH.bus.emit('swing');
    }

    // ----- supplies -----
    if (inp.heal) {
      if (p.medkits <= 0) G.msg('No medical kits.', 'warn', 1.5);
      else if (p.hp >= T.player.hp) G.msg('Health is full.', 'info', 1.2);
      else if (p.hauling) G.msg('Release your load first.', 'warn', 1.4);
      else if (!p.action) Player.startAction('heal', T.medkit.time, 'Using medical kit');
    }
    if (inp.throwN) {
      if (p.noisemakers <= 0) G.msg('No noise makers left.', 'warn', 1.4);
      else if (p.hauling) G.msg('Release your load first.', 'warn', 1.4);
      else Player.throwNoise(p, inp.aimWorld ? inp.aimWorld.x : p.x + Math.cos(p.aim) * 8, inp.aimWorld ? inp.aimWorld.y : p.y + Math.sin(p.aim) * 8);
    }
    if (inp.drop && p.hauling) DH.Interact.releaseHaul();
    if (inp.command) DH.Survivor.command();
  };

  Player.startReload = (p, w) => {
    const def = DH.WEAPONS[w.type];
    if (w.mag >= def.mag || p.ammo[def.ammo] <= 0 || p.reload > 0) return;
    p.reload = def.reload;
    DH.bus.emit('reload', w.type);
  };

  Player.assist = (p, aimA, maxAng) => {
    const run = G.run, W = G.W;
    let best = null, bestScore = 1e9;
    for (const z of run.zombies) {
      if (z.dead || !z.visible) continue;
      const d = M.dist(p.x, p.y, z.x, z.y);
      if (d > 22 || d < 0.4) continue;
      const a = Math.atan2(z.y - p.y, z.x - p.x);
      const da = Math.abs(M.angDiff(aimA, a));
      if (da > maxAng) continue;
      if (!W.los(p.x, p.y, z.x, z.y)) continue;
      const s = da * 10 + d * 0.05;
      if (s < bestScore) { bestScore = s; best = a; }
    }
    return best == null ? aimA : best;
  };

  Player.tickAction = (dt, inp) => {
    const run = G.run, p = run.player, a = p.action;
    a.t += dt;
    const tr = run.truck;
    if (a.kind === 'repair' || a.kind === 'loadGen' || a.kind === 'unloadGen') {
      if (DH.Truck.distToHull(p.x, p.y) > 2.6) { Player.cancelAction('move'); return; }
    }
    if ((a.kind === 'loadGen' || a.kind === 'unloadGen' || a.hold) && !a.noHold && !inp.interactHeld) { Player.cancelAction(); G.msg((a.kind === 'loadGen' || a.kind === 'unloadGen' ? 'Loading' : a.label) + ' cancelled.', 'info', 1.2); return; }
    if (a.kind === 'loadGen' && Math.abs(tr.speed) > 0.3) { Player.cancelAction('move'); return; }
    const rs = a.kind === 'revive' ? (G.findSurvivor(run, a.data.sid) || run.survivors[0]) : null;
    if (a.kind === 'revive' && (!rs || rs.state !== 'downed')) { p.action = null; return; }
    if (a.kind === 'script' && a.data.near && M.dist(p.x, p.y, a.data.near.x, a.data.near.y) > (a.data.near.r || 2.6)) { Player.cancelAction('move'); return; }
    if (a.noise && (a.noiseT = (a.noiseT || 0) - dt) <= 0) { a.noiseT = 0.5; G.emitNoise(p.x, p.y, a.noise, 'bang', 0.5); DH.bus.emit('bang', p.x, p.y); }
    if (a.t < a.dur) return;
    p.action = null;
    switch (a.kind) {
      case 'heal':
        if (p.medkits > 0) { p.medkits--; p.hp = Math.min(T.player.hp, p.hp + T.medkit.heal); G.msg('+' + T.medkit.heal + ' health.', 'good', 1.6); DH.bus.emit('healed'); }
        break;
      case 'repair':
        if (p.repairkits > 0) {
          p.repairkits--;
          if (run.perks && run.perks.winch) DH.bus.emit('winch');
          tr.dur = Math.min(T.truck.durability, tr.dur + T.repair.amount);
          if (tr.disabled && tr.dur > 0) { tr.disabled = false; G.msg('Truck repaired and running again.', 'good', 2.2); }
          else G.msg('Truck repaired +' + T.repair.amount + '.', 'good', 1.8);
          DH.bus.emit('repaired');
        }
        break;
      case 'loadGen': {
        const id = p.haulId || 'generator', it = run.items[id];
        const res = DH.Cargo.loadHeavy(run, id);
        if (res.ok) { p.hauling = false; p.haulId = null; G.msg(DH.Cargo.label(it) + ' loaded into the truck bed.', 'good', 2); DH.bus.emit('loaded', it); }
        else G.msg(res.msg, 'warn', 2);
        break;
      }
      case 'unloadGen': {
        const id = a.data.id || 'generator';
        const spot = DH.Truck.rearSpot(0.5);
        if (!spot) { G.msg('No clear space behind the truck.', 'warn', 2); break; }
        const res = DH.Cargo.unloadHeavy(run, id, spot.x, spot.y);
        G.msg(res.msg, res.ok ? 'good' : 'warn', 1.8);
        if (res.ok) DH.bus.emit('loaded', run.items[id]);
        break;
      }
      case 'revive': {
        const s = rs;
        if (p.medkits > 0 && s.state === 'downed') { p.medkits--; s.hp = 30; s.state = 'following'; s.mode = 'follow'; G.msg(s.name + ' revived.', 'good', 2); DH.bus.emit('healed'); }
        else G.msg('Need a medical kit to revive.', 'warn', 2);
        break;
      }
      case 'script': {
        const L = G.L();
        if (L.onAction) L.onAction(run, a.data.key, a.data);
        break;
      }
      case 'pry': {
        const di = a.data.door, st = run.doors[di];
        if (st && st.locked) { st.locked = false; st.open = true; G.W.doors[di].locked = false; G.W.doors[di].open = true; G.W.version++; G.emitNoise(p.x, p.y, T.noise.pry, 'bang', 0.6); DH.bus.emit('doorBroken', G.W.doors[di].cx, G.W.doors[di].cy); G.msg(G.W.doors[di].label + ' forced open.', 'good', 1.8); const L = G.L(); if (L.onAction) L.onAction(run, 'pried', { door: di }); }
        break;
      }
      case 'shelf':
        DH.World.toggleShelf();
        break;
      case 'removeClinger': {
        const z = run.zombies.find((q) => q.id === a.data.zid);
        if (z && !z.dead && z.attached) { DH.Z.detach(z, true); DH.Z.damage(z, 20, p.x, p.y, 'melee'); if (!z.dead) DH.Z.stagger(z, 0.6, p.x, p.y, true); G.msg('Clinger pried off.', 'good', 1.5); DH.bus.emit('swing'); }
        break;
      }
    }
  };
})();

