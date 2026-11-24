// SOLMARIS v6 — world.js: the atmosphere and street-dressing layer.
// The base city reads empty in screenshots: a flat grey ground plane, a
// flat blue sky, bare intersections and a bare dock. This module fills it
// in — gradient sky dome with sun and drifting clouds, an animated sea,
// pavement tiles and crosswalks so the ground is never a blank slab,
// traffic lights, billboards, bus stops, benches, a plaza fountain, a
// distant skyline on the horizon, and a dressed harbor with a crane,
// stacked containers and buoys. Everything is built from primitives and
// canvas textures generated in code: zero network requests, and placement
// uses the seeded SOL.rand so staged screenshots are reproducible.
(function () {
  var W = {};
  var scene = null;
  var clouds = [];
  var seaTex = null;
  var bayTex = null;
  var fountainWater = null;
  var lampReds = [];
  var lampGreens = [];
  var neonStrips = [];
  var gulls = [];

  // Small primitive factory so the builders below read as a parts list.
  function prim(kind, geo, mat) {
    var m = new THREE.Mesh(geo, mat);
    m.userData.kind = kind;
    return m;
  }

  function boxAt(w, h, d, color, x, y, z) {
    var m = prim('box', new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: color }));
    m.position.set(x, y, z);
    return m;
  }

  function flatAt(w, d, mat, x, y, z) {
    var m = prim('flat', new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    return m;
  }

  function paintCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return { canvas: c, g: c.getContext('2d') };
  }

  function skyTexture() {
    var t = paintCanvas(16, 256);
    var grad = t.g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#2a6cb0');
    grad.addColorStop(0.45, '#6faed6');
    grad.addColorStop(0.72, '#a8d0e8');
    grad.addColorStop(0.88, '#ffd9a0');
    grad.addColorStop(1.0, '#ffbe78');
    t.g.fillStyle = grad;
    t.g.fillRect(0, 0, 16, 256);
    return new THREE.CanvasTexture(t.canvas);
  }

  function pavementTexture() {
    var t = paintCanvas(128, 128);
    t.g.fillStyle = '#565c66';
    t.g.fillRect(0, 0, 128, 128);
    t.g.fillStyle = '#474c55';
    for (var i = 0; i < 110; i++) {
      t.g.fillRect(SOL.rand() * 128, SOL.rand() * 128, 2, 2);
    }
    t.g.strokeStyle = '#3f444d';
    t.g.lineWidth = 2;
    for (var k = 0; k <= 4; k++) {
      t.g.beginPath();
      t.g.moveTo(k * 32, 0);
      t.g.lineTo(k * 32, 128);
      t.g.stroke();
      t.g.beginPath();
      t.g.moveTo(0, k * 32);
      t.g.lineTo(128, k * 32);
      t.g.stroke();
    }
    t.g.strokeStyle = '#6e747e';
    t.g.lineWidth = 3;
    t.g.strokeRect(2, 2, 124, 124);
    var tex = new THREE.CanvasTexture(t.canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    return tex;
  }

  function waveTexture() {
    var t = paintCanvas(256, 256);
    t.g.fillStyle = '#1e6f8e';
    t.g.fillRect(0, 0, 256, 256);
    t.g.strokeStyle = 'rgba(255,255,255,0.28)';
    t.g.lineWidth = 3;
    for (var r = 0; r < 9; r++) {
      t.g.beginPath();
      var y = 14 + r * 28;
      for (var x = 0; x <= 256; x += 16) {
        var yy = y + Math.sin(x * 0.05 + r * 1.7) * 5;
        if (x === 0) t.g.moveTo(x, yy);
        else t.g.lineTo(x, yy);
      }
      t.g.stroke();
    }
    t.g.fillStyle = 'rgba(255,255,255,0.10)';
    for (var j = 0; j < 40; j++) {
      t.g.fillRect(SOL.rand() * 256, SOL.rand() * 256, 3, 2);
    }
    var tex = new THREE.CanvasTexture(t.canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    return tex;
  }

  function signTexture(lines, bg, fg, accent) {
    var t = paintCanvas(512, 192);
    t.g.fillStyle = bg;
    t.g.fillRect(0, 0, 512, 192);
    t.g.strokeStyle = accent;
    t.g.lineWidth = 10;
    t.g.strokeRect(6, 6, 500, 180);
    t.g.fillStyle = fg;
    t.g.textAlign = 'center';
    t.g.textBaseline = 'middle';
    t.g.font = '900 64px Verdana, sans-serif';
    t.g.fillText(lines[0], 256, lines.length > 1 ? 72 : 96);
    if (lines.length > 1) {
      t.g.font = '700 34px Verdana, sans-serif';
      t.g.fillStyle = accent;
      t.g.fillText(lines[1], 256, 140);
    }
    return new THREE.CanvasTexture(t.canvas);
  }

  function buildSky() {
    var dome = prim('dome', new THREE.SphereGeometry(720, 20, 14),
      new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }));
    scene.add(dome);
    var sunDisc = prim('sun', new THREE.CircleGeometry(26, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }));
    sunDisc.position.set(-260, 210, -420);
    sunDisc.lookAt(0, 0, 0);
    scene.add(sunDisc);
    var halo = prim('halo', new THREE.CircleGeometry(44, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.28, fog: false }));
    halo.position.set(-262, 210, -422);
    halo.lookAt(0, 0, 0);
    scene.add(halo);
    // Drifting cloud puffs — flattened icosahedron clusters, bright against the dome.
    var cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, fog: false });
    for (var i = 0; i < 11; i++) {
      var group = new THREE.Group();
      var puffs = 3 + Math.floor(SOL.rand() * 3);
      for (var p = 0; p < puffs; p++) {
        var s = prim('puff', new THREE.IcosahedronGeometry(3.5 + SOL.rand() * 3, 0), cloudMat);
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
    var gullMat = new THREE.MeshBasicMaterial({ color: 0x222831, side: THREE.DoubleSide });
    for (var j = 0; j < 6; j++) {
      var gull = new THREE.Group();
      var wingGeo = new THREE.PlaneGeometry(1.6, 0.5);
      var wl = new THREE.Mesh(wingGeo, gullMat);
      wl.position.x = -0.8;
      var wr = new THREE.Mesh(wingGeo, gullMat);
      wr.position.x = 0.8;
      gull.add(wl);
      gull.add(wr);
      gull.userData = {
        wl: wl,
        wr: wr,
        r: 26 + SOL.rand() * 22,
        h: 34 + SOL.rand() * 14,
        a: SOL.rand() * Math.PI * 2,
        sp: 0.12 + SOL.rand() * 0.1,
      };
      scene.add(gull);
      gulls.push(gull);
    }
  }

  function buildSea() {
    seaTex = waveTexture();
    bayTex = waveTexture();
    var sea = flatAt(240, 460,
      new THREE.MeshLambertMaterial({ map: seaTex, transparent: true, opacity: 0.95 }), 330, 0.06, 0);
    scene.add(sea);
    var bay = flatAt(460, 240,
      new THREE.MeshLambertMaterial({ map: bayTex, transparent: true, opacity: 0.95 }), 0, 0.06, 330);
    scene.add(bay);
    // Foam strip where the waves meet the sand.
    scene.add(flatAt(3, 460,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }), 208, 0.07, 0));
    // Buoys bobbing in the bay.
    var buoyMat = new THREE.MeshLambertMaterial({ color: 0xff5a2e });
    for (var b = 0; b < 6; b++) {
      var buoy = prim('buoy', new THREE.SphereGeometry(1.1, 8, 6), buoyMat);
      buoy.position.set(-140 + b * 52, 0.4, 252 + (b % 2) * 22);
      buoy.userData.bob = b * 1.1;
      scene.add(buoy);
      gulls.push(buoy);
    }
  }

  function buildGroundDressing() {
    var tileMat = new THREE.MeshLambertMaterial({ map: pavementTexture() });
    var centers = [-80, 0, 80];
    for (var i = 0; i < centers.length; i++) {
      for (var j = 0; j < centers.length; j++) {
        var cx = centers[i];
        var cz = centers[j];
        if (cx === 0 && cz === 0) continue; // plaza keeps its grass
        scene.add(flatAt(66, 66, tileMat, cx, 0.03, cz));
      }
    }
    // Zebra crosswalks on all four approaches of every intersection.
    var stripeMat = new THREE.MeshBasicMaterial({ color: 0xf2efe6 });
    var stripeGeo = new THREE.PlaneGeometry(1.1, 5.2);
    var grid = [-120, -40, 40, 120];
    for (var a = 0; a < grid.length; a++) {
      for (var c = 0; c < grid.length; c++) {
        for (var s = -2; s <= 2; s++) {
          var n1 = new THREE.Mesh(stripeGeo, stripeMat);
          n1.rotation.x = -Math.PI / 2;
          n1.position.set(grid[a] + s * 2.4, 0.05, grid[c] - 8.2);
          scene.add(n1);
          var n2 = new THREE.Mesh(stripeGeo, stripeMat);
          n2.rotation.x = -Math.PI / 2;
          n2.rotation.z = Math.PI / 2;
          n2.position.set(grid[a] - 8.2, 0.05, grid[c] + s * 2.4);
          scene.add(n2);
        }
      }
    }
    // Boardwalk planks along the beach.
    scene.add(flatAt(10, 300, new THREE.MeshLambertMaterial({ color: 0xa97c50 }), 166, 0.05, 0));
    // Beach umbrellas + lifeguard tower.
    var umbMat = new THREE.MeshLambertMaterial({ color: 0xff5a7a });
    var poleMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
    for (var u = 0; u < 5; u++) {
      var ux = 176;
      var uz = -110 + u * 55;
      var pole = prim('pole', new THREE.CylinderGeometry(0.12, 0.12, 3.4, 6), poleMat);
      pole.position.set(ux, 1.7, uz);
      scene.add(pole);
      var top = prim('umbrella', new THREE.ConeGeometry(2.6, 1.4, 8), umbMat);
      top.position.set(ux, 4.0, uz);
      scene.add(top);
    }
    var tower = new THREE.Group();
    var legs = boxAt(3, 5, 3, 0xe8e2d2, 0, 2.5, 0);
    tower.add(legs);
    var cabin = boxAt(3.6, 2.2, 3.6, 0x2e8ab8, 0, 6.1, 0);
    tower.add(cabin);
    var roof = prim('roof', new THREE.ConeGeometry(3, 1.4, 4), new THREE.MeshLambertMaterial({ color: 0xc23b2e }));
    roof.position.y = 7.9;
    roof.rotation.y = Math.PI / 4;
    tower.add(roof);
    tower.position.set(172, 0, 60);
    scene.add(tower);
  }

  function buildFountain() {
    var basin = prim('basin', new THREE.CylinderGeometry(6.4, 6.8, 1.1, 20),
      new THREE.MeshLambertMaterial({ color: 0xcfd6de }));
    basin.position.set(0, 0.55, 0);
    scene.add(basin);
    var water = prim('fountain-water', new THREE.CircleGeometry(5.9, 20),
      new THREE.MeshLambertMaterial({ color: 0x2e8ab8, transparent: true, opacity: 0.9 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 1.05, 0);
    scene.add(water);
    fountainWater = water;
    // One tapered cylinder column — no inner box; a box the same size
    // would sit entirely inside the cylinder and render nothing.
    var column = prim('column', new THREE.CylinderGeometry(0.7, 1.1, 3.4, 10),
      new THREE.MeshLambertMaterial({ color: 0xe8e2d2 }));
    column.position.set(0, 2.6, 0);
    scene.add(column);
    var crown = prim('crown', new THREE.SphereGeometry(1.1, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xffd23e }));
    crown.position.set(0, 4.8, 0);
    scene.add(crown);
    // Benches ringing the plaza.
    var benchMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
    for (var b = 0; b < 4; b++) {
      var ang = (b * Math.PI) / 2 + Math.PI / 4;
      var bench = prim('bench', new THREE.BoxGeometry(4.4, 0.5, 1.2), benchMat);
      bench.position.set(Math.cos(ang) * 12, 0.55, Math.sin(ang) * 12);
      bench.rotation.y = -ang + Math.PI / 2;
      scene.add(bench);
      var bleg = prim('bench-leg', new THREE.BoxGeometry(0.4, 0.6, 1.0), benchMat);
      bleg.position.set(Math.cos(ang) * 12 - 1.7, 0.3, Math.sin(ang) * 12);
      scene.add(bleg);
    }
  }

  function buildTrafficLights() {
    var poleMat = new THREE.MeshLambertMaterial({ color: 0x24272e });
    var boxMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
    var grid = [-120, -40, 40, 120];
    for (var a = 0; a < grid.length; a++) {
      for (var c = 0; c < grid.length; c++) {
        var ax = grid[a];
        var az = grid[c];
        var pole = prim('pole', new THREE.CylinderGeometry(0.16, 0.2, 6.4, 6), poleMat);
        pole.position.set(ax + 8.5, 3.2, az - 8.5);
        scene.add(pole);
        var box = prim('lightbox', new THREE.BoxGeometry(0.9, 2.4, 0.9), boxMat);
        box.position.set(ax + 8.5, 6.6, az - 8.5);
        scene.add(box);
        var red = prim('red', new THREE.SphereGeometry(0.32, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0x551111 }));
        red.position.set(ax + 8.5, 7.3, az - 8.0);
        scene.add(red);
        var green = prim('green', new THREE.SphereGeometry(0.32, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0x11aa44 }));
        green.position.set(ax + 8.5, 6.0, az - 8.0);
        scene.add(green);
        lampReds.push(red);
        lampGreens.push(green);
      }
    }
  }

  function buildBillboards() {
    var ads = [
      { lines: ['SOLMARIS', 'SUN · SEA · YOUR MONEY'], bg: '#1c2f57', fg: '#ffd23e', ac: '#7dff9a', x: 62, z: -118, ry: 0 },
      { lines: ['VELA MOTORS', 'DRIVE THE NIGHT'], bg: '#3d0a2e', fg: '#ffffff', ac: '#ff5a7a', x: -118, z: 62, ry: Math.PI / 2 },
      { lines: ['CASINO DEL MAR', 'WIN BIG · LOSE BIGGER'], bg: '#0d5c46', fg: '#ffe066', ac: '#ffffff', x: -62, z: 118, ry: Math.PI },
      { lines: ['HARBOUR FISH CO', 'FRESH CATCH DAILY'], bg: '#123a5c', fg: '#a8d0e8', ac: '#ffd23e', x: 118, z: -62, ry: -Math.PI / 2 },
    ];
    var frameMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
    for (var i = 0; i < ads.length; i++) {
      var ad = ads[i];
      var group = new THREE.Group();
      var legL = boxAt(0.6, 9, 0.6, 0x2c2f36, -6, 4.5, 0);
      group.add(legL);
      var legR = boxAt(0.6, 9, 0.6, 0x2c2f36, 6, 4.5, 0);
      group.add(legR);
      var board = prim('board', new THREE.PlaneGeometry(15, 5.6),
        new THREE.MeshBasicMaterial({ map: signTexture(ad.lines, ad.bg, ad.fg, ad.ac) }));
      board.position.set(0, 11.5, 0);
      group.add(board);
      var glow = prim('glow', new THREE.PlaneGeometry(15.4, 0.35),
        new THREE.MeshBasicMaterial({ color: 0xffd23e }));
      glow.position.set(0, 14.6, 0.05);
      group.add(glow);
      neonStrips.push(glow);
      group.position.set(ad.x, 0, ad.z);
      group.rotation.y = ad.ry;
      scene.add(group);
    }
    // Bus stop shelters on two avenues.
    var shelterMat = new THREE.MeshLambertMaterial({ color: 0x2e6b8a });
    var glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc3dd, transparent: true, opacity: 0.45 });
    var stops = [{ x: 48, z: -40, ry: 0 }, { x: -48, z: 40, ry: Math.PI }];
    for (var s = 0; s < stops.length; s++) {
      var sh = new THREE.Group();
      var roof = boxAt(5, 0.3, 2, 0x2e6b8a, 0, 3, 0);
      sh.add(roof);
      var back = prim('glass', new THREE.PlaneGeometry(5, 2.6), glassMat);
      back.position.set(0, 1.6, -0.9);
      sh.add(back);
      var seat = boxAt(4.4, 0.3, 0.8, 0x6b4a2a, 0, 0.9, -0.5);
      sh.add(seat);
      sh.position.set(stops[s].x, 0, stops[s].z);
      sh.rotation.y = stops[s].ry;
      scene.add(sh);
    }
  }

  function buildSkyline() {
    // Hazy towers beyond the playable bound — the horizon is a city, not a void.
    // Each tower gets a window texture so it reads as a building, not a slab.
    var t = paintCanvas(64, 128);
    t.g.fillStyle = '#3d4a5c';
    t.g.fillRect(0, 0, 64, 128);
    for (var y = 8; y < 120; y += 14) {
      for (var x = 6; x < 58; x += 12) {
        t.g.fillStyle = SOL.rand() < 0.4 ? '#ffd98a' : '#141a24';
        t.g.fillRect(x, y, 6, 8);
      }
    }
    var winTex = new THREE.CanvasTexture(t.canvas);
    var tones = [0x5a6b84, 0x6b5a7a, 0x4a6b7a, 0x7a6b4a];
    for (var i = 0; i < 18; i++) {
      var ang = (i / 18) * Math.PI * 2 + SOL.randRange(-0.1, 0.1);
      var r = 255 + SOL.rand() * 110;
      var w = SOL.randRange(18, 30);
      var h = SOL.randRange(48, 130);
      var tower = prim('tower', new THREE.BoxGeometry(w, h, w),
        new THREE.MeshLambertMaterial({ map: winTex, color: tones[i % tones.length] }));
      tower.position.set(Math.cos(ang) * r, h / 2 - 4, Math.sin(ang) * r);
      scene.add(tower);
      if (h > 90) {
        var tip = prim('tip', new THREE.BoxGeometry(1.6, 1.6, 1.6),
          new THREE.MeshBasicMaterial({ color: 0xff4040 }));
        tip.position.set(Math.cos(ang) * r, h - 3, Math.sin(ang) * r);
        scene.add(tip);
      }
    }
  }

  function buildHarbor() {
    // A dock crane: two legs, a jib, a hanging hook block. Centred near
    // the mission marker so it reads in the mission screenshot.
    var steel = new THREE.MeshLambertMaterial({ color: 0xd8a020 });
    scene.add(boxAt(2.2, 22, 2.2, 0xd8a020, -30, 11, 172));
    scene.add(boxAt(2.2, 22, 2.2, 0xd8a020, -18, 11, 172));
    scene.add(boxAt(26, 1.6, 1.6, 0xd8a020, -12, 21, 172));
    var cable = prim('cable', new THREE.CylinderGeometry(0.09, 0.09, 9, 4),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    cable.position.set(-10, 16.5, 172);
    scene.add(cable);
    scene.add(boxAt(2.2, 2.2, 2.2, 0x333333, -10, 11.5, 172));
    // Stacked containers, two high, beside the dock.
    var contColors = [0xb3541e, 0x2e6b8a, 0x7a9e2e, 0x8a2e5c];
    for (var k = 0; k < 6; k++) {
      var kx = 60 + (k % 3) * 14;
      var kz = 176 + Math.floor(k / 3) * 8;
      scene.add(boxAt(12, 3, 3, contColors[k % 4], kx, 1.5, kz));
      if (k % 2 === 0) {
        scene.add(boxAt(12, 3, 3, contColors[(k + 2) % 4], kx, 4.5, kz));
      }
    }
    // A moored yacht off the marina, white hull + cabin.
    var hull = boxAt(10, 2.2, 3.4, 0xf2f2ee, 150, 0.4, -60);
    hull.rotation.y = 0.5;
    scene.add(hull);
    var cabin = boxAt(5, 2, 2.6, 0x2e6b8a, 150, 2.2, -60);
    cabin.rotation.y = 0.5;
    scene.add(cabin);
    // Second crane on the east end of the dock, and dock clutter — crates,
    // barrels and pallets — so the dock apron is never a blank slab.
    scene.add(boxAt(2.4, 22, 2.4, 0xd8a020, 96, 11, 172));
    scene.add(boxAt(2.4, 22, 2.4, 0xd8a020, 108, 11, 172));
    scene.add(boxAt(26, 1.6, 1.6, 0xd8a020, 114, 21, 172));
    var crateMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
    var barrelMat = new THREE.MeshLambertMaterial({ color: 0x2e6b8a });
    for (var j = 0; j < 10; j++) {
      var cx = -110 + j * 24 + SOL.randRange(-4, 4);
      var cz = 158 + (j % 3) * 7;
      if (j % 2 === 0) {
        var crate = prim('crate', new THREE.BoxGeometry(3.2, 3.2, 3.2), crateMat);
        crate.position.set(cx, 1.6, cz);
        crate.rotation.y = SOL.rand() * 0.6;
        scene.add(crate);
      } else {
        var barrel = prim('barrel', new THREE.CylinderGeometry(1.1, 1.1, 2.6, 10), barrelMat);
        barrel.position.set(cx, 1.3, cz);
        scene.add(barrel);
      }
    }
    // Near-foreground clutter for the mission shot: crates and a barrel
    // flanking the dock approach, so the camera-near ground is dressed.
    var nearCrate1 = prim('crate', new THREE.BoxGeometry(3.2, 3.2, 3.2), crateMat);
    nearCrate1.position.set(-14, 1.6, 152);
    nearCrate1.rotation.y = 0.4;
    scene.add(nearCrate1);
    var nearCrate2 = prim('crate', new THREE.BoxGeometry(3.2, 3.2, 3.2), crateMat);
    nearCrate2.position.set(16, 1.6, 154);
    nearCrate2.rotation.y = -0.3;
    scene.add(nearCrate2);
    var nearBarrel = prim('barrel', new THREE.CylinderGeometry(1.1, 1.1, 2.6, 10), barrelMat);
    nearBarrel.position.set(26, 1.3, 150);
    scene.add(nearBarrel);
    // Stained concrete overlay on the dock apron, darker than the bare plane.
    var d = paintCanvas(128, 128);
    d.g.fillStyle = '#4a505a';
    d.g.fillRect(0, 0, 128, 128);
    d.g.fillStyle = '#3f444d';
    for (var i = 0; i < 130; i++) {
      d.g.fillRect(SOL.rand() * 128, SOL.rand() * 128, 3, 3);
    }
    d.g.strokeStyle = '#383d45';
    d.g.lineWidth = 2;
    for (var k2 = 0; k2 <= 4; k2++) {
      d.g.beginPath();
      d.g.moveTo(k2 * 32, 0);
      d.g.lineTo(k2 * 32, 128);
      d.g.stroke();
    }
    var dockTex = new THREE.CanvasTexture(d.canvas);
    dockTex.wrapS = THREE.RepeatWrapping;
    dockTex.wrapT = THREE.RepeatWrapping;
    dockTex.repeat.set(8, 2);
    scene.add(flatAt(360, 70, new THREE.MeshLambertMaterial({ map: dockTex }), 0, 0.045, 171));
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
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 290) c.position.x = -290;
    }
    if (seaTex) seaTex.offset.x = (t * 0.008) % 1;
    if (bayTex) bayTex.offset.y = (t * 0.006) % 1;
    if (fountainWater) fountainWater.rotation.z += dt * 0.25;
    var greenPhase = Math.floor(t / 6) % 2 === 0;
    for (var j = 0; j < lampReds.length; j++) {
      lampReds[j].material.color.setHex(greenPhase ? 0xff2a1a : 0x551111);
      lampGreens[j].material.color.setHex(greenPhase ? 0x0d5c26 : 0x2aff66);
    }
    var pulse = 0.75 + Math.sin(t * 2.4) * 0.25;
    for (var k = 0; k < neonStrips.length; k++) {
      neonStrips[k].material.color.setHex(pulse > 0.9 ? 0xffe066 : 0xffd23e);
    }
    for (var m = 0; m < gulls.length; m++) {
      var g = gulls[m];
      if (!g.userData.r) continue; // buoys share the list; they bob instead
      var u = g.userData;
      u.a += u.sp * dt;
      g.position.set(Math.cos(u.a) * u.r + 120, u.h + Math.sin(t * 0.8 + u.a) * 2, Math.sin(u.a) * u.r - 40);
      g.rotation.y = -u.a;
      var flap = Math.sin(t * 6 + u.a * 3) * 0.5;
      u.wl.rotation.z = flap;
      u.wr.rotation.z = -flap;
    }
    for (var n = 0; n < gulls.length; n++) {
      var buoy = gulls[n];
      if (buoy.userData.bob == null) continue;
      buoy.position.y = 0.4 + Math.sin(t * 1.4 + buoy.userData.bob) * 0.25;
    }
  };

  SOL.world = W;
})();
