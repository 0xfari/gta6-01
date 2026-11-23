// SOLMARIS save — localStorage autosave / continue. No network, no account.
window.SOL = window.SOL || {};
SOL.save = (function () {
  var KEY = 'solmaris-save-v1';

  function blank() {
    return { cash: 0, nextMission: 0, completed: [], bestWanted: 0, kills: 0, playTimeSec: 0, savedAt: 0 };
  }

  return {
    blank: blank,
    hasSave: function () {
      try { return !!window.localStorage.getItem(KEY); } catch (e) { return false; }
    },
    load: function () {
      try {
        var raw = window.localStorage.getItem(KEY);
        if (!raw) return null;
        var data = JSON.parse(raw);
        if (!data || typeof data.cash !== 'number') return null;
        var out = blank();
        out.cash = data.cash | 0;
        out.nextMission = Math.max(0, Math.min(3, data.nextMission | 0));
        out.completed = Array.isArray(data.completed) ? data.completed : [];
        out.bestWanted = data.bestWanted | 0;
        out.kills = data.kills | 0;
        out.playTimeSec = data.playTimeSec | 0;
        out.savedAt = data.savedAt | 0;
        return out;
      } catch (e) { return null; }
    },
    save: function (data) {
      try {
        var copy = blank();
        copy.cash = data.cash | 0;
        copy.nextMission = data.nextMission | 0;
        copy.completed = (data.completed || []).slice(0, 8);
        copy.bestWanted = data.bestWanted | 0;
        copy.kills = data.kills | 0;
        copy.playTimeSec = data.playTimeSec | 0;
        copy.savedAt = Date.now();
        window.localStorage.setItem(KEY, JSON.stringify(copy));
        return true;
      } catch (e) { return false; }
    },
    clear: function () {
      try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    }
  };
})();
