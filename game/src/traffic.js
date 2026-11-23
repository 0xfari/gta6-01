// SOLMARIS traffic — 14 AI cars cruising the road lanes, stopping for jams.
window.SOL = window.SOL || {};
SOL.traffic = (function () {
  var scene = null;
  var city = null;
  var vehicles = null;
  var cars = [];
  var LANE = 3.4;

  function pickLane() {
    var axis = Math.random() < 0.5 ? 'x' : 'z';
    var at = city.roads[Math.floor(Math.random() * city.roads.length)];
    var dir = Math.random() < 0.5 ? 1 : -1;
    var along = (Math.random() * 2 - 1) * 150;
    if (axis === 'x') return { x: along, z: at + LANE * dir, yaw: dir > 0 ? Math.PI / 2 : -Math.PI / 2, axis: 'x', at: at, dir: dir };
    return { x: at + LANE * dir, z: along, yaw: dir > 0 ? Math.PI : 0, axis: 'z', at: at, dir: dir };
  }

  function carAhead(c, dist) {
    var fx = Math.sin(c.yaw);
    var fz = Math.cos(c.yaw);
    var px = c.pos.x + fx * dist;
    var pz = c.pos.z + fz * dist;
    var all = SOL.traffic.allCars();
    for (var i = 0; i < all.length; i++) {
      var o = all[i];
      if (o === c) continue;
      var dx = o.pos.x - px;
      var dz = o.pos.z - pz;
      if (dx * dx + dz * dz < 30) return o;
    }
    return null;
  }

  // One turn roll per intersection: armed when far from any crossing road,
  // spent the first frame inside the intersection zone.
  function maybeTurn(c) {
    var crossD = Infinity;
    var crossAt = null;
    for (var i = 0; i < city.roads.length; i++) {
      var d = c.axis === 'x'
        ? Math.abs(c.pos.x - city.roads[i])
        : Math.abs(c.pos.z - city.roads[i]);
      if (d < crossD) { crossD = d; crossAt = city.roads[i]; }
    }
    if (crossD > 6) { c.turnArmed = true; return; }
    if (!c.turnArmed) return;
    c.turnArmed = false;
    if (Math.random() > 0.28) return;
    var cross = crossAt;
    if (c.axis === 'x') {
      c.axis = 'z';
      c.at = cross;
      c.dir = Math.random() < 0.5 ? 1 : -1;
      c.pos.x = cross + LANE * c.dir;
      c.yaw = c.dir > 0 ? Math.PI : 0;
    } else {
      c.axis = 'x';
      c.at = cross;
      c.dir = Math.random() < 0.5 ? 1 : -1;
      c.pos.z = cross + LANE * c.dir;
      c.yaw = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  return {
    cars: cars,
    init: function (sc, cityMod, vehiclesMod) {
      scene = sc;
      city = cityMod;
      vehicles = vehiclesMod;
      // Empty in place: the array is shared with the minimap and the player,
      // so reassigning it would leave stale references behind.
      cars.length = 0;
      for (var i = 0; i < 14; i++) {
        var lane = pickLane();
        var kind = vehicles.randomModel();
        var car = vehicles.makeCar(kind, vehicles.randomColor(), lane.x, lane.z, lane.yaw);
        car.driver = 'ai';
        car.axis = lane.axis;
        car.at = lane.at;
        car.dir = lane.dir;
        car.cruise = 8 + Math.random() * 6;
        car.wait = 0;
        car.turnArmed = true;
        scene.add(car.group);
        cars.push(car);
      }
    },
    // Every car in the world the AI must avoid: traffic + police + player car.
    allCars: function () {
      var list = cars.slice();
      if (SOL.police) list = list.concat(SOL.police.policeCars);
      var p = SOL.player && SOL.player.car;
      if (p) list.push(p);
      return list;
    },
    update: function (dt, playerPos) {
      for (var i = 0; i < cars.length; i++) {
        var c = cars[i];
        // Keep the car glued to its lane; drift back if pushed.
        var target = c.axis === 'x' ? c.at + LANE * c.dir : c.at + LANE * c.dir;
        var lateral = c.axis === 'x' ? c.pos.z - target : c.pos.x - target;
        var ahead = carAhead(c, 11);
        var want = ahead ? 0 : c.cruise;
        // Gentle stop for a jam, and a random pause at intersections.
        if (c.wait > 0) { c.wait -= dt; want = 0; }
        var diff = want - c.speed;
        c.speed += Math.max(-14 * dt, Math.min(10 * dt, diff));
        if (c.speed > 0.05) {
          var fx = Math.sin(c.yaw);
          var fz = Math.cos(c.yaw);
          c.pos.x += fx * c.speed * dt;
          c.pos.z += fz * c.speed * dt;
          // Lane correction.
          if (c.axis === 'x') c.pos.z -= lateral * Math.min(1, dt * 2.5);
          else c.pos.x -= lateral * Math.min(1, dt * 2.5);
          // Wrap around the far edge of the city.
          if (c.axis === 'x' && Math.abs(c.pos.x) > 168) { c.pos.x = -Math.sign(c.pos.x) * 168; }
          if (c.axis === 'z' && Math.abs(c.pos.z) > 168) { c.pos.z = -Math.sign(c.pos.z) * 168; }
          maybeTurn(c);
        }
        c.group.position.set(c.pos.x, 0, c.pos.z);
        c.group.rotation.y = c.yaw;
      }
      // A traffic car the player rams hard stops being polite: it honks by flashing.
      if (playerPos) {
        for (var j = 0; j < cars.length; j++) {
          var t = cars[j];
          var dx = t.pos.x - playerPos.x;
          var dz = t.pos.z - playerPos.z;
          if (dx * dx + dz * dz < 6) t.speed = Math.max(0, t.speed - 20 * dt);
        }
      }
    },
    // Park a few traffic cars near a point (used by the ?shot= staging).
    placeNear: function (x, z, n) {
      var placed = 0;
      for (var i = 0; i < cars.length && placed < n; i++) {
        var c = cars[i];
        var lane = pickLane();
        var px = x + (Math.random() * 2 - 1) * 26;
        var pz = z + (Math.random() * 2 - 1) * 26;
        var r = city.nearestRoad(px, pz);
        if (!r) continue;
        if (r.axis === 'x') { c.pos.x = px; c.pos.z = r.at + LANE * (Math.random() < 0.5 ? 1 : -1); c.yaw = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2; c.axis = 'x'; c.at = r.at; }
        else { c.pos.x = r.at + LANE * (Math.random() < 0.5 ? 1 : -1); c.pos.z = pz; c.yaw = Math.random() < 0.5 ? Math.PI : 0; c.axis = 'z'; c.at = r.at; }
        c.speed = 4 + Math.random() * 5;
        c.group.position.set(c.pos.x, 0, c.pos.z);
        c.group.rotation.y = c.yaw;
        placed++;
      }
    }
  };
})();
