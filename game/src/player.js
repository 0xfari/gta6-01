// SOLMARIS v4 — player.js: Lena Cruz on foot and behind the wheel. On foot
// she walks/runs camera-relative with a leg-swing cycle and a visible
// handgun; E near a car steals it (a crime if anyone sees), E in a car
// steps out. Driving uses the arcade physics in vehicles.js, with building
// collision, traffic shoving, skid puffs on handbrake turns, and a crime
// for hitting a pedestrian at speed.
(function () {
  const PL = {};
  let scene = null;
  let city = null;
  let vehicles = null;
  let mesh = null;
  let legL = null;
  let legR = null;
  let armR = null;

  const pos = new THREE.Vector3(0, 0, 24);
  let yaw = Math.PI; // facing north (-Z) at spawn
  let camYaw = Math.PI;
  let walkPhase = 0;
  let speed = 0;
  let onFoot = true;
  let car = null;
  let interactIn = 0;

  function buildLena() {
    const g = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0xd8402e });
    const jeans = new THREE.MeshLambertMaterial({ color: 0x2c3a5a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
    const hair = new THREE.MeshLambertMaterial({ color: 0x1a1210 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), jacket);
    body.position.y = 1.08;
    g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skin);
    head.position.y = 1.72;
    g.add(head);
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.42), hair);
    hairTop.position.y = 1.95;
    g.add(hairTop);
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.12), hair);
    hairBack.position.set(0, 1.72, -0.2);
    g.add(hairBack);
    legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.22), jeans);
    legL.position.set(-0.16, 0.34, 0);
    g.add(legL);
    legR = legL.clone();
    legR.position.x = 0.16;
    g.add(legR);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.18), jacket);
    armL.position.set(-0.42, 1.1, 0);
    g.add(armL);
    armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.18), jacket);
    armR.position.set(0.42, 1.1, 0);
    g.add(armR);
    // A handgun in the right hand, visible when aiming.
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.42), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.42, 0.78, 0.25);
    g.add(gun);
    return g;
  }

  function nearestStealable(maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    const all = [];
    if (SOL.traffic) all.push.apply(all, SOL.traffic.cars);
    if (SOL.police) all.push.apply(all, SOL.police.patrolCars);
    if (SOL.main && SOL.main.parkedCars) all.push.apply(all, SOL.main.parkedCars);
    for (const c of all) {
      if (c.driver === 'player') continue;
      const dx = c.pos.x - pos.x;
      const dz = c.pos.z - pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD) { bestD = d2; best = c; }
    }
    return best;
  }

  PL.pos = pos;
  PL.yaw = 0;
  PL.camYaw = Math.PI;
  PL.onFoot = true;
  PL.car = null;
  PL.speed = 0;
  PL.mesh = null;

  PL.init = function (sc, cityMod, vehiclesMod) {
    scene = sc;
    city = cityMod;
    vehicles = vehiclesMod;
    mesh = buildLena();
    mesh.position.copy(pos);
    scene.add(mesh);
    PL.mesh = mesh;
  };

  PL.spawn = function (x, z, facingYaw) {
    pos.set(x, 0, z);
    yaw = facingYaw == null ? Math.PI : facingYaw;
    camYaw = yaw;
    PL.yaw = yaw;
    PL.camYaw = camYaw;
    mesh.position.copy(pos);
    mesh.rotation.y = yaw;
  };

  PL.getYaw = function () { return yaw; };
  PL.getCamYaw = function () { return camYaw; };
  PL.setCamYaw = function (y) { camYaw = y; PL.camYaw = y; };
  PL.nearestStealableCar = nearestStealable;

  PL.enterCar = function (targetCar) {
    if (!targetCar || car) return false;
    car = targetCar;
    PL.car = car;
    onFoot = false;
    PL.onFoot = false;
    car.driver = 'player';
    mesh.visible = false;
    yaw = car.yaw;
    camYaw = yaw;
    PL.yaw = yaw;
    PL.camYaw = camYaw;
    // Stealing a car the law can see is a crime.
    if (!targetCar.stolen) {
      targetCar.stolen = true;
      const witness = SOL.pedestrians && SOL.pedestrians.nearestTo(pos.x, pos.z, 26);
      const copNear = SOL.police && SOL.police.nearestPoliceDist(pos) < 34;
      if (witness || copNear) SOL.police.addHeat(25, 'car stolen in plain sight');
      else if (SOL.hud) SOL.hud.toast('Clean getaway — nobody saw a thing');
    }
    if (SOL.hud) SOL.hud.toast('Driving the ' + targetCar.name + ' — E to step out');
    if (SOL.audio) SOL.audio.pickup();
    return true;
  };

  PL.exitCar = function () {
    if (!car) return false;
    const outX = car.pos.x + Math.cos(car.yaw) * 2.6;
    const outZ = car.pos.z - Math.sin(car.yaw) * 2.6;
    pos.set(outX, 0, outZ);
    city.resolveCollision(pos, 0.6);
    yaw = car.yaw;
    camYaw = yaw;
    PL.yaw = yaw;
    PL.camYaw = camYaw;
    car.driver = null;
    car.speed = 0;
    car = null;
    PL.car = null;
    onFoot = true;
    PL.onFoot = true;
    mesh.visible = true;
    mesh.position.copy(pos);
    mesh.rotation.y = yaw;
    return true;
  };

  PL.update = function (dt, G) {
    interactIn = Math.max(0, interactIn - dt);
    const input = SOL.controls;
    const look = input.takeLook();
    camYaw -= look.dx * 0.0032;
    PL.camYaw = camYaw;
    if (car) {
      const ax = input.axes();
      vehicles.driveCar(car, ax.y, -ax.x, input.braking(), dt);
      city.resolveCollision(car.pos, 2.1);
      city.clampToCity(car.pos);
      pos.copy(car.pos);
      yaw = car.yaw;
      PL.yaw = yaw;
      speed = Math.abs(car.speed);
      PL.speed = speed;
      // Ramming a pedestrian at speed is a crime; a gentle nudge is not.
      if (speed > 8 && SOL.pedestrians) {
        const p = SOL.pedestrians.nearestTo(car.pos.x, car.pos.z, 2.6);
        if (p) {
          SOL.police.addHeat(30, 'pedestrian hit');
          if (SOL.effects) SOL.effects.burst(p.pos, 0xc22418, 8, 4, 0.5, 9);
          // The pedestrian scrambles away.
          p.tx = p.pos.x + SOL.randRange(-20, 20);
          p.tz = p.pos.z + SOL.randRange(-20, 20);
          p.fleeing = true;
          p.panic = 3;
        }
      }
      // Collision with traffic cars: push apart, lose speed.
      const all = SOL.traffic ? SOL.traffic.allCars() : [];
      for (const o of all) {
        if (o === car) continue;
        const dx = car.pos.x - o.pos.x;
        const dz = car.pos.z - o.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 12.5 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (3.55 - d) * 0.5;
          car.pos.x += (dx / d) * push;
          car.pos.z += (dz / d) * push;
          car.speed *= 0.82;
          if (Math.abs(car.speed) > 6 && SOL.effects && SOL.rand() < dt * 8) {
            SOL.effects.sparks(car.pos);
          }
        }
      }
      if (input.braking() && speed > 10 && SOL.effects && SOL.rand() < dt * 20) {
        SOL.effects.skid(car.pos);
      }
      if (input.interact() && interactIn <= 0) {
        interactIn = 0.35;
        PL.exitCar();
      }
      return;
    }
    // On foot.
    const axes = input.axes();
    const run = input.sprinting();
    const moveSpeed = run ? 9.5 : 5.2;
    const fx = Math.sin(camYaw);
    const fz = Math.cos(camYaw);
    const rx = Math.cos(camYaw);
    const rz = -Math.sin(camYaw);
    let mx = fx * axes.y + rx * axes.x;
    let mz = fz * axes.y + rz * axes.x;
    const ml = Math.sqrt(mx * mx + mz * mz);
    if (ml > 0.01) {
      mx /= ml;
      mz /= ml;
      pos.x += mx * moveSpeed * dt;
      pos.z += mz * moveSpeed * dt;
      const targetYaw = Math.atan2(mx, mz);
      let dy = targetYaw - yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      yaw += dy * Math.min(1, dt * 12);
      PL.yaw = yaw;
      speed = moveSpeed;
      PL.speed = speed;
      walkPhase += dt * moveSpeed * 1.9;
      const swing = Math.sin(walkPhase) * 0.55;
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armR.rotation.x = -swing * 0.7;
      mesh.position.y = Math.abs(Math.sin(walkPhase)) * 0.05;
    } else {
      speed = 0;
      PL.speed = 0;
      legL.rotation.x *= 0.8;
      legR.rotation.x *= 0.8;
      armR.rotation.x *= 0.8;
      mesh.position.y = 0;
    }
    city.resolveCollision(pos, 0.6);
    city.clampToCity(pos);
    mesh.position.set(pos.x, mesh.position.y, pos.z);
    mesh.rotation.y = yaw;
    // Enter a nearby car with E.
    if (input.interact() && interactIn <= 0) {
      interactIn = 0.35;
      const near = nearestStealable(4.2);
      if (near) PL.enterCar(near);
    }
    // Shooting on foot.
    if (input.takeClick() && SOL.combat && G.camera) {
      const origin = G.camera.position.clone();
      const dir = new THREE.Vector3();
      G.camera.getWorldDirection(dir);
      SOL.combat.shoot(origin, dir, G);
    }
  };

  SOL.player = PL;
})();
