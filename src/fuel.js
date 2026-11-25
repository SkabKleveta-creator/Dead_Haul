/* DEAD HAUL - truck fuel (Island Line missions): consumption, jerry cans, refueling */
(function () {
  'use strict';
  const DH = window.DH;
  const T = DH.T, G = DH.G;
  const Fuel = (DH.Fuel = {});

  // Fuel only exists on missions that declare it; everywhere else the tank is ignored.
  Fuel.on = (run) => !!(run && run.truck && run.truck.fuel != null);
  Fuel.cap = (run) => Math.round(T.fuel.cap * (run.perks && run.perks.bladder ? 1.5 : 1));
  Fuel.empty = (run) => Fuel.on(run) && run.truck.fuel <= 0;
  Fuel.init = (run, start) => {
    const cap = Fuel.cap(run);
    run.truck.fuel = Math.min(cap, Math.round(start * (run.perks && run.perks.bladder ? 1.5 : 1)));
    run.truck.fuelCap = cap;
  };
  Fuel.rate = (run) => {
    const t = run.truck, F = T.fuel;
    let r = F.idle;
    if (Math.abs(t.speed) > 0.3) r += F.move + Math.abs(t.speed) * F.perSpeed;
    if (run.upgrades && run.upgrades.tank) r *= 0.7;
    return r;
  };
  Fuel.tick = (run, dt) => {
    if (!Fuel.on(run)) return;
    const t = run.truck;
    if (!t.engine) return;
    const before = t.fuel;
    t.fuel = Math.max(0, t.fuel - Fuel.rate(run) * dt);
    if (before > T.fuel.low && t.fuel <= T.fuel.low) { G.msg('Fuel low. Find a jerry can (refuel at the truck).', 'warn', 3.5); DH.bus.emit('fuelLow'); }
    if (before > 0 && t.fuel <= 0) {
      t.engine = false; t.speed = Math.min(t.speed, 2);
      G.msg('OUT OF FUEL. The truck rolls to a stop. Bring a jerry can, or leave on foot.', 'danger', 5);
      DH.bus.emit('fuelOut');
    }
  };
  // Jerry cans the player can pour: backpack first, then the truck bed.
  Fuel.cans = (run) => Object.values(run.items).filter((i) => i.kind === 'fuel' && (i.loc === 'backpack' || i.loc === 'truck'));
  Fuel.canRefuel = (run) => Fuel.on(run) && Fuel.cans(run).length > 0 && run.truck.fuel < run.truck.fuelCap - 3;
  Fuel.refuel = (run) => {
    const cans = Fuel.cans(run).sort((a, b) => (a.loc === 'backpack' ? -1 : 1) - (b.loc === 'backpack' ? -1 : 1));
    const c = cans[0];
    if (!c) return false;
    c.loc = 'used';
    run.truck.fuel = Math.min(run.truck.fuelCap, run.truck.fuel + T.fuel.can);
    run.stats.cans = (run.stats.cans || 0) + 1;
    G.msg('Truck refueled +' + T.fuel.can + ' (' + Math.round(run.truck.fuel) + '/' + run.truck.fuelCap + ').', 'good', 2);
    DH.bus.emit('refuel');
    return true;
  };
  Fuel.refuelTime = (run) => (run.perks && run.perks.dock ? 1 : T.fuel.refuel);
})();
