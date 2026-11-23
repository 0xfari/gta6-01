// SOLMARIS v4 — vehicles.js: six original car models, built from boxes, with
// arcade driving physics. Each model is a spec row (silhouette, top speed,
// acceleration); the mesh builder turns the spec into a body, cabin, wheels
// and lights. Cars are plain state objects: { group, pos, yaw, speed, ... }.
(function () {
  const MODELS = [
    { name: 'Vela Sport', top: 46, accel: 21, color: 0x7a2ec2, kind: 'sport' },
    { name: 'Marina Coupe', top: 40, accel: 17, color: 0xc23b2e, kind: 'coupe' },
    { name: 'Sol Taxi', top: 33, accel: 14, color: 0xe8b90c, kind: 'taxi' },
    { name: 'Coast Sedan', top: 34, accel: 15, color: 0x3a6ea8, kind: 'sedan' },
    { name: 'Palma SUV', top: 31, accel: 13, color: 0x2e7d4f, kind: 'suv' },
    { name: 'Dock Van', top: 29, accel: 12, color: 0xd8d8d8, kind: 'van' },
  ];
  const GLASS = 0x1c2733;
  const PALETTE = [0x3a6ea8, 0xc23b2e, 0x2e7d4f, 0xe8b90c, 0x7a2ec2, 0xd8d8d8, 0x222831, 0xd96a1e];

  function box(w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: color })
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }

  function wheelAt(x, z) {
    const w = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10),
      new THREE.MeshLambertMaterial({ color: 0x14161a })
    );
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z);
    return w;
  }

  function lamps(g, frontZ, backZ) {
    const hl = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
    const tl = new THREE.MeshBasicMaterial({ color: 0xff2e2e });
    for (const sx of [-0.62, 0.62]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), hl);
      h.position.set(sx, 0.72, frontZ);
      g.add(h);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tl);
      t.position.set(sx, 0.72, backZ);
      g.add(t);
    }
  }

  // One silhouette per kind; dimensions differ so the six read apart at a glance.
  function buildMesh(spec, color) {
    const g = new THREE.Group();
    const c = color;
    if (spec.kind === 'sport') {
      g.add(box(2.05, 0.5, 4.7, c, 0, 0.58, 0));
      g.add(box(1.75, 0.45, 2.0, 0x10151d, 0, 0.98, -0.4));
      g.add(box(2.0, 0.12, 0.5, 0x14161a, 0, 1.0, -2.2));
      g.add(box(1.9, 0.2, 0.9, c, 0, 0.85, 1.7));
      lamps(g, 2.36, -2.36);
    } else if (spec.kind === 'coupe') {
      g.add(box(1.9, 0.55, 4.6, c, 0, 0.62, 0));
      g.add(box(1.7, 0.5, 2.2, GLASS, 0, 1.05, -0.3));
      g.add(box(1.92, 0.22, 1.0, c, 0, 0.95, 1.6));
      lamps(g, 2.31, -2.31);
    } else if (spec.kind === 'taxi') {
      g.add(box(1.9, 0.6, 4.4, c, 0, 0.65, 0));
      g.add(box(1.7, 0.55, 2.3, GLASS, 0, 1.15, -0.2));
      g.add(box(0.9, 0.28, 0.4, 0x111111, 0, 1.6, -0.2));
      g.add(box(0.94, 0.1, 0.44, 0xffd23e, 0, 1.78, -0.2));
      lamps(g, 2.21, -2.21);
    } else if (spec.kind === 'suv') {
      g.add(box(2.0, 0.9, 4.6, c, 0, 0.85, 0));
      g.add(box(1.85, 0.8, 2.6, GLASS, 0, 1.65, -0.2));
      g.add(box(2.02, 0.18, 4.0, 0x222222, 0, 1.32, 0));
      lamps(g, 2.31, -2.31);
    } else if (spec.kind === 'van') {
      g.add(box(2.0, 1.15, 5.0, c, 0, 0.95, 0));
      g.add(box(1.9, 0.6, 1.2, GLASS, 0, 1.7, 1.8));
      lamps(g, 2.51, -2.51);
    } else { // sedan
      g.add(box(1.9, 0.6, 4.4, c, 0, 0.65, 0));
      g.add(box(1.7, 0.55, 2.3, GLASS, 0, 1.15, -0.2));
      lamps(g, 2.21, -2.21);
    }
    g.add(wheelAt(-0.95, 1.45));
    g.add(wheelAt(0.95, 1.45));
    g.add(wheelAt(-0.95, -1.45));
    g.add(wheelAt(0.95, -1.45));
    return g;
  }

  function makeCar(kind, colorHex, x, z, yaw) {
    const spec = MODELS[kind % MODELS.length];
    const color = colorHex == null ? spec.color : colorHex;
    const group = buildMesh(spec, color);
    group.position.set(x, 0, z);
    group.rotation.y = yaw || 0;
    const beam = new THREE.SpotLight(0xfff2b0, 0, 34, 0.5, 0.5);
    beam.position.set(0, 1, 2.2);
    group.add(beam);
    return {
      group: group,
      beam: beam,
      kind: kind,
      spec: spec,
      name: spec.name,
      color: color,
      pos: group.position,
      yaw: yaw || 0,
      speed: 0,
      driver: null, // 'player' | 'ai' | 'parked' | null
      stolen: false,
      topSpeed: spec.top,
      accel: spec.accel,
    };
  }

  // Arcade driving: throttle -1..1, steer -1..1, handbrake bool.
  function driveCar(car, throttle, steer, handbrake, dt) {
    const top = car.topSpeed;
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
    const spd = Math.abs(car.speed);
    const authority = 1.55 * Math.min(1, spd / 9 + 0.25) * (handbrake ? 1.7 : 1);
    car.yaw += steer * authority * (car.speed >= 0 ? 1 : -1) * dt * Math.min(1, spd / 6 + 0.15);
    car.pos.x += Math.sin(car.yaw) * car.speed * dt;
    car.pos.z += Math.cos(car.yaw) * car.speed * dt;
    car.group.rotation.y = car.yaw;
    car.group.position.set(car.pos.x, 0, car.pos.z);
    // Body roll + pitch for feel.
    car.group.rotation.z = -steer * Math.min(0.06, spd * 0.0016);
    car.group.rotation.x = Math.max(-0.03, Math.min(0.03, -throttle * 0.012 * (spd / top)));
    return car.speed;
  }

  SOL.vehicles = {
    MODELS: MODELS,
    makeCar: makeCar,
    buildMesh: buildMesh,
    driveCar: driveCar,
    randomModel: function () { return Math.floor(SOL.rand() * MODELS.length); },
    randomColor: function () { return SOL.pick(PALETTE); },
  };
})();
