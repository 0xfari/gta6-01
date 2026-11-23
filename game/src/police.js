// SOLMARIS v4 — police.js: a 5-star wanted system. Heat runs 0..125 and
// wanted = ceil(heat / 25), capped at 5. Crimes add heat; lying low with no
// cruiser nearby lets it cool. Pursuit scales with stars: patrol cars that
// chase the player's predicted position and ram, plus foot cops who sprint
// at an on-foot player — touched for 1.4 s straight means BUSTED.
(function () {
  const P = {};
  const patrolCars = [];
  const cops = [];
  const LABELS = [
    '', 'WANTED — patrol on your tail', 'WANTED — cruisers converging',
    'WANTED — roadblocks ahead', 'WANTED — the whole precinct is out',
    'WANTED — maximum heat. Good luck, Lena.',
  ];
  let scene = null;
  let city = null;
  let vehicles = null;
  let effects = null;
  let heat = 0;
  let wanted = 0;
  let quietFor = 0;
  let spawnIn = 0;

  function cruiserMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.95, 0.62, 4.5),
      new THREE.MeshLambertMaterial({ color: 0x14181f })
    );
    body.position.y = 0.66;
    g.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.55, 2.3),
      new THREE.MeshLambertMaterial({ color: 0xe8e8e8 })
    );
    cabin.position.set(0, 1.18, -0.2);
    g.add(cabin);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.97, 0.2, 4.2),
      new THREE.MeshLambertMaterial({ color: 0xe8e8e8 })
    );
    stripe.position.y = 0.72;
    g.add(stripe);
    const barR = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2e2e })
    );
    barR.position.set(-0.4, 1.55, -0.2);
    g.add(barR);
    const barB = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x2e6bff })
    );
    barB.position.set(0.4, 1.55, -0.2);
    g.add(barB);
    g.userData.barR = barR;
    g.userData.barB = barB;
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
    for (const p of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(p[0], 0.42, p[1]);
      g.add(w);
    }
    return g;
  }

  function copMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.9, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x1a2a4a })
    );
    body.position.y = 1.05;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.36, 0.36),
      new THREE.MeshLambertMaterial({ color: 0xe8b88a })
    );
    head.position.y = 1.7;
    g.add(head);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.14, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x101826 })
    );
    cap.position.y = 1.92;
    g.add(cap);
    const legL = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.65, 0.2),
      new THREE.MeshLambertMaterial({ color: 0x101826 })
    );
    legL.position.set(-0.14, 0.33, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.14;
    g.add(legR);
    g.userData.legL = legL;
    g.userData.legR = legR;
    return g;
  }

  function spawnCruiser(nearPos) {
    const p = city.roadPointAhead(nearPos.x, nearPos.z, 55 + SOL.rand() * 30);
    const car = vehicles.makeCar(0, 0x14181f, p.x, p.z, 0);
    scene.remove(car.group);
    const mesh = cruiserMesh();
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
    car.group = mesh;
    car.driver = 'police';
    car.cruise = 30 + wanted * 3.5;
    car.topSpeed = 30 + wanted * 3.5;
    car.accel = 20;
    car.speed = 12;
    patrolCars.push(car);
    return car;
  }

  function spawnCop(nearPos) {
    let s = city.randomSidewalkPoint();
    const dx = nearPos.x - s.x;
    const dz = nearPos.z - s.z;
    if (dx * dx + dz * dz > 60 * 60) s = { x: nearPos.x + 14, z: nearPos.z + 8 };
    const g = copMesh();
    g.position.set(s.x, 0, s.z);
    scene.add(g);
    cops.push({ group: g, pos: g.position, yaw: 0, speed: 6.4, phase: 0, touch: 0 });
  }

  function clearPursuit() {
    for (const c of patrolCars) scene.remove(c.group);
    for (const k of cops) scene.remove(k.group);
    patrolCars.length = 0;
    cops.length = 0;
  }

  function strobe(car, i) {
    const on = Math.floor(SOL.G.time * 6 + i) % 2 === 0;
    car.group.userData.barR.material.color.setHex(on ? 0xff2e2e : 0x551111);
    car.group.userData.barB.material.color.setHex(on ? 0x112255 : 0x2e6bff);
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
    const w = Math.min(5, Math.ceil(heat / 25));
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
    const car = vehicles.makeCar(0, 0x14181f, x, z, yaw || 0);
    scene.remove(car.group);
    const mesh = cruiserMesh();
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw || 0;
    scene.add(mesh);
    car.group = mesh;
    car.driver = 'police';
    car.staged = true;
    car.cruise = 26;
    car.topSpeed = 26;
    car.accel = 20;
    car.speed = 26;
    car.yaw = yaw || 0;
    patrolCars.push(car);
    return car;
  };

  P.nearestPoliceDist = function (pos) {
    let best = Infinity;
    for (const c of patrolCars) {
      best = Math.min(best, Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z));
    }
    for (const k of cops) {
      best = Math.min(best, Math.hypot(k.pos.x - pos.x, k.pos.z - pos.z));
    }
    return best;
  };

  P.update = function (dt, player, playerCar) {
    quietFor += dt;
    // Heat cools when the player lies low and no cruiser is near.
    if (quietFor > 6 && wanted > 0) {
      const near = P.nearestPoliceDist(player.pos);
      if (near > 45) {
        heat = Math.max(0, heat - 3.2 * dt);
        P.heat = heat;
        const w = Math.ceil(heat / 25);
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
      const wantCars = Math.min(1 + Math.floor(wanted / 2), 4);
      const wantCops = wanted >= 2 ? Math.min(wanted - 1, 3) : 0;
      if (patrolCars.length < wantCars) spawnCruiser(player.pos);
      if (cops.length < wantCops) spawnCop(player.pos);
      if (patrolCars.length > wantCars + 1) {
        const far = patrolCars.pop();
        scene.remove(far.group);
      }
    }
    const tx = player.pos.x;
    const tz = player.pos.z;
    // Pursuit cars chase the player's predicted position and ram to slow them.
    for (let i = 0; i < patrolCars.length; i++) {
      const c = patrolCars[i];
      if (c.staged) {
        c.pos.x += Math.sin(c.yaw) * c.speed * dt;
        c.pos.z += Math.cos(c.yaw) * c.speed * dt;
        c.group.position.set(c.pos.x, 0, c.pos.z);
        c.group.rotation.y = c.yaw;
        strobe(c, i);
        continue;
      }
      const px = playerCar ? playerCar.pos.x + Math.sin(playerCar.yaw) * playerCar.speed * 0.4 : tx;
      const pz = playerCar ? playerCar.pos.z + Math.cos(playerCar.yaw) * playerCar.speed * 0.4 : tz;
      const dx = px - c.pos.x;
      const dz = pz - c.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 1;
      const wantYaw = Math.atan2(dx, dz);
      let dy = wantYaw - c.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      c.yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, dy));
      const cruise = Math.min(c.topSpeed, 20 + dist * 0.55);
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
    let busted = false;
    for (const cop of cops) {
      const cdx = tx - cop.pos.x;
      const cdz = tz - cop.pos.z;
      const cdist = Math.sqrt(cdx * cdx + cdz * cdz) || 1;
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
