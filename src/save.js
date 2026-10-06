/* DEAD HAUL - persistence (single versioned key, atomic writes, v1 -> v2 migration) */
(function () {
  'use strict';
  const DH = window.DH;
  const SAVE_V = 2;

  const storyDefaults = () => ({ completed: {}, firstClear: {}, milestones: {}, outcomes: {}, optional: {}, seen: {}, endingSeen: false, log: [], selected: 1 });
  const defaults = () => ({
    v: SAVE_V,
    campaign: {
      scrap: 0,
      upgrades: { quiet: false, bumper: false, gear: false },
      settings: { volume: 0.8, music: 0.35, muted: false, aimAssist: true, reducedShake: false, reducedFlashes: false, hints: true },
      best: { bestScrap: 0, fastestSuccess: 0, successes: 0, runs: 0 },
      levelBest: {},
      recentRunIds: [],
      history: [],
      story: storyDefaults(),
    },
    active: null,
  });

  const Save = (DH.Save = {
    data: defaults(),
    status: 'ok',
    message: '',
    storage: null,
    migrated: false,
    V: SAVE_V,
  });
  Save.defaults = defaults;
  Save.storyDefaults = storyDefaults;

  Save.getStorage = () => {
    if (Save.storage) return Save.storage;
    try {
      const s = window.localStorage;
      const k = DH.SAVE_KEY + '.probe';
      s.setItem(k, '1'); s.removeItem(k);
      Save.storage = s;
    } catch (e) { Save.storage = null; }
    return Save.storage;
  };

  const validCampaign = (c) => c && typeof c.scrap === 'number' && isFinite(c.scrap) && c.scrap >= 0 && c.upgrades && typeof c.upgrades === 'object';
  const LEVELS = [1, 2, 3, 4, 5];
  const boolMap = (src, keys) => { const o = {}; if (src && typeof src === 'object') for (const k in src) if ((!keys || keys.indexOf(+k) >= 0) && src[k]) o[k] = src[k] === true ? true : src[k]; return o; };

  // Bring any story block (missing, partial, older) to the current shape without losing valid fields.
  Save.migrateStory = (st, c) => {
    const d = storyDefaults();
    if (st && typeof st === 'object') {
      d.completed = {}; for (const l of LEVELS) if (st.completed && st.completed[l]) d.completed[l] = true;
      d.firstClear = {}; for (const l of LEVELS) if (st.firstClear && typeof st.firstClear[l] === 'string') d.firstClear[l] = st.firstClear[l]; else if (d.completed[l]) d.firstClear[l] = 'unknown';
      d.milestones = {}; if (st.milestones && typeof st.milestones === 'object') for (const k in st.milestones) if (st.milestones[k] === true) d.milestones[k] = true;
      d.outcomes = {}; if (st.outcomes && typeof st.outcomes === 'object') for (const l of LEVELS) if (st.outcomes[l] && typeof st.outcomes[l] === 'object') d.outcomes[l] = st.outcomes[l];
      d.optional = {}; if (st.optional && typeof st.optional === 'object') for (const l of LEVELS) if (st.optional[l] && typeof st.optional[l] === 'object') d.optional[l] = boolMap(st.optional[l]);
      d.seen = {}; if (st.seen && typeof st.seen === 'object') for (const l of LEVELS) if (st.seen[l]) d.seen[l] = true;
      d.endingSeen = !!st.endingSeen;
      d.log = Array.isArray(st.log) ? st.log.filter((x) => typeof x === 'string').slice(-30) : [];
      d.selected = LEVELS.indexOf(st.selected) >= 0 ? st.selected : 1;
    } else if (c && c.best && c.best.successes > 0) {
      // v1 save: the first medicine run was already completed. Unlock Cold Chain and queue the garage aftermath.
      d.completed[1] = true; d.firstClear[1] = 'v1'; d.outcomes[1] = { migrated: true }; d.seen[1] = false;
      d.selected = 2;
    }
    // never leave an unreachable mission selected
    if (!Save.unlocked(d, d.selected)) d.selected = 1;
    return d;
  };
  Save.unlocked = (st, l) => l === 1 || !!(st.completed && st.completed[l - 1]);

  Save.load = () => {
    Save.data = defaults();
    Save.migrated = false;
    const st = Save.getStorage();
    if (!st) { Save.status = 'unavailable'; Save.message = 'Browser storage is unavailable. Progress will not be saved this session.'; return Save.data; }
    let raw = null;
    try { raw = st.getItem(DH.SAVE_KEY); } catch (e) { Save.status = 'unavailable'; Save.message = 'Browser storage is unavailable. Progress will not be saved this session.'; return Save.data; }
    Save.message = ''; Save.status = 'ok';
    if (!raw) return Save.data;
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    if (!parsed || typeof parsed !== 'object') {
      Save.status = 'corrupt'; Save.message = 'Save data was unreadable, so a fresh save was started.';
      try { st.setItem(DH.SAVE_KEY + '.corrupt', raw.slice(0, 200000)); } catch (e) { /* ignore */ }
      return Save.data;
    }
    const d = defaults();
    if (validCampaign(parsed.campaign)) {
      const c = parsed.campaign;
      d.campaign.scrap = Math.floor(c.scrap);
      for (const k of ['quiet', 'bumper', 'gear']) d.campaign.upgrades[k] = !!(c.upgrades && c.upgrades[k]);
      if (c.settings && typeof c.settings === 'object') for (const k in d.campaign.settings) if (typeof c.settings[k] === typeof d.campaign.settings[k]) d.campaign.settings[k] = c.settings[k];
      if (c.best && typeof c.best === 'object') for (const k in d.campaign.best) if (typeof c.best[k] === 'number') d.campaign.best[k] = c.best[k];
      if (c.levelBest && typeof c.levelBest === 'object') for (const l of LEVELS) if (c.levelBest[l] && typeof c.levelBest[l] === 'object') d.campaign.levelBest[l] = { runs: +c.levelBest[l].runs || 0, successes: +c.levelBest[l].successes || 0, fastest: +c.levelBest[l].fastest || 0 };
      if (Array.isArray(c.recentRunIds)) d.campaign.recentRunIds = c.recentRunIds.filter((x) => typeof x === 'string').slice(-60);
      if (Array.isArray(c.history)) d.campaign.history = c.history.slice(-10);
      if ((parsed.v || 1) < SAVE_V || !c.story) Save.migrated = true;
      d.campaign.story = Save.migrateStory(c.story, d.campaign);
      if (!d.campaign.levelBest[1] && d.campaign.best.runs) d.campaign.levelBest[1] = { runs: d.campaign.best.runs, successes: d.campaign.best.successes, fastest: d.campaign.best.fastestSuccess };
    } else {
      Save.status = 'corrupt'; Save.message = 'Campaign data was damaged and has been reset.';
    }
    const a = parsed.active;
    if (a && typeof a === 'object' && a.id && (a.v === 1 || a.v === 2) && (a.level == null || (DH.LEVELS && DH.LEVELS[a.level]))) {
      if (d.campaign.recentRunIds.indexOf(a.id) >= 0) d.active = null; // already finished
      else d.active = a;
    } else if (a) {
      Save.status = 'corrupt'; Save.message = 'The saved run could not be restored. Campaign progress was kept.';
    }
    Save.data = d;
    if (Save.status !== 'corrupt') Save.status = 'ok';
    if (Save.migrated && Save.status === 'ok') Save.write();
    return d;
  };

  Save.write = () => {
    const st = Save.getStorage();
    if (!st) return false;
    try { Save.data.v = SAVE_V; st.setItem(DH.SAVE_KEY, JSON.stringify(Save.data)); return true; } catch (e) {
      Save.status = 'unavailable'; Save.message = 'Could not write save data (storage full or blocked).';
      return false;
    }
  };

  Save.settings = () => Save.data.campaign.settings;
  Save.story = () => Save.data.campaign.story;
  Save.saveSettings = () => Save.write();

  Save.saveRun = (snapshot) => { Save.data.active = snapshot; return Save.write(); };
  Save.clearRun = () => { Save.data.active = null; return Save.write(); };
  Save.hasRun = () => !!Save.data.active;

  // Atomically record a terminal result. Idempotent by run id.
  // Narrative milestones are recorded separately from scrap: each one is set once and never repeats on replay.
  Save.commitResult = (runId, result) => {
    const c = Save.data.campaign;
    if (c.recentRunIds.indexOf(runId) >= 0) { Save.data.active = null; Save.write(); return false; }
    const scrap = result.status === 'failed' ? 0 : Math.max(0, Math.floor(result.scrap || 0));
    c.scrap += scrap;
    c.recentRunIds.push(runId);
    if (c.recentRunIds.length > 60) c.recentRunIds.splice(0, c.recentRunIds.length - 60);
    c.best.runs += 1;
    const lvl = result.level || 1;
    const lb = c.levelBest[lvl] || (c.levelBest[lvl] = { runs: 0, successes: 0, fastest: 0 });
    lb.runs++;
    if (result.status === 'success') {
      c.best.successes += 1; lb.successes++;
      if (!c.best.fastestSuccess || result.time < c.best.fastestSuccess) c.best.fastestSuccess = Math.round(result.time);
      if (!lb.fastest || result.time < lb.fastest) lb.fastest = Math.round(result.time);
    }
    if (scrap > c.best.bestScrap) c.best.bestScrap = scrap;
    c.history.push({ id: runId, level: lvl, status: result.status, scrap, time: Math.round(result.time || 0) });
    if (c.history.length > 10) c.history.shift();
    if (DH.Story && result.status !== 'failed') {
      const st = DH.Story.apply(c.story, result);
      result.story = st;
    }
    Save.data.active = null;
    Save.write();
    return true;
  };

  Save.buy = (key) => {
    const up = DH.T.upgrades[key];
    const c = Save.data.campaign;
    if (!up) return { ok: false, msg: 'Unknown upgrade.' };
    if (c.upgrades[key]) return { ok: false, msg: 'Already installed.' };
    if (c.scrap < up.cost) return { ok: false, msg: 'Not enough scrap.' };
    c.scrap -= up.cost; c.upgrades[key] = true;
    Save.write();
    return { ok: true, msg: up.name + ' installed. Active on your next deployment.' };
  };

  Save.resetAll = () => {
    const settings = Save.data.campaign.settings;
    Save.data = defaults();
    Save.data.campaign.settings = settings;
    Save.write();
  };
})();
