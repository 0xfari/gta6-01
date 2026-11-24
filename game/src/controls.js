// SOLMARIS v6 — controls.js: keyboard state, mouse look, edge clicks.
// Desktop Chrome. Pointer lock when the player clicks the canvas, with
// drag-to-look as the fallback (and what the headless screenshots use).
// Space is prevented from scrolling the page. Clicks are edge-triggered:
// takeClick() consumes them, so one press fires exactly one shot.
(function () {
  var C = {};
  var held = {};
  var look = { dx: 0, dy: 0 };
  var clickPending = false;
  var clickAt = 0;
  var dragging = false;
  var dragFrom = { x: 0, y: 0 };
  var pointerLocked = false;

  function keyDown(e) {
    held[e.code] = true;
    if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
  }

  function keyUp(e) {
    held[e.code] = false;
  }

  function mouseMove(e) {
    if (pointerLocked) {
      look.dx += e.movementX || 0;
      look.dy += e.movementY || 0;
      return;
    }
    if (!dragging) return;
    look.dx += (e.clientX - dragFrom.x) * 1.5;
    look.dy += (e.clientY - dragFrom.y) * 1.5;
    dragFrom.x = e.clientX;
    dragFrom.y = e.clientY;
  }

  function mouseDown(e) {
    if (e.button !== 0) return;
    clickPending = true;
    clickAt = performance.now();
    dragging = true;
    dragFrom.x = e.clientX;
    dragFrom.y = e.clientY;
  }

  function mouseUp(e) {
    if (e.button === 0) dragging = false;
  }

  C.init = function (canvas) {
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('mousemove', mouseMove);
    window.addEventListener('mousedown', mouseDown);
    window.addEventListener('mouseup', mouseUp);
    document.addEventListener('pointerlockchange', function () {
      pointerLocked = document.pointerLockElement != null;
    });
    if (canvas && canvas.requestPointerLock) {
      canvas.addEventListener('click', function () {
        try {
          canvas.requestPointerLock();
        } catch (e) {
          /* pointer lock is optional */
        }
      });
    }
  };

  C.down = function (code) {
    return !!held[code];
  };

  // WASD + arrows as -1..1 axes. Forward is the camera yaw's -Z.
  C.axes = function () {
    var x = 0;
    var y = 0;
    if (held.KeyW || held.ArrowUp) y += 1;
    if (held.KeyS || held.ArrowDown) y -= 1;
    if (held.KeyA || held.ArrowLeft) x -= 1;
    if (held.KeyD || held.ArrowRight) x += 1;
    return { x: x, y: y };
  };

  C.takeLook = function () {
    var d = { dx: look.dx, dy: look.dy };
    look.dx = 0;
    look.dy = 0;
    return d;
  };

  C.takeClick = function () {
    if (!clickPending) return false;
    clickPending = false;
    return true;
  };

  C.clickAgeMs = function () {
    return performance.now() - clickAt;
  };

  C.sprinting = function () {
    return !!(held.ShiftLeft || held.ShiftRight);
  };

  C.braking = function () {
    return !!held.Space;
  };

  C.interact = function () {
    return !!held.KeyE;
  };

  C.pauseKey = function () {
    return !!held.KeyP;
  };

  C.muteKey = function () {
    return !!held.KeyM;
  };

  C.clearLook = function () {
    look.dx = 0;
    look.dy = 0;
  };

  C.clearAll = function () {
    for (var k in held) held[k] = false;
  };

  SOL.controls = C;
})();
