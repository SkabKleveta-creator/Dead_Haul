/* ==== l2.js ==== */
/* DEAD HAUL - Level 2: Cold Chain (Route 9 refrigerated distribution depot) */
(function () {
  'use strict';
  const DH = window.DH;
  DH.LEVELS = DH.LEVELS || {};
  const M = DH.M;

  const build = () => {
    const K = DH.MapKit('coldchain', { theme: { dark: 'rgba(6,10,24,0.70)', lamp: 'rgba(255,170,70,A)', lightR: 8, flashlight: true } });
    const { W, MAT, F } = K;
    const { fill, wallLine, clearWall, windows, building, door, sign, P, box, circ } = K;

    // ---- ground ----
    fill(0, 0, 119, 119, F.GRASS);
    K.road(0, 108, 119, 116);                 // Route 9
    fill(5, 5, 114, 103, F.GRAVEL);           // depot yard
    fill(5, 69, 114, 103, F.LOT);             // dock apron
    fill(50, 103, 61, 107, F.ROAD);           // gate throat
    fill(5, 5, 26, 103, F.LOT);               // west trailer lot
    fill(18, 0, 21, 4, F.WALK);               // foot path north
    K.paveRoads();

    // ---- perimeter (map edge) and depot fence ----
    K.perimeter(MAT.BARRICADE);
    clearWall(0, 108, 0, 116); clearWall(119, 108, 119, 116); clearWall(18, 0, 21, 0);
    wallLine(4, 4, 115, 4, MAT.CHAIN); wallLine(4, 104, 115, 104, MAT.CHAIN);
    wallLine(4, 4, 4, 104, MAT.CHAIN); wallLine(115, 4, 115, 104, MAT.CHAIN);
    clearWall(50, 104, 61, 104);              // main gate (open, boom arm smashed)
    wallLine(17, 0, 17, 3, MAT.WOODFENCE); wallLine(22, 0, 22, 3, MAT.WOODFENCE);
    door(null, 18, 4, 4, 'h', { gate: true, label: 'Fence Gate', color: '#7a7f84', hp: 120, maxHp: 120 });

    // ---- warehouse: dry side (west) and cold wing (east) ----
    const dry = building('Dry Warehouse', 'dry', 28, 26, 60, 68, MAT.CORR, F.CONCRETE_IN, '#4a4f53', { ribs: true, skylights: true });
    const cold = building('Cold Storage Wing', 'cold', 60, 26, 92, 68, MAT.CORR, F.FROST, '#55595c', { ribs: true });
    sign('ROUTE 9 DISTRIBUTION', 38, 68, 'S', 14, '#e8e2cf', '#23384a', 3.0);
    sign('COLD CHAIN', 70, 68, 'S', 7, '#9fd8f0', '#1d3140', 3.0);
    // switch room (SW corner of the dry side)
    wallLine(29, 61, 36, 61, MAT.INTERIOR); wallLine(37, 61, 37, 67, MAT.INTERIOR);
    fill(29, 62, 36, 67, F.CONCRETE_IN);
    door('dry', 37, 63, 2, 'v', { label: 'Switch Room Door' });
    door('dry', 30, 68, 2, 'h', { label: 'Switch Room Exit', color: '#5b6670' });
    dry.rooms.push({ name: 'Switch Room', x1: 29, y1: 62, x2: 36, y2: 67 });
    door('dry', 41, 68, 2, 'h', { label: 'Dock Door', color: '#5b6670' });
    // loading bays: rolling shutters on the south wall (need bay power)
    const bay = (n, x, bld) => door(bld, x, 68, 4, 'h', { shutter: true, needs: 'power', needsMsg: 'no bay power (switch room, Bay 1)', label: 'Bay ' + n + ' Shutter', hp: 400, maxHp: 400 });
    bay(1, 33, 'dry'); bay(2, 46, 'dry'); bay(3, 64, 'cold'); bay(4, 80, 'cold');
    // cold wing interior: corridor, freezers, pharma cold room, machine room
    wallLine(61, 43, 91, 43, MAT.COLD); wallLine(61, 49, 91, 49, MAT.COLD);
    wallLine(73, 27, 73, 42, MAT.COLD); wallLine(85, 27, 85, 42, MAT.COLD);
    wallLine(73, 50, 73, 67, MAT.COLD);
    clearWall(60, 45, 60, 47); K.curtain(60, 45, 60, 47);                 // dry -> cold corridor (strip curtain)
    clearWall(66, 43, 67, 43); K.curtain(66, 43, 67, 43);                 // freezer 1
    door('cold', 78, 43, 2, 'h', { label: 'Freezer 2 Door', locked: true, pry: 2.5, color: '#c9d0d3', hp: 999, maxHp: 999 });
    clearWall(88, 43, 89, 43); K.curtain(88, 43, 89, 43);                 // maintenance room
    clearWall(66, 49, 67, 49); K.curtain(66, 49, 67, 49);                 // pharma cold room
    clearWall(86, 49, 87, 49); K.curtain(86, 49, 87, 49);                 // machine room
    door('cold', 92, 45, 2, 'v', { label: 'Service Door', color: '#5b6670' });
    K.darkRect(61, 27, 91, 67);
    cold.rooms.push({ name: 'Machine Room', x1: 74, y1: 50, x2: 91, y2: 67 }, { name: 'Pharma Cold Room', x1: 61, y1: 50, x2: 72, y2: 67 });
    for (const [x0, y0, len, o] of [[60, 45, 3, 'v'], [66, 43, 2, 'h'], [88, 43, 2, 'h'], [66, 49, 2, 'h'], [86, 49, 2, 'h']]) P('strips', o === 'h' ? x0 + len / 2 : x0 + 0.5, o === 'h' ? y0 + 0.5 : y0 + len / 2, { solid: false, x0: o === 'h' ? x0 : y0, y0: o === 'h' ? y0 + 0.5 : x0 + 0.5, len, orient: o, h: 2.8 });

    // ---- small buildings ----
    building('Dispatch Office', 'dispatch', 22, 84, 31, 93, MAT.BLOCK, F.LINO, '#3b3f44');
    door('dispatch', 31, 88, 2, 'v', { label: 'Dispatch Door' });
    windows(23, 93, 30, 93); windows(31, 85, 31, 86);
    sign('DISPATCH', 23, 93, 'S', 5, '#f2c14e', '#2a2d33');
    building('Guard Booth', 'booth', 63, 98, 67, 102, MAT.BLOCK, F.LINO, '#33373b');
    door('booth', 63, 99, 2, 'v', { label: 'Booth Door' });
    windows(67, 99, 67, 101); windows(64, 98, 66, 98);

    // ---- props ----
    // north yard: parked reefers and the condenser bank
    for (const x of [36, 50, 64, 92]) box('reefer', x, 9.5, 6, 1.25, 0, 3.4, { color: '#d9dad6', logo: '#23384a' });
    for (const x of [67, 74.5, 82, 89.5]) box('condenser', x, 21.5, 3, 1, 0, 1.6, {});
    W.compPanel = box('panel', 61.6, 22.4, 0.35, 0.3, 0, 1.4, { label: 'Compressor test panel', color: '#5d6a5e' });
    // west trailer lot
    for (const y of [22, 38, 54]) box('reefer', 11, y, 6, 1.25, Math.PI / 2, 3.4, { color: y === 38 ? '#c9cbc6' : '#d9dad6', logo: '#7a2a22' });
    for (const y of [30, 62]) box('reefer', 21, y, 6, 1.25, Math.PI / 2, 3.4, { color: '#bfc2be' });
    // docked trailers at bays 1 and 2, a forklift and pallets on the apron
    box('reefer', 35, 76.5, 6, 1.25, Math.PI / 2, 3.4, { color: '#d9dad6', logo: '#23384a' });
    box('reefer', 48, 76.5, 6, 1.25, Math.PI / 2, 3.4, { color: '#c9cbc6', logo: '#23384a' });
    for (const x of [35, 48, 66, 82]) box('leveler', x, 69.4, 1.8, 0.35, 0, 0.05, { solid: false });
    box('forklift', 58, 74, 1.0, 0.55, 0.4, 2.2, { sprR: 1.6 });
    box('forklift', 92, 88, 1.0, 0.55, 2.2, 2.2, { sprR: 1.6 });
    box('pallets', 74, 74, 0.7, 0.7, 0.2, 1.1, {}); box('pallets', 75.6, 74.4, 0.7, 0.7, 0.1, 0.8, {});
    box('pallets', 30, 75, 0.7, 0.7, 0, 1.1, {});
    box('palletjack', 70, 72, 0.9, 0.3, 1.2, 0.3, {});
    // jackknifed rig blocks the truck from the apron into the east lane (people squeeze past)
    box('reefer', 103, 71, 6, 1.25, 0.45, 3.4, { color: '#b9bcb8' });
    box('van', 96.5, 76, 2.7, 1.05, 1.9, 2.1, { color: '#7d2e24' });
    K.truckOnly(93, 68, 114, 73);
    // east service lane: trailer row along the fence keeps it narrow
    for (const y of [30, 52]) box('reefer', 108, y, 6, 1.25, Math.PI / 2, 3.4, { color: '#c4c6c1' });
    box('pallets', 104.5, 40, 0.7, 0.7, 0, 1.2, {}); box('pallets', 104, 62, 0.7, 0.7, 0.4, 1.0, {});
    // dry warehouse: tall rack aisles (block sight), a forklift, counters
    for (const x of [34, 40, 46, 52]) { box('hirack', x, 37, 6, 0.75, Math.PI / 2, 3.3, { opaque: true }); box('hirack', x, 53.5, 5, 0.75, Math.PI / 2, 3.3, { opaque: true }); }
    box('forklift', 57, 41, 1.0, 0.55, 1.6, 2.2, { sprR: 1.6 });
    box('pallets', 57, 58, 0.7, 0.7, 0, 1.2, {});
    W.breaker = box('breaker', 30.2, 63.4, 0.35, 0.6, 0, 1.9, { label: 'Bay power breaker' });
    box('counter', 33.5, 66.4, 1.4, 0.4, 0, 1.0, { color: '#4c5459' });
    // cold wing: cold racks, coolers, the machine room plant
    for (const y of [30, 35.5, 40]) { box('hirack', 66.5, y, 4, 0.6, 0, 2.6, { opaque: true }); box('hirack', 79, y, 3.4, 0.6, 0, 2.6, { opaque: true }); }
    box('rack', 64, 53, 2, 0.4, 0, 2.0, { color: '#b9c2c0' }); box('rack', 70, 53, 2, 0.4, 0, 2.0, { color: '#b9c2c0' });
    box('fridge', 62, 60, 0.5, 1.2, 0, 2.2, { color: '#d5dadb' }); box('fridge', 71.6, 60, 0.5, 1.2, 0, 2.2, { color: '#d5dadb' });
    box('pumpunit', 89, 63.5, 1.2, 0.8, Math.PI / 2, 1.4, {});
    box('pipe', 82, 51.2, 6, 0.18, 0, 0.36, { z: 2.4, solid: false, color: '#9aa4a8' });
    box('boxes', 77, 64, 0.6, 0.6, 0.2, 0.9, {});
    box('toolbox', 89.5, 29, 0.5, 0.3, 0, 1.1, { color: '#a33' });
    box('counter', 88, 38, 1.5, 0.4, Math.PI / 2, 1.0, { color: '#6b6e70' });
    // dispatch office and gate
    box('counter', 25, 86.5, 2, 0.45, 0, 1.0, { color: '#6b5a44' });
    box('cabinet', 30.2, 91.5, 0.35, 0.8, 0, 1.9, { color: '#5a6064' });
    box('jersey', 46, 106.2, 2.5, 0.5, 0, 0.9, {}); box('jersey', 66, 106.2, 2.5, 0.5, 0, 0.9, {});
    box('boom', 55.5, 104.5, 3.5, 0.1, 0.25, 1.1, { solid: false, parts: [[-3.2, 0, 0, 0.25, 0.25, 1.0, '#3a3c40'], [0, 0, 0.95, 3.4, 0.08, 0.12, '#d8b23a']] });
    // road dressing and trees
    for (const [x, y, a, c] of [[30, 110.5, 0.05, '#5e3d3d'], [86, 114.2, 3.1, '#3f5566'], [104, 110.6, 0.1, '#58534a']]) K.car(x, y, a, c);
    for (const [x, y] of [[8, 100], [3, 96], [116, 92], [112, 118], [40, 118], [75, 118], [6, 2], [100, 2], [117, 40]]) K.tree(x, y);
    // lamps: road (always), dock and yard floods (bay power)
    for (const x of [15, 35, 75, 95]) K.lamp(x, 106.6);
    K.lamp(20, 64); K.lamp(8, 30);
    for (const x of [35, 47, 66, 82]) K.lamp(x, 70.2, { power: 'power', col: 'rgba(200,220,255,A)', r: 8.5 });
    for (const x of [44, 80]) K.lamp(x, 24.8, { power: 'power', col: 'rgba(200,220,255,A)' });
    // emergency lights in the cold wing (always), bay strobes (power)
    for (const [x, y] of [[64, 46], [79, 46], [90, 46], [67, 58], [87, 58], [79, 35], [88, 32]]) W.glows.push({ x, y, r: 3.2, col: 'rgba(255,40,30,A)', a: 0.22, blink: 0.7, ph: (x + y) * 0.13, z: 2.6, hole: { x, y, r: 3, a: 0.55 } });
    for (const x of [35, 48, 66, 82]) W.glows.push({ x, y: 69.6, r: 2.5, col: 'rgba(255,170,40,A)', a: 0.2, blink: 1.2, ph: x * 0.1, power: 'power', z: 3 });
    W.marks.push({ k: 'hatch', x1: 30, y1: 69, x2: 90, y2: 70 });
    for (const [x, n] of [[35, '1'], [48, '2'], [66, '3'], [82, '4']]) W.marks.push({ k: 'text', x, y: 73, text: n, size: 90, col: 'rgba(230,200,80,0.5)' });
    W.marks.push({ k: 'stallsV', x1: 56, x2: 98, y1: 88, y2: 95, step: 4, col: 'rgba(220,220,210,0.35)' });
    W.marks.push({ k: 'line', x1: 6, y1: 26, x2: 26, y2: 26, col: 'rgba(230,200,80,0.4)', w: 0.15, dash: [1, 0.6] });
    W.marks.push({ k: 'text', x: 98, y: 46, text: 'SERVICE', size: 50, rot: Math.PI / 2, col: 'rgba(230,220,200,0.35)' });
    K.decals(50, 3);
    P('exitSign', 7, 106, { solid: false, text: 'EXIT', sub: 'ROUTE 9 W', h: 3.2 });
    P('exitSign', 112.5, 106, { solid: false, text: 'EXIT', sub: 'ROUTE 9 E', h: 3.2 });
    P('exitSign', 23, 2.5, { solid: false, text: 'EVAC', sub: 'ON FOOT', h: 2.8, green: true });
    W.glows.push({ x: 19.5, y: 1.5, r: 3.5, col: 'rgba(90,255,140,A)', a: 0.16, pulse: 6, hole: { x: 19.5, y: 1.5, r: 4, a: 0.7 } });

    K.finish();
    W.exits = [
      { id: 'w', name: 'Route 9 West', kind: 'truck', x1: 0, y1: 107.5, x2: 4.5, y2: 116.5, lx: 6, ly: 112, out: [-1, 0] },
      { id: 'e', name: 'Route 9 East', kind: 'truck', x1: 114.5, y1: 107.5, x2: 119.9, y2: 116.5, lx: 113, ly: 112, out: [1, 0] },
      { id: 'foot', name: 'North footpath', kind: 'foot', x1: 18, y1: 0, x2: 22, y2: 3.2, lx: 20, ly: 5, out: [0, -1] },
    ];
    W.start = { truck: { x: 14, y: 112, ang: 0 }, player: { x: 15.5, y: 109.4 }, aim: -Math.PI / 4 };
    W.reserveEntries = [{ x: 60, y: 2.5, name: 'north' }, { x: 2.5, y: 60, name: 'west' }, { x: 117, y: 60, name: 'east' }, { x: 3, y: 112, name: 'west road' }, { x: 116, y: 112, name: 'east road' }];
    W.landmarks = [
      { id: 'dock', name: 'Loading Docks', x: 60, y: 78, r: 16 },
      { id: 'switch', name: 'Switch Room', x: 33, y: 64, r: 6 },
      { id: 'dry', name: 'Dry Warehouse', x: 44, y: 46, r: 14 },
      { id: 'cold', name: 'Cold Wing', x: 76, y: 46, r: 12 },
      { id: 'machine', name: 'Machine Room', x: 83, y: 59, r: 6 },
      { id: 'freezer2', name: 'Freezer 2', x: 79, y: 35, r: 6 },
      { id: 'north', name: 'Condenser Yard', x: 70, y: 16, r: 14 },
      { id: 'east', name: 'Service Lane', x: 99, y: 46, r: 10 },
      { id: 'dispatch', name: 'Dispatch Office', x: 27, y: 89, r: 6 },
    ];
    W.zombieGroups = [
      [52, 82, 5, { drifter: 3 }, { tag: 'dock' }], [76, 80, 4, { drifter: 2, runner: 1 }, { tag: 'dock' }],
      [17, 46, 5, { drifter: 2, runner: 1 }, { tag: 'west' }], [17, 78, 4, { drifter: 2 }, { tag: 'west' }],
      [43, 45, 5, { drifter: 3, howler: 1 }, { tag: 'dry' }], [50, 60, 3, { drifter: 2 }, { tag: 'dry' }],
      [68, 46, 2.5, { clinger: 1, drifter: 1 }, { tag: 'cold' }], [84, 58, 3, { drifter: 2, runner: 1 }, { tag: 'cold' }], [66, 34, 3, { drifter: 2 }, { tag: 'cold' }],
      [45, 17, 6, { drifter: 3, clinger: 1 }, { tag: 'north' }], [82, 15, 6, { drifter: 3, runner: 1 }, { tag: 'north' }],
      [99, 32, 3, { drifter: 2, clinger: 1 }, { tag: 'east' }], [99, 60, 2.5, { drifter: 1 }, { tag: 'east' }],
      [70, 96, 2.5, { drifter: 1 }, { tag: 'gate' }], [27, 91, 1.5, { drifter: 1 }, { tag: 'dispatch' }],
    ];
    W.ferryPath = null;
    W.mapTitle = 'ROUTE 9 DISTRIBUTION';
    return W;
  };

  const L = (DH.LEVELS[2] = {
    id: 2, key: 'coldchain', name: 'Cold Chain', place: 'ROUTE 9 DISTRIBUTION, NIGHT', short: 'Refrigeration for the clinic', tag: 'Refrigeration unit and medical stock',
    build,
    brief: () => 'Route 9 Distribution kept the county’s medicine cold. Bring back a working refrigeration unit from the cold wing and any medical stock still in the cold room. The unit is heavy: choose where you park and how you will haul it before you lift. Bay power opens the near shutters but wakes the compressors. The service lane is quieter and tight.',
    meta: (st) => [['Primary', 'Refrigeration unit (machine room) + medical stock (pharma cold room)'], ['Routes', 'Bay power and shutters, or the east service door'], ['Optional', 'Someone is trapped in Freezer 2 · dispatch records'], ['Exits', 'Route 9 west and east · north footpath']],
    optionalKeys: [['tomas', 'Rescue the depot worker'], ['records', 'Read the dispatch records']],
    reserve: 12,
    recruitTip: () => 'Get him to the truck.',
    setup(run, rng, story) {
      const G = DH.G;
      G.addItem(run, 'assembly', 'assembly', 84.5, 60.5, { spot: 'Refrigeration unit on a skid in the machine room. Heavy: plan the haul.', haulTip: 'Get it to the back of the stopped truck.' });
      G.addItem(run, 'medstock', 'medstock', 67, 63.5);
      const salv = rng.shuffle([[25, 88], [57.5, 31], [32, 33], [45, 63], [70, 30], [83, 37], [90, 36], [101, 50], [64.5, 99.5], [12, 46], [78, 74], [40, 18]]).slice(0, 6);
      salv.forEach((p, i) => G.addItem(run, 'salvage' + i, 'salvage', p[0], p[1]));
      const pk = G.addPickup;
      pk(run, 'weapon', 65.3, 100.6, { wtype: 'shotgun', mag: 6, reserve: 12 });
      pk(run, 'weapon', 28.5, 85.5, { wtype: 'smg', mag: 30, reserve: 60, crate: true });
      pk(run, 'repairkit', 89, 30.6, { n: 1 });
      pk(run, 'repairkit', 26, 91.5, { n: 1 });
      pk(run, 'medkit', 24, 86, { n: 1 });
      pk(run, 'medkit', 71, 56, { n: 1 });
      pk(run, 'ammo', 34.2, 65.5, { atype: 'p9', n: 24 });
      pk(run, 'ammo', rng.pick([[57, 56.5], [44, 29]])[0], 44, { atype: 'p9', n: 24 });
      pk(run, 'ammo', 66, 101, { atype: 'shell', n: 6 });
      pk(run, 'noisemaker', 56.4, 76, { n: 1 });
      pk(run, 'note', 25.6, 86.8, { key: 'records', label: 'dispatch records', text: 'DISPATCH LOG, 3/14: Mercer Field Evac Center REFUSED DELIVERY. Site closed to new arrivals. Return load to depot. Handwritten underneath: “Harbor Street ferry crews still running. Ask for June. T.”' });
      if (!(story && story.milestones && story.milestones.tomas)) G.addSurvivor(run, 'tomas', 'Tomas', 'tomas', 79, 33, { locked: true, where: 'Freezer 2', landmark: 'freezer2', pron: 'him', call: true });
      G.addEmitter(run, { id: 'condensers', x: 78, y: 21.5, r: 36, period: 1.0, warmup: 5, kind: 'compressor', cueLabel: 'COMPRESSORS', color: 'rgba(160,220,255,1)', glow: 'rgba(150,210,255,A)' });
      G.addEmitter(run, { id: 'coldcomp', x: 88.5, y: 63, r: 24, period: 1.2, warmup: 4, kind: 'compressor', cueLabel: 'COMPRESSOR', color: 'rgba(160,220,255,1)', glow: 'rgba(150,210,255,A)' });
    },
    interact(run, add, p) {
      const W = DH.G.W;
      const b = W.breaker;
      if (M.dist(p.x, p.y, b.x, b.y) < 1.9) {
        if (!run.flags.power) add('breaker', 'Hold E: Restore bay power (3 s)', b.x, b.y, -0.3, () => DH.Player.startAction('script', 3, 'Throwing the breaker', { key: 'power', hold: true, near: { x: b.x, y: b.y, r: 2.4 } }), { hold: true });
        else add('breaker', 'Bay power on', b.x, b.y, 0.5, () => {}, { disabled: true });
      }
      const c = W.compPanel, e = DH.G.emitter(run, 'condensers');
      if (M.dist(p.x, p.y, c.x, c.y) < 1.9) {
        const cd = run.timers.compCd || 0;
        if (e.on) add('comptest', 'Compressor bank running', c.x, c.y, 0.5, () => {}, { disabled: true });
        else if (cd > run.time) add('comptest', 'Compressor test panel (recharging ' + Math.ceil(cd - run.time) + ' s)', c.x, c.y, 0.5, () => {}, { disabled: true });
        else add('comptest', 'Hold E: Test-start the compressor bank (LOUD, 40 s)', c.x, c.y, -0.3, () => DH.Player.startAction('script', 1.5, 'Starting compressors', { key: 'testcomp', hold: true, near: { x: c.x, y: c.y, r: 2.4 } }), { hold: true });
      }
    },
    highlights(run) {
      const W = DH.G.W, out = [];
      if (!run.flags.power) out.push({ x: W.breaker.x, y: W.breaker.y, r: 0.8, d: 9 });
      out.push({ x: W.compPanel.x, y: W.compPanel.y, r: 0.7, d: 9, col: '#8cd6ff' });
      return out;
    },
    onAction(run, key, data) {
      const G = DH.G, Wd = DH.World;
      if (key === 'power') {
        if (run.flags.power) return;
        run.flags.power = true; G.W.version++;
        G.msg('Bay power restored. Shutters 1 to 4 can be raised.', 'objective', 3.5);
        Wd.startEmitter('coldcomp', 0);
        Wd.startEmitter('condensers', 70);
        run.timers.compCd = run.time + 100;
        G.radio('marta', 'Hear that? Compressors spinning up. Everything nearby heard it too.', 'power');
        DH.bus.emit('powerOn');
      } else if (key === 'testcomp') {
        Wd.startEmitter('condensers', 40);
        run.timers.compCd = run.time + 75;
        G.msg('Compressor bank spinning up. It will pull the dead toward the north yard.', 'warn', 3);
      } else if (key === 'pried') {
        const s = G.findSurvivor(run, 'tomas');
        if (s && G.W.doors[data.door].label === 'Freezer 2 Door') { s.locked = false; s.call = false; G.radio('tomas', 'Air! Okay. Tomas, night shift. Four days in there with the yogurt.', 'tomasFree'); }
      } else if (key === 'note' && data.key === 'records') {
        G.radio(G.findSurvivor(run, 'tomas') && G.findSurvivor(run, 'tomas').recruited ? 'tomas' : 'marta', G.findSurvivor(run, 'tomas') && G.findSurvivor(run, 'tomas').recruited ? 'That’s my note. The ferry crews were real, last I heard.' : 'Mercer Field closed? That’s where the broadcast sends everyone.', 'records');
      }
    },
    update(run, dt) {
      const G = DH.G, p = run.player, pp = DH.Player.pos();
      const st = DH.Save.story();
      if (run.time > 2) G.radio('marta', 'The unit should be in the machine room, middle of the cold wing. It’s heavy. Pick your parking before you lift.', 'intro');
      if (run.time > 11) {
        if (st && st.milestones.nell) G.radio('nell', 'Bay power is in the switch room by Bay 1. Big red handle. Or use the east service door if you want it quiet.', 'tip');
        else G.radio('marta', 'Switch room by Bay 1 runs the shutters. The east service door is quieter.', 'tip');
      }
      if (run.time > 210) G.radio('wes', 'Wes here. If you’re near Route 9... the evac center on the loop hasn’t answered in weeks.', 'wes');
      const tom = G.findSurvivor(run, 'tomas');
      if (tom && tom.locked && M.dist(pp.x, pp.y, 79, 40) < 18) G.radio('tomas', 'Hey! Out there! The freezer door’s jammed. Get me out!', 'tomasCall');
      // compressors: the warm-up telegraphs, then the crowd moves
      for (const e of run.emitters) {
        if (!e.on) { e._live = false; continue; }
        if (e.warm > 0 && !e._warn) { e._warn = true; G.cue(e.cueLabel, e.x, e.y, 'warn'); G.msg(e.id === 'condensers' ? 'Compressor bank winding up in the north yard...' : 'The machine room compressor is winding up...', 'warn', 3); }
        if (e.warm <= 0 && !e._live) {
          e._live = true; e._warn = false;
          if (e.id === 'condensers') { let n = 0; for (const tg of ['north', 'dry', 'west', 'east']) n += DH.World.drawGroup(tg, e.x, e.y + 4, 10); if (n) { G.cue('MOVEMENT', 44, 40, 'danger'); G.msg('The dead are moving toward the compressors.', 'danger', 3); } }
          else { const n = DH.World.drawGroup('cold', e.x - 3, e.y - 2, 5); if (n) G.cue('MOVEMENT', 70, 46, 'danger'); }
        }
        if (e.warm <= 0 && Math.random() < dt * 3 && DH.FX) DH.FX.vapor(e.x + (Math.random() - 0.5) * 8, e.y, 'rgba(225,240,250,0.12)');
      }
      // cold vapor at open shutters and curtains near the player
      if (DH.FX && Math.random() < dt * 4) {
        for (const [x, y] of [[60.5, 46], [66.5, 49], [86.5, 49]]) if (M.dist(pp.x, pp.y, x, y) < 14) DH.FX.vapor(x, y);
        G.W.doors.forEach((d, i) => { if (d.shutter && run.doors[i].open && d.bld === 'cold' && M.dist(pp.x, pp.y, d.cx, d.cy) < 18) DH.FX.vapor(d.cx, d.cy + 0.8); });
      }
      void p;
    },
    objectives(run) {
      const a = run.items.assembly, m = run.items.medstock;
      const aTxt = a.loc === 'truck' ? 'Refrigeration unit loaded' : a.loc === 'hauled' ? 'Haul the unit to the truck tailgate' : run.seen.assembly ? 'Refrigeration unit: haul it to the truck' : 'Find the refrigeration unit (cold wing machine room)';
      const mTxt = m.loc === 'world' ? 'Recover the medical stock (pharma cold room)' : m.loc === 'truck' ? 'Medical stock in the truck bed' : 'Medical stock in your pack';
      const out = [{ text: aTxt, done: a.loc === 'truck' }, { text: mTxt, done: m.loc !== 'world', opt: false }];
      const t = DH.G.findSurvivor(run, 'tomas');
      if (t) out.push({ text: t.locked ? 'Optional: someone is trapped in Freezer 2' : !t.recruited ? 'Optional: recruit Tomas' : t.state === 'downed' ? 'Tomas DOWN: revive (4 s, medkit)' : t.boarded ? 'Tomas in the truck' : 'Tomas with you (' + (t.mode === 'wait' ? 'waiting' : 'following') + ')', done: t.boarded, fail: t.state === 'downed', opt: true });
      else out.push({ text: 'Tomas is safe at the garage', done: true, opt: true });
      out.push({ text: run.flags.power ? 'Bay power ON: compressors are loud' : 'Route: bay power (switch room) or service door', opt: true });
      return out;
    },
    pointer(run) {
      const a = run.items.assembly, m = run.items.medstock, p = run.player, G = DH.G;
      if (p.hauling) return { x: run.truck.x, y: run.truck.y, label: 'TRUCK', col: '#ffd36a' };
      if (a.loc === 'world') return run.discovered.cold || run.discovered.machine ? { x: a.x, y: a.y, label: 'UNIT', col: '#ff8a7a' } : { x: 76, y: 66, label: 'COLD WING', col: '#ff8a7a' };
      if (m.loc === 'world') return { x: m.x, y: m.y, label: 'STOCK', col: '#ff8a7a' };
      return G.exitPointer(run);
    },
    markers(run, dot) {
      const a = run.items.assembly, m = run.items.medstock;
      if (a.loc === 'world' && !run.seen.assembly) dot(84, 59, 'rgba(255,107,90,.8)', 5);
      if (m.loc === 'world' && (run.discovered.cold || run.seen.assembly)) dot(m.x, m.y, '#ff6b5a', 4);
      if (!run.flags.power) dot(32, 63, '#ffd36a', 3);
    },
    labels(run) {
      const p = run.player, out = [];
      if (!run.flags.power && M.dist(p.x, p.y, 32, 64) < 12) out.push({ x: 30.2, y: 63.4, z: 2.4, text: 'BAY POWER', col: '#ffd36a' });
      if (M.dist(p.x, p.y, 61.6, 22.4) < 12) out.push({ x: 61.6, y: 22.4, z: 2.0, text: 'COMPRESSOR TEST', col: '#8cd6ff' });
      return out;
    },
    primaryOut: (out) => !!(out.got.assembly && out.got.medstock),
    primaryGot: (run) => run.items.assembly.loc === 'truck' && run.items.medstock.loc !== 'world',
    departWarn: 'The refrigeration unit and the medical stock both have to come out. This will be a partial extraction.',
    resultSub(r) { return r.status === 'partial' ? 'Primary objective incomplete: the clinic still needs the refrigeration unit and the stock.' : r.status === 'failed' ? 'Nothing extracted. No rewards from this run. Your campaign progress is safe.' : 'Cold storage is on its way to Kettle Creek.'; },
    resultRows(run, ev) {
      const R = DH.T.rewards, t = DH.G.findSurvivor(run, 'tomas');
      return [
        ['Refrigeration unit (primary)', ev.got.assembly ? 'Recovered +' + R.assembly : 'Missing', ev.got.assembly ? 'good' : 'bad'],
        ['Medical stock (primary)', ev.got.medstock ? 'Recovered +' + R.medstock : 'Missing', ev.got.medstock ? 'good' : 'bad'],
        ['Depot worker (Tomas)', ev.survivorsOut.indexOf('tomas') >= 0 ? 'Rescued +' + R.survivor : !t ? 'Already at the garage' : t.recruited ? 'Left behind' : 'Not rescued', ev.survivorsOut.indexOf('tomas') >= 0 ? 'good' : t && t.recruited ? 'bad' : ''],
        ['Route', run.flags.power ? 'Bay power (loud)' : 'Service side (quiet)'],
        ['Salvage bundles', ev.salvageOut + (ev.salvageOut ? ' (+' + ev.salvageOut * R.salvage + ')' : ''), ev.salvageOut ? 'good' : ''],
      ];
    },
    outcome(run, ev) {
      const tomas = ev.survivorsOut.indexOf('tomas') >= 0;
      return { assembly: !!ev.got.assembly, medstock: !!ev.got.medstock, tomas, route: run.flags.power ? 'power' : 'service', records: !!run.flags.note_records, optional: { tomas, records: !!run.flags.note_records } };
    },
    hints: {
      start: { kbm: 'Route 9 Distribution. The refrigeration unit is in the cold wing machine room. Follow the red pointer. Park smart before you haul.', touch: 'The refrigeration unit is in the cold wing. Follow the red pointer. Park smart before you haul.' },
      primaryGot: { kbm: 'Unit and stock secured. Drive out on Route 9.', touch: 'Unit and stock secured. Drive out on Route 9.' },
    },
    backdropCam: { x: 60, y: 82 },
  });
})();

