/* DEAD HAUL - Level 7: Saltworks (north shore desalination plant, a tide on the clock) */
(function () {
  'use strict';
  const DH = window.DH;
  DH.LEVELS = DH.LEVELS || {};
  const M = DH.M;
  const TIDE_T = 150;
  const LOW = { x1: 50, y1: 58, x2: 69, y2: 78 };

  const build = () => {
    const K = DH.MapKit('saltworks', { theme: { dark: 'rgba(16,22,36,0.48)', lamp: 'rgba(255,200,130,A)', lightR: 9, haze: 'rgba(150,165,180,0.2)', wind: true } });
    const { W, MAT, F } = K;
    const { fill, wallLine, clearWall, windows, building, door, sign, P, box, circ } = K;
    W.hasWater = true;

    // ---- ground: sea to the north, the cliff drop to the east ----
    fill(0, 0, 119, 119, F.GRASS);
    K.ground(0, 0, 119, 8, F.SEA);
    K.ground(107, 33, 119, 119, F.SEA);
    fill(0, 9, 106, 10, F.WATER);
    fill(8, 10, 26, 22, F.DIRT);                // lighthouse point
    // roads: Island Road (south exit), the lower works road, the cliff road loop, the shore road
    K.road(57, 34, 62, 119, false);              // lower works road + Island Road
    K.road(18, 100, 104, 105, false);            // south road
    K.road(99, 26, 104, 105, false);             // cliff road
    K.road(62, 26, 119, 31, false);              // shore road (east exit)
    fill(16, 98, 104, 99, F.WALK); fill(16, 106, 104, 107, F.WALK); fill(97, 32, 98, 98, F.WALK);
    // salt pans across the whole low ground: people wade, trucks sink. Only the low road crosses.
    fill(1, 50, 97, 84, F.WATER);
    K.truckOnly(1, 50, 55, 84); K.truckOnly(64, 50, 97, 84);
    wallLine(8, 60, 30, 60, MAT.LEVEE); wallLine(36, 60, 50, 60, MAT.LEVEE); wallLine(70, 66, 92, 66, MAT.LEVEE); wallLine(14, 74, 44, 74, MAT.LEVEE); wallLine(72, 78, 90, 78, MAT.LEVEE);
    K.paveRoads();
    fill(40, 35, 82, 44, F.LOT);                 // saltworks apron
    fill(22, 22, 43, 28, F.DOCK);                // causeway to the lighthouse point
    fill(22, 22, 27, 28, F.WATER);               // tidal channel under the causeway planks
    // map edge (land side)
    wallLine(0, 11, 0, 119, MAT.ROCK); wallLine(0, 119, 106, 119, MAT.ROCK); wallLine(106, 32, 106, 119, MAT.ROCK);
    clearWall(57, 119, 62, 119); clearWall(0, 95, 0, 98);
    wallLine(105, 32, 105, 98, MAT.RAIL);         // guard rail along the cliff edge
    // ---- the pump hall: big bay door south, office in the north-west corner ----
    const hall = building('Saltworks Pump Hall', 'hall', 44, 13, 72, 34, MAT.CONCRETE, F.CONCRETE_IN, '#3e4448', { ribs: true, skylights: true });
    clearWall(55, 34, 60, 34);
    sign('NORTH SHORE SALTWORKS', 62, 34, 'S', 9, '#e8e2cf', '#2a4a5a', 3.0);
    wallLine(45, 22, 51, 22, MAT.INTERIOR); wallLine(52, 14, 52, 22, MAT.INTERIOR);
    door('hall', 52, 18, 2, 'v', { label: 'Office Door' });
    hall.rooms.push({ name: 'Plant Office', x1: 45, y1: 14, x2: 51, y2: 21 });
    door('hall', 72, 24, 2, 'v', { label: 'East Door', color: '#5b6670' });
    for (const [x, y] of [[48, 28], [68, 18], [68, 29]]) box('pumpunit', x, y, 1.2, 0.8, 0, 1.4, {});
    box('pipe', 58, 15.4, 9, 0.2, 0, 0.4, { z: 2.6, solid: false, color: '#9aa4a8' });
    box('tank', 65, 23, 1.4, 1.4, 0, 2.8, { shape: 'circle', r: 1.4, color: '#5d7f93' });
    box('counter', 48, 15.5, 1.8, 0.4, 0, 1.0, { color: '#6b5a44' }); box('cabinet', 50.6, 20.4, 0.35, 0.6, 0, 1.9, { color: '#5a6064' });
    W.membraneRack = box('rack', 58, 19.4, 2.2, 0.35, 0, 1.6, { color: '#7a8a90' });
    // brine tanks and salt heaps on the apron
    for (const [x, y] of [[44, 38], [48.5, 38]]) box('tank', x, y, 1.6, 1.6, 0, 3.0, { shape: 'circle', r: 1.6, color: '#7a8a90' });
    for (const [x, y, r] of [[79.5, 42.5, 1.4], [33, 40, 1.6], [36, 44, 1.2]]) box('rock', x, y, r, r, 0, 1.4, { shape: 'circle', r, color: '#d8d4c8' });
    box('forklift', 64, 43, 1.0, 0.55, 0.3, 2.2, { sprR: 1.6 });
    for (const [x, y] of [[53, 43], [74, 43.2]]) box('pallets', x, y, 0.7, 0.7, 0.2, 1.0, {});
    // ---- the lighthouse on the point, the keeper's cottage beside it ----
    box('tower', 13, 14, 1.2, 1.2, 0, 13, { direct: true, solid: true, sprR: 3, bw: 1.4, h: 13 });
    const cot = building('Keeper’s Cottage', 'cottage', 15, 15, 21, 21, MAT.CREAM, F.WOOD, '#5a3e30');
    door('cottage', 21, 17, 2, 'v', { label: 'Cottage Door' }); windows(16, 21, 19, 21);
    cot.rooms.push({ name: 'Keeper’s Cottage', x1: 16, y1: 16, x2: 20, y2: 20 });
    box('sofa', 17.5, 17, 1.0, 0.4, 0, 0.8, { color: '#5a4b3f' });
    // ---- cliff road shed (jerry cans), rocks and a crashed van ----
    const sh = building('Cliff Shed', 'shed', 91, 62, 97, 68, MAT.WETSIDING, F.CONCRETE_IN, '#3a3f44');
    door('shed', 97, 64, 2, 'v', { label: 'Shed Door' });
    sh.rooms.push({ name: 'Cliff Shed', x1: 92, y1: 63, x2: 96, y2: 67 });
    for (const [x, y, r] of [[95, 44, 1.2], [94, 88, 1.4], [84, 94, 1.2], [20, 88, 1.0], [12, 44, 1.2]]) box('rock', x, y, r, r, 0, 1.2, { shape: 'circle', r });
    box('van', 103.4, 74, 2.7, 1.0, 1.52, 2.1, { color: '#e2e0d8' });
    for (const [x, y, a, c] of [[38, 102.4, 0.05, '#4a4f55'], [80, 103.5, 3.1, '#5e3d3d'], [53, 92, 1.4, '#3f5566']]) K.car(x, y, a, c);
    for (const [x, y] of [[10, 40], [24, 44], [8, 90], [12, 86], [22, 112], [40, 114], [80, 114], [96, 112], [30, 92], [88, 90], [92, 20], [82, 14]]) K.tree(x, y);
    // lights: shore road and apron (on), salt pan floods (dead)
    for (const [x, y] of [[66, 32.4], [80, 32.4], [94, 32.4], [56.4, 46], [97.4, 50], [97.4, 80], [56.4, 96], [30, 99.4], [80, 99.4]]) K.lamp(x, y);
    W.glows.push({ x: 13, y: 14, r: 3, col: 'rgba(255,230,160,A)', a: 0.25, z: 12.5, power: 'lamp' });
    W.marks.push({ k: 'hatch', x1: 55, y1: 33, x2: 61, y2: 35, col: 'rgba(230,190,40,0.55)' });
    W.marks.push({ k: 'text', x: 59, y: 68, text: 'LOW ROAD', size: 60, rot: Math.PI / 2, col: 'rgba(230,220,200,0.3)' });
    W.marks.push({ k: 'text', x: 101.5, y: 60, text: 'CLIFF RD', size: 60, rot: Math.PI / 2, col: 'rgba(230,220,200,0.3)' });
    K.decals(45, 31);
    P('exitSign', 56, 116, { solid: false, text: 'EXIT', sub: 'ISLAND RD', h: 3.2 });
    P('exitSign', 113, 25, { solid: false, text: 'EXIT', sub: 'SHORE RD', h: 3.2 });
    P('exitSign', 2.5, 100, { solid: false, text: 'EVAC', sub: 'WEST TRAIL', h: 2.8, green: true });
    W.glows.push({ x: 1.5, y: 96.5, r: 3.5, col: 'rgba(90,255,140,A)', a: 0.16, pulse: 6, hole: { x: 1.5, y: 96.5, r: 4, a: 0.7 } });
    // the tide: the low road crossing and the causeway channel go under
    K.gate('tide', 'flood', [[LOW.x1, LOW.y1, LOW.x2, LOW.y2], [22, 22, 27, 28]], { initial: false, label: 'High tide', short: 'Tide' });

    K.finish();
    W.exits = [
      { id: 'shore', name: 'Shore Road', kind: 'truck', x1: 113.5, y1: 25.5, x2: 119.9, y2: 31.5, lx: 111, ly: 28.5, out: [1, 0] },
      { id: 's', name: 'Island Road', kind: 'truck', x1: 56.5, y1: 115, x2: 63, y2: 119.9, lx: 59.5, ly: 113, out: [0, 1] },
      { id: 'foot', name: 'West trail', kind: 'foot', x1: 0, y1: 94.5, x2: 2.5, y2: 98.5, lx: 4, ly: 96.5, out: [-1, 0] },
    ];
    W.start = { truck: { x: 59.5, y: 111, ang: -Math.PI / 2 }, player: { x: 63, y: 110 }, aim: -Math.PI / 2 };
    W.reserveEntries = [{ x: 2.5, y: 60, name: 'west' }, { x: 59.5, y: 117, name: 'Island Road' }, { x: 116, y: 28.5, name: 'shore road' }, { x: 2.5, y: 108, name: 'south-west' }];
    W.landmarks = [
      { id: 'hall', name: 'Pump Hall', x: 58, y: 24, r: 12 },
      { id: 'office', name: 'Plant Office', x: 48, y: 18, r: 4, quiet: true },
      { id: 'pans', name: 'Salt Pans', x: 59, y: 68, r: 18 },
      { id: 'cliff', name: 'Cliff Road', x: 101.5, y: 64, r: 14 },
      { id: 'shed', name: 'Cliff Shed', x: 94, y: 65, r: 5 },
      { id: 'point', name: 'Lighthouse Point', x: 16, y: 17, r: 8 },
    ];
    W.zombieGroups = [
      [52, 26, 3, { drifter: 2 }, { tag: 'hall' }], [66, 27, 3, { drifter: 2, howler: 1 }, { tag: 'hall' }], [48, 18, 1.2, { drifter: 1 }, { tag: 'hall' }],
      [46, 41, 3, { drifter: 3 }, { tag: 'apron' }], [78, 36, 3, { drifter: 2, runner: 1 }, { tag: 'apron' }],
      [36, 66, 3, { sleeper: 2 }, { tag: 'pans' }], [45, 78, 3, { sleeper: 2 }, { tag: 'pans' }], [74, 58, 3, { sleeper: 2 }, { tag: 'pans' }], [84, 72, 3, { sleeper: 2 }, { tag: 'pans' }], [16, 66, 3, { sleeper: 2 }, { tag: 'pans' }], [53, 68, 1.5, { sleeper: 1 }, { tag: 'pans' }], [66, 62, 1.5, { sleeper: 1 }, { tag: 'pans' }],
      [101.5, 86, 2.5, { brute: 1, drifter: 2 }, { tag: 'cliff' }], [101.5, 52, 2.5, { brute: 1, drifter: 1 }, { tag: 'cliff' }], [101.5, 38, 2.5, { drifter: 2, clinger: 1 }, { tag: 'cliff' }],
      [30, 102.5, 3, { drifter: 3 }, { tag: 'south' }], [86, 102.5, 3, { drifter: 2, runner: 1 }, { tag: 'south' }],
      [17, 23.5, 2.5, { drifter: 2 }, { tag: 'point' }], [33, 25, 1.5, { drifter: 1 }, { tag: 'point' }],
      [92, 28.5, 3, { drifter: 2 }, { tag: 'shore' }], [110, 28.5, 2.5, { drifter: 2, shrieker: 1 }, { tag: 'shore' }],
    ];
    W.mapTitle = 'NORTH SHORE SALTWORKS';
    return W;
  };

  const L = (DH.LEVELS[7] = {
    id: 7, key: 'saltworks', name: 'Saltworks', place: 'NORTH SHORE, FALLING TIDE', short: 'Fresh water for the island', tag: 'Desalination membrane, tide on the clock',
    build, fuel: 55, par: 300, footOK: false,
    brief: () => 'The island’s wells are salt. The North Shore saltworks had a desalination plant: bring its membrane back from the pump hall. It is heavy. The low road through the salt pans is short, but the tide covers it in about two and a half minutes, and things sleep in that brine. The cliff road is long and open, and something big walks it. Keeper Hale may still be on the lighthouse point.',
    meta: () => [['Primary', 'Desalination membrane (pump hall) → truck → out'], ['Routes', 'Low road before high tide · or the cliff road'], ['Timer', 'High tide at 2:30 floods the low road and the causeway'], ['Optional', 'Keeper Hale (lighthouse point) · spare filters'], ['Exits', 'Shore Road east · Island Road south · west trail']],
    optionalKeys: [['hale', 'Bring Keeper Hale home'], ['filters', 'Recover the spare filters']],
    reserve: 12,
    recruitTip: () => 'Get him to the truck. At high tide the causeway is waist-deep.',
    setup(run, rng, story) {
      const G = DH.G;
      G.addItem(run, 'membrane', 'membrane', 58, 21, { spot: 'The desalination membrane on its rack. Heavy: bring the truck into the hall.', haulTip: 'Get it to the back of the stopped truck.' });
      G.addItem(run, 'filters0', 'filters', 47, 17); G.addItem(run, 'filters1', 'filters', 49.5, 19.5);
      G.addItem(run, 'fuel0', 'fuel', 93, 64); G.addItem(run, 'fuel1', 'fuel', 95, 66.2); G.addItem(run, 'fuel2', 'fuel', 70, 31.5);
      const salv = rng.shuffle([[30, 40], [64, 38.5], [82, 34.5], [18, 18], [94, 66], [101.5, 96], [44, 103], [10, 104], [86, 96], [36, 92], [70, 112], [47, 31]]).slice(0, 6);
      salv.forEach((p, i) => G.addItem(run, 'salvage' + i, 'salvage', p[0], p[1]));
      const pk = G.addPickup;
      pk(run, 'weapon', 50.4, 15.6, { wtype: 'smg', mag: 30, reserve: 60, crate: true });
      pk(run, 'weapon', 18, 19.5, { wtype: 'rifle', mag: 6, reserve: 12 });
      pk(run, 'ammo', 46, 21, { atype: 'p9', n: 24 }); pk(run, 'ammo', 96, 63.4, { atype: 'p9', n: 24 }); pk(run, 'ammo', 17, 20.2, { atype: 'r30', n: 6 });
      pk(run, 'medkit', 51, 15.2, { n: 1 }); pk(run, 'medkit', 92.6, 66.8, { n: 1 });
      pk(run, 'repairkit', 69, 39, { n: 1 });
      pk(run, 'noisemaker', 63.5, 106, { n: 1 }); pk(run, 'noisemaker', rng.pick([[66, 42], [42, 42]])[0], 42, { n: 1 });
      pk(run, 'note', 49, 16.4, { key: 'tide', label: 'tide table', text: 'TIDE TABLE (pinned by the door): low road under 40 cm at high water. Do not drive the pans. Keep the membrane racked and dry. Hale says the sleepers in the brine wake when you splash.' });
      if (!(story && story.milestones && story.milestones.hale)) G.addSurvivor(run, 'hale', 'Hale', 'hale', 18, 18.4, { where: 'Keeper’s cottage', landmark: 'point', pron: 'him', call: true });
      run.timers.tide = TIDE_T;
    },
    nextStep(run) {
      const m = run.items.membrane;
      if (m.loc === 'world' || m.loc === 'hauled') return 'membrane';
      return 'out';
    },
    interact(run, add, p) {
      const W = DH.G.W;
      if (run.flags.tide) return;
      if (M.dist(p.x, p.y, 59.5, 59) < 3 || M.dist(p.x, p.y, 59.5, 77) < 3) add('tideInfo', 'Low road: high tide in ' + Math.max(0, Math.ceil(run.timers.tide - run.time)) + ' s', 59.5, p.y < 68 ? 57.5 : 78.5, 2.5, () => {}, { disabled: true });
      void W;
    },
    highlights(run) { return run.items.membrane.loc === 'world' ? [{ x: 58, y: 21, r: 1.0, d: 14 }] : []; },
    labels(run) {
      const pp = DH.Player.pos(), out = [];
      if (M.dist(pp.x, pp.y, 59.5, 68) < 22) out.push({ x: 59.5, y: 56.5, z: 1.6, text: run.flags.tide ? 'LOW ROAD: FLOODED' : 'LOW ROAD: high tide in ' + Math.max(0, Math.ceil(run.timers.tide - run.time)) + ' s', col: run.flags.tide ? '#8cd6ff' : '#ffd36a' });
      if (M.dist(pp.x, pp.y, 24.5, 25) < 14) out.push({ x: 24.5, y: 25, z: 1.4, text: run.flags.tide ? 'CAUSEWAY: WADING DEPTH' : 'CAUSEWAY', col: '#8cd6ff' });
      return out;
    },
    onAction(run, key, data) {
      const G = DH.G;
      if (key === 'note' && data.key === 'tide') G.radio('june', 'If the tide table says forty centimetres, it means the truck floats. Don’t.', 'noteTide');
    },
    update(run, dt) {
      const G = DH.G, pp = DH.Player.pos(), t = run.truck;
      if (run.time > 2) G.radio('june', 'The membrane is racked in the pump hall. The low road through the pans is quick, but the tide turns soon.', 'intro');
      if (run.time > 14) G.radio('june', 'The cliff road’s the long way. Hale used to warn us about the big ones up there.', 'tip');
      const hale = G.findSurvivor(run, 'hale');
      if (hale && !hale.recruited && M.dist(pp.x, pp.y, hale.x, hale.y) < 18) G.radio('hale', 'You there! Keeper Hale. I’ve been watching you from the gallery. Get me off this rock?', 'haleCall');
      // the tide clock
      if (!run.flags.tide) {
        const left = run.timers.tide - run.time;
        if (left < 30 && !run.flags.tideWarn) { run.flags.tideWarn = true; G.msg('The tide is turning: the low road floods in 30 seconds.', 'warn', 3.5); G.cue('TIDE', 59.5, 68, 'warn'); G.radio('june', 'Tide’s coming. Whatever’s on the low road in thirty seconds stays there.', 'tideWarn'); }
        if (left <= 0) {
          const r = G.setGate('tide', true);
          if (r.ok) {
            run.flags.tide = true;
            G.msg('High tide. The low road and the causeway are under water.', 'objective', 4);
            let n = 0;
            for (const z of run.zombies) if (!z.dead && z.dormant && (z.tag === 'pans' || z.tag === 'point')) { DH.Z.wake(z, z.x, z.y); n++; }
            if (n) { G.cue('MOVEMENT', 59.5, 68, 'danger'); G.radio('june', 'The brine’s moving. Those sleepers are up.', 'tideWake'); }
            DH.bus.emit('tide');
          } else if (G.time - (run.timers.tideNag || -9) > 4) { run.timers.tideNag = G.time; G.msg(r.who === 'truck' ? 'The tide is lapping at the truck: get it off the low road!' : 'High tide is coming in.', 'danger', 2.5); }
        }
      }
      // which way the truck went north
      if (!run.flags.route) {
        if (t.x > 56 && t.x < 63 && t.y > LOW.y1 && t.y < LOW.y2) run.flags.route = 'early';
        else if (t.x > 98 && t.y < 70) run.flags.route = 'cliff';
      }
      if (DH.FX && run.flags.tide && Math.random() < dt * 3) { const x = 50 + Math.random() * 19, y = 58 + Math.random() * 20; if (M.dist(x, y, pp.x, pp.y) < 30) DH.FX.ring(x, y, 0.9, 'rgba(170,210,230,1)', 0.8); }
    },
    objectives(run) {
      const G = DH.G, m = run.items.membrane, out = [];
      out.push({ text: m.loc === 'truck' ? 'Membrane loaded: drive out (Shore Road or Island Road)' : m.loc === 'hauled' ? 'Haul the membrane to the truck tailgate' : 'Get the desalination membrane (pump hall)', done: m.loc === 'truck' });
      out.push({ text: run.flags.tide ? 'High tide: the low road is flooded' : 'High tide in ' + DH.fmtTime(run.timers.tide - run.time) + ' (low road floods)', done: false, opt: true });
      const h = G.findSurvivor(run, 'hale');
      const f = Object.values(run.items).filter((i) => i.kind === 'filters' && i.loc !== 'world').length;
      out.push({ text: h ? (!h.recruited ? 'Optional: Keeper Hale (lighthouse point)' : h.boarded ? 'Hale in the truck' : h.state === 'downed' ? 'Hale DOWN: revive (4 s, medkit)' : 'Hale with you') + ' · filters ' + f + '/2' : 'Hale is safe at the depot · filters ' + f + '/2', done: (!h || h.boarded) && f >= 2, fail: h && h.state === 'downed', opt: true });
      return out;
    },
    pointer(run) {
      const G = DH.G, p = run.player, m = run.items.membrane;
      if (p.hauling) return { x: run.truck.x, y: run.truck.y, label: 'TRUCK', col: '#ffd36a' };
      if (m.loc === 'world') return run.discovered.hall ? { x: m.x, y: m.y, label: 'MEMBRANE', col: '#ff8a7a' } : { x: 58, y: 34, label: 'PUMP HALL', col: '#ff8a7a' };
      return G.exitPointer(run);
    },
    markers(run, dot) {
      const m = run.items.membrane;
      if (m.loc === 'world') dot(58, 21, '#ff6b5a', 4);
      for (const id in run.items) { const it = run.items[id]; if (it.kind === 'fuel' && it.loc === 'world' && run.seen[id]) dot(it.x, it.y, '#d4443a', 2); }
    },
    primaryOut: (out, run, mode) => !!out.got.membrane,
    primaryGot: (run) => run.items.membrane.loc === 'truck',
    bonus: () => [],
    departWarn: 'The membrane has to come out in the truck. This will be a partial extraction.',
    resultSub(r) { return r.status === 'partial' ? 'No membrane. The island is still drinking rain.' : r.status === 'failed' ? 'Nothing extracted. No rewards from this run. Your campaign progress is safe.' : 'The membrane is on its way to the depot. Fresh water by tonight.'; },
    resultRows(run, ev) {
      const R = DH.T.rewards, h = DH.G.findSurvivor(run, 'hale');
      return [
        ['Desalination membrane (primary)', ev.got.membrane ? 'Recovered +' + R.membrane : 'Missing', ev.got.membrane ? 'good' : 'bad'],
        ['Route north', run.flags.route === 'early' ? 'Low road, before the tide' : run.flags.route === 'cliff' ? 'Cliff road' : '-'],
        ['Keeper Hale', ev.survivorsOut.indexOf('hale') >= 0 ? 'Rescued +' + R.survivor : !h ? 'Already at the depot' : h.recruited ? 'Left behind' : 'Not rescued', ev.survivorsOut.indexOf('hale') >= 0 ? 'good' : h && h.recruited ? 'bad' : ''],
        ['Spare filters', (ev.got.filters || 0) + ' / 2' + (ev.got.filters ? ' (+' + ev.got.filters * R.supplies + ')' : ''), ev.got.filters ? 'good' : ''],
        ['Salvage bundles', ev.salvageOut + (ev.salvageOut ? ' (+' + ev.salvageOut * R.salvage + ')' : ''), ev.salvageOut ? 'good' : ''],
      ];
    },
    outcome(run, ev) {
      const hale = ev.survivorsOut.indexOf('hale') >= 0;
      return { membrane: !!ev.got.membrane, route: run.flags.route || null, hale, tide: !!run.flags.tide, optional: { hale, filters: (ev.got.filters || 0) >= 2 } };
    },
    hints: {
      start: { kbm: 'North Shore. The membrane is in the pump hall. The low road floods at high tide (timer on the objective panel).', touch: 'Membrane in the pump hall. The low road floods at high tide.' },
      primaryGot: { kbm: 'Membrane loaded. Drive out: Shore Road east is closest.', touch: 'Membrane loaded. Drive out: Shore Road east is closest.' },
    },
    backdropCam: { x: 58, y: 44 },
  });
})();
