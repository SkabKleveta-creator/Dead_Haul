// Browser campaign flow (Playwright + Chromium, built dist/index.html):
// title -> mission board -> briefing -> play -> results -> aftermath -> board, for all five missions in order,
// ferry cinematic -> ending, replay briefing, failure + retry, reload persistence.
// Gameplay inside each mission is driven by the same normal-input bot as tests/campaign.js, running in the page
// against the page's own simulation (the render loop is paused while the bot steps, then resumed for the UI).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const URL = 'file://' + path.resolve(__dirname, '../dist/index.html');
const BOT = fs.readFileSync(path.join(__dirname, 'campaign.js'), 'utf8');
const SHOTS = path.join(__dirname, '../screenshots');
const rows = [];
const rec = (name, ok, notes) => { rows.push({ name, status: ok ? 'PASS' : 'FAIL', notes }); console.log((ok ? 'PASS' : 'FAIL').padEnd(6), name, '-', notes); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL); await page.waitForTimeout(700);
  const E = (fn, arg) => page.evaluate(fn, arg);
  const vis = (id) => E((i) => { const e = document.getElementById(i); return !!e && !e.classList.contains('hidden') && e.offsetParent !== null; }, id);
  const injectBot = () => E((src) => {
    const blankInput = () => ({ move: { x: 0, y: 0 }, aimWorld: null, aimDir: null, fire: false, firePressed: false, melee: false, reload: false, swap: false, interactPressed: false, interactHeld: false, throwN: false, heal: false, command: false, sprint: false, drop: false, alt: [false, false, false], drive: { throttle: 0, brake: 0, steer: 0, handbrake: false }, depart: false, recover: false });
    const module = { exports: {} };
    new Function('require', 'module', src)(() => ({ blankInput, load: () => null }), module);
    window.BOT = module.exports;
    return !!window.BOT.runLevel;
  }, BOT);

  // 1. title and briefing back
  const t0 = await E(() => ({ btn: document.getElementById('b-new').textContent, obj: document.getElementById('t-obj').textContent }));
  await page.click('#b-new'); await page.waitForTimeout(200);
  const brief1 = await E(() => ({ title: document.getElementById('brief-title').textContent, words: document.getElementById('brief-text').textContent.split(/\s+/).length }));
  await page.click('#b-brief-back'); await page.waitForTimeout(200);
  const back = await E(() => ({ title: !document.getElementById('scr-title').classList.contains('hidden'), saved: DH.Save.hasRun() }));
  rec('Title deploys the current story mission; briefing Back returns without a saved run', /Mercer Crossing/.test(t0.btn) && /insulin/i.test(t0.obj) && brief1.title === 'MERCER CROSSING' && back.title && !back.saved, `title "${t0.btn}", objective "${t0.obj}", briefing ${brief1.words} words, back to title=${back.title}, saved run=${back.saved}`);

  // 2. mission board on a fresh save
  await page.click('#b-garage'); await page.waitForTimeout(250);
  const board0 = await E(() => ({ cards: document.querySelectorAll('#g-missions .mis').length, locked: document.querySelectorAll('#g-missions .mis.locked').length, deploy: [...document.querySelectorAll('[data-deploy]')].map((b) => b.dataset.deploy), obj: document.getElementById('g-obj').textContent }));
  await page.screenshot({ path: path.join(SHOTS, 'ui-board-fresh.png') });
  rec('Mission board: five missions, only Mercer Crossing deployable at first', board0.cards === 5 && board0.locked === 4 && board0.deploy.join() === '1', `${board0.cards} cards, ${board0.locked} locked, deploy buttons [${board0.deploy}], objective "${board0.obj}"`);

  await injectBot();
  const plan = [[1, 'full', 1], [2, 'rescue', 2], [3, 'rescue', 3], [4, 'rescue', 4], [5, 'rescue', 5]];
  for (const [level, variant, seed] of plan) {
    await page.click('[data-deploy="' + level + '"]'); await page.waitForTimeout(250);
    const br = await E(() => ({ title: document.getElementById('brief-title').textContent, words: document.getElementById('brief-text').textContent.split(/\s+/).length, eyebrow: document.getElementById('brief-eyebrow').textContent }));
    await page.click('#b-go'); await page.waitForTimeout(600);
    const playing = await E(() => DH.G.state === 'play' && DH.G.run && DH.G.run.level);
    await page.screenshot({ path: path.join(SHOTS, 'ui-m' + level + '-start.png') });
    const res = await E(([lv, va, sd]) => {
      DH.debug.manual = true; DH.Save.settings().hints = false;
      const r = window.BOT.runLevel({ DH }, lv, window.BOT.S[lv][va], { seed: sd, variant: va, useCurrent: true });
      DH.debug.manual = false;
      return { status: r.status, mode: r.mode, time: r.time, steps: r.steps.slice(-120), out: r.survivorsOut, state: DH.G.state };
    }, [level, variant, seed]);
    if (level < 5) {
      await page.waitForTimeout(300);
      const rs = await E(() => ({ title: document.getElementById('rs-title').textContent, story: document.getElementById('rs-story').textContent, btn: document.getElementById('rs-garage').textContent }));
      await page.screenshot({ path: path.join(SHOTS, 'ui-m' + level + '-results.png') });
      await page.click('#rs-garage'); await page.waitForTimeout(250);
      const afVisible = await vis('scr-after');
      const lines = [];
      for (let k = 0; k < 12 && await vis('scr-after'); k++) { lines.push(await E(() => { const l = [...document.querySelectorAll('#af-lines .af-line')].pop(); return l ? l.textContent : ''; })); if (k === 1) await page.screenshot({ path: path.join(SHOTS, 'ui-m' + level + '-aftermath.png') }); await page.click('#af-next'); await page.waitForTimeout(120); }
      const board = await E((lv) => ({ shown: !document.getElementById('scr-garage').classList.contains('hidden'), deploy: [...document.querySelectorAll('[data-deploy]')].map((b) => b.dataset.deploy), done: document.querySelectorAll('#g-missions .mis.done').length, next: document.getElementById('g-deploy').textContent, obj: document.getElementById('g-obj').textContent, opt: document.querySelectorAll('#g-missions .mis')[lv - 1].querySelector('.mis-opt').textContent }), level);
      rec(`M${level} ${br.title}: board -> briefing -> play -> results -> aftermath -> board`, playing === level && br.words <= 80 && res.status === 'success' && /MISSION COMPLETE/.test(rs.title) && /unlocked/i.test(rs.story) && afVisible && lines.length >= 3 && board.shown && board.deploy.indexOf(String(level + 1)) >= 0 && board.done === level,
        `briefing ${br.words} words; bot ${res.status} by ${res.mode} in ${res.time}s, rescued [${res.out}]; results "${rs.title}" / "${rs.story.slice(0, 90)}"; ${lines.length} aftermath lines, first "${(lines[0] || '').slice(0, 70)}"; board next "${board.next}", optional "${board.opt}"`);
    } else {
      const cine = await vis('cine');
      const tr0 = await E(() => [DH.G.run.truck.x, DH.G.run.truck.y]);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(SHOTS, 'ui-m5-cinematic.png') });
      const tr1 = await E(() => DH.G.run ? [DH.G.run.truck.x, DH.G.run.truck.y, DH.G.run.truck.cineA] : null);
      let ending = false; for (let k = 0; k < 40 && !ending; k++) { await page.waitForTimeout(250); ending = await vis('scr-ending'); }
      await page.waitForTimeout(3500);
      const en = await E(() => [...document.querySelectorAll('#en-lines p')].map((p) => p.textContent));
      await page.screenshot({ path: path.join(SHOTS, 'ui-m5-ending.png') });
      await page.click('#en-go'); await page.waitForTimeout(250);
      const rs = await E(() => ({ title: document.getElementById('rs-title').textContent, eyebrow: document.getElementById('rs-eyebrow').textContent }));
      await page.click('#rs-garage'); await page.waitForTimeout(250);
      const board = await E(() => ({ shown: !document.getElementById('scr-garage').classList.contains('hidden'), done: document.querySelectorAll('#g-missions .mis.done').length, obj: document.getElementById('g-obj').textContent }));
      await page.screenshot({ path: path.join(SHOTS, 'ui-board-complete.png') });
      rec('M5 Last Crossing: ferry boarding cinematic -> ending -> results -> board', playing === 5 && res.status === 'success' && res.mode === 'ferry' && cine && tr1 && Math.hypot(tr1[0] - tr0[0], tr1[1] - tr0[1]) > 1 && ending && en.length >= 4 && /ABOARD THE FERRY/.test(rs.eyebrow) && board.shown && board.done === 5 && /crossing is open/i.test(board.obj),
        `bot ${res.status} by ${res.mode} in ${res.time}s, rescued [${res.out}]; cinematic shown=${cine}, truck moved ${tr1 ? Math.hypot(tr1[0] - tr0[0], tr1[1] - tr0[1]).toFixed(1) : '?'} m up the ramp; ending ${en.length} lines ("${(en[en.length - 2] || '').slice(0, 80)}"); results "${rs.eyebrow}"; board objective "${board.obj}"`);
    }
  }

  // 3. replay briefing note, failure and retry
  await page.click('[data-deploy="3"]'); await page.waitForTimeout(250);
  const replayNote = await vis('brief-replay');
  await page.click('#b-go'); await page.waitForTimeout(400);
  const before = await E(() => JSON.stringify({ c: DH.Save.data.campaign.story.completed, m: DH.Save.data.campaign.story.milestones, s: DH.Save.data.campaign.scrap }));
  await E(() => { DH.G.run.player.hp = 0; }); // [state] forced death
  await page.waitForTimeout(600);
  const dead = await E(() => ({ title: document.getElementById('rs-title').textContent, story: document.getElementById('rs-story').textContent, retry: document.getElementById('rs-again').textContent }));
  const after = await E(() => JSON.stringify({ c: DH.Save.data.campaign.story.completed, m: DH.Save.data.campaign.story.milestones, s: DH.Save.data.campaign.scrap }));
  await page.click('#rs-again'); await page.waitForTimeout(250);
  const retry = await E(() => ({ brief: !document.getElementById('scr-brief').classList.contains('hidden'), title: document.getElementById('brief-title').textContent }));
  await page.click('#b-brief-back'); await page.waitForTimeout(250);
  rec('Replay briefing note; failure keeps progress; Retry returns to the same briefing', replayNote && /YOU DIED/.test(dead.title) && /NO PROGRESS LOST/.test(dead.story) && before === after && retry.brief && retry.title === 'HIGH WATER', `replay note shown=${replayNote}; "${dead.title}" / "${dead.story.slice(0, 60)}"; progress unchanged=${before === after}; retry briefing "${retry.title}"`);

  // 4. results Title button (duplicate-id fix) and reload persistence
  await page.click('[data-deploy="2"]'); await page.waitForTimeout(200); await page.click('#b-go'); await page.waitForTimeout(300);
  await E(() => { DH.G.run.player.hp = 0; }); await page.waitForTimeout(500);
  await page.click('#rs-totitle'); await page.waitForTimeout(250);
  const atTitle = await vis('scr-title');
  await page.reload(); await page.waitForTimeout(800);
  const reloaded = await E(() => ({ btn: document.getElementById('b-new').textContent, obj: document.getElementById('t-obj').textContent, done: [1, 2, 3, 4, 5].every((l) => DH.Save.data.campaign.story.completed[l]), status: DH.Save.status }));
  rec('Results Title button works; reload keeps the finished campaign', atTitle && reloaded.done && reloaded.status === 'ok' && /Replay/.test(reloaded.btn), `title shown=${atTitle}; after reload "${reloaded.btn}", objective "${reloaded.obj}", all five complete=${reloaded.done}`);

  rec('No page errors during the campaign flow', errors.length === 0, errors.length ? errors.slice(0, 5).join(' | ') : 'none');
  fs.writeFileSync(path.join(__dirname, 'campaign-ui-results.json'), JSON.stringify(rows, null, 1));
  await browser.close();
  const failN = rows.filter((r) => r.status !== 'PASS').length;
  console.log(rows.length - failN + ' passed, ' + failN + ' failed');
  process.exitCode = failN ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
