// SOLMARIS v6 — police.js: a 5-star wanted system. Heat runs 0..125 and
// wanted = ceil(heat / 25), capped at 5. Crimes add heat; lying low with no
// cruiser nearby lets it cool. Pursuit scales with stars: patrol cars that
// chase the player's predicted position and ram, plus foot cops who sprint
// at an on-foot player — touched for 1.4 s straight means BUSTED.
(function () {
  var P = {};
  var patrolCars = [];
  var cops = [];
  var LABELS = [
    '',
    'WANTED — patrol on your tail',
    'WANTED — cruisers converging',
    'WANTED — roadblocks ahead',
    'WANTED — the whole precinct is out',
    'WANTED — maximum heat. Good luck, Lena.',
  ];
  var scene = null;
  var city = null;
  var vehicles = null;
  var effects = null;
  var heat = 0;
  var wanted = 0;
  var quietFor = 0;
  var spawnIn = 0;

  function cruiserMesh() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.BoxGeometry(1.95, 0.62, 4.5),
      new THREE.MeshLambertMaterial({ color: 0x14181f })
    );
    body.position.y = 0.66;
    g.add(body);
    var cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.55, 2.3),
      new THREE.MeshLambertMaterial({ color: 0xe8e8e8 })
    );
    cabin.position.set(0, 1.18, -0.2);
    g.add(cabin);
    var stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.97, 0.2, 4.2),
      new THREE.MeshLambertMaterial({ color: 0xe8e8e8 })
    );
    stripe.position.y = 0.72;
    g.add(stripe);
    var barR = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2e2e })
    );
    barR.position.set(-0.4, 1.55, -0.2);
    g.add(barR);
    var barB = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x2e6bff })
    );
    barB.position.set(0.4, 1.55, -0.2);
    g.add(barB);
    g.userData.barR = barR;
    g.userData.barB = barB;
    var wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
    var wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
    var spots = [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]];
    for (var i = 0; i < spots.length; i++) {
      var w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(spots[i][0], 0.42, spots[i][1]);
      g.add(w);
    }
    return g;
  }

  function copMesh() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.9, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x1a2a4a })
    );
    body.position.y = 1.05;
    g.add(body);
    var head = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.36, 0.36),
      new THREE.MeshLambertMaterial({ color: 0xe8b88a })
    );
    head.position.y = 1.7;
    g.add(head);
    var cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.14, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x101826 })
    );
    cap.position.y = 1.92;
    g.add(cap);
    var legL = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.65, 0.2),
      new THREE.MeshLambertMaterial({ color: 0x101826 })
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

  function makeCruiser(x, z, yaw, cruiseSpeed) {
    var car = vehicles.makeCar(0, 0x14181f, x, z, yaw || 0);
    scene.remove(car.group);
    var mesh = cruiserMesh();
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw || 0;
    scene.add(mesh);
    car.group = mesh;
    car.driver = 'police';
    car.cruise = cruiseSpeed;
    car.topSpeed = cruiseSpeed;
    car.accel = 20;
    car.speed = Math.min(12, cruiseSpeed);
    car.yaw = yaw || 0;
    patrolCars.push(car);
    return car;
  }

  function spawnCruiser(nearPos) {
    var p = city.roadPointAhead(nearPos.x, nearPos.z, 55 + SOL.rand() * 30);
    var car = makeCruiser(p.x, p.z, 0, 30 + wanted * 3.5);
    car.speed = 12;
    return car;
  }

  function spawnCop(nearPos) {
    var s = city.randomSidewalkPoint();
    var dx = nearPos.x - s.x;
    var dz = nearPos.z - s.z;
    if (dx * dx + dz * dz > 60 * 60) s = { x: nearPos.x + 14, z: nearPos.z + 8 };
    var g = copMesh();
    g.position.set(s.x, 0, s.z);
    scene.add(g);
    cops.push({ group: g, pos: g.position, yaw: 0, speed: 6.4, phase: 0, touch: 0 });
  }

  function clearPursuit() {
    for (var i = 0; i < patrolCars.length; i++) scene.remove(patrolCars[i].group);
    for (var j = 0; j < cops.length; j++) scene.remove(cops[j].group);
    patrolCars.length = 0;
    cops.length = 0;
  }

  function strobe(car, i) {
    var on = Math.floor(SOL.G.time * 6 + i) % 2 === 0;
    car.group.userData.barR.material.color.setHex(on ? 0xff2e2e : 0x551111);
    car.group.userData.barB.material.color.setHex(on ? 0x112255 : 0x2e6bff);
  }

  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  P.patrolCars = patrolCars;
  P.cops = cops;
  P.wanted = 0;
  P.heat = 0;
  P.labels = LABELS;

  P.init = function (sc, cityMod, vehiclesMod, effectsMod) {
    scene = sc;
    city = cityMod;
    vehicles = vehiclesMod;
    effects = effectsMod;
    heat = 0;
    wanted = 0;
    P.wanted = 0;
    P.heat = 0;
    patrolCars.length = 0;
    cops.length = 0;
  };

  P.addHeat = function (n, why) {
    if (n <= 0) return;
    heat = Math.min(125, heat + n);
    P.heat = heat;
    quietFor = 0;
    var w = Math.min(5, Math.ceil(heat / 25));
    if (w > wanted) {
      wanted = w;
      P.wanted = w;
      if (SOL.hud) SOL.hud.toast('WANTED LEVEL ' + w + ' — ' + (why || 'the law noticed'));
      if (SOL.audio) SOL.audio.pickup();
    }
  };

  P.setWanted = function (n) {
    wanted = Math.max(0, Math.min(5, n));
    P.wanted = wanted;
    heat = wanted * 25;
    P.heat = heat;
    quietFor = 0;
  };

  P.clearWanted = function () {
    heat = 0;
    wanted = 0;
    P.wanted = 0;
    P.heat = 0;
    clearPursuit();
  };

  // Spawn one pursuit car at an exact spot — the chase staging uses this to
  // put cruisers where the camera can see them. A staged cruiser holds
  // formation instead of pursuing, so it stays in frame for the shot.
  P.spawnAt = function (x, z, yaw) {
    var car = makeCruiser(x, z, yaw, 26);
    car.staged = true;
    car.speed = 26;
    return car;
  };

  P.nearestPoliceDist = function (pos) {
    var best = Infinity;
    for (var i = 0; i < patrolCars.length; i++) {
      best = Math.min(best, Math.hypot(patrolCars[i].pos.x - pos.x, patrolCars[i].pos.z - pos.z));
    }
    for (var j = 0; j < cops.length; j++) {
      best = Math.min(best, Math.hypot(cops[j].pos.x - pos.x, cops[j].pos.z - pos.z));
    }
    return best;
  };

  P.update = function (dt, player, playerCar) {
    quietFor += dt;
    // Heat cools when the player lies low and no cruiser is near.
    if (quietFor > 6 && wanted > 0) {
      var near = P.nearestPoliceDist(player.pos);
      if (near > 45) {
        heat = Math.max(0, heat - 3.2 * dt);
        P.heat = heat;
        var w = Math.ceil(heat / 25);
        if (w !== wanted) {
          wanted = w;
          P.wanted = w;
          if (w === 0) clearPursuit();
        }
      }
    }
    // Spawn / despawn pursuit to match the wanted level.
    spawnIn -= dt;
    if (wanted > 0 && spawnIn <= 0) {
      spawnIn = 1.2;
      var wantCars = Math.min(1 + Math.floor(wanted / 2), 4);
      var wantCops = wanted >= 2 ? Math.min(wanted - 1, 3) : 0;
      if (patrolCars.length < wantCars) spawnCruiser(player.pos);
      if (cops.length < wantCops) spawnCop(player.pos);
      if (patrolCars.length > wantCars + 1) {
        var far = patrolCars.pop();
        scene.remove(far.group);
      }
    }
    var tx = player.pos.x;
    var tz = player.pos.z;
    // Pursuit cars chase the player's predicted position and ram to slow them.
    for (var i = 0; i < patrolCars.length; i++) {
      var c = patrolCars[i];
      if (c.staged) {
        c.pos.x += Math.sin(c.yaw) * c.speed * dt;
        c.pos.z += Math.cos(c.yaw) * c.speed * dt;
        c.group.position.set(c.pos.x, 0, c.pos.z);
        c.group.rotation.y = c.yaw;
        strobe(c, i);
        continue;
      }
      var px = playerCar ? playerCar.pos.x + Math.sin(playerCar.yaw) * playerCar.speed * 0.4 : tx;
      var pz = playerCar ? playerCar.pos.z + Math.cos(playerCar.yaw) * playerCar.speed * 0.4 : tz;
      var dx = px - c.pos.x;
      var dz = pz - c.pos.z;
      var dist = Math.sqrt(dx * dx + dz * dz) || 1;
      var wantYaw = Math.atan2(dx, dz);
      var dy = wrapAngle(wantYaw - c.yaw);
      c.yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, dy));
      var cruise = Math.min(c.topSpeed, 20 + dist * 0.55);
      c.speed += Math.max(-22 * dt, Math.min(18 * dt, cruise - c.speed));
      c.pos.x += Math.sin(c.yaw) * c.speed * dt;
      c.pos.z += Math.cos(c.yaw) * c.speed * dt;
      city.resolveCollision(c.pos, 2.2);
      c.group.position.set(c.pos.x, 0, c.pos.z);
      c.group.rotation.y = c.yaw;
      strobe(c, i);
      // Ram the player's car.
      if (playerCar && dist < 4.6) {
        playerCar.speed = Math.max(0, playerCar.speed - 14 * dt);
        if (SOL.rand() < dt * 2 && effects) effects.sparks(playerCar.pos);
      }
    }
    // Foot cops sprint at an on-foot player; touching means a bust.
    var busted = false;
    for (var k = 0; k < cops.length; k++) {
      var cop = cops[k];
      var cdx = tx - cop.pos.x;
      var cdz = tz - cop.pos.z;
      var cdist = Math.sqrt(cdx * cdx + cdz * cdz) || 1;
      if (playerCar) {
        // Cops give up chasing a car — they jog back to the sidewalk.
        cop.pos.x += Math.sin(cop.yaw) * 2 * dt;
        cop.pos.z += Math.cos(cop.yaw) * 2 * dt;
      } else {
        cop.yaw = Math.atan2(cdx, cdz);
        cop.pos.x += Math.sin(cop.yaw) * cop.speed * dt;
        cop.pos.z += Math.cos(cop.yaw) * cop.speed * dt;
        cop.phase += dt * 11;
        cop.group.userData.legL.rotation.x = Math.sin(cop.phase) * 0.7;
        cop.group.userData.legR.rotation.x = -Math.sin(cop.phase) * 0.7;
        if (cdist < 1.6) {
          cop.touch += dt;
          if (cop.touch > 1.4) busted = true;
        } else {
          cop.touch = Math.max(0, cop.touch - dt);
        }
      }
      cop.group.position.set(cop.pos.x, 0, cop.pos.z);
      cop.group.rotation.y = cop.yaw;
    }
    if (busted && SOL.main && SOL.main.onBusted) SOL.main.onBusted();
    return busted;
  };

  SOL.police = P;
})();
