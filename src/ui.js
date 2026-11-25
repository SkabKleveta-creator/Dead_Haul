/* DEAD HAUL - screens, HUD, minimap, menus, mission board, aftermath, hints */
(function () {
  'use strict';
  const DH = window.DH;
  const M = DH.M, G = DH.G, T = DH.T;
  const $ = (id) => document.getElementById(id);
  const UI = (DH.UI = { prev: null, sub: null, last: {}, hintQ: [] });

  const SCREENS = ['scr-title', 'scr-brief', 'scr-pause', 'scr-settings', 'scr-help', 'scr-depart', 'scr-results', 'scr-garage', 'scr-confirm', 'scr-map', 'scr-after', 'scr-ending'];
  UI.show = (id) => { for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); UI.cur = id; if (id) { const b = $(id).querySelector('button.primary, button'); if (b && DH.Input.mode !== 'touch') setTimeout(() => b.focus({ preventScroll: true }), 30); } };
  UI.toast = (text, ms) => { const t = $('toast'); t.textContent = text; t.classList.remove('hidden'); clearTimeout(UI._tt); UI._tt = setTimeout(() => t.classList.add('hidden'), ms || 3200); };
  const on = (id, fn) => $(id).addEventListener('click', (e) => { DH.Audio.init(); DH.Audio.ui(); fn(e); });
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const story = () => DH.Save.story();
  const LV = (l) => DH.LEVELS[l];

  UI.BRIEF = DH.LEVELS[1].brief();

  // ---------- Flow ----------
  UI.backdrop = (level) => {
    G.newRun(424242, {}, level || G.levelId || 1, { backdrop: true });
    G.backdrop = true; G.transferOpen = false;
    for (const z of G.run.zombies) z.state = 'idle';
  };
  UI.toTitle = () => {
    G.state = 'title';
    DH.Audio.stopAll();
    const st = story();
    const cur = DH.Story.current(st);
    UI.backdrop(cur);
    const bc = LV(cur).backdropCam || { x: 60, y: 60 };
    DH.R.cam.x = bc.x; DH.R.cam.y = bc.y; DH.R.cam.zoom = DH.R.cam.base;
    $('b-resume').classList.toggle('hidden', !DH.Save.hasRun());
    $('t-scrap').textContent = DH.Save.data.campaign.scrap;
    $('b-new').textContent = st.completed[10] ? 'Deploy: Replay ' + LV(st.selected || 10).name : 'Deploy: ' + LV(cur).name;
    $('t-obj').textContent = DH.Story.objective(st);
    const sm = $('save-msg');
    if (DH.Save.message) { sm.textContent = DH.Save.message; sm.classList.remove('hidden'); } else sm.classList.add('hidden');
    UI.setHud(false);
    UI.show('scr-title');
  };
  UI.deployLevel = () => { const st = story(); return st.completed[10] ? (st.selected || 10) : DH.Story.current(st); };
  // replay options chosen on the board (night, modifiers) apply to cleared missions only; first clears run as designed
  UI.prefs = () => DH.Save.data.campaign.prefs;
  UI.runOpts = (level, kind) => {
    const pr = UI.prefs(), st = story(), o = {};
    const L = LV(level);
    if (kind === 'daily') { const d = DH.Modes.dailySpec(st); return { mode: 'salvage', daily: d.date, mods: d.mods, cond: d.cond, nightBonus: !!d.cond.night, seed: d.seed }; }
    const replay = kind === 'salvage' || !!st.completed[level];
    if (!replay) return o;
    const mods = {};
    for (const k in pr.mods || {}) if (pr.mods[k] && (k !== 'notruck' || kind === 'salvage' || (L && L.footOK))) mods[k] = true;
    o.mods = mods;
    if (pr.night && !(L && L.cond && L.cond.night)) { o.cond = { night: true }; o.nightBonus = true; }
    if (kind === 'salvage') o.mode = 'salvage';
    return o;
  };
  UI.newRun = (level, kind) => {
    level = level || UI.deployLevel();
    if (!DH.Save.unlocked(story(), level)) level = DH.Story.current(story());
    if (kind === 'daily') level = DH.Modes.dailySpec(story()).level;
    G.backdrop = false;
    const up = Object.assign({}, DH.Save.data.campaign.upgrades);
    const o = UI.runOpts(level, kind);
    UI.lastKind = kind || null;
    G.newRun(o.seed != null ? o.seed : null, up, level, o);
    if (!kind) story().selected = level;
    DH.R.updateCamera(0, true);
    DH.Save.saveRun(G.snapshot());
    UI.hintsReset();
    UI.fillBrief(level);
    G.state = 'briefing';
    UI.show('scr-brief');
  };
  UI.fillBrief = (level) => {
    const run = G.run, L = G.LR(run), st = story();
    const daily = run && run.daily;
    $('brief-eyebrow').textContent = (daily ? 'DAILY HAUL ' + daily : run && run.mode === 'salvage' ? 'SALVAGE RUN' : 'MISSION ' + level) + ' · ' + L.place + (DH.Story.base ? ' · ' + DH.Story.base(level).toUpperCase() : '');
    $('brief-title').textContent = L.name.toUpperCase();
    $('brief-text').textContent = L.brief(st);
    const extra = [];
    if (run) {
      const c = run.cond || {}, cs = [c.night && 'Night', c.rain && 'Rain', c.fog && 'Fog'].filter(Boolean);
      if (cs.length) extra.push(['Conditions', cs.join(', ') + (run.nightBonus ? ' (x' + T.cond.nightScrap + ' scrap)' : '')]);
      const ms = Object.keys(run.mods || {}).filter((k) => run.mods[k]).map((k) => DH.Modes.MODS[k].name);
      if (ms.length) extra.push(['Modifiers', ms.join(', ')]);
      const mul = DH.Modes.scrapMul(run); if (mul !== 1) extra.push(['Scrap', 'x' + mul]);
      if (run.lockerWeapon) extra.push(['Weapon locker', DH.WEAPONS[run.lockerWeapon].name]);
      if (DH.Fuel.on(run)) extra.push(['Fuel', Math.round(run.truck.fuel) + ' / ' + run.truck.fuelCap]);
      if (L.par && (!run.mode || run.mode === 'campaign')) extra.push(['Medals', 'gold: under ' + DH.fmtTime(L.par) + ', 50 damage or less, every optional job']);
    }
    $('brief-meta').innerHTML = L.meta(st).concat(extra).map((m) => '<div><b>' + esc(m[0]) + '</b> ' + esc(m[1]) + '</div>').join('');
    const rp = $('brief-replay');
    if (run && run.mode === 'salvage') { rp.textContent = 'Salvage and Daily Haul runs never change your campaign: they only bank scrap.'; rp.classList.remove('hidden'); }
    else if (st.completed[level]) { rp.textContent = 'Replay. Scrap and anyone you still have to rescue count. Story events that already happened stay as they are.'; rp.classList.remove('hidden'); }
    else rp.classList.add('hidden');
  };
  UI.deploy = (level, kind) => {
    if (DH.Save.hasRun()) UI.confirm('NEW DEPLOYMENT?', 'Your saved run will be abandoned with no rewards.', () => { DH.Save.clearRun(); UI.newRun(level, kind); });
    else UI.newRun(level, kind);
  };
  UI.startPlay = () => {
    G.state = 'play';
    UI.show(null);
    UI.setHud(true);
    G.run.player.iframes = Math.max(G.run.player.iframes, 0.5);
    UI.hint('start');
    DH.Input.clear();
  };
  UI.pause = (why) => {
    if (G.state !== 'play') return;
    G.state = 'paused';
    DH.Input.clear();
    UI.saveRun();
    UI.show('scr-pause');
    DH.Audio.stopAll();
  };
  UI.resume = () => {
    if (!G.run) return;
    G.state = 'play';
    UI.show(null);
    UI.setHud(true);
    G.run.player.iframes = Math.max(G.run.player.iframes, 0.6);
    DH.Input.clear();
  };
  UI.saveRun = () => { if (G.run && !G.backdrop && (G.state === 'play' || G.state === 'paused' || G.state === 'map' || G.state === 'confirm')) DH.Save.saveRun(G.snapshot()); };
  UI.resumeSaved = () => {
    try {
      G.backdrop = false;
      G.restore(DH.Save.data.active);
      DH.R.updateCamera(0, true);
      UI.hintsReset();
      G.state = 'paused';
      UI.setHud(true);
      UI.show('scr-pause');
      UI.toast('Run restored (' + G.LR(G.run).name + '). Press Resume when ready.');
    } catch (e) {
      DH.Save.clearRun();
      UI.toast('The saved run could not be restored. Starting fresh.');
      UI.toTitle();
    }
  };
  UI.confirm = (title, text, yes) => {
    UI.cfReturn = UI.cur;
    $('cf-title').textContent = title; $('cf-text').textContent = text;
    UI.cfYes = yes;
    UI.show('scr-confirm');
  };
  UI.openSub = (id) => { UI.subReturn = UI.cur; UI.show(id); if (id === 'scr-settings') UI.loadSettings(); };
  UI.closeSub = () => UI.show(UI.subReturn || 'scr-title');

  UI.setHud = (v) => { $('hud').classList.toggle('hidden', !v); };

  // ---------- Map overlay ----------
  UI.toggleMap = () => {
    if (G.state === 'play') { G.state = 'map'; DH.Input.clear(); UI.drawBigMap(); UI.show('scr-map'); }
    else if (G.state === 'map') { G.state = 'play'; UI.show(null); DH.Input.clear(); G.run.player.iframes = Math.max(G.run.player.iframes, 0.4); }
  };

  // ---------- Depart confirm ----------
  DH.bus.on('confirmDepart', (c) => {
    G.state = 'confirm';
    DH.Input.clear();
    const ev = c.ev, L = G.L();
    $('dp-title').textContent = c.mode === 'truck' ? 'DRIVE OUT?' : c.mode === 'ferry' ? 'BOARD THE FERRY?' : 'LEAVE ON FOOT?';
    $('dp-leave').innerHTML = ev.leaving.map((s) => '<li>' + esc(s) + '</li>').join('');
    $('dp-left').innerHTML = (ev.leftBehind.length ? ev.leftBehind : ['Nothing']).map((s) => '<li>' + esc(s) + '</li>').join('');
    const w = $('dp-warn');
    if (!ev.primaryOut) { w.textContent = L.departWarn || 'The primary objective is not complete. This will be a partial extraction.'; w.classList.remove('hidden'); }
    else w.classList.add('hidden');
    UI.show('scr-depart');
  });
  DH.bus.on('runEnded', (r) => {
    G.state = 'results';
    UI.setHud(false);
    $('touch').classList.add('hidden');
    UI.lastResult = r;
    if (r.mode === 'ferry' && r.status === 'success' && G.lastRun) { UI.cinematic(r); return; }
    // keep the mission area visible behind results and garage (never saved, never simulated)
    const cx = DH.R.cam.x, cy = DH.R.cam.y;
    UI.backdrop(r.level);
    DH.R.cam.x = cx; DH.R.cam.y = cy;
    UI.showResults(r);
  });

  UI.showResults = (r) => {
    const L = r.runMode === 'salvage' && DH.Modes ? DH.Modes.salvageLevel(r.level || 1) : LV(r.level || 1);
    const title = r.status === 'success' ? 'MISSION COMPLETE' : r.status === 'partial' ? 'PARTIAL EXTRACTION' : 'YOU DIED';
    $('rs-title').textContent = title;
    $('rs-title').className = r.status === 'success' ? 'good' : 'bad';
    $('rs-eyebrow').textContent = (r.daily ? 'DAILY HAUL ' + r.daily + ' · ' : '') + L.name.toUpperCase() + ' · ' + (r.mode === 'truck' ? 'EXTRACTED BY TRUCK' : r.mode === 'foot' ? 'EXTRACTED ON FOOT' : r.mode === 'ferry' ? 'ABOARD THE FERRY' : r.mode === 'boat' ? 'BY BOAT' : 'RUN FAILED');
    $('rs-sub').textContent = L.resultSub ? L.resultSub(r) : '';
    const row = (a, b, cls) => '<tr><td>' + esc(a) + '</td><td class="' + (cls || '') + '">' + esc(b) + '</td></tr>';
    let h = '';
    for (const rr of r.rows || []) h += row(rr[0], rr[1], rr[2]);
    h += row('Truck', r.truckState + (r.mode === 'truck' || r.mode === 'ferry' ? ' (' + r.truckDur + '/' + T.truck.durability + ')' : ''));
    h += row('Elapsed time', DH.fmtTime(r.time));
    if (r.mult && r.mult !== 1) h += row('Scrap multiplier', 'x' + r.mult + ((r.cond && r.cond.night) ? ' (night' : ' (') + Object.keys(r.mods || {}).filter((k) => r.mods[k]).map((k) => ', ' + DH.Modes.MODS[k].name).join('') + ')');
    if (r.status === 'failed') h += row('Rewards', 'None', 'bad');
    $('rs-table').innerHTML = h;
    $('rs-scrap').textContent = r.scrap;
    $('rs-total').textContent = DH.Save.data.campaign.scrap;
    const sb = $('rs-story');
    const parts = [];
    if (r.story && r.story.firstClear) parts.push('<b>STORY</b>' + (r.story.unlocked ? 'Mission ' + r.story.unlocked + ' unlocked: ' + esc(LV(r.story.unlocked).name) + '.' : 'Campaign complete.'));
    if (r.story && r.story.newMilestones.length) parts.push('<b>AT THE GARAGE</b>' + r.story.newMilestones.map((k) => esc(DH.Story.MILESTONES[k] || k)).join('<br>'));
    if (r.status === 'failed' || r.status === 'partial') parts.push('<b>NO PROGRESS LOST</b>Retry any time. Completed missions, people and equipment stay.');
    const md = $('rs-medal');
    if (r.medal && r.medalInfo) { const mi = r.medalInfo; md.innerHTML = '<span class="medal ' + r.medal + '">' + r.medal.toUpperCase() + '</span>' + (r.newMedal ? '<b class="good">New best</b>' : '') + '<i class="' + (mi.fast ? 'ok' : '') + '">' + (mi.fast ? '✓' : '○') + ' under ' + DH.fmtTime(mi.par) + '</i><i class="' + (mi.clean ? 'ok' : '') + '">' + (mi.clean ? '✓' : '○') + ' 50 damage or less</i><i class="' + (mi.full ? 'ok' : '') + '">' + (mi.full ? '✓' : '○') + ' every optional job</i>'; md.classList.remove('hidden'); }
    else if (r.runMode === 'salvage' && r.status !== 'failed') { md.innerHTML = r.newBest ? '<b class="good">New best for ' + (r.daily ? 'today\'s Daily Haul' : 'this map') + '</b>' : '<i>Best: ' + (r.daily ? ((DH.Save.data.campaign.daily[r.daily] || {}).best || 0) : (DH.Save.data.campaign.salvageBest[r.level] || 0)) + ' scrap</i>'; md.classList.remove('hidden'); }
    else md.classList.add('hidden');
    if (r.lockerStored) parts.push('<b>WEAPON LOCKER</b>' + esc(DH.WEAPONS[r.lockerStored].name) + ' racked at the depot. It deploys with you next time.');
    sb.innerHTML = parts.join('<div style="height:6px"></div>');
    sb.classList.toggle('hidden', !parts.length);
    $('rs-garage').textContent = UI.pendingAftermath() ? 'Continue' : 'Garage';
    UI.show('scr-results');
  };
  UI.pendingAftermath = () => { const st = story(); for (let l = 1; l <= 9; l++) if (l !== 5 && st.completed[l] && !st.seen[l]) return l; return 0; };

  // ---------- Aftermath (short garage scene after a first clear) ----------
  UI.showAftermath = (level) => {
    const st = story();
    const data = DH.Story.aftermath(level, st);
    UI.af = { level, data, i: 0 };
    $('af-eyebrow').textContent = data.title || (level >= 6 ? 'ISLAND DEPOT' : 'KETTLE CREEK GARAGE');
    $('af-title').textContent = (data.sub || 'AFTERMATH').toUpperCase();
    $('af-lines').innerHTML = '';
    G.state = 'garage';
    UI.show('scr-after');
    UI.afNext();
  };
  UI.afNext = () => {
    const a = UI.af; if (!a) return;
    if (a.i >= a.data.lines.length) { UI.afDone(); return; }
    const box = $('af-lines');
    box.querySelectorAll('.af-line').forEach((e) => e.classList.add('old'));
    const ln = a.data.lines[a.i++];
    const div = document.createElement('div');
    div.className = 'af-line' + (ln.radio ? ' radio' : '');
    div.innerHTML = '<b>' + esc(ln.name) + '</b>' + esc(ln.text);
    box.appendChild(div);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    a.speaker = ln.radio ? null : ln.who;
    $('af-next').textContent = a.i >= a.data.lines.length ? (a.data.next ? 'To the mission board' : 'Continue') : 'Next';
  };
  UI.afDone = () => {
    const a = UI.af; if (!a) return;
    story().seen[a.level] = true;
    DH.Save.write();
    UI.af = null;
    UI.showGarage();
  };

  // ---------- Ferry cinematic + ending ----------
  UI.cinematic = (r) => {
    const run = G.lastRun;
    G.run = run; G.backdrop = true; G.state = 'cine';
    G.linkRun(run);
    const W = G.W, t = run.truck;
    const path = (W.ferryPath || []).map((q) => ({ x: q[0], y: q[1] }));
    UI.cine = { r, t: 0, path, i: 0, lines: ['The ramp takes the truck’s weight.', 'June waves you up the car deck.', 'The bow door swings shut behind you.'], li: -1, end: 0 };
    t.engine = true;
    UI.show(null); // the departure prompt (or any other screen) must not sit over the boarding scene
    $('cine').classList.remove('hidden');
    UI.setHud(false);
  };
  UI.cineUpdate = (dt) => {
    const c = UI.cine; if (!c) return;
    const run = G.run, t = run.truck;
    c.t += dt;
    const li = Math.min(c.lines.length - 1, Math.floor(c.t / 2.4));
    if (li !== c.li) { c.li = li; $('cine-text').textContent = c.lines[li]; }
    const wp = c.path[c.i];
    if (wp) {
      const d = M.dist(t.x, t.y, wp.x, wp.y);
      const a = Math.atan2(wp.y - t.y, wp.x - t.x);
      t.ang = M.normAng(t.ang + M.angDiff(t.ang, a) * Math.min(1, dt * 3));
      const sp = 3.2;
      if (d < 0.3) c.i++;
      else { t.x += Math.cos(t.ang) * Math.min(d, sp * dt); t.y += Math.sin(t.ang) * Math.min(d, sp * dt); t.speed = sp; }
    } else { t.speed = 0; c.end += dt; }
    t.cineA = t.y < 15.2 ? Math.max(0, (t.y - 12.6) / 2.6) : 1;
    for (const s of run.survivors) if (s.safe && c.t > 1.5) s.hidden = true;
    if (c.t > 9 || c.end > 1.6) UI.cineDone();
  };
  UI.cineDone = () => {
    const c = UI.cine; if (!c) return;
    UI.cine = null;
    $('cine').classList.add('hidden');
    DH.Audio.ui();
    // the campaign finales get their ending; other ferry departures go straight to results
    if (c.r.level === 5 || c.r.level === 10) UI.showEnding(c.r);
    else { UI.backdrop(c.r.level); UI.showResults(c.r); }
  };
  UI.showEnding = (r) => {
    const st = story();
    const lines = DH.Story.ending(st, r);
    const fin = r && r.level === 10;
    $('en-eyebrow').textContent = fin ? 'THE ISLAND LINE · LAST FERRY OUT' : 'HARBOR STREET · THE CROSSING';
    $('en-title').textContent = fin ? 'BOTH WAYS' : 'FOOTHOLD';
    $('en-lines').innerHTML = lines.map((l, i) => '<p style="animation-delay:' + (i * 0.6).toFixed(1) + 's;animation-fill-mode:backwards">' + esc(l) + '</p>').join('');
    st.endingSeen = true; DH.Save.write();
    G.state = 'results';
    UI.show('scr-ending');
  };

  // ---------- Garage / mission board ----------
  const UP_EFF = {
    quiet: 'Idle 12 m → 9 m · driving 22 m → 16.5 m',
    bumper: 'Max crash loss 20 → 13 · hit cost 4 → 2.6',
    gear: 'Heavy cargo load 3 s → 1.5 s',
    cage: 'Clinger grab 0.7 s → 1.4 s',
    tank: 'Fuel use -30%',
    flood: 'Night headlight cone 15 m → 20 m, twice as wide',
  };
  UI.showGarage = () => {
    const pend = UI.pendingAftermath();
    if (pend) { UI.showAftermath(pend); return; }
    G.state = 'garage';
    const c = DH.Save.data.campaign, st = c.story;
    const isle = !!st.completed[5];
    $('g-eyebrow').textContent = isle ? 'KETTLE CREEK GARAGE · ISLAND DEPOT' : 'KETTLE CREEK GARAGE';
    $('g-scrap').textContent = c.scrap;
    $('g-obj').textContent = DH.Story.objective(st);
    const m = st.milestones;
    const ppl = [['Marta', true, 'coordinator']];
    ppl.push(['Nell', !!m.nell, 'driver']);
    if (st.completed[1]) ppl.push(['Wes', !!m.wes, m.wes ? 'radio, on the roof' : 'radio, Hollis Ridge']);
    if (st.completed[1]) ppl.push(['Tomas', !!m.tomas, 'loader']);
    if (st.completed[2]) ppl.push(['Ada', !!m.ada, 'medic']);
    if (st.completed[3]) ppl.push(['June', !!m.relay, 'Harbor Street']);
    if (isle) { ppl.push(['Cal & Dee', !!m.dockers, 'fuel pier']); if (st.completed[6]) ppl.push(['Hale', !!m.hale, 'lighthouse']); if (st.completed[8]) ppl.push(['Pia & Sol', !!m.family, 'island']); if (st.completed[9]) ppl.push(['Rosa & Eli', !!m.holdouts, 'Kettle Creek']); }
    $('g-people').innerHTML = ppl.map((p) => '<span class="' + (p[1] ? '' : 'away') + '">' + esc(p[0]) + ' <small class="dim">' + esc(p[1] ? p[2] : p[0] === 'Wes' || p[0] === 'June' ? p[2] : 'not found yet') + '</small></span>').join('');
    // missions, in two campaigns
    const cur = DH.Story.current(st);
    let h = '';
    for (let l = 1; l <= 10; l++) {
      if (l === 1) h += '<div class="camp-h">KETTLE CREEK CAMPAIGN <span>missions 1-5</span></div>';
      if (l === 6) h += '<div class="camp-h">THE ISLAND LINE <span>' + (isle ? 'missions 6-10 · two bases' : 'opens after the crossing') + '</span></div>';
      const L = LV(l), un = DH.Save.unlocked(st, l), done = !!st.completed[l];
      if (l >= 6 && !isle && l > 6) continue;
      const okK = (k) => !!((st.optional[l] && st.optional[l][k]) || st.milestones[k]);
      const opts = (L.optionalKeys || []).map(([k, lbl]) => '<i class="' + (okK(k) ? 'ok' : '') + '">' + (okK(k) ? '✓ ' : '○ ') + esc(lbl) + '</i>').join('');
      const lb = c.levelBest[l], md = c.medals[l];
      const sub = !un ? 'Locked: complete mission ' + (l - 1) + ' first' : done ? 'Completed' + (lb && lb.fastest ? ' · best ' + DH.fmtTime(lb.fastest) : '') : L.tag || L.short;
      h += '<div class="mis ' + (!un ? 'locked' : '') + (done ? ' done' : '') + (l === cur && !st.completed[10] ? ' current' : '') + '">' +
        '<div class="mis-n">' + (done ? '✓' : l) + '</div>' +
        '<div><div class="mis-name">' + esc(L.name) + (DH.Story.base ? '<span class="mis-base">' + esc(DH.Story.base(l).toUpperCase()) + '</span>' : '') + (md ? '<span class="medal ' + md + '">' + md.toUpperCase() + '</span>' : '') + '</div><div class="mis-sub">' + esc(sub) + '</div>' + (un ? '<div class="mis-opt">' + opts + '</div>' : '') + '</div>' +
        '<div class="mis-btns">' + (un ? '<button data-deploy="' + l + '" class="' + (l === cur && !done ? 'primary' : '') + '">' + (done ? 'Replay' : 'Deploy') + '</button>' : '') + (done && l !== 5 && l !== 10 ? '<button data-debrief="' + l + '">Debrief</button>' : '') + '</div></div>';
    }
    $('g-missions').innerHTML = h;
    $('g-missions').querySelectorAll('[data-deploy]').forEach((b) => b.addEventListener('click', () => { DH.Audio.ui(); UI.briefFrom = 'garage'; UI.deploy(+b.dataset.deploy); }));
    $('g-missions').querySelectorAll('[data-debrief]').forEach((b) => b.addEventListener('click', () => { DH.Audio.ui(); UI.showAftermath(+b.dataset.debrief); }));
    UI.fillModes();
    $('g-ups').innerHTML = Object.keys(T.upgrades).filter((k) => !T.upgrades[k].c2 || isle).map((k) => {
      const u = T.upgrades[k], own = c.upgrades[k];
      return '<div class="up ' + (own ? 'owned' : '') + '"><h4>' + u.name + '</h4><p>' + u.desc + '<br><b>' + UP_EFF[k] + '</b></p>' +
        (own ? '<button disabled>Installed</button>' : '<button data-buy="' + k + '" ' + (c.scrap < u.cost ? 'disabled' : '') + '>Install · ' + u.cost + ' scrap</button>') + '</div>';
    }).join('');
    $('g-ups').querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => { const r = DH.Save.buy(b.dataset.buy); UI.toast(r.msg); DH.Audio.ui(); UI.showGarage(); }));
    const perks = DH.Story.perks(st);
    $('g-unlocks').innerHTML = Object.keys(DH.Story.UNLOCKS).filter((k) => !DH.Story.UNLOCKS[k].c2 || isle).map((k) => { const u = DH.Story.UNLOCKS[k]; return '<div class="unl ' + (perks[k] ? 'on' : '') + '"><b>' + esc(u.name) + '</b>' + esc(perks[k] ? u.desc : 'Earned by: ' + u.from) + '</div>'; }).join('');
    $('g-locker').textContent = perks.locker ? 'Weapon locker: ' + (c.locker ? DH.WEAPONS[c.locker].name + ' (deploys with you)' : 'empty. Bring a found weapon home to rack it.') : '';
    const be = c.best;
    $('g-best').textContent = 'Runs ' + be.runs + ' · successes ' + be.successes + (be.bestScrap ? ' · best haul ' + be.bestScrap + ' scrap' : '');
    $('g-deploy').textContent = 'Deploy: ' + LV(UI.deployLevel()).name;
    UI.show('scr-garage');
  };

  // Replay modes panel: night replays, modifiers, Salvage Runs, Daily Haul
  UI.fillModes = () => {
    const c = DH.Save.data.campaign, st = c.story, pr = c.prefs;
    const cleared = DH.Save.LEVELS.filter((l) => st.completed[l]);
    const box = $('g-modes');
    box.classList.toggle('hidden', !cleared.length);
    if (!cleared.length) return;
    const Md = DH.Modes;
    const mul = (() => { let m = 1; for (const k in pr.mods) if (pr.mods[k]) m *= Md.MODS[k].mult; if (pr.night) m *= T.cond.nightScrap; return Math.min(Md.MAX_MULT, Math.round(m * 100) / 100); })();
    let h = '<h4>REPLAYS &amp; MODES</h4>';
    h += '<div class="mode-row"><span class="dim">Replays of cleared missions and salvage runs:</span>' +
      '<button class="chip ' + (pr.night ? 'on' : '') + '" data-pref="night" title="Night: short sight lines both ways, flashlight. x' + T.cond.nightScrap + ' scrap">Night x' + T.cond.nightScrap + '</button>' +
      Object.keys(Md.MODS).map((k) => '<button class="chip ' + (pr.mods[k] ? 'on' : '') + '" data-mod="' + k + '" title="' + esc(Md.MODS[k].desc) + '">' + esc(Md.MODS[k].name) + ' x' + Md.MODS[k].mult + '</button>').join('') +
      '<span class="mode-note">Scrap x' + mul + (pr.mods.notruck ? ' · No Truck applies to salvage and on-foot missions only' : '') + '</span></div>';
    const opts = cleared.map((l) => '<option value="' + l + '"' + (l === UI.salvLevel ? ' selected' : '') + '>' + esc(LV(l).name) + (c.salvageBest[l] ? ' (best ' + c.salvageBest[l] + ')' : '') + '</option>').join('');
    h += '<div class="mode-row"><b>Salvage Run</b><select id="g-salv-map">' + opts + '</select><button id="g-salv">Deploy salvage</button><span class="mode-note">Endless waves. Bank scrap when you leave; lose it if you die.</span></div>';
    const d = Md.dailySpec(st), de = c.daily[d.date];
    const dm = Object.keys(d.mods).filter((k) => d.mods[k]).map((k) => Md.MODS[k].name), dc = [d.cond.night && 'Night', d.cond.rain && 'Rain', d.cond.fog && 'Fog'].filter(Boolean);
    h += '<div class="mode-row"><b>Daily Haul ' + esc(d.date) + '</b><span>' + esc(LV(d.level).name) + (dc.length ? ' · ' + esc(dc.join(', ')) : '') + (dm.length ? ' · ' + esc(dm.join(', ')) : '') + '</span><button id="g-daily">Deploy daily</button><span class="mode-note">Same map and caches for everyone today' + (de ? ' · your best ' + de.best + ' (' + de.runs + ' run' + (de.runs > 1 ? 's' : '') + ')' : '') + '</span></div>';
    box.innerHTML = h;
    box.querySelectorAll('[data-pref]').forEach((b) => b.addEventListener('click', () => { pr.night = !pr.night; DH.Save.write(); DH.Audio.ui(); UI.fillModes(); }));
    box.querySelectorAll('[data-mod]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.mod; if (pr.mods[k]) delete pr.mods[k]; else pr.mods[k] = true; DH.Save.write(); DH.Audio.ui(); UI.fillModes(); }));
    $('g-salv-map').addEventListener('change', (e) => { UI.salvLevel = +e.target.value; });
    if (!UI.salvLevel || cleared.indexOf(UI.salvLevel) < 0) UI.salvLevel = cleared[0];
    $('g-salv').addEventListener('click', () => { DH.Audio.ui(); UI.briefFrom = 'garage'; UI.deploy(UI.salvLevel, 'salvage'); });
    $('g-daily').addEventListener('click', () => { DH.Audio.ui(); UI.briefFrom = 'garage'; UI.deploy(d.level, 'daily'); });
  };

  // ---------- Settings ----------
  UI.loadSettings = () => {
    const s = DH.Save.settings();
    $('s-vol').value = s.volume; $('s-mus').value = s.music; $('s-mute').checked = s.muted; $('s-aim').checked = s.aimAssist;
    $('s-shake').checked = s.reducedShake; $('s-flash').checked = s.reducedFlashes; $('s-hints').checked = s.hints;
  };
  UI.bindSettings = () => {
    const s = () => DH.Save.settings();
    const save = () => { DH.Save.saveSettings(); DH.Audio.applySettings(); };
    $('s-vol').addEventListener('input', (e) => { s().volume = +e.target.value; save(); });
    $('s-mus').addEventListener('input', (e) => { s().music = +e.target.value; save(); });
    $('s-mute').addEventListener('change', (e) => { s().muted = e.target.checked; save(); });
    $('s-aim').addEventListener('change', (e) => { s().aimAssist = e.target.checked; save(); });
    $('s-shake').addEventListener('change', (e) => { s().reducedShake = e.target.checked; save(); });
    $('s-flash').addEventListener('change', (e) => { s().reducedFlashes = e.target.checked; save(); });
    $('s-hints').addEventListener('change', (e) => { s().hints = e.target.checked; save(); if (!e.target.checked) $('hint').classList.add('hidden'); });
  };

  // ---------- Hints ----------
  const HINTS = {
    truck: { kbm: 'At the truck: E to drive. At the tailgate: transfer cargo. With a kit: repair.', touch: 'At the truck: USE to drive. At the tailgate: transfer cargo. With a kit: repair.' },
    enemy: { kbm: 'Gunshots carry far. The crowbar (F) is quiet. G throws a noise maker to pull them away.', touch: 'Gunshots carry far. MELEE is quiet. NOISE throws a noise maker to pull them away.' },
    primaryGot: { kbm: 'Primary objective secured. Drive into an EXIT zone, or walk out through the EVAC gate.', touch: 'Primary objective secured. Drive into an EXIT zone, or walk out through the EVAC gate.' },
    alarm: { kbm: 'That red car has an alarm. Set it off (E) to drag the dead toward the intersection.', touch: 'That red car has an alarm. Set it off (USE) to drag the dead toward the intersection.' },
    clinger: { kbm: 'Clinger on the truck. Stop, step out (E), and knock it off with the crowbar or a shot.', touch: 'Clinger on the truck. Stop, EXIT, and knock it off.' },
    howler: { kbm: 'A Howler inhales before it screams. Hit it during the windup to interrupt.', touch: 'A Howler inhales before it screams. Hit it during the windup to interrupt.' },
    haul: { kbm: 'Hauling: slow, no firing. Bring it to the tailgate of the stopped truck and hold E. X lets go.', touch: 'Hauling: slow, no firing. Bring it to the tailgate of the stopped truck and hold USE. DROP lets go.' },
    water: { kbm: 'Water slows you down and every step splashes. Flooded channels stop the truck, never you.', touch: 'Water slows you down and every step splashes. Flooded channels stop the truck, never you.' },
    dark: { kbm: 'No power in here. Your flashlight follows your aim; the dead in the dark only show up close or in the beam.', touch: 'No power in here. Your flashlight follows your aim; the dead in the dark only show up close or in the beam.' },
    machine: { kbm: 'Machinery is warming up. When it runs, it pulls every nearby zombie toward it. Use it or get clear.', touch: 'Machinery is warming up. When it runs, it pulls every nearby zombie toward it. Use it or get clear.' },
    brute: { kbm: 'A Brute: the crowbar won\'t stagger it, doors won\'t stop it, and it shoves the truck. Keep your distance and shoot.', touch: 'A Brute: melee won\'t stagger it and it shoves the truck. Keep your distance and shoot.' },
    sleeper: { kbm: 'Something is lying in the water. Sleepers wake when you splash or sprint close by: walk past slowly, or wake it on your terms.', touch: 'Something is lying in the water. Sleepers wake when you splash nearby: walk past slowly.' },
    shrieker: { kbm: 'A Shrieker is winding up: every corpse in range will come to it. Shoot it before the scream ends.', touch: 'A Shrieker is winding up: shoot it before the scream ends.' },
    fuel: { kbm: 'Fuel is low. Pour a jerry can at the truck (hold E). Cans ride in your backpack or the truck bed.', touch: 'Fuel is low. Pour a jerry can at the truck (hold USE).' },
    boat: { kbm: 'The skiff: W/S throttle, A/D steer, E steps ashore near land. Its outboard pulls the crowd along the shore.', touch: 'The skiff: GAS/BRAKE, steer, EXIT near land. Its outboard pulls the crowd along the shore.' },
    convoy: { kbm: 'The second truck follows your tracks once you lead off. Load heavy gear at its tailgate (hold E). Go steady so it keeps up.', touch: 'The second truck follows your tracks. Load gear at its tailgate. Go steady.' },
  };
  const hintText = (key) => { const L = G.run ? G.L() : null; return (L && L.hints && L.hints[key]) || HINTS[key]; };
  UI.hintsReset = () => { UI.hintShown = Object.assign({}, (G.run && G.run.hints) || {}); $('hint').classList.add('hidden'); };
  UI.hint = (key) => {
    if (!DH.Save.settings().hints || !G.run) return;
    if (G.run.hints[key]) return;
    const h = hintText(key); if (!h) return;
    G.run.hints[key] = true;
    $('hint-text').textContent = DH.Input.mode === 'touch' ? h.touch : h.kbm;
    $('hint').classList.remove('hidden');
    clearTimeout(UI._ht); UI._ht = setTimeout(() => $('hint').classList.add('hidden'), document.body.classList.contains('compact') ? 6000 : 9000);
  };
  UI.checkHints = () => {
    const run = G.run; if (!run) return;
    const p = run.player, W = G.W, L = G.LR(run);
    if (!p.inTruck && DH.Truck.distToHull(p.x, p.y) < 2 && run.time > 3) UI.hint('truck');
    if (run.zombies.some((z) => !z.dead && z.visible && M.dist(z.x, z.y, p.x, p.y) < 16) && run.time > 6) UI.hint('enemy');
    if (L.primaryGot && L.primaryGot(run)) UI.hint('primaryGot');
    if (W.alarmCar && !p.inTruck && M.dist(p.x, p.y, W.alarmCar.x, W.alarmCar.y) < 9) UI.hint('alarm');
    if (run.truck.clingers.length) UI.hint('clinger');
    if (run.zombies.some((z) => z.type === 'howler' && z.state === 'howl' && z.visible)) UI.hint('howler');
    if (p.hauling) UI.hint('haul');
    if (p.wet && run.time > 2) UI.hint('water');
    if (!p.inTruck && W.dark[W.idx(Math.floor(p.x), Math.floor(p.y))]) UI.hint('dark');
    if (run.emitters.some((e) => e.on && e.warm > 0)) UI.hint('machine');
    if (run.zombies.some((z) => z.type === 'brute' && !z.dead && z.visible)) UI.hint('brute');
    if (run.zombies.some((z) => z.type === 'sleeper' && z.dormant && z.visible)) UI.hint('sleeper');
    if (run.zombies.some((z) => z.type === 'shrieker' && z.state === 'shriek' && z.visible)) UI.hint('shrieker');
    if (DH.Fuel.on(run) && run.truck.fuel < T.fuel.low) UI.hint('fuel');
    if (run.boat && M.dist(p.x, p.y, run.boat.x, run.boat.y) < 6) UI.hint('boat');
    if (run.convoy && run.time > 4) UI.hint('convoy');
  };

  // ---------- Minimap ----------
  UI.buildMapBase = () => {
    const W = G.W, k = 3;
    if (!W) return;
    const c = document.createElement('canvas'); c.width = 240 * k; c.height = 120 * k + 4;
    const x = c.getContext('2d');
    x.setTransform(k, k / 2, -k, k / 2, 120 * k, 2);
    const F = DH.FLOOR;
    for (let y = 0; y < W.N; y++) for (let xx = 0; xx < W.N; xx++) {
      const i = W.idx(xx, y), f = W.floor[i];
      let col = '#1b211a';
      if (f === F.ROAD) col = '#4a4c50'; else if (f === F.WALK || f === F.FORECOURT || f === F.QUAY) col = '#35363a'; else if (f === F.LOT || f === F.GRAVEL || f === F.DIRT || f === F.METAL) col = '#3a3b3e';
      else if (f === F.WATER) col = '#24414e'; else if (f === F.SEA) col = '#0e2230'; else if (f === F.VOID) col = '#07090c'; else if (f === F.DOCK) col = '#4a3e30'; else if (f === F.FROST) col = '#55606a'; else if (f === F.TRENCH) col = '#2a2c2a';
      if (W.bld[i]) col = '#5b5148';
      if (W.wall[i]) { const mi = DH.MAT_INFO[W.wall[i]]; col = mi.see ? '#5b6066' : W.wall[i] === 5 ? '#6d6a62' : W.wall[i] === 14 ? '#4a4840' : W.wall[i] >= 16 && W.wall[i] <= 21 && W.wall[i] !== 19 && W.wall[i] !== 20 ? '#6a5040' : '#8a7c6c'; }
      x.fillStyle = col; x.fillRect(xx, y, 1.02, 1.02);
    }
    for (const z of W.exits) { x.fillStyle = z.kind === 'foot' ? 'rgba(127,227,160,0.7)' : z.kind === 'ferry' ? 'rgba(120,210,255,0.75)' : 'rgba(255,211,106,0.75)'; x.fillRect(z.x1, z.y1, z.x2 - z.x1, z.y2 - z.y1); }
    for (const z of W.safeZones) { x.strokeStyle = 'rgba(127,227,160,0.8)'; x.lineWidth = 0.6; x.strokeRect(z.x1, z.y1, z.x2 - z.x1, z.y2 - z.y1); }
    UI.mapBase = c; UI.mapK = k; UI.mapW = W;
  };
  DH.bus.on('worldChanged', () => { if (document.getElementById('minimap')) UI.buildMapBase(); });
  const mpt = (wx, wy) => [(wx - wy) * UI.mapK + 120 * UI.mapK, (wx + wy) * UI.mapK / 2 + 2];
  const drawMarkers = (x, sc, run, labels) => {
    const W = G.W, L = G.LR(run);
    const dot = (wx, wy, col, r, sq) => { const p = mpt(wx, wy); x.fillStyle = col; x.beginPath(); if (sq) x.rect(p[0] - r, p[1] - r, r * 2, r * 2); else x.arc(p[0], p[1], r, 0, 7); x.fill(); };
    // flood channels (current state)
    for (const g of W.gates) {
      if (g.kind !== 'flood') continue;
      const onG = run.gates[g.id] && run.gates[g.id].on;
      for (const r of g.rects) {
        const a = mpt(r[0], r[1]), b = mpt(r[2] + 1, r[1]), c = mpt(r[2] + 1, r[3] + 1), d = mpt(r[0], r[3] + 1);
        x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineTo(c[0], c[1]); x.lineTo(d[0], d[1]); x.closePath();
        x.fillStyle = onG ? 'rgba(74,150,187,0.75)' : 'rgba(74,150,187,0.15)'; x.fill();
        x.strokeStyle = 'rgba(140,214,255,0.8)'; x.lineWidth = 1 / sc; x.stroke();
      }
      if (labels && g.short) { const cxy = g.rects[0]; const p = mpt((cxy[0] + cxy[2]) / 2, (cxy[1] + cxy[3]) / 2); x.font = 'bold ' + Math.round(10 / sc) + 'px system-ui'; x.textAlign = 'center'; x.fillStyle = '#8cd6ff'; x.fillText(g.short + (onG ? ' (flooded)' : ' (dry)'), p[0], p[1]); }
    }
    for (const l of W.landmarks) if (run.discovered[l.id] && labels) { const p = mpt(l.x, l.y); x.font = 'bold ' + Math.round(11 / sc) + 'px system-ui'; x.textAlign = 'center'; x.fillStyle = 'rgba(0,0,0,.7)'; x.fillText(l.name, p[0] + 1 / sc, p[1] + 1 / sc); x.fillStyle = '#e9e4d8'; x.fillText(l.name, p[0], p[1]); }
    for (const z of W.exits) { const open = G.exitOpen(z); const p = mpt((z.x1 + z.x2) / 2, (z.y1 + z.y2) / 2); if (labels) { x.font = 'bold ' + Math.round(10 / sc) + 'px system-ui'; x.textAlign = 'center'; x.fillStyle = z.kind === 'foot' ? '#7fe3a0' : z.kind === 'ferry' ? '#8cd6ff' : '#ffd36a'; x.fillText(z.kind === 'foot' ? 'EVAC' : z.kind === 'ferry' ? (open ? 'FERRY' : 'FERRY (ramp up)') : 'EXIT', p[0], p[1] - 6 / sc); } dot((z.x1 + z.x2) / 2, (z.y1 + z.y2) / 2, z.kind === 'foot' ? '#7fe3a0' : z.kind === 'ferry' ? '#8cd6ff' : '#ffd36a', 4 / sc, true); }
    if (L.markers) L.markers(run, (wx, wy, col, r, sq) => dot(wx, wy, col, r / sc, sq));
    for (const s of run.survivors) {
      if (s.hidden || s.boarded) continue;
      if (!s.recruited && (s.known || (s.landmark && run.discovered[s.landmark]))) dot(s.x, s.y, '#7fe3a0', 3 / sc);
      if (s.recruited) dot(s.x, s.y, s.safe ? 'rgba(127,227,160,.6)' : '#7fe3a0', 3.5 / sc);
    }
    for (const id in run.items) { const it = run.items[id]; if (DH.Cargo.heavy(it) && (run.seen[id] || it.known) && (it.loc === 'world' || it.loc === 'hauled')) dot(it.x, it.y, DH.ITEMS[it.kind].primary ? '#ff6b5a' : '#e0ad2a', 3.5 / sc, true); }
    const t = run.truck; dot(t.x, t.y, '#f0b54a', 5 / sc);
    if (run.convoy) dot(run.convoy.x, run.convoy.y, run.convoy.disabled ? '#ff5a46' : '#8cd6ff', 4.5 / sc);
    if (run.boat && !run.player.inBoat) dot(run.boat.x, run.boat.y, '#8cd6ff', 3.5 / sc, true);
    // Lighthouse Watch: early crowd sightings
    if (run.perks && run.perks.watch && run.time < 60) { const pp0 = DH.Player.pos(); for (const z of run.zombies) if (!z.dead && !z.dormant && M.dist(z.x, z.y, pp0.x, pp0.y) < 30) dot(z.x, z.y, 'rgba(255,90,70,.75)', 2 / sc); }
    const pp = DH.Player.pos(); const p = mpt(pp.x, pp.y);
    x.fillStyle = '#8cd6ff'; x.strokeStyle = '#000'; x.lineWidth = 1 / sc; x.beginPath(); x.arc(p[0], p[1], 4.5 / sc, 0, 7); x.fill(); x.stroke();
    const a = run.player.inTruck ? t.ang : run.player.aim; const dx = Math.cos(a), dy = Math.sin(a); const q = [(dx - dy), (dx + dy) / 2]; const l = Math.hypot(q[0], q[1]) || 1;
    x.strokeStyle = '#8cd6ff'; x.lineWidth = 2 / sc; x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(p[0] + (q[0] / l) * 11 / sc, p[1] + (q[1] / l) * 11 / sc); x.stroke();
  };
  UI.drawMinimap = () => {
    const run = G.run; if (!run) return;
    if (!UI.mapBase || UI.mapW !== G.W) UI.buildMapBase();
    const cv = $('minimap'); const d = Math.min(2, window.devicePixelRatio || 1);
    const cw = cv.clientWidth || 150;
    if (cv.width !== Math.round(cw * d)) { cv.width = Math.round(cw * d); cv.height = Math.round(cw * d); }
    const x = cv.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height);
    const pp = DH.Player.pos(); const p = mpt(pp.x, pp.y);
    const sc = (cv.width / 150) * 0.95;
    x.setTransform(sc, 0, 0, sc, cv.width / 2 - p[0] * sc, cv.height / 2 - p[1] * sc);
    x.drawImage(UI.mapBase, 0, 0);
    drawMarkers(x, sc, run, false);
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = 'rgba(233,228,216,.6)'; x.font = Math.round(9 * d) + 'px system-ui'; x.fillText('N↗', cv.width - 18 * d, 12 * d);
  };
  UI.drawBigMap = () => {
    const run = G.run; if (!run) return;
    if (!UI.mapBase || UI.mapW !== G.W) UI.buildMapBase();
    $('map-title').textContent = G.W.mapTitle || LV(run.level).name.toUpperCase();
    const cv = $('bigmap'); const x = cv.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#0b0d10'; x.fillRect(0, 0, cv.width, cv.height);
    const sc = Math.min(cv.width / UI.mapBase.width, cv.height / UI.mapBase.height) * 0.96;
    x.setTransform(sc, 0, 0, sc, (cv.width - UI.mapBase.width * sc) / 2, (cv.height - UI.mapBase.height * sc) / 2);
    x.drawImage(UI.mapBase, 0, 0);
    drawMarkers(x, sc, run, true);
  };

  // ---------- HUD update ----------
  const setText = (id, v) => { if (UI.last[id] !== v) { UI.last[id] = v; $(id).textContent = v; } };
  const setStyle = (id, prop, v) => { const k = id + prop; if (UI.last[k] !== v) { UI.last[k] = v; $(id).style[prop] = v; } };
  const setClass = (id, cls, on2) => { const k = id + '.' + cls; if (UI.last[k] !== on2) { UI.last[k] = on2; $(id).classList.toggle(cls, on2); } };
  const unitsHtml = (items, cap) => { let h = ''; let used = 0; for (const it of items) { const u = DH.Cargo.units(it); for (let k = 0; k < u; k++) h += '<i class="' + it.kind + '"></i>'; used += u; } for (let k = used; k < cap; k++) h += '<i></i>'; return h; };
  const OBJ_IDS = ['obj-main', 'obj-surv', 'obj-gen', 'obj-salv'];
  UI.update = (dt) => {
    const run = G.run;
    const playing = G.state === 'play';
    if (G.state === 'cine') UI.cineUpdate(dt);
    if (UI.cur === 'scr-garage' || UI.cur === 'scr-after') {
      UI.sceneT = (UI.sceneT || 0) - dt;
      if (UI.sceneT <= 0) { UI.sceneT = 1 / 20; DH.Garage.draw($(UI.cur === 'scr-garage' ? 'g-scene' : 'af-scene'), story(), { speaker: UI.af && UI.af.speaker }); }
    }
    const touchOn = DH.Input.mode === 'touch' && playing && !!run;
    setClass('touch', 'hidden', !touchOn);
    document.body.classList.toggle('touch', DH.Input.mode === 'touch');
    const compact = DH.Input.mode === 'touch' || window.innerHeight <= 560;
    if (UI.last.compact !== compact) { UI.last.compact = compact; document.body.classList.toggle('compact', compact); }
    const portrait = window.innerHeight > window.innerWidth * 1.05;
    const coarse = DH.Input.mode === 'touch' || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (portrait && coarse && playing) { UI.pause('rotate'); UI.rotateShown = true; }
    setClass('rotate', 'hidden', !(portrait && coarse && UI.rotateShown && G.state === 'paused' && UI.cur === 'scr-pause' && !UI.rotateDismissed));
    if (!portrait) { UI.rotateShown = false; UI.rotateDismissed = false; }
    if (!run || G.backdrop) return;
    if (G.state !== 'play' && G.state !== 'paused' && G.state !== 'map' && G.state !== 'confirm') return;
    const p = run.player, t = run.truck, L = G.LR(run);
    setStyle('hp-fill', 'width', Math.max(0, p.hp) + '%');
    setText('hp-num', String(Math.ceil(p.hp)));
    const w = DH.Player.weapon();
    if (w) { const def = DH.WEAPONS[w.type]; setText('w-name', def.name); setText('w-ammo', (p.reload > 0 ? 'RELOAD ' : '') + w.mag + '/' + p.ammo[def.ammo]); }
    const other = p.weapons.length > 1 ? p.weapons[1 - p.cur] : null;
    setText('w-alt', other ? 'Q ' + DH.WEAPONS[other.type].name : '+crowbar');
    setText('s-med', String(p.medkits)); setText('s-nm', String(p.noisemakers)); setText('s-rk', String(p.repairkits));
    const bp = DH.Cargo.list(run, 'backpack');
    const bpKey = bp.map((i) => i.id).join(',');
    if (UI.last.bp !== bpKey) { UI.last.bp = bpKey; $('pack-units').innerHTML = unitsHtml(bp, T.cargo.backpack); }
    setText('pack-num', DH.Cargo.used(run, 'backpack') + '/' + T.cargo.backpack);
    const nl = p.noiseLevel;
    setStyle('noise-fill', 'width', Math.min(100, (nl / 28) * 100) + '%');
    setText('noise-lbl', nl < 1 ? 'quiet' : nl < 4 ? 'low' : nl < 10 ? 'loud' : 'very loud');
    // objectives (level-defined lines)
    const objs = L.objectives(run);
    OBJ_IDS.forEach((id, k) => {
      const o = objs[k];
      setClass(id, 'hidden', !o);
      if (!o) return;
      if (UI.last['ot' + k] !== o.text) { UI.last['ot' + k] = o.text; $(id).innerHTML = '<i></i><span>' + esc(o.text) + '</span>'; }
      setClass(id, 'done', !!o.done); setClass(id, 'fail', !!o.fail); setClass(id, 'opt', k > 0 && o.opt !== false);
    });
    // truck panel
    const nearTruck = !p.inTruck && DH.Truck.distToHull(p.x, p.y) < 10;
    const fuelOn = DH.Fuel.on(run);
    const showTruck = p.inTruck || nearTruck || t.dur < T.truck.durability || t.clingers.length > 0 || DH.Cargo.used(run, 'truck') > 0 || (fuelOn && t.fuel < T.fuel.low);
    setClass('truck-panel', 'hidden', !showTruck);
    const pas = DH.Survivor.passenger();
    if (showTruck) {
      setStyle('tr-fill', 'width', (t.dur / T.truck.durability) * 100 + '%');
      setText('tr-num', String(Math.ceil(t.dur)));
      const tl = DH.Cargo.list(run, 'truck');
      const tk = tl.map((i) => i.id).join(',');
      if (UI.last.tk !== tk) { UI.last.tk = tk; $('bed-units').innerHTML = unitsHtml(tl, T.cargo.truck); }
      setText('bed-num', DH.Cargo.used(run, 'truck') + '/' + T.cargo.truck);
      setText('cl-num', String(t.clingers.length));
      setClass('fuel-row', 'hidden', !fuelOn);
      if (fuelOn) { setStyle('fuel-fill', 'width', (t.fuel / t.fuelCap) * 100 + '%'); setText('fuel-num', String(Math.ceil(t.fuel))); setClass('fuel-row', 'low', t.fuel < T.fuel.low); }
      setText('tr-state', t.disabled ? 'DISABLED' : p.inTruck ? (t.engine ? 'engine running' + (pas ? ' · ' + pas.name + ' aboard' : '') : '') : pas ? pas.name + ' aboard' : 'engine off');
      setClass('cl-row', 'hidden', t.clingers.length === 0 && !t.disabled);
    }
    // messages (radio lines carry a speaker tag)
    const mk = G.msgs.map((m) => m.text).join('|');
    if (UI.last.msgs !== mk) { UI.last.msgs = mk; $('msgs').innerHTML = G.msgs.map((m) => '<div class="msg ' + m.kind + '">' + (m.who ? '<b>' + esc(m.who.toUpperCase()) + '</b>' : '') + esc(m.text) + '</div>').join(''); }
    const ck = G.cues.map((c) => c.label + Math.round(c.x) + Math.round(c.y)).join('|');
    if (UI.last.cues !== ck) {
      UI.last.cues = ck;
      const pp = DH.Player.pos();
      $('subs').innerHTML = G.cues.map((c) => { const s = DH.R.toScreen(c.x, c.y, 0), o = DH.R.toScreen(pp.x, pp.y, 0); const a = Math.atan2(s.y - o.y, s.x - o.x); const dirs = ['right', 'down-right', 'below', 'down-left', 'left', 'up-left', 'above', 'up-right']; const di = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8; return '<div>[' + esc(c.label.toLowerCase()) + ' — ' + dirs[di] + ']</div>'; }).join('');
    }
    const I = DH.Interact;
    const pr = !p.inTruck && !p.inBoat && I.primary && playing && !G.transferOpen;
    setClass('prompt', 'hidden', !pr);
    if (pr) {
      const key = DH.Input.mode === 'touch' ? (I.primary.hold ? 'HOLD USE' : 'USE') : I.primary.hold ? 'Hold E' : 'E';
      setText('prompt-key', key);
      setText('prompt-text', I.primary.label.replace(/^Hold E: /, ''));
      setClass('prompt-main', 'disabled', !!I.primary.disabled);
      const ak = I.alts.map((a) => a.label + (a.disabled ? '!' : '')).join('|');
      if (UI.last.alts !== ak) {
        UI.last.alts = ak;
        const box = $('prompt-alts'); box.innerHTML = '';
        I.alts.forEach((a, i) => { const b = document.createElement('button'); b.innerHTML = (DH.Input.mode === 'touch' ? '' : '<kbd>' + (i + 1) + '</kbd>') + esc(a.label); b.disabled = !!a.disabled; b.addEventListener('pointerdown', (e) => { e.preventDefault(); DH.Input.pressed.add('T:alt' + (i + 1)); if (a.hold) DH.Input.touch.held.add('interact'); }); b.addEventListener('pointerup', () => DH.Input.touch.held.delete('interact')); b.addEventListener('pointercancel', () => DH.Input.touch.held.delete('interact')); box.appendChild(b); });
      }
    }
    setClass('btn-depart', 'hidden', !(G.inExit && playing));
    setClass('btn-recover', 'hidden', !(p.inTruck && t.stuckT > 1.0 && playing && Math.abs(t.speed) < 0.4));
    setClass('transfer', 'hidden', !(G.transferOpen && playing));
    if (G.transferOpen) {
      const key = Object.values(run.items).map((i) => i.id + i.loc).join(',');
      if (UI.last.tf !== key) {
        UI.last.tf = key;
        const mkList = (loc, to) => DH.Cargo.list(run, loc).filter((i) => !DH.Cargo.heavy(i)).map((i) => '<button data-tf="' + i.id + '" data-to="' + to + '">' + (to === 'truck' ? '→ ' : '← ') + esc(DH.Cargo.label(i)) + '</button>').join('') || '<span class="dim small">Empty</span>';
        $('tf-bp').innerHTML = mkList('backpack', 'truck');
        $('tf-tr').innerHTML = mkList('truck', 'backpack') + DH.Cargo.heavyInTruck(run).map((i) => '<span class="dim small">' + esc(DH.Cargo.label(i)) + ' (3 units): unload at the tailgate</span>').join('');
        $('tf-bp-n').textContent = DH.Cargo.used(run, 'backpack') + '/' + T.cargo.backpack;
        $('tf-tr-n').textContent = DH.Cargo.used(run, 'truck') + '/' + T.cargo.truck;
        $('transfer').querySelectorAll('[data-tf]').forEach((b) => b.addEventListener('click', () => DH.Interact.transfer(b.dataset.tf, b.dataset.to)));
      }
    }
    if (touchOn) {
      const veh = !!(p.inTruck || p.inBoat);
      setClass('touch', 'driving', veh);
      setClass('tb-foot', 'hidden', veh);
      setClass('tb-drive', 'hidden', !veh);
      setClass('tb-drop', 'hidden', !p.hauling);
      setClass('tb-melee', 'hidden', p.hauling);
      setClass('tb-cmd', 'hidden', !run.survivors.some((s) => s.recruited && !s.safe));
      const wdef = w ? DH.WEAPONS[w.type] : null;
      setClass('tb-reload', 'off', !w || p.hauling || w.mag >= wdef.mag || p.ammo[wdef.ammo] <= 0);
      setClass('tb-swap', 'off', p.weapons.length < 2 || p.hauling);
      setClass('tb-heal', 'off', p.medkits <= 0 || p.hp >= T.player.hp || p.hauling);
      setClass('tb-noise', 'off', p.noisemakers <= 0 || p.hauling);
      setClass('tb-use', 'off', !I.primary && !p.hauling && !p.action);
    }
    const hv = p.hurtT > 0 ? Math.min(1, p.hurtT * 3) * (DH.Save.settings().reducedFlashes ? 0.35 : 0.8) : (p.hp < 30 ? 0.25 : 0);
    setStyle('hurt', 'boxShadow', 'inset 0 0 140px rgba(200,20,10,' + hv.toFixed(2) + ')');
    UI.mmT = (UI.mmT || 0) - dt;
    if (UI.mmT <= 0) { UI.mmT = 0.066; UI.drawMinimap(); }
    UI.hintT = (UI.hintT || 0) - dt;
    if (UI.hintT <= 0 && playing) { UI.hintT = 0.5; UI.checkHints(); }
  };

  // ---------- Wiring ----------
  UI.init = () => {
    UI.buildMapBase();
    on('b-new', () => UI.deploy());
    on('b-resume', () => UI.resumeSaved());
    on('b-garage', () => UI.showGarage());
    on('b-settings', () => UI.openSub('scr-settings'));
    on('b-help', () => UI.openSub('scr-help'));
    on('b-go', () => UI.startPlay());
    on('b-brief-back', () => { if (G.run && G.run.time === 0) DH.Save.clearRun(); if (UI.briefFrom === 'garage') { UI.backdrop(G.levelId); UI.showGarage(); } else UI.toTitle(); });
    on('p-resume', () => UI.resume());
    on('p-settings', () => UI.openSub('scr-settings'));
    on('p-help', () => UI.openSub('scr-help'));
    on('p-restart', () => UI.confirm('RESTART RUN?', 'This run ends with no rewards and a fresh deployment of the same mission starts. Campaign progress is kept.', () => { const l = G.run ? G.run.level : undefined, k = G.run && G.run.daily ? 'daily' : G.run && G.run.mode === 'salvage' ? 'salvage' : null; DH.Save.clearRun(); UI.newRun(l, k); }));
    on('p-quit', () => { UI.saveRun(); UI.toTitle(); });
    on('s-back', () => UI.closeSub());
    on('h-back', () => UI.closeSub());
    on('cf-yes', () => { const f = UI.cfYes; UI.cfYes = null; if (f) f(); });
    on('cf-no', () => UI.show(UI.cfReturn || 'scr-title'));
    on('dp-go', () => G.acceptDepart());
    on('dp-cancel', () => { G.cancelDepart(); G.state = 'play'; UI.show(null); DH.Input.clear(); });
    on('rs-garage', () => UI.showGarage());
    on('rs-again', () => UI.newRun(UI.lastResult ? UI.lastResult.level : undefined, UI.lastResult && UI.lastResult.daily ? 'daily' : UI.lastResult && UI.lastResult.runMode === 'salvage' ? 'salvage' : null));
    on('rs-totitle', () => UI.toTitle());
    on('g-deploy', () => { UI.briefFrom = 'garage'; UI.deploy(); });
    on('g-title', () => UI.toTitle());
    on('g-reset', () => UI.confirm('RESET ALL PROGRESS?', 'Scrap, upgrades, missions, people and any saved run will be erased. Settings are kept. This cannot be undone.', () => { DH.Save.resetAll(); UI.toast('Progress reset.'); UI.toTitle(); }));
    on('af-next', () => UI.afNext());
    on('af-skip', () => UI.afDone());
    on('en-go', () => { if (UI.lastResult) { UI.backdrop(UI.lastResult.level); UI.showResults(UI.lastResult); } else UI.showGarage(); });
    on('cine-skip', () => UI.cineDone());
    on('map-x', () => UI.toggleMap());
    $('minimap').addEventListener('click', () => { if (G.state === 'play') UI.toggleMap(); });
    $('hud-obj').addEventListener('click', () => { if (document.body.classList.contains('compact')) $('hud-obj').classList.toggle('open'); });
    on('btn-map', () => UI.toggleMap());
    on('hint-x', () => $('hint').classList.add('hidden'));
    on('drivehelp-x', () => $('drivehelp').classList.add('hidden'));
    on('tf-x', () => { G.transferOpen = false; });
    on('tf-stow', () => DH.Interact.stowAll());
    on('tf-take', () => DH.Interact.takeAll());
    on('rot-menu', () => { UI.rotateDismissed = true; });
    $('btn-depart').addEventListener('click', () => { if (G.inExit) G.openDepart(G.inExit); });
    $('btn-recover').addEventListener('click', () => DH.Truck.recover());
    $('b-garage').addEventListener('click', () => { UI.briefFrom = 'garage'; });
    $('b-new').addEventListener('click', () => { UI.briefFrom = 'title'; });
    UI.bindSettings();
    DH.Input.bindStick($('zone-move'), 'move', $('knob-move'), $('stick-move'));
    DH.Input.bindStick($('zone-aim'), 'aim', $('knob-aim'), $('stick-aim'));
    document.querySelectorAll('#touch .tb').forEach((b) => {
      const act = b.dataset.act;
      if (act === 'map' || act === 'pause' || act === 'sprint') {
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); DH.Audio.init(); if (act === 'map') UI.toggleMap(); else if (act === 'pause') UI.pause(); else DH.Input.sprintToggle = !DH.Input.sprintToggle; });
      } else DH.Input.bindButton(b, act);
    });
    DH.bus.on('key', (code) => {
      if (code === 'Escape') {
        if (G.state === 'play') { if (G.transferOpen) G.transferOpen = false; else UI.pause(); }
        else if (G.state === 'paused' && UI.cur === 'scr-pause') UI.resume();
        else if (G.state === 'map') UI.toggleMap();
        else if (G.state === 'confirm') { G.cancelDepart(); G.state = 'play'; UI.show(null); }
        else if (G.state === 'cine') UI.cineDone();
        else if (UI.cur === 'scr-settings' || UI.cur === 'scr-help') UI.closeSub();
      }
      if (code === 'Tab' && (G.state === 'play' || G.state === 'map')) UI.toggleMap();
      if (G.state === 'play' && G.transferOpen && (code === 'Digit1' || code === 'Digit2')) { DH.Input.pressed.delete(code); if (code === 'Digit1') DH.Interact.stowAll(); else DH.Interact.takeAll(); }
      if (G.state === 'confirm' && code === 'Enter') { DH.Input.pressed.delete('Enter'); G.acceptDepart(); }
      if (UI.cur === 'scr-after' && (code === 'Enter' || code === 'Space')) UI.afNext();
    });
    DH.bus.on('truckIntro', () => { $('hint').classList.add('hidden'); $('drivehelp').classList.remove('hidden'); clearTimeout(UI._dh); UI._dh = setTimeout(() => $('drivehelp').classList.add('hidden'), 12000); });
    DH.bus.on('exitTruck', () => $('drivehelp').classList.add('hidden'));
    DH.bus.on('playerHurt', () => { if (DH.FX) DH.FX.shake(0.25); });
    DH.bus.on('confirmClosed', () => {});
    window.addEventListener('resize', () => { UI.last = {}; });
  };
})();
