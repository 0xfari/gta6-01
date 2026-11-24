// SOLMARIS v6 — activities.js: side jobs that make Solmaris worth roaming
// after the campaign, and a finale job that only unlocks once the three
// campaign jobs are done. Three systems, all optional, all paying cash:
//   1. CASH STASHES — 10 green-glowing cases hidden on the sidewalks.
//      Walk up, grab $75 each. A counter in the HUD tracks them.
//   2. TAXI FARES — drive anywhere and a pedestrian flags you down.
//      Pick them up, drop them at the beacon, earn $100 a fare.
//   3. STREET RACE — a checkered start pad north of the plaza. Drive
//      through 5 gates in order against the clock; best time is saved,
//      beating 90 seconds pays $200.
//   4. THE GETAWAY (finale) — Marco's last job, unlocked after the
//      campaign: clear the dock a second time, grab the cash, and lose a
//      four-star tail on the way to the safehouse. Pays $1,000.
// Kills during the finale are counted from G.kills, which the combat
// module already increments — no hook into missions or combat needed.
(function () {
  var A = {};
  var scene = null;
  var G = null;
  var sideLine = null;

  var STASH_COUNT = 10;
  var STASH_PAY = 75;
  var FARE_PAY = 100;
  var RACE_PAY_FAST = 200;
  var RACE_PAY_SLOW = 100;
  var GETAWAY_PAY = 1000;

  var stashes = [];
  var stashesFound = 0;
  var faresDone = 0;
  var fare = null; // { state, ped, beacon, dest }
  var fareCooldown = 0;
  var race = null; // { state, gates, gate, startAt, best }
  var getaway = null; // { state, beacon, guardsAtStart, announced }
  var clock = 0;

  function makeBeacon(color) {
    var group = new THREE.Group();
    var beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.3, 18, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 9;
    group.add(beam);
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(1.8, 2.6, 28),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    group.add(ring);
    var light = new THREE.PointLight(color, 1.6, 20);
    light.position.y = 3.5;
    group.add(light);
    group.visible = false;
    scene.add(group);
    return { group: group, ring: ring, light: light };
  }

  function placeBeacon(b, x, z) {
    b.group.position.set(x, 0, z);
    b.group.visible = true;
  }

  function hideBeacon(b) {
    b.group.visible = false;
  }

  function personMesh(shirtColor) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.3, 0.5),
      new THREE.MeshLambertMaterial({ color: shirtColor })
    );
    body.position.y = 1.05;
    g.add(body);
    var head = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xd8a878 })
    );
    head.position.y = 2.0;
    g.add(head);
    var legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.9, 0.45),
      new THREE.MeshLambertMaterial({ color: 0x2c3a5c })
    );
    legs.position.y = 0.45;
    g.add(legs);
    return g;
  }

  function buildStashes() {
    for (var i = 0; i < STASH_COUNT; i++) {
      var p = SOL.city.randomSidewalkPoint();
      var group = new THREE.Group();
      var box = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.7, 0.8),
        new THREE.MeshLambertMaterial({ color: 0x1f8a3a })
      );
      box.position.y = 0.35;
      group.add(box);
      var lid = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.16, 0.85),
        new THREE.MeshBasicMaterial({ color: 0x7dff9a })
      );
      lid.position.y = 0.78;
      group.add(lid);
      var beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.8, 9, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x7dff9a, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
      );
      beam.position.y = 4.5;
      group.add(beam);
      group.position.set(p.x, 0, p.z);
      scene.add(group);
      stashes.push({ group: group, x: p.x, z: p.z, taken: false, spin: 0 });
    }
  }

  function buildRace() {
    // Checkered start pad north of the plaza, on the road at z = -40.
    var pad = new THREE.Group();
    var c = document.createElement('canvas');
    c.width = 128;
    c.height = 32;
    var g = c.getContext('2d');
    for (var x = 0; x < 8; x++) {
      for (var y = 0; y < 2; y++) {
        g.fillStyle = (x + y) % 2 === 0 ? '#111111' : '#f2f2f2';
        g.fillRect(x * 16, y * 16, 16, 16);
      }
    }
    var tex = new THREE.CanvasTexture(c);
    var slab = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: tex }));
    slab.rotation.x = -Math.PI / 2;
    slab.position.y = 0.06;
    pad.add(slab);
    pad.position.set(0, 0, -40);
    scene.add(pad);
    // Five gates on a loop: plaza -> marina -> east side -> south -> home.
    var spots = [
      { x: 40, z: -120 },
      { x: 120, z: -40 },
      { x: 120, z: 120 },
      { x: -120, z: 120 },
      { x: 0, z: -40 },
    ];
    var gates = [];
    for (var i = 0; i < spots.length; i++) {
      var ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.2, 0.4, 8, 20),
        new THREE.MeshBasicMaterial({ color: 0xffd23e })
      );
      ring.position.set(spots[i].x, 3.4, spots[i].z);
      ring.visible = false;
      scene.add(ring);
      gates.push({ mesh: ring, x: spots[i].x, z: spots[i].z });
    }
    var best = null;
    try {
      var raw = window.localStorage.getItem('solmaris-race-best');
      if (raw) best = parseFloat(raw);
    } catch (e) {
      best = null;
    }
    race = { state: 'idle', gates: gates, gate: 0, startAt: 0, best: best };
  }

  function refreshSideLine() {
    if (!sideLine) return;
    var raceTxt = race && race.best != null ? race.best.toFixed(1) + 's' : '--';
    sideLine.textContent = 'STASHES ' + stashesFound + '/' + STASH_COUNT +
      ' · FARES ' + faresDone + ' · RACE BEST ' + raceTxt;
  }

  function say(name, text, ms) {
    if (SOL.hud) SOL.hud.dialogue(name, text, ms || 5200);
  }

  function dist2(ax, az, bx, bz) {
    var dx = ax - bx;
    var dz = az - bz;
    return dx * dx + dz * dz;
  }

  // --- Cash stashes: spin + pickup -------------------------------------
  function updateStashes(dt, px, pz) {
    for (var i = 0; i < stashes.length; i++) {
      var s = stashes[i];
      if (s.taken) continue;
      s.spin += dt;
      s.group.rotation.y = s.spin * 0.8;
      if (dist2(px, pz, s.x, s.z) < 9) {
        s.taken = true;
        s.group.visible = false;
        stashesFound++;
        G.cash += STASH_PAY;
        if (SOL.effects) SOL.effects.burst(new THREE.Vector3(s.x, 1.5, s.z), 0x7dff9a, 14, 6, 0.8, 5);
        if (SOL.audio) SOL.audio.pickup();
        if (SOL.hud) SOL.hud.toast('Cash stash: +$' + STASH_PAY + ' (' + stashesFound + '/' + STASH_COUNT + ')');
        refreshSideLine();
      }
    }
  }

  // --- Taxi fares ---------------------------------------------------------
  function startFare() {
    var p = SOL.city.randomSidewalkPoint();
    var ped = personMesh(0xffd23e);
    ped.position.set(p.x, 0, p.z);
    scene.add(ped);
    var b = makeBeacon(0xffffff);
    placeBeacon(b, p.x, p.z);
    fare = { state: 'wait', ped: ped, beacon: b, dest: null, px: p.x, pz: p.z };
    if (SOL.hud) SOL.hud.objective('Fare waiting — pick up the passenger');
    say('FARE', 'Taxi! I need a ride across town — and step on it.', 4500);
  }

  function endFare(paid) {
    if (!fare) return;
    scene.remove(fare.ped);
    hideBeacon(fare.beacon);
    scene.remove(fare.beacon.group);
    fare = null;
    fareCooldown = 20;
    if (paid) {
      G.cash += FARE_PAY;
      faresDone++;
      if (SOL.hud) SOL.hud.toast('Fare complete: +$' + FARE_PAY + ' (' + faresDone + ' fares)');
      if (SOL.audio) SOL.audio.cash();
      refreshSideLine();
    }
  }

  function updateFares(dt, px, pz) {
    fareCooldown = Math.max(0, fareCooldown - dt);
    // Never during a staged screenshot — a fare would steal the objective
    // line the shot is supposed to show.
    if (!fare && G.player.car && fareCooldown <= 0 && G.mode === 'playing' && !G.shotStaged) {
      startFare();
    }
    if (!fare) return;
    var fx = fare.state === 'wait' ? fare.px : fare.dest.x;
    var fz = fare.state === 'wait' ? fare.pz : fare.dest.z;
    var d2 = dist2(px, pz, fx, fz);
    if (fare.state === 'wait') {
      fare.beacon.ring.scale.setScalar(1 + Math.sin(clock * 3) * 0.12);
      if (G.player.car && d2 < 36) {
        fare.ped.visible = false;
        fare.state = 'ride';
        var d = SOL.city.randomSidewalkPoint();
        fare.dest = d;
        placeBeacon(fare.beacon, d.x, d.z);
        if (SOL.hud) SOL.hud.objective('Drop the fare at the beacon');
        say('FARE', 'Thanks for stopping. That blue marker — and no, I am not telling you why I am in a hurry.', 5000);
      }
    } else if (fare.state === 'ride') {
      if (d2 < 64) {
        endFare(true);
        if (SOL.hud) SOL.hud.objective('Free roam — stashes, fares and the race pad are still out there');
      }
    }
    if (!G.player.car && fare.state === 'ride') {
      endFare(false);
      if (SOL.hud) {
        SOL.hud.toast('The fare walked off — you left the car');
        // Without this the objective would keep pointing at a fare that
        // no longer exists; send the player back to free roam instead.
        SOL.hud.objective('Free roam — stashes, fares and the race pad are still out there');
      }
    }
  }

  // --- Street race --------------------------------------------------------
  function gateReached(i) {
    var gate = race.gates[i];
    gate.mesh.visible = false;
    if (SOL.effects) SOL.effects.burst(new THREE.Vector3(gate.x, 3, gate.z), 0xffd23e, 12, 6, 0.7, 4);
    if (SOL.audio) SOL.audio.pickup();
  }

  function finishRace() {
    var t = clock - race.startAt;
    var fast = t <= 90;
    var pay = fast ? RACE_PAY_FAST : RACE_PAY_SLOW;
    G.cash += pay;
    var record = false;
    if (race.best == null || t < race.best) {
      race.best = t;
      record = true;
      try {
        window.localStorage.setItem('solmaris-race-best', String(t));
      } catch (e) {
        /* private mode */
      }
    }
    if (SOL.hud) {
      SOL.hud.banner('RACE DONE', t.toFixed(1) + 's — +$' + pay + (record ? ' · NEW BEST!' : ''));
      SOL.hud.objective('Free roam — stashes, fares and the race pad are still out there');
    }
    if (SOL.audio) SOL.audio.cash();
    race.state = 'idle';
    race.gate = 0;
    refreshSideLine();
  }

  function abandonRace() {
    race.state = 'idle';
    race.gate = 0;
    for (var i = 0; i < race.gates.length; i++) race.gates[i].mesh.visible = false;
    if (SOL.hud) SOL.hud.toast('Race abandoned — you left the car');
  }

  function updateRace(px, pz) {
    if (!race || G.shotStaged) return;
    if (race.state === 'idle') {
      if (G.player.car && dist2(px, pz, 0, -40) < 36) {
        race.state = 'run';
        race.gate = 0;
        race.startAt = clock;
        race.gates[0].mesh.visible = true;
        if (SOL.hud) {
          SOL.hud.banner('STREET RACE', '5 gates — beat 90s for $200');
          SOL.hud.objective('Race — gate 1 of 5');
        }
        say('LENA', 'Five gates, one clock. Drive like the rent is due.', 4500);
      }
      return;
    }
    // Running: gates in order; clock runs.
    var gate = race.gates[race.gate];
    if (dist2(px, pz, gate.x, gate.z) < 36) {
      gateReached(race.gate);
      race.gate++;
      if (race.gate >= race.gates.length) {
        finishRace();
      } else {
        race.gates[race.gate].mesh.visible = true;
        if (SOL.hud) SOL.hud.objective('Race — gate ' + (race.gate + 1) + ' of 5 · ' + (clock - race.startAt).toFixed(1) + 's');
      }
    }
    if (!G.player.car) abandonRace();
  }

  // --- Finale: THE GETAWAY ------------------------------------------------
  function announceGetaway() {
    getaway.announced = true;
    getaway.beacon = makeBeacon(0x2ed8ff);
    say('MARCO', 'One last job, Lena. The crew\'s cash is back on the dock — and this time the whole precinct knows. Take it, lose them, bring it home.', 8000);
    if (SOL.hud) {
      SOL.hud.banner('FINAL JOB: THE GETAWAY', 'Pays $1,000 — the dock, then the safehouse');
      SOL.hud.toast('Final job unlocked — follow the blue beacon to the harbor');
    }
    getaway.state = 'goto';
    placeBeacon(getaway.beacon, SOL.city.spots.harbor.x, SOL.city.spots.harbor.z);
    if (SOL.hud) SOL.hud.objective('THE GETAWAY — reach the harbor dock');
  }

  function spawnGetawayGuards() {
    getaway.guardsAtStart = G.kills || 0;
    var spot = SOL.city.spots.harbor;
    var offsets = [-10, 0, 10];
    for (var i = 0; i < 3; i++) {
      SOL.combat.spawnEnemy(spot.x + offsets[i], spot.z + 8 + (i % 2) * 5);
    }
    say('LENA', 'Three guards on the dock. Same drill as the heist — clear them, grab the cash.', 5500);
    if (SOL.hud) SOL.hud.objective('THE GETAWAY — clear the dock (3 guards)');
  }

  function updateGetaway(px, pz) {
    if (!getaway) return;
    // Unlock once the 3-job campaign is complete — never during a staged
    // screenshot, where its banner would cover the shot.
    if (getaway.state === 'locked' && G.completed && G.completed.length >= 3 && !G.shotStaged) {
      announceGetaway();
    }
    if (getaway.state === 'locked') return;
    var spot = SOL.city.spots.harbor;
    var safe = SOL.city.spots.safehouse;
    if (getaway.state === 'goto') {
      if (dist2(px, pz, spot.x, spot.z) < 26 * 26) {
        getaway.state = 'combat';
        spawnGetawayGuards();
      }
    } else if (getaway.state === 'combat') {
      var killed = (G.kills || 0) - getaway.guardsAtStart;
      if (killed >= 3) {
        getaway.state = 'pickup';
        if (SOL.hud) SOL.hud.objective('THE GETAWAY — grab the cash');
        say('LENA', 'Dock is clear. Grab the cash.', 4000);
      } else if (killed > 0) {
        if (SOL.hud) SOL.hud.objective('THE GETAWAY — clear the dock (' + (3 - killed) + ' left)');
      }
    } else if (getaway.state === 'pickup') {
      if (dist2(px, pz, spot.x, spot.z) < 30) {
        getaway.state = 'deliver';
        if (SOL.police) SOL.police.addHeat(60, 'the getaway tripped the alarm');
        if (SOL.audio) SOL.audio.pickup();
        placeBeacon(getaway.beacon, safe.x, safe.z);
        if (SOL.hud) SOL.hud.objective('THE GETAWAY — lose the heat, reach the safehouse');
        say('LENA', 'Cash secured — and the whole precinct is coming. Vanish!', 5500);
      }
    } else if (getaway.state === 'deliver') {
      if (dist2(px, pz, safe.x, safe.z) < 30) {
        getaway.state = 'done';
        G.cash += GETAWAY_PAY;
        hideBeacon(getaway.beacon);
        if (SOL.hud) {
          SOL.hud.banner('THE GETAWAY — DONE', '+$' + GETAWAY_PAY + ' — Solmaris is truly yours');
          SOL.hud.objective('Free roam — Solmaris is yours. Stashes, fares and races remain.');
        }
        if (SOL.audio) SOL.audio.cash();
        if (SOL.save) SOL.save.store(G.saveData());
        say('MARCO', 'Clean getaway, Lena. That is the whole city, bought and paid for.', 7000);
      }
    }
    if (getaway.beacon && getaway.beacon.group.visible) {
      getaway.beacon.ring.scale.setScalar(1 + Math.sin(clock * 3) * 0.12);
    }
  }

  A.init = function (sc, g) {
    scene = sc;
    G = g;
    sideLine = document.getElementById('sideline');
    buildStashes();
    buildRace();
    getaway = { state: 'locked', beacon: null, guardsAtStart: 0, announced: false };
    refreshSideLine();
  };

  A.update = function (dt, g) {
    if (!scene || !G) return;
    clock += dt;
    G = g;
    var px = G.player.pos.x;
    var pz = G.player.pos.z;
    updateStashes(dt, px, pz);
    updateFares(dt, px, pz);
    updateRace(px, pz);
    updateGetaway(px, pz);
  };

  A.state = function () {
    return {
      stashes: stashesFound,
      fares: faresDone,
      raceBest: race ? race.best : null,
      getaway: getaway ? getaway.state : 'locked',
      stashSpots: stashes.filter(function (s) {
        return !s.taken;
      }).map(function (s) {
        return { x: s.x, z: s.z };
      }),
    };
  };

  SOL.activities = A;
})();
