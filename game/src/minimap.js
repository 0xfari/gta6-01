// SOLMARIS v6 — minimap.js: live 2D canvas. Roads, beach and bay, mission
// marker (pulsing yellow), traffic dots, enemies in red, police flashing
// blue/red, and the player as a green arrow rotated to heading. North-up.
(function () {
  var MM = {};
  var SIZE = 186;
  var WORLD = 430; // world units across the map (-215..215)
  var canvas = null;
  var g = null;

  function w2m(x) {
    return ((x + WORLD / 2) / WORLD) * SIZE;
  }

  function dot(x, z, r) {
    g.beginPath();
    g.arc(w2m(x), w2m(z), r, 0, Math.PI * 2);
    g.fill();
  }

  function drawTerrain(city) {
    // Sea + sand (east), bay (south).
    g.fillStyle = '#17324a';
    g.fillRect(0, 0, SIZE, SIZE);
    g.fillStyle = '#1e6f8e';
    g.fillRect(w2m(215), 0, SIZE - w2m(215), SIZE);
    g.fillRect(0, w2m(215), SIZE, SIZE - w2m(215));
    g.fillStyle = '#e0c98f';
    g.fillRect(w2m(168), 0, w2m(215) - w2m(168), SIZE);
    // Land.
    g.fillStyle = '#2a3140';
    g.fillRect(0, 0, w2m(168), w2m(215));
    // Blocks (lighter) between roads.
    g.fillStyle = '#3d465c';
    var centers = [-80, 0, 80];
    for (var i = 0; i < centers.length; i++) {
      for (var j = 0; j < centers.length; j++) {
        g.fillRect(w2m(centers[i] - 20), w2m(centers[j] - 20), (40 / WORLD) * SIZE, (40 / WORLD) * SIZE);
      }
    }
    // Roads.
    g.strokeStyle = '#565e70';
    g.lineWidth = (13 / WORLD) * SIZE;
    for (var k = 0; k < city.roads.length; k++) {
      var at = w2m(city.roads[k]);
      g.beginPath();
      g.moveTo(0, at);
      g.lineTo(SIZE, at);
      g.stroke();
      g.beginPath();
      g.moveTo(at, 0);
      g.lineTo(at, SIZE);
      g.stroke();
    }
  }

  function drawMarker(G) {
    var mp = SOL.missions && SOL.missions.markerPos ? SOL.missions.markerPos() : null;
    if (!mp) return;
    var pulse = 5 + Math.sin(G.time * 4) * 2;
    g.fillStyle = '#ffd23e';
    dot(mp.x, mp.z, pulse);
    g.strokeStyle = '#7a4d00';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(w2m(mp.x), w2m(mp.z), pulse, 0, Math.PI * 2);
    g.stroke();
  }

  function drawActors(G) {
    // Traffic cars (white dots).
    g.fillStyle = '#dfe6f2';
    if (SOL.traffic) {
      for (var i = 0; i < SOL.traffic.cars.length; i++) {
        var c = SOL.traffic.cars[i];
        g.fillRect(w2m(c.pos.x) - 1.5, w2m(c.pos.z) - 1.5, 3, 3);
      }
    }
    // Parked cars (grey dots).
    g.fillStyle = '#9aa0ad';
    if (SOL.main && SOL.main.parkedCars) {
      for (var j = 0; j < SOL.main.parkedCars.length; j++) {
        var pc = SOL.main.parkedCars[j];
        g.fillRect(w2m(pc.pos.x) - 1.5, w2m(pc.pos.z) - 1.5, 3, 3);
      }
    }
    // Enemies (red dots).
    g.fillStyle = '#ff5040';
    if (SOL.combat) {
      for (var k = 0; k < SOL.combat.enemies.length; k++) {
        var en = SOL.combat.enemies[k];
        dot(en.pos.x, en.pos.z, 3);
      }
    }
    // Police (flashing blue/red).
    var flashBlue = Math.floor(G.time * 3) % 2 === 0;
    g.fillStyle = flashBlue ? '#3d8bff' : '#ff2e2e';
    if (SOL.police) {
      for (var m = 0; m < SOL.police.patrolCars.length; m++) {
        var cruiser = SOL.police.patrolCars[m];
        dot(cruiser.pos.x, cruiser.pos.z, 3.5);
      }
      for (var n = 0; n < SOL.police.cops.length; n++) {
        var cop = SOL.police.cops[n];
        g.fillRect(w2m(cop.pos.x) - 2, w2m(cop.pos.z) - 2, 4, 4);
      }
    }
  }

  function drawPlayer(G) {
    if (!G.player) return;
    var px = w2m(G.player.pos.x);
    var py = w2m(G.player.pos.z);
    g.save();
    g.translate(px, py);
    g.rotate(-G.player.yaw);
    g.fillStyle = '#7dff9a';
    g.strokeStyle = '#062b12';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(5.5, 6);
    g.lineTo(0, 3);
    g.lineTo(-5.5, 6);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }

  MM.init = function (cv) {
    canvas = cv;
    g = cv.getContext('2d');
  };

  MM.draw = function (G) {
    if (!g || !G || !G.city) return;
    g.clearRect(0, 0, SIZE, SIZE);
    drawTerrain(G.city);
    drawMarker(G);
    drawActors(G);
    drawPlayer(G);
    // North tick.
    g.fillStyle = '#ffd23e';
    g.font = 'bold 11px sans-serif';
    g.fillText('N', SIZE / 2 - 4, 12);
  };

  SOL.minimap = MM;
})();
