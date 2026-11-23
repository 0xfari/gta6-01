// SOLMARIS city — a sun-soaked coastal grid: roads, towers, beach, harbor.
window.SOL = window.SOL || {};
SOL.city = (function () {
  var ROAD_AT = [-145, -87, -29, 29, 87, 145];
  var ROAD_W = 14;
  var BOUND = 205;
  var colliders = [];
  var sceneRef = null;

  // Named places the missions and the spawn logic use.
  var SPOTS = {
    start: { x: 0, z: 30 },
    garage: { x: -116, z: -100 },
    alley: { x: 58, z: -58 },
    harbor: { x: 0, z: 188 },
    safehouse: { x: 116, z: 116 },
    hospital: { x: -58, z: 116 },
    beach: { x: 180, z: 0 },
    downtown: { x: 0, z: 0 }
  };

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function addCollider(x0, z0, x1, z1) {
    colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  }

  function roadTexture() {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = '#33363d';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#2b2e34';
    for (var i = 0; i < 200; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    g.fillStyle = '#e8e4d8';
    g.fillRect(0, 62, 128, 4);
    g.fillStyle = '#c9c4b2';
    g.fillRect(4, 0, 3, 128);
    g.fillRect(121, 0, 3, 128);
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(24, 1);
    return tex;
  }

  function facadeTexture(base, litRatio) {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 256);
    for (var y = 10; y < 246; y += 22) {
      for (var x = 10; x < 118; x += 20) {
        var lit = Math.random() < litRatio;
        g.fillStyle = lit ? '#ffd98a' : '#20242e';
        g.fillRect(x, y, 12, 14);
      }
    }
    var tex = new THREE.CanvasTexture(c);
    return tex;
  }

  function buildGround(scene) {
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(480, 480),
      new THREE.MeshLambertMaterial({ color: 0x7d838c })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    var roadTex = roadTexture();
    var roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
    var span = 340;
    for (var i = 0; i < ROAD_AT.length; i++) {
      var at = ROAD_AT[i];
      var h = new THREE.Mesh(new THREE.PlaneGeometry(span, ROAD_W), roadMat);
      h.rotation.x = -Math.PI / 2;
      h.position.set(0, 0.02, at);
      scene.add(h);
      var v = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, span), roadMat.clone());
      // The vertical plane is 14 wide (u) by 340 long (v): tile the dashes
      // along its length, not 24 times across its width.
      var vTex = roadTex.clone();
      vTex.repeat.set(1, 24);
      vTex.needsUpdate = true;
      v.material.map = vTex;
      v.rotation.x = -Math.PI / 2;
      v.rotation.z = Math.PI / 2;
      v.position.set(at, 0.02, 0);
      scene.add(v);
    }

    // Beach sand (east) and harbor concrete (south).
    var sand = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 480),
      new THREE.MeshLambertMaterial({ color: 0xe0c98f })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(192, 0.03, 0);
    scene.add(sand);
    var dock = new THREE.Mesh(
      new THREE.PlaneGeometry(480, 48),
      new THREE.MeshLambertMaterial({ color: 0x767b84 })
    );
    dock.rotation.x = -Math.PI / 2;
    dock.position.set(0, 0.03, 192);
    scene.add(dock);

    // Water: east sea and south bay.
    var waterMat = new THREE.MeshLambertMaterial({ color: 0x1e6f8e, transparent: true, opacity: 0.92 });
    var sea = new THREE.Mesh(new THREE.PlaneGeometry(260, 480), waterMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(345, 0.01, 0);
    scene.add(sea);
    var bay = new THREE.Mesh(new THREE.PlaneGeometry(480, 260), waterMat);
    bay.rotation.x = -Math.PI / 2;
    bay.position.set(0, 0.01, 345);
    scene.add(bay);
  }

  function buildBlocks(scene) {
    var facades = [
      facadeTexture('#c96f4a', 0.35),
      facadeTexture('#4a7a96', 0.3),
      facadeTexture('#8a6f9e', 0.3),
      facadeTexture('#b8a05a', 0.35),
      facadeTexture('#5f8a6a', 0.3)
    ];
    var mats = facades.map(function (t) { return new THREE.MeshLambertMaterial({ map: t }); });
    var centers = [-116, -58, 0, 58, 116];
    var parkMat = new THREE.MeshLambertMaterial({ color: 0x4d8a4a });
    var trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
    var leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a33 });

    for (var ix = 0; ix < centers.length; ix++) {
      for (var iz = 0; iz < centers.length; iz++) {
        var cx = centers[ix];
        var cz = centers[iz];
        var roll = Math.random();
        if (roll < 0.16) {
          // Park block: grass + palms.
          var park = new THREE.Mesh(new THREE.PlaneGeometry(42, 42), parkMat);
          park.rotation.x = -Math.PI / 2;
          park.position.set(cx, 0.04, cz);
          scene.add(park);
          for (var t = 0; t < 4; t++) {
            var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
            trunk.position.set(cx + rand(-16, 16), 3.5, cz + rand(-16, 16));
            scene.add(trunk);
            var crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), leafMat);
            crown.position.set(trunk.position.x, 8.2, trunk.position.z);
            scene.add(crown);
          }
          continue;
        }
        // 1-3 towers per block.
        var n = 1 + Math.floor(Math.random() * 3);
        for (var b = 0; b < n; b++) {
          var w = rand(12, 20);
          var d = rand(12, 20);
          var h = rand(9, 46);
          var bx = cx + (b === 0 ? rand(-8, 8) : rand(-12, 12));
          var bz = cz + (b === 0 ? rand(-8, 8) : rand(-12, 12));
          if (Math.abs(bx) < 12 && Math.abs(bz) < 12) { bx += 14; }
          var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pick(mats));
          mesh.position.set(bx, h / 2, bz);
          scene.add(mesh);
          addCollider(bx - w / 2 - 0.5, bz - d / 2 - 0.5, bx + w / 2 + 0.5, bz + d / 2 + 0.5);
          // Rooftop beacon on the tallest towers.
          if (h > 30) {
            var beacon = new THREE.Mesh(
              new THREE.BoxGeometry(1.2, 1.2, 1.2),
              new THREE.MeshBasicMaterial({ color: 0xff4040 })
            );
            beacon.position.set(bx, h + 0.8, bz);
            scene.add(beacon);
          }
        }
      }
    }

    // Harbor containers (colliders) + cranes.
    var contColors = [0xb3541e, 0x2e6b8a, 0x7a9e2e, 0x8a2e5c];
    for (var k = 0; k < 8; k++) {
      var cw = 12, ch = 3, cd = 3;
      var kx = -90 + k * 26;
      var kz = 186 + (k % 2) * 8;
      var cont = new THREE.Mesh(
        new THREE.BoxGeometry(cw, ch, cd),
        new THREE.MeshLambertMaterial({ color: contColors[k % 4] })
      );
      cont.position.set(kx, ch / 2, kz);
      scene.add(cont);
      addCollider(kx - cw / 2, kz - cd / 2, kx + cw / 2, kz + cd / 2);
    }
    // Beach palms along the shore road.
    for (var p = -140; p <= 140; p += 28) {
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 8, 6), trunkMat);
      trunk.position.set(164, 4, p);
      scene.add(trunk);
      var crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.8, 0), leafMat);
      crown.position.set(164, 9.4, p);
      scene.add(crown);
    }
    // Street lamps at intersections.
    var poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
    var lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (var a = 0; a < ROAD_AT.length; a++) {
      for (var c = 0; c < ROAD_AT.length; c++) {
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
        pole.position.set(ROAD_AT[a] + 8.5, 3.5, ROAD_AT[c] + 8.5);
        scene.add(pole);
        var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampMat);
        lamp.position.set(ROAD_AT[a] + 8.5, 7.2, ROAD_AT[c] + 8.5);
        scene.add(lamp);
      }
    }
  }

  function nearestRoad(x, z) {
    var best = null;
    var bestD = Infinity;
    for (var i = 0; i < ROAD_AT.length; i++) {
      var dz = Math.abs(z - ROAD_AT[i]);
      if (dz < bestD) { bestD = dz; best = { axis: 'x', at: ROAD_AT[i], dist: dz }; }
      var dx = Math.abs(x - ROAD_AT[i]);
      if (dx < bestD) { bestD = dx; best = { axis: 'z', at: ROAD_AT[i], dist: dx }; }
    }
    return best;
  }

  return {
    spots: SPOTS,
    roads: ROAD_AT,
    roadWidth: ROAD_W,
    bound: BOUND,
    build: function (scene) {
      sceneRef = scene;
      buildGround(scene);
      buildBlocks(scene);
      return this;
    },
    colliders: colliders,
    // Push a circle (pos.x/z, radius r) out of every building/container AABB.
    resolveCollision: function (pos, r) {
      var hit = false;
      for (var i = 0; i < colliders.length; i++) {
        var c = colliders[i];
        var nx = Math.max(c.x0, Math.min(pos.x, c.x1));
        var nz = Math.max(c.z0, Math.min(pos.z, c.z1));
        var dx = pos.x - nx;
        var dz = pos.z - nz;
        var d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 0.0001) {
          var d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * r;
          pos.z = nz + (dz / d) * r;
        } else {
          var pl = Math.min(pos.x - c.x0, c.x1 - pos.x);
          var pz = Math.min(pos.z - c.z0, c.z1 - pos.z);
          if (pl < pz) pos.x = (pos.x - c.x0 < c.x1 - pos.x) ? c.x0 - r : c.x1 + r;
          else pos.z = (pos.z - c.z0 < c.z1 - pos.z) ? c.z0 - r : c.z1 + r;
        }
      }
      return hit;
    },
    clampToCity: function (pos) {
      pos.x = Math.max(-BOUND, Math.min(BOUND, pos.x));
      pos.z = Math.max(-BOUND, Math.min(BOUND, pos.z));
    },
    nearestRoad: nearestRoad,
    onRoad: function (x, z) {
      var r = nearestRoad(x, z);
      return r && r.dist <= ROAD_W / 2 + 0.5;
    },
    randomRoadPoint: function () {
      var axis = Math.random() < 0.5 ? 'x' : 'z';
      var at = pick(ROAD_AT);
      var along = rand(-150, 150);
      return axis === 'x' ? { x: along, z: at } : { x: at, z: along };
    },
    randomSidewalkPoint: function () {
      var axis = Math.random() < 0.5 ? 'x' : 'z';
      var at = pick(ROAD_AT);
      var along = rand(-150, 150);
      var off = (Math.random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 2.2);
      return axis === 'x' ? { x: along, z: at + off } : { x: at + off, z: along };
    },
    // A point on the same road as (x,z), offset forward along it.
    roadPointAhead: function (x, z, dist) {
      var r = nearestRoad(x, z);
      if (!r) return { x: x, z: z };
      if (r.axis === 'x') return { x: x + (Math.random() < 0.5 ? -dist : dist), z: r.at };
      return { x: r.at, z: z + (Math.random() < 0.5 ? -dist : dist) };
    }
  };
})();
