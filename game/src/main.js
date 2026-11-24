// SOLMARIS v5 — main.js: boot, game loop, third-person camera, menus, save,
// and the ?shot= staging for screenshots. v5 adds the world dressing layer
// (sky, sea, street props, skyline, harbor) and the activities layer
// (stashes, fares, street race, finale job), and re-stages every shot so
// the frame is full of city instead of empty ground.
(function () {
  let renderer = null;
  let scene = null;
  let camera = null;
  let clock = null;
  const parkedCars = [];
  let missionCar = null;
  const camPos = new THREE.Vector3(0, 8, 46);
  const camTarget = new THREE.Vector3(0, 2, 0);
  let saveIn = 0;
  let regenIn = 0;
  let lastHealth = 100;
  let shotMode = null;
  let firstFrame = true;

  const G = {
    mode: 'menu',
    time: 0,
    cash: 0,
    health: 100,
    wanted: 0,
    kills: 0,
    nextMission: 0,
    completed: [],
    bestWanted: 0,
    playTimeSec: 0,
    player: null,
    city: null,
    camera: null,
    scene: null,
    saveData: function () {
      return {
        cash: this.cash, mission: this.nextMission, done: this.completed.slice(),
        bestStars: this.bestWanted, takedowns: this.kills, secondsPlayed: this.playTimeSec,
      };
    },
  };
  SOL.G = G;

  function $(id) { return document.getElementById(id); }

  function applySave(data) {
    if (!data) return;
    G.cash = data.cash;
    G.nextMission = data.mission;
    G.completed = data.done.slice();
    G.bestWanted = data.bestStars;
    G.kills = data.takedowns;
    G.playTimeSec = data.secondsPlayed;
  }

  function buildWorld() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87b5d6);
    scene.fog = new THREE.Fog(0x9fc3dd, 120, 420);
    G.scene = scene;
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    G.camera = camera;
    camera.position.copy(camPos);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = false;
    $('app').appendChild(renderer.domElement);

    // Golden-hour sun + sky fill.
    const sun = new THREE.DirectionalLight(0xffe0b0, 1.35);
    sun.position.set(120, 180, 60);
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a6f4d, 0.75));

    SOL.city.build(scene);
    G.city = SOL.city;
    SOL.effects.init(scene);
    SOL.audio.init();
    SOL.controls.init(renderer.domElement);
    SOL.player.init(scene, SOL.city, SOL.vehicles);
    G.player = SOL.player;
    SOL.traffic.init(scene, SOL.city, SOL.vehicles);
    SOL.pedestrians.init(scene, SOL.city);
    SOL.police.init(scene, SOL.city, SOL.vehicles, SOL.effects);
    SOL.combat.init(scene, SOL.city, SOL.effects, SOL.police);
    SOL.hud.init();
    SOL.minimap.init($('minimap'));
    SOL.missions.init(scene, SOL.city, G);
    SOL.world.init(scene);
    SOL.activities.init(scene, G);

    // Parked stealable cars around the city — including the mission coupe.
    const spots = [
      { x: 52, z: -52, kind: 1, color: 0xc23b2e, mission: true },
      { x: -24, z: 34, kind: 3, color: 0x3a6ea8 },
      { x: 92, z: -24, kind: 0, color: 0x7a2ec2 },
      { x: -82, z: 92, kind: 4, color: 0x2e7d4f },
      { x: 34, z: -92, kind: 5, color: 0xd8d8d8 },
      { x: -58, z: -34, kind: 2, color: 0xe8b90c },
    ];
    for (const s of spots) {
      const road = SOL.city.nearestRoad(s.x, s.z);
      let px = s.x;
      let pz = s.z;
      if (road) {
        if (road.axis === 'x') pz = road.at + 9.5;
        else px = road.at + 9.5;
      }
      const car = SOL.vehicles.makeCar(s.kind, s.color, px, pz, SOL.rand() * Math.PI * 2);
      car.driver = 'parked';
      scene.add(car.group);
      parkedCars.push(car);
      if (s.mission) missionCar = car;
    }
    SOL.missions.setTargetCar(missionCar);

    SOL.player.spawn(SOL.city.spots.start.x, SOL.city.spots.start.z, Math.PI);
    SOL.hud.objective("Start the engine — press START, then follow Lena's jobs");
    window.addEventListener('resize', function () {
      if (!camera || !renderer) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function updateCamera(dt) {
    const p = SOL.player;
    const target = new THREE.Vector3(p.pos.x, p.pos.y + 1.6, p.pos.z);
    const dist = p.car ? 13.5 + Math.abs(p.car.speed) * 0.12 : 9.5;
    const height = p.car ? 5.2 : 4.4;
    const yaw = p.getCamYaw();
    const desired = new THREE.Vector3(
      target.x - Math.sin(yaw) * dist,
      target.y + height,
      target.z - Math.cos(yaw) * dist
    );
    // Keep the camera out of buildings: lift it if the line is blocked.
    const probe = { x: desired.x, z: desired.z };
    const bx = probe.x;
    const bz = probe.z;
    SOL.city.resolveCollision(probe, 1.2);
    if (probe.x !== bx || probe.z !== bz) desired.y += 4;
    const k = Math.min(1, dt * (p.car ? 4.5 : 7));
    camPos.lerp(desired, k);
    camTarget.lerp(target, Math.min(1, dt * 9));
    camera.position.copy(camPos);
    // Camera shake from effects.
    const sh = SOL.effects.shake();
    if (sh > 0.01) {
      camera.position.x += (SOL.rand() - 0.5) * sh * 0.5;
      camera.position.y += (SOL.rand() - 0.5) * sh * 0.35;
    }
    camera.lookAt(camTarget);
    if (p.car) {
      const fov = 62 + Math.min(14, Math.abs(p.car.speed) * 0.28);
      if (Math.abs(camera.fov - fov) > 0.2) {
        camera.fov += (fov - camera.fov) * Math.min(1, dt * 3);
        camera.updateProjectionMatrix();
      }
    }
  }

  function startGame(fromSave) {
    const data = fromSave ? SOL.save.load() : null;
    if (data) applySave(data);
    $('menu').classList.add('hidden');
    $('pausescreen').classList.add('hidden');
    $('busted-screen').classList.add('hidden');
    SOL.hud.show();
    G.mode = 'playing';
    SOL.audio.init();
    SOL.audio.music(true);
    SOL.audio.cash();
    SOL.hud.dialogue('LENA', 'Solmaris, baby. Steal something nice before the sun goes down.', 5200);
    if (G.nextMission < 3) {
      setTimeout(function () { SOL.missions.start(G.nextMission); }, 1800);
    } else {
      SOL.hud.objective('Campaign complete — Solmaris is yours. Free roam!');
    }
  }

  function quitToMenu() {
    G.mode = 'menu';
    SOL.audio.music(false);
    SOL.hud.hide();
    SOL.hud.hideDialogue();
    $('pausescreen').classList.add('hidden');
    $('busted-screen').classList.add('hidden');
    $('menu').classList.remove('hidden');
    const btn = $('btn-continue');
    if (SOL.save.exists()) btn.classList.remove('hidden');
    else btn.classList.add('hidden');
  }

  function onBusted() {
    if (G.mode !== 'playing') return;
    G.mode = 'busted';
    G.cash = Math.max(0, G.cash - 150);
    SOL.police.clearWanted();
    if (SOL.audio) SOL.audio.busted();
    $('busted-screen').classList.remove('hidden');
  }

  function onPlayerDown() {
    if (G.mode !== 'playing') return;
    G.health = 100;
    G.mode = 'busted';
    SOL.police.clearWanted();
    if (SOL.audio) SOL.audio.busted();
    $('busted-screen').classList.remove('hidden');
    $('busted-screen').querySelector('p').textContent =
      'Lena went down in the dock shootout. The crew drags you out — the job is still open, the cash is still there.';
  }

  function respawn() {
    $('busted-screen').classList.add('hidden');
    SOL.player.spawn(SOL.city.spots.hospital.x, SOL.city.spots.hospital.z, Math.PI);
    G.health = 100;
    G.mode = 'playing';
    if (SOL.hud) SOL.hud.toast('Back on your feet — the city is still yours to take');
  }

  // Deterministic scenes for the screenshots: menu hidden, HUD on, world staged.
  function stageShot(mode) {
    $('menu').classList.add('hidden');
    SOL.hud.show();
    G.mode = 'playing';
    SOL.audio.setMuted(true);
    SOL.audio.music(false);
    const p = SOL.player;
    if (mode === 'drive') {
      const sport = parkedCars[2];
      p.spawn(40, 10, Math.PI);
      p.enterCar(sport);
      sport.pos.set(40, 0, 10);
      sport.yaw = Math.PI;
      sport.speed = 24;
      // Dense traffic ahead and a billboard on the skyline so the strip
      // reads as a living avenue, not an empty road.
      SOL.traffic.placeNear(40, -50, 8);
      SOL.traffic.placeNear(40, 60, 3);
      SOL.hud.objective('Cruising the Marina Strip — traffic ahead');
      SOL.hud.dialogue('LENA', 'That Vela Sport purrs. Take the coast road — the view is worth the risk.', 9000);
    } else if (mode === 'chase') {
      const coupe = parkedCars[1];
      // On road x=40, facing north: the chase runs up a real street.
      p.spawn(40, 10, Math.PI);
      p.enterCar(coupe);
      coupe.pos.set(40, 0, 10);
      coupe.yaw = Math.PI;
      coupe.speed = 26;
      SOL.police.setWanted(3);
      // Two cruisers on the flanks, just ahead, driving north in formation
      // with her — they read in frame at once, lights strobing. A third
      // cruiser waits up the road as a roadblock.
      SOL.police.spawnAt(35, -6, Math.PI);
      SOL.police.spawnAt(45, -4, Math.PI);
      SOL.police.spawnAt(40, -58, 0);
      SOL.traffic.placeNear(40, -40, 5);
      SOL.hud.objective('Lose the Solmaris PD — 3 stars!');
      SOL.hud.dialogue('LENA', 'Three stars and two cruisers on your bumper. Drive like you mean it!', 9000);
    } else if (mode === 'mission') {
      // Stand on the dock apron, close to the marker: the four guards,
      // the crane and the stacked containers all read in one frame, with
      // the bay behind them — no empty ground in the shot.
      p.spawn(0, 158, 0);
      SOL.missions.start(2);
      // Jump straight to the combat stage: guards on the dock, Lena's line up.
      SOL.missions.update(0.01);
      SOL.hud.objective('Clear the dock — defeat all 4 guards');
      SOL.hud.dialogue('LENA', 'Four guards between you and the money. Make it count.', 9000);
    } else {
      // start — cover: on foot at the x=40 / z=60 intersection, facing north
      // up a real street — fountain plaza to the left, towers ahead, a
      // billboard on the skyline, traffic and pedestrians in the frame.
      // Spawned a block south so the corner traffic light reads at scale
      // instead of filling the foreground.
      p.spawn(40, 60, Math.PI);
      SOL.traffic.placeNear(40, -10, 8);
      SOL.traffic.placeNear(40, 90, 3);
      SOL.hud.objective('Explore Solmaris — steal a car, take a job');
      SOL.hud.dialogue('LENA', 'Welcome to Solmaris. Steal something nice before the sun goes down.', 9000);
    }
    updateCamera(1);
  }

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    G.time += dt;
    if (G.mode === 'playing') {
      G.playTimeSec += dt;
      // Health regen after 5s without taking damage.
      if (G.health < lastHealth) regenIn = 0;
      lastHealth = G.health;
      regenIn += dt;
      if (regenIn > 5 && G.health < 100 && G.health > 0) {
        G.health = Math.min(100, G.health + 6 * dt);
      }
      SOL.player.update(dt, G);
      SOL.traffic.update(dt, SOL.player.pos);
      SOL.pedestrians.update(dt, { x: SOL.player.pos.x, z: SOL.player.pos.z, radius: 0 });
      SOL.police.update(dt, SOL.player, SOL.player.car);
      SOL.combat.update(dt, G);
      SOL.missions.update(dt);
      SOL.activities.update(dt, G);
      SOL.effects.update(dt);
      G.wanted = SOL.police.wanted;
      if (SOL.police.wanted > G.bestWanted) G.bestWanted = SOL.police.wanted;
      // Audio follows the action.
      const driving = !!SOL.player.car;
      const spd01 = driving ? Math.abs(SOL.player.car.speed) / SOL.player.car.topSpeed : 0;
      SOL.audio.engine(spd01);
      const nearCop = SOL.police.nearestPoliceDist(SOL.player.pos);
      SOL.audio.siren(SOL.police.wanted > 0 && nearCop < 90);
      // Autosave every 30s.
      saveIn += dt;
      if (saveIn > 30) {
        saveIn = 0;
        SOL.save.store(G.saveData());
      }
      // Pause / mute keys.
      if (SOL.controls.pauseKey()) {
        SOL.controls.clearAll();
        G.mode = 'paused';
        $('pausescreen').classList.remove('hidden');
      }
      if (SOL.controls.muteKey()) {
        SOL.controls.clearAll();
        SOL.audio.setMuted(!SOL.audio.muted);
        SOL.hud.toast(SOL.audio.muted ? 'Sound off' : 'Sound on');
      }
    } else if (G.mode === 'paused') {
      if (SOL.controls.pauseKey()) {
        SOL.controls.clearAll();
        G.mode = 'playing';
        $('pausescreen').classList.add('hidden');
      }
    }
    if (G.mode === 'playing' || G.mode === 'paused') {
      updateCamera(dt);
      SOL.hud.update(G);
      SOL.minimap.draw(G);
    } else if (G.mode === 'menu') {
      // Slow orbit around the city behind the start screen.
      const t = G.time * 0.05;
      camera.position.set(Math.sin(t) * 190, 90, Math.cos(t) * 190);
      camera.lookAt(0, 0, 0);
    }
    SOL.world.update(dt, G.time);
    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      window.__SOLMARIS_READY__ = true;
    }
  }

  function boot() {
    clock = new THREE.Clock();
    buildWorld();
    // Menu buttons.
    $('btn-start').addEventListener('click', function () { startGame(false); });
    $('btn-continue').addEventListener('click', function () { startGame(true); });
    $('btn-resume').addEventListener('click', function () {
      $('pausescreen').classList.add('hidden');
      G.mode = 'playing';
    });
    $('btn-quit').addEventListener('click', quitToMenu);
    $('btn-respawn').addEventListener('click', respawn);
    if (SOL.save.exists()) $('btn-continue').classList.remove('hidden');
    // Staged screenshot modes (?shot=start|drive|chase|mission).
    const params = new URLSearchParams(window.location.search);
    shotMode = params.get('shot');
    if (shotMode) {
      // Staged shots must show the staged objective, not a fare or race
      // banner the activities layer would otherwise trigger.
      G.shotStaged = true;
      stageShot(shotMode);
    }
    // Hooks for headless verification and the finalist review.
    window.__solmaris = { G: G, SOL: SOL, parkedCars: parkedCars, missionCar: missionCar, startGame: startGame, stageShot: stageShot };
    loop();
  }

  SOL.main = {
    G: G,
    parkedCars: parkedCars,
    boot: boot,
    onBusted: onBusted,
    onPlayerDown: onPlayerDown,
    startGame: startGame,
  };
})();

window.addEventListener('load', function () {
  SOL.main.boot();
});
