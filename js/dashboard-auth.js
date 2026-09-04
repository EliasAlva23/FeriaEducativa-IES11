/* ============================================================
   ACCESO AL DASHBOARD  (js/dashboard-auth.js)
   ============================================================
   Protege dashboard.html con un PIN.

   - <html> arranca con data-dash-locked="1" en el markup: el panel
     queda oculto por CSS aunque JavaScript esté deshabilitado.
   - Un <script> inline en <head> quita el atributo antes del primer
     paint SÓLO si hay sesión válida (localStorage o sessionStorage).
   - Este archivo dibuja/gestiona la tarjeta de login: valida el PIN,
     guarda la sesión y, a los 3 intentos fallidos, redirige a index.html.

   PIN: 'admin11'  (cambialo acá y volvé a subir).

   Aclaración honesta: es una barrera para el stand, NO seguridad real.
   El código y los datos viven en el navegador del visitante.
   ============================================================ */
(function () {
  'use strict';

  var PIN = 'admin11';
  var CLAVE_OK = 'feria_ies11_dash_ok';
  var MAX_INTENTOS = 3;

  function leerFlag(store) {
    try { return store && store.getItem(CLAVE_OK) === '1'; } catch (e) { return false; }
  }

  function estaAutorizado() {
    return leerFlag(window.localStorage) || leerFlag(window.sessionStorage);
  }

  function guardarSesion() {
    // localStorage = "recordar esta netbook"; sessionStorage = respaldo por pestaña.
    try { window.localStorage.setItem(CLAVE_OK, '1'); } catch (e) { /* noop */ }
    try { window.sessionStorage.setItem(CLAVE_OK, '1'); } catch (e) { /* noop */ }
  }

  function mostrarPanel() {
    document.documentElement.removeAttribute('data-dash-locked');
    var gate = document.getElementById('gate-dashboard');
    if (gate) gate.remove();
    // Los gráficos pudieron crearse con el layout oculto: forzar re-medición.
    window.setTimeout(function () {
      window.dispatchEvent(new Event('resize'));
    }, 60);
  }

  function init() {
    if (estaAutorizado()) {
      mostrarPanel();
      return;
    }

    // Sin sesión: el panel sigue bloqueado y sólo se ve la tarjeta de login.
    document.documentElement.setAttribute('data-dash-locked', '1');

    var form = document.getElementById('gate-form');
    var input = document.getElementById('gate-pin');
    var error = document.getElementById('gate-error');
    if (!form || !input) return;

    var intentos = 0;
    input.focus();

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (input.value === PIN) {
        guardarSesion();
        mostrarPanel();
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
        var restan = MAX_INTENTOS - intentos;
        error.textContent = 'Clave incorrecta. Te queda' + (restan === 1 ? ' 1 intento.' : 'n ' + restan + ' intentos.');
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
