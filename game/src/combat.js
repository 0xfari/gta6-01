// SOLMARIS v4 — combat.js: hitscan shooting with aim assist; armed dock
// guards fight back. The player fires from the camera: a 9-degree cone
// snap-aims the ray onto the best enemy, otherwise the round flies straight
// and stops at the first building. Guards idle until the player comes close
// or gets shot at, then strafe into range and return fire with
// distance-based hit chance.
(function () {
  const C = {};
  const enemies = [];
  const tracers = [];
  let scene = null;
  let city = null;
  let effects = null;
  let police = null;
  let cooldown = 0;

  function buildGuard() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.9, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x3a2a1a })
    );
    body.position.y = 1.05;
    g.add(body);
    const vest = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.5, 0.36),
      new THREE.MeshLambertMaterial({ color: 0x1c1c1c })
    );
    vest.position.y = 1.1;
    g.add(vest);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.36, 0.36),
      new THREE.MeshLambertMaterial({ color: 0xc98a5a })
    );
    head.position.y = 1.7;
    g.add(head);
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.12, 0.38),
      new THREE.MeshLambertMaterial({ color: 0x8a1a1a })
    );
    band.position.y = 1.86;
    g.add(band);
    const legL = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.65, 0.2),
      new THREE.MeshLambertMaterial({ color: 0x2c2c34 })
    );
    legL.position.set(-0.14, 0.33, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.14;
    g.add(legR);
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x111111 })
    );
    gun.position.set(0.3, 1.25, 0.3);
    g.add(gun);
    // Health bar above the head.
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x330000, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    bg.position.y = 2.15;
    g.add(bg);
    const fg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
    );
    fg.position.y = 2.15;
    fg.position.z = 0.01;
    g.add(fg);
    g.userData.healthFg = fg;
    g.userData.legL = legL;
    g.userData.legR = legR;
    return g;
  }

  function drawTracer(from, to, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: color || 0xffd23e, transparent: true, opacity: 0.95 }));
    scene.add(line);
    tracers.push({ line: line, life: 0.09, span: 0.09 });
  }

  function bestInCone(origin, dir, maxDist, maxAngle) {
    let best = null;
    let bestScore = Infinity;
    for (const e of enemies) {
      if (e.health <= 0) continue;
      const to = new THREE.Vector3(e.pos.x - origin.x, 1.3 - origin.y, e.pos.z - origin.z);
      const dist = to.length();
      if (dist > maxDist) continue;
      to.normalize();
      const dot = to.dot(dir);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (angle > maxAngle) continue;
      const score = angle * 10 + dist * 0.01;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  C.enemies = enemies;

  C.init = function (sc, cityMod, effectsMod, policeMod) {
    scene = sc;
    city = cityMod;
    effects = effectsMod;
    police = policeMod;
    enemies.length = 0; // empty in place: the array is shared, never reassigned
  };

  C.spawnEnemy = function (x, z) {
    const g = buildGuard();
    g.position.set(x, 0, z);
    scene.add(g);
    const e = {
      group: g, pos: g.position, yaw: 0, health: 100, maxHealth: 100,
      phase: 0, shootIn: 1 + SOL.rand(), state: 'guard',
    };
    enemies.push(e);
    return e;
  };

  C.clearEnemies = function () {
    for (const e of enemies) scene.remove(e.group);
    enemies.length = 0;
  };

  // Player fires a hitscan shot from the camera. Returns what it hit.
  C.shoot = function (origin, dir, G) {
    if (cooldown > 0) return null;
    cooldown = 0.22;
    // Aim assist: snap the ray onto the best enemy inside a 9-degree cone.
    const target = bestInCone(origin, dir, 70, 0.16);
    const aimDir = dir.clone();
    let hitPoint = null;
    let hitEnemy = null;
    if (target) {
      const chest = new THREE.Vector3(target.pos.x, 1.3, target.pos.z);
      aimDir.copy(chest.clone().sub(origin).normalize());
      hitPoint = chest;
      hitEnemy = target;
    } else {
      hitPoint = origin.clone().add(aimDir.clone().multiplyScalar(60));
      // Wall hit: stop the tracer at the first building.
      const probe = origin.clone();
      const probePos = { x: 0, z: 0 };
      for (let s = 0; s < 60; s += 1.5) {
        probe.copy(origin).addScaledVector(aimDir, s);
        probePos.x = probe.x;
        probePos.z = probe.z;
        const bx = probePos.x;
        const bz = probePos.z;
        city.resolveCollision(probePos, 0.1);
        if (probePos.x !== bx || probePos.z !== bz) {
          hitPoint.copy(probe);
          break;
        }
      }
    }
    const muzzlePos = origin.clone().add(aimDir.clone().multiplyScalar(1.2));
    muzzlePos.y -= 0.15;
    effects.muzzle(muzzlePos, aimDir);
    drawTracer(muzzlePos, hitPoint);
    if (SOL.audio) SOL.audio.shot();
    if (hitEnemy) {
      hitEnemy.health -= 34;
      effects.hit(hitPoint);
      if (hitEnemy.health <= 0) {
        effects.explosion(hitPoint);
        scene.remove(hitEnemy.group);
        enemies.splice(enemies.indexOf(hitEnemy), 1);
        if (G) G.kills = (G.kills || 0) + 1;
        if (SOL.missions) SOL.missions.onEnemyKilled();
        if (SOL.hud) SOL.hud.toast('Guard down');
      } else {
        hitEnemy.state = 'alert';
      }
      return { type: 'enemy', enemy: hitEnemy };
    }
    // Missed everything: a puff of dust where the round lands.
    if (hitPoint.distanceTo(origin) < 58) effects.sparks(hitPoint);
    // Firing in public is a crime — unless it is mission work at the dock.
    const nearPed = SOL.pedestrians && SOL.pedestrians.nearestTo(origin.x, origin.z, 30);
    if (nearPed && police) police.addHeat(12, 'shots fired in public');
    return { type: 'miss', point: hitPoint };
  };

  C.update = function (dt, G) {
    cooldown = Math.max(0, cooldown - dt);
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / t.span);
      if (t.life <= 0) { scene.remove(t.line); tracers.splice(i, 1); }
    }
    const playerPos = G.player.pos;
    for (const e of enemies) {
      const dx = playerPos.x - e.pos.x;
      const dz = playerPos.z - e.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 1;
      e.yaw = Math.atan2(dx, dz);
      e.group.rotation.y = e.yaw;
      // Health bar faces the camera.
      const fg = e.group.userData.healthFg;
      fg.scale.x = Math.max(0.01, e.health / e.maxHealth);
      fg.position.x = -(1 - e.health / e.maxHealth) * 0.5;
      if (e.state === 'alert' && dist < 42) {
        // Strafe into range, then hold and shoot.
        if (dist > 14) {
          e.pos.x += Math.sin(e.yaw) * 5.4 * dt;
          e.pos.z += Math.cos(e.yaw) * 5.4 * dt;
          e.phase += dt * 9;
          e.group.userData.legL.rotation.x = Math.sin(e.phase) * 0.6;
          e.group.userData.legR.rotation.x = -Math.sin(e.phase) * 0.6;
        }
        e.shootIn -= dt;
        if (e.shootIn <= 0) {
          e.shootIn = 1.3 + SOL.rand() * 0.9;
          const from = e.pos.clone();
          from.y = 1.3;
          const to = playerPos.clone();
          to.y = 1.2;
          drawTracer(from, to, 0xff6a3d);
          // Hit chance falls with distance; point-blank hurts.
          const chance = dist < 12 ? 0.42 : dist < 24 ? 0.26 : 0.13;
          if (SOL.rand() < chance && G.mode === 'playing') {
            G.health = Math.max(0, G.health - (dist < 12 ? 11 : 7));
            if (SOL.hud) SOL.hud.damage();
            if (G.health <= 0 && SOL.main && SOL.main.onPlayerDown) SOL.main.onPlayerDown();
          }
          effects.muzzle(from, to.clone().sub(from).normalize());
        }
      } else if (e.state === 'guard') {
        // Idle patrol: slow wander near the spawn.
        e.phase += dt * 2;
        e.group.position.y = Math.sin(e.phase) * 0.03;
        if (dist < 26) e.state = 'alert';
      }
    }
  };

  SOL.combat = C;
})();
