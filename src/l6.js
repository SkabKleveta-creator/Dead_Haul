/* DEAD HAUL - Level 6: Landfall (Island Depot, the ferry's island berth) */
(function () {
  'use strict';
  const DH = window.DH;
  DH.LEVELS = DH.LEVELS || {};
  const M = DH.M;
  const YARD = { x1: 41, y1: 51, x2: 91, y2: 103 };
  const BAY = { x1: 53.5, y1: 79.5, x2: 62.5, y2: 93 };

  const build = () => {
    const K = DH.MapKit('landfall', { theme: { dark: 'rgba(18,24,40,0.5)', lamp: 'rgba(255,190,110,A)', lightR: 9, haze: 'rgba(120,140,160,0.18)', wind: true } });
    const { W, MAT, F } = K;
    const { fill, wallLine, clearWall, windows, building, door, sign, P, box, circ } = K;
    W.hasWater = true;

    // ---- ground: sea north and east, shallows, quay ----
    fill(0, 0, 119, 119, F.GRASS);
    K.ground(0, 0, 119, 12, F.SEA);
    K.ground(108, 0, 119, 82, F.SEA);
    fill(0, 13, 107, 15, F.WATER);
    fill(105, 16, 107, 82, F.WATER);
    fill(20, 13, 42, 24, F.QUAY);
    K.road(28, 16, 34, 41, false);           // Pier Road
    K.road(6, 36, 100, 41, false);           // Harbour Road
    K.road(95, 36, 100, 110, false);         // Depot Lane
    K.road(6, 36, 11, 119, false);           // West Road (to the south exit)
    K.road(12, 106, 100, 110, false);        // South Road
    fill(12, 34, 94, 35, F.WALK); fill(12, 42, 94, 43, F.WALK); fill(26, 25, 27, 33, F.WALK); fill(35, 25, 36, 33, F.WALK);
    fill(33, 44, 38, 68, F.WALK);            // footpath along the west fence
    K.paveRoads();
    fill(62, 42, 67, 50, F.ROAD);            // gate throat
    // ---- map edge (land side) ----
    wallLine(0, 16, 0, 119, MAT.BARRICADE); wallLine(0, 119, 107, 119, MAT.BARRICADE); wallLine(107, 83, 107, 119, MAT.BARRICADE);
    clearWall(6, 119, 11, 119); clearWall(0, 17, 0, 20);
    // ---- the ferry at its island berth, ramp down ----
    W.ferry = box('ferry', 31, 5, 4.5, 7, 0, 7, { direct: true, solid: false, sprR: 10, fade: false, segDef: [31, -2, 31, 12], segAlways: true, segBias: -0.5 });
    W.ramp = box('ramp', 31, 15.5, 2.5, 3, 0, 0.3, { direct: true, solid: false, fade: false, pri: 0.05, kOff: -3 });
    for (let x = 2; x < 106; x += 6) if (x < 19 || x > 43) box('mooring', x + 0.5, 15.6, 0.25, 0.25, 0, 0.7, {});
    // ---- depot compound: chain fence, motorized gate, quiet side door ----
    fill(41, 51, 91, 103, F.LOT);
    wallLine(40, 50, 61, 50, MAT.CHAIN); wallLine(68, 50, 68, 50, MAT.CHAIN); wallLine(76, 50, 92, 50, MAT.CHAIN);
    wallLine(40, 50, 40, 104, MAT.CHAIN); wallLine(92, 50, 92, 104, MAT.CHAIN); wallLine(40, 104, 92, 104, MAT.CHAIN);
    door(null, 62, 50, 6, 'h', { gate: true, label: 'Depot Gate', color: '#8a8f94', gateH: 2.1, locked: true, lockedMsg: 'Depot Gate: motorized, run from the gatehouse', hp: 400, maxHp: 400 });
    door(null, 40, 66, 2, 'v', { gate: true, label: 'Side Door', color: '#7a7f84', gateH: 2.0 });
    // gatehouse straddles the fence: one door to the road, one to the yard
    const gh = building('Gatehouse', 'gatehouse', 69, 46, 75, 55, MAT.BLOCK, F.LINO, '#3b3f44');
    door('gatehouse', 71, 46, 2, 'h', { label: 'Gatehouse Door' });
    door('gatehouse', 71, 55, 2, 'h', { label: 'Yard Door', color: '#5b6670', hp: 360, maxHp: 360 });
    gh.rooms.push({ name: 'Gatehouse', x1: 70, y1: 47, x2: 74, y2: 54 });
    W.motor = box('panel', 74.2, 51.6, 0.35, 0.6, 0, 1.8, { label: 'Gate motor', color: '#5d6a5e' });
    W.gateCon = box('console', 70.9, 48.4, 0.6, 0.3, 0, 1.1, { label: 'Gate controls' });
    box('cabinet', 70.4, 53.4, 0.35, 0.6, 0, 1.9, { color: '#5a6064' });
    sign('GATE', 75, 49, 'E', 3, '#ffd36a', '#2a2d33', 2.6);
    // the depot shed: open bay to the north, store room on the east side
    const dep = building('Island Depot', 'depot', 46, 78, 74, 100, MAT.CORR, F.CONCRETE_IN, '#4a4f53', { ribs: true, skylights: true });
    clearWall(54, 78, 61, 78);
    sign('ISLAND DEPOT', 74, 82, 'E', 9, '#e8e2cf', '#23384a', 3.0);
    wallLine(64, 79, 64, 99, MAT.INTERIOR);
    door('depot', 64, 88, 2, 'v', { label: 'Store Door' });
    dep.rooms.push({ name: 'Store', x1: 65, y1: 79, x2: 73, y2: 99 });
    for (const y of [83, 89, 95]) box('hirack', 49.5, y, 2.4, 0.6, 0, 2.6, { opaque: true });
    for (const y of [82, 92]) box('rack', 70, y, 2.5, 0.4, 0, 2.0, { color: '#8a8a88' });
    box('pallets', 66.5, 96, 0.7, 0.7, 0.1, 1.0, {});
    // ---- yard dressing: containers, a forklift, tank farm ----
    box('reefer', 50, 58, 6, 1.25, 0, 3.4, { color: '#2f5a7a' });
    box('reefer', 83, 60, 6, 1.25, 0, 3.4, { color: '#9a3a2c' });
    box('reefer', 86, 72, 6, 1.25, Math.PI / 2, 3.4, { color: '#3e6a46' });
    box('forklift', 75, 69, 1.0, 0.55, 0.6, 2.2, { sprR: 1.6 });
    for (const [x, y] of [[44, 75], [78, 62], [68, 66]]) box('pallets', x, y, 0.7, 0.7, (x * 0.1) % 1, 1.0, {});
    for (const [x, y] of [[80, 86], [86.5, 86], [80, 94], [86.5, 94]]) box('tank', x, y, 1.6, 1.6, 0, 3.2, { shape: 'circle', r: 1.6, color: '#8a5a2a' });
    box('jersey', 52, 66, 2.5, 0.5, 0.3, 0.9, {}); box('jersey', 72, 74, 2.5, 0.5, 1.2, 0.9, {});
    // ---- fuel pier into the east sea with a hut at the end ----
    K.unground(100, 44, 117, 47); fill(100, 44, 117, 47, F.DOCK);
    K.unground(108, 40, 117, 51); fill(108, 40, 117, 51, F.DOCK);
    wallLine(101, 43, 107, 43, MAT.RAIL); wallLine(101, 48, 107, 48, MAT.RAIL);
    K.truckOnly(100, 44, 101, 47);
    const hut = building('Pier Hut', 'pierhut', 110, 41, 117, 50, MAT.SIDING, F.WOOD, '#3c3430');
    door('pierhut', 110, 45, 2, 'v', { label: 'Pier Hut Door', locked: true, pry: 2.5, hp: 200, maxHp: 200, color: '#6b5236' });
    windows(113, 50, 115, 50);
    hut.rooms.push({ name: 'Pier Hut', x1: 111, y1: 42, x2: 116, y2: 49 });
    box('drum', 108.5, 42.5, 0.3, 0.3, 0, 0.9, { shape: 'circle', r: 0.3, color: '#b8322a' }); box('drum', 108.5, 49, 0.3, 0.3, 0, 0.9, { shape: 'circle', r: 0.3, color: '#b8322a' });
    box('boat', 105, 54, 1.5, 0.55, 1.4, 0.5, { solid: false, color: '#3a6a7a' });
    // ---- the harbour row: a bait shop and a net shed north of the road ----
    const bait = building('Bait & Tackle', 'bait', 48, 22, 58, 31, MAT.SIDING, F.WOOD, '#3c4a52');
    door('bait', 52, 31, 2, 'h', { label: 'Shop Door' }); windows(49, 31, 51, 31); windows(55, 31, 57, 31);
    bait.rooms.push({ name: 'Bait & Tackle', x1: 49, y1: 23, x2: 57, y2: 30 });
    box('counter', 52, 25, 2, 0.4, 0, 1.0, { color: '#6b5a44' });
    building('Net Shed', 'nets', 66, 20, 76, 30, MAT.WETSIDING, F.WOOD, '#3a3f44');
    clearWall(69, 30, 72, 30);
    box('spool', 70, 24, 0.8, 0.8, 0, 1.2, { shape: 'circle', r: 0.8 }); box('boxes', 73, 27, 0.6, 0.6, 0.2, 0.9, {});
    // road dressing and trees
    for (const [x, y, a, c] of [[20, 38.4, 0.05, '#4a4f55'], [44, 39.6, 3.1, '#5e3d3d'], [97.6, 70, 1.6, '#58534a'], [30, 108.4, 0.1, '#3f5566'], [8.6, 80, 1.55, '#6b4b3b']]) K.car(x, y, a, c);
    for (const [x, y] of [[16, 50], [22, 60], [18, 74], [26, 88], [30, 98], [50, 114], [70, 114], [90, 114], [102, 116], [15, 28], [84, 24], [100, 28]]) K.tree(x, y);
    for (const [x, y] of [[20, 34.4], [40, 34.4], [60, 34.4], [80, 34.4], [94, 34.4], [97.4, 60], [97.4, 90], [8.6, 70], [8.6, 100]]) K.lamp(x, y);
    for (const [x, y] of [[48, 76], [72, 76], [60, 60]]) K.lamp(x, y, { power: 'motor', col: 'rgba(210,225,255,A)', r: 8.5 });
    W.glows.push({ x: 74.2, y: 51.6, r: 1.6, col: 'rgba(120,220,255,A)', a: 0.2, z: 1.4, power: 'motor' });
    W.glows.push({ x: 31, y: 1, r: 4, col: 'rgba(255,230,180,A)', a: 0.18, z: 7 });
    W.marks.push({ k: 'hatch', x1: 62, y1: 49, x2: 68, y2: 51, col: 'rgba(230,190,40,0.6)' });
    W.marks.push({ k: 'text', x: 58, y: 86, text: 'BAY', size: 90, col: 'rgba(230,200,80,0.45)' });
    W.marks.push({ k: 'line', x1: 0, y1: 15.95, x2: 107, y2: 15.95, col: 'rgba(230,200,80,0.5)', w: 0.18 });
    K.decals(45, 21);
    P('exitSign', 4.5, 116, { solid: false, text: 'EXIT', sub: 'WEST ROAD', h: 3.2 });
    P('exitSign', 2.5, 21.5, { solid: false, text: 'EVAC', sub: 'BEACH', h: 2.8, green: true });
    W.glows.push({ x: 1.5, y: 18.5, r: 3.5, col: 'rgba(90,255,140,A)', a: 0.16, pulse: 6, hole: { x: 1.5, y: 18.5, r: 4, a: 0.7 } });

    K.finish();
    W.safeZones.push({ x1: 47, y1: 79, x2: 73, y2: 99, name: 'depot' });
    W.exits = [
      { id: 'bay', name: 'Depot Bay', kind: 'truck', x1: BAY.x1, y1: BAY.y1, x2: BAY.x2, y2: BAY.y2, lx: 58, ly: 76, out: [0, 1], prefer: 40 },
      { id: 's', name: 'West Road', kind: 'truck', x1: 5.5, y1: 115, x2: 12, y2: 119.9, lx: 8.5, ly: 113, out: [0, 1] },
      { id: 'ferry', name: 'Back aboard the ferry', kind: 'truck', x1: 28, y1: 13, x2: 34, y2: 15.5, lx: 31, ly: 20, out: [0, -1] },
      { id: 'foot', name: 'Beach path', kind: 'foot', x1: 0, y1: 16.5, x2: 2.5, y2: 20.5, lx: 4, ly: 18.5, out: [-1, 0] },
    ];
    W.start = { truck: { x: 31, y: 23, ang: Math.PI / 2 }, player: { x: 34.6, y: 21 }, aim: Math.PI / 2 };
    W.reserveEntries = [{ x: 2.5, y: 60, name: 'west' }, { x: 60, y: 117, name: 'south' }, { x: 102, y: 117, name: 'south-east' }, { x: 2.5, y: 32, name: 'beach' }];
    W.landmarks = [
      { id: 'gatehouse', name: 'Gatehouse', x: 72, y: 50, r: 6 },
      { id: 'yard', name: 'Depot Yard', x: 66, y: 64, r: 14 },
      { id: 'depot', name: 'Depot Shed', x: 60, y: 89, r: 12 },
      { id: 'pier', name: 'Fuel Pier', x: 108, y: 45.5, r: 8 },
      { id: 'tanks', name: 'Tank Farm', x: 83, y: 90, r: 8, quiet: true },
      { id: 'bait', name: 'Bait & Tackle', x: 53, y: 26, r: 6 },
    ];
    W.zombieGroups = [
      [52, 62, 3.5, { drifter: 3 }, { tag: 'yard' }], [66, 62, 3.5, { drifter: 3, shrieker: 1 }, { tag: 'yard' }], [79, 66, 3.5, { drifter: 2, runner: 1 }, { tag: 'yard' }],
      [57, 72, 3, { drifter: 2, brute: 1 }, { tag: 'yard' }], [84, 80, 2.5, { drifter: 2 }, { tag: 'yard' }], [58, 95, 2.5, { drifter: 2 }, { tag: 'yard' }],
      [22, 38.5, 3, { drifter: 2 }, { tag: 'road' }], [50, 38.5, 3, { drifter: 2, runner: 1 }, { tag: 'road' }], [86, 38.5, 3, { drifter: 2 }, { tag: 'road' }],
      [14, 14, 3, { sleeper: 2 }, { tag: 'beach' }], [55, 14, 4, { sleeper: 2 }, { tag: 'beach' }], [106, 28, 3, { sleeper: 2 }, { tag: 'beach' }], [106, 64, 3, { sleeper: 1 }, { tag: 'beach' }],
      [103, 45.5, 1, { drifter: 1 }, { tag: 'pier' }], [97.5, 76, 3, { drifter: 2, clinger: 1 }, { tag: 'lane' }], [40, 108, 4, { drifter: 3 }, { tag: 'south' }],
      [53, 27, 2, { drifter: 1 }, { tag: 'bait' }],
    ];
    W.mapTitle = 'ISLAND DEPOT';
    return W;
  };

  const inRect = (r, x, y) => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2;
  const yardCount = (run) => run.zombies.filter((z) => !z.dead && !z.dormant && !z.attached && inRect(YARD, z.x, z.y)).length;
  const gateIdx = () => DH.G.W.doors.findIndex((d) => d.label === 'Depot Gate');
  const gateOpen = (run) => { const i = gateIdx(); return run.doors[i].open || run.doors[i].broken; };

  const L = (DH.LEVELS[6] = {
    id: 6, key: 'landfall', name: 'Landfall', place: 'ISLAND DEPOT, GREY MORNING', short: 'Secure the depot', tag: 'Gate motor, clear yard, truck inside',
    build, fuel: 40, par: 330, footOK: false,
    brief: () => 'The ferry made the island, but June’s depot is overrun and the truck has barely any fuel after the crossing. Restore the gate motor in the gatehouse, clear the depot yard, and drive the truck into the depot bay. Running the gate is loud: every cycle pulls the yard to it. The side door on the west fence is quiet. Jerry cans and two dockworkers may still be out on the fuel pier.',
    meta: () => [['Primary', 'Gate motor (gatehouse) → clear the yard → truck into the depot bay'], ['Routes', 'Run the gate early and fight at it · or the quiet side door'], ['Optional', 'Dockworkers in the pier hut · jerry cans'], ['Fuel', 'Low: watch the gauge, refuel with jerry cans'], ['Exits', 'Depot bay · West Road · beach path']],
    optionalKeys: [['dockers', 'Rescue the fuel pier workers'], ['fuel', 'Recover two jerry cans']],
    reserve: 12,
    recruitTip: () => 'Walk them into the depot shed, or one at a time in the passenger seat.',
    setup(run, rng, story) {
      const G = DH.G;
      run.flags.rampDown = true;
      G.addItem(run, 'fuel0', 'fuel', 104, 45.5); G.addItem(run, 'fuel1', 'fuel', 106.5, 46.2); G.addItem(run, 'fuel2', 'fuel', 73, 48.6, { spot: 'A jerry can in the gatehouse.' });
      const salv = rng.shuffle([[53, 24.5], [71, 26], [44, 60], [88, 66], [77, 98], [66, 82], [48, 98], [20, 40], [97.5, 52], [12, 90], [36, 60], [60, 108]]).slice(0, 6);
      salv.forEach((p, i) => G.addItem(run, 'salvage' + i, 'salvage', p[0], p[1]));
      const pk = G.addPickup;
      pk(run, 'weapon', 70.6, 52.4, { wtype: 'shotgun', mag: 6, reserve: 12, cabinet: true });
      pk(run, 'weapon', 56, 25.5, { wtype: 'rifle', mag: 6, reserve: 12 });
      pk(run, 'ammo', 72.5, 53.2, { atype: 'p9', n: 24 }); pk(run, 'ammo', 50, 24, { atype: 'r30', n: 6 }); pk(run, 'ammo', 67.5, 94, { atype: 'shell', n: 6 });
      pk(run, 'medkit', 113, 48, { n: 1 }); pk(run, 'medkit', 57, 29.5, { n: 1 });
      pk(run, 'repairkit', 70, 27.5, { n: 1 });
      pk(run, 'noisemaker', 34, 30, { n: 1 }); pk(run, 'noisemaker', rng.pick([[45, 40], [88, 40]])[0], 43, { n: 1 });
      pk(run, 'note', 73.2, 54.2, { key: 'motor', label: 'June’s note', text: 'GATE MOTOR: cable chewed through at the junction box. Splice it and the controls come back. The gate is LOUD. Last time we ran it the whole yard came. Side door’s quieter. J.' });
      G.addSurvivor(run, 'cal', 'Cal', 'cal', 113, 44.5, { locked: true, where: 'Pier hut', landmark: 'pier', pron: 'him', call: true });
      G.addSurvivor(run, 'dee', 'Dee', 'dee', 113.5, 46.8, { locked: true, where: 'Pier hut', landmark: 'pier', pron: 'her', call: true });
      G.addEmitter(run, { id: 'gate', x: 65, y: 50, r: 40, period: 1.0, warmup: 2.5, kind: 'machine', cueLabel: 'GATE MOTOR', color: 'rgba(255,190,80,1)' });
    },
    exitOpen(z, run) {
      if (z.id !== 'bay') return true;
      if (!run.flags.motor) return 'The depot is not secure yet: restore the gate motor first.';
      if (!run.flags.yardClear) return 'The yard is not clear yet (' + yardCount(run) + ' left).';
      return true;
    },
    nextStep(run) {
      if (!run.flags.motor) return 'motor';
      if (!run.flags.yardClear) return 'yard';
      if (!gateOpen(run)) return 'gate';
      return 'bay';
    },
    interact(run, add, p) {
      const W = DH.G.W, G = DH.G, Pl = DH.Player;
      const near = (o, r) => M.dist(p.x, p.y, o.x, o.y) < (r || 1.9);
      const act = (key, dur, label, o) => () => Pl.startAction('script', dur, label, { key, hold: true, near: { x: o.x, y: o.y, r: 2.6 } });
      if (near(W.motor, 2.0)) {
        if (run.flags.motor) add('motor', 'Gate motor running', W.motor.x, W.motor.y, 0.6, () => {}, { disabled: true });
        else add('motor', 'Hold E: Splice the gate motor cable (4 s)', W.motor.x, W.motor.y, -0.4, act('motor', 4, 'Splicing the cable', W.motor), { hold: true });
      }
      if (near(W.gateCon, 2.0)) {
        const e = G.emitter(run, 'gate');
        if (!run.flags.motor) add('gateCon', 'Gate controls: no power (splice the motor cable)', W.gateCon.x, W.gateCon.y, 0.4, () => G.msg('The gate motor is dead. The cable needs splicing.', 'warn', 2), { disabled: true });
        else if (run.doors[gateIdx()].broken) add('gateCon', 'Depot gate: smashed open', W.gateCon.x, W.gateCon.y, 0.6, () => {}, { disabled: true });
        else if (e.on) add('gateCon', 'Gate motor running...', W.gateCon.x, W.gateCon.y, 0.6, () => {}, { disabled: true });
        else if (!gateOpen(run)) add('gateCon', 'Hold E: Open the depot gate (motor, LOUD)', W.gateCon.x, W.gateCon.y, -0.3, act('gateOpen', 1.5, 'Running the gate motor', W.gateCon), { hold: true });
        else add('gateCon', 'Hold E: Close the depot gate (motor, LOUD)', W.gateCon.x, W.gateCon.y, 0.3, act('gateClose', 1.5, 'Running the gate motor', W.gateCon), { hold: true });
      }
    },
    highlights(run) {
      const W = DH.G.W, out = [];
      if (!run.flags.motor) out.push({ x: W.motor.x, y: W.motor.y, r: 0.8, d: 12 });
      else if (!gateOpen(run)) out.push({ x: W.gateCon.x, y: W.gateCon.y, r: 0.8, d: 12 });
      return out;
    },
    labels(run) {
      const pp = DH.Player.pos(), W = DH.G.W, out = [];
      if (M.dist(pp.x, pp.y, 65, 50) < 16) out.push({ x: 65, y: 50, z: 2.6, text: gateOpen(run) ? 'DEPOT GATE: OPEN' : 'DEPOT GATE', col: '#ffd36a' });
      if (M.dist(pp.x, pp.y, 40, 67) < 12) out.push({ x: 40, y: 67, z: 2.4, text: 'SIDE DOOR (quiet)', col: '#7fe3a0' });
      if (M.dist(pp.x, pp.y, W.motor.x, W.motor.y) < 10 && !run.flags.motor) out.push({ x: W.motor.x, y: W.motor.y, z: 2.2, text: 'GATE MOTOR', col: '#ffd36a' });
      if (run.flags.yardClear && M.dist(pp.x, pp.y, 58, 86) < 24) out.push({ x: 58, y: 84, z: 1.6, text: 'PARK HERE', col: '#7fe3a0' });
      return out;
    },
    onAction(run, key, data) {
      const G = DH.G, Wd = DH.World, W = G.W;
      if (key === 'motor' && !run.flags.motor) {
        run.flags.motor = true; W.version++;
        G.msg('Gate motor spliced. The yard floods and the gate controls have power.', 'objective', 3.5);
        G.radio('june', 'Lights in the yard! Now the gate. It’ll wake everything in there.', 'motor');
      } else if (key === 'gateOpen' || key === 'gateClose') {
        const gi = gateIdx(), open = key === 'gateOpen';
        if (!open && !Wd.setDoor(gi, false, 'player')) return;
        if (open) { run.doors[gi].locked = false; run.doors[gi].open = true; W.doors[gi].locked = false; W.doors[gi].open = true; W.version++; }
        else { run.doors[gi].locked = true; W.doors[gi].locked = true; }
        Wd.startEmitter('gate', 8);
        if (open && !run.flags.route) run.flags.route = run.flags.yardClear ? 'side' : 'gate';
        const n = Wd.drawGroup('yard', 65, 54, 8);
        G.msg(open ? 'The gate grinds open. ' + (n ? 'The yard heard it.' : '') : 'The gate grinds shut.', n ? 'danger' : 'info', 3);
        if (n) G.cue('MOVEMENT', 65, 60, 'danger');
      } else if (key === 'pried') {
        const d = W.doors[data.door];
        if (d.label === 'Pier Hut Door') for (const id of ['cal', 'dee']) { const s = G.findSurvivor(run, id); if (s) { s.locked = false; s.call = false; } }
        if (d.label === 'Pier Hut Door') G.radio('cal', 'Cal. That’s Dee. We ran out of fuel and luck about the same day.', 'docks');
      } else if (key === 'note' && data.key === 'motor') G.radio('june', 'That’s my note. Splice, then gate. Or go in quiet by the side door and clear it first.', 'noteMotor');
    },
    update(run, dt) {
      const G = DH.G, pp = DH.Player.pos();
      if (run.time > 2) G.radio('june', 'Welcome to the island. The depot’s behind the chain fence south of the harbour road. The gate motor is in the gatehouse.', 'intro');
      if (run.time > 13) G.radio('june', 'Running that gate wakes the whole yard. The side door on the west fence is quiet.', 'tip');
      if (run.time > 26) G.radio('june', 'The crossing drank your fuel. There are jerry cans on the fuel pier, east end. Cal and Dee were out there.', 'fuelTip');
      for (const s of run.survivors) if (!s.recruited && s.call && M.dist(pp.x, pp.y, s.x, s.y) < 16) G.radio(s.id, 'In the hut! The door’s jammed. Get a bar on it!', 'callPier');
      if (!run.said.brute && run.zombies.some((z) => z.type === 'brute' && !z.dead && z.visible)) G.radio('june', 'That big one took the depot from us. Keep it away from the truck.', 'brute');
      if (!run.said.shriek && run.zombies.some((z) => z.type === 'shrieker' && !z.dead && z.visible)) G.radio('june', 'The pale one screams for the others. Drop it before it opens its mouth.', 'shriek');
      if (!run.flags.route && run.doors[gateIdx()].broken) { run.flags.route = 'gate'; G.msg('Something smashed the depot gate open from inside.', 'danger', 3); }
      run.timers.yardT = (run.timers.yardT || 0) - dt;
      if (!run.flags.yardClear && run.timers.yardT <= 0) {
        run.timers.yardT = 0.5;
        run.flags.yardLeft = yardCount(run);
        if (run.flags.yardLeft <= 2) {
          run.flags.yardClear = true;
          G.msg('Depot yard secure.', 'objective', 3.5);
          G.radio('june', run.flags.motor ? 'Yard’s clear. Bring the truck in through the gate and park it in the bay.' : 'Yard’s clear! Now get the gate motor running so the truck can come in.', 'yardClear');
        }
      }
    },
    objectives(run) {
      const G = DH.G, out = [];
      out.push({ text: run.flags.motor ? 'Gate motor restored' : 'Restore the gate motor (gatehouse)', done: !!run.flags.motor });
      out.push({ text: run.flags.yardClear ? 'Depot yard secure' : 'Clear the depot yard (' + (run.flags.yardLeft != null ? run.flags.yardLeft : '?') + ' inside the fence)', done: !!run.flags.yardClear, opt: false });
      out.push({ text: !gateOpen(run) ? 'Open the gate, then park the truck in the depot bay' : 'Park the truck in the depot bay', done: false, opt: false });
      const dk = run.survivors.filter((s) => s.id === 'cal' || s.id === 'dee'), safe = dk.filter((s) => s.safe || s.boarded).length;
      const cans = Object.values(run.items).filter((i) => i.kind === 'fuel' && i.loc !== 'world').length;
      out.push({ text: 'Optional: dockworkers ' + safe + '/2 · jerry cans ' + cans + '/3', done: safe === 2, opt: true });
      return out;
    },
    pointer(run) {
      const G = DH.G, W = G.W, p = run.player, st = L.nextStep(run);
      if (st === 'motor') return { x: W.motor.x, y: W.motor.y, label: 'GATE MOTOR', col: '#ff8a7a' };
      if (st === 'yard') { const z = run.zombies.filter((q) => !q.dead && !q.dormant && inRect(YARD, q.x, q.y)).sort((a, b) => M.dist(a.x, a.y, p.x, p.y) - M.dist(b.x, b.y, p.x, p.y))[0]; return z ? { x: z.x, y: z.y, label: 'CLEAR THE YARD', col: '#ff8a7a' } : { x: 66, y: 64, label: 'YARD', col: '#ff8a7a' }; }
      if (st === 'gate') return { x: W.gateCon.x, y: W.gateCon.y, label: 'GATE CONTROLS', col: '#ffd36a' };
      if (!p.inTruck) return { x: run.truck.x, y: run.truck.y, label: 'TRUCK', col: '#ffd36a' };
      return { x: 58, y: 86, label: 'DEPOT BAY', col: '#7fe3a0' };
    },
    markers(run, dot) {
      const W = DH.G.W;
      dot(W.motor.x, W.motor.y, run.flags.motor ? '#7fe3a0' : '#ff6b5a', 3);
      dot(58, 86, run.flags.yardClear ? '#7fe3a0' : 'rgba(255,107,90,.6)', 3, true);
      for (const id in run.items) { const it = run.items[id]; if (it.kind === 'fuel' && it.loc === 'world' && (run.seen[id] || run.discovered.pier)) dot(it.x, it.y, '#d4443a', 2); }
    },
    primaryOut: (out, run, mode) => mode === 'truck' && !!run.flags.motor && !!run.flags.yardClear && inRect(BAY, run.truck.x, run.truck.y),
    primaryGot: (run) => !!run.flags.motor && !!run.flags.yardClear && gateOpen(run),
    bonus: (out, run, mode) => { const b = []; if (run.flags.motor) b.push({ label: 'Gate motor', scrap: DH.T.rewards.gatemotor }); if (L.primaryOut(out, run, mode)) b.push({ label: 'Depot secured', scrap: DH.T.rewards.depot }); return b; },
    departWarn: 'Only the truck parked in the depot bay secures the depot. This will be a partial extraction.',
    resultSub(r) { return r.status === 'partial' ? 'The depot is still not secure.' : r.status === 'failed' ? 'Nothing extracted. No rewards from this run. Your campaign progress is safe.' : 'The truck is inside and the gate shuts behind it. The Island Depot is yours.'; },
    resultRows(run, ev) {
      const R = DH.T.rewards;
      const dk = run.survivors.filter((s) => s.id === 'cal' || s.id === 'dee'), out = dk.filter((s) => ev.survivorsOut.indexOf(s.id) >= 0);
      return [
        ['Gate motor (primary)', run.flags.motor ? 'Restored +' + R.gatemotor : 'Dead', run.flags.motor ? 'good' : 'bad'],
        ['Depot yard (primary)', run.flags.yardClear ? 'Cleared' : 'Still overrun', run.flags.yardClear ? 'good' : 'bad'],
        ['Truck in the depot (primary)', L.primaryOut(ev, run, ev.mode) ? 'Parked +' + R.depot : 'No', L.primaryOut(ev, run, ev.mode) ? 'good' : 'bad'],
        ['Route', run.flags.route === 'gate' ? 'Gate first (loud)' : run.flags.route === 'side' ? 'Side door (quiet)' : '-'],
        ['Dockworkers', out.length + ' / 2' + (out.length ? ' (+' + out.length * R.survivor + ')' : ''), out.length ? 'good' : ''],
        ['Jerry cans', (ev.got.fuel || 0) + ' banked · ' + (run.stats.cans || 0) + ' poured', ''],
        ['Salvage bundles', ev.salvageOut + (ev.salvageOut ? ' (+' + ev.salvageOut * R.salvage + ')' : ''), ev.salvageOut ? 'good' : ''],
      ];
    },
    outcome(run, ev, mode) {
      const dk = ['cal', 'dee'].filter((id) => ev.survivorsOut.indexOf(id) >= 0).length;
      const cans = (ev.got.fuel || 0) + (run.stats.cans || 0);
      return { depot: L.primaryOut(ev, run, mode), route: run.flags.route || null, dockers: dk === 2, optional: { dockers: dk === 2, fuel: cans >= 2 } };
    },
    hints: {
      start: { kbm: 'Island Depot. The gate motor is in the gatehouse; the yard is overrun. Watch your fuel gauge on the truck panel.', touch: 'Gate motor in the gatehouse, yard overrun. Watch your fuel.' },
      primaryGot: { kbm: 'Yard clear, gate open: drive the truck into the depot bay.', touch: 'Yard clear, gate open: drive into the depot bay.' },
    },
    backdropCam: { x: 62, y: 58 },
  });
})();
