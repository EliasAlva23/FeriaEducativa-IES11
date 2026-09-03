/* ============================================================
   ACCESO AL DASHBOARD  (js/dashboard-auth.js)
   ============================================================
   Protege dashboard.html con un PIN. Sin PIN correcto, el
   contenido queda oculto (data-dash-locked en <html>, ver
   css/styles.css) y a los 3 intentos fallidos redirige a index.html.

   PIN: 'admin11'  (cambialo acá y volvé a subir).

   Aclaración honesta: es una barrera para el stand, NO seguridad
   real. El código y los datos viven en el navegador del visitante.
   ============================================================ */
(function () {
  'use strict';

  var PIN = 'admin11';
  var CLAVE_OK = 'feria_ies11_dash_ok';
  var MAX_INTENTOS = 3;

  function estaAutorizado() {
    try { return localStorage.getItem(CLAVE_OK) === '1'; } catch (e) { return false; }
  }

  function desbloquear() {
    try { localStorage.setItem(CLAVE_OK, '1'); } catch (e) { /* noop */ }
    delete document.documentElement.dataset.dashLocked;
    var gate = document.getElementById('gate-dashboard');
    if (gate) gate.remove();
    // Los gráficos pudieron crearse con el layout oculto: forzar re-medición.
    window.setTimeout(function () {
      window.dispatchEvent(new Event('resize'));
    }, 60);
  }

  function init() {
    // Ya autorizado en este equipo: no mostrar la reja.
    if (estaAutorizado()) {
      delete document.documentElement.dataset.dashLocked;
      var g = document.getElementById('gate-dashboard');
      if (g) g.remove();
      return;
    }

    var form = document.getElementById('gate-form');
    var input = document.getElementById('gate-pin');
    var error = document.getElementById('gate-error');
    if (!form || !input) return;

    var intentos = 0;
    input.focus();

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (input.value === PIN) {
        desbloquear();
        return;
      }
      intentos += 1;
      input.value = '';
      if (intentos >= MAX_INTENTOS) {
        window.location.replace('index.html');
        return;
      }
      if (error) {
        error.hidden = false;
        error.textContent = 'Clave incorrecta. Te quedan ' + (MAX_INTENTOS - intentos) +
          (MAX_INTENTOS - intentos === 1 ? ' intento.' : ' intentos.');
      }
      input.focus();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
