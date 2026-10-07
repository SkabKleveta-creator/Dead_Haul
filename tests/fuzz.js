// Random-input fuzzing of the full simulation (no rendering): looks for exceptions and broken invariants.
const { load, blankInput } = require('./harness');
let crashes = 0, invBad = 0, runs = 0, ended = 0, maxZ = 0, maxNoise = 0;
const perLevel = {};
const LEVELS = (process.argv[2] ? process.argv[2].split(',').map(Number) : [1, 2, 3, 4, 5]);
const SEEDS = +(process.argv[3] || 8), MINUTES = +(process.argv[4] || 4);
for (const level of LEVELS) for (let seed = 1; seed <= SEEDS; seed++) {
  const ctx = load({ seedMath: seed * 31 + level }); const DH = ctx.DH, G = DH.G; DH.Save.load(); G.state = 'play';
  // later missions are only reachable once unlocked; the fuzz exercises them directly
  G.newRun(seed, {}, level);
  perLevel[level] = perLevel[level] || { runs: 0, crashes: 0, ended: 0 };
  DH.bus.on('confirmDepart', () => { if (Math.random() < 0.5) G.cancelDepart(); else G.acceptDepart(); });
  const r = DH.RNG(seed * 77);
  let inp = blankInput();
  try {
    for (let f = 0; f < 60 * 60 * MINUTES && G.run; f++) {
      if (f % 20 === 0) {
        inp = blankInput();
        inp.move = { x: r.range(-1, 1), y: r.range(-1, 1) };
        inp.aimDir = r.range(-Math.PI, Math.PI);
        inp.fire = r.next() < 0.3; inp.firePressed = inp.fire;
        inp.melee = r.next() < 0.1; inp.reload = r.next() < 0.05; inp.swap = r.next() < 0.05;
        inp.interactPressed = r.next() < 0.2; inp.interactHeld = r.next() < 0.3;
        inp.throwN = r.next() < 0.02; inp.heal = r.next() < 0.03; inp.command = r.next() < 0.03; inp.sprint = r.next() < 0.3;
        inp.drop = r.next() < 0.05; inp.alt = [r.next() < 0.05, r.next() < 0.05, r.next() < 0.05];
        inp.drive = { throttle: r.next() < 0.6 ? 1 : 0, brake: r.next() < 0.2 ? 1 : 0, steer: r.int(-1, 1), handbrake: r.next() < 0.1 };
        inp.recover = r.next() < 0.05; inp.depart = r.next() < 0.05;
        // occasionally teleport to stress systems in different areas
        if (r.next() < 0.03 && !G.run.player.inTruck) { const p = G.run.player; const q = G.W.findFreeNear(r.range(5, 115), r.range(5, 115), 0.35, 6); if (q) { p.x = q.x; p.y = q.y; } }
        // directed: jump next to a level control, item or survivor and mash interact so level scripts get exercised
        if (r.next() < 0.06 && !G.run.player.inTruck) {
          const pts = G.W.props.filter((q) => q.label).map((q) => ({ x: q.x, y: q.y })).concat(Object.values(G.run.items).filter((i) => i.loc === 'world').map((i) => ({ x: i.x, y: i.y })), G.run.survivors.map((q) => ({ x: q.x, y: q.y })), G.W.doors.map((d) => ({ x: d.cx, y: d.cy })));
          const t = pts[r.int(0, pts.length - 1)]; const p = G.run.player; const q = t && G.W.findFreeNear(t.x, t.y, 0.35, 3);
          if (q) { p.x = q.x; p.y = q.y; inp.interactPressed = true; inp.interactHeld = r.next() < 0.7; inp.move = { x: 0, y: 0 }; }
        }
        if (r.next() < 0.01) { DH.Truck.enter(); }
        if (r.next() < 0.005) { const s = G.snapshot(); G.restore(JSON.parse(JSON.stringify(s))); }
      }
      const step = Object.assign({}, inp, { firePressed: f % 20 === 0 && inp.firePressed, interactPressed: f % 20 === 0 && inp.interactPressed, melee: f % 20 === 0 && inp.melee, reload: f % 20 === 0 && inp.reload, swap: f % 20 === 0 && inp.swap, throwN: f % 20 === 0 && inp.throwN, heal: f % 20 === 0 && inp.heal, command: f % 20 === 0 && inp.command, drop: f % 20 === 0 && inp.drop, alt: f % 20 === 0 ? inp.alt : [false, false, false], recover: f % 20 === 0 && inp.recover, depart: f % 20 === 0 && inp.depart });
      if (G.state === 'confirm') G.state = 'play';
      G.update(DH.DT, step);
      if (G.run) {
        const e = DH.Cargo.check(G.run);
        const live = G.run.zombies.length; maxZ = Math.max(maxZ, live); maxNoise = Math.max(maxNoise, G.noise.length);
        if (live > 140) e.push('zombie count ' + live);
        if (G.noise.length > 80) e.push('noise events ' + G.noise.length);
        if (!isFinite(G.run.player.x) || !isFinite(G.run.player.y) || !isFinite(G.run.truck.x)) e.push('non-finite position');
        if (G.run.player.x < 0 || G.run.player.y < 0 || G.run.player.x > G.W.N || G.run.player.y > G.W.N) e.push('player out of map');
        if (G.run.truck.passenger && !G.run.survivors.find((q) => q.id === G.run.truck.passenger)) e.push('passenger missing');
        if (e.length) { invBad++; if (invBad < 6) console.log('invariant L' + level, seed, e); }
      }
      if (G.run && G.run.player.hp < 30) G.run.player.hp = 100; // keep fuzzing longer
    }
    if (!G.run) { ended++; perLevel[level].ended++; }
  } catch (e) { crashes++; perLevel[level].crashes++; console.log('CRASH L' + level + ' seed', seed, e.stack.split('\n').slice(0, 6).join('\n')); }
  runs++; perLevel[level].runs++;
}
const out = { runs, crashes, invariantViolations: invBad, endedByExtraction: ended, simulatedMinutesPerRun: MINUTES, maxZombies: maxZ, maxNoiseEvents: maxNoise, perLevel };
console.log(JSON.stringify(out));
require('fs').writeFileSync(__dirname + '/fuzz-results.json', JSON.stringify(out, null, 1));
