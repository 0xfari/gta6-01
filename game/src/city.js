// SOLMARIS v4 — city.js: a sun-soaked coastal grid. Roads on a 4x4 grid,
// tower blocks between them, a beach on the east edge and a harbor dock on
// the south edge. Placement uses the seeded SOL.rand so staged screenshots
// are reproducible. Colliders are plain AABBs; resolveCollision pushes a
// circle (player, car, pedestrian) out of every box it overlaps.
(function () {
  const GRID = [-120, -40, 40, 120];
  const ROAD_W = 13;
  const BOUND = 190;
  const boxes = [];

  const SPOTS = {
    start: { x: 0, z: 24 },
    garage: { x: -100, z: -100 },
    alley: { x: 60, z: -60 },
    harbor: { x: 0, z: 172 },
    safehouse: { x: 100, z: 100 },
    hospital: { x: -60, z: 100 },
    beach: { x: 168, z: 0 },
    plaza: { x: 0, z: 0 },
  };

  function addBox(x0, z0, x1, z1) {
    boxes.push({
      x0: Math.min(x0, x1), z0: Math.min(z0, z1),
      x1: Math.max(x0, x1), z1: Math.max(z0, z1),
    });
  }

  function asphaltTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#34373e';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#2c2f35';
    for (let i = 0; i < 160; i++) g.fillRect(SOL.rand() * 128, SOL.rand() * 128, 2, 2);
    g.fillStyle = '#e8e4d8';
    g.fillRect(0, 62, 128, 4);
    g.fillStyle = '#c9c4b2';
    g.fillRect(4, 0, 3, 128);
    g.fillRect(121, 0, 3, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(22, 1);
    return tex;
  }

  function windowsTexture(base, litChance) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 256);
    for (let y = 12; y < 244; y += 24) {
      for (let x = 12; x < 116; x += 22) {
        g.fillStyle = SOL.rand() < litChance ? '#ffd98a' : '#1e222c';
        g.fillRect(x, y, 12, 14);
      }
    }
    return new THREE.CanvasTexture(c);
  }

  function ground(scene) {
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(460, 460),
      new THREE.MeshLambertMaterial({ color: 0x7d838c })
    );
    base.rotation.x = -Math.PI / 2;
    base.receiveShadow = true;
    scene.add(base);

    const tex = asphaltTexture();
    const roadMat = new THREE.MeshLambertMaterial({ map: tex });
    const span = 330;
    for (const at of GRID) {
      const h = new THREE.Mesh(new THREE.PlaneGeometry(span, ROAD_W), roadMat);
      h.rotation.x = -Math.PI / 2;
      h.position.set(0, 0.02, at);
      scene.add(h);
      const vTex = tex.clone();
      vTex.repeat.set(1, 22);
      vTex.needsUpdate = true;
      const v = new THREE.Mesh(
        new THREE.PlaneGeometry(ROAD_W, span),
        new THREE.MeshLambertMaterial({ map: vTex })
      );
      v.rotation.x = -Math.PI / 2;
      v.rotation.z = Math.PI / 2;
      v.position.set(at, 0.02, 0);
      scene.add(v);
    }

    // Sand on the east edge, concrete dock on the south edge.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 460),
      new THREE.MeshLambertMaterial({ color: 0xe0c98f })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(186, 0.03, 0);
    scene.add(sand);
    const dock = new THREE.Mesh(
      new THREE.PlaneGeometry(460, 44),
      new THREE.MeshLambertMaterial({ color: 0x767b84 })
    );
    dock.rotation.x = -Math.PI / 2;
    dock.position.set(0, 0.03, 186);
    scene.add(dock);

    // Water: sea east, bay south.
    const waterMat = new THREE.MeshLambertMaterial({ color: 0x1e6f8e, transparent: true, opacity: 0.92 });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(240, 460), waterMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(330, 0.01, 0);
    scene.add(sea);
    const bay = new THREE.Mesh(new THREE.PlaneGeometry(460, 240), waterMat);
    bay.rotation.x = -Math.PI / 2;
    bay.position.set(0, 0.01, 330);
    scene.add(bay);
  }

  function blocks(scene) {
    const facades = [
      windowsTexture('#c96f4a', 0.35),
      windowsTexture('#4a7a96', 0.3),
      windowsTexture('#8a6f9e', 0.3),
      windowsTexture('#b8a05a', 0.35),
      windowsTexture('#5f8a6a', 0.3),
    ];
    const mats = facades.map(function (t) { return new THREE.MeshLambertMaterial({ map: t }); });
    const centers = [-80, 0, 80];
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x4d8a4a });
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a33 });

    function palm(x, z, h) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.48, h, 6), trunkMat);
      trunk.position.set(x, h / 2, z);
      scene.add(trunk);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.5, 0), leafMat);
      crown.position.set(x, h + 1.1, z);
      scene.add(crown);
    }

    for (const cx of centers) {
      for (const cz of centers) {
        if (Math.abs(cx) < 5 && Math.abs(cz) < 5) {
          // Central plaza: grass ring + palms, kept open for the player spawn.
          const park = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), grassMat);
          park.rotation.x = -Math.PI / 2;
          park.position.set(cx, 0.04, cz);
          scene.add(park);
          for (let t = 0; t < 4; t++) palm(cx + SOL.randRange(-15, 15), cz + SOL.randRange(-15, 15), 7);
          continue;
        }
        if (SOL.rand() < 0.18) {
          const park = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), grassMat);
          park.rotation.x = -Math.PI / 2;
          park.position.set(cx, 0.04, cz);
          scene.add(park);
          for (let t = 0; t < 4; t++) palm(cx + SOL.randRange(-15, 15), cz + SOL.randRange(-15, 15), 7);
          continue;
        }
        const n = 1 + Math.floor(SOL.rand() * 3);
        for (let b = 0; b < n; b++) {
          const w = SOL.randRange(12, 20);
          const d = SOL.randRange(12, 20);
          const h = SOL.randRange(9, 44);
          const bx = cx + SOL.randRange(-11, 11);
          const bz = cz + SOL.randRange(-11, 11);
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), SOL.pick(mats));
          mesh.position.set(bx, h / 2, bz);
          mesh.castShadow = true;
          scene.add(mesh);
          addBox(bx - w / 2 - 0.5, bz - d / 2 - 0.5, bx + w / 2 + 0.5, bz + d / 2 + 0.5);
          if (h > 30) {
            const beacon = new THREE.Mesh(
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
    const contColors = [0xb3541e, 0x2e6b8a, 0x7a9e2e, 0x8a2e5c];
    for (let k = 0; k < 8; k++) {
      const kx = -84 + k * 24;
      const kz = 178 + (k % 2) * 8;
      const cont = new THREE.Mesh(
        new THREE.BoxGeometry(12, 3, 3),
        new THREE.MeshLambertMaterial({ color: contColors[k % 4] })
      );
      cont.position.set(kx, 1.5, kz);
      cont.castShadow = true;
      scene.add(cont);
      addBox(kx - 6, kz - 1.5, kx + 6, kz + 1.5);
    }
    // Beach palms along the shore.
    for (let p = -140; p <= 140; p += 28) palm(160, p, 8);
    // Street lamps at intersections.
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (const a of GRID) {
      for (const c of GRID) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
        pole.position.set(a + 8.5, 3.5, c + 8.5);
        scene.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampMat);
        lamp.position.set(a + 8.5, 7.2, c + 8.5);
        scene.add(lamp);
      }
    }
  }

  function nearestRoad(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const at of GRID) {
      const dz = Math.abs(z - at);
      if (dz < bestD) { bestD = dz; best = { axis: 'x', at: at, dist: dz }; }
      const dx = Math.abs(x - at);
      if (dx < bestD) { bestD = dx; best = { axis: 'z', at: at, dist: dx }; }
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
      ground(scene);
      blocks(scene);
      return this;
    },
    resolveCollision: function (pos, r) {
      let hit = false;
      for (const c of boxes) {
        const nx = Math.max(c.x0, Math.min(pos.x, c.x1));
        const nz = Math.max(c.z0, Math.min(pos.z, c.z1));
        const dx = pos.x - nx;
        const dz = pos.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * r;
          pos.z = nz + (dz / d) * r;
        } else {
          const pl = Math.min(pos.x - c.x0, c.x1 - pos.x);
          const pz = Math.min(pos.z - c.z0, c.z1 - pos.z);
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
      const r = nearestRoad(x, z);
      return !!r && r.dist <= ROAD_W / 2 + 0.5;
    },
    randomRoadPoint: function () {
      const axis = SOL.rand() < 0.5 ? 'x' : 'z';
      const at = SOL.pick(GRID);
      const along = SOL.randRange(-150, 150);
      return axis === 'x' ? { x: along, z: at } : { x: at, z: along };
    },
    randomSidewalkPoint: function () {
      const axis = SOL.rand() < 0.5 ? 'x' : 'z';
      const at = SOL.pick(GRID);
      const along = SOL.randRange(-150, 150);
      const off = (SOL.rand() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 2.2);
      return axis === 'x' ? { x: along, z: at + off } : { x: at + off, z: along };
    },
    roadPointAhead: function (x, z, dist) {
      const r = nearestRoad(x, z);
      if (!r) return { x: x, z: z };
      if (r.axis === 'x') return { x: x + (SOL.rand() < 0.5 ? -dist : dist), z: r.at };
      return { x: r.at, z: z + (SOL.rand() < 0.5 ? -dist : dist) };
    },
  };
})();
