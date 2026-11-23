// SOLMARIS controls — keyboard state, mouse look, clicks. Desktop Chrome.
window.SOL = window.SOL || {};
SOL.controls = (function () {
  var keys = {};
  var lookDX = 0;
  var lookDY = 0;
  var clicked = false;
  var clickedAt = 0;
  var dragging = false;
  var lastX = 0;
  var lastY = 0;
  var pointerLocked = false;

  function onKeyDown(e) {
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
  }
  function onKeyUp(e) { keys[e.code] = false; }
  function onMouseMove(e) {
    if (pointerLocked) {
      lookDX += e.movementX || 0;
      lookDY += e.movementY || 0;
    } else if (dragging) {
      lookDX += (e.clientX - lastX) * 1.6;
      lookDY += (e.clientY - lastY) * 1.6;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  }
  function onMouseDown(e) {
    if (e.button === 0) {
      clicked = true;
      clickedAt = performance.now();
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  }
  function onMouseUp(e) {
    if (e.button === 0) dragging = false;
  }
  function onLockChange() {
    pointerLocked = document.pointerLockElement != null;
  }

  return {
    init: function (canvas) {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mouseup', onMouseUp);
      document.addEventListener('pointerlockchange', onLockChange);
      if (canvas && canvas.requestPointerLock) {
        canvas.addEventListener('click', function () {
          try { canvas.requestPointerLock(); } catch (e) { /* pointer lock is optional */ }
        });
      }
    },
    isDown: function (code) { return !!keys[code]; },
    // WASD + arrows, as -1..1 axes. Forward is -Z of the camera yaw.
    axes: function () {
      var x = 0;
      var y = 0;
      if (keys.KeyW || keys.ArrowUp) y += 1;
      if (keys.KeyS || keys.ArrowDown) y -= 1;
      if (keys.KeyA || keys.ArrowLeft) x -= 1;
      if (keys.KeyD || keys.ArrowRight) x += 1;
      return { x: x, y: y };
    },
    takeLook: function () {
      var d = { dx: lookDX, dy: lookDY };
      lookDX = 0;
      lookDY = 0;
      return d;
    },
    takeClick: function () {
      if (!clicked) return false;
      clicked = false;
      return true;
    },
    clickAgeMs: function () { return performance.now() - clickedAt; },
    running: function () { return !!(keys.ShiftLeft || keys.ShiftRight); },
    handbrake: function () { return !!keys.Space; },
    interactPressed: function () { return !!keys.KeyE; },
    pausePressed: function () { return !!keys.KeyP; },
    mutePressed: function () { return !!keys.KeyM; },
    resetFrame: function () { lookDX = 0; lookDY = 0; },
    clearKeys: function () { keys = {}; }
  };
})();
