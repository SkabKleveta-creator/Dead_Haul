/* DEAD HAUL - cargo ownership, extraction rules, rewards (pure logic, unit-tested) */
(function () {
  'use strict';
  const DH = window.DH;
  const T = DH.T;

  // Item kinds. heavy items are hauled by hand and only ride in the truck bed.
  DH.ITEMS = {
    case: { label: 'Medical Case', units: 1, reward: 'case', order: 0, unique: true, primary: true, color: 'case' },
    medstock: { label: 'Medical Stock', units: 1, reward: 'medstock', order: 1, primary: true },
    assembly: { label: 'Refrigeration Unit', units: 3, heavy: true, reward: 'assembly', order: 2, primary: true, load: 3 },
    filtration: { label: 'Filtration Unit', units: 3, heavy: true, reward: 'filtration', order: 3, primary: true, load: 3 },
    powerpack: { label: 'Hydraulic Power Pack', units: 3, heavy: true, reward: 'powerpack', order: 4, primary: true, load: 3 },
    generator: { label: 'Generator', units: 3, heavy: true, reward: 'generator', order: 5, load: 3 },
    supplies: { label: 'Emergency Supplies', units: 1, reward: 'supplies', order: 6, bulk: true },
    salvage: { label: 'Salvage Bundle', units: 1, reward: 'salvage', order: 7, bulk: true, short: 'Salvage' },
  };
  const def = (it) => DH.ITEMS[it.kind] || DH.ITEMS.salvage;

  // Items: { id, kind, loc: 'world'|'backpack'|'truck'|'hauled'|'installed', x, y }
  const Cargo = (DH.Cargo = {});
  Cargo.def = def;
  Cargo.heavy = (it) => !!def(it).heavy;
  Cargo.units = (it) => def(it).units;
  Cargo.used = (run, loc) => { let u = 0; for (const id in run.items) { const it = run.items[id]; if (it.loc === loc) u += Cargo.units(it); } return u; };
  Cargo.free = (run, loc) => (loc === 'backpack' ? T.cargo.backpack : T.cargo.truck) - Cargo.used(run, loc);
  Cargo.list = (run, loc) => Object.values(run.items).filter((it) => it.loc === loc);
  Cargo.label = (it) => def(it).label;
  Cargo.hauled = (run) => { const p = run.player; if (!p.hauling) return null; return run.items[p.haulId || 'generator'] || null; };

  // Pick up a world item into the backpack
  Cargo.pickUp = (run, id) => {
    const it = run.items[id];
    if (!it || it.loc !== 'world') return { ok: false, msg: 'Nothing to pick up.' };
    if (Cargo.heavy(it)) return { ok: false, msg: 'The ' + Cargo.label(it).toLowerCase() + ' is too heavy for the backpack. Haul it.' };
    if (Cargo.free(run, 'backpack') < Cargo.units(it)) return { ok: false, msg: 'Backpack full (' + T.cargo.backpack + '/' + T.cargo.backpack + ').' };
    it.loc = 'backpack';
    return { ok: true, msg: Cargo.label(it) + ' stowed in backpack.' };
  };
  // Atomic transfer between backpack and truck
  Cargo.transfer = (run, id, to) => {
    const it = run.items[id];
    if (!it) return { ok: false, msg: 'Unknown item.' };
    if (Cargo.heavy(it)) return { ok: false, msg: 'Use Load/Unload for the ' + Cargo.label(it).toLowerCase() + '.' };
    const from = to === 'truck' ? 'backpack' : 'truck';
    if (it.loc !== from) return { ok: false, msg: 'Item is not in the ' + from + '.' };
    if (Cargo.free(run, to) < Cargo.units(it)) return { ok: false, msg: (to === 'truck' ? 'Truck bed' : 'Backpack') + ' full.' };
    it.loc = to;
    return { ok: true, msg: Cargo.label(it) + ' moved to ' + (to === 'truck' ? 'truck' : 'backpack') + '.' };
  };
  // Drop a backpack item into the world at a valid spot
  Cargo.drop = (run, id, x, y) => {
    const it = run.items[id];
    if (!it || it.loc !== 'backpack') return { ok: false, msg: 'Not carried.' };
    it.loc = 'world'; it.x = x; it.y = y;
    return { ok: true, msg: Cargo.label(it) + ' dropped.' };
  };
  Cargo.canLoadHeavy = (run, id) => {
    const g = run.items[id];
    if (!g || !Cargo.heavy(g)) return { ok: false, msg: 'Nothing heavy to load.' };
    if (g.loc === 'truck') return { ok: false, msg: Cargo.label(g) + ' already loaded.' };
    if (g.loc === 'installed') return { ok: false, msg: Cargo.label(g) + ' is installed.' };
    const u = Cargo.units(g);
    if (Cargo.free(run, 'truck') < u) return { ok: false, msg: 'Truck needs ' + u + ' free units (has ' + Cargo.free(run, 'truck') + ').' };
    return { ok: true };
  };
  Cargo.loadHeavy = (run, id) => {
    const c = Cargo.canLoadHeavy(run, id);
    if (!c.ok) return c;
    run.items[id].loc = 'truck';
    return { ok: true, msg: Cargo.label(run.items[id]) + ' loaded.' };
  };
  Cargo.unloadHeavy = (run, id, x, y) => {
    const g = run.items[id];
    if (!g || g.loc !== 'truck') return { ok: false, msg: (g ? Cargo.label(g) : 'Item') + ' is not in the truck.' };
    g.loc = 'world'; g.x = x; g.y = y;
    return { ok: true, msg: Cargo.label(g) + ' unloaded.' };
  };
  // Level 1 compatibility wrappers
  Cargo.canLoadGenerator = (run) => (run.items.generator ? Cargo.canLoadHeavy(run, 'generator') : { ok: false, msg: 'No generator.' });
  Cargo.loadGenerator = (run) => (run.items.generator ? Cargo.loadHeavy(run, 'generator') : { ok: false, msg: 'No generator.' });
  Cargo.unloadGenerator = (run, x, y) => Cargo.unloadHeavy(run, 'generator', x, y);
  Cargo.heavyInTruck = (run) => Cargo.list(run, 'truck').filter((i) => Cargo.heavy(i));

  // Invariant check (used by tests and debug)
  Cargo.check = (run) => {
    const errs = [];
    if (Cargo.used(run, 'backpack') > T.cargo.backpack) errs.push('backpack over capacity');
    if (Cargo.used(run, 'truck') > T.cargo.truck) errs.push('truck over capacity');
    const counts = {};
    for (const id in run.items) {
      const it = run.items[id];
      if (['world', 'backpack', 'truck', 'hauled', 'installed'].indexOf(it.loc) < 0) errs.push(id + ' invalid loc ' + it.loc);
      if (Cargo.heavy(it) && it.loc === 'backpack') errs.push(id + ' heavy item in backpack');
      if (!Cargo.heavy(it) && (it.loc === 'hauled' || it.loc === 'installed')) errs.push(id + ' light item ' + it.loc);
      counts[it.kind] = (counts[it.kind] || 0) + 1;
    }
    for (const k in counts) if (DH.ITEMS[k] && DH.ITEMS[k].unique && counts[k] !== 1) errs.push(k + ' count ' + counts[k]);
    if ((run.level || 1) === 1 && counts.case !== 1) errs.push('case count ' + (counts.case || 0));
    const hauled = Object.values(run.items).filter((i) => i.loc === 'hauled');
    if (hauled.length > 1) errs.push('more than one hauled item');
    return errs;
  };

  // ---- Extraction evaluation ----
  // mode: 'truck' | 'foot' | 'ferry' | 'death'
  DH.Extract = {};
  DH.Extract.evaluate = (run, mode, ctx) => {
    ctx = ctx || {};
    const L = DH.LEVELS[run.level || 1];
    const items = Object.values(run.items);
    const out = { mode, caseOut: false, survivorOut: false, generatorOut: false, salvageOut: 0, got: {}, survivorsOut: [], leaving: [], leftBehind: [] };
    if (mode === 'death') {
      out.status = 'failed';
      out.scrap = 0;
      out.leftBehind.push('Everything');
      return out;
    }
    const inPack = (i) => i.loc === 'backpack';
    const inTruck = (i) => i.loc === 'truck';
    const vehicle = mode === 'truck' || mode === 'ferry';
    const isOut = (i) => (vehicle ? inPack(i) || inTruck(i) : inPack(i));
    for (const i of items) if (isOut(i)) out.got[i.kind] = (out.got[i.kind] || 0) + 1;
    // survivors
    const svs = run.survivors || [];
    if (ctx.survivorsOut) out.survivorsOut = ctx.survivorsOut.slice();
    else if (svs[0] && (vehicle ? ctx.survivorBoarded : ctx.survivorNearMobile)) out.survivorsOut = [svs[0].id];
    else if (!svs.length && (vehicle ? ctx.survivorBoarded : ctx.survivorNearMobile)) out.survivorsOut = ['nell'];
    out.caseOut = !!out.got.case;
    out.generatorOut = !!out.got.generator;
    out.salvageOut = out.got.salvage || 0;
    out.survivorOut = out.survivorsOut.length > 0;
    // lists
    out.leaving.push('You');
    const kinds = Object.keys(DH.ITEMS).sort((a, b) => DH.ITEMS[a].order - DH.ITEMS[b].order);
    const seenFlag = (i) => i.seen || (run.seen && run.seen[i.id]) || (i.kind === 'generator' && (ctx.generatorFound || run.seenGenerator));
    for (const k of kinds) {
      const d = DH.ITEMS[k];
      const all = items.filter((i) => i.kind === k);
      if (!all.length) continue;
      const n = out.got[k] || 0;
      const name = d.short || d.label;
      if (n) out.leaving.push(d.bulk ? name + ' x' + n : n > 1 ? d.label + ' x' + n : d.label);
      if (d.bulk) {
        const left = all.filter((i) => (i.loc === 'truck' || i.loc === 'backpack') && !isOut(i)).length;
        if (left > 0) out.leftBehind.push(name + ' x' + left + ' (truck)');
      } else {
        for (const i of all) {
          if (isOut(i) || i.loc === 'installed') continue;
          if (i.loc === 'truck') out.leftBehind.push(d.label + (d.heavy ? '' : ' (in abandoned truck)'));
          else if (d.primary || i.loc === 'hauled' || seenFlag(i)) out.leftBehind.push(d.label);
        }
      }
    }
    svs.forEach((s, k) => {
      if (out.survivorsOut.indexOf(s.id) >= 0) { out.leaving.push(s.name); return; }
      const rec = s.recruited || (k === 0 && ctx.survivorRecruited), down = s.state === 'downed' || (k === 0 && ctx.survivorDowned);
      if (rec) out.leftBehind.push(s.name + (down ? ' (downed)' : ''));
    });
    if (!svs.length && ctx.survivorRecruited && !out.survivorOut) out.leftBehind.push(ctx.survivorDowned ? 'Survivor (downed)' : 'Survivor');
    if (mode === 'foot') out.leftBehind.push('Truck');
    out.primaryOut = L && L.primaryOut ? !!L.primaryOut(out, run, mode) : out.caseOut;
    out.status = out.primaryOut ? 'success' : 'partial';
    out.bonus = L && L.bonus ? L.bonus(out, run, mode) || [] : [];
    out.scrap = DH.Extract.scrapFor(out);
    return out;
  };
  DH.Extract.scrapFor = (o) => {
    const R = T.rewards;
    if (!o.got) return (o.caseOut ? R.case : 0) + (o.survivorOut ? R.survivor : 0) + (o.generatorOut ? R.generator : 0) + o.salvageOut * R.salvage;
    let s = 0;
    for (const k in o.got) { const d = DH.ITEMS[k]; if (d && d.reward) s += (R[d.reward] || 0) * o.got[k]; }
    s += (o.survivorsOut || []).length * R.survivor;
    for (const b of o.bonus || []) s += b.scrap || 0;
    return s;
  };
})();
