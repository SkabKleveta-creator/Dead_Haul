/* ==== story.js ==== */
/* DEAD HAUL - campaign story: milestones, perks, mission order, aftermath dialogue, ending */
(function () {
  'use strict';
  const DH = window.DH;
  const Story = (DH.Story = {});

  Story.CAST = {
    marta: { name: 'Marta', role: 'Garage coordinator', fig: 'marta' },
    nell: { name: 'Nell', role: 'Ex-delivery driver', fig: 'survivor' },
    wes: { name: 'Wes', role: 'Radio operator', fig: 'wes' },
    tomas: { name: 'Tomas', role: 'Depot loader', fig: 'tomas' },
    ada: { name: 'Ada', role: 'School nurse', fig: 'ada' },
    june: { name: 'June', role: 'Waterfront coordinator', fig: 'june' },
  };

  // One-time unlocks. Each is earned by a narrative milestone and never repeats.
  Story.UNLOCKS = {
    jack: { name: 'Pallet Jack', from: 'Clear Cold Chain', desc: 'Haul heavy cargo faster (55% to 70% walking speed).', ms: 'refrigeration' },
    crew: { name: 'Loading Crew (Tomas)', from: 'Rescue Tomas', desc: 'Heavy cargo loads 40% faster.', ms: 'tomas' },
    winch: { name: 'Recovery Winch', from: 'Clear High Water', desc: 'Truck repairs take 2.5 s and stuck recovery reaches farther.', ms: 'water' },
    medic: { name: 'Garage Medic (Ada)', from: 'Rescue Ada', desc: 'Deploy with 3 medical kits instead of 2.', ms: 'ada' },
    relay: { name: 'Ridge Relay', from: 'Clear Dead Air', desc: 'Horde warnings arrive 3 s earlier.', ms: 'relay' },
    wes: { name: 'Wes on the Radio', from: 'Rescue Wes', desc: 'Wes calls out crowd movement. Deploy with 1 extra noise maker.', ms: 'wes' },
  };
  Story.MILESTONES = {
    nell: 'Nell is living at the garage.',
    generator: 'The generator lights the garage bay.',
    refrigeration: 'The clinic has real refrigeration. Pallet Jack unlocked.',
    medstock: 'Medical stock from Route 9 is in the clinic.',
    tomas: 'Tomas runs the loading dock. Heavy cargo loads faster.',
    water: 'Clean water at the garage. Recovery Winch unlocked.',
    ada: 'Ada keeps the med kits stocked. Deploy with 3.',
    relay: 'The ridge relay reaches the waterfront. Earlier horde warnings.',
    wes: 'Wes runs the radio from the garage roof.',
    crossing: 'The Harbor Street crossing is open.',
  };

  Story.perks = (st) => {
    const m = (st && st.milestones) || {};
    const o = {};
    for (const k in Story.UNLOCKS) o[k] = !!m[Story.UNLOCKS[k].ms];
    return o;
  };
  Story.current = (st) => {
    for (let l = 1; l <= 5; l++) if (!st.completed[l]) return l;
    return 5;
  };
  Story.unlocked = (st, l) => DH.Save.unlocked(st, l);
  Story.objective = (st) => {
    const c = Story.current(st);
    if (st.completed[5]) return 'The crossing is open. Replay any mission for scrap, supplies and anyone you missed.';
    return [null,
      'Get insulin for the clinic from the Mercer Crossing pharmacy.',
      'Keep the medicine cold: recover refrigeration from Route 9 Distribution.',
      'Fix the water: restart the Low Flats pumps and bring back filters.',
      'Reach the waterfront: restore the Hollis Ridge relay.',
      'Open the crossing: restore the Harbor Street ramp and get the truck aboard.'][c];
  };

  // Apply a committed (non-failed) result to the story. Idempotency is guaranteed by the caller (run id).
  Story.apply = (st, result) => {
    const lvl = result.level || 1;
    const oc = result.outcome || {};
    const out = { firstClear: false, newMilestones: [], unlocked: null, level: lvl };
    const ms = (k) => { if (!st.milestones[k]) { st.milestones[k] = true; out.newMilestones.push(k); st.log.push(k); } };
    // optional rescues and finds count whenever you actually brought them home
    if (oc.nell) ms('nell');
    if (oc.generator) ms('generator');
    if (oc.tomas) ms('tomas');
    if (oc.ada) ms('ada');
    if (oc.wes) ms('wes');
    if (oc.medstock && lvl === 2) ms('medstock');
    const opt = st.optional[lvl] || (st.optional[lvl] = {});
    for (const k in oc.optional || {}) if (oc.optional[k]) opt[k] = true;
    if (result.status === 'success') {
      if (!st.completed[lvl]) {
        st.completed[lvl] = true;
        st.firstClear[lvl] = result.runId || 'run';
        st.outcomes[lvl] = Object.assign({}, oc, { time: Math.round(result.time || 0) });
        st.seen[lvl] = false;
        out.firstClear = true;
        if (lvl < 5) { out.unlocked = lvl + 1; st.selected = lvl + 1; }
      }
      if (lvl === 2) ms('refrigeration');
      if (lvl === 3) ms('water');
      if (lvl === 4) ms('relay');
      if (lvl === 5) ms('crossing');
    }
    if (st.log.length > 30) st.log.splice(0, st.log.length - 30);
    return out;
  };

  // ---------- Aftermath (garage) ----------
  const who = (k) => (Story.CAST[k] ? Story.CAST[k].name : k);
  Story.aftermath = (lvl, st) => {
    const m = st.milestones, o = st.outcomes[lvl] || {};
    const L = [];
    const say = (k, text, radio) => L.push({ who: k, name: who(k), text, radio: !!radio });
    if (lvl === 1) {
      say('marta', 'Insulin’s in the cooler. That buys the clinic a few weeks.');
      if (m.generator) say('marta', 'And your generator is running the bay lights. First lit night in a month.');
      else say('marta', 'No generator, so the cooler runs on truck batteries. We swap them every six hours.');
      if (m.nell) say('nell', 'That case came off a cold-chain truck. Route 9 Distribution. I used to drive for them.');
      else say('marta', 'The case has a cold-chain label. Route 9 Distribution, past the overpass.');
      say('marta', 'A depot means real refrigeration. Batteries won’t keep a clinic.');
      say('wes', '...anyone on this band? Wes, up at the Hollis Ridge relay. Signal’s rough. I’ll keep calling.', true);
      return { lines: L, next: 2, title: 'KETTLE CREEK GARAGE', sub: 'The morning after Mercer Crossing' };
    }
    if (lvl === 2) {
      say('marta', 'The refrigeration unit is wired into the clinic. The insulin stays cold now.');
      say('marta', 'And the stock you pulled covers antibiotics into winter.');
      if (o.route === 'power') say('marta', 'Heard you lit the whole depot. Those compressors carried for miles.');
      else if (o.route === 'service') say('marta', 'You took the service road and nobody heard a thing. I like quiet runs.');
      if (m.tomas) say('tomas', 'Tomas. I rebuilt your loading dock. Heavy gear goes on faster now.');
      else say('marta', 'Took four of us to unload that unit. We could use dock hands.');
      say(m.nell ? 'nell' : 'marta', 'Dispatch logs say the Mercer Field evac center stopped taking people weeks ago. The broadcast never changed.');
      if (m.tomas) say('tomas', 'That note on the manifest is mine. Ferry crews were still running out of Harbor Street when I got stuck.');
      else say('marta', 'Someone wrote on the manifest: “Harbor Street ferry still running. Ask for June.”');
      say('marta', 'Next problem. The well pump’s dying and the water’s brown. The Low Flats pump station has filters.');
      say('wes', 'Wes again. Relay generator’s coughing. I’m still here. Mostly.', true);
      return { lines: L, next: 3, title: 'KETTLE CREEK GARAGE', sub: 'Cold storage online' };
    }
    if (lvl === 3) {
      say('marta', 'Clean water out of the tap. I almost cried. Almost.');
      if (o.setting === 'A') say('marta', 'You drained Low Street. Loud, but it’s open if we need it again.');
      else if (o.setting === 'B') say('marta', 'You ran the canal lane. Long way round, but you came back with dry tires.');
      if (m.ada) say('ada', 'Ada. I was a school nurse. I’ll keep your med kits stocked.');
      else if (o.supplies) say('marta', 'Whoever lived on Willow Street packed good supplies. Hope they found somewhere dry.');
      say('wes', 'I caught that waterfront broadcast too. June’s people are real. They have a ferry.', true);
      say('wes', 'My relay is the only thing that reaches both of you. And I’ve got company at the fence. A lot of it.', true);
      say('marta', 'Hollis Ridge, then. Fix the relay. Bring Wes home if you can.');
      return { lines: L, next: 4, title: 'KETTLE CREEK GARAGE', sub: 'Water running' };
    }
    if (lvl === 4) {
      say('june', 'Kettle Creek, this is June at Harbor Street. Loud and clear, for once.', true);
      if (m.wes) say('wes', 'Rigged a repeater on your roof. I’ll call out crowds from here. Also, I’m eating your crackers.');
      else say('wes', 'Relay’s holding. I’m holding. Next time, honk.', true);
      if (o.broadcast === 'off') say('marta', 'Glad someone finally shut that evac recording up.');
      else if (o.broadcast === 'routed') say('marta', 'You sent the old evac loop down the hill and let the dead chase it. Fitting.');
      say('june', 'The evac center was never coming back. We’re running our own crossing to the island depot.', true);
      say('june', 'The ferry runs. The terminal ramp doesn’t. It needs a hydraulic power pack and a clear lane for your truck.', true);
      say('marta', 'If the truck can cross, supplies can move both ways. That’s close to a future.');
      return { lines: L, next: 5, title: 'KETTLE CREEK GARAGE', sub: 'Contact with the waterfront' };
    }
    return { lines: L, next: null };
  };

  // ---------- Ending (after the crossing) ----------
  Story.ending = (st, res) => {
    const m = st.milestones, oc = (res && res.outcome) || st.outcomes[5] || {};
    const lines = [];
    lines.push('The ferry backs away from Harbor Street with the recovery truck chained on the car deck.');
    const saved = oc.stranded || 0;
    if (saved > 0) lines.push('June counts ' + saved + ' dockworker' + (saved > 1 ? 's' : '') + ' aboard who would not have lasted another night.');
    else lines.push('The waterfront crew boards behind the truck. June doesn’t ask about the ones still on the quay.');
    const people = ['nell', 'tomas', 'ada', 'wes'].filter((k) => m[k]).map((k) => Story.CAST[k].name);
    if (people.length) lines.push('Back at Kettle Creek, ' + people.join(', ').replace(/, ([^,]*)$/, ' and $1') + (people.length > 1 ? ' keep' : ' keeps') + ' the garage running.');
    const gear = [];
    if (m.generator) gear.push('the generator');
    if (m.refrigeration) gear.push('the clinic cooler');
    if (m.water) gear.push('clean water');
    if (m.relay) gear.push('the ridge relay');
    if (gear.length) lines.push('What you hauled home still works: ' + gear.join(', ').replace(/, ([^,]*)$/, ' and $1') + '.');
    if (oc.supplies) lines.push(oc.supplies + ' crate' + (oc.supplies > 1 ? 's' : '') + ' of community supplies ride along for the island depot.');
    lines.push('The crossing gives you a foothold: a second base, a supply line, a way out. It does not end anything.');
    lines.push('The dead are still out there. Tomorrow there’s another run.');
    return lines;
  };
})();

