// SOLMARIS pedestrians — 22 walkers on the sidewalks; they flee from gunfire.
window.SOL = window.SOL || {};
SOL.pedestrians = (function () {
  var scene = null;
  var city = null;
  var peds = [];
  var SHIRTS = [0xe86a5a, 0x5a8ae8, 0x7ac25a, 0xe8c95a, 0xb05ae8, 0x5ad8d8, 0xe85aa0, 0xd8d8d8];
  var PANTS = [0x2c3a4a, 0x4a2c2c, 0x2c4a34, 0x3a3a3a, 0x5a4a6a];

  function buildPed() {
    var g = new THREE.Group();
    var shirt = SHIRTS[Math.floor(Math.random() * SHIRTS.length)];
    var pants = PANTS[Math.floor(Math.random() * PANTS.length)];
    var skin = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0][Math.floor(Math.random() * 4)];
    var body = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.85, 0.32),
      new THREE.MeshLambertMaterial({ color: shirt })
    );
    body.position.y = 1.05;
    g.add(body);
    var head = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.36, 0.36),
      new THREE.MeshLambertMaterial({ color: skin })
    );
    head.position.y = 1.68;
    g.add(head);
    var legL = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.65, 0.2),
      new THREE.MeshLambertMaterial({ color: pants })
    );
    legL.position.set(-0.14, 0.33, 0);
    g.add(legL);
    var legR = legL.clone();
    legR.position.x = 0.14;
    g.add(legR);
    g.userData.legL = legL;
    g.userData.legR = legR;
    return g;
  }

  function newDestination(p) {
    var s = city.randomSidewalkPoint();
    p.tx = s.x;
    p.tz = s.z;
  }

  return {
    peds: peds,
    init: function (sc, cityMod) {
      scene = sc;
      city = cityMod;
      // Empty in place: the array is shared with the player and the police,
      // so reassigning it would leave stale references behind.
      peds.length = 0;
      for (var i = 0; i < 22; i++) {
        var s = city.randomSidewalkPoint();
        var g = buildPed();
        g.position.set(s.x, 0, s.z);
        scene.add(g);
        var p = {
          group: g, pos: g.position, yaw: Math.random() * Math.PI * 2,
          tx: s.x, tz: s.z, speed: 1.1 + Math.random() * 0.9,
          walkPhase: Math.random() * 6, fleeing: false, panic: 0
        };
        newDestination(p);
        peds.push(p);
      }
    },
    update: function (dt, threat) {
      for (var i = 0; i < peds.length; i++) {
        var p = peds[i];
        var dx = p.tx - p.pos.x;
        var dz = p.tz - p.pos.z;
        var dist = Math.sqrt(dx * dx + dz * dz);
        // Flee: a threat (gunfire / speeding car) nearby sends them running away.
        if (threat) {
          var tdx = p.pos.x - threat.x;
          var tdz = p.pos.z - threat.z;
          var td = Math.sqrt(tdx * tdx + tdz * tdz);
          if (td < threat.radius) {
            p.fleeing = true;
            p.panic = 2.5;
            p.tx = p.pos.x + (tdx / (td || 1)) * 26;
            p.tz = p.pos.z + (tdz / (td || 1)) * 26;
          }
        }
        if (p.panic > 0) p.panic -= dt;
        if (p.panic <= 0) p.fleeing = false;
        if (dist < 1.2) { newDestination(p); continue; }
        var speed = p.fleeing ? 5.2 : p.speed;
        p.yaw = Math.atan2(dx, dz);
        p.pos.x += Math.sin(p.yaw) * speed * dt;
        p.pos.z += Math.cos(p.yaw) * speed * dt;
        p.group.rotation.y = p.yaw;
        p.walkPhase += dt * speed * 3.4;
        var swing = Math.sin(p.walkPhase) * 0.5;
        p.group.userData.legL.rotation.x = swing;
        p.group.userData.legR.rotation.x = -swing;
        p.group.position.y = Math.abs(Math.sin(p.walkPhase)) * 0.06;
      }
    },
    // Nearest pedestrian to a point (for hit checks / crime witnesses).
    nearestTo: function (x, z, maxDist) {
      var best = null;
      var bestD = maxDist * maxDist;
      for (var i = 0; i < peds.length; i++) {
        var p = peds[i];
        var dx = p.pos.x - x;
        var dz = p.pos.z - z;
        var d2 = dx * dx + dz * dz;
        if (d2 < bestD) { bestD = d2; best = p; }
      }
      return best;
    },
    countFleeing: function () {
      var n = 0;
      for (var i = 0; i < peds.length; i++) if (peds[i].fleeing) n++;
      return n;
    }
  };
})();
