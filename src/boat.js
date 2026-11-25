/* DEAD HAUL - outboard skiff: drives on open water only, carries the driver and 3 units of light cargo */
(function () {
  'use strict';
  const DH = window.DH;
  const M = DH.M, T = DH.T, G = DH.G;
  const Boat = (DH.Boat = {});

  // open water a hull can float on: the sea, and flooded (deep) channels
  Boat.water = (x, y) => {
    const W = G.W, tx = Math.floor(x), ty = Math.floor(y);
    if (!W.inB(tx, ty)) return false;
    const i = W.idx(tx, ty);
    if (W.wall[i] || W.propBlock[i]) return false;
    return W.floor[i] === DH.FLOOR.SEA || W.deep[i] === 1;
  };
  Boat.fits = (x, y) => {
    const r = T.boat.radius;
    if (!Boat.water(x, y)) return false;
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; if (!Boat.water(x + Math.cos(a) * r, y + Math.sin(a) * r)) return false; }
    return true;
  };
  Boat.make = (x, y, ang) => ({ x, y, ang: ang || 0, speed: 0, steer: 0, engine: false, hurtT: 0 });

  // nearest walkable land to the hull (where the crowd ends up when they chase the motor, and where you step off)
  Boat.shore = (b, maxR) => {
    const W = G.W;
    let best = null, bd = 1e9;
    const R = maxR || 6;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const x = Math.floor(b.x) + dx, y = Math.floor(b.y) + dy;
      if (!W.inB(x, y)) continue;
      const i = W.idx(x, y);
      if (W.ground[i] || W.wall[i] || W.propBlock[i] || W.zoneBlock[i]) continue;
      const d = Math.hypot(x + 0.5 - b.x, y + 0.5 - b.y);
      if (d < bd) { bd = d; best = { x: x + 0.5, y: y + 0.5, d }; }
    }
    return best;
  };

  Boat.board = () => {
    const run = G.run, p = run.player, b = run.boat;
    if (!b || p.hauling) return;
    p.inBoat = true; p.action = null; p.reload = 0;
    b.engine = true; b.speed = 0;
    G.transferOpen = false;
    G.msg('In the skiff. W/S throttle, A/D steer. E steps ashore when you are close to land.', 'info', 3.5);
    DH.bus.emit('enterBoat');
  };
  Boat.exit = () => {
    const run = G.run, p = run.player, b = run.boat, W = G.W;
    if (Math.abs(b.speed) > 1.0) { G.msg('Slow down to step ashore.', 'warn', 1.4); return false; }
    let spot = null, bd = 1e9;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      for (const r of [1.4, 1.9, 2.4, 2.9, 3.4, 3.9]) {
        const x = b.x + Math.cos(a) * r, y = b.y + Math.sin(a) * r;
        if (Boat.water(x, y) || !W.circleFree(x, y, T.player.radius + 0.02)) continue;
        if (r < bd) { bd = r; spot = { x, y }; }
        break;
      }
    }
    if (!spot) { G.msg('Too far from land to step off. Bring the skiff alongside a quay or a slip.', 'warn', 2.2); return false; }
    p.inBoat = false; p.x = spot.x; p.y = spot.y; p.iframes = Math.max(p.iframes, 0.4);
    b.engine = false; b.speed = 0;
    DH.bus.emit('exitBoat');
    return true;
  };

  Boat.update = (dt, inp) => {
    const run = G.run, p = run.player, b = run.boat;
    if (!b) return;
    const B = T.boat;
    b.hurtT = Math.max(0, (b.hurtT || 0) - dt);
    b.engine = !!p.inBoat;
    const drive = (p.inBoat && G.state === 'play' && inp.drive) || {};
    const th = drive.throttle || 0, br = drive.brake || 0;
    let v = b.speed;
    if (th > 0) v += B.accel * th * dt;
    if (br > 0) { if (v > 0.3) v = M.approach(v, 0, B.brake * dt); else v -= B.accel * 0.6 * br * dt; }
    if (!th && !br) v = M.approach(v, 0, 1.6 * dt);
    if (drive.handbrake) v = M.approach(v, 0, 8 * dt);
    if (!p.inBoat) v = M.approach(v, 0, 6 * dt);
    v = M.clamp(v, -B.maxRev, B.maxFwd);
    b.steer = M.approach(b.steer, drive.steer || 0, dt * 4);
    b.ang = M.normAng(b.ang + b.steer * B.steerRate * Math.min(1, Math.abs(v) / 2.5 + 0.25) * Math.sign(v || 1) * dt);
    const nx = b.x + Math.cos(b.ang) * v * dt, ny = b.y + Math.sin(b.ang) * v * dt;
    if (Boat.fits(nx, ny)) { b.x = nx; b.y = ny; }
    else if (Boat.fits(nx, b.y)) { b.x = nx; v *= 0.6; }
    else if (Boat.fits(b.x, ny)) { b.y = ny; v *= 0.6; }
    else { if (Math.abs(v) > 2.5 && G.time - (b.bumpT || 0) > 0.6) { b.bumpT = G.time; G.emitNoise(b.x, b.y, 8, 'impact', 0.4); if (DH.FX) DH.FX.shake(0.1); } v = -v * 0.15; }
    b.speed = v;
    if (b.engine) {
      b.noiseT = (b.noiseT || 0) - dt;
      if (b.noiseT <= 0) {
        b.noiseT = 0.5;
        const r = (Math.abs(v) > 0.8 ? B.noiseMove : B.noiseIdle) * (G.upg.quiet ? 0.75 : 1);
        const sh = Boat.shore(b, 8);
        G.emitNoise(b.x, b.y, r + (sh ? sh.d : 0), 'boat', 0.7, sh || null);
        p.noiseLevel = Math.max(p.noiseLevel, r);
      }
      if (Math.abs(v) > 1.2 && DH.FX && Math.random() < dt * 10) DH.FX.splash(b.x - Math.cos(b.ang) * 2, b.y - Math.sin(b.ang) * 2);
    }
    if (p.inBoat && G.state === 'play') {
      p.x = b.x; p.y = b.y;
      if (inp.interactPressed && !inp._consumed) { Boat.exit(); inp._consumed = true; }
      if (inp.depart && G.inExit && G.inExit.kind === 'boat') G.openDepart(G.inExit);
    }
  };

  // prompts at the slip: board, stow light cargo, take it back
  Boat.interact = (run, add, p) => {
    const b = run.boat;
    if (!b || p.inBoat) return;
    const d = M.dist(p.x, p.y, b.x, b.y);
    if (d > 3.0) return;
    if (p.hauling) { add('boat', 'The skiff can\'t take heavy cargo', b.x, b.y, 1.5, () => {}, { disabled: true }); return; }
    add('boat', 'Board the skiff', b.x, b.y, -0.6, () => Boat.board());
    const pack = DH.Cargo.list(run, 'backpack').filter((i) => !DH.Cargo.heavy(i));
    const free = DH.Cargo.free(run, 'boat');
    if (pack.length && free > 0) add('boatStow', 'Stow backpack cargo in the skiff (' + free + ' free)', b.x, b.y, 0.6, () => {
      let n = 0;
      for (const it of pack) { if (DH.Cargo.free(run, 'boat') < DH.Cargo.units(it)) break; it.loc = 'boat'; n++; }
      G.msg(n ? 'Stowed ' + n + ' item(s) in the skiff.' : 'The skiff is full.', n ? 'good' : 'warn', 1.8);
    });
    const inBoat = DH.Cargo.list(run, 'boat');
    if (inBoat.length) add('boatTake', 'Take cargo from the skiff (' + inBoat.length + ')', b.x, b.y, 0.8, () => {
      let n = 0;
      for (const it of inBoat) { if (DH.Cargo.free(run, 'backpack') < DH.Cargo.units(it)) break; it.loc = 'backpack'; n++; }
      G.msg(n ? 'Took ' + n + ' item(s) from the skiff.' : 'Backpack full.', n ? 'good' : 'warn', 1.8);
    });
  };
})();
