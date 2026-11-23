// SOLMARIS v4 — minimap.js: live 2D canvas. Roads, beach and bay, mission
// marker (pulsing yellow), traffic dots, enemies in red, police flashing
// blue/red, and the player as a green arrow rotated to heading. North-up.
(function () {
  const MM = {};
  const SIZE = 186;
  const WORLD = 430; // world units across the map (-215..215)
  let canvas = null;
  let g = null;

  function w2m(x) { return (x + WORLD / 2) / WORLD * SIZE; }

  MM.init = function (cv) {
    canvas = cv;
    g = cv.getContext('2d');
  };

  MM.draw = function (G) {
    if (!g || !G || !G.city) return;
    const city = G.city;
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
    const centers = [-80, 0, 80];
    for (const cx of centers) {
      for (const cz of centers) {
        g.fillRect(w2m(cx - 20), w2m(cz - 20), 40 / WORLD * SIZE, 40 / WORLD * SIZE);
      }
    }
    // Roads.
    g.strokeStyle = '#565e70';
    g.lineWidth = 13 / WORLD * SIZE;
    for (const line of city.roads) {
      const at = w2m(line);
      g.beginPath(); g.moveTo(0, at); g.lineTo(SIZE, at); g.stroke();
      g.beginPath(); g.moveTo(at, 0); g.lineTo(at, SIZE); g.stroke();
    }
    // Mission marker (pulsing yellow).
    const mp = SOL.missions && SOL.missions.markerPos ? SOL.missions.markerPos() : null;
    if (mp) {
      const pulse = 5 + Math.sin(G.time * 4) * 2;
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
      for (const c of SOL.traffic.cars) {
        g.fillRect(w2m(c.pos.x) - 1.5, w2m(c.pos.z) - 1.5, 3, 3);
      }
    }
    // Parked cars (grey dots).
    g.fillStyle = '#9aa0ad';
    if (SOL.main && SOL.main.parkedCars) {
      for (const c of SOL.main.parkedCars) {
        g.fillRect(w2m(c.pos.x) - 1.5, w2m(c.pos.z) - 1.5, 3, 3);
      }
    }
    // Enemies (red dots).
    g.fillStyle = '#ff5040';
    if (SOL.combat) {
      for (const en of SOL.combat.enemies) {
        g.beginPath();
        g.arc(w2m(en.pos.x), w2m(en.pos.z), 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Police (flashing blue/red).
    const flashBlue = Math.floor(G.time * 3) % 2 === 0;
    g.fillStyle = flashBlue ? '#3d8bff' : '#ff2e2e';
    if (SOL.police) {
      for (const pc of SOL.police.patrolCars) {
        g.beginPath();
        g.arc(w2m(pc.pos.x), w2m(pc.pos.z), 3.5, 0, Math.PI * 2);
        g.fill();
      }
      for (const cop of SOL.police.cops) {
        g.fillRect(w2m(cop.pos.x) - 2, w2m(cop.pos.z) - 2, 4, 4);
      }
    }
    // Player arrow (green, rotated to heading).
    if (G.player) {
      const px = w2m(G.player.pos.x);
      const py = w2m(G.player.pos.z);
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
  };

  SOL.minimap = MM;
})();
