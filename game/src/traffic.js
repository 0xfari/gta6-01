// SOLMARIS v6 — traffic.js: 14 AI cars cruising the road lanes. Each car
// holds a lane (road line + side), drives along it, and rolls a turn at
// intersections. Cars ahead slow the follower down, so jams form and clear
// on their own. Cars wrap around the far city edge instead of despawning.
(function () {
  var T = {};
  var LANE_OFFSET = 3.2;
  var cars = [];
  var scene = null;
  var city = null;
  var vehicles = null;

  function randomLane() {
    var axis = SOL.rand() < 0.5 ? 'x' : 'z';
    var at = SOL.pick(city.roads);
    var dir = SOL.rand() < 0.5 ? 1 : -1;
    var along = SOL.randRange(-150, 150);
    if (axis === 'x') {
      return {
        x: along,
        z: at + LANE_OFFSET * dir,
        yaw: dir > 0 ? Math.PI / 2 : -Math.PI / 2,
        axis: 'x',
        at: at,
        dir: dir,
      };
    }
    return {
      x: at + LANE_OFFSET * dir,
      z: along,
      yaw: dir > 0 ? Math.PI : 0,
      axis: 'z',
      at: at,
      dir: dir,
    };
  }

  function carAhead(c, dist) {
    var fx = Math.sin(c.yaw);
    var fz = Math.cos(c.yaw);
    var px = c.pos.x + fx * dist;
    var pz = c.pos.z + fz * dist;
    var others = T.allCars();
    for (var i = 0; i < others.length; i++) {
      var o = others[i];
      if (o === c) continue;
      var dx = o.pos.x - px;
      var dz = o.pos.z - pz;
      if (dx * dx + dz * dz < 32) return true;
    }
    return false;
  }

  // One turn roll per intersection: armed away from crossings, spent the
  // first frame inside the intersection zone.
  function maybeTurn(c) {
    var crossD = Infinity;
    var crossAt = null;
    for (var i = 0; i < city.roads.length; i++) {
      var line = city.roads[i];
      var d = c.axis === 'x' ? Math.abs(c.pos.x - line) : Math.abs(c.pos.z - line);
      if (d < crossD) {
        crossD = d;
        crossAt = line;
      }
    }
    if (crossD > 6) {
      c.turnReady = true;
      return;
    }
    if (!c.turnReady) return;
    c.turnReady = false;
    if (SOL.rand() > 0.3) return;
    c.dir = SOL.rand() < 0.5 ? 1 : -1;
    if (c.axis === 'x') {
      c.axis = 'z';
      c.at = crossAt;
      c.pos.x = crossAt + LANE_OFFSET * c.dir;
      c.yaw = c.dir > 0 ? Math.PI : 0;
    } else {
      c.axis = 'x';
      c.at = crossAt;
      c.pos.z = crossAt + LANE_OFFSET * c.dir;
      c.yaw = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  T.cars = cars;

  T.init = function (sc, cityMod, vehiclesMod) {
    scene = sc;
    city = cityMod;
    vehicles = vehiclesMod;
    cars.length = 0; // empty in place: the array is shared, never reassigned
    for (var i = 0; i < 14; i++) {
      var lane = randomLane();
      var car = vehicles.makeCar(vehicles.randomModel(), vehicles.randomColor(), lane.x, lane.z, lane.yaw);
      car.driver = 'ai';
      car.axis = lane.axis;
      car.at = lane.at;
      car.dir = lane.dir;
      car.cruise = 8 + SOL.rand() * 6;
      car.pause = 0;
      car.turnReady = true;
      scene.add(car.group);
      cars.push(car);
    }
  };

  // Every car in the world the AI must avoid: traffic + police + player car.
  T.allCars = function () {
    var list = cars.slice();
    if (SOL.police) list.push.apply(list, SOL.police.patrolCars);
    var p = SOL.player && SOL.player.car;
    if (p) list.push(p);
    return list;
  };

  T.update = function (dt, playerPos) {
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      var target = c.at + LANE_OFFSET * c.dir;
      var lateral = c.axis === 'x' ? c.pos.z - target : c.pos.x - target;
      var want = carAhead(c, 11) ? 0 : c.cruise;
      if (c.pause > 0) {
        c.pause -= dt;
        want = 0;
      }
      var diff = want - c.speed;
      c.speed += Math.max(-14 * dt, Math.min(10 * dt, diff));
      if (c.speed > 0.05) {
        c.pos.x += Math.sin(c.yaw) * c.speed * dt;
        c.pos.z += Math.cos(c.yaw) * c.speed * dt;
        if (c.axis === 'x') c.pos.z -= lateral * Math.min(1, dt * 2.5);
        else c.pos.x -= lateral * Math.min(1, dt * 2.5);
        if (c.axis === 'x' && Math.abs(c.pos.x) > 168) c.pos.x = -Math.sign(c.pos.x) * 168;
        if (c.axis === 'z' && Math.abs(c.pos.z) > 168) c.pos.z = -Math.sign(c.pos.z) * 168;
        maybeTurn(c);
      }
      c.group.position.set(c.pos.x, 0, c.pos.z);
      c.group.rotation.y = c.yaw;
    }
    // A traffic car the player rams hard gets shoved and slows down.
    if (playerPos) {
      for (var j = 0; j < cars.length; j++) {
        var t = cars[j];
        var dx = t.pos.x - playerPos.x;
        var dz = t.pos.z - playerPos.z;
        if (dx * dx + dz * dz < 6) t.speed = Math.max(0, t.speed - 20 * dt);
      }
    }
  };

  // Park a few traffic cars near a point (used by the ?shot= staging).
  T.placeNear = function (x, z, n) {
    var placed = 0;
    for (var i = 0; i < cars.length; i++) {
      if (placed >= n) break;
      var c = cars[i];
      var px = x + SOL.randRange(-26, 26);
      var pz = z + SOL.randRange(-26, 26);
      var r = city.nearestRoad(px, pz);
      if (!r) continue;
      var side = SOL.rand() < 0.5 ? 1 : -1;
      if (r.axis === 'x') {
        c.pos.x = px;
        c.pos.z = r.at + LANE_OFFSET * side;
        c.yaw = SOL.rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        c.axis = 'x';
        c.at = r.at;
      } else {
        c.pos.x = r.at + LANE_OFFSET * side;
        c.pos.z = pz;
        c.yaw = SOL.rand() < 0.5 ? Math.PI : 0;
        c.axis = 'z';
        c.at = r.at;
      }
      c.speed = 4 + SOL.rand() * 5;
      c.group.position.set(c.pos.x, 0, c.pos.z);
      c.group.rotation.y = c.yaw;
      placed++;
    }
  };

  SOL.traffic = T;
})();
