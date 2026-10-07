/* DEAD HAUL - Level 4: Dead Air (Hollis Ridge communications station) */
(function () {
  'use strict';
  const DH = window.DH;
  DH.LEVELS = DH.LEVELS || {};
  const M = DH.M;

  const build = () => {
    const K = DH.MapKit('deadair', { theme: { dark: 'rgba(6,10,24,0.72)', lamp: 'rgba(255,170,80,A)', lightR: 8.5, flashlight: true, wind: true, haze: 'rgba(40,52,90,0.30)' } });
    const { W, MAT, F } = K;
    const { fill, wallLine, clearWall, windows, building, door, sign, P, box, circ } = K;

    // ---- ground: hillside, cliff drop to the valley (distant town lights) ----
    fill(0, 0, 119, 119, F.GRASS);
    for (let i = 0; i < 60; i++) { const x = 3 + ((i * 37.9) % 100), y = 3 + ((i * 23.3) % 112); fill(Math.floor(x), Math.floor(y), Math.floor(x) + 2 + (i % 4), Math.floor(y) + 1 + (i % 3), F.DIRT); }
    K.ground(102, 0, 119, 119, F.VOID);
    K.ground(50, 113, 101, 119, F.VOID);
    wallLine(101, 0, 101, 112, MAT.RAIL); wallLine(50, 112, 101, 112, MAT.RAIL);
    // switchback road
    K.road(4, 104, 96, 109);                // leg 1 (bottom)
    K.road(14, 86, 98, 91);                 // leg 2
    K.road(12, 66, 62, 71);                 // leg 3 (to the compound gate)
    K.road(76, 26, 82, 46);                 // summit road
    K.paveRoads();
    fill(88, 86, 98, 109, F.ROAD);          // hairpin 1
    fill(12, 66, 22, 91, F.ROAD);           // hairpin 2
    fill(62, 46, 98, 75, F.GRAVEL);         // maintenance compound
    fill(4, 2, 100, 40, F.DIRT);            // summit plateau
    fill(60, 26, 92, 37, F.GRAVEL);         // station parking
    fill(6, 4, 40, 38, F.GRASS); for (const [x, y] of [[10, 8], [22, 6], [30, 16], [16, 22], [34, 32], [8, 30]]) fill(x, y, x + 3, y + 2, F.DIRT);
    // ---- cliffs between the road legs, map edges ----
    wallLine(0, 0, 0, 119, MAT.ROCK); wallLine(0, 0, 100, 0, MAT.ROCK); wallLine(0, 118, 49, 119, MAT.ROCK);
    clearWall(0, 104, 0, 109);
    wallLine(1, 96, 86, 97, MAT.ROCK);      // leg 1 | leg 2
    wallLine(24, 76, 100, 77, MAT.ROCK);    // leg 2 | leg 3 / compound
    wallLine(1, 41, 75, 42, MAT.ROCK); wallLine(83, 41, 100, 42, MAT.ROCK); // plateau edge
    // cable trench: a quiet straight path up the hill (too narrow for the truck)
    for (const [y1, y2] of [[94, 101], [73, 83], [43, 63]]) { fill(44, y1, 45, y2, F.TRENCH); K.truckOnly(44, y1, 45, y2); }
    fill(44, 84, 45, 93, F.TRENCH); fill(44, 64, 45, 72, F.TRENCH); fill(44, 102, 45, 111, F.TRENCH);
    clearWall(44, 96, 45, 97); clearWall(44, 76, 45, 77); clearWall(44, 41, 45, 42);
    fill(44, 112, 45, 119, F.WALK); clearWall(44, 118, 45, 119); K.truckOnly(44, 110, 45, 119);
    fill(46, 50, 61, 51, F.TRENCH); K.truckOnly(46, 50, 61, 51);
    // east maintenance stairs from the plateau down to hairpin 1 (chained at the top)
    fill(99, 40, 100, 85, F.METAL); K.truckOnly(99, 40, 100, 85);
    clearWall(99, 41, 100, 42); clearWall(99, 76, 100, 77);
    door(null, 99, 39, 2, 'h', { gate: true, label: 'Stair Gate', color: '#7a7f84', locked: true, pry: 1.5, hp: 200, maxHp: 200 });
    wallLine(98, 37, 98, 39, MAT.CHAIN); wallLine(98, 39, 98, 40, MAT.CHAIN);
    // ---- maintenance compound ----
    wallLine(62, 46, 98, 46, MAT.CHAIN); wallLine(62, 46, 62, 75, MAT.CHAIN); wallLine(98, 46, 98, 75, MAT.CHAIN);
    clearWall(76, 46, 82, 46);               // north gate (open)
    door(null, 62, 66, 6, 'v', { gate: true, label: 'Compound Gate', color: '#8a8f94', gateH: 2.1, locked: true, lockedMsg: 'Compound Gate: motorized, controlled from the guardhouse', hp: 320, maxHp: 320 });
    clearWall(62, 50, 62, 51);               // pedestrian side gap
    const gh = building('Guardhouse', 'guard', 64, 56, 70, 62, MAT.BLOCK, F.LINO, '#3b3f44');
    door('guard', 70, 58, 2, 'v', { label: 'Guardhouse Door' }); windows(64, 59, 64, 60); windows(66, 56, 68, 56);
    building('Generator Shed', 'genshed', 86, 49, 96, 57, MAT.CORR, F.CONCRETE_IN, '#4a4f53');
    door('genshed', 90, 57, 2, 'h', { label: 'Shed Door', color: '#5b6670' });
    sign('GENERATOR', 86.5, 57, 'S', 4, '#ffd36a', '#2a2d33');
    W.genPanel = box('gen', 91, 52, 1.6, 0.9, 0, 1.6, { parts: [[0, 0, 0, 1.6, 0.9, 0.25, '#2a2a2a'], [0, 0, 0.25, 1.5, 0.85, 1.2, '#c48a1e'], [-1.2, 0, 1.45, 0.25, 0.25, 0.9, '#3a3a3a']] });
    W.gatePanel = box('panel', 65, 61.2, 0.35, 0.3, 0, 1.5, { color: '#5d6a5e', label: 'Gate control' });
    W.paPanel = box('panel', 68.6, 61.2, 0.35, 0.3, 0, 1.5, { color: '#4c5459', label: 'Compound PA' });
    gh.rooms.push({ name: 'Guardhouse', x1: 65, y1: 57, x2: 69, y2: 61 });
    box('van', 90, 66, 2.7, 1.05, 1.5, 2.1, { color: '#5a6064' });
    for (const [x, y] of [[73, 52], [75.5, 52.5], [94, 72]]) box('spool', x, y, 0.8, 0.8, 0, 1.2, { shape: 'circle', r: 0.8 });
    box('tank', 69, 72, 1.3, 1.3, 0, 2.4, { shape: 'circle', r: 1.3, color: '#8a5a2a' });
    box('drum', 95.5, 60, 0.3, 0.3, 0, 0.9, { shape: 'circle', r: 0.3, color: '#7a3a2a' }); box('drum', 95.2, 61, 0.3, 0.3, 0, 0.9, { shape: 'circle', r: 0.3, color: '#3e6a4a' });
    // ---- summit: comms building, tower, dish field, the hut ----
    const cb = building('Hollis Ridge Relay Station', 'station', 46, 10, 66, 24, MAT.CONCRETE, F.LINO, '#2f3438');
    wallLine(56, 11, 56, 17, MAT.INTERIOR); wallLine(47, 18, 65, 18, MAT.INTERIOR);
    door('station', 51, 18, 2, 'h', { label: 'Radio Room Door' });
    door('station', 60, 18, 2, 'h', { label: 'Equipment Room Door' });
    door('station', 55, 24, 2, 'h', { label: 'Station Door', color: '#5b6670' });
    door('station', 46, 20, 2, 'v', { label: 'West Door' });
    door('station', 66, 20, 2, 'v', { label: 'East Door' });
    windows(48, 24, 53, 24); windows(58, 24, 64, 24); windows(46, 12, 46, 16); windows(66, 12, 66, 16);
    cb.rooms.push({ name: 'Radio Room', x1: 47, y1: 11, x2: 55, y2: 17 }, { name: 'Equipment Room', x1: 57, y1: 11, x2: 65, y2: 17 });
    sign('HOLLIS RIDGE RELAY', 47, 24, 'S', 7.5, '#9fd8f0', '#1d3140', 2.7);
    W.radioDesk = box('console', 50.5, 12.4, 1.6, 0.4, 0, 1.1, { color: '#4c5459', label: 'Radio desk' });
    W.bcPanel = box('console', 61, 12.4, 1.4, 0.4, 0, 1.2, { color: '#5a4c3c', label: 'Broadcast rack' });
    box('rack', 64.4, 14, 1.4, 0.35, Math.PI / 2, 2.0, { color: '#3a3f44' }); box('rack', 57.6, 14, 1.4, 0.35, Math.PI / 2, 2.0, { color: '#3a3f44' });
    box('counter', 53, 21, 2, 0.4, 0, 1.0, { color: '#6b6e70' });
    W.tower = box('tower', 78, 14, 1.8, 1.8, 0, 24, { direct: true, sprR: 5, bw: 1.8, fade: true, kOff: 0.5 });
    W.cabinet = box('panel', 78, 17.2, 0.6, 0.35, 0, 1.6, { color: '#5d6a5e', label: 'Relay cabinet' });
    for (const [x, y] of [[74, 10], [82, 10], [74, 18.6], [82, 18.6]]) box('post', x, y, 0.1, 0.1, 0, 1.4, { thin: true });
    for (const [x, y, a] of [[14, 12, 0.6], [28, 9, 1.4], [34, 24, 2.4]]) box('dish', x, y, 0.7, 0.7, a, 5, { sprR: 2.6, dr: 2.4 });
    const hut = building('Dish Hut', 'hut', 10, 28, 18, 36, MAT.BLOCK, F.WOOD, '#3a3530');
    door('hut', 13, 28, 2, 'h', { label: 'Hut Door', locked: true, knock: true, lockedMsg: 'Barricaded from inside' });
    windows(18, 30, 18, 34);
    hut.rooms.push({ name: 'Dish Hut', x1: 11, y1: 29, x2: 17, y2: 35 });
    box('bed', 16, 33.5, 0.6, 1.1, 0, 0.5, { color: '#5b5f6a' }); box('counter', 12, 34.5, 1.2, 0.4, 0, 1.0, { color: '#6b5a44' });
    W.ridgePanel = box('panel', 44.2, 22.6, 0.35, 0.3, 0, 1.5, { color: '#4c5459', label: 'Ridge PA' });
    // loudspeaker poles
    W.hornsLower = box('speaker', 16.5, 84.2, 0.1, 0.1, 0.8, 4.2, {});
    W.hornsDish = box('speaker', 24, 18, 0.1, 0.1, 2.2, 4.4, {});
    W.hornsField = box('speaker', 92, 103.2, 0.1, 0.1, -0.6, 4.2, {});
    box('speaker', 76.6, 12.4, 0.1, 0.1, 2.4, 6.0, {});
    // dressing: rocks, pines, guard rails, cable spools, antenna masts
    for (const [x, y, r] of [[8, 50, 1.2], [30, 60, 1.0], [70, 98, 1.4], [34, 100, 0.9], [90, 80, 1.1], [18, 44, 1.3], [56, 80, 0.9], [96, 30, 1.0], [6, 92, 1.2], [40, 4, 1.1]]) box('rock', x, y, r, r, 0, r, { shape: 'circle', r, color: '#4a4a46' });
    for (const [x, y] of [[4, 60], [10, 46], [26, 54], [52, 60], [58, 34], [6, 80], [30, 80], [60, 82], [72, 100], [20, 100], [36, 112], [8, 114], [92, 4], [40, 36], [6, 20], [70, 4]]) K.tree(x, y);
    wallLine(4, 102, 40, 102, MAT.RAIL); wallLine(50, 102, 86, 102, MAT.RAIL);
    wallLine(26, 84, 40, 84, MAT.RAIL); wallLine(50, 84, 86, 84, MAT.RAIL);
    box('car', 32, 90.7, 2.2, 0.95, 0.06, 1.45, { color: '#4f4f57', wreck: true });
    box('car', 70, 107.4, 2.2, 0.95, 3.0, 1.45, { color: '#5e3d3d', wreck: true });
    box('car', 40, 69.5, 2.2, 0.95, 0.15, 1.45, { color: '#3f5566', wreck: true });
    for (const [x, y] of [[88, 30], [70, 30]]) box('antenna', x, y, 0.3, 0.3, 0, 7, { thin: true, parts: [[0, 0, 0, 0.12, 0.12, 7, '#3a3f44'], [0, 0, 6.6, 0.8, 0.05, 0.05, '#3a3f44']] });
    // lights: station floods on station power; warning beacons; town glow below
    for (const [x, y] of [[56, 26], [70, 34], [86, 34], [80, 47]]) K.lamp(x, y, { power: 'power', col: 'rgba(205,220,255,A)', r: 8.5 });
    K.lamp(8, 102.6, { r: 6 }); K.lamp(66, 64, { r: 6 });
    W.glows.push({ x: 78, y: 14, r: 3, col: 'rgba(255,40,30,A)', a: 0.35, blink: 0.8, z: 27, hole: null });
    W.glows.push({ x: 78, y: 14, r: 2.5, col: 'rgba(255,40,30,A)', a: 0.25, blink: 0.8, ph: 0.5, z: 14 });
    for (const [x, y] of [[14, 12], [28, 9], [34, 24]]) W.glows.push({ x, y, r: 1.8, col: 'rgba(255,50,40,A)', a: 0.25, blink: 0.6, ph: x * 0.07, z: 5.2 });
    W.glows.push({ x: 50.5, y: 12.4, r: 2, col: 'rgba(120,220,255,A)', a: 0.18, z: 1.3, power: 'power' });
    W.glows.push({ x: 91, y: 52, r: 3, col: 'rgba(255,200,90,A)', a: 0.2, emitter: 'gen', z: 1.8, hole: { x: 91, y: 54, r: 3.5, a: 0.5 } });
    for (let i = 0; i < 14; i++) W.glows.push({ x: 104 + (i * 7.3) % 14, y: 10 + (i * 13.7) % 100, r: 3 + (i % 3), col: 'rgba(255,170,90,A)', a: 0.05 + (i % 4) * 0.015, z: -2 });
    W.marks.push({ k: 'hatch', x1: 62.1, y1: 66, x2: 63, y2: 72, col: 'rgba(230,190,40,0.6)' });
    W.marks.push({ k: 'text', x: 79, y: 31, text: 'RELAY', size: 70, col: 'rgba(230,220,200,0.25)' });
    for (const y of [92, 72]) W.marks.push({ k: 'line', x1: 44, y1: y, x2: 46, y2: y, col: 'rgba(230,200,80,0.5)', w: 0.25 });
    K.decals(40, 11);
    P('exitSign', 5, 101.6, { solid: false, text: 'EXIT', sub: 'RIDGE RD', h: 3.2 });
    P('exitSign', 47.5, 113.5, { solid: false, text: 'EVAC', sub: 'ON FOOT', h: 2.8, green: true });
    W.glows.push({ x: 44.5, y: 117, r: 3.5, col: 'rgba(90,255,140,A)', a: 0.16, pulse: 6, hole: { x: 44.5, y: 116.5, r: 4, a: 0.7 } });

    K.finish();
    W.exits = [
      { id: 'w', name: 'Ridge Road', kind: 'truck', x1: 0, y1: 103.5, x2: 4.5, y2: 109.5, lx: 6, ly: 106.5, out: [-1, 0] },
      { id: 'foot', name: 'Trench footpath', kind: 'foot', x1: 43.5, y1: 115, x2: 46, y2: 119.9, lx: 44.5, ly: 112, out: [0, 1] },
    ];
    W.start = { truck: { x: 12, y: 106.5, ang: 0 }, player: { x: 13.5, y: 103.8 }, aim: -Math.PI / 4 };
    W.reserveEntries = [{ x: 3, y: 106.5, name: 'Ridge Road' }, { x: 40, y: 3, name: 'north rim' }, { x: 4, y: 56, name: 'west woods' }, { x: 4, y: 24, name: 'northwest woods' }];
    W.landmarks = [
      { id: 'compound', name: 'Maintenance Compound', x: 80, y: 60, r: 16 },
      { id: 'genshed', name: 'Generator Shed', x: 91, y: 53, r: 6 },
      { id: 'guard', name: 'Guardhouse', x: 67, y: 59, r: 5 },
      { id: 'station', name: 'Relay Station', x: 56, y: 17, r: 13 },
      { id: 'tower', name: 'Radio Tower', x: 78, y: 15, r: 8 },
      { id: 'dish', name: 'Dish Field', x: 22, y: 20, r: 14 },
      { id: 'hut', name: 'Dish Hut', x: 14, y: 32, r: 6 },
      { id: 'trench', name: 'Cable Trench', x: 44.5, y: 88, r: 5 },
      { id: 'stairs', name: 'Maintenance Stairs', x: 99.5, y: 60, r: 6, quiet: true },
    ];
    W.zombieGroups = [
      [64, 106, 5, { drifter: 2 }, { tag: 'leg1' }],
      [54, 88, 6, { drifter: 3, runner: 1 }, { tag: 'leg2' }], [80, 88.5, 4, { drifter: 2, clinger: 1 }, { tag: 'leg2' }],
      [34, 68.5, 5, { drifter: 3, clinger: 1 }, { tag: 'leg3' }],
      [80, 62, 6, { drifter: 3, howler: 1 }, { tag: 'compound' }], [90, 71, 3.5, { drifter: 2, runner: 1 }, { tag: 'compound' }],
      [58, 31, 5, { drifter: 3, runner: 1 }, { tag: 'plateau' }], [74, 22, 3.5, { drifter: 2, howler: 1 }, { tag: 'plateau' }], [66, 38, 3, { drifter: 2 }, { tag: 'plateau' }],
      [23.5, 32, 2.5, { drifter: 3 }, { tag: 'dish' }], [30, 16, 4, { drifter: 2, clinger: 1 }, { tag: 'dish' }],
      [52, 21, 2, { drifter: 1, runner: 1 }, { tag: 'inside' }],
    ];
    W.mapTitle = 'HOLLIS RIDGE';
    return W;
  };

  const L = (DH.LEVELS[4] = {
    id: 4, key: 'deadair', name: 'Dead Air', place: 'HOLLIS RIDGE, WIND', short: 'Restore the relay', tag: 'Ridge relay and contact with the waterfront',
    build,
    brief: () => 'Wes is pinned down at the Hollis Ridge relay. Restore it so June’s waterfront group can reach us. Start the station generator in the compound, seat the relay module at the tower, then call June from the radio room. The switchback road is wide and loud; the cable trench is quiet. Local loudspeakers can pull a crowd where you want it.',
    meta: () => [['Primary', 'Generator (compound) → relay module (tower) → radio call (station)'], ['Routes', 'Switchback road (truck) · cable trench (on foot) · east stairs'], ['Optional', 'Find Wes, the radio operator'], ['Exits', 'Ridge Road · trench footpath']],
    optionalKeys: [['wes', 'Rescue Wes'], ['broadcast', 'Deal with the evac broadcast']],
    reserve: 12,
    recruitTip: () => 'Get him to the truck or out the trench footpath.',
    setup(run, rng, story) {
      const G = DH.G;
      const salv = rng.shuffle([[53, 14.5], [62, 21], [67, 58], [94, 51], [74, 70], [12, 33], [30, 30], [86, 32], [36, 68], [60, 90], [92, 100], [20, 74]]).slice(0, 6);
      salv.forEach((p, i) => G.addItem(run, 'salvage' + i, 'salvage', p[0], p[1]));
      const pk = G.addPickup;
      pk(run, 'weapon', 66.2, 58, { wtype: 'rifle', mag: 6, reserve: 12, cabinet: true });
      pk(run, 'weapon', 63.4, 15.5, { wtype: 'smg', mag: 30, reserve: 60, crate: true });
      pk(run, 'repairkit', 94.5, 55.5, { n: 1 });
      pk(run, 'medkit', 48, 22.5, { n: 1 }); pk(run, 'medkit', 68, 57.4, { n: 1 });
      pk(run, 'ammo', 88, 55.4, { atype: 'p9', n: 24 }); pk(run, 'ammo', 54.5, 22.4, { atype: 'p9', n: 24 }); pk(run, 'ammo', 74, 56, { atype: 'r30', n: 6 });
      pk(run, 'noisemaker', 44.5, 98.5, { n: 1 }); pk(run, 'noisemaker', rng.pick([[47, 52], [44.5, 66]])[0], 52, { n: 1 });
      pk(run, 'note', 53.4, 12.2, { key: 'log', label: 'operator log', text: 'OPERATOR LOG: Evac loop still automated, Mercer Field instructions, recorded in March. Nobody has updated it. Waterfront traffic on 146.52 every night at nine. I can hear them. They can’t hear me. W.' });
      if (!(story && story.milestones && story.milestones.wes)) G.addSurvivor(run, 'wes', 'Wes', 'wes', 14, 32, { locked: true, where: 'Dish Hut', landmark: 'hut', pron: 'him', call: true });
      G.addEmitter(run, { id: 'gen', x: 91, y: 52, r: 20, period: 1.4, warmup: 3, kind: 'generator', cueLabel: 'GENERATOR' });
      G.addEmitter(run, { id: 'lower', x: 16.5, y: 84.2, r: 42, period: 1.2, warmup: 3, kind: 'speaker', cueLabel: 'HORNS', color: 'rgba(255,220,120,1)' });
      G.addEmitter(run, { id: 'dishpa', x: 24, y: 18, r: 40, period: 1.2, warmup: 3, kind: 'speaker', cueLabel: 'HORNS', color: 'rgba(255,220,120,1)' });
      G.addEmitter(run, { id: 'tower', x: 77, y: 13, r: 44, period: 1.1, warmup: 4, kind: 'broadcast', cueLabel: 'BROADCAST', color: 'rgba(255,120,90,1)' });
      G.addEmitter(run, { id: 'field', x: 92, y: 103.2, r: 46, period: 1.1, warmup: 3, kind: 'broadcast', cueLabel: 'BROADCAST', color: 'rgba(255,120,90,1)' });
    },
    nextStep(run) { return !run.flags.power ? 'power' : !run.flags.module ? 'module' : !run.flags.contact ? 'call' : 'out'; },
    interact(run, add, p) {
      const W = DH.G.W, G = DH.G, Pl = DH.Player;
      const near = (o, r) => M.dist(p.x, p.y, o.x, o.y) < (r || 1.9);
      const act = (key, dur, label, o) => () => Pl.startAction('script', dur, label, { key, hold: true, near: { x: o.x, y: o.y, r: 2.6 } });
      if (near(W.genPanel, 2.4)) {
        if (!run.flags.power) add('genstart', 'Hold E: Start the station generator (3 s)', W.genPanel.x, W.genPanel.y, -0.3, act('power', 3, 'Starting generator', W.genPanel), { hold: true });
        else add('genstart', 'Generator running', W.genPanel.x, W.genPanel.y, 0.6, () => {}, { disabled: true });
      }
      if (near(W.cabinet)) {
        if (run.flags.module) add('module', 'Relay module seated', W.cabinet.x, W.cabinet.y, 0.6, () => {}, { disabled: true });
        else if (!run.flags.power) add('module', 'Relay cabinet: no power (start the generator in the compound)', W.cabinet.x, W.cabinet.y, 0.3, () => G.msg('No power. Start the station generator in the maintenance compound.', 'warn', 2.5), { disabled: true });
        else add('module', 'Hold E: Seat the spare relay module (4 s)', W.cabinet.x, W.cabinet.y, -0.3, act('module', 4, 'Seating relay module', W.cabinet), { hold: true });
      }
      if (near(W.radioDesk, 2.1)) {
        if (run.flags.contact) add('call', 'Waterfront contact made', W.radioDesk.x, W.radioDesk.y, 0.6, () => {}, { disabled: true });
        else if (!run.flags.module) add('call', 'Radio desk: relay offline (seat the module at the tower)', W.radioDesk.x, W.radioDesk.y, 0.3, () => G.msg(run.flags.power ? 'The relay is offline. Seat the spare module in the tower cabinet.' : 'No power. Start the station generator first.', 'warn', 2.5), { disabled: true });
        else add('call', 'Hold E: Call the waterfront (2 s)', W.radioDesk.x, W.radioDesk.y, -0.3, act('contact', 2, 'Calling Harbor Street', W.radioDesk), { hold: true });
      }
      if (near(W.bcPanel, 2.1) && run.flags.contact) {
        const t = G.emitter(run, 'tower'), f = G.emitter(run, 'field');
        if (t.on || f.on) {
          add('bcoff', 'Hold E: Shut down the evac broadcast', W.bcPanel.x, W.bcPanel.y, -0.3, act('bcoff', 2, 'Cutting the broadcast', W.bcPanel), { hold: true });
          if (t.on) add('bcroute', 'Hold E: Route the broadcast to the lower field horns', W.bcPanel.x, W.bcPanel.y, -0.2, act('bcroute', 2, 'Re-routing the broadcast', W.bcPanel), { hold: true });
        } else add('bcoff', 'Broadcast silent', W.bcPanel.x, W.bcPanel.y, 0.6, () => {}, { disabled: true });
      }
      const pa = (o, id, label, key) => {
        if (!near(o)) return;
        const e = G.emitter(run, id), cd = (run.timers[id] || 0) - run.time;
        if (e.on) add(key, label + ': playing', o.x, o.y, 0.5, () => {}, { disabled: true });
        else if (cd > 0) add(key, label + ' (amplifier cooling ' + Math.ceil(cd) + ' s)', o.x, o.y, 0.5, () => {}, { disabled: true });
        else add(key, 'Hold E: ' + label + ' (25 s, LOUD)', o.x, o.y, -0.25, act(key, 1, 'Keying the horns', o), { hold: true });
      };
      pa(W.paPanel, 'lower', 'Sound the lower road horns', 'paLower');
      pa(W.ridgePanel, 'dishpa', 'Sound the dish field horns', 'paDish');
      if (near(W.gatePanel)) {
        const gi = W.doors.findIndex((d) => d.label === 'Compound Gate');
        if (run.doors[gi].locked) add('gateopen', 'Hold E: Open the compound vehicle gate (motor, loud)', W.gatePanel.x, W.gatePanel.y, -0.3, act('gate', 1.5, 'Running the gate motor', W.gatePanel), { hold: true });
        else add('gateopen', 'Compound gate open', W.gatePanel.x, W.gatePanel.y, 0.6, () => {}, { disabled: true });
      }
      // the hut: Wes has barricaded himself in
      const hi = W.doors.findIndex((d) => d.label === 'Hut Door');
      const hd = W.doors[hi];
      if (run.doors[hi].locked && M.dist(p.x, p.y, hd.cx, hd.cy) < 2.2 && G.findSurvivor(run, 'wes')) add('knock', 'Knock: tell whoever is inside it’s clear', hd.cx, hd.cy, -0.5, () => L.onAction(run, 'knock'));
    },
    highlights(run) {
      const W = DH.G.W, out = [];
      const st = L.nextStep(run);
      const tgt = st === 'power' ? W.genPanel : st === 'module' ? W.cabinet : st === 'call' ? W.radioDesk : null;
      if (tgt) out.push({ x: tgt.x, y: tgt.y, r: 1.0, d: 12 });
      for (const o of [W.paPanel, W.ridgePanel, W.gatePanel]) out.push({ x: o.x, y: o.y, r: 0.6, d: 9, col: '#8cd6ff' });
      if (run.flags.contact) out.push({ x: W.bcPanel.x, y: W.bcPanel.y, r: 0.8, d: 10, col: '#ff8a7a' });
      return out;
    },
    labels(run) {
      const pp = DH.Player.pos(), W = DH.G.W, out = [];
      const lb = (o, t, c) => { if (M.dist(pp.x, pp.y, o.x, o.y) < 11) out.push({ x: o.x, y: o.y, z: 2.2, text: t, col: c || '#8cd6ff' }); };
      lb(W.paPanel, 'PA: LOWER ROAD'); lb(W.ridgePanel, 'PA: DISH FIELD'); lb(W.gatePanel, 'GATE');
      if (run.flags.contact) lb(W.bcPanel, 'BROADCAST', '#ff8a7a');
      return out;
    },
    onAction(run, key, data) {
      const G = DH.G, Wd = DH.World, W = G.W;
      if (key === 'power' && !run.flags.power) {
        run.flags.power = true; Wd.startEmitter('gen', 0);
        G.msg('Station power on. The relay cabinet at the tower is live.', 'objective', 3.5);
        G.radio('wes', 'Lights! I can see the lights from here. Tower next: the spare module is in the cabinet.', 'power');
      } else if (key === 'module' && !run.flags.module) {
        run.flags.module = true;
        G.emitNoise(W.cabinet.x, W.cabinet.y, 14, 'bang', 1);
        G.msg('Relay module seated. Call the waterfront from the radio room.', 'objective', 3.5);
        G.radio('wes', 'Module’s seated. Radio room, go. Desk on the left.', 'module');
      } else if (key === 'contact' && !run.flags.contact) {
        run.flags.contact = true; run.timers.reveal = run.time;
        G.radio('june', 'Kettle Creek? This is June at Harbor Street. We hear you. Finally.', 'june1');
        Wd.startEmitter('tower', 0);
        run.timers.bcAt = run.time + 4;
        DH.bus.emit('contact');
      } else if (key === 'bcoff') {
        Wd.stopEmitter('tower'); Wd.stopEmitter('field');
        run.flags.broadcast = 'off';
        G.msg('Evac broadcast silenced.', 'good', 2.5);
        G.radio('wes', 'Thank you. If I hear “proceed calmly to Mercer Field” one more time...', 'bcoff');
      } else if (key === 'bcroute') {
        Wd.stopEmitter('tower'); Wd.startEmitter('field', 0);
        run.flags.broadcast = 'routed';
        G.msg('Broadcast routed to the lower field horns. The dead will head down the hill.', 'good', 3);
        DH.World.drawGroup('plateau', 92, 100, 8); DH.World.drawGroup('compound', 92, 100, 8);
      } else if (key === 'paLower') {
        Wd.startEmitter('lower', 25); run.timers.lower = run.time + 55;
        G.msg('Lower road horns sounding.', 'info', 2);
      } else if (key === 'paDish') {
        Wd.startEmitter('dishpa', 25); run.timers.dishpa = run.time + 55;
        G.msg('Dish field horns sounding.', 'info', 2);
        const w = G.findSurvivor(run, 'wes'); if (w && w.locked) G.radio('wes', 'Hey! Those horns are right outside my hut!', 'dishpaWes');
      } else if (key === 'gate') {
        const gi = W.doors.findIndex((d) => d.label === 'Compound Gate');
        run.doors[gi].locked = false; run.doors[gi].open = true; W.doors[gi].locked = false; W.doors[gi].open = true; W.version++;
        G.emitNoise(62.5, 69, 18, 'machine', 2.5); DH.bus.emit('shutter', true, 62.5, 69);
        G.msg('The compound gate grinds open.', 'info', 2.5);
      } else if (key === 'knock') {
        const w = G.findSurvivor(run, 'wes'); if (!w) return;
        const close = run.zombies.filter((z) => !z.dead && M.dist(z.x, z.y, 14, 27) < 7).length;
        if (close) { G.radio('wes', 'Not with them right outside! Clear the door first.', null, 3); return; }
        const hi = W.doors.findIndex((d) => d.label === 'Hut Door');
        run.doors[hi].locked = false; run.doors[hi].open = true; W.doors[hi].locked = false; W.doors[hi].open = true; W.version++;
        w.locked = false; w.call = false;
        G.radio('wes', 'Oh thank god. Wes. I’ve been talking to satellite dishes for three weeks.', 'wesFree');
      } else if (key === 'note' && data.key === 'log') {
        G.msg('146.52 every night at nine. Someone kept listening.', 'info', 3);
      }
    },
    update(run, dt) {
      const G = DH.G, pp = DH.Player.pos();
      const w = G.findSurvivor(run, 'wes');
      if (run.time > 2) G.radio(w ? 'wes' : 'marta', w ? 'You came! Generator shed is in the compound, relay module at the tower, then the radio room. I’m in the dish hut. No rush. Some rush.' : 'Generator in the compound, module at the tower, then the radio room. Wes is back at the garage, so you’re on your own up there.', 'intro');
      if (run.time > 14) G.radio('marta', 'The road up is wide and every leg can hear the engine. The cable trench goes straight up on foot.', 'tip');
      if (w && w.locked && M.dist(pp.x, pp.y, 14, 30) < 22) G.radio('wes', 'I can see you! I’m in the hut. The door is barricaded, knock when it’s clear.', 'wesSee');
      if (run.timers.bcAt && run.time > run.timers.bcAt) {
        if (G.radio('june', 'That evac loop has been lying since spring. We run our own crossing now, to the island depot.', 'june2')) { run.timers.bcMsg = run.time + 1; run.timers.june3 = run.time + 9; }
      }
      if (run.timers.bcMsg && run.time > run.timers.bcMsg) {
        if (G.radio('wes', 'That’s the old evac loop on the tower horns! Kill it in the equipment room, or route it down to the field horns.', 'bc')) { G.msg('“ATTENTION. PROCEED CALMLY TO MERCER FIELD EVACUATION CENTER.”', 'warn', 5); G.cue('BROADCAST', 77, 13, 'danger'); }
      }
      if (run.timers.june3 && run.time > run.timers.june3) G.radio('june', 'Our ferry runs. The ramp and the access lane don’t. We’ll talk when you’re off that hill.', 'june3');
      // the broadcast draws everything on the plateau and in the compound up toward the tower
      const t = G.emitter(run, 'tower');
      if (t.on && t.warm <= 0 && !run.flags.bcDrawn) { run.flags.bcDrawn = true; DH.World.drawGroup('plateau', 77, 18, 8); DH.World.drawGroup('compound', 79, 30, 8); DH.World.drawGroup('dish', 60, 26, 8); G.cue('MOVEMENT', 80, 60, 'danger'); }
      if (!run.flags.broadcast && run.flags.contact && !t.on && !G.emitter(run, 'field').on) run.flags.broadcast = 'off';
      // loudspeakers pull groups toward the horns
      for (const [id, tags] of [['lower', ['compound', 'leg3', 'leg2']], ['dishpa', ['plateau', 'inside']]]) {
        const e = G.emitter(run, id);
        if (e.on && e.warm <= 0 && !e._drawn) { e._drawn = true; let n = 0; for (const tg of tags) n += DH.World.drawGroup(tg, e.x, e.y + 1, 7); if (n) G.cue('MOVEMENT', e.x, e.y, 'warn'); }
        if (!e.on) e._drawn = false;
      }
    },
    objectives(run) {
      const G = DH.G, out = [];
      out.push({ text: run.flags.power ? 'Station generator running' : 'Start the station generator (maintenance compound)', done: !!run.flags.power });
      out.push({ text: run.flags.module ? 'Relay module seated' : 'Seat the relay module (tower cabinet)', done: !!run.flags.module, opt: false });
      out.push({ text: run.flags.contact ? 'Contact made. ' + (G.emitter(run, 'tower').on ? 'Broadcast blaring: kill or reroute it, or leave' : 'Get out') : 'Call the waterfront (radio room)', done: !!run.flags.contact, opt: false });
      const w = G.findSurvivor(run, 'wes');
      if (w) out.push({ text: w.locked ? 'Optional: find Wes (dish field)' : !w.recruited ? 'Optional: recruit Wes' : w.state === 'downed' ? 'Wes DOWN: revive (4 s, medkit)' : w.boarded ? 'Wes in the truck' : 'Wes with you (' + (w.mode === 'wait' ? 'waiting' : 'following') + ')', done: w.boarded, fail: w.state === 'downed', opt: true });
      else out.push({ text: 'Wes is safe at the garage', done: true, opt: true });
      return out;
    },
    pointer(run) {
      const W = DH.G.W, st = L.nextStep(run);
      if (st === 'power') return { x: W.genPanel.x, y: W.genPanel.y, label: 'GENERATOR', col: '#ff8a7a' };
      if (st === 'module') return { x: W.cabinet.x, y: W.cabinet.y, label: 'RELAY', col: '#ff8a7a' };
      if (st === 'call') return { x: W.radioDesk.x, y: W.radioDesk.y, label: 'RADIO', col: '#ff8a7a' };
      return DH.G.exitPointer(run);
    },
    markers(run, dot) {
      const W = DH.G.W, st = L.nextStep(run);
      const tgt = st === 'power' ? W.genPanel : st === 'module' ? W.cabinet : st === 'call' ? W.radioDesk : null;
      if (tgt) dot(tgt.x, tgt.y, '#ff6b5a', 4);
      for (const o of [W.paPanel, W.ridgePanel]) dot(o.x, o.y, '#8cd6ff', 2.5);
    },
    primaryOut: (out, run) => !!run.flags.contact,
    primaryGot: (run) => !!run.flags.contact,
    bonus: (out, run) => (run.flags.contact ? [{ label: 'Relay restored', scrap: DH.T.rewards.relay }] : []),
    departWarn: 'The relay has not reached the waterfront yet. This will be a partial extraction.',
    resultSub(r) { return r.status === 'partial' ? 'Primary objective incomplete: the waterfront is still out of reach.' : r.status === 'failed' ? 'Nothing extracted. No rewards from this run. Your campaign progress is safe.' : 'Hollis Ridge relay is live. Kettle Creek can talk to the waterfront.'; },
    resultRows(run, ev) {
      const R = DH.T.rewards, w = DH.G.findSurvivor(run, 'wes');
      const bc = run.flags.broadcast === 'off' ? 'Shut down' : run.flags.broadcast === 'routed' ? 'Sent down the hill' : run.flags.contact ? 'Still blaring' : 'Never started';
      return [
        ['Relay contact (primary)', run.flags.contact ? 'Made +' + R.relay : 'Not made', run.flags.contact ? 'good' : 'bad'],
        ['Radio operator (Wes)', ev.survivorsOut.indexOf('wes') >= 0 ? 'Rescued +' + R.survivor : !w ? 'Already at the garage' : w.recruited ? 'Left behind' : 'Stayed at the ridge', ev.survivorsOut.indexOf('wes') >= 0 ? 'good' : w && w.recruited ? 'bad' : ''],
        ['Evac broadcast', bc],
        ['Salvage bundles', ev.salvageOut + (ev.salvageOut ? ' (+' + ev.salvageOut * R.salvage + ')' : ''), ev.salvageOut ? 'good' : ''],
      ];
    },
    outcome(run, ev) {
      const wes = ev.survivorsOut.indexOf('wes') >= 0;
      const bc = run.flags.broadcast || (run.flags.contact ? 'left' : null);
      return { contact: !!run.flags.contact, wes, broadcast: bc, optional: { wes, broadcast: bc === 'off' || bc === 'routed' } };
    },
    hints: {
      start: { kbm: 'Hollis Ridge. Generator in the compound, module at the tower, call from the radio room. The cable trench is a quiet way up. Follow the red pointer.', touch: 'Generator, tower, radio room. The cable trench is a quiet way up. Follow the red pointer.' },
      primaryGot: { kbm: 'Contact made. Get off the ridge: the switchbacks, the trench, or the east stairs (chained at the top).', touch: 'Contact made. Get off the ridge: the switchbacks, the trench, or the east stairs.' },
    },
    backdropCam: { x: 62, y: 30 },
  });
})();
