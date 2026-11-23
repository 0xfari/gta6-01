// SOLMARIS player — Lena Cruz on foot: walk, run, and steal cars.
window.SOL = window.SOL || {};
SOL.player = (function () {
  var scene = null;
  var city = null;
  var vehicles = null;
  var mesh = null;
  var legL = null;
  var legR = null;
  var armR = null;

  var pos = new THREE.Vector3(0, 0, 30);
  var yaw = Math.PI; // facing north (-Z) at spawn
  var camYaw = Math.PI;
  var walkPhase = 0;
  var speed = 0;
  var onFoot = true;
  var car = null;
  var interactCooldown = 0;

  function buildMesh() {
    var g = new THREE.Group();
    var jacket = new THREE.MeshLambertMaterial({ color: 0xd8402e });
    var jeans = new THREE.MeshLambertMaterial({ color: 0x2c3a5a });
    var skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
    var hair = new THREE.MeshLambertMaterial({ color: 0x1a1210 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), jacket);
    body.position.y = 1.08;
    g.add(body);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skin);
    head.position.y = 1.72;
    g.add(head);
    var hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.42), hair);
    hairTop.position.y = 1.95;
    g.add(hairTop);
    var hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.12), hair);
    hairBack.position.set(0, 1.72, -0.2);
    g.add(hairBack);
    legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.22), jeans);
    legL.position.set(-0.16, 0.34, 0);
    g.add(legL);
    legR = legL.clone();
    legR.position.x = 0.16;
    g.add(legR);
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.18), jacket);
    armL.position.set(-0.42, 1.1, 0);
    g.add(armL);
    armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.18), jacket);
    armR.position.set(0.42, 1.1, 0);
    g.add(armR);
    // A handgun in the right hand, visible when aiming.
    var gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.42), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.42, 0.78, 0.25);
    g.add(gun);
    return g;
  }

  function nearestStealableCar(maxDist) {
    var best = null;
    var bestD = maxDist * maxDist;
    var all = [];
    if (SOL.traffic) all = all.concat(SOL.traffic.cars);
    if (SOL.police) all = all.concat(SOL.police.policeCars);
    if (SOL.main && SOL.main.parkedCars) all = all.concat(SOL.main.parkedCars);
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if (c.driver === 'player') continue;
      var dx = c.pos.x - pos.x;
      var dz = c.pos.z - pos.z;
      var d2 = dx * dx + dz * dz;
      if (d2 < bestD) { bestD = d2; best = c; }
    }
    return best;
  }

  return {
    pos: pos,
    yaw: 0,
    camYaw: Math.PI,
    onFoot: true,
    car: null,
    speed: 0,
    mesh: null,
    init: function (sc, cityMod, vehiclesMod) {
      scene = sc;
      city = cityMod;
      vehicles = vehiclesMod;
      mesh = buildMesh();
      mesh.position.copy(pos);
      scene.add(mesh);
      this.mesh = mesh;
    },
    spawn: function (x, z, facingYaw) {
      pos.set(x, 0, z);
      yaw = facingYaw == null ? Math.PI : facingYaw;
      camYaw = yaw;
      this.yaw = yaw;
      this.camYaw = camYaw;
      mesh.position.copy(pos);
      mesh.rotation.y = yaw;
    },
    getYaw: function () { return yaw; },
    getCamYaw: function () { return camYaw; },
    setCamYaw: function (y) { camYaw = y; this.camYaw = y; },
    nearestStealableCar: nearestStealableCar,
    enterCar: function (targetCar) {
      if (!targetCar || car) return false;
      car = targetCar;
      this.car = car;
      onFoot = false;
      this.onFoot = false;
      car.driver = 'player';
      mesh.visible = false;
      yaw = car.yaw;
      camYaw = yaw;
      this.yaw = yaw;
      this.camYaw = camYaw;
      // Stealing a car the law can see is a crime.
      if (!targetCar.stolen) {
        targetCar.stolen = true;
        var witness = SOL.pedestrians && SOL.pedestrians.nearestTo(pos.x, pos.z, 26);
        var copNear = SOL.police && SOL.police.nearestPoliceDist(pos) < 34;
        if (witness || copNear) SOL.police.addHeat(25, 'car stolen in plain sight');
        else if (SOL.hud) SOL.hud.toast('Clean getaway — nobody saw a thing');
      }
      if (SOL.hud) SOL.hud.toast('Driving the ' + targetCar.name + ' — E to step out');
      if (SOL.audio) SOL.audio.blip();
      return true;
    },
    exitCar: function () {
      if (!car) return false;
      var outX = car.pos.x + Math.cos(car.yaw) * 2.6;
      var outZ = car.pos.z - Math.sin(car.yaw) * 2.6;
      pos.set(outX, 0, outZ);
      city.resolveCollision(pos, 0.6);
      yaw = car.yaw;
      camYaw = yaw;
      this.yaw = yaw;
      this.camYaw = camYaw;
      car.driver = null;
      car.speed = 0;
      car = null;
      this.car = null;
      onFoot = true;
      this.onFoot = true;
      mesh.visible = true;
      mesh.position.copy(pos);
      mesh.rotation.y = yaw;
      return true;
    },
    update: function (dt, G) {
      interactCooldown = Math.max(0, interactCooldown - dt);
      var input = SOL.controls;
      var look = input.takeLook();
      camYaw -= look.dx * 0.0032;
      this.camYaw = camYaw;
      if (car) {
        var ax = input.axes();
        var throttle = ax.y;
        var steer = -ax.x;
        vehicles.driveCar(car, throttle, steer, input.handbrake(), dt);
        city.resolveCollision(car.pos, 2.1);
        city.clampToCity(car.pos);
        pos.copy(car.pos);
        yaw = car.yaw;
        this.yaw = yaw;
        speed = Math.abs(car.speed);
        this.speed = speed;
        // Ramming a pedestrian at speed is a crime; a gentle nudge is not.
        if (speed > 8 && SOL.pedestrians) {
          var p = SOL.pedestrians.nearestTo(car.pos.x, car.pos.z, 2.6);
          if (p) {
            SOL.police.addHeat(30, 'pedestrian hit');
            if (SOL.effects) SOL.effects.burst(p.pos, 0xc22418, 8, 4, 0.5, 9);
            if (SOL.audio) SOL.audio.crash();
            // The pedestrian scrambles away.
            p.tx = p.pos.x + (Math.random() * 40 - 20);
            p.tz = p.pos.z + (Math.random() * 40 - 20);
            p.fleeing = true;
            p.panic = 3;
          }
        }
        // Collision with traffic cars: push apart, lose speed.
        var all = SOL.traffic ? SOL.traffic.allCars() : [];
        for (var i = 0; i < all.length; i++) {
          var o = all[i];
          if (o === car) continue;
          var dx = car.pos.x - o.pos.x;
          var dz = car.pos.z - o.pos.z;
          var d2 = dx * dx + dz * dz;
          if (d2 < 12.5 && d2 > 0.01) {
            var d = Math.sqrt(d2);
            var push = (3.55 - d) * 0.5;
            car.pos.x += (dx / d) * push;
            car.pos.z += (dz / d) * push;
            car.speed *= 0.82;
            if (Math.abs(car.speed) > 6 && SOL.effects && Math.random() < dt * 8) {
              SOL.effects.sparks(car.pos);
              if (SOL.audio) SOL.audio.crash();
            }
          }
        }
        if (input.handbrake() && speed > 10 && SOL.effects && Math.random() < dt * 20) {
          SOL.effects.skid(car.pos);
        }
        if (input.interactPressed() && interactCooldown <= 0) {
          interactCooldown = 0.35;
          this.exitCar();
        }
        return;
      }
      // On foot.
      var axes = input.axes();
      var run = input.running();
      var moveSpeed = run ? 9.5 : 5.2;
      var fx = Math.sin(camYaw);
      var fz = Math.cos(camYaw);
      var rx = Math.cos(camYaw);
      var rz = -Math.sin(camYaw);
      var mx = fx * axes.y + rx * axes.x;
      var mz = fz * axes.y + rz * axes.x;
      var ml = Math.sqrt(mx * mx + mz * mz);
      if (ml > 0.01) {
        mx /= ml;
        mz /= ml;
        pos.x += mx * moveSpeed * dt;
        pos.z += mz * moveSpeed * dt;
        var targetYaw = Math.atan2(mx, mz);
        var dy = targetYaw - yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        yaw += dy * Math.min(1, dt * 12);
        this.yaw = yaw;
        speed = moveSpeed;
        this.speed = speed;
        walkPhase += dt * moveSpeed * 1.9;
        var swing = Math.sin(walkPhase) * 0.55;
        legL.rotation.x = swing;
        legR.rotation.x = -swing;
        armR.rotation.x = -swing * 0.7;
        mesh.position.y = Math.abs(Math.sin(walkPhase)) * 0.05;
      } else {
        speed = 0;
        this.speed = 0;
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
      if (input.interactPressed() && interactCooldown <= 0) {
        interactCooldown = 0.35;
        var near = nearestStealableCar(4.2);
        if (near) this.enterCar(near);
      }
      // Shooting on foot.
      if (input.takeClick() && SOL.combat && G.camera) {
        var origin = G.camera.position.clone();
        var dir = new THREE.Vector3();
        G.camera.getWorldDirection(dir);
        SOL.combat.shoot(origin, dir, G);
      }
    }
  };
})();
