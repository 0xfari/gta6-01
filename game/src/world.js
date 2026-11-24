// SOLMARIS v5 — world.js: the atmosphere and street-dressing layer.
// v4's world read empty in the screenshots: a flat grey ground plane, a
// flat blue sky, bare intersections and a bare dock. This module fills it
// in — gradient sky dome with sun and drifting clouds, an animated sea,
// pavement tiles and crosswalks so the ground is never a blank slab,
// traffic lights, billboards, bus stops, benches, a plaza fountain, a
// distant skyline on the horizon, and a dressed harbor with a crane,
// stacked containers and buoys. Everything is built from primitives and
// canvas textures generated in code: zero network requests, and placement
// uses the seeded SOL.rand so staged screenshots are reproducible.
(function () {
  const W = {};
  let scene = null;
  let clouds = [];
  let seaTex = null;
  let bayTex = null;
  let fountainTop = null;
  let lampReds = [];
  let lampGreens = [];
  let neonSigns = [];
  let gulls = [];

  function skyCanvas() {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#2a6cb0');
    grad.addColorStop(0.45, '#6faed6');
    grad.addColorStop(0.72, '#a8d0e8');
    grad.addColorStop(0.88, '#ffd9a0');
    grad.addColorStop(1.0, '#ffbe78');
    g.fillStyle = grad;
    g.fillRect(0, 0, 16, 256);
    return new THREE.CanvasTexture(c);
  }

  function tileCanvas() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#565c66';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#474c55';
    for (let i = 0; i < 110; i++) g.fillRect(SOL.rand() * 128, SOL.rand() * 128, 2, 2);
    g.strokeStyle = '#3f444d';
    g.lineWidth = 2;
    for (let k = 0; k <= 4; k++) {
      g.beginPath(); g.moveTo(k * 32, 0); g.lineTo(k * 32, 128); g.stroke();
      g.beginPath(); g.moveTo(0, k * 32); g.lineTo(128, k * 32); g.stroke();
    }
    g.strokeStyle = '#6e747e';
    g.lineWidth = 3;
    g.strokeRect(2, 2, 124, 124);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    return tex;
  }

  function waveCanvas() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#1e6f8e';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,0.28)';
    g.lineWidth = 3;
    for (let r = 0; r < 9; r++) {
      g.beginPath();
      const y = 14 + r * 28;
      for (let x = 0; x <= 256; x += 16) {
        const yy = y + Math.sin(x * 0.05 + r * 1.7) * 5;
        if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.10)';
    for (let i = 0; i < 40; i++) g.fillRect(SOL.rand() * 256, SOL.rand() * 256, 3, 2);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    return tex;
  }

  function signCanvas(lines, bg, fg, accent) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 192;
    const g = c.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 192);
    g.strokeStyle = accent;
    g.lineWidth = 10;
    g.strokeRect(6, 6, 500, 180);
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '900 64px Verdana, sans-serif';
    g.fillText(lines[0], 256, lines.length > 1 ? 72 : 96);
    if (lines.length > 1) {
      g.font = '700 34px Verdana, sans-serif';
      g.fillStyle = accent;
      g.fillText(lines[1], 256, 140);
    }
    return new THREE.CanvasTexture(c);
  }

  function buildSky() {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(720, 20, 14),
      new THREE.MeshBasicMaterial({ map: skyCanvas(), side: THREE.BackSide, fog: false })
    );
    scene.add(dome);
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(26, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false })
    );
    sun.position.set(-260, 210, -420);
    sun.lookAt(0, 0, 0);
    scene.add(sun);
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(44, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.28, fog: false })
    );
    halo.position.set(-262, 210, -422);
    halo.lookAt(0, 0, 0);
    scene.add(halo);
    // Drifting cloud puffs — flattened icosahedron clusters, bright against the dome.
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, fog: false });
    for (let i = 0; i < 11; i++) {
      const group = new THREE.Group();
      const puffs = 3 + Math.floor(SOL.rand() * 3);
      for (let p = 0; p < puffs; p++) {
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(3.5 + SOL.rand() * 3, 0), cloudMat);
        s.position.set((p - puffs / 2) * 5 + SOL.randRange(-2, 2), SOL.randRange(-1, 1.4), SOL.randRange(-2, 2));
        s.scale.y = 0.42;
        group.add(s);
      }
      group.position.set(SOL.randRange(-260, 260), SOL.randRange(72, 118), SOL.randRange(-260, 260));
      group.userData.drift = SOL.randRange(0.7, 1.8);
      scene.add(group);
      clouds.push(group);
    }
    // Gulls circling the marina — two crossed triangles each, flapping by rotation.
    const gullMat = new THREE.MeshBasicMaterial({ color: 0x222831, side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) {
      const gull = new THREE.Group();
      const wingGeo = new THREE.PlaneGeometry(1.6, 0.5);
      const wl = new THREE.Mesh(wingGeo, gullMat);
      wl.position.x = -0.8;
      const wr = new THREE.Mesh(wingGeo, gullMat);
      wr.position.x = 0.8;
      gull.add(wl);
      gull.add(wr);
      gull.userData = { wl: wl, wr: wr, r: 26 + SOL.rand() * 22, h: 34 + SOL.rand() * 14, a: SOL.rand() * Math.PI * 2, sp: 0.12 + SOL.rand() * 0.1 };
      scene.add(gull);
      gulls.push(gull);
    }
  }

  function buildSea() {
    seaTex = waveCanvas();
    bayTex = waveCanvas();
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 460),
      new THREE.MeshLambertMaterial({ map: seaTex, transparent: true, opacity: 0.95 })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(330, 0.06, 0);
    scene.add(sea);
    const bay = new THREE.Mesh(
      new THREE.PlaneGeometry(460, 240),
      new THREE.MeshLambertMaterial({ map: bayTex, transparent: true, opacity: 0.95 })
    );
    bay.rotation.x = -Math.PI / 2;
    bay.position.set(0, 0.06, 330);
    scene.add(bay);
    // Foam strip where the waves meet the sand.
    const foam = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 460),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(208, 0.07, 0);
    scene.add(foam);
    // Buoys bobbing in the bay.
    const buoyMat = new THREE.MeshLambertMaterial({ color: 0xff5a2e });
    for (let b = 0; b < 6; b++) {
      const buoy = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), buoyMat);
      buoy.position.set(-140 + b * 52, 0.4, 252 + (b % 2) * 22);
      buoy.userData.bob = b * 1.1;
      scene.add(buoy);
      gulls.push(buoy);
    }
  }

  function buildGroundDressing() {
    const tileTex = tileCanvas();
    const tileMat = new THREE.MeshLambertMaterial({ map: tileTex });
    const centers = [-80, 0, 80];
    for (const cx of centers) {
      for (const cz of centers) {
        if (cx === 0 && cz === 0) continue; // plaza keeps its grass
        const tile = new THREE.Mesh(new THREE.PlaneGeometry(66, 66), tileMat);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(cx, 0.03, cz);
        scene.add(tile);
      }
    }
    // Zebra crosswalks on all four approaches of every intersection.
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf2efe6 });
    const stripeGeo = new THREE.PlaneGeometry(1.1, 5.2);
    const grid = [-120, -40, 40, 120];
    for (const ax of grid) {
      for (const az of grid) {
        for (let s = -2; s <= 2; s++) {
          const n1 = new THREE.Mesh(stripeGeo, stripeMat);
          n1.rotation.x = -Math.PI / 2;
          n1.position.set(ax + s * 2.4, 0.05, az - 8.2);
          scene.add(n1);
          const n2 = new THREE.Mesh(stripeGeo, stripeMat);
          n2.rotation.x = -Math.PI / 2;
          n2.rotation.z = Math.PI / 2;
          n2.position.set(ax - 8.2, 0.05, az + s * 2.4);
          scene.add(n2);
        }
      }
    }
    // Boardwalk planks along the beach.
    const boardMat = new THREE.MeshLambertMaterial({ color: 0xa97c50 });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(10, 300), boardMat);
    board.rotation.x = -Math.PI / 2;
    board.position.set(166, 0.05, 0);
    scene.add(board);
    // Beach umbrellas + lifeguard tower.
    const umbMat = new THREE.MeshLambertMaterial({ color: 0xff5a7a });
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
    for (let u = 0; u < 5; u++) {
      const ux = 176;
      const uz = -110 + u * 55;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.4, 6), poleMat);
      pole.position.set(ux, 1.7, uz);
      scene.add(pole);
      const top = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.4, 8), umbMat);
      top.position.set(ux, 4.0, uz);
      scene.add(top);
    }
    const tower = new THREE.Group();
    const legs = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 3), new THREE.MeshLambertMaterial({ color: 0xe8e2d2 }));
    legs.position.y = 2.5;
    tower.add(legs);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, 3.6), new THREE.MeshLambertMaterial({ color: 0x2e8ab8 }));
    cabin.position.y = 6.1;
    tower.add(cabin);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3, 1.4, 4), new THREE.MeshLambertMaterial({ color: 0xc23b2e }));
    roof.position.y = 7.9;
    roof.rotation.y = Math.PI / 4;
    tower.add(roof);
    tower.position.set(172, 0, 60);
    scene.add(tower);
  }

  function buildFountain() {
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(6.4, 6.8, 1.1, 20),
      new THREE.MeshLambertMaterial({ color: 0xcfd6de })
    );
    basin.position.set(0, 0.55, 0);
    scene.add(basin);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(5.9, 20),
      new THREE.MeshLambertMaterial({ color: 0x2e8ab8, transparent: true, opacity: 0.9 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 1.05, 0);
    scene.add(water);
    fountainTop = water;
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 1.1, 3.4, 10),
      new THREE.MeshLambertMaterial({ color: 0xe8e2d2 })
    );
    column.position.set(0, 2.6, 0);
    scene.add(column);
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xffd23e })
    );
    crown.position.set(0, 4.8, 0);
    scene.add(crown);
    // Benches ringing the plaza.
    const benchMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
    for (let b = 0; b < 4; b++) {
      const ang = (b * Math.PI) / 2 + Math.PI / 4;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.5, 1.2), benchMat);
      bench.position.set(Math.cos(ang) * 12, 0.55, Math.sin(ang) * 12);
      bench.rotation.y = -ang + Math.PI / 2;
      scene.add(bench);
      const bleg1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 1.0), benchMat);
      bleg1.position.set(Math.cos(ang) * 12 - 1.7, 0.3, Math.sin(ang) * 12);
      scene.add(bleg1);
    }
  }

  function buildTrafficLights() {
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x24272e });
    const boxMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
    const grid = [-120, -40, 40, 120];
    for (const ax of grid) {
      for (const az of grid) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 6.4, 6), poleMat);
        pole.position.set(ax + 8.5, 3.2, az - 8.5);
        scene.add(pole);
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), boxMat);
        box.position.set(ax + 8.5, 6.6, az - 8.5);
        scene.add(box);
        const red = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), new THREE.MeshBasicMaterial({ color: 0x551111 }));
        red.position.set(ax + 8.5, 7.3, az - 8.0);
        scene.add(red);
        const green = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), new THREE.MeshBasicMaterial({ color: 0x11aa44 }));
        green.position.set(ax + 8.5, 6.0, az - 8.0);
        scene.add(green);
        lampReds.push(red);
        lampGreens.push(green);
      }
    }
  }

  function buildBillboards() {
    const ads = [
      { lines: ['SOLMARIS', 'SUN · SEA · YOUR MONEY'], bg: '#1c2f57', fg: '#ffd23e', ac: '#7dff9a', x: 62, z: -118, ry: 0 },
      { lines: ['VELA MOTORS', 'DRIVE THE NIGHT'], bg: '#3d0a2e', fg: '#ffffff', ac: '#ff5a7a', x: -118, z: 62, ry: Math.PI / 2 },
      { lines: ['CASINO DEL MAR', 'WIN BIG · LOSE BIGGER'], bg: '#0d5c46', fg: '#ffe066', ac: '#ffffff', x: -62, z: 118, ry: Math.PI },
      { lines: ['HARBOUR FISH CO', 'FRESH CATCH DAILY'], bg: '#123a5c', fg: '#a8d0e8', ac: '#ffd23e', x: 118, z: -62, ry: -Math.PI / 2 },
    ];
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
    for (const ad of ads) {
      const group = new THREE.Group();
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 9, 0.6), frameMat);
      legL.position.set(-6, 4.5, 0);
      group.add(legL);
      const legR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 9, 0.6), frameMat);
      legR.position.set(6, 4.5, 0);
      group.add(legR);
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(15, 5.6),
        new THREE.MeshBasicMaterial({ map: signCanvas(ad.lines, ad.bg, ad.fg, ad.ac) })
      );
      board.position.set(0, 11.5, 0);
      group.add(board);
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(15.4, 0.35),
        new THREE.MeshBasicMaterial({ color: 0xffd23e })
      );
      glow.position.set(0, 14.6, 0.05);
      group.add(glow);
      neonSigns.push(glow);
      group.position.set(ad.x, 0, ad.z);
      group.rotation.y = ad.ry;
      scene.add(group);
    }
    // Bus stop shelters on two avenues.
    const shelterMat = new THREE.MeshLambertMaterial({ color: 0x2e6b8a });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc3dd, transparent: true, opacity: 0.45 });
    for (const s of [{ x: 48, z: -40, ry: 0 }, { x: -48, z: 40, ry: Math.PI }]) {
      const sh = new THREE.Group();
      const roof = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 2), shelterMat);
      roof.position.y = 3;
      sh.add(roof);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.6), glassMat);
      back.position.set(0, 1.6, -0.9);
      sh.add(back);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.3, 0.8), new THREE.MeshLambertMaterial({ color: 0x6b4a2a }));
      seat.position.set(0, 0.9, -0.5);
      sh.add(seat);
      sh.position.set(s.x, 0, s.z);
      sh.rotation.y = s.ry;
      scene.add(sh);
    }
  }

  function buildSkyline() {
    // Hazy towers beyond the playable bound — the horizon is a city, not a void.
    // Each tower gets a window texture so it reads as a building, not a slab.
    const win = document.createElement('canvas');
    win.width = 64; win.height = 128;
    const wg = win.getContext('2d');
    wg.fillStyle = '#3d4a5c';
    wg.fillRect(0, 0, 64, 128);
    for (let y = 8; y < 120; y += 14) {
      for (let x = 6; x < 58; x += 12) {
        wg.fillStyle = SOL.rand() < 0.4 ? '#ffd98a' : '#141a24';
        wg.fillRect(x, y, 6, 8);
      }
    }
    const winTex = new THREE.CanvasTexture(win);
    const tones = [0x5a6b84, 0x6b5a7a, 0x4a6b7a, 0x7a6b4a];
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2 + SOL.randRange(-0.1, 0.1);
      const r = 255 + SOL.rand() * 110;
      const w = SOL.randRange(18, 30);
      const h = SOL.randRange(48, 130);
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, w),
        new THREE.MeshLambertMaterial({ map: winTex, color: tones[i % tones.length] })
      );
      tower.position.set(Math.cos(ang) * r, h / 2 - 4, Math.sin(ang) * r);
      scene.add(tower);
      if (h > 90) {
        const tip = new THREE.Mesh(
          new THREE.BoxGeometry(1.6, 1.6, 1.6),
          new THREE.MeshBasicMaterial({ color: 0xff4040 })
        );
        tip.position.set(Math.cos(ang) * r, h - 3, Math.sin(ang) * r);
        scene.add(tip);
      }
    }
  }

  function buildHarbor() {
    // A dock crane: two legs, a jib, a hanging hook block. Centred near
    // the mission marker so it reads in the mission screenshot.
    const steel = new THREE.MeshLambertMaterial({ color: 0xd8a020 });
    const legA = new THREE.Mesh(new THREE.BoxGeometry(2.2, 22, 2.2), steel);
    legA.position.set(-30, 11, 172);
    scene.add(legA);
    const legB = new THREE.Mesh(new THREE.BoxGeometry(2.2, 22, 2.2), steel);
    legB.position.set(-18, 11, 172);
    scene.add(legB);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(26, 1.6, 1.6), steel);
    jib.position.set(-12, 21, 172);
    scene.add(jib);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 9, 4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    cable.position.set(-10, 16.5, 172);
    scene.add(cable);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    hook.position.set(-10, 11.5, 172);
    scene.add(hook);
    // Stacked containers, two high, beside the dock.
    const contColors = [0xb3541e, 0x2e6b8a, 0x7a9e2e, 0x8a2e5c];
    for (let k = 0; k < 6; k++) {
      const kx = 60 + (k % 3) * 14;
      const kz = 176 + Math.floor(k / 3) * 8;
      const cont = new THREE.Mesh(
        new THREE.BoxGeometry(12, 3, 3),
        new THREE.MeshLambertMaterial({ color: contColors[k % 4] })
      );
      cont.position.set(kx, 1.5, kz);
      scene.add(cont);
      if (k % 2 === 0) {
        const top = new THREE.Mesh(
          new THREE.BoxGeometry(12, 3, 3),
          new THREE.MeshLambertMaterial({ color: contColors[(k + 2) % 4] })
        );
        top.position.set(kx, 4.5, kz);
        scene.add(top);
      }
    }
    // A moored yacht off the marina, white hull + cabin.
    const hull = new THREE.Mesh(new THREE.BoxGeometry(10, 2.2, 3.4), new THREE.MeshLambertMaterial({ color: 0xf2f2ee }));
    hull.position.set(150, 0.4, -60);
    hull.rotation.y = 0.5;
    scene.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 2.6), new THREE.MeshLambertMaterial({ color: 0x2e6b8a }));
    cabin.position.set(150, 2.2, -60);
    cabin.rotation.y = 0.5;
    scene.add(cabin);
    // Second crane on the east end of the dock, and dock clutter — crates,
    // barrels and pallets — so the dock apron is never a blank slab.
    const legC = new THREE.Mesh(new THREE.BoxGeometry(2.4, 22, 2.4), steel);
    legC.position.set(96, 11, 172);
    scene.add(legC);
    const legD = new THREE.Mesh(new THREE.BoxGeometry(2.4, 22, 2.4), steel);
    legD.position.set(108, 11, 172);
    scene.add(legD);
    const jib2 = new THREE.Mesh(new THREE.BoxGeometry(26, 1.6, 1.6), steel);
    jib2.position.set(114, 21, 172);
    scene.add(jib2);
    const crateMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
    const barrelMat = new THREE.MeshLambertMaterial({ color: 0x2e6b8a });
    for (let k = 0; k < 10; k++) {
      const cx = -110 + k * 24 + SOL.randRange(-4, 4);
      const cz = 158 + (k % 3) * 7;
      if (k % 2 === 0) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 3.2), crateMat);
        crate.position.set(cx, 1.6, cz);
        crate.rotation.y = SOL.rand() * 0.6;
        scene.add(crate);
      } else {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.6, 10), barrelMat);
        barrel.position.set(cx, 1.3, cz);
        scene.add(barrel);
      }
    }
    // Near-foreground clutter for the mission shot: crates and a barrel
    // flanking the dock approach, so the camera-near ground is dressed.
    const nearCrate1 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 3.2), crateMat);
    nearCrate1.position.set(-14, 1.6, 152);
    nearCrate1.rotation.y = 0.4;
    scene.add(nearCrate1);
    const nearCrate2 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 3.2), crateMat);
    nearCrate2.position.set(16, 1.6, 154);
    nearCrate2.rotation.y = -0.3;
    scene.add(nearCrate2);
    const nearBarrel = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.6, 10), barrelMat);
    nearBarrel.position.set(26, 1.3, 150);
    scene.add(nearBarrel);
    // Stained concrete overlay on the dock apron, darker than the bare plane.
    const dockTex = document.createElement('canvas');
    dockTex.width = 128; dockTex.height = 128;
    const dg = dockTex.getContext('2d');
    dg.fillStyle = '#4a505a';
    dg.fillRect(0, 0, 128, 128);
    dg.fillStyle = '#3f444d';
    for (let i = 0; i < 130; i++) dg.fillRect(SOL.rand() * 128, SOL.rand() * 128, 3, 3);
    dg.strokeStyle = '#383d45';
    dg.lineWidth = 2;
    for (let k = 0; k <= 4; k++) {
      dg.beginPath(); dg.moveTo(k * 32, 0); dg.lineTo(k * 32, 128); dg.stroke();
    }
    const dockMat = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(dockTex) });
    dockMat.map.wrapS = THREE.RepeatWrapping;
    dockMat.map.wrapT = THREE.RepeatWrapping;
    dockMat.map.repeat.set(8, 2);
    const dockTop = new THREE.Mesh(new THREE.PlaneGeometry(360, 70), dockMat);
    dockTop.rotation.x = -Math.PI / 2;
    dockTop.position.set(0, 0.045, 171);
    scene.add(dockTop);
  }

  W.init = function (sc) {
    scene = sc;
    buildSky();
    buildSea();
    buildGroundDressing();
    buildFountain();
    buildTrafficLights();
    buildBillboards();
    buildSkyline();
    buildHarbor();
  };

  W.update = function (dt, t) {
    if (!scene) return;
    for (const c of clouds) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 290) c.position.x = -290;
    }
    if (seaTex) seaTex.offset.x = (t * 0.008) % 1;
    if (bayTex) bayTex.offset.y = (t * 0.006) % 1;
    if (fountainTop) fountainTop.rotation.z += dt * 0.25;
    const phase = Math.floor(t / 6) % 2 === 0;
    for (let i = 0; i < lampReds.length; i++) {
      lampReds[i].material.color.setHex(phase ? 0xff2a1a : 0x551111);
      lampGreens[i].material.color.setHex(phase ? 0x0d5c26 : 0x2aff66);
    }
    const pulse = 0.75 + Math.sin(t * 2.4) * 0.25;
    for (const n of neonSigns) n.material.color.setHex(pulse > 0.9 ? 0xffe066 : 0xffd23e);
    for (const g of gulls) {
      if (!g.userData.r) continue; // buoys share the list; they bob instead
      const u = g.userData;
      u.a += u.sp * dt;
      g.position.set(Math.cos(u.a) * u.r + 120, u.h + Math.sin(t * 0.8 + u.a) * 2, Math.sin(u.a) * u.r - 40);
      g.rotation.y = -u.a;
      const flap = Math.sin(t * 6 + u.a * 3) * 0.5;
      u.wl.rotation.z = flap;
      u.wr.rotation.z = -flap;
    }
    for (const g of gulls) {
      if (!g.userData.bob && g.userData.bob !== 0) continue;
      g.position.y = 0.4 + Math.sin(t * 1.4 + g.userData.bob) * 0.25;
    }
  };

  SOL.world = W;
})();
