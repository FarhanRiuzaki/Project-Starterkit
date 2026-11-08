/**
 * A press made before React handles a button (the page is painted from the server HTML while its JS is still on the
 * way, on a slow network or device) does nothing: the menu doesn't open, the button doesn't act. EARLY_PRESS_SCRIPT
 * runs inline in <head> (app/layout.tsx), before any bundle, and keeps the last such press. It presses that button
 * again (pointer down, then click: a menu trigger opens on pointer down, every other button on click) once both hold,
 * checked every 50 ms by a timer (no animation frame runs while app/layout.tsx still blocks rendering):
 * - the root has committed its hydration (Providers' effect calls `__earlyPressCommitted`): React DOM sets its key on a
 *   node while rendering, and drops an event on a node it has rendered but not committed;
 * - React has reached that button (`__reactProps$`, React DOM's key on a node it handles): a part that hydrates after
 *   the root (a streamed page) may still wait for its code, and React drops an event it can't hydrate for.
 * - Kept: every press on a button until the root has committed (React handles none before), then a press on a button
 *   React hasn't reached. It listens on `window` in the bubble phase, after React's listeners on the document, so a
 *   press React handled itself (it hydrates a part synchronously when that part's code is there) finds the button
 *   hydrated and is left alone, and so are presses on a hydrated page and the replayed press.
 * - Dropped: a press older than EARLY_PRESS_MAX_AGE_MS (the user has moved on), a button gone or disabled since, and a
 *   form's submit button (the browser submits the form natively). Links need nothing: the browser follows them.
 * - Only the last press counts, so pressing twice while nothing happened acts once.
 *
 * Plain ES5, no `</script`. early-press.test.ts runs this exact string; tests/e2e/ux-patterns.spec.ts "a press before
 * the JS arrives" fails if a React upgrade renames the key.
 */
export const EARLY_PRESS_MAX_AGE_MS = 5000;

export const EARLY_PRESS_SCRIPT = `(function () {
  var press = null, committed = false;
  window.__earlyPressCommitted = function () { committed = true; };
  function ready(b) { return Object.keys(b).some(function (k) { return k.indexOf("__reactProps$") === 0; }); }
  function tick() {
    var b = press.b;
    if (Date.now() - press.t > ${EARLY_PRESS_MAX_AGE_MS} || !b.isConnected || b.disabled) { press = null; return; }
    if (!committed || !ready(b)) { setTimeout(tick, 50); return; }
    press = null;
    b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, pointerType: "mouse", isPrimary: true }));
    b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  }
  addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!b || (committed && ready(b)) || (b.form && b.type === "submit")) return;
    var waiting = press !== null;
    press = { b: b, t: Date.now() };
    if (!waiting) setTimeout(tick, 50);
  });
})()`;
