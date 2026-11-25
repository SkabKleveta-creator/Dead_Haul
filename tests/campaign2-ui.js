// Browser flow for the Island Line (Playwright + Chromium, built dist/index.html), starting from a save that has
// finished Kettle Creek (missions 1-5): board -> briefing -> play -> results -> aftermath for missions 6-9, the
// Night Ferry boarding (results, no ending), the Long Haul convoy cinematic -> second ending, then the replay
// modes: night replay with a modifier and a medal, a Salvage Run and the Daily Haul, and reload persistence.
// Gameplay is the same normal-input bot as tests/campaign.js, running against the page's own simulation.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const URL = 'file://' + path.resolve(__dirname, '../dist/index.html');
const BOT = fs.readFileSync(path.join(__dirname, 'campaign.js'), 'utf8');
const SHOTS = path.join(__dirname, '../screenshots');
const rows = [];
const rec = (name, ok, notes) => { rows.push({ name, status: ok ? 'PASS' : 'FAIL', notes }); console.log((ok ? 'PASS' : 'FAIL').padEnd(6), name, '-', notes); };

// a finished Kettle Creek campaign, as the game itself would have saved it
const SAVE = {
  v: 3,
  campaign: {
    scrap: 400, upgrades: { quiet: false, bumper: true, gear: false },
    settings: { volume: 0, music: 0, muted: true, aimAssist: true, reducedShake: true, reducedFlashes: false, hints: false },
    best: { bestScrap: 140, fastestSuccess: 90, successes: 5, runs: 5 }, levelBest: {}, recentRunIds: [], history: [],
    story: {
      completed: { 1: true, 2: true, 3: true, 4: true, 5: true }, firstClear: { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e' },
      milestones: { nell: true, generator: true, refrigeration: true, medstock: true, tomas: true, water: true, ada: true, relay: true, wes: true, crossing: true },
      outcomes: { 3: { setting: 'B' }, 5: { stranded: 2, supplies: 1, crossing: true } }, optional: {}, seen: { 1: true, 2: true, 3: true, 4: true }, endingSeen: true, log: [], selected: 6,
    },
  },
  active: null,
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL); await page.waitForTimeout(500);
  await page.evaluate((s) => { localStorage.setItem('skab.deadhaul.v1', JSON.stringify(s)); }, SAVE);
  await page.reload(); await page.waitForTimeout(700);
  const E = (fn, arg) => page.evaluate(fn, arg);
  const vis = (id) => E((i) => { const e = document.getElementById(i); return !!e && !e.classList.contains('hidden') && e.offsetParent !== null; }, id);
  const injectBot = () => E((src) => {
    const blankInput = () => ({ move: { x: 0, y: 0 }, aimWorld: null, aimDir: null, fire: false, firePressed: false, melee: false, reload: false, swap: false, interactPressed: false, interactHeld: false, throwN: false, heal: false, command: false, sprint: false, drop: false, alt: [false, false, false], drive: { throttle: 0, brake: 0, steer: 0, handbrake: false }, depart: false, recover: false });
    const module = { exports: {} };
    new Function('require', 'module', src)(() => ({ blankInput, load: () => null }), module);
    window.BOT = module.exports;
    return !!window.BOT.runLevel;
  }, BOT);
  const play = (lv, va, sd) => E(([l, v, s]) => {
    DH.debug.manual = true; DH.Save.settings().hints = false;
    const r = window.BOT.runLevel({ DH }, l, window.BOT.S[l][v], { seed: s, variant: v, useCurrent: true });
    DH.debug.manual = false;
    return { status: r.status, mode: r.mode, time: r.time, steps: r.steps.slice(-160), out: r.survivorsOut, state: DH.G.state };
  }, [lv, va, sd]);

  // 1. title and board after the first campaign
  const t0 = await E(() => ({ btn: document.getElementById('b-new').textContent, obj: document.getElementById('t-obj').textContent }));
  await page.click('#b-garage'); await page.waitForTimeout(300);
  const b0 = await E(() => ({ cards: document.querySelectorAll('#g-missions .mis').length, heads: [...document.querySelectorAll('.camp-h')].map((h) => h.textContent), deploy: [...document.querySelectorAll('[data-deploy]')].map((b) => b.dataset.deploy), modes: !document.getElementById('g-modes').classList.contains('hidden'), ups: document.querySelectorAll('#g-ups .up').length, unl: document.querySelectorAll('#g-unlocks .unl').length, eyebrow: document.getElementById('g-eyebrow').textContent }));
  await page.screenshot({ path: path.join(SHOTS, 'ui-c2-board.png') });
  rec('After Last Crossing: title and board point at Landfall; Island Line section, base labels, new workshop and unlocks', /Landfall/.test(t0.btn) && /landfall|depot/i.test(t0.obj) && b0.cards === 10 && b0.heads.length === 2 && b0.deploy.indexOf('6') >= 0 && b0.deploy.indexOf('7') < 0 && b0.modes && b0.ups === 6 && b0.unl === 12 && /ISLAND DEPOT/.test(b0.eyebrow),
    `title "${t0.btn}"; ${b0.cards} cards, sections [${b0.heads.map((h) => h.slice(0, 22))}], deploy [${b0.deploy}], modes panel=${b0.modes}, ${b0.ups} upgrades, ${b0.unl} unlocks`);

  await injectBot();
  const plan = [[6, 'rescue', 2], [7, 'rescue', 1], [8, 'rescue', 1], [9, 'rescue', 1], [10, 'rescue', 1]];
  for (const [level, variant, seed] of plan) {
    await page.click('[data-deploy="' + level + '"]'); await page.waitForTimeout(250);
    const br = await E(() => ({ title: document.getElementById('brief-title').textContent, words: document.getElementById('brief-text').textContent.split(/\s+/).length, eyebrow: document.getElementById('brief-eyebrow').textContent, meta: document.getElementById('brief-meta').textContent }));
    await page.click('#b-go'); await page.waitForTimeout(600);
    const playing = await E(() => DH.G.state === 'play' && DH.G.run && DH.G.run.level);
    const hud = await E(() => ({ fuel: !document.getElementById('fuel-row').classList.contains('hidden') || !DH.Fuel.on(DH.G.run), night: !!(DH.G.run.cond && DH.G.run.cond.night) }));
    await page.screenshot({ path: path.join(SHOTS, 'ui-m' + level + '-start.png') });
    const res = await play(level, variant, seed);
    if (level < 10) {
      if (level === 8) { for (let k = 0; k < 50 && !(await vis('scr-results')); k++) await page.waitForTimeout(250); }
      await page.waitForTimeout(300);
      const rs = await E(() => ({ title: document.getElementById('rs-title').textContent, story: document.getElementById('rs-story').textContent, medal: document.getElementById('rs-medal').textContent, btn: document.getElementById('rs-garage').textContent, ending: !document.getElementById('scr-ending').classList.contains('hidden') }));
      await page.screenshot({ path: path.join(SHOTS, 'ui-m' + level + '-results.png') });
      await page.click('#rs-garage'); await page.waitForTimeout(250);
      const afVisible = await vis('scr-after');
      const afTitle = await E(() => document.getElementById('af-eyebrow').textContent);
      const lines = [];
      for (let k = 0; k < 12 && await vis('scr-after'); k++) { lines.push(await E(() => { const l = [...document.querySelectorAll('#af-lines .af-line')].pop(); return l ? l.textContent : ''; })); if (k === 1) await page.screenshot({ path: path.join(SHOTS, 'ui-m' + level + '-aftermath.png') }); await page.click('#af-next'); await page.waitForTimeout(120); }
      const board = await E(() => ({ shown: !document.getElementById('scr-garage').classList.contains('hidden'), deploy: [...document.querySelectorAll('[data-deploy]')].map((b) => b.dataset.deploy), done: document.querySelectorAll('#g-missions .mis.done').length, next: document.getElementById('g-deploy').textContent, medals: document.querySelectorAll('#g-missions .medal').length }));
      rec(`M${level} ${br.title}: board -> briefing -> play -> results -> aftermath -> board`, playing === level && br.words <= 95 && res.status === 'success' && /MISSION COMPLETE/.test(rs.title) && /unlocked/i.test(rs.story) && /BRONZE|SILVER|GOLD/.test(rs.medal) && !rs.ending && afVisible && /ISLAND DEPOT/.test(afTitle) && lines.length >= 4 && board.shown && board.deploy.indexOf(String(level + 1)) >= 0 && board.done === level && hud.fuel && (level !== 8 || hud.night),
        `briefing ${br.words} words, "${br.eyebrow}"; bot ${res.status} by ${res.mode} in ${res.time}s, rescued [${res.out}]; results "${rs.title}", medal "${rs.medal.slice(0, 40)}", story "${rs.story.slice(0, 70)}"; ${lines.length} aftermath lines (${afTitle}), first "${(lines[0] || '').slice(0, 60)}"; board next "${board.next}"`);
    } else {
      const cine = await vis('cine');
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(SHOTS, 'ui-m10-cinematic.png') });
      let ending = false; for (let k = 0; k < 40 && !ending; k++) { await page.waitForTimeout(250); ending = await vis('scr-ending'); }
      await page.waitForTimeout(3500);
      const en = await E(() => [...document.querySelectorAll('#en-lines p')].map((p) => p.textContent));
      await page.screenshot({ path: path.join(SHOTS, 'ui-m10-ending.png') });
      await page.click('#en-go'); await page.waitForTimeout(250);
      const rs = await E(() => ({ title: document.getElementById('rs-title').textContent, eyebrow: document.getElementById('rs-eyebrow').textContent, sub: document.getElementById('rs-sub').textContent }));
      await page.click('#rs-garage'); await page.waitForTimeout(250);
      const board = await E(() => ({ shown: !document.getElementById('scr-garage').classList.contains('hidden'), done: document.querySelectorAll('#g-missions .mis.done').length, obj: document.getElementById('g-obj').textContent, lr: DH.UI.lastResult && { convoy: DH.UI.lastResult.convoyOut, out: DH.UI.lastResult.survivorsOut } }));
      await page.screenshot({ path: path.join(SHOTS, 'ui-c2-board-complete.png') });
      const both = board.lr && board.lr.convoy, held = board.lr && board.lr.out.length === 2;
      // the ending has to tell what actually happened: both trucks or one, holdouts aboard or not
      const told = (both ? en.some((l) => /both trucks/i.test(l)) && /Both trucks/.test(rs.sub) : en.some((l) => /didn.t make it/i.test(l)) && /did not/.test(rs.sub)) && (held ? en.some((l) => /Rosa and Eli/.test(l)) : !en.some((l) => /Rosa and Eli/.test(l)));
      rec('M10 Long Haul: convoy to the ferry -> cinematic -> second ending -> results -> board', playing === 10 && res.status === 'success' && res.mode === 'ferry' && cine && ending && en.length >= 5 && told && /ABOARD THE FERRY/.test(rs.eyebrow) && board.shown && board.done === 10 && /both ways/i.test(board.obj),
        `bot ${res.status} by ${res.mode} in ${res.time}s, rescued [${res.out}], second truck aboard=${both}; cinematic=${cine}; ending ${en.length} lines ("${(en[0] || '').slice(0, 70)}"); results "${rs.sub}"; board objective "${board.obj}"`);
    }
  }

  // 2. night replay with a modifier earns the multiplier and a medal; locker shows on the board
  await page.click('[data-pref="night"]'); await page.waitForTimeout(150);
  await page.click('[data-mod="loud"]'); await page.waitForTimeout(150);
  await page.click('[data-deploy="6"]'); await page.waitForTimeout(250);
  const rb = await E(() => ({ meta: document.getElementById('brief-meta').textContent, night: !!(DH.G.run.cond && DH.G.run.cond.night), mods: DH.G.run.mods, mul: DH.Modes.scrapMul(DH.G.run) }));
  await page.click('#b-go'); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, 'ui-m6-night.png') });
  const rr = await play(6, 'side', 3);
  await page.waitForTimeout(300);
  const rrs = await E(() => ({ table: document.getElementById('rs-table').textContent, medal: document.getElementById('rs-medal').textContent, scrap: +document.getElementById('rs-scrap').textContent, r: DH.UI.lastResult && { mult: DH.UI.lastResult.mult, medal: DH.UI.lastResult.medal } }));
  await page.click('#rs-garage'); await page.waitForTimeout(250);
  rec('Night replay with Loud World: conditions and modifier in the briefing, x2.1 scrap, medal on the results', rb.night && rb.mods.loud && Math.abs(rb.mul - 2.1) < 0.01 && /Night/.test(rb.meta) && /Loud World/.test(rb.meta) && rr.status === 'success' && rrs.r && Math.abs(rrs.r.mult - 2.1) < 0.01 && /multiplier/i.test(rrs.table) && /BRONZE|SILVER|GOLD/.test(rrs.medal),
    `brief night=${rb.night}, mods ${JSON.stringify(rb.mods)}, mult ${rb.mul}; bot ${rr.status} in ${rr.time}s; scrap ${rrs.scrap}, medal "${rrs.medal.slice(0, 30)}"`);
  await page.click('[data-pref="night"]'); await page.click('[data-mod="loud"]'); await page.waitForTimeout(150);

  // 3. Salvage Run on a cleared map: bank a few caches and drive out
  const salvOpts = await E(() => [...document.querySelectorAll('#g-salv-map option')].map((o) => o.value));
  await page.selectOption('#g-salv-map', '7'); await page.click('#g-salv'); await page.waitForTimeout(250);
  const sb = await E(() => ({ eyebrow: document.getElementById('brief-eyebrow').textContent, mode: DH.G.run.mode, items: Object.values(DH.G.run.items).filter((i) => i.kind === 'salvage').length }));
  await page.click('#b-go'); await page.waitForTimeout(400);
  const sr = await E(() => {
    DH.debug.manual = true;
    const G = DH.G, run = G.run, salv = Object.values(run.items).filter((i) => i.loc === 'world').sort((a, b) => Math.hypot(a.x - run.player.x, a.y - run.player.y) - Math.hypot(b.x - run.player.x, b.y - run.player.y)).slice(0, 2);
    const script = salv.map((i) => ({ k: 'take', id: i.id })).concat([{ k: 'enter' }, { k: 'drive', pts: [[59.5, 112], [59.5, 117]] }]);
    const r = window.BOT.runLevel({ DH }, 7, script, { seed: 1, useCurrent: true });
    DH.debug.manual = false;
    return { status: r.status, mode: r.mode, scrap: r.scrap, story: DH.Save.story().completed[7] };
  });
  await page.waitForTimeout(300);
  const srs = await E(() => ({ title: document.getElementById('rs-title').textContent, eyebrow: document.getElementById('rs-eyebrow').textContent, medal: document.getElementById('rs-medal').textContent, best: DH.Save.data.campaign.salvageBest[7] }));
  await page.screenshot({ path: path.join(SHOTS, 'ui-salvage-results.png') });
  await page.click('#rs-garage'); await page.waitForTimeout(250);
  rec('Salvage Run: map picker lists cleared maps, caches spawn, banking scrap records a best, campaign untouched', salvOpts.length === 10 && /SALVAGE/.test(sb.eyebrow) && sb.mode === 'salvage' && sb.items >= 10 && sr.status === 'success' && sr.scrap > 0 && srs.best === sr.scrap && /best/i.test(srs.medal),
    `${salvOpts.length} maps; "${sb.eyebrow}", ${sb.items} bundles; bot ${sr.status} by ${sr.mode}, banked ${sr.scrap}; best ${srs.best}; "${srs.medal}"`);

  // 4. Daily Haul: deterministic map for the date, recorded per day
  const dd = await E(() => DH.Modes.dailySpec(DH.Save.story()));
  await page.click('#g-daily'); await page.waitForTimeout(250);
  const db = await E(() => ({ eyebrow: document.getElementById('brief-eyebrow').textContent, level: DH.G.run.level, daily: DH.G.run.daily, seed: DH.G.run.seed }));
  await page.click('#b-go'); await page.waitForTimeout(300);
  await E(() => { DH.G.run.player.hp = 0; DH.debug.step(2); });
  await page.waitForTimeout(400);
  const dr = await E(() => ({ title: document.getElementById('rs-title').textContent, rec: DH.Save.data.campaign.daily[DH.Modes.today()] }));
  await page.click('#rs-garage'); await page.waitForTimeout(250);
  rec('Daily Haul: today’s seed picks the same map and caches; the attempt is recorded for the day', db.level === dd.level && db.seed === dd.seed && db.daily === dd.date && /DAILY HAUL/.test(db.eyebrow) && /YOU DIED/.test(dr.title) && dr.rec && dr.rec.runs === 1,
    `spec ${dd.date} level ${dd.level} seed ${dd.seed}; run level ${db.level}; "${db.eyebrow}"; after a death: "${dr.title}", record ${JSON.stringify(dr.rec)}`);

  // 5. reload keeps everything
  await page.reload(); await page.waitForTimeout(700);
  const rl = await E(() => ({ btn: document.getElementById('b-new').textContent, done: DH.Save.LEVELS.every((l) => DH.Save.story().completed[l]), medals: Object.keys(DH.Save.data.campaign.medals).length, v: JSON.parse(localStorage.getItem('skab.deadhaul.v1')).v, status: DH.Save.status }));
  rec('Reload keeps the finished Island Line, medals and records (save v3)', rl.done && rl.v === 3 && rl.status === 'ok' && rl.medals >= 5 && /Replay/.test(rl.btn), `"${rl.btn}", all ten complete=${rl.done}, medals ${rl.medals}, save v${rl.v}`);
  rec('No page errors during the Island Line flow', errors.length === 0, errors.length ? errors.slice(0, 4).join(' | ') : 'none');

  await browser.close();
  const pass = rows.filter((r) => r.status === 'PASS').length;
  console.log(pass + ' passed, ' + (rows.length - pass) + ' failed');
  fs.writeFileSync(path.join(__dirname, 'campaign2-ui-results.json'), JSON.stringify(rows, null, 1));
  process.exitCode = rows.length - pass ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
