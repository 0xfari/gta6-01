// SOLMARIS v4 — traffic.js: 14 AI cars cruising the road lanes. Each car
// holds a lane (road line + side), drives along it, and rolls a turn at
// intersections. Cars ahead slow the follower down, so jams form and clear
// on their own. Cars wrap around the far city edge instead of despawning.
(function () {
  const T = {};
  const LANE = 3.2;
  const cars = [];
  let scene = null;
  let city = null;
  let vehicles = null;

  function laneSpawn() {
    const axis = SOL.rand() < 0.5 ? 'x' : 'z';
    const at = SOL.pick(city.roads);
    const dir = SOL.rand() < 0.5 ? 1 : -1;
    const along = SOL.randRange(-150, 150);
    if (axis === 'x') {
      return { x: along, z: at + LANE * dir, yaw: dir > 0 ? Math.PI / 2 : -Math.PI / 2, axis: 'x', at: at, dir: dir };
    }
    return { x: at + LANE * dir, z: along, yaw: dir > 0 ? Math.PI : 0, axis: 'z', at: at, dir: dir };
  }

  function blockedAhead(c, dist) {
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const px = c.pos.x + fx * dist;
    const pz = c.pos.z + fz * dist;
    for (const o of T.allCars()) {
      if (o === c) continue;
      const dx = o.pos.x - px;
      const dz = o.pos.z - pz;
      if (dx * dx + dz * dz < 32) return true;
    }
    return false;
  }

  // One turn roll per intersection: armed away from crossings, spent the
  // first frame inside the intersection zone.
  function tryTurn(c) {
    let crossD = Infinity;
    let crossAt = null;
    for (const line of city.roads) {
      const d = c.axis === 'x' ? Math.abs(c.pos.x - line) : Math.abs(c.pos.z - line);
      if (d < crossD) { crossD = d; crossAt = line; }
    }
    if (crossD > 6) { c.turnReady = true; return; }
    if (!c.turnReady) return;
    c.turnReady = false;
    if (SOL.rand() > 0.3) return;
    c.dir = SOL.rand() < 0.5 ? 1 : -1;
    if (c.axis === 'x') {
      c.axis = 'z';
      c.at = crossAt;
      c.pos.x = crossAt + LANE * c.dir;
      c.yaw = c.dir > 0 ? Math.PI : 0;
    } else {
      c.axis = 'x';
      c.at = crossAt;
      c.pos.z = crossAt + LANE * c.dir;
      c.yaw = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  T.cars = cars;

  T.init = function (sc, cityMod, vehiclesMod) {
    scene = sc;
    city = cityMod;
    vehicles = vehiclesMod;
    cars.length = 0; // empty in place: the array is shared, never reassigned
    for (let i = 0; i < 14; i++) {
      const lane = laneSpawn();
      const car = vehicles.makeCar(vehicles.randomModel(), vehicles.randomColor(), lane.x, lane.z, lane.yaw);
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
    const list = cars.slice();
    if (SOL.police) list.push.apply(list, SOL.police.patrolCars);
    const p = SOL.player && SOL.player.car;
    if (p) list.push(p);
    return list;
  };

  T.update = function (dt, playerPos) {
    for (const c of cars) {
      const target = c.at + LANE * c.dir;
      const lateral = c.axis === 'x' ? c.pos.z - target : c.pos.x - target;
      let want = blockedAhead(c, 11) ? 0 : c.cruise;
      if (c.pause > 0) { c.pause -= dt; want = 0; }
      const diff = want - c.speed;
      c.speed += Math.max(-14 * dt, Math.min(10 * dt, diff));
      if (c.speed > 0.05) {
        c.pos.x += Math.sin(c.yaw) * c.speed * dt;
        c.pos.z += Math.cos(c.yaw) * c.speed * dt;
        if (c.axis === 'x') c.pos.z -= lateral * Math.min(1, dt * 2.5);
        else c.pos.x -= lateral * Math.min(1, dt * 2.5);
        if (c.axis === 'x' && Math.abs(c.pos.x) > 168) c.pos.x = -Math.sign(c.pos.x) * 168;
        if (c.axis === 'z' && Math.abs(c.pos.z) > 168) c.pos.z = -Math.sign(c.pos.z) * 168;
        tryTurn(c);
      }
      c.group.position.set(c.pos.x, 0, c.pos.z);
      c.group.rotation.y = c.yaw;
    }
    // A traffic car the player rams hard gets shoved and slows down.
    if (playerPos) {
      for (const t of cars) {
        const dx = t.pos.x - playerPos.x;
        const dz = t.pos.z - playerPos.z;
        if (dx * dx + dz * dz < 6) t.speed = Math.max(0, t.speed - 20 * dt);
      }
    }
  };

  // Park a few traffic cars near a point (used by the ?shot= staging).
  T.placeNear = function (x, z, n) {
    let placed = 0;
    for (const c of cars) {
      if (placed >= n) break;
      const px = x + SOL.randRange(-26, 26);
      const pz = z + SOL.randRange(-26, 26);
      const r = city.nearestRoad(px, pz);
      if (!r) continue;
      const side = SOL.rand() < 0.5 ? 1 : -1;
      if (r.axis === 'x') {
        c.pos.x = px; c.pos.z = r.at + LANE * side;
        c.yaw = SOL.rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        c.axis = 'x'; c.at = r.at;
      } else {
        c.pos.x = r.at + LANE * side; c.pos.z = pz;
        c.yaw = SOL.rand() < 0.5 ? Math.PI : 0;
        c.axis = 'z'; c.at = r.at;
      }
      c.speed = 4 + SOL.rand() * 5;
      c.group.position.set(c.pos.x, 0, c.pos.z);
      c.group.rotation.y = c.yaw;
      placed++;
    }
  };

  SOL.traffic = T;
})();
