// SOLMARIS v6 — combat.js: hitscan shooting with aim assist; armed dock
// guards fight back. The player fires from the camera: a 9-degree cone
// snap-aims the ray onto the best enemy, otherwise the round flies straight
// and stops at the first building. Guards idle until the player comes close
// or gets shot at, then strafe into range and return fire with
// distance-based hit chance.
(function () {
  var C = {};
  var enemies = [];
  var tracers = [];
  var scene = null;
  var city = null;
  var effects = null;
  var police = null;
  var cooldown = 0;

  function buildGuard() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.9, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x3a2a1a })
    );
    body.position.y = 1.05;
    g.add(body);
    var vest = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.5, 0.36),
      new THREE.MeshLambertMaterial({ color: 0x1c1c1c })
    );
    vest.position.y = 1.1;
    g.add(vest);
    var head = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.36, 0.36),
      new THREE.MeshLambertMaterial({ color: 0xc98a5a })
    );
    head.position.y = 1.7;
    g.add(head);
    var band = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.12, 0.38),
      new THREE.MeshLambertMaterial({ color: 0x8a1a1a })
    );
    band.position.y = 1.86;
    g.add(band);
    var legL = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.65, 0.2),
      new THREE.MeshLambertMaterial({ color: 0x2c2c34 })
    );
    legL.position.set(-0.14, 0.33, 0);
    g.add(legL);
    var legR = legL.clone();
    legR.position.x = 0.14;
    g.add(legR);
    var gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x111111 })
    );
    gun.position.set(0.3, 1.25, 0.3);
    g.add(gun);
    // Health bar above the head.
    var bg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x330000, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    bg.position.y = 2.15;
    g.add(bg);
    var fg = new THREE.Mesh(
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
    var geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: color || 0xffd23e,
      transparent: true,
      opacity: 0.95,
    }));
    scene.add(line);
    tracers.push({ line: line, life: 0.09, span: 0.09 });
  }

  // Best living enemy inside the aim cone, scored by angle then distance.
  function pickTarget(origin, dir, maxDist, maxAngle) {
    var best = null;
    var bestScore = Infinity;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.health <= 0) continue;
      var to = new THREE.Vector3(e.pos.x - origin.x, 1.3 - origin.y, e.pos.z - origin.z);
      var dist = to.length();
      if (dist > maxDist) continue;
      to.normalize();
      var dot = to.dot(dir);
      var angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (angle > maxAngle) continue;
      var score = angle * 10 + dist * 0.01;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  // Walk the ray forward until it hits a building collider.
  function wallPoint(origin, aimDir) {
    var probe = origin.clone();
    var probePos = { x: 0, z: 0 };
    for (var s = 0; s < 60; s += 1.5) {
      probe.copy(origin).addScaledVector(aimDir, s);
      probePos.x = probe.x;
      probePos.z = probe.z;
      var bx = probePos.x;
      var bz = probePos.z;
      city.resolveCollision(probePos, 0.1);
      if (probePos.x !== bx || probePos.z !== bz) return probe;
    }
    return origin.clone().add(aimDir.clone().multiplyScalar(60));
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
    var g = buildGuard();
    g.position.set(x, 0, z);
    scene.add(g);
    var e = {
      group: g,
      pos: g.position,
      yaw: 0,
      health: 100,
      maxHealth: 100,
      phase: 0,
      shootIn: 1 + SOL.rand(),
      state: 'guard',
    };
    enemies.push(e);
    return e;
  };

  C.clearEnemies = function () {
    for (var i = 0; i < enemies.length; i++) scene.remove(enemies[i].group);
    enemies.length = 0;
  };

  // Player fires a hitscan shot from the camera. Returns what it hit.
  C.shoot = function (origin, dir, G) {
    if (cooldown > 0) return null;
    cooldown = 0.22;
    // Aim assist: snap the ray onto the best enemy inside a 9-degree cone.
    var target = pickTarget(origin, dir, 70, 0.16);
    var aimDir = dir.clone();
    var hitPoint = null;
    var hitEnemy = null;
    if (target) {
      var chest = new THREE.Vector3(target.pos.x, 1.3, target.pos.z);
      aimDir.copy(chest.clone().sub(origin).normalize());
      hitPoint = chest;
      hitEnemy = target;
    } else {
      hitPoint = wallPoint(origin, aimDir);
    }
    var muzzlePos = origin.clone().add(aimDir.clone().multiplyScalar(1.2));
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
    var nearPed = SOL.pedestrians && SOL.pedestrians.nearestTo(origin.x, origin.z, 30);
    if (nearPed && police) police.addHeat(12, 'shots fired in public');
    return { type: 'miss', point: hitPoint };
  };

  C.update = function (dt, G) {
    cooldown = Math.max(0, cooldown - dt);
    for (var i = tracers.length - 1; i >= 0; i--) {
      var t = tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / t.span);
      if (t.life <= 0) {
        scene.remove(t.line);
        tracers.splice(i, 1);
      }
    }
    var playerPos = G.player.pos;
    for (var j = 0; j < enemies.length; j++) {
      var e = enemies[j];
      var dx = playerPos.x - e.pos.x;
      var dz = playerPos.z - e.pos.z;
      var dist = Math.sqrt(dx * dx + dz * dz) || 1;
      e.yaw = Math.atan2(dx, dz);
      e.group.rotation.y = e.yaw;
      // Health bar faces the camera.
      var fg = e.group.userData.healthFg;
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
          var from = e.pos.clone();
          from.y = 1.3;
          var to = playerPos.clone();
          to.y = 1.2;
          drawTracer(from, to, 0xff6a3d);
          // Hit chance falls with distance; point-blank hurts.
          var chance = dist < 12 ? 0.42 : dist < 24 ? 0.26 : 0.13;
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
