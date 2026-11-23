// SOLMARIS v4 — audio.js: all sound is synthesized with WebAudio, no audio
// files are fetched. Engine hum, two-tone siren, gunshot noise, pickup blips
// and a small bassline music loop. Everything is guarded: if the browser has
// no AudioContext (or it stays suspended in headless mode) the game keeps
// running silently instead of throwing.
(function () {
  const A = {};
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let musicTimer = null;
  let musicStep = 0;
  A.muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = A.muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; return false; }
    return true;
  }

  A.init = function () {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
  };

  A.setMuted = function (m) {
    A.muted = m;
    if (master) master.gain.value = m ? 0 : 0.5;
    if (m) A.siren(false);
  };

  // Continuous engine hum whose pitch follows speed (0..1).
  A.engine = function (speed01) {
    if (!ensure() || A.muted) return;
    try {
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.0;
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = 420;
        engineOsc.connect(filt);
        filt.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      const now = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(52 + speed01 * 165, now, 0.08);
      engineGain.gain.setTargetAtTime(0.02 + speed01 * 0.055, now, 0.1);
    } catch (e) { /* audio is cosmetic */ }
  };

  // Two-tone police siren, toggled on/off.
  A.siren = function (on) {
    if (!ensure()) return;
    try {
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.035;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        let hi = true;
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
    } catch (e) { /* cosmetic */ }
  };

  function blip(freq, dur, type, vol) {
    if (!ensure() || A.muted) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(master);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch (e) { /* cosmetic */ }
  }

  // Gunshot: short filtered noise burst + low thump.
  A.shot = function () {
    if (!ensure() || A.muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * 0.14);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 1400;
      const g = ctx.createGain();
      g.gain.value = 0.35;
      src.connect(filt);
      filt.connect(g);
      g.connect(master);
      src.start();
      blip(90, 0.12, 'square', 0.18);
    } catch (e) { /* cosmetic */ }
  };

  A.pickup = function () { blip(660, 0.12, 'sine', 0.14); blip(990, 0.18, 'sine', 0.12); };
  A.cash = function () { blip(880, 0.1, 'triangle', 0.14); setTimeout(function () { blip(1320, 0.16, 'triangle', 0.14); }, 90); };
  A.busted = function () { blip(220, 0.5, 'sawtooth', 0.16); };

  // Tiny bassline loop (A minor-ish), one note per step, 8 steps.
  const BASS = [55, 0, 55, 65.4, 55, 0, 49, 58.3];
  A.music = function (on) {
    if (!ensure()) return;
    try {
      if (on && !musicTimer) {
        musicTimer = setInterval(function () {
          if (A.muted) return;
          const f = BASS[musicStep % BASS.length];
          musicStep++;
          if (f) blip(f, 0.42, 'triangle', 0.09);
        }, 300);
      } else if (!on && musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    } catch (e) { /* cosmetic */ }
  };

  SOL.audio = A;
})();
