/* ============================================================
   CANAL EN TIEMPO REAL  (js/realtime.js)
   ============================================================
   Proyecto: Expo Educativa 2026 · IES N.° 11 (Jujuy, Argentina)

   Aísla el "cómo viajan los datos". app.js y dashboard.js sólo
   hablan con window.Realtime:

     Realtime.publicar(registro)       -> emite un test completado.
     Realtime.suscribirse(cb)          -> cb(registro) por cada test nuevo.
     Realtime.suscribirseAReinicio(cb) -> cb() cuando se limpia el historial.
     Realtime.obtenerHistorial()       -> array acumulado (deduplicado).
     Realtime.reiniciar()              -> limpia el historial del stand.
     Realtime.estadoRemoto()           -> 'conectado' | 'sin-conexion' | 'local'

   ------------------------------------------------------------
   TRANSPORTE (multi-dispositivo, sin registrarse en nada):
     - ntfy.sh (https://ntfy.sh/<TOPIC>) como bus público en tiempo real:
         * publicar  = POST al tópico
         * escuchar  = EventSource (SSE) a /<TOPIC>/sse
         * backfill  = GET /<TOPIC>/json?poll=1&since=all  (caché ~12 h)
       El celular del alumno (4G/WiFi) publica y la netbook del stand,
       suscripta al mismo tópico, recibe al instante.
     - localStorage: espejo local -> el historial completo sobrevive
       recargas y cortes de internet (ntfy sólo cachea ~12 h).
     - BroadcastChannel: sincronización instantánea entre pestañas del
       mismo equipo (y respaldo si no hay internet).

   ⚠️ El tópico ntfy es PÚBLICO: cualquiera que sepa el nombre puede
   leer/escribir. Por eso lleva un sufijo aleatorio. Para "resetear"
   el canal de raíz, cambiá el sufijo de TOPIC (abajo) y volvé a subir.
   No enviar datos sensibles.
   ============================================================ */

