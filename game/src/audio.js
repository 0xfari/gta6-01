// SOLMARIS v6 — audio.js: every sound is synthesized with WebAudio, no
// audio files are fetched. Engine hum, two-tone siren, gunshot noise,
// pickup blips and a small bassline music loop. Everything is guarded: if
// the browser has no AudioContext (or it stays suspended in headless mode)
// the game keeps running silently instead of throwing.
(function () {
  var A = {};
  var ctx = null;
  var master = null;
  var engineOsc = null;
  var engineGain = null;
  var sirenOsc = null;
  var sirenGain = null;
  var sirenTimer = null;
  var musicTimer = null;
  var musicStep = 0;
  A.muted = false;

  // One shared gain stage; created lazily so a headless run never throws.
  function ensureCtx() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = A.muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, when) {
    if (!ensureCtx() || A.muted) return;
    try {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      var t0 = ctx.currentTime + (when || 0);
      g.gain.setValueAtTime(vol || 0.12, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + dur);
    } catch (e) {
      /* audio is cosmetic */
    }
  }

  A.init = function () {
    if (!ensureCtx()) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(function () {});
    }
  };

  A.setMuted = function (m) {
    A.muted = m;
    if (master) master.gain.value = m ? 0 : 0.5;
    if (m) A.siren(false);
  };

  // Continuous engine hum whose pitch follows speed (0..1).
  A.engine = function (speed01) {
    if (!ensureCtx() || A.muted) return;
    try {
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.0;
        var filt = ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = 420;
        engineOsc.connect(filt);
        filt.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      var now = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(52 + speed01 * 165, now, 0.08);
      engineGain.gain.setTargetAtTime(0.02 + speed01 * 0.055, now, 0.1);
    } catch (e) {
      /* audio is cosmetic */
    }
  };

  // Two-tone police siren, toggled on/off.
  A.siren = function (on) {
    if (!ensureCtx()) return;
    try {
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.035;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        var hi = true;
        sirenTimer = setInterval(function () {
          if (!sirenOsc) return;
          sirenOsc.frequency.setTargetAtTime(hi ? 880 : 660, ctx.currentTime, 0.05);
          hi = !hi;
        }, 420);
      } else if (!on && sirenOsc) {
        clearInterval(sirenTimer);
        sirenTimer = null;
        sirenOsc.stop();
        sirenOsc = null;
        sirenGain = null;
      }
    } catch (e) {
      /* cosmetic */
    }
  };

  // Gunshot: short filtered noise burst + low thump.
  A.shot = function () {
    if (!ensureCtx() || A.muted) return;
    try {
      var len = Math.floor(ctx.sampleRate * 0.14);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var filt = ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 1400;
      var g = ctx.createGain();
      g.gain.value = 0.35;
      src.connect(filt);
      filt.connect(g);
      g.connect(master);
      src.start();
      tone(90, 0.12, 'square', 0.18);
    } catch (e) {
      /* cosmetic */
    }
  };

  A.pickup = function () {
    tone(660, 0.12, 'sine', 0.14);
    tone(990, 0.18, 'sine', 0.12);
  };

  A.cash = function () {
    tone(880, 0.1, 'triangle', 0.14);
    tone(1320, 0.16, 'triangle', 0.14, 0.09);
  };

  A.busted = function () {
    tone(220, 0.5, 'sawtooth', 0.16);
  };

  // Tiny bassline loop (A minor-ish), one note per step, 8 steps.
  var BASSLINE = [55, 0, 55, 65.4, 55, 0, 49, 58.3];

  A.music = function (on) {
    if (!ensureCtx()) return;
    try {
      if (on && !musicTimer) {
        musicTimer = setInterval(function () {
          if (A.muted) return;
          var f = BASSLINE[musicStep % BASSLINE.length];
          musicStep++;
          if (f) tone(f, 0.42, 'triangle', 0.09);
        }, 300);
      } else if (!on && musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    } catch (e) {
      /* cosmetic */
    }
  };

  SOL.audio = A;
})();
