/* DEAD HAUL - Island Line campaign (missions 6-10): cast, unlocks, milestones, aftermath, second ending */
(function () {
  'use strict';
  const DH = window.DH;
  const Story = DH.Story;

  Object.assign(Story.CAST, {
    hale: { name: 'Hale', role: 'Lighthouse keeper', fig: 'hale' },
    cal: { name: 'Cal', role: 'Fuel pier', fig: 'cal' },
    dee: { name: 'Dee', role: 'Fuel pier', fig: 'dee' },
    pia: { name: 'Pia', role: 'Quarry weigh station', fig: 'pia' },
    sol: { name: 'Sol', role: 'Pia’s son', fig: 'sol' },
    rosa: { name: 'Rosa', role: 'Kettle Creek', fig: 'rosa' },
    eli: { name: 'Eli', role: 'Kettle Creek', fig: 'eli' },
    ines: { name: 'Ines', role: 'Ferry engineer', fig: 'ines' },
    ray: { name: 'Ray', role: 'Dockhand', fig: 'ray' },
    bo: { name: 'Bo', role: 'Retired rigger', fig: 'bo' },
  });

  Object.assign(Story.UNLOCKS, {
    bladder: { name: 'Fuel Bladder', from: 'Clear Landfall', desc: 'Truck fuel capacity +50% (and you start fuller).', ms: 'depot', c2: true },
    dock: { name: 'Dock Crew (Cal & Dee)', from: 'Rescue the fuel pier workers', desc: 'Heavy cargo goes on the truck bed almost instantly. Refueling takes 1 s.', ms: 'dockers', c2: true },
    desal: { name: 'Desal Plant', from: 'Clear Saltworks', desc: 'Deploy with 1 extra medical kit from either base.', ms: 'desal', c2: true },
    watch: { name: 'Lighthouse Watch (Hale)', from: 'Rescue Hale', desc: 'For the first 60 s the minimap shows crowds within 30 m.', ms: 'hale', c2: true },
    gravel: { name: 'Crusher Gravel', from: 'Clear Quarry Road', desc: 'Brute impacts do 25% less damage to the truck.', ms: 'quarry', c2: true },
    locker: { name: 'Weapon Locker', from: 'Clear Night Ferry', desc: 'One found weapon type carries over between missions.', ms: 'ferryrun', c2: true },
  });
  Object.assign(Story.MILESTONES, {
    depot: 'The Island Depot is secure. Fuel Bladder unlocked.',
    dockers: 'Cal and Dee run the fuel pier. Heavy cargo loads almost instantly.',
    desal: 'Fresh water on the island. Desal Plant: one more medkit per deployment.',
    hale: 'Hale keeps watch from the lighthouse. Early crowd sightings.',
    ferryrun: 'The night ferry got the medicine across. Weapon Locker unlocked.',
    quay: 'The last of the Harbor Street dockworkers made it to the island.',
    quarry: 'The island radio mast stands again. Crusher Gravel armour fitted.',
    family: 'Pia and Sol live at the depot now.',
    holdouts: 'Rosa and Eli left Kettle Creek with the convoy.',
    island: 'The Island Line runs both ways.',
  });

  Story.BASES = { 1: 'Kettle Creek', 2: 'Kettle Creek', 3: 'Kettle Creek', 4: 'Kettle Creek', 5: 'Kettle Creek', 6: 'Island Depot', 7: 'Island Depot', 8: 'Both shores', 9: 'Island Depot', 10: 'Kettle Creek' };
  Story.base = (l) => Story.BASES[l] || 'Kettle Creek';

  Story.objective2 = (c) => [null, null, null, null, null, null,
    'Make landfall: secure the Island Depot and get the truck inside.',
    'Fresh water: bring the desalination membrane back from the saltworks.',
    'Night ferry: hold the Harbor Street ramp and get the medicine across.',
    'Signal: restore quarry power and bring back the radio mast section.',
    'Long haul: bring Kettle Creek’s equipment to the ferry in two trucks.'][c];

  Story.apply2 = (lvl, ms) => {
    if (lvl === 6) ms('depot');
    if (lvl === 7) ms('desal');
    if (lvl === 8) ms('ferryrun');
    if (lvl === 9) ms('quarry');
    if (lvl === 10) ms('island');
  };
  Story.applyOptional2 = (lvl, oc, ms) => {
    if (oc.dockers) ms('dockers');
    if (oc.hale) ms('hale');
    if (oc.family) ms('family');
    if (oc.holdouts) ms('holdouts');
    if (oc.quayAll) ms('quay');
  };

  const who = (k) => (Story.CAST[k] ? Story.CAST[k].name : k);
  const list = (a) => a.join(', ').replace(/, ([^,]*)$/, ' and $1');
  Story.aftermath2 = (lvl, st, say, L) => {
    const m = st.milestones, o = st.outcomes[lvl] || {};
    if (lvl === 6) {
      say('june', 'Depot’s ours. First night behind a shut gate since spring.');
      if (o.route === 'gate') say('marta', 'We heard that gate motor from across the water. So did the whole island, I bet.', true);
      else if (o.route === 'side') say('june', 'You went in the side door and cleared it by hand. Remind me never to argue with you.');
      if (m.dockers) say('cal', 'Cal. Dee and I ran the fuel pier. We’ll keep your tank full and your bed loaded.');
      else say('june', 'Nobody answers from the fuel pier. Fuel is going to be our problem now.');
      say('june', 'Next: water. The island wells are salt. The saltworks on the north shore had a desalination plant.');
      say('june', 'And Keeper Hale hasn’t lit the lighthouse in a week.');
      if (m.wes) say('wes', 'Relay’s reaching both shores from the garage roof. Good to hear you, island.', true);
      return { lines: L, next: 7, title: 'ISLAND DEPOT', sub: 'Landfall' };
    }
    if (lvl === 7) {
      say('june', 'The membrane’s in. Fresh water out of salt. The kids think it’s magic.');
      if (o.route === 'early') say('june', 'You beat the tide through the lower works. Close.');
      else if (o.route === 'cliff') say('june', 'Cliff road, the long way round, and you still came back in one piece.');
      if (m.hale) say('hale', 'Hale. Forty years watching that water. I can watch the island for you too.');
      else say('june', 'Still no lamp at the lighthouse.');
      say('june', 'Bad news from the mainland. Kettle Creek sent its spare medicine, and it’s stuck on the Harbor Street quay.');
      say('marta', 'The ferry will have to make a night run. Someone has to hold the ramp while it docks.', true);
      return { lines: L, next: 8, title: 'ISLAND DEPOT', sub: 'Fresh water' };
    }
    if (lvl === 8) {
      say('june', 'Ferry’s back on its berth with the medicine. I don’t like night runs.');
      if (o.decoy === 'boat') say('june', 'Leading them off with the skiff’s outboard. Loud, but clever.');
      else if (o.decoy === 'truck') say('marta', 'You parked the truck across the lanes and held. Old school.', true);
      if (o.quay > 0) say(o.quayFirst || 'ines', 'Thought I’d be watching that quay from the terminal roof forever. Thank you.');
      say('june', 'I put a weapon rack in the depot office. Bring home something good and we’ll keep it oiled for you.');
      say('june', 'The island radio mast fell in the last storm. Past the ridge, Wes can’t reach us.');
      say('wes', 'There’s a spare mast section at the quarry on the island road. Heavy. Very heavy.', true);
      return { lines: L, next: 9, title: 'ISLAND DEPOT', sub: 'The night run' };
    }
    if (lvl === 9) {
      say('wes', 'Island, this is Wes. Clear as a bell. That mast changes everything.', true);
      if (o.route === 'crusher') say('june', 'You ran the crusher and the whole island came to watch. The quarry road’s open now, at least.');
      else if (o.route === 'gantry') say('june', 'You carried it down the gantry by hand. Quiet as a church.');
      if (m.family) say('pia', 'Pia. Sol and I lived in that weigh station for a month. Thank you.');
      say('marta', 'Kettle Creek can’t do another winter alone. We’re packing the garage.', true);
      say('june', 'Then bring all of it. Both trucks. We’ll keep the ramp down for you.');
      return { lines: L, next: 10, title: 'ISLAND DEPOT', sub: 'Signal' };
    }
    return { lines: L, next: null };
  };

  Story.ending2 = (st, res) => {
    const m = st.milestones, oc = (res && res.outcome) || st.outcomes[10] || {};
    const lines = [];
    lines.push(oc.convoy ? 'The ferry pulls away from Harbor Street with both trucks chained on the car deck.' : 'The ferry pulls away from Harbor Street with the recovery truck chained on the car deck. The second truck didn’t make it.');
    const gear = (oc.gear || []).map((k) => ({ generator: 'the generator', assembly: 'the clinic cooler', filtration: 'the water filters' }[k] || k));
    if (gear.length) lines.push('In the trucks: ' + list(gear) + '.');
    else lines.push('Most of the garage’s equipment stayed behind in Kettle Creek.');
    if (oc.holdouts) lines.push('Rosa and Eli ride in the second truck. They were the last ones who wouldn’t leave.');
    const island = ['june', 'cal', 'dee', 'hale', 'pia', 'sol'].filter((k) => k === 'june' || m[k] || (k === 'cal' || k === 'dee' ? m.dockers : k === 'pia' || k === 'sol' ? m.family : false));
    const kc = ['nell', 'tomas', 'ada', 'wes'].filter((k) => m[k]);
    if (kc.length) lines.push(list(kc.map(who)) + (kc.length > 1 ? ' come' : ' comes') + ' across with the garage.');
    lines.push('Waiting at the Island Depot: ' + list(island.map(who).filter((v, i, a) => a.indexOf(v) === i)) + '.');
    const has = [];
    if (m.desal) has.push('water');
    if (m.quarry) has.push('a radio that reaches both shores');
    if (m.depot) has.push('fuel and a gate that shuts');
    if (has.length) lines.push('The island has ' + list(has) + ', and a ferry that runs both ways.');
    lines.push('Kettle Creek is dark tonight. It is not the end of anything. It is a place to start from.');
    return lines;
  };
})();
