// SOLMARIS v6 — city.js: a sun-soaked coastal grid. Roads on a 4x4 grid,
// tower blocks between them, a beach on the east edge and a harbor dock on
// the south edge. Placement uses the seeded SOL.rand so staged screenshots
// are reproducible. Colliders are plain AABBs; resolveCollision pushes a
// circle (player, car, pedestrian) out of every box it overlaps.
(function () {
  var GRID = [-120, -40, 40, 120];
  var ROAD_W = 13;
  var BOUND = 190;
  var boxes = [];

  var SPOTS = {
    start: { x: 0, z: 24 },
    garage: { x: -100, z: -100 },
    alley: { x: 60, z: -60 },
    harbor: { x: 0, z: 172 },
    safehouse: { x: 100, z: 100 },
    hospital: { x: -60, z: 100 },
    beach: { x: 168, z: 0 },
    plaza: { x: 0, z: 0 },
  };

  function registerBox(x0, z0, x1, z1) {
    boxes.push({
      x0: Math.min(x0, x1),
      z0: Math.min(z0, z1),
      x1: Math.max(x0, x1),
      z1: Math.max(z0, z1),
    });
  }

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return { canvas: c, g: c.getContext('2d') };
  }

  function asphalt() {
    var t = makeCanvas(128, 128);
    t.g.fillStyle = '#34373e';
    t.g.fillRect(0, 0, 128, 128);
    t.g.fillStyle = '#2c2f35';
    for (var i = 0; i < 160; i++) {
      t.g.fillRect(SOL.rand() * 128, SOL.rand() * 128, 2, 2);
    }
    t.g.fillStyle = '#e8e4d8';
    t.g.fillRect(0, 62, 128, 4);
    t.g.fillStyle = '#c9c4b2';
    t.g.fillRect(4, 0, 3, 128);
    t.g.fillRect(121, 0, 3, 128);
    var tex = new THREE.CanvasTexture(t.canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(22, 1);
    return tex;
  }

  function facade(base, litChance) {
    var t = makeCanvas(128, 256);
    t.g.fillStyle = base;
    t.g.fillRect(0, 0, 128, 256);
    for (var y = 12; y < 244; y += 24) {
      for (var x = 12; x < 116; x += 22) {
        t.g.fillStyle = SOL.rand() < litChance ? '#ffd98a' : '#1e222c';
        t.g.fillRect(x, y, 12, 14);
      }
    }
    return new THREE.CanvasTexture(t.canvas);
  }

  function flatPlane(w, d, color, x, y, z) {
    var m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshLambertMaterial({ color: color })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    return m;
  }

  function groundLayer(scene) {
    var base = flatPlane(460, 460, 0x7d838c, 0, 0, 0);
    base.receiveShadow = true;
    scene.add(base);

    var tex = asphalt();
    var roadMat = new THREE.MeshLambertMaterial({ map: tex });
    var span = 330;
    for (var i = 0; i < GRID.length; i++) {
      var at = GRID[i];
      var h = new THREE.Mesh(new THREE.PlaneGeometry(span, ROAD_W), roadMat);
      h.rotation.x = -Math.PI / 2;
      h.position.set(0, 0.02, at);
      scene.add(h);
      var vTex = tex.clone();
      vTex.repeat.set(1, 22);
      vTex.needsUpdate = true;
      var v = new THREE.Mesh(
        new THREE.PlaneGeometry(ROAD_W, span),
        new THREE.MeshLambertMaterial({ map: vTex })
      );
      v.rotation.x = -Math.PI / 2;
      v.rotation.z = Math.PI / 2;
      v.position.set(at, 0.02, 0);
      scene.add(v);
    }

    // Sand on the east edge, concrete dock on the south edge.
    scene.add(flatPlane(44, 460, 0xe0c98f, 186, 0.03, 0));
    scene.add(flatPlane(460, 44, 0x767b84, 0, 0.03, 186));

    // Water: sea east, bay south.
    var waterMat = new THREE.MeshLambertMaterial({ color: 0x1e6f8e, transparent: true, opacity: 0.92 });
    var sea = new THREE.Mesh(new THREE.PlaneGeometry(240, 460), waterMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(330, 0.01, 0);
    scene.add(sea);
    var bay = new THREE.Mesh(new THREE.PlaneGeometry(460, 240), waterMat);
    bay.rotation.x = -Math.PI / 2;
    bay.position.set(0, 0.01, 330);
    scene.add(bay);
  }

  function palmTree(scene, x, z, h, trunkMat, leafMat) {
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.48, h, 6), trunkMat);
    trunk.position.set(x, h / 2, z);
    scene.add(trunk);
    var crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.5, 0), leafMat);
    crown.position.set(x, h + 1.1, z);
    scene.add(crown);
  }

  function blockLayer(scene) {
    var mats = [
      facade('#c96f4a', 0.35),
      facade('#4a7a96', 0.3),
      facade('#8a6f9e', 0.3),
      facade('#b8a05a', 0.35),
      facade('#5f8a6a', 0.3),
    ].map(function (t) {
      return new THREE.MeshLambertMaterial({ map: t });
    });
    var grassMat = new THREE.MeshLambertMaterial({ color: 0x4d8a4a });
    var trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
    var leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a33 });
    var centers = [-80, 0, 80];

    function park(cx, cz) {
      var lawn = flatPlane(40, 40, 0x4d8a4a, cx, 0.04, cz);
      scene.add(lawn);
      for (var t = 0; t < 4; t++) {
        palmTree(scene, cx + SOL.randRange(-15, 15), cz + SOL.randRange(-15, 15), 7, trunkMat, leafMat);
      }
    }

    for (var ci = 0; ci < centers.length; ci++) {
      for (var cj = 0; cj < centers.length; cj++) {
        var cx = centers[ci];
        var cz = centers[cj];
        if (Math.abs(cx) < 5 && Math.abs(cz) < 5) {
          // Central plaza: grass ring + palms, kept open for the player spawn.
          park(cx, cz);
          continue;
        }
        if (SOL.rand() < 0.18) {
          park(cx, cz);
          continue;
        }
        var n = 1 + Math.floor(SOL.rand() * 3);
        for (var b = 0; b < n; b++) {
          var w = SOL.randRange(12, 20);
          var d = SOL.randRange(12, 20);
          var h = SOL.randRange(9, 44);
          var bx = cx + SOL.randRange(-11, 11);
          var bz = cz + SOL.randRange(-11, 11);
          var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), SOL.pick(mats));
          mesh.position.set(bx, h / 2, bz);
          mesh.castShadow = true;
          scene.add(mesh);
          registerBox(bx - w / 2 - 0.5, bz - d / 2 - 0.5, bx + w / 2 + 0.5, bz + d / 2 + 0.5);
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

    // Harbor containers (colliders) along the south dock.
    var contColors = [0xb3541e, 0x2e6b8a, 0x7a9e2e, 0x8a2e5c];
    for (var k = 0; k < 8; k++) {
      var kx = -84 + k * 24;
      var kz = 178 + (k % 2) * 8;
      var cont = new THREE.Mesh(
        new THREE.BoxGeometry(12, 3, 3),
        new THREE.MeshLambertMaterial({ color: contColors[k % 4] })
      );
      cont.position.set(kx, 1.5, kz);
      cont.castShadow = true;
      scene.add(cont);
      registerBox(kx - 6, kz - 1.5, kx + 6, kz + 1.5);
    }
    // Beach palms along the shore.
    for (var p = -140; p <= 140; p += 28) palmTree(scene, 160, p, 8, trunkMat, leafMat);
    // Street lamps at intersections.
    var poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
    var lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (var a = 0; a < GRID.length; a++) {
      for (var c = 0; c < GRID.length; c++) {
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
        pole.position.set(GRID[a] + 8.5, 3.5, GRID[c] + 8.5);
        scene.add(pole);
        var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampMat);
        lamp.position.set(GRID[a] + 8.5, 7.2, GRID[c] + 8.5);
        scene.add(lamp);
      }
    }
  }

  function nearestRoad(x, z) {
    var best = null;
    var bestD = Infinity;
    for (var i = 0; i < GRID.length; i++) {
      var at = GRID[i];
      var dz = Math.abs(z - at);
      if (dz < bestD) {
        bestD = dz;
        best = { axis: 'x', at: at, dist: dz };
      }
      var dx = Math.abs(x - at);
      if (dx < bestD) {
        bestD = dx;
        best = { axis: 'z', at: at, dist: dx };
      }
    }
    return best;
  }

  SOL.city = {
    spots: SPOTS,
    roads: GRID,
    roadWidth: ROAD_W,
    bound: BOUND,
    colliders: boxes,
    build: function (scene) {
      groundLayer(scene);
      blockLayer(scene);
      return this;
    },
    resolveCollision: function (pos, r) {
      var hit = false;
      for (var i = 0; i < boxes.length; i++) {
        var c = boxes[i];
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
          if (pl < pz) pos.x = pos.x - c.x0 < c.x1 - pos.x ? c.x0 - r : c.x1 + r;
          else pos.z = pos.z - c.z0 < c.z1 - pos.z ? c.z0 - r : c.z1 + r;
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
      return !!r && r.dist <= ROAD_W / 2 + 0.5;
    },
    randomRoadPoint: function () {
      var axis = SOL.rand() < 0.5 ? 'x' : 'z';
      var at = SOL.pick(GRID);
      var along = SOL.randRange(-150, 150);
      return axis === 'x' ? { x: along, z: at } : { x: at, z: along };
    },
    randomSidewalkPoint: function () {
      var axis = SOL.rand() < 0.5 ? 'x' : 'z';
      var at = SOL.pick(GRID);
      var along = SOL.randRange(-150, 150);
      var off = (SOL.rand() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 2.2);
      return axis === 'x' ? { x: along, z: at + off } : { x: at + off, z: along };
    },
    roadPointAhead: function (x, z, dist) {
      var r = nearestRoad(x, z);
      if (!r) return { x: x, z: z };
      if (r.axis === 'x') return { x: x + (SOL.rand() < 0.5 ? -dist : dist), z: r.at };
      return { x: r.at, z: z + (SOL.rand() < 0.5 ? -dist : dist) };
    },
  };
})();
