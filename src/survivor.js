/* DEAD HAUL - survivor followers (any number recruited, one passenger seat, optional staging areas) */
(function () {
  'use strict';
  const DH = window.DH;
  const M = DH.M, T = DH.T, G = DH.G;
  const S = (DH.Survivor = { NAME: 'Nell' });
  const R = 0.3;
  const her = (s) => s.pron || 'them';

  S.inSafe = (x, y) => { for (const z of G.W.safeZones) if (G.inZone(z, x, y)) return z; return null; };
  S.active = (s) => s.recruited && !s.boarded && !s.safe && s.state !== 'downed';

  S.recruit = (s) => {
    s = s || G.run.survivors[0];
    if (!s || s.recruited) return;
    s.recruited = true; s.state = 'following'; s.mode = 'follow';
    const L = G.L();
    G.msg(s.name + ' joins you. C: Follow / Wait. ' + (L.recruitTip ? L.recruitTip(s) : 'Get ' + her(s) + ' to the truck or the evac gate.'), 'objective', 4);
    DH.bus.emit('recruit', s);
  };
  // C toggles every recruited survivor within earshot together
  S.command = () => {
    const run = G.run;
    const rec = run.survivors.filter((s) => s.recruited && !s.safe);
    if (!rec.length) { G.msg('No one to command.', 'info', 1.2); return; }
    const p = DH.Player.pos();
    const near = rec.filter((s) => s.state !== 'downed' && (s.boarded || M.dist(p.x, p.y, s.x, s.y) <= 16));
    if (!near.length) { const d = rec.find((s) => s.state === 'downed'); G.msg(d ? d.name + ' is down. Revive ' + her(d) + ' first.' : rec[0].name + ' is too far away to hear you.', 'warn', 1.6); return; }
    const to = near[0].mode === 'follow' ? 'wait' : 'follow';
    for (const s of near) { s.mode = to; s.state = to === 'follow' ? 'following' : 'wait'; }
    const s = near[0];
    G.msg((near.length > 1 ? near.map((q) => q.name).join(' & ') : s.name) + ': ' + (to === 'follow' ? '"Right behind you."' : s.boarded ? '"I\'ll stay in the truck."' : '"Waiting here."'), 'info', 1.8);
    DH.bus.emit('command', to);
  };
  S.damage = (s, dmg) => {
    if (typeof s === 'number') { dmg = s; s = G.run.survivors[0]; }
    if (!s || !s.recruited || s.boarded || s.safe || s.state === 'downed') return;
    s.hp = Math.max(0, s.hp - dmg);
    s.hurtT = 0.3;
    if (s.hp <= 0) { s.state = 'downed'; s.path = null; G.msg(s.name + ' is DOWN. Revive: 4 s + 1 medical kit.', 'danger', 4); DH.bus.emit('survivorDown', s); }
    else DH.bus.emit('survivorHurt', s);
  };
  S.passenger = () => { const run = G.run; return run.truck.passenger ? G.findSurvivor(run, run.truck.passenger) : null; };
  S.onPlayerExit = () => {
    const run = G.run, s = S.passenger();
    if (!s || (s.mode === 'wait' && !S.inSafe(run.truck.x, run.truck.y))) return;
    const spot = DH.Truck.exitSpot();
    if (spot) {
      const q = G.W.findFreeNear(spot.x, spot.y, R, 2.5, run.truck.x, run.truck.y) || spot;
      s.boarded = false; s.x = q.x; s.y = q.y; s.state = 'following'; s.mode = 'follow';
      run.truck.passenger = false;
      DH.bus.emit('disembark', s);
      S.checkSafe(s);
    }
  };
  S.checkSafe = (s) => {
    if (s.safe || !s.recruited || s.boarded || s.state === 'downed') return;
    const z = S.inSafe(s.x, s.y);
    if (!z) return;
    s.safe = true; s.state = 'safe'; s.mode = 'wait'; s.path = null;
    const n = G.run.survivors.filter((q) => q.safe).length;
    s.safeX = z.x1 + 1.5 + ((n - 1) % 3) * 1.6; s.safeY = z.y1 + 1.5 + Math.floor((n - 1) / 3) * 1.6;
    G.msg(s.name + ' is safe in the ' + (z.name || 'staging area') + '.', 'good', 2.6);
    DH.bus.emit('survivorSafe', s);
  };

  const moveTo = (s, x, y, speed, dt) => {
    const dx = x - s.x, dy = y - s.y, d = Math.hypot(dx, dy);
    if (d < 0.05) return 0;
    const wm = G.W.isWater(Math.floor(s.x), Math.floor(s.y));
    const st = Math.min(d, speed * (wm === 2 ? T.player.deepMul : wm ? T.player.waterMul : 1) * dt);
    const ox = s.x, oy = s.y;
    G.W.moveCircle(s, (dx / d) * st, (dy / d) * st, R);
    DH.Truck.pushOut(s, R);
    const m = M.dist(ox, oy, s.x, s.y);
    s.walkPhase += m * 2.3;
    s.face = M.normAng(s.face + M.angDiff(s.face, Math.atan2(dy, dx)) * Math.min(1, dt * 8));
    return m;
  };

  S.update = (dt) => {
    for (const s of G.run.survivors) S.updateOne(s, dt);
  };
  S.updateOne = (s, dt) => {
    const run = G.run, W = G.W, p = run.player, t = run.truck;
    s.hurtT = Math.max(0, (s.hurtT || 0) - dt);
    if (!s.recruited) { s.face = M.normAng(s.face + dt * 0.1); return; }
    if (s.boarded) {
      s.x = t.x; s.y = t.y;
      if (!p.inTruck && s.mode === 'follow') S.onPlayerExit();
      return;
    }
    if (s.state === 'downed') return;
    if (s.safe) { if (s.safeX != null && M.dist(s.x, s.y, s.safeX, s.safeY) > 0.3) moveTo(s, s.safeX, s.safeY, 2.2, dt); return; }
    const onDoor = W.doorAt[W.idx(Math.floor(s.x), Math.floor(s.y))];
    if (s.mode === 'wait') {
      if (onDoor) { const q = W.findFreeNear(s.x, s.y + 1.2, R, 2.5, s.x, s.y); if (q) moveTo(s, q.x, q.y, 2, dt); }
      S.checkSafe(s);
      return;
    }
    // board truck (one passenger seat)
    if (p.inTruck) {
      const hd = DH.Truck.distToHull(s.x, s.y);
      if (hd < 1.9 && Math.abs(t.speed) < 0.6 && !t.passenger) {
        s.boarded = true; t.passenger = s.id; s.path = null;
        G.msg(s.name + ' climbed into the passenger seat.', 'good', 2.2);
        DH.bus.emit('board', s);
        return;
      }
    }
    // follow target: behind the player, off the line of fire; extra followers fan out
    const k = run.survivors.filter((q) => S.active(q)).indexOf(s);
    const pp = p.inTruck ? DH.Truck.toWorld(0.2 - k * 1.2, -(DH.Truck.HW + 0.7)) : p;
    let tx = pp.x, ty = pp.y;
    if (!p.inTruck) {
      const bx = -Math.cos(p.aim), by = -Math.sin(p.aim);
      const side = k % 2 ? -1 : 1, back = 1.7 + Math.floor(k / 2) * 1.1;
      const cand = { x: p.x + bx * back - by * 0.6 * side, y: p.y + by * back + bx * 0.6 * side };
      if (W.circleFree(cand.x, cand.y, R) && W.walkLine(p.x, p.y, cand.x, cand.y, 0.1)) { tx = cand.x; ty = cand.y; }
    }
    const dP = M.dist(s.x, s.y, pp.x, pp.y);
    const dT = M.dist(s.x, s.y, tx, ty);
    const speed = dP > 5 ? 3.8 : 2.6;
    S.checkSafe(s);
    if (s.safe) return;
    if (!p.inTruck) {
      const a = Math.atan2(s.y - p.y, s.x - p.x);
      if (dP < 12 && Math.abs(M.angDiff(p.aim, a)) < 0.3) {
        const side = M.angDiff(p.aim, a) > 0 ? 1 : -1;
        const q = { x: s.x + Math.cos(p.aim + side * Math.PI / 2) * 1.2, y: s.y + Math.sin(p.aim + side * Math.PI / 2) * 1.2 };
        if (W.circleFree(q.x, q.y, R)) { moveTo(s, q.x, q.y, 3.2, dt); return; }
      }
    }
    if (dT < 0.6 && dP > 1.0) { s.moving = false; return; }
    if (dP < 1.4 && !p.inTruck) return;
    let wp = null;
    if (W.walkLine(s.x, s.y, tx, ty, R * 0.9)) wp = { x: tx, y: ty };
    else {
      s.pathT = (s.pathT || 0) - dt;
      if (!s.path || s.pathT <= 0) { s.path = W.findPath(s.x, s.y, tx, ty, false, 6000) || []; s.pathI = 0; s.pathT = 1.0; }
      while (s.pathI < s.path.length - 1 && M.dist(s.x, s.y, s.path[s.pathI].x, s.path[s.pathI].y) < 0.6) s.pathI++;
      wp = s.path[s.pathI] || null;
    }
    if (wp) {
      const dx = wp.x - s.x, dy = wp.y - s.y, dd = Math.hypot(dx, dy) || 1;
      const ax = Math.floor(s.x + (dx / dd) * 0.8), ay = Math.floor(s.y + (dy / dd) * 0.8);
      if (W.inB(ax, ay)) { const di = W.doorAt[W.idx(ax, ay)]; if (di && W.doorClosed(W.idx(ax, ay)) && !W.doors[di - 1].locked) DH.World.setDoor(di - 1, true, 'survivor'); }
      moveTo(s, wp.x, wp.y, speed, dt);
    }
    s.stuckT = (s.stuckT || 0) + dt;
    if (s.stuckT > 2.5) {
      if (dP > 3 && M.dist(s.x, s.y, s.lastX, s.lastY) < 0.25 && s.path && s.path.length) {
        const kk = Math.min(s.path.length - 1, (s.pathI || 0) + 2);
        const q = s.path[kk];
        if (q && M.dist(s.x, s.y, q.x, q.y) < 3.2 && !W.doorClosed(W.idx(Math.floor(q.x), Math.floor(q.y))) && W.circleFree(q.x, q.y, R)) { s.x = q.x; s.y = q.y; s.pathI = kk; }
        s.path = null;
      }
      s.lastX = s.x; s.lastY = s.y; s.stuckT = 0;
    }
  };
})();
