// SOLMARIS v6 — effects.js: pooled particle bursts, muzzle flashes,
// smoke, skid puffs, explosions and camera shake. One shared pool of small
// boxes is reused for everything, so the game never allocates meshes per
// frame. Flash lights are the only short-lived objects, and they are
// removed from the scene as soon as they die.
(function () {
  var E = {};
  var POOL_SIZE = 360;
  var parts = [];
  var flashes = [];
  var scene = null;
  var shakeLevel = 0;

  function spawnPart() {
    var mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.24, 0.24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })
    );
    mesh.visible = false;
    scene.add(mesh);
    return {
      mesh: mesh,
      vel: new THREE.Vector3(),
      life: 0,
      span: 1,
      grav: 0,
      spin: 0,
    };
  }

  function emit(pos, color, count, speed, life, grav, size) {
    var made = 0;
    for (var i = 0; i < parts.length && made < count; i++) {
      var p = parts[i];
      if (p.life > 0) continue;
      p.life = life * (0.6 + Math.random() * 0.7);
      p.span = p.life;
      p.mesh.visible = true;
      p.mesh.position.copy(pos);
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      p.mesh.scale.setScalar(size * (0.7 + Math.random() * 0.6));
      var a = Math.random() * Math.PI * 2;
      var up = (Math.random() - 0.2) * speed;
      var radial = speed * (0.4 + Math.random() * 0.8);
      p.vel.set(Math.cos(a) * radial, up, Math.sin(a) * radial);
      p.grav = grav;
      p.spin = (Math.random() - 0.5) * 12;
      made++;
    }
  }

  function flash(pos, color, intensity, range, life) {
    var light = new THREE.PointLight(color, intensity, range);
    light.position.copy(pos);
    scene.add(light);
    flashes.push({ light: light, life: life });
  }

  E.init = function (sc) {
    scene = sc;
    for (var i = 0; i < POOL_SIZE; i++) parts.push(spawnPart());
  };

  E.burst = function (pos, color, count, speed, life, grav) {
    emit(pos, color, count || 10, speed || 6, life || 0.7, grav == null ? 9 : grav, 1);
  };

  E.muzzle = function (pos, dir) {
    emit(pos, 0xffd23e, 6, 3, 0.12, 0, 1.6);
    var tip = pos.clone().add(dir.clone().multiplyScalar(0.9));
    emit(tip, 0xff9a3d, 4, 2, 0.1, 0, 1.2);
    flash(pos, 0xffc861, 3.2, 9, 0.07);
  };

  E.sparks = function (pos) {
    emit(pos, 0xffe9a8, 8, 7, 0.4, 12, 0.8);
  };

  E.smoke = function (pos) {
    emit(pos, 0x5a5f6b, 5, 1.2, 1.4, -1.5, 2.2);
  };

  E.skid = function (pos) {
    emit(pos, 0x9aa0ad, 2, 0.8, 0.5, 0, 1.4);
    emit(pos, 0x2c2f36, 2, 0.6, 0.7, 0, 1.8);
  };

  E.hit = function (pos) {
    emit(pos, 0xc22418, 10, 4, 0.5, 10, 1);
  };

  E.explosion = function (pos) {
    emit(pos, 0xff7a1a, 26, 11, 0.8, 6, 2.2);
    emit(pos, 0xffd23e, 16, 7, 0.6, 4, 1.8);
    emit(pos, 0x3a3f4a, 14, 3, 1.6, -2, 2.6);
    flash(pos, 0xff8c2e, 9, 42, 0.35);
    E.addShake(0.9);
  };

  E.addShake = function (n) {
    shakeLevel = Math.min(1.4, shakeLevel + n);
  };

  E.shake = function () {
    return shakeLevel;
  };

  E.update = function (dt) {
    shakeLevel = Math.max(0, shakeLevel - dt * 1.8);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= p.grav * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.spin * dt;
      p.mesh.rotation.y += p.spin * 0.7 * dt;
      p.mesh.material.opacity = Math.max(0, p.life / p.span);
    }
    for (var j = flashes.length - 1; j >= 0; j--) {
      var f = flashes[j];
      f.life -= dt;
      if (f.life <= 0) {
        scene.remove(f.light);
        flashes.splice(j, 1);
      } else {
        f.light.intensity *= 0.82;
      }
    }
  };

  SOL.effects = E;
})();
