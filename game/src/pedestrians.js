// SOLMARIS v4 — pedestrians.js: 22 walkers on the sidewalks. Each walker
// picks a sidewalk destination, strolls to it with a leg-swing walk cycle,
// then picks another. Gunfire or a speeding car nearby sends them running
// away from the threat for a few seconds.
(function () {
  const P = {};
  const peds = [];
  const SHIRTS = [0xe86a5a, 0x5a8ae8, 0x7ac25a, 0xe8c95a, 0xb05ae8, 0x5ad8d8, 0xe85aa0, 0xd8d8d8];
  const PANTS = [0x2c3a4a, 0x4a2c2c, 0x2c4a34, 0x3a3a3a, 0x5a4a6a];
  const SKINS = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0];
  let scene = null;
  let city = null;

  function buildWalker() {
    const g = new THREE.Group();
    const shirt = SOL.pick(SHIRTS);
    const pants = SOL.pick(PANTS);
    const skin = SOL.pick(SKINS);
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.3, 0.85, 8),
      new THREE.MeshLambertMaterial({ color: shirt })
    );
    torso.position.y = 1.05;
    g.add(torso);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshLambertMaterial({ color: skin })
    );
    head.position.y = 1.72;
    g.add(head);
    const legL = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.65, 0.2),
      new THREE.MeshLambertMaterial({ color: pants })
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

  function retarget(p) {
    const s = city.randomSidewalkPoint();
    p.tx = s.x;
    p.tz = s.z;
  }

  P.peds = peds;

  P.init = function (sc, cityMod) {
    scene = sc;
    city = cityMod;
    peds.length = 0; // empty in place: the array is shared, never reassigned
    for (let i = 0; i < 22; i++) {
      const s = city.randomSidewalkPoint();
      const g = buildWalker();
      g.position.set(s.x, 0, s.z);
      scene.add(g);
      const p = {
        group: g, pos: g.position, yaw: SOL.rand() * Math.PI * 2,
        tx: s.x, tz: s.z, speed: 1.1 + SOL.rand() * 0.9,
        phase: SOL.rand() * 6, fleeing: false, panic: 0,
      };
      retarget(p);
      peds.push(p);
    }
  };

  P.update = function (dt, threat) {
    for (const p of peds) {
      const dx = p.tx - p.pos.x;
      const dz = p.tz - p.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      // Flee: a threat (gunfire / speeding car) nearby sends them running away.
      if (threat) {
        const tdx = p.pos.x - threat.x;
        const tdz = p.pos.z - threat.z;
        const td = Math.sqrt(tdx * tdx + tdz * tdz);
        if (td < threat.radius) {
          p.fleeing = true;
          p.panic = 2.5;
          p.tx = p.pos.x + (tdx / (td || 1)) * 26;
          p.tz = p.pos.z + (tdz / (td || 1)) * 26;
        }
      }
      if (p.panic > 0) p.panic -= dt;
      if (p.panic <= 0) p.fleeing = false;
      if (dist < 1.2) { retarget(p); continue; }
      const speed = p.fleeing ? 5.2 : p.speed;
      p.yaw = Math.atan2(dx, dz);
      p.pos.x += Math.sin(p.yaw) * speed * dt;
      p.pos.z += Math.cos(p.yaw) * speed * dt;
      p.group.rotation.y = p.yaw;
      p.phase += dt * speed * 3.4;
      const swing = Math.sin(p.phase) * 0.5;
      p.group.userData.legL.rotation.x = swing;
      p.group.userData.legR.rotation.x = -swing;
      p.group.position.y = Math.abs(Math.sin(p.phase)) * 0.06;
    }
  };

  // Nearest pedestrian to a point (for hit checks / crime witnesses).
  P.nearestTo = function (x, z, maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const p of peds) {
      const dx = p.pos.x - x;
      const dz = p.pos.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD) { bestD = d2; best = p; }
    }
    return best;
  };

  P.fleeingCount = function () {
    let n = 0;
    for (const p of peds) if (p.fleeing) n++;
    return n;
  };

  SOL.pedestrians = P;
})();
