// SOLMARIS v4 — save.js: localStorage autosave and continue. No network,
// no account, no server. The save is a small JSON blob validated on load:
// anything malformed falls back to a fresh profile instead of crashing.
(function () {
  const KEY = 'solmaris-save-v2';
  const S = {};

  S.fresh = function () {
    return {
      cash: 0,
      mission: 0,
      done: [],
      bestStars: 0,
      takedowns: 0,
      secondsPlayed: 0,
      savedAt: 0,
    };
  };

  S.exists = function () {
    try { return !!window.localStorage.getItem(KEY); } catch (e) { return false; }
  };

  S.load = function () {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data.cash !== 'number') return null;
      const out = S.fresh();
      out.cash = data.cash | 0;
      out.mission = Math.max(0, Math.min(3, data.mission | 0));
      out.done = Array.isArray(data.done) ? data.done.filter(function (n) { return typeof n === 'number'; }) : [];
      out.bestStars = Math.max(0, Math.min(5, data.bestStars | 0));
      out.takedowns = data.takedowns | 0;
      out.secondsPlayed = data.secondsPlayed | 0;
      out.savedAt = data.savedAt | 0;
      return out;
    } catch (e) { return null; }
  };

  S.store = function (state) {
    try {
      const copy = S.fresh();
      copy.cash = state.cash | 0;
      copy.mission = state.mission | 0;
      copy.done = (state.done || []).slice(0, 8);
      copy.bestStars = state.bestStars | 0;
      copy.takedowns = state.takedowns | 0;
      copy.secondsPlayed = Math.floor(state.secondsPlayed || 0);
      copy.savedAt = Date.now();
      window.localStorage.setItem(KEY, JSON.stringify(copy));
      return true;
    } catch (e) { return false; }
  };

  S.wipe = function () {
    try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  };

  SOL.save = S;
})();
