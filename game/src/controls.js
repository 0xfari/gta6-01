// SOLMARIS v4 — controls.js: keyboard state, mouse look, clicks. Desktop
// Chrome. Pointer lock when the player clicks the canvas; drag-to-look as
// the fallback (and what headless screenshots use). Space is prevented from
// scrolling the page. Clicks are edge-triggered: takeClick() consumes them.
(function () {
  const C = {};
  const held = {};
  let lookX = 0;
  let lookY = 0;
  let clickQueued = false;
  let clickTime = 0;
  let dragging = false;
  let dragX = 0;
  let dragY = 0;
  let locked = false;

  function onKeyDown(e) {
    held[e.code] = true;
    if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
  }
  function onKeyUp(e) { held[e.code] = false; }

  function onMouseMove(e) {
    if (locked) {
      lookX += e.movementX || 0;
      lookY += e.movementY || 0;
    } else if (dragging) {
      lookX += (e.clientX - dragX) * 1.5;
      lookY += (e.clientY - dragY) * 1.5;
      dragX = e.clientX;
      dragY = e.clientY;
    }
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    clickQueued = true;
    clickTime = performance.now();
    dragging = true;
    dragX = e.clientX;
    dragY = e.clientY;
  }
  function onMouseUp(e) { if (e.button === 0) dragging = false; }

  C.init = function (canvas) {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('pointerlockchange', function () {
      locked = document.pointerLockElement != null;
    });
    if (canvas && canvas.requestPointerLock) {
      canvas.addEventListener('click', function () {
        try { canvas.requestPointerLock(); } catch (e) { /* pointer lock is optional */ }
      });
    }
  };

  C.down = function (code) { return !!held[code]; };

  // WASD + arrows as -1..1 axes. Forward is -Z of the camera yaw.
  C.axes = function () {
    let x = 0;
    let y = 0;
    if (held.KeyW || held.ArrowUp) y += 1;
    if (held.KeyS || held.ArrowDown) y -= 1;
    if (held.KeyA || held.ArrowLeft) x -= 1;
    if (held.KeyD || held.ArrowRight) x += 1;
    return { x: x, y: y };
  };

  C.takeLook = function () {
    const d = { dx: lookX, dy: lookY };
    lookX = 0;
    lookY = 0;
    return d;
  };

  C.takeClick = function () {
    if (!clickQueued) return false;
    clickQueued = false;
    return true;
  };

  C.clickAgeMs = function () { return performance.now() - clickTime; };
  C.sprinting = function () { return !!(held.ShiftLeft || held.ShiftRight); };
  C.braking = function () { return !!held.Space; };
  C.interact = function () { return !!held.KeyE; };
  C.pauseKey = function () { return !!held.KeyP; };
  C.muteKey = function () { return !!held.KeyM; };
  C.clearLook = function () { lookX = 0; lookY = 0; };
  C.clearAll = function () { for (const k in held) held[k] = false; };

  SOL.controls = C;
})();
