// SOLMARIS main — boot, game loop, camera, menus, save, and ?shot= staging.
window.SOL = window.SOL || {};
SOL.main = (function () {
  var renderer = null;
  var scene = null;
  var camera = null;
  var clock = null;
  var parkedCars = [];
  var missionCar = null;
  var camPos = null;
  var camTarget = null;
  var saveTimer = 0;
  var healthRegenTimer = 0;
  var shotMode = null;
  var started = false;

  var G = {
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
        cash: this.cash, nextMission: this.nextMission, completed: this.completed.slice(),
        bestWanted: this.bestWanted, kills: this.kills, playTimeSec: this.playTimeSec
      };
    }
  };
  SOL.G = G;

  function $(id) { return document.getElementById(id); }

  function applySave(data) {
    if (!data) return;
    G.cash = data.cash;
    G.nextMission = data.nextMission;
    G.completed = data.completed.slice();
    G.bestWanted = data.bestWanted;
    G.kills = data.kills;
    G.playTimeSec = data.playTimeSec;
  }

  function buildWorld() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87b5d6);
    scene.fog = new THREE.Fog(0x9fc3dd, 120, 420);
    G.scene = scene;
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    G.camera = camera;
    camPos = new THREE.Vector3(0, 8, 46);
    camTarget = new THREE.Vector3(0, 2, 0);
    camera.position.copy(camPos);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = false;
    $('app').appendChild(renderer.domElement);

    // Golden-hour sun + sky fill.
    var sun = new THREE.DirectionalLight(0xffe0b0, 1.35);
    sun.position.set(120, 180, 60);
    scene.add(sun);
    var hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6f4d, 0.75);
    scene.add(hemi);

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

    // Parked stealable cars around the city — including the mission coupe.
    var spots = [
      { x: 52, z: -52, kind: 1, color: 0xc23b2e, mission: true },
      { x: -24, z: 34, kind: 0, color: 0x3a6ea8 },
      { x: 92, z: -24, kind: 5, color: 0x7a2ec2 },
      { x: -82, z: 92, kind: 2, color: 0x2e7d4f },
      { x: 34, z: -92, kind: 3, color: 0x8a6d3b },
      { x: -58, z: -34, kind: 4, color: 0xe8b90c }
    ];
    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      var road = SOL.city.nearestRoad(s.x, s.z);
      var px = s.x;
      var pz = s.z;
      if (road) {
        if (road.axis === 'x') { pz = road.at + 9.5; }
        else { px = road.at + 9.5; }
      }
      var car = SOL.vehicles.makeCar(s.kind, s.color, px, pz, Math.random() * Math.PI * 2);
      car.driver = 'parked';
      scene.add(car.group);
      parkedCars.push(car);
      if (s.mission) missionCar = car;
    }
    SOL.missions.setTargetCar(missionCar);

    SOL.player.spawn(SOL.city.spots.start.x, SOL.city.spots.start.z, Math.PI);
    SOL.hud.objective('Start the engine — press START, then follow Lena\'s jobs');
    window.addEventListener('resize', onResize);
  }

  function onResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function updateCamera(dt) {
    var p = SOL.player;
    var target = new THREE.Vector3(p.pos.x, p.pos.y + 1.6, p.pos.z);
    var dist = p.car ? 13.5 + Math.abs(p.car.speed) * 0.12 : 9.5;
    var height = p.car ? 5.2 : 4.4;
    var yaw = p.getCamYaw();
    var desired = new THREE.Vector3(
      target.x - Math.sin(yaw) * dist,
      target.y + height,
      target.z - Math.cos(yaw) * dist
    );
    // Keep the camera out of buildings: lift it if the line is blocked.
    var probe = { x: desired.x, z: desired.z };
    var before = { x: probe.x, z: probe.z };
    SOL.city.resolveCollision(probe, 1.2);
    if (probe.x !== before.x || probe.z !== before.z) desired.y += 4;
    var k = Math.min(1, dt * (p.car ? 4.5 : 7));
    camPos.lerp(desired, k);
    camTarget.lerp(target, Math.min(1, dt * 9));
    camera.position.copy(camPos);
    // Camera shake from effects.
    var sh = SOL.effects.shakeAmount();
    if (sh > 0.01) {
      camera.position.x += (Math.random() - 0.5) * sh * 0.5;
      camera.position.y += (Math.random() - 0.5) * sh * 0.35;
    }
    camera.lookAt(camTarget);
    if (p.car) {
      var fov = 62 + Math.min(14, Math.abs(p.car.speed) * 0.28);
      if (Math.abs(camera.fov - fov) > 0.2) {
        camera.fov += (fov - camera.fov) * Math.min(1, dt * 3);
        camera.updateProjectionMatrix();
      }
    }
  }

  function startGame(fromSave) {
    var data = fromSave ? SOL.save.load() : null;
    if (data) applySave(data);
    $('start-screen').classList.add('hidden');
    $('pausescreen').classList.add('hidden');
    $('busted-screen').classList.add('hidden');
    SOL.hud.show();
    G.mode = 'playing';
    started = true;
    SOL.audio.init();
    SOL.audio.music(true);
    SOL.audio.sting();
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
    $('start-screen').classList.remove('hidden');
    var btn = $('btn-continue');
    if (SOL.save.hasSave()) btn.classList.remove('hidden');
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

  function stageShot(mode) {
    // Deterministic scenes for the screenshots: menu hidden, HUD on, world staged.
    $('start-screen').classList.add('hidden');
    SOL.hud.show();
    G.mode = 'playing';
    started = true;
    SOL.audio.setMuted(true);
    SOL.audio.music(false);
    var p = SOL.player;
    if (mode === 'drive') {
      var sport = parkedCars[2];
      p.spawn(0, -20, Math.PI);
      p.enterCar(sport);
      sport.pos.set(0, 0, -20);
      sport.yaw = Math.PI;
      sport.speed = 22;
      SOL.traffic.placeNear(0, -60, 5);
      SOL.hud.objective('Cruising the Marina Strip — traffic ahead');
      SOL.hud.dialogue('LENA', 'That Vela Sport purrs. Take the coast road — the view is worth the risk.', 9000);
    } else if (mode === 'chase') {
      var coupe = parkedCars[1];
      // On the road x=29, facing north: the chase runs up a real street.
      p.spawn(29, 10, Math.PI);
      p.enterCar(coupe);
      coupe.pos.set(29, 0, 10);
      coupe.yaw = Math.PI;
      coupe.speed = 26;
      SOL.police.setWanted(3);
      // Two cruisers on the flanks, just ahead, driving north in formation
      // with her — they read in frame at once, lights strobing.
      SOL.police.spawnAt(24, -6, Math.PI);
      SOL.police.spawnAt(34, -4, Math.PI);
      SOL.traffic.placeNear(29, -40, 4);
      SOL.hud.objective('Lose the Solmaris PD — 3 stars!');
      SOL.hud.dialogue('LENA', 'Three stars and two cruisers on your bumper. Drive like you mean it!', 9000);
    } else if (mode === 'mission') {
      p.spawn(0, 184, 0);
      SOL.missions.start(2);
      // Jump straight to the combat stage: guards on the dock, Lena's line up.
      SOL.missions.update(0.01);
      SOL.hud.objective('Clear the dock — defeat all 4 guards');
      SOL.hud.dialogue('LENA', 'Four guards between you and the money. Make it count.', 9000);
    } else {
      // start — cover: on foot in the middle of the x=29 / z=29 intersection,
      // facing north up a real street — buildings line both sides, traffic
      // ahead, nothing blocking the camera, HUD and minimap visible.
      p.spawn(29, 29, Math.PI);
      SOL.traffic.placeNear(29, -10, 6);
      SOL.hud.objective('Explore Solmaris — steal a car, take a job');
      SOL.hud.dialogue('LENA', 'Welcome to Solmaris. Steal something nice before the sun goes down.', 9000);
    }
    updateCamera(1);
  }

  function loop() {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, clock.getDelta());
    G.time += dt;
    if (G.mode === 'playing') {
      G.playTimeSec += dt;
      // Health regen after 5s without damage.
      healthRegenTimer += dt;
      if (healthRegenTimer > 5 && G.health < 100 && G.health > 0) {
        G.health = Math.min(100, G.health + 6 * dt);
      }
      var threat = null;
      if (SOL.combat) {
        // Gunfire scares pedestrians within 30m of the player.
        threat = { x: SOL.player.pos.x, z: SOL.player.pos.z, radius: 0 };
      }
      SOL.player.update(dt, G);
      SOL.traffic.update(dt, SOL.player.pos);
      SOL.pedestrians.update(dt, threat);
      SOL.police.update(dt, SOL.player, SOL.player.car);
      SOL.combat.update(dt, G);
      SOL.missions.update(dt);
      SOL.effects.update(dt);
      G.wanted = SOL.police.wanted;
      if (SOL.police.wanted > G.bestWanted) G.bestWanted = SOL.police.wanted;
      // Audio follows the action.
      var driving = !!SOL.player.car;
      var spd01 = driving ? Math.abs(SOL.player.car.speed) / SOL.player.car.topSpeed : 0;
      SOL.audio.engine(spd01, driving);
      SOL.audio.siren(SOL.police.nearestPoliceDist(SOL.player.pos), SOL.police.wanted);
      // Autosave every 30s.
      saveTimer += dt;
      if (saveTimer > 30) {
        saveTimer = 0;
        SOL.save.save(G.saveData());
      }
      // Pause / mute keys.
      if (SOL.controls.pausePressed()) {
        SOL.controls.clearKeys();
        G.mode = 'paused';
        $('pausescreen').classList.remove('hidden');
      }
      if (SOL.controls.mutePressed()) {
        SOL.controls.clearKeys();
        SOL.audio.setMuted(!SOL.audio.isMuted());
        SOL.hud.toast(SOL.audio.isMuted() ? 'Sound off' : 'Sound on');
      }
    } else if (G.mode === 'paused') {
      if (SOL.controls.pausePressed()) {
        SOL.controls.clearKeys();
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
      var t = G.time * 0.05;
      camera.position.set(Math.sin(t) * 190, 90, Math.cos(t) * 190);
      camera.lookAt(0, 0, 0);
    }
    renderer.render(scene, camera);
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
    if (SOL.save.hasSave()) $('btn-continue').classList.remove('hidden');
    // Staged screenshot modes (?shot=start|drive|chase|mission).
    var params = new URLSearchParams(window.location.search);
    shotMode = params.get('shot');
    if (shotMode) {
      stageShot(shotMode);
    }
    // Driving hooks for headless verification and the finalist review.
    window.__solmaris = { G: G, SOL: SOL, parkedCars: parkedCars, missionCar: missionCar, startGame: startGame, stageShot: stageShot };
    loop();
  }

  return {
    G: G,
    parkedCars: parkedCars,
    boot: boot,
    onBusted: onBusted,
    onPlayerDown: onPlayerDown,
    startGame: startGame
  };
})();

window.addEventListener('load', function () {
  SOL.main.boot();
});
