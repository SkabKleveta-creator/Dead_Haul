/* DEAD HAUL - Level 1: Mercer Crossing (authored district, preserved from the shipped first level) */
(function () {
  'use strict';
  const DH = window.DH;
  DH.LEVELS = DH.LEVELS || {};
  const M = DH.M;

  const build = () => {
    const K = DH.MapKit('mercer');
    const { W, MAT, F } = K;
    const idx = W.idx;
    const { setFloor, wallLine, clearWall, windows, building, door, sign, P, box, circ, car } = K;

    // ---- Ground ----
    const roads = [
      [10, 10, 109, 18], // north street
      [0, 55, 119, 63],  // cross street
      [0, 98, 119, 106], // south (arrival) street
      [10, 10, 18, 106], // west road
      [55, 0, 63, 119],  // main street
      [101, 0, 109, 106], // east road
    ];
    W.roads = roads;
    for (const r of roads) setFloor(r[0] - 2, r[1] - 2, r[2] + 2, r[3] + 2, F.WALK);
    setFloor(19, 19, 43, 33, F.FORECOURT);   // fuel forecourt
    setFloor(19, 34, 54, 37, F.WALK);        // pharmacy rear alley
    setFloor(47, 34, 54, 54, F.LOT);         // pharmacy lot
    setFloor(64, 35, 100, 54, F.GRAVEL);     // hardware yard
    setFloor(64, 64, 100, 69, F.WALK);       // diner service alley
    setFloor(64, 85, 100, 97, F.LOT);        // diner lot
    setFloor(37, 64, 39, 97, F.WALK);        // SW passage
    setFloor(91, 70, 92, 84, F.WALK);        // diner/garage passage
    setFloor(30, 107, 31, 118, F.WALK);      // foot evac path
    for (const r of roads) setFloor(r[0], r[1], r[2], r[3], F.ROAD);

    // ---- Perimeter ----
    wallLine(0, 0, 119, 0, MAT.BARRICADE);
    wallLine(0, 119, 119, 119, MAT.BARRICADE);
    wallLine(0, 0, 0, 119, MAT.BARRICADE);
    wallLine(119, 0, 119, 119, MAT.BARRICADE);
    clearWall(0, 98, 0, 106);     // SW truck exit
    clearWall(101, 0, 109, 0);    // NE truck exit
    clearWall(30, 119, 31, 119);  // foot evac gate
    wallLine(29, 107, 29, 118, MAT.WOODFENCE);
    wallLine(32, 107, 32, 118, MAT.WOODFENCE);

    // ---- Buildings ----
    building('Quik Fuel Kiosk', 'kiosk', 36, 20, 43, 27, MAT.BLOCK, F.LINO, '#3b3f44');
    door('kiosk', 39, 27, 2, 'h');
    windows(37, 27, 38, 27); windows(41, 27, 42, 27); windows(43, 21, 43, 26);
    sign('QUIK FUEL', 36.6, 27, 'S', 6.8, '#f2c14e', '#2a2d33');

    building('Mercer Savings', 'bank', 45, 20, 53, 31, MAT.BRICK, F.TILE, '#463a36');
    door('bank', 48, 31, 2, 'h');
    windows(46, 31, 47, 31); windows(50, 31, 52, 31); windows(53, 22, 53, 29);
    sign('MERCER SAVINGS', 45.5, 31, 'S', 8, '#d9d2c0', '#3a2f2b');

    const ph = building('Crossing Pharmacy', 'pharmacy', 22, 38, 46, 53, MAT.BRICK, F.TILE, '#3d4a4a');
    wallLine(23, 44, 45, 44, MAT.INTERIOR);
    setFloor(23, 39, 45, 43, F.CONCRETE_IN);
    door('pharmacy', 31, 44, 2, 'h', { label: 'Stockroom Door', hp: 110, maxHp: 110 });
    door('pharmacy', 33, 53, 2, 'h', { label: 'Front Door', hp: 110, maxHp: 110 });
    door('pharmacy', 40, 38, 2, 'h', { label: 'Loading Door', hp: 130, maxHp: 130 });
    windows(23, 53, 31, 53); windows(36, 53, 45, 53); windows(46, 45, 46, 52);
    sign('PHARMACY', 36.5, 53, 'S', 8.5, '#7fe3a0', '#1d2b26');
    sign('+ RX', 46, 46.5, 'E', 4, '#7fe3a0', '#1d2b26');
    ph.rooms.push({ name: 'Stockroom', x1: 23, y1: 39, x2: 45, y2: 43 });

    building('Mercer Hardware', 'hardware', 68, 21, 92, 34, MAT.BLOCK, F.CONCRETE_IN, '#4a4034');
    door('hardware', 78, 34, 2, 'h', { label: 'Front Door' });
    door('hardware', 92, 29, 2, 'v', { label: 'Side Door' });
    windows(69, 34, 76, 34); windows(81, 34, 91, 34); windows(92, 23, 92, 27);
    sign('MERCER HARDWARE', 81, 34, 'S', 10.5, '#e8a33d', '#2b2217');

    building('Yard Shed', 'shed', 90, 39, 98, 48, MAT.SIDING, F.WOOD, '#3e3a33');
    clearWall(90, 42, 90, 45);

    building('Suds Laundry', 'laundry', 22, 66, 36, 77, MAT.TEAL, F.LINO, '#34403f');
    door('laundry', 29, 66, 2, 'h');
    door('laundry', 29, 77, 2, 'h');
    windows(23, 77, 27, 77); windows(32, 77, 35, 77); windows(36, 68, 36, 75);
    sign('SUDS LAUNDRY', 31.5, 77, 'S', 4.3, '#9fe0e8', '#1f3033');

    building('Kemper House', 'houseA', 41, 67, 51, 76, MAT.SIDING, F.WOOD, '#4b3c35');
    door('houseA', 45, 76, 2, 'h');
    windows(42, 76, 43, 76); windows(48, 76, 50, 76); windows(51, 69, 51, 74);
    building('Alder House', 'houseB', 41, 84, 51, 94, MAT.STUCCO, F.WOOD, '#50463d');
    door('houseB', 44, 84, 2, 'h');
    door('houseB', 46, 94, 2, 'h');
    windows(42, 94, 44, 94); windows(49, 94, 50, 94); windows(51, 86, 51, 92);

    const dn = building('Night Owl Diner', 'diner', 70, 70, 90, 84, MAT.CREAM, F.CHECKER, '#5a2e2b');
    wallLine(71, 75, 89, 75, MAT.INTERIOR);
    wallLine(82, 71, 82, 74, MAT.INTERIOR);
    clearWall(74, 75, 75, 75);
    setFloor(71, 71, 81, 74, F.CONCRETE_IN);
    setFloor(83, 71, 89, 74, F.WOOD);
    door('diner', 86, 75, 2, 'h', { label: 'Back Room Door' });
    door('diner', 76, 84, 2, 'h', { label: 'Front Door' });
    door('diner', 77, 70, 2, 'h', { label: 'Service Door' });
    windows(71, 84, 74, 84); windows(79, 84, 89, 84); windows(90, 76, 90, 83);
    sign('NIGHT OWL DINER', 79.5, 84, 'S', 9.5, '#ff6b5a', '#2a1715');
    dn.rooms.push({ name: 'Back Room', x1: 83, y1: 71, x2: 89, y2: 74 });

    building('Crossing Auto', 'garage', 93, 70, 99, 82, MAT.BLOCK, F.CONCRETE_IN, '#3c4043');
    door('garage', 93, 75, 2, 'v');
    windows(99, 72, 99, 80);
    sign('AUTO', 99, 73, 'E', 5, '#e0e0e0', '#303436');

    wallLine(64, 54, 79, 54, MAT.CHAIN); wallLine(92, 54, 100, 54, MAT.CHAIN);
    wallLine(64, 36, 64, 40, MAT.CHAIN); wallLine(64, 48, 64, 54, MAT.CHAIN);
    wallLine(100, 36, 100, 54, MAT.CHAIN);
    wallLine(22, 86, 33, 86, MAT.WOODFENCE);
    wallLine(41, 79, 51, 79, MAT.WOODFENCE);
    wallLine(20, 64, 20, 76, MAT.WOODFENCE);

    // ---- Props ----
    const cars = [
      [35, 11.8, 0.02, '#6b6f73'], [75, 16.4, 3.1, '#5a4a3a'], [95, 11.8, 0.05, '#3f5566'],
      [47, 56.6, 0.04, '#7a3b33'], [62.1, 57.3, 0.8, '#4e5d4a'], [70, 62.1, 3.12, '#5c5f63'],
      [80, 56.7, 0.08, '#3d4a5c'], [61.9, 75, 1.6, '#6e6a5e'], [56.9, 88, 1.55, '#4a4f55'],
      [45, 104.9, 0.02, '#5e3d3d'], [80, 99.7, 3.12, '#6a6d70'], [100, 104.6, 0.1, '#3f4d3f'],
      [11.9, 40, 1.57, '#58534a'], [16.9, 80, 1.6, '#3a4452'], [107.9, 30, 1.57, '#6d5a42'], [102.4, 80, 1.55, '#4f4f57'],
      [51.2, 43, 1.57, '#5f666c'], [70.2, 92, 1.57, '#6b4b3b'], [74.6, 92.3, 1.52, '#44525e'], [88.2, 92, 1.6, '#5e5e52'],
      [58.5, 3.5, 0.3, '#4a4a4a'], [2.8, 58, 1.2, '#503c35'], [116.5, 60.5, 2.0, '#454b50'], [60, 116.4, 0.2, '#57504a'],
    ];
    for (const c of cars) car(c[0], c[1], c[2], c[3]);
    box('van', 90, 56.9, 2.7, 1.05, 0.05, 2.1, { color: '#8a8478' });
    W.alarmCar = car(56.9, 47, 1.52, '#9a3d2e', { alarm: true, wreck: false, label: 'Car Alarm' });

    const canopy = { x1: 22, y1: 21, x2: 34, y2: 29, h: 4.4, text: 'QUIK FUEL  •  OPEN 24H' };
    W.canopy = canopy;
    for (const [cx, cy] of [[22.4, 21.4], [33.6, 21.4], [22.4, 28.6], [33.6, 28.6]]) circ('post', cx, cy, 0.18, 4.4);
    box('pumpIsland', 26, 25, 1.9, 0.45, 0, 0.25, { solid: true });
    box('pumpIsland', 31, 25, 1.9, 0.45, 0, 0.25, { solid: true });
    for (const px of [25.2, 26.8, 30.2, 31.8]) box('pump', px, 25, 0.35, 0.3, 0, 1.6, { solid: true });
    circ('priceSign', 20.5, 31.5, 0.2, 5.5, { text: 'QUIK FUEL' });
    box('dumpster', 44.5, 35, 1.0, 0.7, 0, 1.3, { color: '#2f4a3a' });
    box('dumpster', 20.8, 36.2, 1.0, 0.7, 1.57, 1.3, { color: '#3a3f4a' });

    for (const [x, y, l] of [[26.5, 48, 2.6], [26.5, 50.6, 2.6], [39.5, 48, 2.2], [39.5, 50.6, 2.2]]) box('aisle', x, y, l, 0.4, 0, 1.7, { color: '#b9c2c0' });
    box('counter', 42.8, 46.2, 1.4, 0.45, 0, 1.0, { color: '#8d7a64' });
    box('rack', 26, 39.6, 2.5, 0.4, 0, 2.0, { color: '#7b7f82' });
    box('rack', 35, 39.6, 2.5, 0.4, 0, 2.0, { color: '#7b7f82' });
    box('boxes', 44, 42.5, 0.6, 0.6, 0.2, 0.9, {});
    W.cabinet = box('cabinet', 45.3, 41, 0.35, 0.8, 0, 1.9, { color: '#6d7870', label: 'Gun Cabinet' });
    W.shelf = { id: 'shelf', x: 28.6, y: 45.6, aside: { x: 28.6, y: 45.6, ang: 0 }, block: { x: 32, y: 45.45, ang: 0 }, hl: 1.2, hw: 0.4, h: 2.0, state: 'aside', hp: 160, maxHp: 160, broken: false, tiles: [[31, 45], [32, 45]], clear: [[31, 45], [32, 45], [31, 44], [32, 44]], label: 'Stockroom Door' };

    for (const [x, y] of [[74, 26], [74, 29.5], [84, 26], [84, 29.5]]) box('aisle', x, y, 3.4, 0.45, 0, 1.9, { color: '#9a8a6c' });
    box('counter', 71, 31.5, 1.6, 0.45, 0, 1.0, { color: '#6b5a44' });
    box('rack', 71.5, 22.4, 1.4, 0.3, 0, 1.8, { color: '#5a4a3a', label: 'rifle rack' });
    box('lumber', 70, 40, 2.2, 0.7, 0, 1.0, {});
    box('lumber', 74, 50, 1.6, 0.6, 0.1, 0.8, {});
    box('pallets', 96, 51.5, 0.7, 0.7, 0.3, 1.1, {});
    box('pallets', 67, 45, 0.7, 0.7, 0, 0.8, {});
    box('bench', 96, 42, 1.2, 0.4, 1.57, 0.9, { color: '#5a4a3a' });

    for (let x = 24; x <= 34; x += 2) { box('washer', x + 0.2, 68.2, 0.45, 0.45, 0, 1.0, {}); }
    box('washer', 25.2, 72, 1.4, 0.45, 0, 1.0, { color: '#c8cccc' });
    box('washer', 33.2, 72, 1.4, 0.45, 0, 1.0, { color: '#c8cccc' });
    box('counter', 81, 77.4, 3, 0.45, 0, 1.05, { color: '#8a2f2a' });
    for (const [x, y] of [[73, 81], [84.5, 81], [87.5, 81], [88, 77.8]]) circ('table', x, y, 0.55, 0.8, {});
    box('stove', 72.5, 71.6, 1.2, 0.5, 0, 1.0, { color: '#6c6f72' });
    box('fridge', 80.8, 71.6, 0.5, 0.5, 0, 2.0, { color: '#b8bcbc' });
    box('bed', 88.3, 72.7, 0.6, 1.1, 0, 0.5, { color: '#5b5f6a', solid: true });
    box('dumpster', 69, 66.5, 1.0, 0.7, 0, 1.3, { color: '#2f4a3a' });
    box('toolbox', 97.5, 72, 0.5, 0.3, 0, 1.1, { color: '#a33' });
    box('lift', 96, 79, 1.2, 0.5, 1.57, 0.4, {});
    box('sofa', 46, 70, 1.3, 0.45, 0, 0.8, { color: '#5a4b3f' });
    box('sofa', 46, 91, 1.3, 0.45, 0, 0.8, { color: '#4b5a52' });
    box('gshed', 26, 91, 1.2, 1.0, 0, 2.2, { color: '#6b5b4a' });

    for (const y of [64.6, 97.4]) { circ('bollard', 37.55, y, 0.16, 0.9); circ('bollard', 39.45, y, 0.16, 0.9); }
    for (const x of [91.3, 92.7]) { circ('bollard', x, 69.6, 0.16, 0.9); circ('bollard', x, 84.6, 0.16, 0.9); }

    box('jersey', 59, 1.2, 3.8, 0.5, 0, 0.9, {}); box('jersey', 59, 118, 3.8, 0.5, 0, 0.9, {});
    box('jersey', 1.2, 59, 3.8, 0.5, 1.57, 0.9, {}); box('jersey', 118, 59, 3.8, 0.5, 1.57, 0.9, {});

    const trees = [[4, 28], [5, 45], [4, 80], [6, 90], [114, 40], [115, 86], [113, 25], [30, 4], [80, 5], [45, 5], [24, 111], [50, 112], [90, 112], [70, 113],
      [110, 112], [21, 70], [22, 94], [53, 80], [34, 82], [66, 78], [45, 60.2 + 0], [114, 70], [5, 112], [96, 100.5], [66, 25], [96, 33]];
    for (const [x, y] of trees) { if (W.wall[idx(Math.floor(x), Math.floor(y))]) continue; circ('tree', x, y, 0.3, 5.5, { seed: x * 7 + y }); }
    for (const [x, y] of [[8, 70], [7, 20], [112, 50], [25, 60.5], [99.5, 61], [44, 97], [66, 97.5], [85, 108], [20, 45], [20, 50]]) P('bush', x, y, { solid: false, r: 0.8, h: 0.9 });
    for (let i = 0; i < 60; i++) W.decals.push({ x: 2 + ((i * 37.3) % 116), y: 2 + ((i * 53.7) % 116), k: i % 5, a: i * 1.3 });

    const lamps = [
      [25, 19.6], [45, 19.6], [75, 19.6], [95, 19.6], [8, 54.4], [30, 54.4], [50, 54.4], [70, 64.6], [90, 54.4], [112, 64.6],
      [10, 97.4], [30, 97.4], [50, 97.4], [70, 97.4], [90, 97.4], [110, 97.4], [54.4, 10], [54.4, 30], [54.4, 80], [64.6, 45], [64.6, 90],
      [19.6, 30], [19.6, 80], [9.4, 60], [100.4, 25], [100.4, 80], [110.6, 45], [30.5, 114], [4, 104], [104, 4],
    ];
    lamps.forEach(([x, y], i) => { circ('lamp', x, y, 0.13, 5.2, { lampIdx: i }); W.lamps.push({ x, y, on: true, flicker: 0, r: 7.5 }); });

    P('exitSign', 7.2, 96.8, { solid: false, text: 'EXIT', sub: 'SW ROAD', h: 3.2 });
    P('exitSign', 100.2, 7.5, { solid: false, text: 'EXIT', sub: 'NE ROAD', h: 3.2 });
    P('exitSign', 33.4, 112.8, { solid: false, text: 'EVAC', sub: 'ON FOOT', h: 2.8, green: true });

    // ground markings: crosswalks at the central intersection and parking stalls
    W.marks.push({ k: 'crosswalk', x: 55.5, y: 53.6, n: 8, dir: 'x' }, { k: 'crosswalk', x: 55.5, y: 64.2, n: 8, dir: 'x' }, { k: 'crosswalk', x: 53.6, y: 55.5, n: 8, dir: 'y' }, { k: 'crosswalk', x: 64.2, y: 55.5, n: 8, dir: 'y' });
    W.marks.push({ k: 'stallsH', x1: 49, x2: 54, y1: 38, y2: 52, step: 3 }, { k: 'stallsV', y1: 87, y2: 92.5, x1: 66, x2: 98, step: 3 });
    // evac flare at the foot gate
    W.glows.push({ x: 31, y: 116.5, r: 3.5, col: 'rgba(90,255,140,A)', a: 0.16, pulse: 6, hole: { x: 31, y: 116, r: 4, a: 0.7 } });

    K.finish();

    W.exits = [
      { id: 'sw', name: 'Southwest Road Exit', kind: 'truck', x1: 0, y1: 98, x2: 4.5, y2: 107, lx: 6, ly: 102.5, out: [-1, 0] },
      { id: 'ne', name: 'Northeast Perimeter Exit', kind: 'truck', x1: 101, y1: 0, x2: 110, y2: 4.5, lx: 105.5, ly: 6, out: [0, -1] },
      { id: 'foot', name: 'Evac Gate (on foot)', kind: 'foot', x1: 30, y1: 114.5, x2: 32, y2: 119.9, lx: 31, ly: 113, out: [0, 1] },
    ];
    W.start = { truck: { x: 26, y: 102.6, ang: Math.PI }, player: { x: 27.5, y: 99.6 } };
    W.reserveEntries = [{ x: 59.5, y: 3.2, name: 'north' }, { x: 59.5, y: 116, name: 'south' }, { x: 3.4, y: 59.5, name: 'west' }, { x: 116, y: 59.5, name: 'east' }, { x: 114, y: 20, name: 'northeast' }, { x: 5, y: 15, name: 'northwest' }];
    W.landmarks = [
      { id: 'pharmacy', name: 'Pharmacy', x: 34, y: 46, r: 16 },
      { id: 'intersection', name: 'Intersection', x: 59, y: 59, r: 14 },
      { id: 'diner', name: 'Diner', x: 80, y: 77, r: 15 },
      { id: 'hardware', name: 'Hardware', x: 80, y: 32, r: 16 },
      { id: 'fuel', name: 'Fuel Stop', x: 30, y: 26, r: 15 },
      { id: 'laundry', name: 'Laundry', x: 29, y: 72, r: 10, quiet: true },
      { id: 'bank', name: 'Bank', x: 49, y: 26, r: 8, quiet: true },
      { id: 'garage', name: 'Auto Shop', x: 96, y: 76, r: 8, quiet: true },
    ];
    W.itemSpots = {
      caseSpot: { x: 26.5, y: 41.6 },
      shotgun: { x: 44.35, y: 41.0 },
      smg: [{ x: 38.6, y: 23.2 }, { x: 41.4, y: 23.4 }],
      rifle: { x: 71.5, y: 23.2 },
      repair: { x: 89.4, y: 23.6 },
      dinerMed: { x: 74.5, y: 73.2 },
      dinerAmmo: { x: 88.3, y: 79.5 },
      salvage: [[49, 24.5], [24.5, 70], [48, 71.5], [44, 90], [96.5, 76.5], [95, 45], [41.5, 25], [87, 31.8], [44.5, 51], [70, 43.8], [26, 83], [31, 73.5]],
      extraNoise: [[33.5, 75.2], [47.8, 89.2], [97.5, 80.8]],
      extraAmmo: [[51, 28.5], [43, 74], [25, 75]],
      extraMed: [[49.5, 87], [95.2, 72.5]],
      generator: { x: 86.3, y: 44 },
      survivor: { x: 85.6, y: 72.4 },
    };
    W.zombieGroups = [
      [38, 48.5, 2.5, { drifter: 2 }], [35.5, 41.5, 1.5, { drifter: 1 }],
      [50, 46, 3.5, { drifter: 2, runner: 1 }],
      [31, 31, 4, { drifter: 3, howler: 1 }],
      [49, 26, 2, { drifter: 1 }],
      [72, 14, 5, { drifter: 2, runner: 1 }],
      [59, 59, 4, { drifter: 3, howler: 1, runner: 1 }],
      [80, 28, 3, { drifter: 2 }],
      [78, 46, 5, { drifter: 2, howler: 1, runner: 1 }],
      [80, 80, 3, { drifter: 2 }],
      [82, 92, 5, { drifter: 2, clinger: 1 }],
      [105, 55, 4, { drifter: 2, clinger: 1, runner: 1 }],
      [59, 82, 4, { drifter: 2, clinger: 1 }],
      [29, 72, 2, { drifter: 1 }], [46, 71.5, 1.5, { drifter: 1 }],
      [14, 50, 4, { drifter: 2, runner: 1 }],
    ];
    W.mapTitle = 'MERCER CROSSING';
    return W;
  };

  const L = (DH.LEVELS[1] = {
    id: 1, key: 'mercer', name: 'Mercer Crossing', place: 'MERCER CROSSING, DUSK', short: 'First medicine run',
    tag: 'Insulin for the Kettle Creek clinic',
    build,
    brief: () => 'Kettle Creek’s clinic is out of insulin. Get the marked medical case from the Crossing Pharmacy stockroom. Survivor and generator optional. Your engine draws the dead. Park smart, leave fast.',
    meta: () => [['Primary', 'Pharmacy, west'], ['Optional', 'Diner survivor · Hardware generator'], ['Exits', 'SW road · NE road · South evac gate']],
    optionalKeys: [['nell', 'Rescue Nell'], ['generator', 'Recover the generator']],
    setup(run, rng, story) {
      const W = DH.G.W, S = W.itemSpots;
      const add = DH.G.addItem;
      add(run, 'case', 'case', S.caseSpot.x, S.caseSpot.y);
      const salv = rng.shuffle(S.salvage.slice()).slice(0, 6);
      salv.forEach((p, i) => add(run, 'salvage' + i, 'salvage', p[0], p[1]));
      add(run, 'generator', 'generator', S.generator.x, S.generator.y, { spot: 'Portable generator spotted in the hardware yard. Optional: haul it to the truck.' });
      const pk = DH.G.addPickup;
      pk(run, 'weapon', S.shotgun.x, S.shotgun.y, { wtype: 'shotgun', mag: 6, reserve: 12, cabinet: true });
      const smgSpot = rng.pick(S.smg);
      pk(run, 'weapon', smgSpot.x, smgSpot.y, { wtype: 'smg', mag: 30, reserve: 60, crate: true });
      pk(run, 'weapon', S.rifle.x, S.rifle.y, { wtype: 'rifle', mag: 6, reserve: 12 });
      pk(run, 'repairkit', S.repair.x, S.repair.y, { n: 1 });
      pk(run, 'medkit', S.dinerMed.x, S.dinerMed.y, { n: 1 });
      pk(run, 'ammo', S.dinerAmmo.x, S.dinerAmmo.y, { atype: 'p9', n: 24 });
      const en = rng.pick(S.extraNoise); pk(run, 'noisemaker', en[0], en[1], { n: 1 });
      const ea = rng.pick(S.extraAmmo); pk(run, 'ammo', ea[0], ea[1], { atype: 'p9', n: 24 });
      const em = rng.pick(S.extraMed); pk(run, 'medkit', em[0], em[1], { n: 1 });
      pk(run, 'ammo', 43.2, 50.9 + (rng.next() < 0.5 ? 0 : -0.8), { atype: 'shell', n: 6 });
      if (!(story && story.milestones && story.milestones.nell)) DH.G.addSurvivor(run, 'nell', 'Nell', 'survivor', S.survivor.x, S.survivor.y, { where: 'Diner', landmark: 'diner', pron: 'her' });
    },
    objectives(run) {
      const kase = run.items.case;
      const out = [{ text: kase.loc === 'world' ? 'Recover the medical case (Pharmacy stockroom)' : kase.loc === 'truck' ? 'Case in the truck bed: drive to an EXIT' : 'Case in your pack: extract by truck or EVAC gate', done: kase.loc !== 'world' }];
      const sv = run.survivors[0];
      if (sv) {
        const t = !sv.recruited ? 'Optional: rescue the survivor (Diner)' : sv.state === 'downed' ? 'Survivor DOWN: revive (4 s, medkit)' : sv.boarded ? 'Survivor in the truck' : 'Survivor with you (' + (sv.mode === 'wait' ? 'waiting' : 'following') + ')';
        out.push({ text: t, done: sv.boarded, fail: sv.state === 'downed', opt: true });
      } else out.push({ text: 'Nell is safe at the garage', done: true, opt: true });
      const g = run.items.generator;
      out.push({ text: g.loc === 'truck' ? 'Generator loaded in the truck' : g.loc === 'hauled' ? 'Hauling the generator to the truck' : run.seenGenerator ? 'Optional: haul the generator to the truck' : 'Optional: recover the generator (Hardware yard)', done: g.loc === 'truck', opt: true });
      const carried = Object.values(run.items).filter((i) => i.kind === 'salvage' && i.loc !== 'world').length;
      out.push({ text: 'Salvage carried: ' + carried + ' / 6', opt: true });
      return out;
    },
    pointer(run) {
      const kase = run.items.case, p = run.player;
      if (kase.loc === 'world') return run.discovered.pharmacy ? { x: kase.x, y: kase.y, label: 'CASE', col: '#ff8a7a' } : { x: 34, y: 54, label: 'PHARMACY', col: '#ff8a7a' };
      return DH.G.exitPointer(run);
    },
    markers(run, dot) {
      const kase = run.items.case;
      if (kase.loc === 'world' && run.discovered.pharmacy) dot(kase.x, kase.y, '#ff6b5a', 4);
      else if (kase.loc === 'world') dot(34, 46, 'rgba(255,107,90,.8)', 5);
    },
    primaryOut: (out) => out.caseOut,
    primaryName: 'Medical case',
    departWarn: 'The medical case is not coming with you. This will be a partial extraction: the primary objective stays incomplete.',
    resultSub(r) { return r.status === 'partial' ? 'Primary objective incomplete: the medical case did not make it out.' : r.status === 'failed' ? 'Nothing extracted. No rewards from this run. Your garage progress is safe.' : 'The medical case is on its way to Kettle Creek.'; },
    resultRows(run, ev) {
      const R = DH.T.rewards, rows = [];
      const sv = run.survivors[0];
      rows.push(['Medical case (primary)', ev.caseOut ? 'Recovered +' + R.case : 'Missing', ev.caseOut ? 'good' : 'bad']);
      rows.push(['Survivor (' + DH.Survivor.NAME + ')', ev.survivorOut ? 'Rescued +' + R.survivor : !sv ? 'Already at the garage' : sv.recruited ? 'Left behind' : 'Not rescued', ev.survivorOut ? 'good' : sv && sv.recruited ? 'bad' : '']);
      rows.push(['Generator', ev.generatorOut ? 'Recovered +' + R.generator : run.seenGenerator ? 'Lost' : 'Not recovered', ev.generatorOut ? 'good' : '']);
      rows.push(['Salvage bundles', ev.salvageOut + (ev.salvageOut ? ' (+' + ev.salvageOut * R.salvage + ')' : ''), ev.salvageOut ? 'good' : '']);
      return rows;
    },
    outcome(run, ev) { const nell = ev.survivorsOut.indexOf('nell') >= 0; return { case: ev.caseOut, generator: ev.generatorOut, nell, salvage: ev.salvageOut, optional: { nell, generator: ev.generatorOut } }; },
    hints: {
      start: { kbm: 'WASD moves · mouse aims · click fires · F crowbar (quiet). The pharmacy is up-left of the arrival street. Follow the red pointer.', touch: 'Left stick moves (edge = sprint). Right stick aims; push far to fire. Follow the red pointer to the pharmacy.' },
      primaryGot: { kbm: 'Case secured. Drive into an EXIT zone, or walk out through the EVAC gate south of the arrival street.', touch: 'Case secured. Drive into an EXIT zone, or walk out through the EVAC gate south of the arrival street.' },
    },
    primaryGot: (run) => run.items.case.loc !== 'world',
    backdropCam: { x: 46, y: 60 },
  });
  L.minimapBase = null;
})();
