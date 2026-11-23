// SOLMARIS minimap — live 2D canvas: roads, beach, player, cars, police, marker.
window.SOL = window.SOL || {};
SOL.minimap = (function () {
  var canvas = null;
  var g = null;
  var SIZE = 190;
  var WORLD = 430; // world units across the map (-215..215)

  function w2m(x) { return (x + WORLD / 2) / WORLD * SIZE; }

  return {
    init: function (cv) {
      canvas = cv;
      g = cv.getContext('2d');
    },
    draw: function (G) {
      if (!g || !G || !G.city) return;
      var city = G.city;
      g.clearRect(0, 0, SIZE, SIZE);
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
      var centers = [-116, -58, 0, 58, 116];
      for (var i = 0; i < centers.length; i++) {
        for (var j = 0; j < centers.length; j++) {
          g.fillRect(w2m(centers[i] - 21), w2m(centers[j] - 21), 42 / WORLD * SIZE, 42 / WORLD * SIZE);
        }
      }
      // Roads.
      g.strokeStyle = '#565e70';
      g.lineWidth = 14 / WORLD * SIZE;
      for (var r = 0; r < city.roads.length; r++) {
        var at = w2m(city.roads[r]);
        g.beginPath(); g.moveTo(0, at); g.lineTo(SIZE, at); g.stroke();
        g.beginPath(); g.moveTo(at, 0); g.lineTo(at, SIZE); g.stroke();
      }
      // Mission marker (pulsing yellow).
      var mp = SOL.missions && SOL.missions.markerPos ? SOL.missions.markerPos() : null;
      if (mp) {
        var pulse = 5 + Math.sin(G.time * 4) * 2;
        g.fillStyle = '#ffd23e';
        g.beginPath();
        g.arc(w2m(mp.x), w2m(mp.z), pulse, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#7a4d00';
        g.lineWidth = 1.5;
        g.stroke();
      }
      // Traffic cars (white dots).
      g.fillStyle = '#dfe6f2';
      if (SOL.traffic) {
        for (var t = 0; t < SOL.traffic.cars.length; t++) {
          var c = SOL.traffic.cars[t];
          g.fillRect(w2m(c.pos.x) - 1.5, w2m(c.pos.z) - 1.5, 3, 3);
        }
      }
      // Enemies (red dots).
      g.fillStyle = '#ff5040';
      if (SOL.combat) {
        for (var e = 0; e < SOL.combat.enemies.length; e++) {
          var en = SOL.combat.enemies[e];
          g.beginPath();
          g.arc(w2m(en.pos.x), w2m(en.pos.z), 3, 0, Math.PI * 2);
          g.fill();
        }
      }
      // Police (flashing blue/red).
      var flashBlue = Math.floor(G.time * 3) % 2 === 0;
      g.fillStyle = flashBlue ? '#3d8bff' : '#ff2e2e';
      if (SOL.police) {
        for (var p = 0; p < SOL.police.policeCars.length; p++) {
          var pc = SOL.police.policeCars[p];
          g.beginPath();
          g.arc(w2m(pc.pos.x), w2m(pc.pos.z), 3.5, 0, Math.PI * 2);
          g.fill();
        }
        for (var k = 0; k < SOL.police.cops.length; k++) {
          var cop = SOL.police.cops[k];
          g.fillRect(w2m(cop.pos.x) - 2, w2m(cop.pos.z) - 2, 4, 4);
        }
      }
      // Player arrow (green, rotated to heading).
      if (G.player) {
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
      // North tick.
      g.fillStyle = '#ffd23e';
      g.font = 'bold 11px sans-serif';
      g.fillText('N', SIZE / 2 - 4, 12);
    }
  };
})();
