// SOLMARIS v6 — save.js: localStorage autosave + continue, no server.
// The blob is validated field by field on load; anything malformed falls
// back to a fresh profile instead of crashing the boot.
(function () {
  var STORE_KEY = 'solmaris-save-v2';
  var S = {};

  function blankProfile() {
    return {
      cash: 0,
      mission: 0,
      done: [],
      bestStars: 0,
      takedowns: 0,
      secondsPlayed: 0,
      savedAt: 0,
    };
  }

  function asInt(v, lo, hi) {
    var n = v | 0;
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  S.fresh = blankProfile;

  S.exists = function () {
    try {
      return window.localStorage.getItem(STORE_KEY) !== null;
    } catch (e) {
      return false;
    }
  };

  S.load = function () {
    var raw = null;
    try {
      raw = window.localStorage.getItem(STORE_KEY);
    } catch (e) {
      return null;
    }
    if (!raw) return null;
    var data = null;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return null;
    }
    if (!data || typeof data.cash !== 'number') return null;
    var out = blankProfile();
    out.cash = data.cash | 0;
    out.mission = asInt(data.mission, 0, 3);
    if (Array.isArray(data.done)) {
      out.done = data.done.filter(function (n) { return typeof n === 'number'; });
    }
    out.bestStars = asInt(data.bestStars, 0, 5);
    out.takedowns = data.takedowns | 0;
    out.secondsPlayed = data.secondsPlayed | 0;
    out.savedAt = data.savedAt | 0;
    return out;
  };

  S.store = function (state) {
    var copy = blankProfile();
    copy.cash = state.cash | 0;
    copy.mission = state.mission | 0;
    copy.done = (state.done || []).slice(0, 8);
    copy.bestStars = state.bestStars | 0;
    copy.takedowns = state.takedowns | 0;
    copy.secondsPlayed = Math.floor(state.secondsPlayed || 0);
    copy.savedAt = Date.now();
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(copy));
      return true;
    } catch (e) {
      return false;
    }
  };

  S.wipe = function () {
    try {
      window.localStorage.removeItem(STORE_KEY);
    } catch (e) {
      /* storage unavailable — nothing to wipe */
    }
  };

  SOL.save = S;
})();
