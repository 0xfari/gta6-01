// SOLMARIS audio — every sound is synthesized with WebAudio. No audio files.
window.SOL = window.SOL || {};
SOL.audio = (function () {
  var ctx = null;
  var master = null;
  var muted = false;
  var engineOsc1 = null;
  var engineOsc2 = null;
  var engineGain = null;
  var engineFilter = null;
  var sirenOsc = null;
  var sirenGain = null;
  var sirenLfo = null;
  var musicTimer = null;
  var musicStep = 0;
  var noiseBuffer = null;

  function ensure() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ctx.destination);
      var len = ctx.sampleRate * 1;
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = noiseBuffer.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) {
      ctx = null;
      return false;
    }
    return true;
  }

  function startEngine() {
    if (!ctx || engineOsc1) return;
    engineOsc1 = ctx.createOscillator();
    engineOsc1.type = 'sawtooth';
    engineOsc1.frequency.value = 55;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 28;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    engineOsc1.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc1.start();
    engineOsc2.start();
  }

  function startSiren() {
    if (!ctx || sirenOsc) return;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 720;
    sirenLfo = ctx.createOscillator();
    sirenLfo.type = 'square';
    sirenLfo.frequency.value = 0.55;
    var lfoGain = ctx.createGain();
    lfoGain.gain.value = 240;
    sirenLfo.connect(lfoGain);
    lfoGain.connect(sirenOsc.frequency);
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    sirenLfo.start();
  }

  function blip(freq, dur, type, vol) {
    if (!ensure()) return;
    try {
      var o = ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.value = freq;
      var g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(master);
      o.start();
      o.stop(ctx.currentTime + dur + 0.02);
    } catch (e) { /* audio is best-effort */ }
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ensure()) return;
    try {
      var src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq || 1800;
      var g = ctx.createGain();
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start();
      src.stop(ctx.currentTime + dur + 0.02);
    } catch (e) { /* audio is best-effort */ }
  }

  // A tiny bass-and-hat loop: root notes of a moody minor progression.
  var BASSLINE = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
  function musicTick() {
    if (!ctx || muted) return;
    var step = musicStep % 16;
    var bar = Math.floor(musicStep / 16) % BASSLINE.length;
    if (step % 4 === 0) {
      var o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = BASSLINE[bar];
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.16, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      o.connect(g);
      g.connect(master);
      o.start();
      o.stop(ctx.currentTime + 0.55);
    }
    if (step % 2 === 0) {
      var src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      var f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 6000;
      var hg = ctx.createGain();
      hg.gain.setValueAtTime(step % 4 === 2 ? 0.05 : 0.025, ctx.currentTime);
      hg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      src.connect(f);
      f.connect(hg);
      hg.connect(master);
      src.start();
      src.stop(ctx.currentTime + 0.06);
    }
    musicStep++;
  }

  return {
    init: function () {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      startEngine();
      startSiren();
    },
    setMuted: function (m) {
      muted = !!m;
      if (master) master.gain.value = muted ? 0 : 0.55;
    },
    isMuted: function () { return muted; },
    engine: function (speed01, driving) {
      if (!ctx || !engineOsc1) return;
      var target = driving ? 0.05 + speed01 * 0.11 : 0.0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc1.frequency.setTargetAtTime(52 + speed01 * 165, ctx.currentTime, 0.06);
      engineOsc2.frequency.setTargetAtTime(26 + speed01 * 82, ctx.currentTime, 0.06);
      engineFilter.frequency.setTargetAtTime(380 + speed01 * 1400, ctx.currentTime, 0.1);
    },
    siren: function (nearestDist, wanted) {
      if (!ctx || !sirenOsc) return;
      var on = wanted > 0 && nearestDist < 90;
      var vol = on ? Math.max(0.015, 0.11 * (1 - nearestDist / 95)) : 0;
      sirenGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.2);
    },
    shot: function () { noiseBurst(0.14, 0.5, 2600); blip(190, 0.09, 'square', 0.2); },
    enemyShot: function () { noiseBurst(0.12, 0.28, 1800); },
    blip: function () { blip(880, 0.12, 'sine', 0.22); },
    pickup: function () { blip(660, 0.1, 'sine', 0.25); setTimeout(function () { blip(990, 0.16, 'sine', 0.25); }, 90); },
    sting: function () {
      blip(523.25, 0.18, 'triangle', 0.3);
      setTimeout(function () { blip(659.25, 0.18, 'triangle', 0.3); }, 140);
      setTimeout(function () { blip(783.99, 0.34, 'triangle', 0.32); }, 280);
    },
    crash: function () { noiseBurst(0.3, 0.4, 700); },
    skid: function () { noiseBurst(0.22, 0.1, 3200); },
    busted: function () { blip(220, 0.5, 'sawtooth', 0.25); setTimeout(function () { blip(174, 0.7, 'sawtooth', 0.25); }, 320); },
    music: function (on) {
      if (on && !musicTimer) musicTimer = setInterval(musicTick, 140);
      if (!on && musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    },
    update: function () { /* engine/siren are driven per-frame by the caller */ }
  };
})();
