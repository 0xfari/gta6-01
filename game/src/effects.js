// SOLMARIS v4 — effects.js: pooled particle bursts, muzzle flashes, smoke,
// skid puffs, explosions and camera shake. One shared pool of small boxes is
// reused for everything so the game never allocates meshes per frame.
(function () {
  const E = {};
  const POOL = 360;
  const parts = [];
  const lights = [];
  let scene = null;
  let shake = 0;

  function makePart() {
    const geo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    scene.add(mesh);
    return { mesh: mesh, vel: new THREE.Vector3(), life: 0, span: 1, grav: 0, spin: 0 };
  }

  function emit(pos, color, count, speed, life, grav, size) {
    let made = 0;
    for (let i = 0; i < parts.length && made < count; i++) {
      const p = parts[i];
      if (p.life > 0) continue;
      p.life = life * (0.6 + Math.random() * 0.7);
      p.span = p.life;
      p.mesh.visible = true;
      p.mesh.position.copy(pos);
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      p.mesh.scale.setScalar(size * (0.7 + Math.random() * 0.6));
      const a = Math.random() * Math.PI * 2;
      const up = (Math.random() - 0.2) * speed;
      p.vel.set(Math.cos(a) * speed * (0.4 + Math.random() * 0.8), up, Math.sin(a) * speed * (0.4 + Math.random() * 0.8));
      p.grav = grav;
      p.spin = (Math.random() - 0.5) * 12;
      made++;
    }
  }

  function flash(pos, color, intensity, range, life) {
    const light = new THREE.PointLight(color, intensity, range);
    light.position.copy(pos);
    scene.add(light);
    lights.push({ light: light, life: life, span: life });
  }

  E.init = function (sc) {
    scene = sc;
    for (let i = 0; i < POOL; i++) parts.push(makePart());
  };

  E.burst = function (pos, color, count, speed, life, grav) {
    emit(pos, color, count || 10, speed || 6, life || 0.7, grav == null ? 9 : grav, 1);
  };

  E.muzzle = function (pos, dir) {
    emit(pos, 0xffd23e, 6, 3, 0.12, 0, 1.6);
    const tip = pos.clone().add(dir.clone().multiplyScalar(0.9));
    emit(tip, 0xff9a3d, 4, 2, 0.1, 0, 1.2);
    flash(pos, 0xffc861, 3.2, 9, 0.07);
  };

  E.sparks = function (pos) { emit(pos, 0xffe9a8, 8, 7, 0.4, 12, 0.8); };
  E.smoke = function (pos) { emit(pos, 0x5a5f6b, 5, 1.2, 1.4, -1.5, 2.2); };
  E.skid = function (pos) {
    emit(pos, 0x9aa0ad, 2, 0.8, 0.5, 0, 1.4);
    emit(pos, 0x2c2f36, 2, 0.6, 0.7, 0, 1.8);
  };
  E.hit = function (pos) { emit(pos, 0xc22418, 10, 4, 0.5, 10, 1); };

  E.explosion = function (pos) {
    emit(pos, 0xff7a1a, 26, 11, 0.8, 6, 2.2);
    emit(pos, 0xffd23e, 16, 7, 0.6, 4, 1.8);
    emit(pos, 0x3a3f4a, 14, 3, 1.6, -2, 2.6);
    flash(pos, 0xff8c2e, 9, 42, 0.35);
    E.addShake(0.9);
  };

  E.addShake = function (n) { shake = Math.min(1.4, shake + n); };
  E.shake = function () { return shake; };

  E.update = function (dt) {
    shake = Math.max(0, shake - dt * 1.8);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      p.vel.y -= p.grav * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.spin * dt;
      p.mesh.rotation.y += p.spin * 0.7 * dt;
      p.mesh.material.opacity = Math.max(0, p.life / p.span);
    }
    for (let j = lights.length - 1; j >= 0; j--) {
      const f = lights[j];
      f.life -= dt;
      if (f.life <= 0) {
        scene.remove(f.light);
        lights.splice(j, 1);
      } else {
        f.light.intensity *= 0.82;
      }
    }
  };

  SOL.effects = E;
})();
