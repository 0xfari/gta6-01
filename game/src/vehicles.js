// SOLMARIS vehicles — six original car models, built from boxes, arcade physics.
window.SOL = window.SOL || {};
SOL.vehicles = (function () {
  var MODELS = [
    { name: 'Solmaris Sedan', topSpeed: 34, accel: 15, color: 0x3a6ea8 },
    { name: 'Marina Coupe', topSpeed: 40, accel: 17, color: 0xc23b2e },
    { name: 'Palma SUV', topSpeed: 31, accel: 13, color: 0x2e7d4f },
    { name: 'Dockside Pickup', topSpeed: 30, accel: 12, color: 0x8a6d3b },
    { name: 'City Taxi', topSpeed: 33, accel: 14, color: 0xe8b90c },
    { name: 'Vela Sport', topSpeed: 47, accel: 21, color: 0x7a2ec2 }
  ];

  function box(w, h, d, color, x, y, z) {
    var m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: color })
    );
    m.position.set(x, y, z);
    return m;
  }

  function wheel(x, z) {
    var w = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10),
      new THREE.MeshLambertMaterial({ color: 0x14161a })
    );
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z);
    return w;
  }

  // Builds one car. kind 0..5 picks the silhouette; color overrides the model color.
  function buildCarMesh(kind, color) {
    var g = new THREE.Group();
    var c = color;
    // Body by silhouette.
    if (kind === 1) { // coupe — low, long hood
      g.add(box(1.9, 0.55, 4.6, c, 0, 0.62, 0));
      g.add(box(1.7, 0.5, 2.2, 0x1c2733, 0, 1.05, -0.3));
      g.add(box(1.92, 0.22, 1.0, c, 0, 0.95, 1.6));
    } else if (kind === 2) { // SUV — tall
      g.add(box(2.0, 0.9, 4.6, c, 0, 0.85, 0));
      g.add(box(1.85, 0.8, 2.6, 0x1c2733, 0, 1.65, -0.2));
      g.add(box(2.02, 0.18, 4.0, 0x222222, 0, 1.32, 0));
    } else if (kind === 3) { // pickup — cab + open bed
      g.add(box(1.95, 0.6, 4.8, c, 0, 0.65, 0));
      g.add(box(1.8, 0.75, 1.7, 0x1c2733, 0, 1.3, -1.2));
      g.add(box(1.9, 0.5, 2.0, 0x3a2f22, 0, 1.05, 1.2));
    } else if (kind === 4) { // taxi — sedan + roof sign
      g.add(box(1.9, 0.6, 4.4, c, 0, 0.65, 0));
      g.add(box(1.7, 0.55, 2.3, 0x1c2733, 0, 1.15, -0.2));
      var sign = box(0.9, 0.28, 0.4, 0x111111, 0, 1.6, -0.2);
      g.add(sign);
      var signTop = box(0.94, 0.1, 0.44, 0xffd23e, 0, 1.78, -0.2);
      g.add(signTop);
    } else if (kind === 5) { // sport — wide, wing
      g.add(box(2.05, 0.5, 4.7, c, 0, 0.58, 0));
      g.add(box(1.75, 0.45, 2.0, 0x10151d, 0, 0.98, -0.4));
      g.add(box(2.0, 0.12, 0.5, 0x14161a, 0, 1.0, -2.2));
      g.add(box(1.9, 0.2, 0.9, c, 0, 0.85, 1.7));
    } else { // sedan
      g.add(box(1.9, 0.6, 4.4, c, 0, 0.65, 0));
      g.add(box(1.7, 0.55, 2.3, 0x1c2733, 0, 1.15, -0.2));
    }
    // Headlights + taillights.
    var hl = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
    var tl = new THREE.MeshBasicMaterial({ color: 0xff2e2e });
    var h1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), hl);
    h1.position.set(-0.62, 0.72, 2.21);
    g.add(h1);
    var h2 = h1.clone();
    h2.position.x = 0.62;
    g.add(h2);
    var t1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tl);
    t1.position.set(-0.62, 0.72, -2.21);
    g.add(t1);
    var t2 = t1.clone();
    t2.position.x = 0.62;
    g.add(t2);
    // Wheels.
    g.add(wheel(-0.95, 1.45));
    g.add(wheel(0.95, 1.45));
    g.add(wheel(-0.95, -1.45));
    g.add(wheel(0.95, -1.45));
    return g;
  }

  function makeCar(kind, colorHex, x, z, yaw) {
    var model = MODELS[kind % MODELS.length];
    var color = colorHex == null ? model.color : colorHex;
    var group = buildCarMesh(kind, color);
    group.position.set(x, 0, z);
    group.rotation.y = yaw || 0;
    var headlight = new THREE.SpotLight(0xfff2b0, 0, 34, 0.5, 0.5);
    headlight.position.set(0, 1, 2.2);
    group.add(headlight);
    return {
      group: group,
      headlight: headlight,
      kind: kind,
      model: model,
      name: model.name,
      color: color,
      pos: group.position,
      yaw: yaw || 0,
      speed: 0,
      steer: 0,
      driver: null, // 'player' | 'ai' | 'parked' | null
      stolen: false,
      brakeLight: false,
      topSpeed: model.topSpeed,
      accel: model.accel
    };
  }

  // Arcade driving: throttle -1..1, steer -1..1, handbrake bool.
  function driveCar(car, throttle, steer, handbrake, dt) {
    var top = car.topSpeed;
    if (throttle > 0) {
      car.speed += car.accel * throttle * dt;
    } else if (throttle < 0) {
      if (car.speed > 0.5) car.speed -= 26 * dt; // brake
      else car.speed -= 9 * dt; // reverse
    } else {
      car.speed -= Math.sign(car.speed) * 6 * dt;
      if (Math.abs(car.speed) < 0.4) car.speed = 0;
    }
    if (handbrake) {
      car.speed -= Math.sign(car.speed) * 22 * dt;
      if (Math.abs(car.speed) < 1) car.speed = 0;
    }
    car.speed = Math.max(-13, Math.min(top, car.speed));
    var spd = Math.abs(car.speed);
    var steerAuthority = 1.55 * Math.min(1, spd / 9 + 0.25) * (handbrake ? 1.7 : 1);
    car.yaw += steer * steerAuthority * (car.speed >= 0 ? 1 : -1) * dt * Math.min(1, spd / 6 + 0.15);
    var fx = Math.sin(car.yaw);
    var fz = Math.cos(car.yaw);
    car.pos.x += fx * car.speed * dt;
    car.pos.z += fz * car.speed * dt;
    car.group.rotation.y = car.yaw;
    car.group.position.set(car.pos.x, 0, car.pos.z);
    // Body roll + pitch for feel.
    car.group.rotation.z = -steer * Math.min(0.06, spd * 0.0016);
    car.group.rotation.x = Math.max(-0.03, Math.min(0.03, -throttle * 0.012 * (spd / top)));
    return car.speed;
  }

  return {
    MODELS: MODELS,
    makeCar: makeCar,
    buildCarMesh: buildCarMesh,
    driveCar: driveCar,
    randomModel: function () { return Math.floor(Math.random() * MODELS.length); },
    randomColor: function () {
      var palette = [0x3a6ea8, 0xc23b2e, 0x2e7d4f, 0xe8b90c, 0x7a2ec2, 0xd8d8d8, 0x222831, 0xd96a1e];
      return palette[Math.floor(Math.random() * palette.length)];
    }
  };
})();
