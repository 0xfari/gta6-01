// SOLMARIS v4 — hud.js: cash, health, stars, objective, dialogue, banners.
// Plain DOM, updated only when values change so the browser is not doing
// layout work every frame. The red vignette doubles as the damage flash and
// the low-health warning.
(function () {
  const H = {};
  const el = {};
  let dlgTimer = null;
  let bannerTimer = null;
  let toastTimer = null;
  let lastStars = -1;
  let lastCash = -1;
  let lastHealth = -1;
  let lastObjective = '';
  let lastAmmo = '';

  function $(id) { return document.getElementById(id); }

  function setStars(n) {
    if (n === lastStars) return;
    lastStars = n;
    let html = '';
    for (let i = 0; i < 5; i++) {
      html += '<span class="' + (i < n ? 'on' : 'off') + '">★</span>';
    }
    el.stars.innerHTML = html;
    el.wanted.textContent = n > 0 && SOL.police ? SOL.police.labels[n] : '';
  }

  H.init = function () {
    el.cash = $('cash');
    el.healthfill = $('healthfill');
    el.stars = $('stars');
    el.wanted = $('wanted');
    el.objtext = $('objtext');
    el.speedo = $('speedo');
    el.speed = $('speed');
    el.carname = $('carname');
    el.crosshair = $('crosshair');
    el.dialogue = $('dialogue');
    el.dlgname = $('dlgname');
    el.dlgtext = $('dlgtext');
    el.banner = $('banner');
    el.bannersub = $('bannersub');
    el.toast = $('toast');
    el.vignette = $('vignette');
    el.hud = $('hud');
    el.ammoline = $('ammoline');
  };

  H.show = function () { el.hud.classList.remove('hidden'); };
  H.hide = function () { el.hud.classList.add('hidden'); };

  H.update = function (G) {
    const cash = G.cash | 0;
    if (cash !== lastCash) {
      lastCash = cash;
      el.cash.textContent = '$' + cash.toLocaleString('en-US');
    }
    const hp = Math.max(0, Math.round(G.health));
    if (hp !== lastHealth) {
      lastHealth = hp;
      el.healthfill.style.width = hp + '%';
      el.vignette.style.opacity = hp < 35 ? String((35 - hp) / 35 * 0.85) : '0';
    }
    setStars(G.wanted | 0);
    const ammo = G.player && !G.player.car ? 'PISTOL ∞' : '';
    if (ammo !== lastAmmo) {
      lastAmmo = ammo;
      el.ammoline.textContent = ammo;
    }
    if (G.player && G.player.car) {
      el.speedo.classList.remove('hidden');
      el.speed.textContent = String(Math.round(Math.abs(G.player.car.speed) * 3.6));
      el.carname.textContent = G.player.car.name;
      el.crosshair.classList.add('hidden');
    } else {
      el.speedo.classList.add('hidden');
      el.crosshair.classList.remove('hidden');
    }
  };

  H.objective = function (text) {
    if (text === lastObjective) return;
    lastObjective = text;
    el.objtext.textContent = text;
  };

  H.dialogue = function (name, text, ms) {
    el.dlgname.textContent = name;
    el.dlgtext.textContent = text;
    el.dialogue.classList.remove('hidden');
    if (dlgTimer) clearTimeout(dlgTimer);
    dlgTimer = setTimeout(function () { el.dialogue.classList.add('hidden'); }, ms || 5200);
  };

  H.hideDialogue = function () {
    if (dlgTimer) clearTimeout(dlgTimer);
    el.dialogue.classList.add('hidden');
  };

  H.banner = function (main, sub, ms) {
    el.banner.textContent = main;
    el.banner.classList.remove('hidden');
    if (sub) {
      el.bannersub.textContent = sub;
      el.bannersub.classList.remove('hidden');
    }
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () {
      el.banner.classList.add('hidden');
      el.bannersub.classList.add('hidden');
    }, ms || 2800);
  };

  H.toast = function (text, ms) {
    el.toast.textContent = text;
    el.toast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.add('hidden'); }, ms || 3200);
  };

  H.damage = function () {
    el.vignette.style.opacity = '0.9';
    setTimeout(function () { el.vignette.style.opacity = '0'; }, 180);
  };

  SOL.hud = H;
})();
