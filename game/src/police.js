// SOLMARIS police — a 5-star wanted system: patrol cars, foot cops, busts.
window.SOL = window.SOL || {};
SOL.police = (function () {
  var scene = null;
  var city = null;
  var vehicles = null;
  var effects = null;
  var heat = 0;          // 0..125 — wanted = ceil(heat / 25), capped at 5
  var wanted = 0;
  var quietTimer = 0;    // seconds since the last crime
  var policeCars = [];
  var cops = [];
  var bustTimer = 0;
  var spawnTimer = 0;

  var WANTED_LABELS = [
    '', 'WANTED — patrol on your tail', 'WANTED — cruisers converging',
    'WANTED — roadblocks ahead', 'WANTED — the whole precinct is out',
    'WANTED — maximum heat. Good luck, Lena.'
  ];

  function policeCarMesh() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.BoxGeometry(1.95, 0.62, 4.5),
      new THREE.MeshLambertMaterial({ color: 0x1a2027 })
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
    [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]].forEach(function (p) {
      var w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(p[0], 0.42, p[1]);
      g.add(w);
    });
    return g;
  }

  function makeCopMesh() {
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

  function spawnPoliceCar(nearPos) {
    var p = city.roadPointAhead(nearPos.x, nearPos.z, 55 + Math.random() * 30);
    var car = vehicles.makeCar(0, 0x1a2027, p.x, p.z, 0);
    scene.remove(car.group);
    var mesh = policeCarMesh();
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
    car.group = mesh;
    car.driver = 'police';
    car.cruise = 30 + wanted * 3.5;
    car.topSpeed = 30 + wanted * 3.5;
    car.accel = 20;
    car.speed = 12;
    policeCars.push(car);
    return car;
  }

  function spawnCop(nearPos) {
    var s = city.randomSidewalkPoint();
    var dx = nearPos.x - s.x;
    var dz = nearPos.z - s.z;
    if (dx * dx + dz * dz > 60 * 60) { s = { x: nearPos.x + 14, z: nearPos.z + 8 }; }
    var g = makeCopMesh();
    g.position.set(s.x, 0, s.z);
    scene.add(g);
    cops.push({ group: g, pos: g.position, yaw: 0, speed: 6.4, walkPhase: 0, touchTime: 0 });
  }

  function desiredUnits() {
    return wanted === 0 ? 0 : Math.min(2 + wanted, 7);
  }

  function clearPursuit() {
    // Empty in place: the arrays are shared with the minimap and traffic,
    // so reassigning them would leave stale references behind.
    for (var i = 0; i < policeCars.length; i++) scene.remove(policeCars[i].group);
    for (var j = 0; j < cops.length; j++) scene.remove(cops[j].group);
    policeCars.length = 0;
    cops.length = 0;
  }

  return {
    policeCars: policeCars,
    cops: cops,
    wanted: 0,
    heat: 0,
    labels: WANTED_LABELS,
    init: function (sc, cityMod, vehiclesMod, effectsMod) {
      scene = sc;
      city = cityMod;
      vehicles = vehiclesMod;
      effects = effectsMod;
      heat = 0;
      wanted = 0;
      // Empty in place: the arrays are shared with the minimap and traffic,
      // so reassigning them would leave stale references behind.
      policeCars.length = 0;
      cops.length = 0;
    },
    addHeat: function (n, why) {
      if (n <= 0) return;
      heat = Math.min(125, heat + n);
      quietTimer = 0;
      var w = Math.min(5, Math.ceil(heat / 25));
      if (w > wanted) {
        wanted = w;
        this.wanted = w;
        if (SOL.hud) SOL.hud.toast('WANTED LEVEL ' + w + ' — ' + (why || 'the law noticed'));
        if (SOL.audio) SOL.audio.blip();
      }
    },
    setWanted: function (n) {
      wanted = Math.max(0, Math.min(5, n));
      this.wanted = wanted;
      heat = wanted * 25;
      quietTimer = 0;
    },
    clearWanted: function () {
      heat = 0;
      wanted = 0;
      this.wanted = 0;
      clearPursuit();
    },
    // Spawn one pursuit car at an exact spot, facing a yaw — the chase
    // staging uses this to put cruisers where the camera can see them.
    spawnAt: function (x, z, yaw) {
      var car = vehicles.makeCar(0, 0x1a2027, x, z, yaw || 0);
      scene.remove(car.group);
      var mesh = policeCarMesh();
      mesh.position.set(x, 0, z);
      mesh.rotation.y = yaw || 0;
      scene.add(mesh);
      car.group = mesh;
      car.driver = 'police';
      // Staged cruiser: holds formation instead of pursuing — it drives
      // straight at the player's speed, so it stays in frame for the shot.
      car.staged = true;
      car.cruise = 26;
      car.topSpeed = 26;
      car.accel = 20;
      car.speed = 26;
      car.yaw = yaw || 0;
      policeCars.push(car);
      return car;
    },
    nearestPoliceDist: function (pos) {
      var best = Infinity;
      for (var i = 0; i < policeCars.length; i++) {
        var c = policeCars[i];
        var dx = c.pos.x - pos.x;
        var dz = c.pos.z - pos.z;
        best = Math.min(best, Math.sqrt(dx * dx + dz * dz));
      }
      for (var j = 0; j < cops.length; j++) {
        var k = cops[j];
        var ddx = k.pos.x - pos.x;
        var ddz = k.pos.z - pos.z;
        best = Math.min(best, Math.sqrt(ddx * ddx + ddz * ddz));
      }
      return best;
    },
    update: function (dt, player, playerCar) {
      quietTimer += dt;
      // Heat cools when the player lies low and no cruiser is near.
      if (quietTimer > 6 && wanted > 0) {
        var near = this.nearestPoliceDist(player.pos);
        if (near > 45) {
          heat = Math.max(0, heat - 3.2 * dt);
          var w = Math.ceil(heat / 25);
          if (w !== wanted) { wanted = w; this.wanted = w; if (w === 0) clearPursuit(); }
        }
      }
      // Spawn / despawn pursuit to match the wanted level.
      spawnTimer -= dt;
      if (wanted > 0 && spawnTimer <= 0) {
        spawnTimer = 1.2;
        var wantCars = Math.min(1 + Math.floor(wanted / 2), 4);
        var wantCops = wanted >= 2 ? Math.min(wanted - 1, 3) : 0;
        if (policeCars.length < wantCars) spawnPoliceCar(player.pos);
        if (cops.length < wantCops) spawnCop(player.pos);
        if (policeCars.length > wantCars + 1) {
          var far = policeCars.pop();
          scene.remove(far.group);
        }
      }
      var target = playerCar || null;
      var tx = player.pos.x;
      var tz = player.pos.z;
      // Pursuit cars: chase the player's predicted position, ram to slow them.
      for (var i = 0; i < policeCars.length; i++) {
        var c = policeCars[i];
        // Staged cruiser: drive straight at formation speed, lights strobing.
        if (c.staged) {
          c.pos.x += Math.sin(c.yaw) * c.speed * dt;
          c.pos.z += Math.cos(c.yaw) * c.speed * dt;
          c.group.position.set(c.pos.x, 0, c.pos.z);
          c.group.rotation.y = c.yaw;
          var sphase = Math.floor(SOL.G.time * 6 + i) % 2 === 0;
          c.group.userData.barR.material.color.setHex(sphase ? 0xff2e2e : 0x551111);
          c.group.userData.barB.material.color.setHex(sphase ? 0x112255 : 0x2e6bff);
          continue;
        }
        var px = target ? target.pos.x + Math.sin(target.yaw) * target.speed * 0.4 : tx;
        var pz = target ? target.pos.z + Math.cos(target.yaw) * target.speed * 0.4 : tz;
        var dx = px - c.pos.x;
        var dz = pz - c.pos.z;
        var dist = Math.sqrt(dx * dx + dz * dz) || 1;
        var wantYaw = Math.atan2(dx, dz);
        var dy = wantYaw - c.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        c.yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, dy));
        var cruise = Math.min(c.topSpeed, 20 + dist * 0.55);
        c.speed += Math.max(-22 * dt, Math.min(18 * dt, cruise - c.speed));
        c.pos.x += Math.sin(c.yaw) * c.speed * dt;
        c.pos.z += Math.cos(c.yaw) * c.speed * dt;
        city.resolveCollision(c.pos, 2.2);
        c.group.position.set(c.pos.x, 0, c.pos.z);
        c.group.rotation.y = c.yaw;
        // Light bar strobe.
        var phase = Math.floor(SOL.G.time * 6 + i) % 2 === 0;
        c.group.userData.barR.material.color.setHex(phase ? 0xff2e2e : 0x551111);
        c.group.userData.barB.material.color.setHex(phase ? 0x112255 : 0x2e6bff);
        // Ram the player's car.
        if (target && dist < 4.6) {
          target.speed = Math.max(0, target.speed - 14 * dt);
          if (Math.random() < dt * 2 && effects) effects.sparks(target.pos);
        }
      }
      // Foot cops sprint at an on-foot player; touching means a bust.
      var busted = false;
      for (var j = 0; j < cops.length; j++) {
        var cop = cops[j];
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
          cop.walkPhase += dt * 11;
          cop.group.userData.legL.rotation.x = Math.sin(cop.walkPhase) * 0.7;
          cop.group.userData.legR.rotation.x = -Math.sin(cop.walkPhase) * 0.7;
          if (cdist < 1.6) {
            cop.touchTime += dt;
            if (cop.touchTime > 1.4) busted = true;
          } else {
            cop.touchTime = Math.max(0, cop.touchTime - dt);
          }
        }
        cop.group.position.set(cop.pos.x, 0, cop.pos.z);
        cop.group.rotation.y = cop.yaw;
      }
      if (busted && SOL.main && SOL.main.onBusted) SOL.main.onBusted();
      return busted;
    }
  };
})();
