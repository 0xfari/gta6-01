// SOLMARIS HUD — cash, health, stars, objective, dialogue, banners. Plain DOM.
window.SOL = window.SOL || {};
SOL.hud = (function () {
  var el = {};
  var dlgTimer = null;
  var bannerTimer = null;
  var toastTimer = null;
  var lastStars = -1;
  var lastCash = -1;
  var lastHealth = -1;
  var lastObjective = '';

  function $(id) { return document.getElementById(id); }

  function setStars(n) {
    if (n === lastStars) return;
    lastStars = n;
    var html = '';
    for (var i = 0; i < 5; i++) {
      html += '<span class="' + (i < n ? 'on' : 'off') + '">★</span>';
    }
    el.stars.innerHTML = html;
    var label = n > 0 && SOL.police ? SOL.police.labels[n] : '';
    el.wantedlabel.textContent = label;
  }

  return {
    init: function () {
      el.cash = $('cash');
      el.healthfill = $('healthfill');
      el.stars = $('stars');
      el.wantedlabel = $('wantedlabel');
      el.objectivetext = $('objectivetext');
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
    },
    show: function () { el.hud.classList.remove('hidden'); },
    hide: function () { el.hud.classList.add('hidden'); },
    update: function (G) {
      var cash = G.cash | 0;
      if (cash !== lastCash) { lastCash = cash; el.cash.textContent = '$' + cash.toLocaleString('en-US'); }
      var hp = Math.max(0, Math.round(G.health));
      if (hp !== lastHealth) {
        lastHealth = hp;
        el.healthfill.style.width = hp + '%';
        el.vignette.style.opacity = hp < 35 ? String((35 - hp) / 35 * 0.85) : '0';
      }
      setStars(G.wanted | 0);
      if (G.player && G.player.car) {
        el.speedo.classList.remove('hidden');
        el.speed.textContent = String(Math.round(Math.abs(G.player.car.speed) * 3.6));
        el.carname.textContent = G.player.car.name;
        el.crosshair.classList.add('hidden');
      } else {
        el.speedo.classList.add('hidden');
        el.crosshair.classList.remove('hidden');
      }
    },
    objective: function (text) {
      if (text === lastObjective) return;
      lastObjective = text;
      el.objectivetext.textContent = text;
    },
    dialogue: function (name, text, ms) {
      el.dlgname.textContent = name;
      el.dlgtext.textContent = text;
      el.dialogue.classList.remove('hidden');
      if (dlgTimer) clearTimeout(dlgTimer);
      dlgTimer = setTimeout(function () { el.dialogue.classList.add('hidden'); }, ms || 5200);
    },
    hideDialogue: function () {
      if (dlgTimer) clearTimeout(dlgTimer);
      el.dialogue.classList.add('hidden');
    },
    banner: function (main, sub, ms) {
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
    },
    toast: function (text, ms) {
      el.toast.textContent = text;
      el.toast.classList.remove('hidden');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { el.toast.classList.add('hidden'); }, ms || 3200);
    },
    damage: function () {
      el.vignette.style.opacity = '0.9';
      setTimeout(function () { el.vignette.style.opacity = '0'; }, 180);
    }
  };
})();
