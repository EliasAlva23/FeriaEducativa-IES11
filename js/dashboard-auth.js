/* ============================================================
   ACCESO AL DASHBOARD  (js/dashboard-auth.js)
   ============================================================
   Protege dashboard.html con un PIN, a prueba de fallos:

   - <html> arranca con data-dash-locked="1" y <header>/<main>/<footer>/
     #toasts arrancan con el atributo [hidden] EN EL MARKUP: el panel
     queda oculto aunque fallen Tailwind, styles.css o JavaScript.
   - Un <script> inline en <head> pre-desbloquea (quita data-dash-locked
     y agrega data-dash-ok) sólo si hay sesión válida en localStorage o
     sessionStorage — así no hay parpadeo del login.
   - Este archivo termina de mostrar los contenedores (quita [hidden]) y
     gestiona la tarjeta de login: valida el PIN, guarda la sesión y, a
     los 3 intentos fallidos, redirige a index.html.

   PIN: 'admin11'  (cambialo acá y volvé a subir).
   Barrera para el stand, NO seguridad real: el código y los datos viven
   en el navegador del visitante.
   ============================================================ */
(function () {
  'use strict';

  var PIN = 'admin11';
  var CLAVE_OK = 'feria_ies11_dash_ok';
  var MAX_INTENTOS = 3;
  var CONTENEDORES = ['dash-header', 'dash-main', 'dash-footer', 'toasts'];

  function leerFlag(store) {
    try { return store && store.getItem(CLAVE_OK) === '1'; } catch (e) { return false; }
  }

  function estaAutorizado() {
    return leerFlag(window.localStorage) || leerFlag(window.sessionStorage);
  }

  function guardarSesion() {
    try { window.localStorage.setItem(CLAVE_OK, '1'); } catch (e) { /* noop */ }
    try { window.sessionStorage.setItem(CLAVE_OK, '1'); } catch (e) { /* noop */ }
  }

  function mostrarPanel() {
    var raiz = document.documentElement;
    raiz.removeAttribute('data-dash-locked');
    raiz.setAttribute('data-dash-ok', '1');
    CONTENEDORES.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = false;
    });
    var gate = document.getElementById('gate-dashboard');
    if (gate) gate.remove();
    // Los gráficos pudieron crearse con el layout oculto: forzar re-medición.
    window.setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 60);
  }

  function bloquearPanel() {
    document.documentElement.setAttribute('data-dash-locked', '1');
    document.documentElement.removeAttribute('data-dash-ok');
    CONTENEDORES.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  }

  function init() {
    if (estaAutorizado()) {
      mostrarPanel();
      return;
    }

    bloquearPanel(); // por las dudas: sin sesión, todo oculto y sólo la reja

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
        error.textContent = 'Clave incorrecta. Te queda' +
          (restan === 1 ? ' 1 intento.' : 'n ' + restan + ' intentos.');
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
