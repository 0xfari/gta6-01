// SOLMARIS effects — pooled particles, muzzle flashes, explosions, camera shake.
window.SOL = window.SOL || {};
SOL.effects = (function () {
  var scene = null;
  var pool = [];
  var flashes = [];
  var shake = 0;
  var POOL_N = 420;

  function makeParticle() {
    var geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    var mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    var m = new THREE.Mesh(geo, mat);
    m.visible = false;
    scene.add(m);
    return { mesh: m, vel: new THREE.Vector3(), life: 0, maxLife: 1, grav: 0, spin: 0 };
  }

  function spawn(pos, color, count, speed, life, grav, size) {
    var made = 0;
    for (var i = 0; i < pool.length && made < count; i++) {
      var p = pool[i];
      if (p.life > 0) continue;
      p.life = life * (0.6 + Math.random() * 0.7);
      p.maxLife = p.life;
      p.mesh.visible = true;
      p.mesh.position.copy(pos);
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      p.mesh.scale.setScalar(size * (0.7 + Math.random() * 0.6));
      var a = Math.random() * Math.PI * 2;
      var up = (Math.random() - 0.25) * speed;
      p.vel.set(Math.cos(a) * speed * (0.4 + Math.random() * 0.8), up, Math.sin(a) * speed * (0.4 + Math.random() * 0.8));
      p.grav = grav;
      p.spin = (Math.random() - 0.5) * 12;
      made++;
    }
  }

  return {
    init: function (sc) {
      scene = sc;
      for (var i = 0; i < POOL_N; i++) pool.push(makeParticle());
    },
    burst: function (pos, color, count, speed, life, grav) {
      spawn(pos, color, count || 10, speed || 6, life || 0.7, grav == null ? 9 : grav, 1);
    },
    muzzle: function (pos, dir) {
      spawn(pos, 0xffd23e, 6, 3, 0.12, 0, 1.6);
      var tip = pos.clone().add(dir.clone().multiplyScalar(0.9));
      spawn(tip, 0xff9a3d, 4, 2, 0.1, 0, 1.2);
      var light = new THREE.PointLight(0xffc861, 3.2, 9);
      light.position.copy(pos);
      scene.add(light);
      flashes.push({ light: light, life: 0.07, max: 0.07 });
    },
    sparks: function (pos) { spawn(pos, 0xffe9a8, 8, 7, 0.4, 12, 0.8); },
    smoke: function (pos) { spawn(pos, 0x5a5f6b, 5, 1.2, 1.4, -1.5, 2.2); },
    skid: function (pos) {
      spawn(pos, 0x9aa0ad, 2, 0.8, 0.5, 0, 1.4);
      spawn(pos, 0x2c2f36, 2, 0.6, 0.7, 0, 1.8);
    },
    explosion: function (pos) {
      spawn(pos, 0xff7a1a, 26, 11, 0.8, 6, 2.2);
      spawn(pos, 0xffd23e, 16, 7, 0.6, 4, 1.8);
      spawn(pos, 0x3a3f4a, 14, 3, 1.6, -2, 2.6);
      var light = new THREE.PointLight(0xff8c2e, 9, 42);
      light.position.copy(pos).y += 2;
      scene.add(light);
      flashes.push({ light: light, life: 0.35, max: 0.35 });
      this.addShake(0.9);
    },
    blood: function (pos) { spawn(pos, 0xc22418, 10, 4, 0.5, 10, 1); },
    addShake: function (n) { shake = Math.min(1.4, shake + n); },
    shakeAmount: function () { return shake; },
    update: function (dt) {
      shake = Math.max(0, shake - dt * 1.8);
      for (var i = 0; i < pool.length; i++) {
        var p = pool[i];
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) { p.mesh.visible = false; continue; }
        p.vel.y -= p.grav * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.rotation.x += p.spin * dt;
        p.mesh.rotation.y += p.spin * 0.7 * dt;
        p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
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
    }
  };
})();
