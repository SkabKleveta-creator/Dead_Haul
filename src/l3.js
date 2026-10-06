/* ==== l3.js ==== */
/* DEAD HAUL - Level 3: High Water (Low Flats residential edge and municipal pumping station) */
(function () {
  'use strict';
  const DH = window.DH;
  DH.LEVELS = DH.LEVELS || {};
  const M = DH.M;
  const CH = {
    A: { name: 'LOW STREET', short: 'Channel A', cx: 57.5, cy: 58, box: { x: 64, y: 51.5 } },
    B: { name: 'CANAL LANE', short: 'Channel B', cx: 35, cy: 13, box: { x: 42.5, y: 17.6 } },
  };

  const build = () => {
    const K = DH.MapKit('highwater', { theme: { dark: 'rgba(9,13,24,0.70)', lamp: 'rgba(255,175,80,A)', lightR: 8, flashlight: true, rain: true } });
    const { W, MAT, F } = K;
    const { fill, wallLine, clearWall, windows, building, door, sign, P, box, circ } = K;
    W.hasWater = true;

    // ---- ground: wet flats, river, canal ----
    fill(0, 0, 119, 119, F.MUD);
    for (let i = 0; i < 70; i++) { const x = 4 + ((i * 41.3) % 96), y = 4 + ((i * 29.7) % 110); fill(Math.floor(x), Math.floor(y), Math.floor(x) + 3 + (i % 4), Math.floor(y) + 2 + (i % 3), i % 3 ? F.GRASS : F.WATER); }
    K.ground(105, 0, 119, 119, F.SEA);                    // the river
    wallLine(104, 0, 104, 119, MAT.LEVEE);
    K.road(0, 100, 62, 106);                              // Marsh Road (arrival)
    K.road(55, 30, 60, 106);                              // Low Street
    K.road(55, 30, 70, 36);                               // Station Road
    K.road(6, 10, 12, 100);                               // Levee Road
    K.road(6, 10, 70, 16);                                // Canal Lane
    K.road(16, 73, 54, 77);                               // Willow Street (flooded)
    K.road(84, 0, 90, 9);                                 // north service road
    fill(70, 6, 103, 40, F.GRAVEL);                       // station yard
    K.paveRoads();
    fill(14, 71, 54, 79, F.WATER);                        // Willow Street under water
    fill(14, 80, 29, 96, F.WATER);                        // the flooded lot around the Hale house
    fill(63, 41, 103, 56, F.WATER); fill(70, 44, 90, 50, F.MUD);
    fill(32, 0, 38, 56, F.WATER);                         // drainage canal
    K.truckOnly(32, 0, 38, 7); K.truckOnly(32, 19, 38, 56);
    fill(39, 106, 41, 119, F.WALK);                       // south footpath

    // ---- perimeter ----
    K.perimeter(MAT.BARRICADE);
    clearWall(0, 100, 0, 106); clearWall(84, 0, 90, 0); clearWall(39, 119, 41, 119);
    wallLine(38, 107, 38, 118, MAT.WOODFENCE); wallLine(42, 107, 42, 118, MAT.WOODFENCE);

    // ---- rail embankment with its crossings ----
    wallLine(1, 57, 103, 59, MAT.ROCK);
    clearWall(5, 57, 13, 59);                             // Levee Road underpass (dry)
    clearWall(53, 57, 62, 59);                            // Low Street underpass (Channel A)
    clearWall(30, 57, 31, 59); fill(30, 56, 31, 60, F.DOCK); K.truckOnly(30, 56, 31, 60); // footbridge
    for (const x of [52.6, 62.4]) box('pillar', x, 58, 0.4, 1.4, 0, 3.2, { parts: [[0, 0, 0, 0.4, 1.4, 3.2, '#77756e']] });
    box('girder', 57.5, 58, 5.2, 1.4, 0, 0.6, { solid: false, pri: 3, kOff: 2, parts: [[0, 0, 3.1, 5.2, 1.5, 0.6, '#5a5d5f']] });

    // ---- flood channels (predefined, switchable) ----
    K.gate('A', 'flood', [[53, 51, 62, 65]], { initial: true, label: 'Channel A (Low Street underpass)', short: 'A' });
    K.gate('B', 'flood', [[30, 8, 40, 18]], { initial: true, label: 'Channel B (Canal Lane crossing)', short: 'B' });

    // ---- raised boardwalk from Marsh Road to the footbridge ----
    fill(30, 60, 31, 98, F.DOCK); K.truckOnly(30, 60, 31, 98);
    wallLine(29, 60, 29, 70, MAT.RAIL); wallLine(32, 60, 32, 70, MAT.RAIL);
    wallLine(29, 80, 29, 97, MAT.RAIL); wallLine(32, 80, 32, 97, MAT.RAIL);
    fill(30, 40, 31, 55, F.DOCK); wallLine(29, 40, 29, 55, MAT.RAIL); wallLine(32, 40, 32, 55, MAT.RAIL);

    // ---- pump station ----
    wallLine(70, 6, 103, 6, MAT.CHAIN); wallLine(70, 40, 103, 40, MAT.CHAIN); wallLine(70, 6, 70, 40, MAT.CHAIN);
    clearWall(84, 6, 90, 6); clearWall(70, 30, 70, 37); clearWall(70, 8, 70, 18);
    const ph = building('Low Flats Pump Station', 'pumps', 78, 10, 96, 24, MAT.CONCRETE, F.CONCRETE_IN, '#3f4547');
    wallLine(79, 18, 85, 18, MAT.INTERIOR); wallLine(86, 11, 86, 18, MAT.INTERIOR);
    door('pumps', 86, 14, 2, 'v', { label: 'Control Room Door' });
    door('pumps', 87, 24, 2, 'h', { label: 'Pump House Door', color: '#5b6670' });
    door('pumps', 78, 20, 2, 'v', { label: 'Side Door', color: '#5b6670' });
    windows(80, 24, 85, 24); windows(96, 12, 96, 22);
    ph.rooms.push({ name: 'Control Room', x1: 79, y1: 11, x2: 85, y2: 17 });
    sign('LOW FLATS PUMPING STATION', 89, 24, 'S', 7, '#e9e4d8', '#2a3a42', 2.6);
    building('Filter Store', 'store', 90, 28, 100, 37, MAT.CORR, F.CONCRETE_IN, '#4a4f53');
    door('store', 90, 31, 3, 'v', { label: 'Store Door', color: '#5b6670' });
    sign('FILTERS', 90, 33.5, 'E', 3.4, '#9fd8f0', '#1d3140');
    W.panel = box('console', 81.2, 12.4, 1.1, 0.4, 0, 1.1, { label: 'Pump control', color: '#4c5459' });
    box('panel', 84.4, 11.5, 0.35, 0.3, 0, 1.6, { color: '#5d6a5e' });
    for (const [x, y] of [[89, 13.5], [93, 13.5], [89, 20], [93, 20]]) box('pumpunit', x, y, 1.3, 0.8, 0, 1.4, {});
    box('pipe', 92.4, 16.8, 3.7, 0.25, 0, 0.5, { z: 0.6, color: '#2f6d8c' });
    box('pipe', 100, 20, 4, 0.3, Math.PI / 2, 0.6, { z: 0.2, color: '#2f6d8c' });
    box('tank', 100, 10.5, 1.6, 1.6, 0, 3.2, { shape: 'circle', r: 1.6, color: '#5d7f93' });
    box('valve', 101, 24, 0.2, 0.2, 0, 1, {});
    box('drum', 77.3, 21.2, 0.3, 0.3, 0, 0.9, { shape: 'circle', r: 0.3, color: '#3e6a4a' }); box('drum', 77.4, 22.1, 0.3, 0.3, 0, 0.9, { shape: 'circle', r: 0.3, color: '#7a3a2a' });
    box('pallets', 98, 34.5, 0.7, 0.7, 0, 1.0, {});
    for (const [x, y] of [[77, 26], [97, 8], [101, 38]]) box('beacon', x, y, 0.1, 0.1, 0, 3.0, { power: 'pumps' });

    // ---- houses (rain-dark siding) and fenced yards ----
    const house = (name, key, x1, y1, x2, y2, doorSide, roof) => {
      const b = building(name, key, x1, y1, x2, y2, MAT.WETSIDING, F.WOOD, roof || '#34302c');
      return b;
    };
    house('Brook House', 'h1', 15, 61, 24, 69, 'S'); door('h1', 19, 69, 2, 'h'); windows(16, 69, 17, 69); windows(22, 69, 23, 69);
    house('Ames House', 'h2', 34, 61, 43, 69, 'S'); door('h2', 38, 69, 2, 'h'); windows(35, 69, 36, 69); windows(41, 69, 42, 69);
    const hale = house('Hale House', 'h4', 16, 81, 26, 90, 'N', '#3a3330'); door('h4', 20, 81, 2, 'h', { label: 'Front Door' }); windows(17, 81, 18, 81); windows(23, 81, 25, 81); windows(26, 83, 26, 88);
    hale.rooms.push({ name: 'Hale House', x1: 17, y1: 82, x2: 25, y2: 89 });
    house('Price House', 'h5', 34, 81, 43, 90, 'N'); door('h5', 38, 81, 2, 'h'); windows(35, 81, 36, 81); windows(41, 81, 42, 81);
    house('Corner Store', 'h6', 65, 78, 74, 88, 'W', '#3b3f44'); door('h6', 65, 82, 2, 'v', { label: 'Store Door' }); windows(65, 79, 65, 80); windows(65, 85, 65, 87);
    house('Reed House', 'h8', 20, 30, 29, 38, 'N'); door('h8', 24, 30, 2, 'h'); windows(21, 30, 22, 30);
    house('Moss House', 'h9', 41, 30, 50, 38, 'N'); door('h9', 45, 30, 2, 'h'); windows(47, 30, 49, 30);
    house('Dale House', 'h10', 78, 64, 90, 74, 'W'); door('h10', 78, 68, 2, 'v'); windows(78, 65, 78, 66);
    // yards with gates onto the streets the pumps will draw them to
    const yard = (x1, y1, x2, y2, gate) => { wallLine(x1, y1, x2, y1, MAT.WOODFENCE); wallLine(x1, y2, x2, y2, MAT.WOODFENCE); wallLine(x1, y1, x1, y2, MAT.WOODFENCE); wallLine(x2, y1, x2, y2, MAT.WOODFENCE); fill(x1 + 1, y1 + 1, x2 - 1, y2 - 1, F.GRASS); door(null, gate[0], gate[1], gate[2], gate[3], { gate: true, label: 'Yard Gate', color: '#6b5236', gateH: 1.8, hp: 60, maxHp: 60 }); };
    yard(44, 61, 52, 69, [52, 64, 2, 'v']);              // Low Street yards (Channel A)
    yard(44, 81, 52, 95, [52, 86, 2, 'v']);
    yard(63, 62, 75, 74, [63, 67, 2, 'v']);
    yard(20, 19, 29, 28, [24, 19, 2, 'h']);              // Canal Lane yards (Channel B)
    yard(41, 19, 50, 28, [45, 19, 2, 'h']);
    // furniture
    box('sofa', 21, 86, 1.3, 0.45, 0, 0.8, { color: '#5a4b3f' }); box('bed', 24.5, 88, 0.6, 1.1, 0, 0.5, { color: '#5b5f6a' });
    box('counter', 70, 85, 2, 0.45, 0, 1.0, { color: '#6b5a44' }); box('aisle', 70, 81, 2.5, 0.4, 0, 1.7, { color: '#9a8a6c' });
    box('sofa', 38.5, 64, 1.3, 0.45, 0, 0.8, { color: '#4b5a52' });
    // debris lines, boats, sandbags, cars half in water
    for (const [x, y, a] of [[27, 72, 0.2], [45, 78.5, 2.9], [66, 58, 1.0], [12, 68, 1.6], [48, 98.5, 0.1], [75, 52, 0.6], [24, 44, 2.2], [52, 40, 0.4]]) box('debris', x, y, 1.6, 0.6, a, 0.3, { solid: false });
    box('boat', 34, 75, 1.5, 0.55, 0.3, 0.5, { solid: false, color: '#9a4a32' });
    box('boat', 72, 47, 1.5, 0.55, 1.9, 0.5, { solid: false, color: '#3a6a7a' });
    for (const [x, y, a] of [[62.5, 66.5, 0], [52.5, 49.5, 0], [41, 7.2, Math.PI / 2], [28.6, 19.2, Math.PI / 2]]) box('sandbags', x, y, 1.6, 0.4, a, 0.85, {});
    for (const [x, y, a, c] of [[48, 74.5, 0.1, '#5e3d3d'], [26, 105.2, 0.05, '#4a4f55'], [11.2, 44, 1.57, '#58534a'], [64, 35.6, 0.1, '#3a4452'], [45, 15.6, 3.1, '#6b4b3b'], [6.8, 82, 1.6, '#3f4d3f'], [60.6, 88, 1.55, '#6a6d70']]) K.car(x, y, a, c);
    // channel signage and sump control boxes
    sign('FLOOD CHANNEL A', 53, 50.2, 'S', 5, '#8cd6ff', '#1d3140', 1.4);
    sign('FLOOD CHANNEL B', 41, 9, 'E', 5, '#8cd6ff', '#1d3140', 1.4);
    W.sumpA = box('panel', CH.A.box.x, CH.A.box.y, 0.35, 0.3, 0, 1.4, { color: '#2f6d8c', label: 'Sump control A' });
    W.sumpB = box('panel', CH.B.box.x, CH.B.box.y, 0.35, 0.3, 0, 1.4, { color: '#2f6d8c', label: 'Sump control B' });
    box('pumpunit', 63.2, 55.5, 1.0, 0.7, Math.PI / 2, 1.2, {}); box('pumpunit', 42.5, 6.6, 1.0, 0.7, 0, 1.2, {});
    box('beacon', 63.2, 53.3, 0.1, 0.1, 0, 3.0, {}); box('beacon', 44.6, 6.6, 0.1, 0.1, 0, 3.0, {});
    // the old evacuation notice still telling everyone to go to Mercer Field
    box('board', 50.5, 98.4, 1.4, 0.12, 0, 2.2, { parts: [[-1.2, 0, 0, 0.08, 0.08, 1.2, '#3a3c40'], [1.2, 0, 0, 0.08, 0.08, 1.2, '#3a3c40'], [0, 0, 1.2, 1.4, 0.06, 1.0, '#c8b878']] });
    sign('EVACUATE TO MERCER FIELD', 49.2, 98.3, 'S', 2.6, '#7a1f1a', '#d8cfa8', 1.4);
    // trees and utility poles
    for (const [x, y] of [[4, 90], [3, 50], [14, 48], [27, 50], [46, 46], [66, 45], [95, 50], [99, 88], [88, 96], [70, 100], [26, 112], [60, 114], [3, 20], [50, 4], [20, 4], [100, 60]]) K.tree(x, y);
    for (const [x, y] of [[13.5, 74], [53.4, 46], [13.5, 30], [53.4, 88], [62.6, 100]]) box('pole', x, y, 0.1, 0.1, 0, 4.6, { parts: [[0, 0, 0, 0.09, 0.09, 4.6, '#4a3a2a'], [0, 0, 4.3, 0.9, 0.06, 0.06, '#3a2a1a']] });
    // lights: two battery work lights near the arrival, station floods when pumps run
    K.lamp(14, 98.4, { r: 6 }); K.lamp(58, 98.4, { r: 6 });
    for (const [x, y] of [[80, 26], [94, 26], [74, 34]]) K.lamp(x, y, { power: 'pumps', col: 'rgba(210,225,255,A)', r: 8.5 });
    for (const [x, y] of [[77, 26], [97, 8], [101, 38]]) W.glows.push({ x, y, r: 3, col: 'rgba(255,170,40,A)', a: 0.24, blink: 1.4, ph: x * 0.1, power: 'pumps', z: 3.1, hole: { x, y, r: 2.5, a: 0.5 } });
    W.glows.push({ x: 63.2, y: 53.3, r: 3.2, col: 'rgba(255,170,40,A)', a: 0.26, blink: 1.6, emitter: 'sumpA', z: 3.1, hole: { x: 63.2, y: 53.3, r: 3, a: 0.55 } });
    W.glows.push({ x: 44.6, y: 6.6, r: 3.2, col: 'rgba(255,170,40,A)', a: 0.26, blink: 1.6, emitter: 'sumpB', z: 3.1, hole: { x: 44.6, y: 6.6, r: 3, a: 0.55 } });
    W.glows.push({ x: 81.2, y: 12.4, r: 2, col: 'rgba(120,220,255,A)', a: 0.18, z: 1.3 });
    // painted edges of the flood channels and debris lines at the old waterline
    for (const [x1, y1, x2, y2] of [[53, 50.6, 62.9, 50.6], [53, 65.4, 62.9, 65.4], [29.6, 8, 29.6, 18.9], [40.4, 8, 40.4, 18.9]]) W.marks.push({ k: 'line', x1, y1, x2, y2, col: 'rgba(120,200,240,0.45)', w: 0.2, dash: [0.8, 0.5] });
    for (let i = 0; i < 26; i++) W.marks.push({ k: 'stain', x: 6 + ((i * 31.7) % 96), y: 20 + ((i * 17.3) % 80), rx: 1.2 + (i % 3) * 0.5, ry: 0.14, a: (i % 5) * 0.4, col: 'rgba(40,32,22,0.45)' });
    W.marks.push({ k: 'text', x: 57.5, y: 49, text: 'A', size: 120, col: 'rgba(140,214,255,0.35)' }, { k: 'text', x: 35, y: 20.5, text: 'B', size: 120, col: 'rgba(140,214,255,0.35)' });
    K.decals(40, 7);
    P('exitSign', 4.8, 98.6, { solid: false, text: 'EXIT', sub: 'MARSH RD', h: 3.2 });
    P('exitSign', 91.6, 3.6, { solid: false, text: 'EXIT', sub: 'NORTH RD', h: 3.2 });
    P('exitSign', 43, 112, { solid: false, text: 'EVAC', sub: 'ON FOOT', h: 2.8, green: true });
    W.glows.push({ x: 40, y: 116.5, r: 3.5, col: 'rgba(90,255,140,A)', a: 0.16, pulse: 6, hole: { x: 40, y: 116, r: 4, a: 0.7 } });

    K.finish();
    W.exits = [
      { id: 'w', name: 'Marsh Road', kind: 'truck', x1: 0, y1: 99.5, x2: 4.5, y2: 106.5, lx: 6, ly: 103, out: [-1, 0] },
      { id: 'n', name: 'North service road', kind: 'truck', x1: 84, y1: 0, x2: 90.9, y2: 4.5, lx: 87, ly: 6, out: [0, -1], prefer: 20 },
      { id: 'foot', name: 'South footpath', kind: 'foot', x1: 39, y1: 114.5, x2: 41.9, y2: 119.9, lx: 40, ly: 112, out: [0, 1] },
    ];
    W.start = { truck: { x: 16, y: 103, ang: 0 }, player: { x: 17.5, y: 100.3 }, aim: -Math.PI / 4 };
    W.reserveEntries = [{ x: 2.5, y: 60.5, name: 'west' }, { x: 2.5, y: 25, name: 'northwest' }, { x: 50, y: 2.5, name: 'north' }, { x: 60, y: 117, name: 'south' }, { x: 100, y: 112, name: 'southeast' }];
    W.landmarks = [
      { id: 'station', name: 'Pump Station', x: 87, y: 22, r: 14 },
      { id: 'control', name: 'Control Room', x: 82, y: 14, r: 4 },
      { id: 'store', name: 'Filter Store', x: 95, y: 32, r: 6 },
      { id: 'willow', name: 'Willow Street', x: 34, y: 75, r: 14 },
      { id: 'hale', name: 'Hale House', x: 21, y: 85, r: 7 },
      { id: 'chA', name: 'Low Street underpass (Channel A)', x: 57.5, y: 58, r: 9 },
      { id: 'chB', name: 'Canal crossing (Channel B)', x: 35, y: 13, r: 9 },
      { id: 'levee', name: 'Levee Road', x: 9, y: 58, r: 8, quiet: true },
    ];
    W.zombieGroups = [
      [48, 65, 2.5, { drifter: 3, runner: 1 }, { tag: 'yardsA', deaf: 0.55 }], [48, 89, 3, { drifter: 3 }, { tag: 'yardsA', deaf: 0.55 }], [69, 68, 3.5, { drifter: 2, clinger: 1 }, { tag: 'yardsA', deaf: 0.55 }],
      [24.5, 23.5, 2.5, { drifter: 3 }, { tag: 'yardsB', deaf: 0.55 }], [45.5, 23.5, 2.5, { drifter: 2, runner: 1 }, { tag: 'yardsB', deaf: 0.55 }],
      [30, 75, 4, { drifter: 2 }, { tag: 'street' }], [44, 103, 4, { drifter: 2 }, { tag: 'marsh' }],
      [84, 32, 5, { drifter: 3, howler: 1 }, { tag: 'station' }], [76, 18, 3, { drifter: 2 }, { tag: 'station' }], [91, 18, 2, { drifter: 1, runner: 1 }, { tag: 'station' }],
      [82, 50, 6, { drifter: 2, runner: 1 }, { tag: 'flats' }], [20, 45, 5, { drifter: 2, clinger: 1 }, { tag: 'flats' }],
      [9, 38, 4, { drifter: 2 }, { tag: 'levee' }], [62, 22, 4, { drifter: 2, clinger: 1 }, { tag: 'canal' }],
    ];
    W.mapTitle = 'LOW FLATS';
    return W;
  };

  const otherOf = (k) => (k === 'A' ? 'B' : 'A');
  const L = (DH.LEVELS[3] = {
    id: 3, key: 'highwater', name: 'High Water', place: 'LOW FLATS, RAIN', short: 'Water for the garage', tag: 'Pump connection and filtration unit',
    build,
    brief: () => 'The garage well is failing. The Low Flats pumping station can feed our line if someone restarts its pumps, and its store has replacement filtration units. Both low crossings are flooded. The pumps drain one channel and flood the other, so decide where the truck crosses before you switch. Pumps are loud. Shallow water slows everyone.',
    meta: () => [['Primary', 'Restart the pumps (control room) + filtration unit (filter store)'], ['Channels', 'A: Low Street underpass · B: Canal Lane crossing'], ['Optional', 'A stranded household on Willow Street'], ['Exits', 'Marsh Road · north service road · south footpath']],
    optionalKeys: [['ada', 'Help the stranded resident'], ['supplies', 'Bring back the household supplies']],
    reserve: 12,
    CH,
    recruitTip: () => 'Get her to the truck.',
    setup(run, rng, story) {
      const G = DH.G;
      G.addItem(run, 'filtration', 'filtration', 96, 33, { spot: 'Replacement filtration unit in the filter store. Heavy: park the truck close.', haulTip: 'Get it to the back of the stopped truck.' });
      G.addItem(run, 'supplies0', 'supplies', 24, 84); G.addItem(run, 'supplies1', 'supplies', 17.6, 88.6);
      const salv = rng.shuffle([[70, 86], [36, 66], [22, 33], [47, 35], [80, 72], [10, 70], [92, 14], [64, 30], [48, 104], [25, 63], [99, 30], [16, 46]]).slice(0, 6);
      salv.forEach((p, i) => G.addItem(run, 'salvage' + i, 'salvage', p[0], p[1]));
      const pk = G.addPickup;
      pk(run, 'weapon', 72, 83.5, { wtype: 'rifle', mag: 6, reserve: 12 });
      pk(run, 'weapon', 84, 15.5, { wtype: 'shotgun', mag: 6, reserve: 12, cabinet: true });
      pk(run, 'repairkit', 98.4, 29.5, { n: 1 });
      pk(run, 'medkit', 69, 87, { n: 1 }); pk(run, 'medkit', 39, 88, { n: 1 });
      pk(run, 'ammo', 23, 66, { atype: 'p9', n: 24 }); pk(run, 'ammo', 46, 32.5, { atype: 'p9', n: 24 }); pk(run, 'ammo', 80, 22.5, { atype: 'r30', n: 6 });
      pk(run, 'noisemaker', rng.pick([[36, 88], [26, 35], [88, 70]])[0], 70, { n: 1 });
      pk(run, 'noisemaker', 18, 99.5, { n: 1 });
      if (!(story && story.milestones && story.milestones.ada)) G.addSurvivor(run, 'ada', 'Ada', 'ada', 19.5, 86.5, { where: 'Hale House', landmark: 'hale', pron: 'her', call: true });
      G.addEmitter(run, { id: 'sumpA', x: 63, y: 56, r: 34, period: 1.0, warmup: 6, kind: 'pump', cueLabel: 'PUMP A', color: 'rgba(255,190,80,1)' });
      G.addEmitter(run, { id: 'sumpB', x: 42.5, y: 8, r: 34, period: 1.0, warmup: 6, kind: 'pump', cueLabel: 'PUMP B', color: 'rgba(255,190,80,1)' });
      G.addEmitter(run, { id: 'main', x: 91, y: 17, r: 22, period: 1.3, warmup: 4, kind: 'pump', cueLabel: 'PUMPS', color: 'rgba(255,190,80,1)' });
    },
    // Switch the pump arrangement. Refuses if the truck is inside the channel that would flood.
    setPumps(run, k) {
      const G = DH.G, other = otherOf(k);
      const g = G.W.gates.find((q) => q.id === other);
      const who = G.gateOccupied(g);
      if (who) { G.msg('The truck is parked in ' + CH[other].short + ' (' + CH[other].name + '). Move it out before flooding it.', 'warn', 4); return false; }
      G.setGate(k, false); G.setGate(other, true);
      const first = !run.flags.pumps;
      run.flags.pumps = true; run.flags.setting = k; run.flags['used' + k] = true;
      run.timers.pumpCd = run.time + 12;
      G.msg(CH[k].short + ' (' + CH[k].name + ') draining. ' + CH[other].short + ' (' + CH[other].name + ') flooding.', 'objective', 4);
      DH.World.stopEmitter('sump' + other);
      DH.World.startEmitter('sump' + k, 45);
      if (first) {
        DH.World.startEmitter('main', 40);
        run.timers.juneAt = run.time + 4;
        G.radio('marta', 'Pressure on our line! That’s water. Now the filters.', 'pumpsOn');
      }
      G.W.version++;
      DH.bus.emit('pumps', k);
      return true;
    },
    interact(run, add, p) {
      const W = DH.G.W, G = DH.G;
      const c = W.panel;
      if (M.dist(p.x, p.y, c.x, c.y) < 2.0) {
        if (!run.flags.pumps) {
          add('pumpA', 'Hold E: Prime pumps, drain A (LOW STREET), flood B', c.x, c.y, -0.3, () => DH.Player.startAction('script', 3, 'Priming pumps (A)', { key: 'setA', hold: true, near: { x: c.x, y: c.y, r: 2.6 } }), { hold: true });
          add('pumpB', 'Hold E: Prime pumps, drain B (CANAL LANE), flood A', c.x, c.y, -0.2, () => DH.Player.startAction('script', 3, 'Priming pumps (B)', { key: 'setB', hold: true, near: { x: c.x, y: c.y, r: 2.6 } }), { hold: true });
        } else {
          const k = otherOf(run.flags.setting), cd = (run.timers.pumpCd || 0) - run.time;
          if (cd > 0) add('pumpSw', 'Pumps settling (' + Math.ceil(cd) + ' s)', c.x, c.y, 0.3, () => {}, { disabled: true });
          else add('pumpSw', 'Hold E: Switch: drain ' + k + ' (' + CH[k].name + '), flood ' + run.flags.setting, c.x, c.y, -0.2, () => DH.Player.startAction('script', 2, 'Switching pumps', { key: 'set' + k, hold: true, near: { x: c.x, y: c.y, r: 2.6 } }), { hold: true });
        }
      }
      for (const k of ['A', 'B']) {
        const b = W['sump' + k];
        if (M.dist(p.x, p.y, b.x, b.y) > 1.9) continue;
        if (!run.flags.pumps) { add('sump' + k, 'Sump control ' + k + ': no pressure (prime at the pump station)', b.x, b.y, 0.3, () => G.msg('Prime the pumps at the station control room first.', 'warn', 2), { disabled: true }); continue; }
        if (run.flags.setting === k) { add('sump' + k, 'Channel ' + k + ' is draining (pumps set to ' + k + ')', b.x, b.y, 0.3, () => {}, { disabled: true }); continue; }
        const cd = (run.timers.pumpCd || 0) - run.time;
        if (cd > 0) add('sump' + k, 'Pumps settling (' + Math.ceil(cd) + ' s)', b.x, b.y, 0.3, () => {}, { disabled: true });
        else add('sump' + k, 'Hold E: Drain channel ' + k + ' here (floods ' + otherOf(k) + ')', b.x, b.y, -0.2, () => DH.Player.startAction('script', 2, 'Switching pumps', { key: 'set' + k, hold: true, near: { x: b.x, y: b.y, r: 2.6 } }), { hold: true });
      }
    },
    highlights(run) {
      const W = DH.G.W, out = [];
      if (!run.flags.pumps) out.push({ x: W.panel.x, y: W.panel.y, r: 0.9, d: 10 });
      if (run.flags.pumps) for (const k of ['A', 'B']) if (run.flags.setting !== k) out.push({ x: W['sump' + k].x, y: W['sump' + k].y, r: 0.7, d: 10, col: '#8cd6ff' });
      return out;
    },
    labels(run) {
      const pp = DH.Player.pos(), out = [];
      for (const k of ['A', 'B']) {
        const c = CH[k];
        if (M.dist(pp.x, pp.y, c.cx, c.cy) > 30) continue;
        const flooded = run.gates[k].on;
        out.push({ x: c.cx, y: c.cy, z: 2.2, text: 'CHANNEL ' + k + ': ' + (flooded ? 'FLOODED (truck cannot cross)' : 'DRY'), col: flooded ? '#8cd6ff' : '#7fe3a0', size: 11 });
      }
      const c = DH.G.W.panel;
      if (M.dist(pp.x, pp.y, c.x, c.y) < 8) out.push({ x: c.x, y: c.y, z: 2.0, text: run.flags.pumps ? 'PUMPS SET: drain ' + run.flags.setting : 'PUMPS OFF: choose A or B', col: '#ffd36a' });
      return out;
    },
    onAction(run, key) {
      if (key === 'setA' || key === 'setB') L.setPumps(run, key.slice(3));
    },
    update(run, dt) {
      const G = DH.G, pp = DH.Player.pos();
      if (run.time > 2) G.radio('marta', 'Pump station is north-east past the rail line. Control room for the pumps, filter store in the yard.', 'intro');
      if (run.time > 12) G.radio('marta', 'Both low crossings are under water. The pumps can only drain one. Pick the one your truck needs.', 'tip');
      const ada = G.findSurvivor(run, 'ada');
      if (ada && !ada.recruited && M.dist(pp.x, pp.y, ada.x, ada.y) < 17) G.radio('ada', 'Hello? Is someone out there? I can’t carry the supplies on my own.', 'adaCall');
      if (ada && ada.recruited) G.radio('ada', 'Ada. Thank you. My kit’s in the bag, I can patch people up.', 'adaJoin');
      if (run.timers.juneAt && run.time > run.timers.juneAt) {
        if (G.radio('june', '...this is June, Harbor Street terminal. Ignore the evac loop. Mercer Field is closed. We have a ferry.', 'june1')) run.timers.june2 = run.time + 8;
      }
      if (run.timers.june2 && run.time > run.timers.june2) { if (G.radio('june', 'We need a relay to reach the outlying groups. If you hear this, find us.', 'june2')) run.timers.wesAt = run.time + 8; }
      if (run.timers.wesAt && run.time > run.timers.wesAt) G.radio('wes', 'I heard her too! My ridge relay could patch her through... if I could get out of this station.', 'wes');
      // pumps: telegraph, then the yards empty toward the running sump
      for (const e of run.emitters) {
        if (!e.on) { e._live = false; e._warn = false; continue; }
        if (e.warm > 0 && !e._warn) {
          e._warn = true;
          if (e.id !== 'main') { G.cue(e.cueLabel, e.x, e.y, 'warn'); G.msg('Sump pump ' + e.id.slice(4) + ' priming. It will be LOUD.', 'warn', 3); }
        }
        if (e.warm <= 0 && !e._live) {
          e._live = true;
          if (e.id === 'sumpA' || e.id === 'sumpB') {
            const tag = e.id === 'sumpA' ? 'yardsA' : 'yardsB';
            const n = DH.World.drawGroup(tag, e.x - 3, e.y + 2, 6);
            if (n) {
              const z = run.zombies.find((q) => q.tag === tag && !q.dead);
              if (z) G.cue('MOVEMENT', z.x, z.y, 'danger');
              G.radio('marta', e.id === 'sumpA' ? 'That pump is loud. Whatever was in the Low Street yards just heard it.' : 'That pump is loud. The Canal Lane yards are stirring.', 'yardWarn' + e.id);
            }
          }
        }
      }
      // rain ripples on open water near the player
      if (DH.FX && Math.random() < dt * 6) { const x = pp.x + (Math.random() - 0.5) * 22, y = pp.y + (Math.random() - 0.5) * 22; if (G.W.isWater(Math.floor(x), Math.floor(y))) DH.FX.ring(x, y, 0.5, 'rgba(170,200,215,1)', 0.6); }
    },
    objectives(run) {
      const G = DH.G, f = run.items.filtration;
      const out = [];
      out.push({ text: run.flags.pumps ? 'Pumps running: Channel ' + run.flags.setting + ' drained' : 'Restart the pumps (pump station control room)', done: !!run.flags.pumps });
      out.push({ text: f.loc === 'truck' ? 'Filtration unit loaded' : f.loc === 'hauled' ? 'Haul the filtration unit to the truck' : 'Recover the filtration unit (filter store)', done: f.loc === 'truck', opt: false });
      const ada = G.findSurvivor(run, 'ada');
      if (ada) out.push({ text: !ada.recruited ? 'Optional: someone is stranded on Willow Street' : ada.state === 'downed' ? 'Ada DOWN: revive (4 s, medkit)' : ada.boarded ? 'Ada in the truck' : 'Ada with you (' + (ada.mode === 'wait' ? 'waiting' : 'following') + ')', done: ada.boarded, fail: ada.state === 'downed', opt: true });
      else out.push({ text: 'Ada is safe at the garage', done: true, opt: true });
      const sup = Object.values(run.items).filter((i) => i.kind === 'supplies' && i.loc !== 'world').length;
      out.push({ text: 'Household supplies: ' + sup + ' / 2', done: sup >= 2, opt: true });
      return out;
    },
    pointer(run) {
      const G = DH.G, f = run.items.filtration, p = run.player;
      if (p.hauling) return { x: run.truck.x, y: run.truck.y, label: 'TRUCK', col: '#ffd36a' };
      if (!run.flags.pumps) return run.discovered.station ? { x: 81.2, y: 13, label: 'PUMPS', col: '#ff8a7a' } : { x: 87, y: 25, label: 'PUMP STATION', col: '#ff8a7a' };
      if (f.loc === 'world') return { x: f.x, y: f.y, label: 'FILTERS', col: '#ff8a7a' };
      return G.exitPointer(run);
    },
    markers(run, dot) {
      if (!run.flags.pumps) dot(81.2, 13, run.discovered.station ? '#ff6b5a' : 'rgba(255,107,90,.8)', 4);
      const f = run.items.filtration; if (f.loc === 'world' && !run.seen.filtration && run.discovered.station) dot(95, 32, 'rgba(255,107,90,.8)', 4);
      dot(64, 51.5, '#8cd6ff', 2.5); dot(42.5, 19.4, '#8cd6ff', 2.5);
    },
    primaryOut: (out, run) => !!(run.flags.pumps && out.got.filtration),
    primaryGot: (run) => !!run.flags.pumps && run.items.filtration.loc === 'truck',
    bonus: (out, run) => (run.flags.pumps ? [{ label: 'Pumps restarted', scrap: DH.T.rewards.pumps }] : []),
    departWarn: 'The pumps have to be running and the filtration unit has to be in the truck. This will be a partial extraction.',
    resultSub(r) { return r.status === 'partial' ? 'Primary objective incomplete: the garage still needs running pumps and a filtration unit.' : r.status === 'failed' ? 'Nothing extracted. No rewards from this run. Your campaign progress is safe.' : 'The garage line has pressure and the filters are on the truck.'; },
    resultRows(run, ev) {
      const R = DH.T.rewards, a = DH.G.findSurvivor(run, 'ada');
      return [
        ['Pumps (primary)', run.flags.pumps ? 'Running, channel ' + run.flags.setting + ' drained +' + R.pumps : 'Not restarted', run.flags.pumps ? 'good' : 'bad'],
        ['Filtration unit (primary)', ev.got.filtration ? 'Recovered +' + R.filtration : 'Missing', ev.got.filtration ? 'good' : 'bad'],
        ['Resident (Ada)', ev.survivorsOut.indexOf('ada') >= 0 ? 'Rescued +' + R.survivor : !a ? 'Already at the garage' : a.recruited ? 'Left behind' : 'Not rescued', ev.survivorsOut.indexOf('ada') >= 0 ? 'good' : a && a.recruited ? 'bad' : ''],
        ['Household supplies', (ev.got.supplies || 0) + (ev.got.supplies ? ' (+' + ev.got.supplies * R.supplies + ')' : ''), ev.got.supplies ? 'good' : ''],
        ['Salvage bundles', ev.salvageOut + (ev.salvageOut ? ' (+' + ev.salvageOut * R.salvage + ')' : ''), ev.salvageOut ? 'good' : ''],
      ];
    },
    outcome(run, ev) {
      const ada = ev.survivorsOut.indexOf('ada') >= 0;
      return { pumps: !!run.flags.pumps, filtration: !!ev.got.filtration, ada, supplies: ev.got.supplies || 0, setting: run.flags.setting || null, optional: { ada, supplies: (ev.got.supplies || 0) >= 2 } };
    },
    hints: {
      start: { kbm: 'Low Flats. The pump station is north-east past the rail line. Both crossings are flooded; the pumps drain one. Follow the red pointer.', touch: 'The pump station is north-east. Both crossings are flooded; the pumps drain one. Follow the red pointer.' },
      primaryGot: { kbm: 'Pumps running and filters loaded. The north service road is right by the station.', touch: 'Pumps running and filters loaded. The north service road is right by the station.' },
    },
    backdropCam: { x: 44, y: 78 },
  });
})();

