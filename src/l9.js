/* DEAD HAUL - Level 9: Quarry Road (island interior quarry: power, a crusher that clears the road, a gantry that doesn't) */
(function () {
  'use strict';
  const DH = window.DH;
  DH.LEVELS = DH.LEVELS || {};
  const M = DH.M;
  const GANTRY = { x1: 44, y1: 45, x2: 50, y2: 60 };

  const build = () => {
    const K = DH.MapKit('quarry', { theme: { dark: 'rgba(22,20,26,0.42)', lamp: 'rgba(255,190,110,A)', lightR: 9, haze: 'rgba(150,140,120,0.22)', wind: true } });
    const { W, MAT, F } = K;
    const { fill, wallLine, clearWall, windows, building, door, sign, P, box, circ } = K;

    fill(0, 0, 119, 119, F.GRASS);
    // ---- the pit: rock walls, a haul road gap to the east, the conveyor gantry to the south ----
    fill(24, 6, 86, 46, F.DIRT);
    wallLine(24, 6, 86, 6, MAT.ROCK); wallLine(24, 6, 24, 46, MAT.ROCK); wallLine(86, 6, 86, 46, MAT.ROCK); wallLine(24, 46, 86, 46, MAT.ROCK);
    for (const [x1, y1, x2, y2] of [[25, 7, 30, 11], [80, 7, 85, 10], [25, 40, 28, 45], [82, 40, 85, 45], [60, 7, 66, 8]]) wallLine(x1, y1, x2, y1, MAT.ROCK), wallLine(x1, y2, x2, y2, MAT.ROCK);
    clearWall(86, 26, 86, 32);
    clearWall(46, 46, 48, 46);
    // everything around the quarry is a cliff drop: only the haul road and the gantry reach the pit
    K.ground(1, 1, 23, 48, F.VOID); K.ground(1, 1, 118, 5, F.VOID); K.ground(87, 1, 118, 25, F.VOID); K.ground(95, 26, 118, 48, F.VOID);
    wallLine(87, 33, 87, 47, MAT.ROCK); wallLine(95, 26, 95, 47, MAT.ROCK); wallLine(87, 25, 95, 25, MAT.ROCK);
    // ---- upper yard, roads ----
    fill(16, 50, 104, 94, F.GRAVEL);
    K.road(56, 62, 61, 119, false);            // entrance road (south exit)
    K.road(16, 74, 100, 79, false);            // yard road
    K.road(88, 26, 94, 79, false);             // haul road (east)
    K.road(62, 26, 87, 32, false);             // haul road into the pit
    fill(54, 96, 63, 118, F.WALK);
    K.paveRoads();
    // the rockfall on the haul road: only the crusher’s loader clears it
    K.gate('rockfall', 'barrier', [[87, 36, 95, 41]], { initial: true, label: 'Rockfall', short: 'Rockfall' });
    for (const [x, y, r] of [[88.5, 37.5, 1.1], [91, 38.5, 1.3], [93.6, 37.2, 1.0], [89.5, 40.2, 0.9], [92.8, 40.4, 1.1]]) box('rock', x, y, r, r, 0, 1.4, { shape: 'circle', r, solid: false, gateShow: 'rockfall', color: '#6a6458' });
    // ---- conveyor gantry: a narrow walkway down into the pit, people only ----
    fill(44, 45, 50, 60, F.METAL);
    wallLine(44, 47, 44, 58, MAT.RAIL); wallLine(50, 47, 50, 58, MAT.RAIL);
    K.truckOnly(44, 45, 50, 59);
    door(null, 45, 46, 4, 'h', { gate: true, label: 'Gantry Gate', color: '#d8a21c', gateH: 2.0, needs: 'power', needsMsg: 'no power (plant house generator)' });
    box('belt', 47, 52, 6, 0.35, Math.PI / 2, 0.9, { solid: false, parts: [[0, 0, 0.7, 6, 0.35, 0.12, '#2a2a2a'], [0, 0.55, 0, 6, 0.08, 0.7, '#c48a1e'], [0, -0.55, 0, 6, 0.08, 0.7, '#c48a1e']] });
    // ---- plant house (generator), crusher, site office, weigh station ----
    const ph = building('Plant House', 'plant', 64, 60, 74, 70, MAT.CORR, F.CONCRETE_IN, '#4a4f53', { ribs: true });
    door('plant', 64, 64, 2, 'v', { label: 'Plant House Door', color: '#5b6670' });
    ph.rooms.push({ name: 'Plant House', x1: 65, y1: 61, x2: 73, y2: 69 });
    W.gen = box('gen', 70, 65, 1.6, 0.9, 0, 1.6, { label: 'Quarry generator', parts: [[0, 0, 0, 1.6, 0.9, 0.25, '#2a2a2a'], [0, 0, 0.25, 1.5, 0.85, 1.2, '#c48a1e'], [-1.2, 0, 1.45, 0.25, 0.25, 0.9, '#3a3a3a']] });
    box('toolbox', 72.5, 61.6, 0.5, 0.3, 0, 1.1, { color: '#a33' });
    sign('QUARRY PLANT', 74, 62, 'E', 6, '#ffd36a', '#2a2d33', 2.8);
    W.crusher = box('crusher', 84, 58, 3.2, 2.4, 0, 5.5, { parts: [[0, 0, 0, 3.2, 2.4, 2.8, '#7a6a4a'], [0, 0, 2.8, 2.2, 1.8, 1.6, '#c48a1e'], [-2.6, 0, 4.4, 1.2, 0.6, 0.4, '#3a3a3a'], [2.2, 0, 1.0, 0.6, 2.6, 1.0, '#2a2a2a']] });
    W.crushCon = box('panel', 78.6, 61.2, 0.35, 0.5, 0, 1.6, { label: 'Crusher controls', color: '#5d6a5e' });
    const off = building('Site Office', 'office', 26, 60, 34, 68, MAT.SIDING, F.LINO, '#3a3f44');
    door('office', 29, 68, 2, 'h', { label: 'Office Door' }); windows(27, 60, 33, 60); windows(34, 62, 34, 66);
    off.rooms.push({ name: 'Site Office', x1: 27, y1: 61, x2: 33, y2: 67 });
    box('counter', 30, 62, 2, 0.4, 0, 1.0, { color: '#6b5a44' }); box('cabinet', 33.4, 65.4, 0.35, 0.6, 0, 1.9, { color: '#5a6064' });
    const ws = building('Weigh Station', 'weigh', 90, 84, 98, 92, MAT.BLOCK, F.LINO, '#3b3f44');
    door('weigh', 90, 87, 2, 'v', { label: 'Weigh Station Door', locked: true, pry: 3, hp: 220, maxHp: 220 });
    windows(98, 86, 98, 90); windows(92, 92, 96, 92);
    ws.rooms.push({ name: 'Weigh Station', x1: 91, y1: 85, x2: 97, y2: 91 });
    box('sofa', 95, 86, 1.0, 0.4, 0, 0.8, { color: '#5a4b3f' }); box('bed', 95.5, 90, 1.0, 0.5, 0, 0.5, {});
    fill(76, 84, 89, 92, F.METAL);             // the weighbridge
    // ---- pit dressing: dump truck, spoil heaps, the mast section on cribbing ----
    box('dumptruck', 66, 18, 3.0, 1.5, 0.3, 3.2, { parts: [[0, 0, 0, 3.0, 1.5, 1.2, '#2a2a2a'], [-0.8, 0, 1.2, 2.2, 1.45, 1.6, '#d8a21c'], [2.2, 0, 1.2, 0.8, 1.3, 1.4, '#c48a1e']] });
    for (const [x, y, r] of [[34, 30, 2.2], [56, 38, 1.8], [72, 26, 1.4], [30, 18, 1.6], [78, 40, 1.4], [52, 12, 1.4]]) box('rock', x, y, r, r, 0, 1.6, { shape: 'circle', r, color: '#7a7262' });
    box('lumber', 40, 22.5, 2.0, 0.6, 0, 0.5, {});
    box('spool', 44, 16, 0.8, 0.8, 0, 1.2, { shape: 'circle', r: 0.8 });
    box('gshed', 38, 12, 2.5, 1.5, 0, 2.4, {});
    // yard dressing
    for (const [x, y, a, c] of [[30, 76.4, 0.05, '#4a4f55'], [72, 77.5, 3.1, '#5e3d3d'], [58.5, 104, 1.6, '#3f5566']]) K.car(x, y, a, c);
    box('forklift', 40, 66, 1.0, 0.55, 0.6, 2.2, { sprR: 1.6 });
    for (const [x, y] of [[22, 56], [38, 86], [70, 88], [100, 60], [20, 88]]) box('pallets', x, y, 0.7, 0.7, (x * 0.1) % 1, 1.0, {});
    for (const [x, y] of [[12, 60], [6, 90], [20, 110], [40, 108], [80, 108], [100, 110], [110, 80], [108, 56]]) K.tree(x, y);
    for (const [x, y] of [[54.4, 70], [54.4, 90], [63, 72.4], [86, 72.4], [96, 50], [40, 72.4]]) K.lamp(x, y);
    for (const [x, y] of [[40, 28], [70, 34]]) K.lamp(x, y, { power: 'power', col: 'rgba(210,225,255,A)', r: 9 });
    W.glows.push({ x: 70, y: 65, r: 1.8, col: 'rgba(255,200,90,A)', a: 0.25, z: 1.4, power: 'power' });
    W.marks.push({ k: 'text', x: 91, y: 50, text: 'HAUL ROAD', size: 60, rot: Math.PI / 2, col: 'rgba(230,220,200,0.3)' });
    W.marks.push({ k: 'hatch', x1: 44, y1: 45, x2: 51, y2: 47, col: 'rgba(230,190,40,0.5)' });
    K.decals(45, 41);
    // map edge
    K.perimeter(MAT.ROCK);
    clearWall(56, 119, 61, 119); clearWall(0, 100, 0, 103);
    P('exitSign', 55, 116, { solid: false, text: 'EXIT', sub: 'ISLAND RD', h: 3.2 });
    P('exitSign', 2.5, 105, { solid: false, text: 'EVAC', sub: 'WOOD TRAIL', h: 2.8, green: true });
    W.glows.push({ x: 1.5, y: 101.5, r: 3.5, col: 'rgba(90,255,140,A)', a: 0.16, pulse: 6, hole: { x: 1.5, y: 101.5, r: 4, a: 0.7 } });

    K.finish();
    W.exits = [
      { id: 's', name: 'Island Road', kind: 'truck', x1: 55.5, y1: 115, x2: 62, y2: 119.9, lx: 58.5, ly: 113, out: [0, 1] },
      { id: 'foot', name: 'Wood trail', kind: 'foot', x1: 0, y1: 99.5, x2: 2.5, y2: 103.5, lx: 4, ly: 101.5, out: [-1, 0] },
    ];
    W.start = { truck: { x: 58.5, y: 110, ang: -Math.PI / 2 }, player: { x: 62, y: 108.5 }, aim: -Math.PI / 2 };
    W.reserveEntries = [{ x: 58.5, y: 117, name: 'Island Road' }, { x: 2.5, y: 70, name: 'west' }, { x: 117, y: 70, name: 'east' }, { x: 2.5, y: 92, name: 'south-west' }];
    W.landmarks = [
      { id: 'pit', name: 'Quarry Pit', x: 55, y: 26, r: 18 },
      { id: 'plant', name: 'Plant House', x: 69, y: 65, r: 6 },
      { id: 'crusher', name: 'Crusher', x: 83, y: 58, r: 6 },
      { id: 'gantry', name: 'Conveyor Gantry', x: 47, y: 54, r: 6 },
      { id: 'weigh', name: 'Weigh Station', x: 94, y: 88, r: 6 },
      { id: 'office', name: 'Site Office', x: 30, y: 64, r: 5 },
    ];
    W.zombieGroups = [
      [40, 26, 3.5, { drifter: 2, brute: 1 }, { tag: 'pit' }], [62, 14, 3.5, { drifter: 3 }, { tag: 'pit' }], [74, 34, 3, { drifter: 2, runner: 1 }, { tag: 'pit' }], [32, 38, 3, { drifter: 2 }, { tag: 'pit' }],
      [38, 80, 3.5, { drifter: 3, shrieker: 1 }, { tag: 'yard' }], [78, 70, 3.5, { drifter: 2, runner: 1 }, { tag: 'yard' }], [66, 86, 3, { drifter: 2 }, { tag: 'yard' }],
      [94, 64, 3, { drifter: 2, clinger: 1 }, { tag: 'haul' }], [58.5, 98, 3, { drifter: 2 }, { tag: 'road' }], [30, 64, 1.2, { drifter: 1 }, { tag: 'office' }],
      [86, 88, 3, { drifter: 2, shrieker: 1 }, { tag: 'weigh' }], [91, 30, 2.5, { drifter: 2 }, { tag: 'east' }],
    ];
    W.mapTitle = 'QUARRY ROAD';
    return W;
  };

  const L = (DH.LEVELS[9] = {
    id: 9, key: 'quarry', name: 'Quarry Road', place: 'ISLAND INTERIOR, LATE AFTERNOON', short: 'Radio mast parts', tag: 'Quarry power, mast section, crusher or gantry',
    build, fuel: 60, par: 330, footOK: false,
    brief: () => 'The island radio mast came down in a storm. The quarry kept a spare mast section and relay cable in the pit. Start the generator in the plant house, then get the parts out. The crusher clears the rockfall on the haul road so the truck can drive in, but it is the loudest machine on the island and shriekers answer it. Or carry the mast up the conveyor gantry by hand: slow and quiet. A family is holed up in the weigh station.',
    meta: () => [['Primary', 'Quarry power (plant house) → mast section + relay cable → out'], ['Routes', 'Run the crusher (loud, clears the haul road) · or haul it up the gantry (quiet, slow)'], ['Optional', 'Family in the weigh station · blasting caps (site office)'], ['Exits', 'Island Road south · wood trail']],
    optionalKeys: [['family', 'Rescue the weigh station family'], ['caps', 'Recover the blasting caps']],
    reserve: 12,
    recruitTip: () => 'Get them to the truck one at a time, or walk them out the wood trail.',
    setup(run, rng, story) {
      const G = DH.G;
      G.addItem(run, 'mast', 'mast', 40, 20, { spot: 'The spare mast section on its cribbing. Heavy.', haulTip: 'Up the gantry to the truck, or bring the truck down the haul road.' });
      G.addItem(run, 'cable', 'cable', 44.2, 17.6, { spot: 'A drum of relay cable by the mast.' });
      G.addItem(run, 'caps', 'caps', 31.5, 62.4);
      G.addItem(run, 'fuel0', 'fuel', 72.6, 68.4); G.addItem(run, 'fuel1', 'fuel', 96, 89.5);
      const salv = rng.shuffle([[30, 66], [40, 60], [66, 62], [96, 56], [100, 76], [22, 82], [70, 40], [36, 14], [78, 12], [60, 30], [86, 100], [30, 100]]).slice(0, 6);
      salv.forEach((p, i) => G.addItem(run, 'salvage' + i, 'salvage', p[0], p[1]));
      const pk = G.addPickup;
      pk(run, 'weapon', 33, 64.6, { wtype: 'rifle', mag: 6, reserve: 12, cabinet: true });
      pk(run, 'weapon', 72, 69, { wtype: 'shotgun', mag: 6, reserve: 12 });
      pk(run, 'ammo', 28, 62, { atype: 'r30', n: 6 }); pk(run, 'ammo', 66, 62, { atype: 'p9', n: 24 }); pk(run, 'ammo', 46, 14, { atype: 'p9', n: 24 }); pk(run, 'ammo', 69, 61.4, { atype: 'shell', n: 6 });
      pk(run, 'medkit', 32, 66.6, { n: 1 }); pk(run, 'medkit', 92, 90.6, { n: 1 });
      pk(run, 'repairkit', 73, 61.4, { n: 1 });
      pk(run, 'noisemaker', 62, 100, { n: 1 }); pk(run, 'noisemaker', rng.pick([[46, 62], [52, 74]])[0], 64, { n: 1 });
      pk(run, 'note', 29.4, 62.6, { key: 'shift', label: 'shift notes', text: 'SHIFT NOTES: rockfall on the haul road again. Run the crusher and the loader clears it in half a minute. Loud as the end of the world. Gantry gate runs off the plant generator. Mast section is on cribbing by the gear shed.' });
      const m = (story && story.milestones) || {};
      if (!m.family) {
        G.addSurvivor(run, 'pia', 'Pia', 'pia', 93.5, 86.4, { locked: true, where: 'Weigh station', landmark: 'weigh', pron: 'her', call: true });
        G.addSurvivor(run, 'sol', 'Sol', 'sol', 95, 88.6, { locked: true, where: 'Weigh station', landmark: 'weigh', pron: 'him', call: true });
      }
      G.addEmitter(run, { id: 'crusher', x: 84, y: 58, r: 55, period: 0.9, warmup: 4, kind: 'machine', cueLabel: 'CRUSHER', color: 'rgba(255,170,60,1)', after: 'crushed' });
    },
    nextStep(run) {
      if (!run.flags.power) return 'power';
      const m = run.items.mast, c = run.items.cable;
      if (m.loc === 'world' || m.loc === 'hauled') return 'mast';
      if (c.loc === 'world') return 'cable';
      return 'out';
    },
    interact(run, add, p) {
      const W = DH.G.W, G = DH.G, Pl = DH.Player;
      const near = (o, r) => M.dist(p.x, p.y, o.x, o.y) < (r || 1.9);
      const act = (key, dur, label, o) => () => Pl.startAction('script', dur, label, { key, hold: true, near: { x: o.x, y: o.y, r: 2.8 } });
      if (near(W.gen, 2.4)) {
        if (run.flags.power) add('gen', 'Quarry generator running', W.gen.x, W.gen.y, 0.6, () => {}, { disabled: true });
        else add('gen', 'Hold E: Prime and start the quarry generator (3 s)', W.gen.x, W.gen.y, -0.4, act('power', 3, 'Starting the generator', W.gen), { hold: true });
      }
      if (near(W.crushCon, 2.0)) {
        const e = G.emitter(run, 'crusher');
        if (!run.flags.power) add('crusher', 'Crusher controls: no power', W.crushCon.x, W.crushCon.y, 0.4, () => G.msg('Start the generator in the plant house first.', 'warn', 2), { disabled: true });
        else if (run.flags.crushed) add('crusher', 'Haul road clear', W.crushCon.x, W.crushCon.y, 0.6, () => {}, { disabled: true });
        else if (e.on) add('crusher', 'Crusher running: ' + Math.ceil(e.t) + ' s', W.crushCon.x, W.crushCon.y, 0.6, () => {}, { disabled: true });
        else add('crusher', 'Hold E: Run the crusher, clear the haul road (VERY LOUD, 30 s)', W.crushCon.x, W.crushCon.y, -0.3, act('crush', 1.5, 'Starting the crusher', W.crushCon), { hold: true });
      }
    },
    highlights(run) {
      const W = DH.G.W, out = [];
      if (!run.flags.power) out.push({ x: W.gen.x, y: W.gen.y, r: 0.9, d: 12 });
      else if (!run.flags.crushed) out.push({ x: W.crushCon.x, y: W.crushCon.y, r: 0.6, d: 10, col: '#ffd36a' });
      return out;
    },
    labels(run) {
      const pp = DH.Player.pos(), W = DH.G.W, out = [];
      if (M.dist(pp.x, pp.y, 91, 38) < 18) out.push({ x: 91, y: 38, z: 2.2, text: run.flags.crushed ? 'HAUL ROAD: CLEAR' : 'ROCKFALL (run the crusher)', col: run.flags.crushed ? '#7fe3a0' : '#ffd36a' });
      if (M.dist(pp.x, pp.y, 47, 52) < 14) out.push({ x: 47, y: 50, z: 1.8, text: run.flags.power ? 'CONVEYOR GANTRY (on foot)' : 'GANTRY GATE: NO POWER', col: '#8cd6ff' });
      if (M.dist(pp.x, pp.y, W.crushCon.x, W.crushCon.y) < 12) out.push({ x: W.crushCon.x, y: W.crushCon.y, z: 2.0, text: 'CRUSHER', col: '#ffd36a' });
      return out;
    },
    onAction(run, key, data) {
      const G = DH.G, Wd = DH.World, W = G.W;
      if (key === 'power' && !run.flags.power) {
        run.flags.power = true; W.version++;
        G.msg('The quarry generator catches. Gantry gate and crusher have power.', 'objective', 3.5);
        G.radio('wes', 'I can hear your generator over the radio hiss. That’s a good sound.', 'power');
      } else if (key === 'crush' && !run.flags.crushing && !run.flags.crushed) {
        run.flags.crushing = true; run.flags.route = 'crusher';
        Wd.startEmitter('crusher', 30);
        G.msg('The crusher is spinning up. Thirty seconds of the loudest noise on the island.', 'warn', 4);
        let n = 0; for (const tg of ['yard', 'haul', 'pit', 'weigh', 'east']) n += Wd.drawGroup(tg, 84, 62, 10);
        if (n) G.cue('MOVEMENT', 70, 70, 'danger');
      } else if (key === 'crushed') {
        run.flags.crushing = false; run.flags.crushed = true;
        G.setGate('rockfall', false);
        G.msg('The loader shoves the rockfall off the haul road. The pit is open to the truck.', 'objective', 4);
        G.radio('june', 'We heard that from the depot. Every shrieker on the island did too.', 'crushed');
      } else if (key === 'pried') {
        const d = W.doors[data.door];
        if (d.label === 'Weigh Station Door') { for (const id of ['pia', 'sol']) { const s = G.findSurvivor(run, id); if (s) { s.locked = false; s.call = false; } } G.radio('pia', 'Pia. This is Sol. We heard the generator and thought we were dreaming.', 'family'); }
      } else if (key === 'note' && data.key === 'shift') G.radio('wes', 'Crusher or gantry. I’d pick quiet, but I’m not the one carrying it.', 'noteShift');
    },
    update(run, dt) {
      const G = DH.G, pp = DH.Player.pos(), p = run.player;
      if (run.time > 2) G.radio('wes', 'The spare mast section is down in the pit. Quarry power first: the generator’s in the plant house.', 'intro');
      if (run.time > 15) G.radio('june', 'Crusher clears the haul road. The gantry is quiet, but you’ll carry it by hand.', 'tip');
      for (const s of run.survivors) if (!s.recruited && s.call && M.dist(pp.x, pp.y, s.x, s.y) < 14) G.radio(s.id === 'sol' ? 'sol' : 'pia', 'In the weigh station! The door’s wedged. Please!', 'callFam');
      // hauling the mast up the gantry is the quiet route
      if (p.hauling && p.haulId === 'mast' && p.x >= GANTRY.x1 && p.x <= GANTRY.x2 && p.y >= GANTRY.y1 && p.y <= GANTRY.y2 && !run.flags.route) run.flags.route = 'gantry';
      // Sol is small enough to ride on Pia's lap: one seat, two people
      const pia = G.findSurvivor(run, 'pia'), sol = G.findSurvivor(run, 'sol');
      if (pia && sol && pia.boarded && sol.recruited && !sol.boarded && sol.state !== 'downed' && DH.Truck.distToHull(sol.x, sol.y) < 4 && Math.abs(run.truck.speed) < 0.6) { sol.boarded = true; sol.path = null; G.msg('Sol squeezes in on Pia’s lap.', 'good', 2.2); }
      if (pia && sol && sol.boarded && !pia.boarded) { sol.boarded = false; const q = G.W.findFreeNear(pia.x + 0.8, pia.y, 0.3, 2.5) || { x: pia.x, y: pia.y }; sol.x = q.x; sol.y = q.y; sol.mode = pia.mode; sol.state = pia.mode === 'wait' ? 'wait' : 'following'; }
      const e = G.emitter(run, 'crusher');
      if (e.on && e.warm <= 0 && DH.FX && Math.random() < dt * 6) DH.FX.vapor(84 + (Math.random() - 0.5) * 6, 58 + (Math.random() - 0.5) * 4, 'rgba(200,190,160,0.18)');
    },
    objectives(run) {
      const G = DH.G, m = run.items.mast, c = run.items.cable, out = [];
      out.push({ text: run.flags.power ? 'Quarry power on' : 'Start the quarry generator (plant house)', done: !!run.flags.power });
      out.push({ text: m.loc === 'truck' ? 'Mast section loaded' : m.loc === 'hauled' ? 'Haul the mast section to the truck' : 'Mast section (pit): gantry by hand, or crusher + haul road', done: m.loc === 'truck', opt: false });
      out.push({ text: c.loc === 'world' ? 'Relay cable (pit, by the mast)' : 'Relay cable carried', done: c.loc !== 'world', opt: false });
      const fam = run.survivors.filter((s) => s.id === 'pia' || s.id === 'sol');
      const safe = fam.filter((s) => s.boarded || s.safe).length;
      out.push({ text: (fam.length ? 'Optional: weigh station family ' + safe + '/2' : 'Pia and Sol are at the depot') + ' · caps ' + (run.items.caps.loc !== 'world' ? '1' : '0') + '/1', done: (!fam.length || safe === 2) && run.items.caps.loc !== 'world', opt: true });
      return out;
    },
    pointer(run) {
      const G = DH.G, W = G.W, p = run.player, st = L.nextStep(run);
      if (st === 'power') return { x: W.gen.x, y: W.gen.y, label: 'GENERATOR', col: '#ff8a7a' };
      if (p.hauling) return { x: run.truck.x, y: run.truck.y, label: 'TRUCK', col: '#ffd36a' };
      if (st === 'mast') return run.discovered.pit ? { x: run.items.mast.x, y: run.items.mast.y, label: 'MAST SECTION', col: '#ff8a7a' } : { x: 47, y: 50, label: 'GANTRY', col: '#ff8a7a' };
      if (st === 'cable') return { x: run.items.cable.x, y: run.items.cable.y, label: 'CABLE', col: '#ff8a7a' };
      return G.exitPointer(run);
    },
    markers(run, dot) {
      const W = DH.G.W;
      dot(W.gen.x, W.gen.y, run.flags.power ? '#7fe3a0' : '#ff6b5a', 3);
      if (run.items.mast.loc === 'world') dot(40, 20, '#ff6b5a', 4);
      dot(91, 38, run.flags.crushed ? '#7fe3a0' : '#ffd36a', 3, true);
    },
    primaryOut: (out, run) => !!run.flags.power && !!out.got.mast && !!out.got.cable,
    primaryGot: (run) => !!run.flags.power && run.items.mast.loc === 'truck' && run.items.cable.loc !== 'world',
    bonus: () => [],
    departWarn: 'The mast section and the relay cable both have to come out, with the quarry powered up. This will be a partial extraction.',
    resultSub(r) { return r.status === 'partial' ? 'No mast. The island radio is still deaf past the ridge.' : r.status === 'failed' ? 'Nothing extracted. No rewards from this run. Your campaign progress is safe.' : 'The mast section rides home on the truck bed.'; },
    resultRows(run, ev) {
      const R = DH.T.rewards;
      const fam = ['pia', 'sol'].filter((id) => ev.survivorsOut.indexOf(id) >= 0).length;
      return [
        ['Quarry power (primary)', run.flags.power ? 'Restored' : 'Dead', run.flags.power ? 'good' : 'bad'],
        ['Mast section (primary)', ev.got.mast ? 'Recovered +' + R.mast : 'Missing', ev.got.mast ? 'good' : 'bad'],
        ['Relay cable (primary)', ev.got.cable ? 'Recovered +' + R.equipment : 'Missing', ev.got.cable ? 'good' : 'bad'],
        ['Route', run.flags.route === 'crusher' ? 'Crusher and haul road (loud)' : run.flags.route === 'gantry' ? 'Gantry by hand (quiet)' : '-'],
        ['Weigh station family', fam + ' / 2' + (fam ? ' (+' + fam * R.survivor + ')' : ''), fam ? 'good' : ''],
        ['Blasting caps', ev.got.caps ? 'Recovered +' + R.caps : 'No', ev.got.caps ? 'good' : ''],
        ['Salvage bundles', ev.salvageOut + (ev.salvageOut ? ' (+' + ev.salvageOut * R.salvage + ')' : ''), ev.salvageOut ? 'good' : ''],
      ];
    },
    outcome(run, ev) {
      const fam = ['pia', 'sol'].filter((id) => ev.survivorsOut.indexOf(id) >= 0).length;
      return { mast: !!ev.got.mast, route: run.flags.route || (run.flags.crushed ? 'crusher' : null), crushed: !!run.flags.crushed, family: fam === 2, optional: { family: fam === 2, caps: !!ev.got.caps } };
    },
    hints: {
      start: { kbm: 'Quarry Road. Generator first (plant house), then the mast in the pit: crusher + haul road, or the gantry on foot.', touch: 'Generator first, then the mast in the pit: crusher + haul road, or the gantry on foot.' },
      primaryGot: { kbm: 'Mast and cable aboard. Drive out on Island Road.', touch: 'Mast and cable aboard. Drive out on Island Road.' },
    },
    backdropCam: { x: 60, y: 60 },
  });
})();
