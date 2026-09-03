/* ============================================================
   MODO CLARO / OSCURO  (js/theme.js)
   ============================================================
   Proyecto: Expo Educativa 2026 · IES N.° 11

   - Aplica data-tema="claro|oscuro" en <html>.
   - Guarda la preferencia en localStorage ('feria_ies11_tema').
   - Si el usuario nunca eligió, sigue prefers-color-scheme.
   - Engancha cualquier elemento con [data-toggle-tema].
   - Avisa a otros módulos con el evento 'tema:cambio'
     (lo usa dashboard.js para re-colorear los gráficos).

   Se carga en <head> (bloqueante) para evitar parpadeo de color.
   ============================================================ */
(function () {
  'use strict';

  var CLAVE = 'feria_ies11_tema';
  var raiz = document.documentElement;

  function preferido() {
    try {
      var g = localStorage.getItem(CLAVE);
      if (g === 'claro' || g === 'oscuro') return g;
    } catch (e) { /* modo incógnito */ }
    var oscuroSistema = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return oscuroSistema ? 'oscuro' : 'claro';
  }

  function aplicar(tema, persistir) {
    raiz.setAttribute('data-tema', tema);
    if (persistir) {
      try { localStorage.setItem(CLAVE, tema); } catch (e) { /* noop */ }
    }
    document.dispatchEvent(new CustomEvent('tema:cambio', { detail: { tema: tema } }));
  }

  function alternar() {
    var actual = raiz.getAttribute('data-tema') || preferido();
    aplicar(actual === 'oscuro' ? 'claro' : 'oscuro', true);
  }

  // Aplicar cuanto antes (antes del primer paint del body)
  aplicar(preferido(), false);

  // Enganchar botones cuando el DOM esté listo
  function enganchar() {
    var botones = document.querySelectorAll('[data-toggle-tema]');
    for (var i = 0; i < botones.length; i++) {
      botones[i].addEventListener('click', alternar);
      botones[i].setAttribute('title', 'Cambiar modo claro / oscuro');
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enganchar);
  } else {
    enganchar();
  }

  // Reaccionar a cambios del sistema sólo si el usuario no eligió
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      var eligio = false;
      try { eligio = !!localStorage.getItem(CLAVE); } catch (_) {}
      if (!eligio) aplicar(e.matches ? 'oscuro' : 'claro', false);
    });
  }

  window.Tema = { actual: function () { return raiz.getAttribute('data-tema'); }, alternar: alternar, aplicar: aplicar };
})();
