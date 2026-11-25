/* DEAD HAUL - Level 10: Long Haul (Kettle Creek to the Harbor Street ferry in two trucks) */
(function () {
  'use strict';
  const DH = window.DH;
  DH.LEVELS = DH.LEVELS || {};
  const M = DH.M;
  const GEAR = ['generator', 'assembly', 'filtration'];

  const build = () => {
    const K = DH.MapKit('longhaul', { theme: { dark: 'rgba(24,16,30,0.5)', lamp: 'rgba(255,180,100,A)', lightR: 8.5, haze: 'rgba(200,120,90,0.16)' } });
    const { W, MAT, F } = K;
    const { fill, wallLine, clearWall, windows, building, door, sign, P, box, circ } = K;
    W.hasWater = true;

    fill(0, 0, 119, 119, F.GRASS);
    // ---- the harbour to the north: sea, quay, the ferry waiting with its ramp down ----
    K.ground(0, 0, 119, 13, F.SEA);
    fill(0, 14, 119, 24, F.QUAY);
    W.ferry = box('ferry', 60, 6, 4.5, 7, 0, 7, { direct: true, solid: false, sprR: 10, fade: false, segDef: [60, -1, 60, 13], segAlways: true, segBias: -0.5 });
    W.ramp = box('ramp', 60, 16.5, 2.5, 3, 0, 0.3, { direct: true, solid: false, fade: false, pri: 0.05, kOff: -3 });
    for (let x = 2; x < 118; x += 6) if (x < 54 || x > 66) box('mooring', x + 0.5, 14.4, 0.25, 0.25, 0, 0.7, {});
    // ---- roads: Main Street, three ways north, the harbour approach ----
    K.road(4, 84, 116, 89, false);             // Main Street (Kettle Creek)
    K.road(8, 26, 14, 84, false);              // Low Street (west)
    K.road(54, 26, 60, 84, false);             // Quarry Cut (centre)
    K.road(100, 26, 106, 84, false);           // Ridge Road (east)
    K.road(4, 26, 116, 31, false);             // harbour approach
    K.road(57, 14, 63, 26, false);             // ramp lane
    fill(4, 82, 116, 83, F.WALK); fill(4, 90, 116, 91, F.WALK); fill(4, 32, 116, 33, F.WALK);
    fill(8, 44, 14, 60, F.WATER);              // Low Street dips under the creek
    K.paveRoads();
    fill(8, 44, 14, 60, F.WATER);
    // ---- the ridge between town and harbour: only the three roads cross it ----
    K.ground(1, 42, 6, 62, F.VOID); K.ground(16, 42, 52, 62, F.VOID); K.ground(62, 42, 98, 62, F.VOID); K.ground(108, 42, 118, 62, F.VOID);
    for (const x of [7, 15, 53, 61, 99, 107]) wallLine(x, 42, x, 62, MAT.ROCK);
    K.gate('lowst', 'flood', [[8, 44, 14, 60]], { initial: true, label: 'Low Street flood', short: 'Low Street' });
    K.gate('cut', 'barrier', [[54, 48, 60, 54]], { initial: true, label: 'Quarry Cut rubble', short: 'Rubble' });
    for (const [x, y, r] of [[55, 49.5, 1.1], [57.5, 51, 1.4], [59.2, 49.4, 0.9], [55.8, 53, 1.0], [58.6, 53.3, 1.1]]) box('rock', x, y, r, r, 0, 1.4, { shape: 'circle', r, solid: false, gateShow: 'cut', color: '#7a7262' });
    // ---- Kettle Creek: the garage, its yard, the clinic house and the radio shack ----
    fill(28, 92, 84, 117, F.LOT);
    const gar = building('Kettle Creek Garage', 'garage', 46, 96, 66, 108, MAT.BRICK, F.CONCRETE_IN, '#4a3a32', { ribs: false });
    clearWall(52, 96, 59, 96);
    sign('KETTLE CREEK GARAGE', 66, 99, 'E', 9, '#f2c14e', '#2a2d33', 2.8);
    gar.rooms.push({ name: 'Garage bay', x1: 47, y1: 97, x2: 65, y2: 107 });
    box('lift', 51, 103, 1.2, 0.5, 1.57, 0.4, {}); box('toolbox', 63.6, 98.6, 0.5, 0.3, 0, 1.1, { color: '#a33' }); box('counter', 62, 106.4, 2, 0.4, 0, 1.0, { color: '#6b6e70' });
    const cl = building('Clinic House', 'clinic', 8, 94, 18, 104, MAT.CREAM, F.LINO, '#5a3e30');
    door('clinic', 18, 98, 2, 'v', { label: 'Clinic Door' }); windows(10, 104, 16, 104); windows(8, 96, 8, 102);
    cl.rooms.push({ name: 'Clinic House', x1: 9, y1: 95, x2: 17, y2: 103 });
    box('bed', 11, 97, 1.0, 0.5, 0, 0.5, {}); box('bed', 11, 101, 1.0, 0.5, 0, 0.5, {});
    const rs = building('Radio Shack', 'shack', 92, 96, 100, 104, MAT.SIDING, F.WOOD, '#3c3430');
    door('shack', 92, 99, 2, 'v', { label: 'Shack Door' }); windows(94, 104, 98, 104);
    rs.rooms.push({ name: 'Radio Shack', x1: 93, y1: 97, x2: 99, y2: 103 });
    box('dish', 96, 95, 0.6, 0.6, 0, 2.2, { parts: [[0, 0, 0, 0.15, 0.15, 2.0, '#555'], [0, 0, 2.0, 0.7, 0.7, 0.1, '#b9bec2']] });
    // town houses along Main Street
    for (const [x1, y1, x2, y2, c] of [[22, 72, 30, 80, MAT.SIDING], [34, 72, 44, 80, MAT.BRICK], [68, 72, 78, 80, MAT.STUCCO], [84, 72, 94, 80, MAT.SIDING], [86, 106, 96, 114, MAT.BRICK]]) building('House', 'h' + x1, x1, y1, x2, y2, c, F.WOOD, '#4a3e36');
    // the harbour row
    const mk = building('Fish Market', 'market', 20, 34, 38, 40, MAT.WETSIDING, F.CONCRETE_IN, '#3a4a52');
    door('market', 28, 34, 2, 'h', { label: 'Market Door' }); mk.rooms.push({ name: 'Fish Market', x1: 21, y1: 35, x2: 37, y2: 39 });
    building('Ferry Office', 'fo', 72, 34, 84, 40, MAT.CONCRETE, F.LINO, '#2f3438');
    // dressing
    for (const [x, y, a, c] of [[20, 86.2, 0.05, '#4a4f55'], [86, 87.4, 3.1, '#5e3d3d'], [30, 28.4, 0.05, '#3f5566'], [88, 29.6, 3.1, '#58534a'], [11, 70, 1.6, '#6b4b3b'], [100.9, 74, 1.57, '#4a4f55']]) K.car(x, y, a, c);
    box('van', 104.6, 38, 2.7, 1.0, 1.57, 2.1, { color: '#e2e0d8' });
    for (const [x, y] of [[26, 66], [40, 66], [70, 66], [90, 66], [24, 20], [90, 20], [112, 96], [6, 110], [110, 70], [76, 112]]) K.tree(x, y);
    for (const [x, y] of [[20, 82.4], [40, 82.4], [70, 82.4], [96, 82.4], [16, 60], [58.4, 66], [98.4, 66], [30, 32.4], [80, 32.4], [56, 22], [64, 22]]) K.lamp(x, y);
    box('tank', 111, 70, 1.4, 1.4, 0, 3.0, { shape: 'circle', r: 1.4, color: '#5d7f93' });
    W.glows.push({ x: 60, y: 2, r: 4, col: 'rgba(255,230,180,A)', a: 0.2, z: 7 });
    W.marks.push({ k: 'text', x: 105, y: 72, text: 'RIDGE RD', size: 60, rot: Math.PI / 2, col: 'rgba(230,220,200,0.3)' });
    W.marks.push({ k: 'text', x: 59, y: 72, text: 'QUARRY CUT', size: 60, rot: Math.PI / 2, col: 'rgba(230,220,200,0.3)' });
    W.marks.push({ k: 'text', x: 13, y: 72, text: 'LOW ST', size: 60, rot: Math.PI / 2, col: 'rgba(230,220,200,0.3)' });
    W.marks.push({ k: 'hatch', x1: 57, y1: 19, x2: 64, y2: 21, col: 'rgba(230,190,40,0.6)' });
    K.decals(50, 51);
    // map edge (land side)
    wallLine(0, 14, 0, 119, MAT.BARRICADE); wallLine(0, 119, 119, 119, MAT.BARRICADE); wallLine(119, 14, 119, 119, MAT.BARRICADE);
    clearWall(0, 18, 0, 21);
    P('exitSign', 2.5, 22.5, { solid: false, text: 'EVAC', sub: 'SEAWALL', h: 2.8, green: true });
    W.glows.push({ x: 1.5, y: 19.5, r: 3.5, col: 'rgba(90,255,140,A)', a: 0.16, pulse: 6, hole: { x: 1.5, y: 19.5, r: 4, a: 0.7 } });

    K.finish();
    W.exits = [
      { id: 'ferry', name: 'Ferry Ramp', kind: 'ferry', x1: 57, y1: 14, x2: 63.9, y2: 19.5, lx: 60, ly: 22, out: [0, -1], prefer: 60 },
      { id: 'foot', name: 'Seawall', kind: 'foot', x1: 0, y1: 17.5, x2: 2.5, y2: 21.5, lx: 4, ly: 19.5, out: [-1, 0] },
    ];
    W.ferryPath = [[60, 18.5], [60, 14.5], [60, 10.5], [60, 7.5]];
    W.start = { truck: { x: 36, y: 104, ang: -Math.PI / 2 }, player: { x: 32.5, y: 103 }, aim: -Math.PI / 2 };
    W.reserveEntries = [{ x: 2.5, y: 86.5, name: 'west' }, { x: 116, y: 86.5, name: 'east' }, { x: 60, y: 117, name: 'south' }, { x: 116, y: 28.5, name: 'harbour east' }];
    W.landmarks = [
      { id: 'garage', name: 'Kettle Creek Garage', x: 56, y: 102, r: 12 },
      { id: 'clinic', name: 'Clinic House', x: 13, y: 99, r: 6 },
      { id: 'shack', name: 'Radio Shack', x: 96, y: 100, r: 6 },
      { id: 'lowst', name: 'Low Street', x: 11, y: 52, r: 8 },
      { id: 'cut', name: 'Quarry Cut', x: 57, y: 52, r: 8 },
      { id: 'ridge', name: 'Ridge Road', x: 103, y: 52, r: 10 },
      { id: 'harbour', name: 'Harbor Street', x: 60, y: 26, r: 14 },
    ];
    W.zombieGroups = [
      [70, 86.5, 3, { drifter: 3 }, { tag: 'town' }], [24, 86.5, 3, { drifter: 2, runner: 1 }, { tag: 'town' }], [96, 88, 3, { drifter: 2, shrieker: 1 }, { tag: 'town' }],
      [11, 52, 3, { sleeper: 3 }, { tag: 'lowst' }], [11, 34, 3, { drifter: 2 }, { tag: 'lowst' }],
      [57, 64, 3, { drifter: 3 }, { tag: 'cut' }], [57, 38, 3, { drifter: 2, runner: 1 }, { tag: 'cut' }],
      [103, 66, 2.5, { brute: 1, drifter: 2 }, { tag: 'ridge' }], [103, 48, 2.5, { brute: 1, drifter: 1 }, { tag: 'ridge' }], [103, 36, 3, { drifter: 2, clinger: 1 }, { tag: 'ridge' }],
      [40, 28.5, 3, { drifter: 3 }, { tag: 'harbour' }], [80, 28.5, 3, { drifter: 2, runner: 1 }, { tag: 'harbour' }], [60, 22, 2.5, { drifter: 2 }, { tag: 'harbour' }],
      [30, 37, 2, { drifter: 2 }, { tag: 'market' }],
    ];
    W.mapTitle = 'KETTLE CREEK TO HARBOR STREET';
    return W;
  };

  const gearOut = (out) => GEAR.filter((k) => out.got[k]);

  const L = (DH.LEVELS[10] = {
    id: 10, key: 'longhaul', name: 'Long Haul', place: 'KETTLE CREEK, LAST LIGHT', short: 'Two trucks to the ferry', tag: 'Convoy: equipment, holdouts, the last crossing',
    build, fuel: 70, par: 420, footOK: false,
    brief: (st) => {
      const o = (st && st.outcomes) || {};
      const low = o[3] && o[3].setting === 'A', cut = o[9] && (o[9].crushed || o[9].route === 'crusher');
      return 'Kettle Creek is moving to the island. Load the garage’s equipment (generator, clinic cooler, water filters) across both truck beds and lead the convoy to the Harbor Street ferry. The second truck follows your tracks. Three roads cross the ridge: Low Street ' + (low ? 'is dry since you drained it' : 'is under the creek') + ', the Quarry Cut ' + (cut ? 'is clear since you ran the crusher' : 'is buried in rubble') + ', and the Ridge Road is always open, and always watched. Rosa and Eli are still in town.';
    },
    meta: () => [['Primary', 'Your truck aboard the ferry with garage equipment'], ['Convoy', 'The second truck follows your tracks: lead it, clear its path'], ['Routes', 'Low Street · Quarry Cut · Ridge Road (open roads depend on earlier missions)'], ['Optional', 'Both trucks board · Rosa and Eli ride with the convoy'], ['Exits', 'Ferry ramp · seawall']],
    optionalKeys: [['convoy', 'Both trucks aboard'], ['holdouts', 'Rosa and Eli leave with the convoy']],
    reserve: 14,
    recruitTip: () => 'Walk them to the second truck; there’s room in its cab for two.',
    setup(run, rng, story) {
      const G = DH.G, W = G.W;
      const o = (story && story.outcomes) || {}, m = (story && story.milestones) || {};
      run.flags.rampDown = true;
      // route events from the earlier missions
      if (o[3] && o[3].setting === 'A') run.gates.lowst.on = false;
      if (o[9] && (o[9].crushed || o[9].route === 'crusher')) run.gates.cut.on = false;
      run.flags.lowOpen = !run.gates.lowst.on; run.flags.cutOpen = !run.gates.cut.on;
      G.addItem(run, 'generator', 'generator', 38, 95.5, { spot: 'The garage generator. Heavy.', known: true });
      G.addItem(run, 'assembly', 'assembly', 72, 96, { spot: 'The clinic cooler. Heavy.', known: true });
      G.addItem(run, 'filtration', 'filtration', 75, 104, { spot: 'The water filters. Heavy.', known: true });
      G.addItem(run, 'supplies0', 'supplies', 58, 112); G.addItem(run, 'supplies1', 'supplies', 48, 113);
      G.addItem(run, 'fuel0', 'fuel', 63.5, 100.5);
      const salv = rng.shuffle([[18, 68], [46, 68], [66, 68], [92, 68], [30, 37], [76, 37], [104, 40], [11, 36], [57, 36], [100, 112], [14, 112], [110, 30]]).slice(0, 6);
      salv.forEach((p, i) => G.addItem(run, 'salvage' + i, 'salvage', p[0], p[1]));
      const pk = G.addPickup;
      pk(run, 'weapon', 63.6, 103, { wtype: 'shotgun', mag: 6, reserve: 12, cabinet: true });
      pk(run, 'ammo', 62, 105.6, { atype: 'shell', n: 6 }); pk(run, 'ammo', 30, 36, { atype: 'p9', n: 24 }); pk(run, 'ammo', 94, 101, { atype: 'p9', n: 24 });
      pk(run, 'medkit', 12, 96.4, { n: 1 }); pk(run, 'medkit', 76, 38, { n: 1 });
      pk(run, 'repairkit', 63.8, 99, { n: 1 }); pk(run, 'repairkit', 104, 30.5, { n: 1 });
      pk(run, 'noisemaker', 44, 112, { n: 1 }); pk(run, 'noisemaker', 57, 66, { n: 1 });
      if (!m.holdouts) {
        G.addSurvivor(run, 'rosa', 'Rosa', 'rosa', 12.5, 99, { where: 'Clinic house', landmark: 'clinic', pron: 'her', call: true });
        G.addSurvivor(run, 'eli', 'Eli', 'eli', 96, 100.5, { where: 'Radio shack', landmark: 'shack', pron: 'him', call: true });
      }
      const drivers = ['marta'];
      if (m.nell) drivers.push('nell');
      if (m.tomas) drivers.push('tomas');
      run.convoyDrivers = drivers;
      run.convoy = DH.Convoy.make(36, 114, -Math.PI / 2, 'marta');
      void W;
    },
    exitOpen(z, run) { return true; },
    interact(run, add, p) {},
    labels(run) {
      const pp = DH.Player.pos(), out = [];
      if (M.dist(pp.x, pp.y, 11, 56) < 18) out.push({ x: 11, y: 62, z: 1.6, text: run.gates.lowst.on ? 'LOW STREET: FLOODED' : 'LOW STREET: DRY', col: run.gates.lowst.on ? '#8cd6ff' : '#7fe3a0' });
      if (M.dist(pp.x, pp.y, 57, 56) < 18) out.push({ x: 57, y: 62, z: 1.6, text: run.gates.cut.on ? 'QUARRY CUT: RUBBLE' : 'QUARRY CUT: CLEAR', col: run.gates.cut.on ? '#ffd36a' : '#7fe3a0' });
      if (run.convoy && !run.convoy.rolling && M.dist(pp.x, pp.y, run.convoy.x, run.convoy.y) < 14) out.push({ x: run.convoy.x, y: run.convoy.y, z: 2.6, text: 'SECOND TRUCK (' + run.convoy.driverName + ')', col: '#8cd6ff' });
      return out;
    },
    onAction(run, key, data) {},
    update(run, dt) {
      const G = DH.G, c = run.convoy, t = run.truck, pp = DH.Player.pos(), m = (DH.Save.story && DH.Save.story().milestones) || {};
      if (run.time > 2) G.radio('marta', 'Everything we own fits in two beds if we’re smart. Generator, clinic cooler, water filters. I’ll drive the second truck.', 'intro');
      if (run.time > 14) G.radio('june', 'Ramp’s down and waiting at Harbor Street. Pick your road over the ridge.', 'tip');
      if (run.time > 26 && run.survivors.length) G.radio('marta', 'Rosa won’t leave the clinic house and Eli won’t leave his radios. They’d ride with me if you walked them over.', 'holdTip');
      if (run.flags.lowOpen && run.time > 8) G.radio('marta', 'Low Street’s dry since you drained the flats. Fastest way over the ridge.', 'lowOpen');
      if (run.flags.cutOpen && run.time > 8) G.radio('june', 'The Quarry Cut’s open since you ran the crusher. Straight up the middle.', 'cutOpen');
      if ((m.wes || (run.perks && run.perks.wes)) && t.x > 96 && t.y < 80) G.radio('wes', 'Two big ones on the ridge road, past the water tower. Don’t stop next to them.', 'ridgeWarn');
      for (const s of run.survivors) if (!s.recruited && s.call && M.dist(pp.x, pp.y, s.x, s.y) < 14) G.radio(s.id, s.id === 'rosa' ? 'I’m not leaving my patients’ files. Fine. Carry the box and I’ll come.' : 'If the radios stay, I stay. Oh, who am I kidding. Let’s go.', 'call_' + s.id);
      // holdouts climb into the second truck's cab (room for two)
      if (c) {
        const aboard = run.survivors.filter((s) => s.inConvoy);
        for (const s of aboard) { s.x = c.x; s.y = c.y; }
        if (!c.disabled && Math.abs(c.speed) < 0.6) for (const s of run.survivors) {
          if (!s.recruited || s.inConvoy || s.state === 'downed' || s.boarded) continue;
          if (aboard.length >= 2 || DH.Convoy.distToHull(s.x, s.y) > 2.2) continue;
          s.inConvoy = true; s.safe = true; s.hidden = true; s.safeX = null; s.path = null; aboard.push(s);
          G.msg(s.name + ' climbed into the second truck with ' + c.driverName + '.', 'good', 2.4);
        }
        if (c.disabled && aboard.length) for (const s of aboard) { s.inConvoy = false; s.safe = false; s.hidden = false; s.mode = 'wait'; s.state = 'wait'; const q = G.W.findFreeNear(c.x + 2, c.y, 0.3, 3) || { x: c.x, y: c.y }; s.x = q.x; s.y = q.y; }
      }
      if (!run.flags.route) { if (t.y < 62 && t.y > 40) run.flags.route = t.x < 20 ? 'lowst' : t.x < 65 ? 'cut' : 'ridge'; }
    },
    objectives(run) {
      const c = run.convoy, out = [];
      const lead = DH.Cargo.list(run, 'truck').filter((i) => GEAR.indexOf(i.kind) >= 0).length, back = DH.Cargo.list(run, 'convoy').filter((i) => GEAR.indexOf(i.kind) >= 0).length;
      out.push({ text: 'Equipment loaded: your truck ' + lead + ' · second truck ' + back + ' (of 3)', done: lead + back >= 3 });
      out.push({ text: c.disabled ? 'Second truck wrecked' : 'Second truck (' + c.driverName + '): ' + Math.ceil(c.dur) + '/' + c.maxDur + (c.rolling ? '' : ' · waiting for you to lead off'), done: false, fail: c.disabled, opt: false });
      out.push({ text: 'Lead the convoy to the Harbor Street ferry', done: false, opt: false });
      const hs = run.survivors.filter((s) => s.id === 'rosa' || s.id === 'eli');
      out.push({ text: hs.length ? 'Optional: holdouts in the second truck ' + hs.filter((s) => s.inConvoy).length + '/2' : 'Rosa and Eli already left', done: !hs.length || hs.every((s) => s.inConvoy), opt: true });
      return out;
    },
    pointer(run) {
      const G = DH.G, p = run.player;
      const left = GEAR.map((k) => run.items[k]).filter((it) => it && it.loc === 'world');
      if (p.hauling) {
        const c = run.convoy, lf = DH.Cargo.free(run, 'truck') >= 3;
        return lf || !c || c.disabled ? { x: run.truck.x, y: run.truck.y, label: 'TRUCK', col: '#ffd36a' } : { x: c.x, y: c.y, label: 'SECOND TRUCK', col: '#8cd6ff' };
      }
      if (left.length && !p.inTruck && run.time < 400 && !run.convoy.rolling) { const it = left.sort((a, b) => M.dist(a.x, a.y, p.x, p.y) - M.dist(b.x, b.y, p.x, p.y))[0]; return { x: it.x, y: it.y, label: 'EQUIPMENT', col: '#ff8a7a' }; }
      if (!p.inTruck) return { x: run.truck.x, y: run.truck.y, label: 'TRUCK', col: '#ffd36a' };
      return { x: 60, y: 17, label: 'FERRY', col: '#8cd6ff' };
    },
    markers(run, dot) {
      for (const k of GEAR) { const it = run.items[k]; if (it && it.loc === 'world') dot(it.x, it.y, '#ff6b5a', 3.5, true); }
      if (run.convoy) dot(run.convoy.x, run.convoy.y, run.convoy.disabled ? '#ff5a46' : '#8cd6ff', 4.5);
    },
    primaryOut: (out, run, mode) => mode === 'ferry' && gearOut(out).length > 0,
    primaryGot: (run) => GEAR.some((k) => run.items[k] && (run.items[k].loc === 'truck' || run.items[k].loc === 'convoy')),
    bonus: (out, run, mode) => { const b = []; if (mode === 'ferry' && gearOut(out).length) b.push({ label: 'The long haul', scrap: DH.T.rewards.convoy }); if (out.convoyOut) b.push({ label: 'Second truck aboard', scrap: DH.T.rewards.convoy2 }); return b; },
    departWarn: 'Only your truck aboard the ferry with garage equipment completes the long haul. This will be a partial extraction.',
    resultSub(r) { return r.status === 'partial' ? 'The equipment did not make the ferry.' : r.status === 'failed' ? 'Nothing extracted. No rewards from this run. Your campaign progress is safe.' : r.convoyOut ? 'Both trucks are on the car deck.' : 'Your truck made it. The second truck did not.'; },
    resultRows(run, ev) {
      const R = DH.T.rewards, g = gearOut(ev);
      const hs = run.survivors.filter((s) => s.id === 'rosa' || s.id === 'eli'), hOut = hs.filter((s) => ev.survivorsOut.indexOf(s.id) >= 0).length;
      return [
        ['Garage equipment (primary)', g.length + ' / 3 aboard', g.length ? 'good' : 'bad'],
        ['Second truck (' + (run.convoy ? run.convoy.driverName : '-') + ')', ev.convoyOut ? 'Aboard +' + R.convoy2 : run.convoy && run.convoy.disabled ? 'Wrecked' : 'Left behind', ev.convoyOut ? 'good' : 'bad'],
        ['Road over the ridge', run.flags.route === 'lowst' ? 'Low Street' : run.flags.route === 'cut' ? 'Quarry Cut' : run.flags.route === 'ridge' ? 'Ridge Road' : '-'],
        ['Holdouts', hs.length ? hOut + ' / ' + hs.length + (hOut ? ' (+' + hOut * R.survivor + ')' : '') : 'Already gone', hOut ? 'good' : ''],
        ['Supplies', (ev.got.supplies || 0) + ' / 2', ev.got.supplies ? 'good' : ''],
        ['Salvage bundles', ev.salvageOut + (ev.salvageOut ? ' (+' + ev.salvageOut * R.salvage + ')' : ''), ev.salvageOut ? 'good' : ''],
      ];
    },
    outcome(run, ev, mode) {
      const hs = run.survivors.filter((s) => s.id === 'rosa' || s.id === 'eli'), hOut = hs.filter((s) => ev.survivorsOut.indexOf(s.id) >= 0).length;
      const holdouts = hs.length > 0 && hOut === hs.length;
      return { convoy: !!ev.convoyOut, gear: gearOut(ev), holdouts, route: run.flags.route || null, driver: run.convoy ? run.convoy.driver : null, optional: { convoy: !!ev.convoyOut, holdouts: holdouts || !hs.length } };
    },
    hints: {
      start: { kbm: 'Long Haul. Haul the three pieces of equipment onto the two truck beds (hold E at either tailgate), then drive. The second truck follows your tracks.', touch: 'Load the equipment onto both trucks, then drive. The second truck follows you.' },
      primaryGot: { kbm: 'Equipment aboard. Lead the convoy north to the ferry: go steady so the second truck keeps up.', touch: 'Lead the convoy north to the ferry.' },
    },
    backdropCam: { x: 56, y: 96 },
  });
})();
