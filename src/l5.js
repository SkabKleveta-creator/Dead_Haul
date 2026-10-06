/* ==== l5.js ==== */
/* DEAD HAUL - Level 5: Last Crossing (Harbor Street freight terminal and ferry ramp) */
(function () {
  'use strict';
  const DH = window.DH;
  DH.LEVELS = DH.LEVELS || {};
  const M = DH.M;

  const build = () => {
    const K = DH.MapKit('crossing', { theme: { dark: 'rgba(8,12,28,0.66)', lamp: 'rgba(255,180,90,A)', lightR: 8.5, flashlight: true, haze: 'rgba(30,50,80,0.25)' } });
    const { W, MAT, F } = K;
    const { fill, wallLine, clearWall, windows, building, door, sign, P, box, circ } = K;
    W.hasWater = true;

    // ---- ground: harbor water north and east, quay, yards ----
    fill(0, 0, 119, 119, F.QUAY);
    K.ground(0, 0, 119, 15, F.SEA); K.ground(106, 0, 119, 119, F.SEA);
    fill(0, 96, 105, 119, F.LOT);
    K.road(8, 40, 13, 117);                   // Terminal Road (arrival)
    K.road(8, 36, 76, 41);                    // Quay Road (direct, exposed)
    K.road(8, 100, 104, 105);                 // Shed Row (sheltered)
    K.road(99, 34, 104, 105);                 // east alley (sheltered)
    K.paveRoads();
    fill(84, 16, 92, 21, F.METAL);            // linkspan apron
    fill(70, 72, 98, 79, F.LOT);              // shed apron
    // ---- perimeter (land side) ----
    wallLine(0, 16, 0, 119, MAT.BARRICADE); wallLine(0, 119, 105, 119, MAT.BARRICADE); wallLine(105, 16, 105, 119, MAT.RAIL);
    clearWall(8, 119, 13, 119); clearWall(0, 62, 0, 64);
    for (let x = 1; x < 105; x += 6) if (x < 78 || x > 100) box('mooring', x + 0.5, 16.4, 0.25, 0.25, 0, 0.7, {});
    // ---- the ferry at the berth, bow door facing the quay ----
    W.ferry = box('ferry', 88, 8, 4.5, 7, 0, 7, { direct: true, solid: false, sprR: 10, fade: false, segDef: [88, 1.5, 88, 15], segAlways: true, segBias: -0.5 });
    W.ramp = box('ramp', 88, 18.5, 2.5, 3, 0, 0.3, { direct: true, solid: false, fade: false, pri: 0.05, kOff: -3 });
    K.gate('ramp', 'barrier', [[85, 16, 91, 20]], { initial: true, label: 'Ferry ramp (raised)' });
    // ---- staging lanes: fenced, two vehicle gates, a pedestrian turnstile and a protected pen ----
    wallLine(76, 22, 84, 22, MAT.CHAIN); wallLine(92, 22, 93, 22, MAT.CHAIN); wallLine(101, 22, 104, 22, MAT.CHAIN);
    wallLine(76, 34, 104, 34, MAT.CHAIN); wallLine(76, 22, 76, 34, MAT.CHAIN); wallLine(104, 22, 104, 34, MAT.CHAIN);
    fill(77, 23, 103, 33, F.QUAY);
    door(null, 76, 25, 6, 'v', { gate: true, label: 'Staging Gate', color: '#8a8f94', gateH: 2.1, locked: true, lockedMsg: 'Staging Gate: motorized, controlled from the gatehouse', hp: 320, maxHp: 320 });
    clearWall(76, 32, 76, 33); K.truckOnly(75, 32, 77, 33);                 // turnstile
    door(null, 98, 34, 6, 'h', { gate: true, label: 'Gate C', color: '#7a7f84', gateH: 2.1, locked: true, pry: 3, hp: 320, maxHp: 320 });
    wallLine(77, 28, 82, 28, MAT.RAIL); wallLine(82, 23, 82, 26, MAT.RAIL);
    W.safeZones.push({ x1: 77, y1: 23, x2: 82, y2: 28, name: 'staging pen' });
    // ramp control house at the head of the lanes
    const rh = building('Ramp Control', 'ramphouse', 94, 15, 100, 22, MAT.CONCRETE, F.LINO, '#2f3438');
    door('ramphouse', 96, 22, 2, 'h', { label: 'Control House Door', color: '#5b6670' });
    windows(94, 17, 94, 20); windows(100, 17, 100, 20);
    rh.rooms.push({ name: 'Ramp Control', x1: 95, y1: 16, x2: 99, y2: 21 });
    W.socket = box('panel', 98.4, 17, 0.5, 0.45, 0, 1.0, { color: '#3a3f44', label: 'Hydraulic bay' });
    W.rampConsole = box('console', 95.8, 16.6, 0.9, 0.35, 0, 1.1, { color: '#4c5459', label: 'Ramp console' });
    sign('RAMP 2', 94.4, 22, 'S', 3, '#ffd36a', '#2a2d33', 2.6);
    // ---- gatehouse on Quay Road ----
    const gh = building('Gatehouse', 'gate', 66, 43, 72, 48, MAT.BLOCK, F.LINO, '#3b3f44');
    door('gate', 68, 43, 2, 'h', { label: 'Gatehouse Door' }); windows(71, 43, 72, 43); windows(72, 45, 72, 47);
    gh.rooms.push({ name: 'Gatehouse', x1: 67, y1: 44, x2: 71, y2: 47 });
    W.gateCtl = box('panel', 67.4, 46.6, 0.35, 0.3, 0, 1.5, { color: '#5d6a5e', label: 'Staging gate control' });
    W.paCtl = box('panel', 70.6, 46.6, 0.35, 0.3, 0, 1.5, { color: '#4c5459', label: 'Terminal PA' });
    // ---- passenger terminal and shelters ----
    const pt = building('Harbor Street Terminal', 'terminal', 20, 17, 46, 30, MAT.CONCRETE, F.TILE, '#2c3236');
    wallLine(21, 23, 27, 23, MAT.INTERIOR); wallLine(28, 18, 28, 23, MAT.INTERIOR);
    door('terminal', 28, 20, 2, 'v', { label: 'Ticket Office Door' });
    door('terminal', 32, 30, 2, 'h', { label: 'Terminal Doors', color: '#5b6670' });
    door('terminal', 46, 22, 2, 'v', { label: 'Side Door' });
    windows(21, 30, 30, 30); windows(35, 30, 45, 30); windows(20, 20, 20, 28); windows(30, 17, 44, 17);
    pt.rooms.push({ name: 'Ticket Office', x1: 21, y1: 18, x2: 27, y2: 22 });
    sign('HARBOR STREET FERRY', 34, 30, 'S', 10, '#9fd8f0', '#1d3140', 2.7);
    for (const [x, y] of [[33, 25], [39, 25], [33, 27.5], [39, 27.5]]) box('bench', x, y, 1.6, 0.35, 0, 0.6, { color: '#5a6064' });
    box('counter', 25.5, 21.8, 1.5, 0.35, 0, 1.0, { color: '#6b5a44' });
    W.canopies = [{ x1: 50, y1: 31, x2: 57, y2: 33, h: 3.0, fascia: '#2f5a7a', top: '#c9cfd2', text: 'BUS · FERRY' }, { x1: 60, y1: 31, x2: 67, y2: 33, h: 3.0, fascia: '#2f5a7a', top: '#c9cfd2', text: 'TAXI' }];
    for (const c of W.canopies) { for (const [x, y] of [[c.x1 + 0.3, c.y1 + 0.3], [c.x2 + 0.7, c.y1 + 0.3]]) circ('post', x, y, 0.12, 3.0); box('bench', (c.x1 + c.x2 + 1) / 2, c.y1 + 1.2, 2.5, 0.3, 0, 0.6, { color: '#5a6064' }); }
    // ---- container yard: stacks form the cargo lanes ----
    const conts = [MAT.CONT_R, MAT.CONT_B, MAT.CONT_G, MAT.CONT_Y];
    let ci = 0;
    for (const y0 of [48, 60, 72]) for (const x0 of [16, 34, 52]) {
      for (const dy of [0, 3]) { const m = conts[(ci++) % 4]; for (let y = y0 + dy; y <= y0 + dy + 2; y++) wallLine(x0, y, x0 + 11, y, m); }
    }
    // a container office with a jammed door (a dockhand is inside)
    clearWall(38, 73, 41, 76); fill(38, 73, 41, 76, F.METAL);
    door(null, 39, 77, 2, 'h', { gate: true, label: 'Container Door', color: '#2f5a7a', gateH: 2.4, locked: true, pry: 2, hp: 200, maxHp: 200 });
    wallLine(37, 72, 42, 72, MAT.CONT_B); wallLine(37, 72, 37, 77, MAT.CONT_B); wallLine(42, 72, 42, 77, MAT.CONT_B);
    // reach stacker and a gantry over the lanes
    box('gantry', 43, 66, 9, 3.2, 0, 14, { direct: true, solid: false, sprR: 10, hl: 9, hw: 3.2, trolley: 3, fade: true, kOff: 1 });
    box('forklift', 73, 58, 1.0, 0.55, 1.2, 2.2, { sprR: 1.6 });
    // ---- maintenance sheds ----
    building('Shed 1', 'shed1', 72, 80, 80, 92, MAT.CORR, F.CONCRETE_IN, '#4a4f53');
    clearWall(75, 80, 77, 80); door('shed1', 79, 92, 1, 'h', { label: 'Back Door' });
    building('Shed 2', 'shed2', 83, 80, 93, 92, MAT.CORR, F.CONCRETE_IN, '#4a4f53');
    clearWall(86, 80, 89, 80);
    sign('MAINT 1', 72.5, 80, 'S', 2.4, '#ffd36a', '#2a2d33', 2.8); sign('MAINT 2', 83.5, 80, 'S', 2.4, '#ffd36a', '#2a2d33', 2.8);
    box('lift', 76, 88, 1.2, 0.5, 1.57, 0.4, {}); box('toolbox', 79, 84, 0.5, 0.3, 0, 1.1, { color: '#a33' });
    box('counter', 91.4, 86, 1.5, 0.4, Math.PI / 2, 1.0, { color: '#6b6e70' }); box('drum', 85, 90.6, 0.3, 0.3, 0, 0.9, { shape: 'circle', r: 0.3, color: '#3e6a4a' });
    // dressing
    for (const [x, y, a, c] of [[22, 38.6, 0.04, '#4a4f55'], [46, 103.6, 3.1, '#5e3d3d'], [10.8, 60, 1.57, '#6b4b3b'], [62, 101.4, 0.05, '#3f5566'], [101.8, 50, 1.6, '#58534a']]) K.car(x, y, a, c);
    box('van', 30, 39.6, 2.7, 1.05, 0.02, 2.1, { color: '#e2e0d8' });
    for (const [x, y] of [[86, 60], [92, 50], [60, 112], [80, 112], [20, 112], [3, 90], [3, 30], [96, 112]]) box('pallets', x, y, 0.7, 0.7, (x * 0.1) % 1, 1.0, {});
    for (const [x, y] of [[26, 110], [40, 114], [90, 115], [3, 50], [3, 104], [74, 112]]) K.tree(x, y);
    for (const [x, y] of [[80, 50], [90, 64], [78, 98]]) box('drum', x, y, 0.3, 0.3, 0, 0.9, { shape: 'circle', r: 0.3, color: '#7a3a2a' });
    W.speaker = box('speaker', 18, 33.6, 0.1, 0.1, -1.0, 5, {});
    box('speaker', 88, 33, 0.1, 0.1, 1.2, 5, {});
    // lights: quay floods on June's generator, staging lanes, the ferry
    for (const [x, y] of [[20, 34.4], [40, 34.4], [60, 34.4], [14.6, 60], [14.6, 90], [30, 98.4], [70, 98.4], [97.4, 60], [97.4, 90], [86, 70.6]]) K.lamp(x, y);
    for (const [x, y] of [[80, 33], [92, 33], [102, 24]]) K.lamp(x, y, { col: 'rgba(210,225,255,A)', r: 8.5 });
    W.glows.push({ x: 88, y: 3, r: 4, col: 'rgba(255,230,180,A)', a: 0.2, z: 7 });
    W.glows.push({ x: 88, y: 15.5, r: 3, col: 'rgba(255,210,140,A)', a: 0.25, z: 2, power: 'rampDown', hole: { x: 88, y: 17, r: 4, a: 0.6 } });
    for (const [x, y] of [[85, 21], [91, 21]]) W.glows.push({ x, y, r: 2, col: 'rgba(255,170,40,A)', a: 0.3, blink: 1.6, ph: x * 0.2, emitter: 'klaxon', z: 2.5, hole: { x, y, r: 2.5, a: 0.5 } });
    W.glows.push({ x: 98.4, y: 17, r: 1.8, col: 'rgba(120,220,255,A)', a: 0.2, z: 1.2, power: 'pack' });
    for (let i = 0; i < 10; i++) W.glows.push({ x: 108 + (i * 3.7) % 10, y: 4 + (i * 11.3) % 100, r: 2, col: 'rgba(255,190,110,A)', a: 0.05, z: -1 });
    // markings: staging lanes, the ramp approach, lane letters in the container yard
    for (let y = 25; y <= 32; y += 3.5) W.marks.push({ k: 'line', x1: 84, y1: y, x2: 103, y2: y, col: 'rgba(240,240,230,0.35)', w: 0.12, dash: [1.2, 0.8] });
    W.marks.push({ k: 'hatch', x1: 85, y1: 21, x2: 92, y2: 23, col: 'rgba(230,190,40,0.6)' });
    W.marks.push({ k: 'text', x: 79.5, y: 30.6, text: 'PEN', size: 50, col: 'rgba(127,227,160,0.45)' });
    for (const [x, y, t] of [[30.5, 56, 'C'], [48.5, 56, 'D'], [66.5, 56, 'E'], [30.5, 81, 'C'], [48.5, 81, 'D']]) W.marks.push({ k: 'text', x, y, text: t, size: 110, col: 'rgba(230,220,200,0.3)' });
    W.marks.push({ k: 'line', x1: 0, y1: 16.05, x2: 105, y2: 16.05, col: 'rgba(230,200,80,0.6)', w: 0.2 });
    K.decals(50, 13);
    P('exitSign', 6.8, 115, { solid: false, text: 'EXIT', sub: 'TERMINAL RD', h: 3.2 });
    P('exitSign', 2.8, 66.8, { solid: false, text: 'EVAC', sub: 'ON FOOT', h: 2.8, green: true });
    W.glows.push({ x: 1.5, y: 63, r: 3.5, col: 'rgba(90,255,140,A)', a: 0.16, pulse: 6, hole: { x: 1.5, y: 63, r: 4, a: 0.7 } });

    K.finish();
    W.exits = [
      { id: 'ferry', name: 'Ferry Ramp', kind: 'ferry', x1: 85, y1: 16, x2: 91.9, y2: 20.5, lx: 88, ly: 22, out: [0, -1], prefer: 60 },
      { id: 's', name: 'Terminal Road', kind: 'truck', x1: 7.5, y1: 115, x2: 14, y2: 119.9, lx: 10.5, ly: 113, out: [0, 1] },
      { id: 'foot', name: 'Seawall path', kind: 'foot', x1: 0, y1: 61.5, x2: 2.5, y2: 65, lx: 4, ly: 63, out: [-1, 0] },
    ];
    W.ferryPath = [[88, 19.5], [88, 15.5], [88, 11.5], [88, 8.5]];
    W.start = { truck: { x: 10.5, y: 110, ang: -Math.PI / 2 }, player: { x: 13.6, y: 108.5 }, aim: -Math.PI / 2 };
    W.reserveEntries = [{ x: 10.5, y: 117, name: 'Terminal Road' }, { x: 2.5, y: 80, name: 'west fence' }, { x: 60, y: 117, name: 'south fence' }, { x: 2.5, y: 30, name: 'northwest quay' }];
    W.landmarks = [
      { id: 'terminal', name: 'Passenger Terminal', x: 33, y: 24, r: 13 },
      { id: 'staging', name: 'Staging Lanes', x: 90, y: 28, r: 12 },
      { id: 'ramp', name: 'Ferry Ramp', x: 88, y: 18, r: 6 },
      { id: 'gatehouse', name: 'Gatehouse', x: 69, y: 45, r: 6 },
      { id: 'sheds', name: 'Maintenance Sheds', x: 82, y: 82, r: 12 },
      { id: 'lanes', name: 'Container Lanes', x: 40, y: 66, r: 18 },
      { id: 'office', name: 'Container Office', x: 39.5, y: 75, r: 5, quiet: true },
      { id: 'alley', name: 'East Alley', x: 101.5, y: 70, r: 8, quiet: true },
    ];
    W.zombieGroups = [
      [30.5, 56.5, 2.5, { drifter: 3, runner: 1 }, { tag: 'lanes' }], [48.5, 63, 2.5, { drifter: 3, howler: 1 }, { tag: 'lanes' }], [66.5, 69, 2.5, { drifter: 3, clinger: 1 }, { tag: 'lanes' }],
      [30.5, 81, 2.5, { drifter: 3 }, { tag: 'lanes' }], [48.5, 82, 2.5, { drifter: 2, runner: 1 }, { tag: 'lanes' }],
      [42, 38, 4, { drifter: 3 }, { tag: 'quay' }], [60, 26, 4, { drifter: 2, runner: 1 }, { tag: 'quay' }],
      [38, 25.5, 2.5, { drifter: 2, howler: 1 }, { tag: 'terminal' }],
      [80, 75, 3.5, { drifter: 2, clinger: 1 }, { tag: 'sheds' }], [88, 89, 1.5, { drifter: 2 }, { tag: 'sheds' }],
      [101.5, 60, 2.5, { drifter: 2 }, { tag: 'alley' }], [90, 30, 2.5, { drifter: 2 }, { tag: 'staging' }],
    ];
    W.mapTitle = 'HARBOR STREET TERMINAL';
    return W;
  };

  const L = (DH.LEVELS[5] = {
    id: 5, key: 'crossing', name: 'Last Crossing', place: 'HARBOR STREET TERMINAL, BEFORE DAWN', short: 'Open the crossing', tag: 'Ferry ramp, truck route, departure',
    build,
    brief: () => 'June’s ferry can carry the truck to the island depot, but the Harbor Street ramp is dead. Take the hydraulic power pack from maintenance shed 2 to the ramp control house, lower the ramp, open a lane into staging, and drive aboard. Quay Road is direct and exposed; Shed Row and the east alley are longer and sheltered. Stranded dockworkers may need help. One passenger seat.',
    meta: () => [['Primary', 'Power pack (shed 2) → ramp control → open a lane → drive aboard'], ['Routes', 'Quay Road + staging gate · Shed Row + Gate C'], ['Optional', 'Stranded dockworkers (staging pen) · community supplies'], ['Exits', 'Ferry ramp · Terminal Road · seawall path']],
    optionalKeys: [['stranded', 'Get every stranded dockworker out'], ['supplies', 'Load all community supplies']],
    reserve: 12,
    recruitTip: () => 'Walk them into the staging pen, or one at a time in the passenger seat.',
    setup(run, rng, story) {
      const G = DH.G;
      G.addItem(run, 'powerpack', 'powerpack', 88.5, 87, { spot: 'Hydraulic power pack in shed 2. Heavy: bring the truck to the shed apron.', haulTip: 'Get it to the truck, or straight to the ramp control house.' });
      const sp = [[26.5, 20.4], [96, 30.5], [60, 66.5], [53.5, 33.6]];
      sp.forEach((p, i) => G.addItem(run, 'supplies' + i, 'supplies', p[0], p[1]));
      const salv = rng.shuffle([[44, 20], [70, 45.5], [33, 66], [57, 80], [78, 90], [99, 40], [20, 100], [86, 74], [64, 39.5], [41, 74.5], [12, 30], [94, 104]]).slice(0, 6);
      salv.forEach((p, i) => G.addItem(run, 'salvage' + i, 'salvage', p[0], p[1]));
      const pk = G.addPickup;
      pk(run, 'weapon', 26.5, 18.8, { wtype: 'shotgun', mag: 6, reserve: 12, cabinet: true });
      pk(run, 'weapon', 79, 86, { wtype: 'smg', mag: 30, reserve: 60, crate: true });
      pk(run, 'repairkit', 74, 84, { n: 1 }); pk(run, 'repairkit', 70.5, 44.5, { n: 1 });
      pk(run, 'medkit', 40, 21, { n: 1 }); pk(run, 'medkit', 90.6, 82.5, { n: 1 }); pk(run, 'medkit', 97, 19.5, { n: 1 });
      pk(run, 'ammo', 67.4, 44.6, { atype: 'p9', n: 24 }); pk(run, 'ammo', 76.5, 90.5, { atype: 'p9', n: 24 }); pk(run, 'ammo', 21.6, 22, { atype: 'shell', n: 6 });
      pk(run, 'noisemaker', 13.6, 104, { n: 1 }); pk(run, 'noisemaker', rng.pick([[33, 34.4], [70, 74]])[0], 50, { n: 1 });
      G.addSurvivor(run, 'ines', 'Ines', 'ines', 22.5, 19.5, { where: 'Ticket office', landmark: 'terminal', pron: 'her', call: true, stranded: true });
      G.addSurvivor(run, 'ray', 'Ray', 'ray', 39.5, 74.8, { locked: true, where: 'Container office', landmark: 'office', pron: 'him', call: true, stranded: true });
      G.addSurvivor(run, 'bo', 'Bo', 'bo', 78.3, 86.5, { where: 'Shed 1', landmark: 'sheds', pron: 'him', call: true, stranded: true });
      G.addEmitter(run, { id: 'klaxon', x: 88, y: 21, r: 46, period: 1.0, warmup: 5, kind: 'klaxon', cueLabel: 'RAMP', color: 'rgba(255,170,40,1)', after: 'rampDone' });
      G.addEmitter(run, { id: 'pa', x: 18, y: 33.6, r: 42, period: 1.2, warmup: 3, kind: 'speaker', cueLabel: 'PA', color: 'rgba(255,220,120,1)' });
    },
    exitOpen(z, run) {
      if (z.kind !== 'ferry') return true;
      if (!run.flags.rampDown) return run.flags.ramping ? 'The ramp is still lowering.' : 'The ferry ramp is up. Restore the ramp controls first.';
      return true;
    },
    nextStep(run) {
      const pp = run.items.powerpack;
      if (pp.loc !== 'installed') return 'pack';
      if (!run.flags.rampDown) return 'ramp';
      if (!run.flags.gateA && !run.flags.gateC) return 'route';
      return 'board';
    },
    interact(run, add, p) {
      const W = DH.G.W, G = DH.G, Pl = DH.Player;
      const near = (o, r) => M.dist(p.x, p.y, o.x, o.y) < (r || 1.9);
      const act = (key, dur, label, o) => () => Pl.startAction('script', dur, label, { key, hold: true, near: { x: o.x, y: o.y, r: 2.6 } });
      const pack = run.items.powerpack;
      if (near(W.socket, 2.4)) {
        if (pack.loc === 'installed') add('install', 'Power pack installed', W.socket.x, W.socket.y, 0.6, () => {}, { disabled: true });
        else if (p.hauling && p.haulId === 'powerpack') add('install', 'Hold E: Install the power pack (3 s)', W.socket.x, W.socket.y, -2.5, act('install', 3, 'Connecting the power pack', W.socket), { hold: true });
        else add('install', 'Hydraulic bay: empty (bring the power pack from shed 2)', W.socket.x, W.socket.y, 0.4, () => {}, { disabled: true });
      }
      if (near(W.rampConsole, 2.0)) {
        if (run.flags.rampDown) add('ramp', 'Ramp down', W.rampConsole.x, W.rampConsole.y, 0.6, () => {}, { disabled: true });
        else if (run.flags.ramping) add('ramp', 'Ramp lowering...', W.rampConsole.x, W.rampConsole.y, 0.6, () => {}, { disabled: true });
        else if (pack.loc !== 'installed') add('ramp', 'Ramp console: no hydraulic power', W.rampConsole.x, W.rampConsole.y, 0.4, () => G.msg('Install the power pack in the hydraulic bay first.', 'warn', 2), { disabled: true });
        else add('ramp', 'Hold E: Lower the ferry ramp (LOUD)', W.rampConsole.x, W.rampConsole.y, -0.3, act('lower', 3, 'Starting ramp hydraulics', W.rampConsole), { hold: true });
      }
      if (near(W.gateCtl)) {
        if (run.flags.gateA) add('gateA', 'Staging gate open', W.gateCtl.x, W.gateCtl.y, 0.6, () => {}, { disabled: true });
        else add('gateA', 'Hold E: Open the staging gate (motor, loud)', W.gateCtl.x, W.gateCtl.y, -0.3, act('gateA', 1.5, 'Running the gate motor', W.gateCtl), { hold: true });
      }
      if (near(W.paCtl)) {
        const e = G.emitter(run, 'pa'), cd = (run.timers.pa || 0) - run.time;
        if (e.on) add('pa', 'Terminal PA: playing', W.paCtl.x, W.paCtl.y, 0.5, () => {}, { disabled: true });
        else if (cd > 0) add('pa', 'Terminal PA (amplifier cooling ' + Math.ceil(cd) + ' s)', W.paCtl.x, W.paCtl.y, 0.5, () => {}, { disabled: true });
        else add('pa', 'Hold E: Terminal PA: west quay speakers (25 s, LOUD)', W.paCtl.x, W.paCtl.y, -0.25, act('pa', 1, 'Keying the PA', W.paCtl), { hold: true });
      }
    },
    highlights(run) {
      const W = DH.G.W, out = [];
      const st = L.nextStep(run);
      if (st === 'pack' && (run.player.hauling || run.items.powerpack.loc === 'truck')) out.push({ x: W.socket.x, y: W.socket.y, r: 1.0, d: 14 });
      if (st === 'ramp') out.push({ x: W.rampConsole.x, y: W.rampConsole.y, r: 0.9, d: 14 });
      if (!run.flags.gateA) out.push({ x: W.gateCtl.x, y: W.gateCtl.y, r: 0.6, d: 9, col: '#ffd36a' });
      out.push({ x: W.paCtl.x, y: W.paCtl.y, r: 0.6, d: 9, col: '#8cd6ff' });
      return out;
    },
    labels(run) {
      const pp = DH.Player.pos(), W = DH.G.W, out = [];
      const lb = (o, t, c) => { if (M.dist(pp.x, pp.y, o.x, o.y) < 12) out.push({ x: o.x, y: o.y, z: 2.2, text: t, col: c || '#ffd36a' }); };
      lb(W.gateCtl, run.flags.gateA ? 'STAGING GATE: OPEN' : 'STAGING GATE'); lb(W.paCtl, 'TERMINAL PA', '#8cd6ff');
      lb({ x: 88, y: 21 }, run.flags.rampDown ? 'RAMP DOWN: BOARD HERE' : run.flags.ramping ? 'RAMP LOWERING' : 'RAMP UP', run.flags.rampDown ? '#7fe3a0' : '#ffd36a');
      if (M.dist(pp.x, pp.y, 79.5, 25.5) < 16 && run.survivors.some((s) => s.recruited && !s.safe)) out.push({ x: 79.5, y: 25.5, z: 1.8, text: 'STAGING PEN (safe)', col: '#7fe3a0' });
      return out;
    },
    onAction(run, key, data) {
      const G = DH.G, Wd = DH.World, W = G.W, p = run.player;
      if (key === 'install') {
        const pk = run.items.powerpack;
        if (pk.loc !== 'hauled') return;
        pk.loc = 'installed'; pk.x = W.socket.x; pk.y = W.socket.y; p.hauling = false; p.haulId = null;
        run.flags.pack = true;
        G.msg('Power pack connected. The ramp console has power.', 'objective', 3.5);
        G.radio('june', 'I see lights on the ramp board! Lower it when you’re ready. It will be loud.', 'pack');
      } else if (key === 'lower' && !run.flags.ramping && !run.flags.rampDown) {
        run.flags.ramping = true;
        Wd.startEmitter('klaxon', 20);
        G.msg('Ramp klaxon! The hydraulics will take about 25 seconds.', 'warn', 3.5);
      } else if (key === 'rampDone') {
        run.flags.ramping = false; run.flags.rampDown = true;
        G.setGate('ramp', false);
        G.msg('The ferry ramp is down. Drive aboard.', 'objective', 4);
        G.radio('june', 'Ramp’s down! Bring the truck up the lane, we’ll chain it on the car deck.', 'rampDown');
      } else if (key === 'gateA' && !run.flags.gateA) {
        const gi = W.doors.findIndex((d) => d.label === 'Staging Gate');
        run.doors[gi].locked = false; run.doors[gi].open = true; W.doors[gi].locked = false; W.doors[gi].open = true; W.version++;
        run.flags.gateA = true;
        G.emitNoise(76.5, 28, 18, 'machine', 2.5); DH.bus.emit('shutter', true, 76.5, 28);
        G.msg('Staging gate open. Quay Road runs straight in.', 'info', 3);
      } else if (key === 'pa') {
        Wd.startEmitter('pa', 25); run.timers.pa = run.time + 50;
        G.msg('Terminal PA playing on the west quay.', 'info', 2);
      } else if (key === 'pried') {
        const d = W.doors[data.door];
        if (d.label === 'Gate C') { run.flags.gateC = true; G.msg('Gate C forced. The east alley runs into staging.', 'info', 3); }
        if (d.label === 'Container Door') { const s = G.findSurvivor(run, 'ray'); if (s) { s.locked = false; s.call = false; G.radio('ray', 'Ray. Dockhand. That box was not built for living in.', 'ray'); } }
      }
    },
    update(run, dt) {
      const G = DH.G, pp = DH.Player.pos(), perks = run.perks || {};
      if (run.time > 2) G.radio('june', 'Power pack’s in maintenance shed two. Hydraulic bay is in the ramp control house. Then open a lane to staging.', 'intro');
      if (run.time > 12) G.radio(perks.wes ? 'wes' : 'marta', perks.wes ? 'I’ve got the relay feed. I’ll call out crowds. Quay Road is fast and open; Shed Row is the long way, but walls on both sides.' : 'Quay Road is fast and open. Shed Row and the east alley are the long way round, with cover.', 'tip');
      if (run.time > 24) G.radio('june', 'Ines is stuck in the terminal, Ray in the containers, old Bo at the sheds. Your truck has one seat. Our staging pen is safe.', 'stranded');
      for (const s of run.survivors) if (!s.recruited && s.call && M.dist(pp.x, pp.y, s.x, s.y) < 15) G.radio(s.id, s.id === 'ines' ? 'Hey! I’m Ines, I keep that ferry running. Get me to staging?' : s.id === 'ray' ? 'In the box! The door’s jammed shut. Pry it!' : 'Over here, son. My knees don’t do running anymore.', 'call_' + s.id);
      // the climax: ramp hydraulics pull the container lanes toward staging
      const k = G.emitter(run, 'klaxon');
      if (k.on && k.warm > 0 && !run.flags.klaxWarn) {
        run.flags.klaxWarn = true;
        G.cue('KLAXON', 88, 21, 'warn');
        if (perks.wes) G.radio('wes', 'Klaxon’s up. Lanes C, D and E are going to empty toward you. You have maybe fifteen seconds.', 'klaxWes');
      }
      if (k.on && k.warm <= 0 && !run.flags.lanesDrawn) {
        run.flags.lanesDrawn = true;
        const n = DH.World.drawGroup('lanes', 80, 37, 10) + DH.World.drawGroup('quay', 80, 34, 8) + DH.World.drawGroup('sheds', 95, 40, 6);
        if (n) { G.cue('MOVEMENT', 48, 58, 'danger'); G.cue('MOVEMENT', 66, 70, 'danger'); G.radio('june', 'They heard it. They’re coming out of the container lanes toward the staging gate. Make an opening!', 'climax'); }
      }
      const pa = G.emitter(run, 'pa');
      if (pa.on && pa.warm <= 0 && !pa._drawn) { pa._drawn = true; const n = DH.World.drawGroup('lanes', pa.x, pa.y + 2, 8) + DH.World.drawGroup('quay', pa.x, pa.y + 2, 6); if (n) G.cue('MOVEMENT', 40, 50, 'warn'); }
      if (!pa.on) pa._drawn = false;
      if (perks.wes && run.time > 40 && Math.floor(run.time) % 45 === 0 && !run.said['wesTick' + Math.floor(run.time)]) {
        const near = run.zombies.filter((z) => !z.dead && z.state === 'chase').length;
        if (near >= 5) G.radio('wes', near + ' of them on you. Break line of sight or throw something loud.', 'wesTick' + Math.floor(run.time));
      }
      if (DH.FX && Math.random() < dt * 2) { const x = 4 + Math.random() * 100, y = 14.5; if (M.dist(x, y, pp.x, pp.y) < 30) DH.FX.ring(x, y, 0.8, 'rgba(170,200,215,1)', 0.8); }
    },
    objectives(run) {
      const G = DH.G, pk = run.items.powerpack, out = [];
      out.push({ text: pk.loc === 'installed' ? 'Power pack installed' : pk.loc === 'hauled' ? 'Haul the power pack to the truck or the ramp house' : pk.loc === 'truck' ? 'Power pack on the truck: drive to the ramp control house' : 'Get the hydraulic power pack (maintenance shed 2)', done: pk.loc === 'installed' });
      out.push({ text: run.flags.rampDown ? 'Ramp down' : run.flags.ramping ? 'Ramp lowering: hold out' : 'Lower the ferry ramp (control house console)', done: !!run.flags.rampDown, opt: false });
      out.push({ text: run.flags.gateA || run.flags.gateC ? 'Lane open: drive aboard the ferry' : 'Open a lane into staging (gatehouse or Gate C)', done: !!(run.flags.gateA || run.flags.gateC), opt: false });
      const st = run.survivors.filter((s) => s.stranded), safe = st.filter((s) => s.safe || s.boarded).length;
      const sup = Object.values(run.items).filter((i) => i.kind === 'supplies' && i.loc !== 'world').length;
      out.push({ text: 'Optional: dockworkers safe ' + safe + '/' + st.length + ' · supplies ' + sup + '/4', done: safe === st.length && sup >= 4, opt: true });
      return out;
    },
    pointer(run) {
      const G = DH.G, W = G.W, p = run.player, pk = run.items.powerpack, st = L.nextStep(run);
      if (st === 'pack') {
        if (p.hauling && p.haulId === 'powerpack') return M.dist(p.x, p.y, W.socket.x, W.socket.y) < 25 ? { x: W.socket.x, y: W.socket.y, label: 'HYDRAULIC BAY', col: '#ff8a7a' } : { x: run.truck.x, y: run.truck.y, label: 'TRUCK', col: '#ffd36a' };
        if (pk.loc === 'truck') return p.inTruck ? { x: 92, y: 28, label: 'STAGING', col: '#ff8a7a' } : { x: run.truck.x, y: run.truck.y, label: 'UNLOAD AT HOUSE', col: '#ff8a7a' };
        return { x: pk.x, y: pk.y, label: 'POWER PACK', col: '#ff8a7a' };
      }
      if (st === 'ramp') return { x: W.rampConsole.x, y: W.rampConsole.y, label: 'RAMP CONTROLS', col: '#ff8a7a' };
      if (st === 'route') return p.inTruck ? { x: 76.5, y: 28, label: 'GATE', col: '#ffd36a' } : { x: W.gateCtl.x, y: W.gateCtl.y, label: 'GATEHOUSE', col: '#ffd36a' };
      if (!p.inTruck) return { x: run.truck.x, y: run.truck.y, label: 'TRUCK', col: '#ffd36a' };
      return { x: 88, y: 18, label: 'FERRY', col: '#8cd6ff' };
    },
    markers(run, dot) {
      const W = DH.G.W, pk = run.items.powerpack;
      if (pk.loc === 'world' && !run.seen.powerpack) dot(88, 86, 'rgba(255,107,90,.8)', 4);
      dot(W.socket.x, W.socket.y, pk.loc === 'installed' ? '#7fe3a0' : '#ff6b5a', 3);
      if (!run.flags.gateA) dot(W.gateCtl.x, W.gateCtl.y, '#ffd36a', 2.5);
      for (const id in run.items) { const it = run.items[id]; if (it.kind === 'supplies' && it.loc === 'world' && run.seen[id]) dot(it.x, it.y, '#c9b98a', 2); }
    },
    primaryOut: (out, run, mode) => mode === 'ferry' && !!run.flags.rampDown,
    primaryGot: (run) => !!run.flags.rampDown && !!(run.flags.gateA || run.flags.gateC),
    bonus: (out, run, mode) => { const b = []; if (run.flags.rampDown) b.push({ label: 'Ramp restored', scrap: DH.T.rewards.powerpack }); if (mode === 'ferry' && run.flags.rampDown) b.push({ label: 'Crossing', scrap: DH.T.rewards.crossing }); return b; },
    departWarn: 'Only the truck on the ferry completes the crossing. This will be a partial extraction.',
    resultSub(r) { return r.status === 'partial' ? 'The ferry left without the truck. The crossing still needs a working ramp and the truck aboard.' : r.status === 'failed' ? 'Nothing extracted. No rewards from this run. Your campaign progress is safe.' : 'The truck is on the car deck. The crossing is open.'; },
    resultRows(run, ev) {
      const R = DH.T.rewards;
      const st = run.survivors.filter((s) => s.stranded), out = st.filter((s) => ev.survivorsOut.indexOf(s.id) >= 0);
      return [
        ['Ramp controls (primary)', run.flags.rampDown ? 'Restored +' + R.powerpack : 'Not restored', run.flags.rampDown ? 'good' : 'bad'],
        ['Crossing (primary)', ev.mode === 'ferry' && run.flags.rampDown ? 'Truck aboard +' + R.crossing : 'Not made', ev.mode === 'ferry' ? 'good' : 'bad'],
        ['Lane used', run.flags.gateA && run.flags.gateC ? 'Both gates' : run.flags.gateA ? 'Staging gate (Quay Road)' : run.flags.gateC ? 'Gate C (east alley)' : 'None'],
        ['Dockworkers evacuated', out.length + ' / ' + st.length + (out.length ? ' (+' + out.length * R.survivor + ')' : ''), out.length ? 'good' : ''],
        ['Community supplies', (ev.got.supplies || 0) + ' / 4' + (ev.got.supplies ? ' (+' + ev.got.supplies * R.supplies + ')' : ''), ev.got.supplies ? 'good' : ''],
        ['Salvage bundles', ev.salvageOut + (ev.salvageOut ? ' (+' + ev.salvageOut * R.salvage + ')' : ''), ev.salvageOut ? 'good' : ''],
      ];
    },
    outcome(run, ev, mode) {
      const st = run.survivors.filter((s) => s.stranded);
      const n = st.filter((s) => ev.survivorsOut.indexOf(s.id) >= 0).length;
      const sup = ev.got.supplies || 0;
      return { crossing: mode === 'ferry' && !!run.flags.rampDown, stranded: n, supplies: sup, route: run.flags.gateA ? 'direct' : run.flags.gateC ? 'sheltered' : null, optional: { stranded: n >= st.length && st.length > 0, supplies: sup >= 4 } };
    },
    hints: {
      start: { kbm: 'Harbor Street. Power pack in shed 2, hydraulic bay in the ramp house, then open a lane and drive aboard. Follow the red pointer.', touch: 'Power pack in shed 2, ramp house, open a lane, drive aboard. Follow the red pointer.' },
      primaryGot: { kbm: 'Ramp down and a lane open. Drive the truck up the ramp onto the ferry.', touch: 'Ramp down and a lane open. Drive the truck up the ramp.' },
    },
    backdropCam: { x: 70, y: 40 },
  });
})();