(function () {
  'use strict';

  // === Configuración ========================================
  const TOPIC_BASE = 'expo-ies11-2026-vocacional';
  const SUFIJO_DEFECTO = '9b3f2a';                     // cambialo (y volvé a subir) para arrancar de cero
  const NTFY_BASE = 'https://ntfy.sh';
  const CLAVE_STORAGE = 'feria_ies11_resultados';
  const CLAVE_RESET = 'feria_ies11_reset_at';
  const CLAVE_SUFIJO = 'feria_ies11_topic_sufijo';     // override local opcional (Realtime.rotarCanal())
  const NOMBRE_CANAL = 'feria-ies11';
  const MAX_HISTORIAL = 2000;
  // =========================================================

  function sufijoActivo() {
    try {
      const s = window.localStorage.getItem(CLAVE_SUFIJO);
      if (s && /^[a-z0-9-]{3,40}$/.test(s)) return s;
    } catch (e) { /* noop */ }
    return SUFIJO_DEFECTO;
  }
  const TOPIC = `${TOPIC_BASE}-${sufijoActivo()}`;

  function crearAdaptador() {
    const suscriptores = [];
    const suscriptoresReinicio = [];
    const vistos = new Set();          // ids ya procesados (dedupe)
    let estadoRemoto = 'local';        // 'conectado' | 'sin-conexion' | 'local'
    let fuente = null;                 // EventSource

    const soportaBC = typeof window.BroadcastChannel === 'function';
    const canal = soportaBC ? new BroadcastChannel(NOMBRE_CANAL) : null;

    // --- localStorage (tolerante a fallos / incógnito) ---
    function leer() {
      try {
        const datos = JSON.parse(window.localStorage.getItem(CLAVE_STORAGE) || '[]');
        return Array.isArray(datos) ? datos : [];
      } catch (e) { return []; }
    }
    function guardar(lista) {
      try {
        const rec = lista.slice(-MAX_HISTORIAL);
        window.localStorage.setItem(CLAVE_STORAGE, JSON.stringify(rec));
        return rec;
      } catch (e) { return lista; }
    }
    function resetAt() {
      try { return parseInt(window.localStorage.getItem(CLAVE_RESET) || '0', 10) || 0; }
      catch (e) { return 0; }
    }
    function marcarReset(ts) {
      try { window.localStorage.setItem(CLAVE_RESET, String(ts)); } catch (e) { /* noop */ }
    }

    // --- reconstruir el índice de vistos desde el espejo ---
    leer().forEach((r) => { if (r && r.id) vistos.add(r.id); });

    // --- notificaciones locales ---
    function emitirNuevo(registro) {
      suscriptores.forEach((cb) => {
        try { cb(registro); } catch (e) { console.error('[realtime.js] suscriptor falló:', e); }
      });
    }
    function emitirReinicio() {
      suscriptoresReinicio.forEach((cb) => {
        try { cb(); } catch (e) { console.error('[realtime.js] suscriptor(reinicio) falló:', e); }
      });
    }

    /**
     * Procesa un registro entrante (de donde sea). Deduplica por id,
     * lo guarda en el espejo y avisa a los suscriptores si es nuevo.
     */
    function ingerir(registro, { emitir = true } = {}) {
      if (!registro || !registro.id) return false;
      if ((registro.timestamp || 0) <= resetAt()) { vistos.add(registro.id); return false; }
      if (vistos.has(registro.id)) return false;

      // Dedupe contra el ESPEJO (localStorage se comparte entre pestañas
      // del mismo origen; otra pestaña pudo haberlo guardado ya).
      const historial = leer();
      if (historial.some((r) => r && r.id === registro.id)) {
        vistos.add(registro.id);
        return false;
      }

      vistos.add(registro.id);
      historial.push(registro);
      historial.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      guardar(historial);
      if (emitir) emitirNuevo(registro);
      return true;
    }

    function aplicarReinicio(ts) {
      marcarReset(ts || Date.now());
      vistos.clear();
      guardar([]);
      emitirReinicio();
    }

    // --- envoltura de mensajes del bus ---
    function procesarEnvoltura(env, origen) {
      if (!env || typeof env !== 'object') return;
      if (env.tipo === 'reiniciar') {
        const ts = env.at || Date.now();
        if (ts > resetAt()) aplicarReinicio(ts);
        return;
      }
      if (env.tipo === 'resultado' && env.registro) {
        ingerir(env.registro);
      }
    }

    // === BroadcastChannel (mismo equipo) =====================
    if (canal) {
      canal.onmessage = (ev) => procesarEnvoltura(ev.data, 'bc');
    } else {
      window.addEventListener('storage', (ev) => {
        if (ev.key === CLAVE_RESET) { vistos.clear(); emitirReinicio(); return; }
        if (ev.key !== CLAVE_STORAGE) return;
        let lista = [];
        try { lista = ev.newValue ? JSON.parse(ev.newValue) : []; } catch (_) { lista = []; }
        const ultimo = lista[lista.length - 1];
        if (ultimo && !vistos.has(ultimo.id)) { vistos.add(ultimo.id); emitirNuevo(ultimo); }
      });
    }

    // === ntfy.sh (multi-dispositivo) =========================
    function backfillRemoto() {
      return fetch(`${NTFY_BASE}/${encodeURIComponent(TOPIC)}/json?poll=1&since=all`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.text() : ''))
        .then((txt) => {
          txt.split('\n').filter(Boolean).forEach((linea) => {
            let m;
            try { m = JSON.parse(linea); } catch (_) { return; }
            if (m.event !== 'message' || !m.message) return;
            let env;
            try { env = JSON.parse(m.message); } catch (_) { return; }
            procesarEnvoltura(env, 'backfill');
          });
        })
        .catch(() => { /* sin internet: seguimos con el espejo local */ });
    }

    function abrirStreamRemoto() {
      if (typeof window.EventSource !== 'function') return;
      // Pedir también el backlog reciente para cubrir el hueco entre
      // "page load" y "SSE abierto" (los reintentos usan Last-Event-ID).
      const hist = leer();
      const ultimo = hist.length ? (hist[hist.length - 1].timestamp || 0) : 0;
      const desde = Math.max(resetAt(), ultimo);
      const since = desde ? `?since=${Math.floor(desde / 1000)}` : '?since=12h';
      try {
        fuente = new EventSource(`${NTFY_BASE}/${encodeURIComponent(TOPIC)}/sse${since}`);
      } catch (e) { estadoRemoto = 'sin-conexion'; return; }

      fuente.onopen = () => { estadoRemoto = 'conectado'; };
      fuente.onerror = () => {
        estadoRemoto = 'sin-conexion';
        // EventSource reintenta solo; nada que hacer acá.
      };
      fuente.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch (_) { return; }
        if (m.event === 'open') { estadoRemoto = 'conectado'; return; }
        if (m.event !== 'message' || !m.message) return;
        let env;
        try { env = JSON.parse(m.message); } catch (_) { return; }
        procesarEnvoltura(env, 'sse');
      };
    }

    function publicarRemoto(envoltura) {
      // text/plain (no application/json): así ntfy deja el JSON en el
      // campo "message" en vez de tratarlo como archivo adjunto.
      // text/plain es "CORS-safelisted" => request simple, sin preflight.
      return fetch(`${NTFY_BASE}/${encodeURIComponent(TOPIC)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(envoltura),
        keepalive: true,
      }).catch(() => { estadoRemoto = 'sin-conexion'; });
    }

    let streamIniciado = false;
    function asegurarStream() {
      if (streamIniciado) return;
      streamIniciado = true;
      abrirStreamRemoto();   // inmediato, para no perder mensajes
      backfillRemoto();      // en paralelo (relleno inicial, deduplicado)
    }

    // === API pública ========================================
    return {
      publicar(registro) {
        const envoltura = { v: 1, tipo: 'resultado', registro };
        ingerir(registro);                       // espejo local + suscriptores locales
        if (canal) canal.postMessage(envoltura); // otras pestañas
        publicarRemoto(envoltura);               // otros dispositivos (ntfy)
        return registro;
      },

      suscribirse(callback) {
        if (typeof callback === 'function') suscriptores.push(callback);
        asegurarStream();
        return () => {
          const i = suscriptores.indexOf(callback);
          if (i >= 0) suscriptores.splice(i, 1);
        };
      },

      suscribirseAReinicio(callback) {
        if (typeof callback === 'function') suscriptoresReinicio.push(callback);
      },

      obtenerHistorial() {
        return leer();
      },

      reiniciar() {
        const at = Date.now();
        aplicarReinicio(at);
        const envoltura = { v: 1, tipo: 'reiniciar', at };
        if (canal) canal.postMessage(envoltura);
        publicarRemoto(envoltura);
      },

      /**
       * Rota el canal a un tópico nuevo (sufijo aleatorio guardado localmente)
       * y limpia el espejo. Devuelve el nuevo sufijo. Hay que RECARGAR la página
       * y — ojo — los celulares seguirán publicando al tópico por defecto salvo
       * que también se actualice el QR / el código. Para la jornada oficial es
       * preferible cambiar SUFIJO_DEFECTO en el código y volver a subir.
       */
      rotarCanal() {
        const nuevo = 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        try { window.localStorage.setItem(CLAVE_SUFIJO, nuevo); } catch (e) { /* noop */ }
        aplicarReinicio(Date.now());
        return nuevo;
      },

      estadoRemoto() {
        return estadoRemoto;
      },

      _config: { TOPIC, NTFY_BASE, sufijo: sufijoActivo() },
    };
  }

  // Compatibilidad: la fábrica anterior seguía nombrándose así.
  window.RealtimeFactory = { crearAdaptador, crearAdaptadorLocal: crearAdaptador };
  window.Realtime = crearAdaptador();
})();
