// SOLMARIS missions — a 3-job campaign starring Lena Cruz. Cash grows: $250 → $450 → $750.
window.SOL = window.SOL || {};
SOL.missions = (function () {
  var scene = null;
  var city = null;
  var G = null;
  var marker = null;
  var markerLight = null;
  var markerRing = null;

  var MISSIONS = [
    {
      id: 0, title: 'FIRST WHEELS', payout: 250,
      intro: 'LENA: First rule of Solmaris — never pay for a car. That marina coupe on 5th has your name on it. Take it.',
      stages: [
        { text: 'Steal the marked coupe', spot: 'alley', kind: 'steal' },
        { text: 'Deliver the coupe to the garage', spot: 'garage', kind: 'deliver' }
      ]
    },
    {
      id: 1, title: 'THE PICKUP', payout: 450,
      intro: 'LENA: A package is waiting in the alley off 2nd. Grab it on foot — and when the heat comes, and it will come, lose it before the drop.',
      stages: [
        { text: 'Pick up the package in the alley', spot: 'alley', kind: 'pickup' },
        { text: 'Reach the drop-off at the safehouse', spot: 'safehouse', kind: 'deliver' }
      ]
    },
    {
      id: 2, title: 'HARBOR HEIST', payout: 750,
      intro: 'LENA: The crew\'s money sits on the south dock, guarded by four very serious men. Clear the dock, take the cash, and do not get caught.',
      stages: [
        { text: 'Reach the harbor dock', spot: 'harbor', kind: 'goto' },
        { text: 'Clear the dock — defeat all 4 guards', spot: 'harbor', kind: 'combat' },
        { text: 'Grab the cash', spot: 'harbor', kind: 'pickup' },
        { text: 'Escape to the safehouse', spot: 'safehouse', kind: 'deliver' }
      ]
    }
  ];

  var active = -1;      // mission index, -1 = none
  var stage = 0;
  var stageDone = false;
  var targetCar = null; // the marked coupe for mission 1
  var guardsLeft = 0;
  var stageTimer = 0;

  function buildMarker() {
    marker = new THREE.Group();
    var beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.6, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 13;
    marker.add(beam);
    markerRing = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3.1, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    markerRing.rotation.x = -Math.PI / 2;
    markerRing.position.y = 0.12;
    marker.add(markerRing);
    markerLight = new THREE.PointLight(0xffd23e, 2.2, 26);
    markerLight.position.y = 4;
    marker.add(markerLight);
    marker.visible = false;
    scene.add(marker);
  }

  function moveMarker(x, z) {
    marker.position.set(x, 0, z);
    marker.visible = true;
  }

  function hideMarker() { marker.visible = false; }

  function currentStage() {
    if (active < 0) return null;
    return MISSIONS[active].stages[stage];
  }

  function stageSpot() {
    var st = currentStage();
    if (!st) return null;
    return city.spots[st.spot];
  }

  function setObjective(text) {
    if (SOL.hud) SOL.hud.objective(text);
  }

  function say(name, text, ms) {
    if (SOL.hud) SOL.hud.dialogue(name, text, ms || 5200);
  }

  function startStage() {
    var st = currentStage();
    if (!st) return;
    setObjective(st.text);
    var spot = stageSpot();
    if (st.kind === 'steal') {
      // Park the marked coupe near the alley and light it up.
      if (targetCar) {
        moveMarker(targetCar.pos.x, targetCar.pos.z);
      } else if (spot) {
        moveMarker(spot.x, spot.z);
      }
      say('LENA', 'That coupe, the red one. Walk up and press E — try not to make a scene.', 6000);
    } else if (st.kind === 'combat') {
      if (spot) moveMarker(spot.x, spot.z);
      spawnGuards(spot);
      say('LENA', 'Four guards between you and the money. Make it count.', 5000);
    } else if (spot) {
      moveMarker(spot.x, spot.z);
    }
  }

  function spawnGuards(spot) {
    guardsLeft = 4;
    if (!SOL.combat) return;
    // A tight arc ahead of the dock marker, all four in the player's view.
    var offsets = [-13, -4.5, 4.5, 13];
    for (var i = 0; i < 4; i++) {
      var gx = spot.x + offsets[i];
      var gz = spot.z + 9 + (i % 2) * 5;
      SOL.combat.spawnEnemy(gx, gz);
    }
  }

  function completeMission() {
    var m = MISSIONS[active];
    G.cash += m.payout;
    G.completed.push(m.id);
    G.nextMission = Math.min(3, active + 1);
    hideMarker();
    if (SOL.hud) {
      SOL.hud.banner('JOB DONE', '+$' + m.payout + ' — ' + m.title);
      SOL.hud.toast('Campaign progress: ' + G.completed.length + ' / 3 jobs');
    }
    if (SOL.audio) SOL.audio.sting();
    if (SOL.save) SOL.save.save(G.saveData());
    var done = active;
    active = -1;
    stage = 0;
    setTimeout(function () {
      if (done + 1 < 3) {
        start(done + 1);
      } else {
        setObjective('Campaign complete — Solmaris is yours. Free roam!');
        say('LENA', 'Three jobs, no arrests, one very rich crew. Solmaris is ours now, Lena.', 7000);
        if (SOL.hud) SOL.hud.banner('SOLMARIS IS YOURS', 'All 3 jobs complete — $1,450 earned');
      }
    }, 2600);
  }

  function advanceStage() {
    stage++;
    var m = MISSIONS[active];
    if (stage >= m.stages.length) {
      completeMission();
      return;
    }
    if (SOL.audio) SOL.audio.pickup();
    startStage();
  }

  return {
    list: MISSIONS,
    active: -1,
    stage: 0,
    init: function (sc, cityMod, g) {
      scene = sc;
      city = cityMod;
      G = g;
      buildMarker();
      active = -1;
      stage = 0;
    },
    start: function (i) {
      if (i < 0 || i >= MISSIONS.length) return;
      active = i;
      this.active = i;
      stage = 0;
      this.stage = 0;
      var m = MISSIONS[i];
      if (SOL.hud) SOL.hud.banner(m.title, 'Job ' + (i + 1) + ' of 3 — pays $' + m.payout);
      say('LENA', m.intro, 6500);
      if (SOL.audio) SOL.audio.sting();
      startStage();
    },
    update: function (dt) {
      stageTimer += dt;
      if (marker.visible) {
        markerRing.scale.setScalar(1 + Math.sin(stageTimer * 3) * 0.12);
        markerLight.intensity = 1.8 + Math.sin(stageTimer * 3) * 0.6;
      }
      if (active < 0) return;
      var st = currentStage();
      if (!st) return;
      var spot = stageSpot();
      var px = G.player.pos.x;
      var pz = G.player.pos.z;
      if (st.kind === 'steal' && targetCar) {
        moveMarker(targetCar.pos.x, targetCar.pos.z);
        if (G.player.car === targetCar) {
          say('LENA', 'Nice. Now bring it to the garage on the north side — in one piece.', 5000);
          advanceStage();
        }
        return;
      }
      if (!spot) return;
      var dx = px - spot.x;
      var dz = pz - spot.z;
      var d2 = dx * dx + dz * dz;
      var radius = st.kind === 'combat' ? 26 : 5.5;
      if (d2 < radius * radius) {
        if (st.kind === 'goto') {
          say('LENA', 'There they are. Weapons free.', 4000);
          advanceStage();
        } else if (st.kind === 'pickup') {
          if (st.text.indexOf('package') >= 0) {
            SOL.police.addHeat(50, 'the pickup was watched');
            say('LENA', 'You have the package — and two cruisers just turned onto your street. Move!', 5500);
          } else {
            say('LENA', 'Cash secured. Now vanish before the whole precinct shows up.', 5000);
            SOL.police.addHeat(50, 'the heist tripped the alarm');
          }
          if (SOL.audio) SOL.audio.pickup();
          advanceStage();
        } else if (st.kind === 'deliver') {
          advanceStage();
        }
      }
      if (st.kind === 'combat' && guardsLeft <= 0) {
        say('LENA', 'Dock is clear. Grab the cash.', 4500);
        advanceStage();
      }
    },
    // The marked coupe for mission 1 — set by main.js when the world is built.
    setTargetCar: function (car) { targetCar = car; },
    onEnemyKilled: function () {
      guardsLeft = Math.max(0, guardsLeft - 1);
      if (active === 2 && currentStage() && currentStage().kind === 'combat') {
        setObjective('Clear the dock — ' + guardsLeft + ' guard' + (guardsLeft === 1 ? '' : 's') + ' left');
      }
    },
    markerPos: function () {
      return marker.visible ? { x: marker.position.x, z: marker.position.z } : null;
    },
    isActive: function () { return active >= 0; }
  };
})();
