/* ============================================================
   LÓGICA DEL DASHBOARD EN VIVO  (js/dashboard.js)
   ============================================================
   Proyecto: Expo Educativa 2026 · IES N.° 11 (Jujuy, Argentina)
   Pantalla Gigante.

   Funciones:
     1) Carga el historial (Realtime.obtenerHistorial()) y se suscribe
        a los tests nuevos (Realtime.suscribirse()).
     2) Métrica principal: "XX estudiantes ya descubrieron su vocación hoy".
     3) PODIO TOP 3 (🥇 🥈 🥉) con las tecnicaturas más elegidas.
     4) Gráfico de barras multicolor (color por Área Vocacional) de las 18.
     5) Gráfico de dona: perfil dominante por área + leyenda.
     6) Feed de actividad + notificaciones flotantes.
     7) Filtro por Jornada: Global / Día 1 / Día 2 / Día 3.
     8) Exportar Dataset CSV (protegido por clave, ';' + UTF-8).

   Depende de: js/questions.js, js/realtime.js, Chart.js
   ============================================================ */

(function () {
  'use strict';

  const { AREAS = [], CARRERAS = [] } = window.TEST_VOCACIONAL || {};
  const AREA_POR_ID = Object.fromEntries(AREAS.map((a) => [a.id, a]));
  const CARRERA_POR_ID = Object.fromEntries(CARRERAS.map((c) => [c.id, c]));

  const MAX_FEED = 8;
  const TOAST_MS = 5000;
  const CLAVE_EXPORT = 'admin11';   // clave para descargar el CSV

  // ----------------------------------------------------------
  // Estado
  // ----------------------------------------------------------
  let historial = [];               // TODOS los registros (sin filtrar)
  let filtroJornada = 'global';     // 'global' | 'd1' | 'd2' | 'd3'

  const agregado = {
    total: 0,
    porArea: Object.fromEntries(AREAS.map((a) => [a.id, 0])),
    porCarrera: Object.fromEntries(CARRERAS.map((c) => [c.id, 0])),
    recientes: [],
  };

  const graficos = { areas: null, carreras: null };
  const dom = {};

  // ==========================================================
  // Utilidades
  // ==========================================================
  function nombreCorto(carrera) {
    return (carrera.nombre || '').replace(/^Tecnicatura Superior en\s+/i, '');
  }

  function areaDominante(registro) {
    if (registro.top3 && registro.top3[0] && registro.top3[0].area) return registro.top3[0].area;
    const pares = Object.entries(registro.puntajesArea || {});
    return pares.length ? pares.sort((a, b) => b[1] - a[1])[0][0] : null;
  }

  function nombrePila(participante) {
    if (!participante) return 'Alguien';
    const n = (participante.nombre || '').trim();
    const a = (participante.apellido || '').trim();
    return n && a ? `${n} ${a.charAt(0)}.` : (n || 'Alguien');
  }

  /** Fecha LOCAL (AAAA-MM-DD) de un registro, para agrupar por jornada. */
  function fechaDe(registro) {
    const t = Number.isFinite(registro.timestamp)
      ? registro.timestamp
      : (registro.fechaISO ? Date.parse(registro.fechaISO) : NaN);
    if (!Number.isFinite(t)) return '';
    const d = new Date(t);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  /** Fechas distintas presentes en el historial, ordenadas (Día 1, 2, 3…). */
  function jornadas() {
    return [...new Set(historial.map(fechaDe).filter(Boolean))].sort();
  }

  // ==========================================================
  // Carga + suscripción
  // ==========================================================
  function cargarHistorial() {
    let bruto = [];
    try { bruto = window.Realtime.obtenerHistorial() || []; }
    catch (e) { console.error('[dashboard.js] No se pudo leer el historial:', e); }
    // dedupe defensivo por id
    const vistos = new Set();
    historial = bruto.filter((r) => r && r.id && !vistos.has(r.id) && vistos.add(r.id));
    poblarSelectorJornada();
    recomputar(false);
    console.info('[dashboard.js] Historial cargado:', historial.length, 'registros.');
  }

  function suscribirse() {
    try {
      window.Realtime.suscribirse(onNuevoResultado);
      if (typeof window.Realtime.suscribirseAReinicio === 'function') {
        window.Realtime.suscribirseAReinicio(onReinicio);
      }
    } catch (e) {
      console.error('[dashboard.js] No se pudo suscribir a Realtime:', e);
    }
  }

  function onNuevoResultado(registro) {
    if (registro && registro.id && historial.some((r) => r && r.id === registro.id)) return;
    historial.push(registro);
    poblarSelectorJornada();
    recomputar(true);
    lanzarToast(registro);
  }

  function onReinicio() {
    historial = [];
    poblarSelectorJornada();
    recomputar(true);
  }

  // ==========================================================
  // Recomputar el agregado según el filtro de jornada
  // ==========================================================
  function registrosFiltrados() {
    if (filtroJornada === 'global') return historial;
    const dias = jornadas();
    const idx = { d1: 0, d2: 1, d3: 2 }[filtroJornada];
    const fecha = dias[idx];
    return fecha ? historial.filter((r) => fechaDe(r) === fecha) : [];
  }

  function recomputar(animar) {
    const lista = registrosFiltrados();

    agregado.total = lista.length;
    Object.keys(agregado.porArea).forEach((k) => { agregado.porArea[k] = 0; });
    Object.keys(agregado.porCarrera).forEach((k) => { agregado.porCarrera[k] = 0; });

    lista.forEach((r) => {
      const area = areaDominante(r);
      if (area && area in agregado.porArea) agregado.porArea[area] += 1;
      (r.top3 || []).forEach((c) => {
        if (c.carreraId in agregado.porCarrera) agregado.porCarrera[c.carreraId] += 1;
      });
    });

    agregado.recientes = lista.slice(-MAX_FEED).reverse();

    refrescarContador(animar);
    refrescarFeed();
    refrescarPodio();
    refrescarGraficos(animar);
    refrescarVistaDetallada();
  }

  // ==========================================================
  // Conmutador de vista + Vista Detallada (18 tecnicaturas)
  // ==========================================================
  function setVista(v) {
    const detallada = v === 'detallada';
    if (dom.vistaGeneral) dom.vistaGeneral.hidden = detallada;
    if (dom.vistaDetallada) dom.vistaDetallada.hidden = !detallada;
    (dom.btnsVista || []).forEach((b) => {
      const activa = b.dataset.vista === v;
      b.classList.toggle('is-activa', activa);
      b.setAttribute('aria-selected', String(activa));
    });
    if (!detallada) {
      // al volver a General, los canvas pudieron estar ocultos
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    }
  }

  function refrescarVistaDetallada() {
    if (!dom.detalleLista) return;
    const total = agregado.total || 0;
    if (dom.detalleTotal) dom.detalleTotal.textContent = String(total);

    const filas = CARRERAS
      .map((c, orden) => ({ c, orden, votos: agregado.porCarrera[c.id] || 0 }))
      .sort((a, b) => b.votos - a.votos || a.orden - b.orden);

    dom.detalleLista.innerHTML = filas.map((f, i) => {
      const area = AREA_POR_ID[f.c.area] || { nombre: '—', color: '#64748b' };
      const pct = total ? Math.round((f.votos / total) * 100) : 0;
      return `
        <div class="detalle-fila">
          <span class="detalle-rank">${i + 1}</span>
          <span class="detalle-punto" style="background:${area.color}"></span>
          <span class="detalle-datos">
            <span class="detalle-nombre">${nombreCorto(f.c)}</span>
            <span class="detalle-area" style="color:${area.color}">${area.nombre}</span>
          </span>
          <span class="detalle-barra"><span style="width:${pct}%;background:${area.color}"></span></span>
          <span class="detalle-votos">${f.votos}</span>
          <span class="detalle-pct">${pct}%</span>
        </div>`;
    }).join('');
  }

  // ==========================================================
  // Métrica principal + contador
  // ==========================================================
  function refrescarContador(animar) {
    dom.contador.textContent = String(agregado.total);
    if (animar && dom.contador) {
      dom.contador.classList.remove('kpi-pulse');
      void dom.contador.offsetWidth;
      dom.contador.classList.add('kpi-pulse');
    }
  }

  // ==========================================================
  // PODIO TOP 3
  // ==========================================================
  function refrescarPodio() {
    if (!dom.podio) return;
    const medallas = ['🥇', '🥈', '🥉'];

    const ranking = CARRERAS
      .map((c, orden) => ({ c, orden, valor: agregado.porCarrera[c.id] || 0 }))
      .sort((a, b) => b.valor - a.valor || a.orden - b.orden)
      .slice(0, 3);

    dom.podio.innerHTML = ranking.map((f, i) => {
      const area = AREA_POR_ID[f.c.area] || { nombre: '', color: '#64748b' };
      const vacio = f.valor === 0;
      return `
        <div class="podio-item ${vacio ? 'podio-item--vacio' : ''}">
          <span class="podio-medalla">${medallas[i]}</span>
          <span class="podio-datos">
            <span class="podio-nombre">${vacio ? 'Sin elecciones todavía' : nombreCorto(f.c)}</span>
            <span class="podio-area" style="color:${area.color}">${vacio ? '—' : area.nombre}</span>
          </span>
          <span class="podio-valor">${f.valor}</span>
        </div>`;
    }).join('');
  }

  // ==========================================================
  // Feed + toasts
  // ==========================================================
  function refrescarFeed() {
    if (!agregado.recientes.length) {
      dom.feed.innerHTML = '<li class="texto-suave">Esperando el primer test…</li>';
      return;
    }
    dom.feed.innerHTML = agregado.recientes.map((r) => {
      const area = AREA_POR_ID[areaDominante(r)] || { nombre: '—', color: '#64748b' };
      const top1 = (r.top3 && r.top3[0] && r.top3[0].nombre) || '';
      return `
        <li>
          <span class="feed-punto" style="background:${area.color}"></span>
          <span class="min-w-0">
            <span class="feed-nombre">${nombrePila(r.participante)}</span>
            <span class="feed-meta"> · ${r.participante?.localidad || 'Jujuy'}</span>
            <span class="feed-meta block truncate text-xs">${nombreCorto({ nombre: top1 })}</span>
          </span>
        </li>`;
    }).join('');
  }

  function lanzarToast(registro) {
    const localidad = registro.participante?.localidad || 'Jujuy';
    const area = AREA_POR_ID[areaDominante(registro)] || { color: '#6366f1' };

    while (dom.toasts.children.length >= 3) dom.toasts.firstElementChild.remove();

    const el = document.createElement('div');
    el.className = 'toast';
    el.style.borderLeft = `4px solid ${area.color}`;
    el.innerHTML = `
      <p class="toast__titulo">¡Alguien de ${localidad} descubrió su vocación!</p>
      <p class="toast__sub">${nombreCorto({ nombre: (registro.top3?.[0]?.nombre) || '' })}</p>`;

    dom.toasts.appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast--visible'));

    window.setTimeout(() => {
      el.classList.remove('toast--visible');
      el.addEventListener('transitionend', () => el.remove(), { once: true });
      window.setTimeout(() => el.remove(), 600);
    }, TOAST_MS);
  }

  // ==========================================================
  // Gráficos
  // ==========================================================
  function tokenCSS(nombre, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
    return v || fallback;
  }

  function aplicarTemaAGraficos() {
    if (typeof Chart === 'undefined') return;
    const texto = tokenCSS('--texto-suave', '#5b6b7e');
    const grilla = tokenCSS('--borde', 'rgba(148,163,184,0.2)');
    const separador = tokenCSS('--bg-solido', '#ffffff');

    Chart.defaults.color = texto;
    if (graficos.areas) {
      graficos.areas.data.datasets[0].borderColor = separador;
      graficos.areas.update('none');
    }
    if (graficos.carreras) {
      const ejes = graficos.carreras.options.scales;
      ejes.x.grid.color = grilla;
      ejes.x.ticks.color = texto;
      ejes.y.ticks.color = texto;
      graficos.carreras.update('none');
    }
  }

  function initGraficos() {
    if (typeof Chart === 'undefined') {
      console.error('[dashboard.js] Chart.js no está disponible.');
      return;
    }

    Chart.defaults.color = tokenCSS('--texto-suave', '#5b6b7e');
    Chart.defaults.font.family =
      '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    Chart.defaults.font.size = 13;

    // Dona: perfil dominante por área
    graficos.areas = new Chart(dom.canvasAreas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: AREAS.map((a) => a.nombre),
        datasets: [{
          data: AREAS.map((a) => agregado.porArea[a.id] || 0),
          backgroundColor: AREAS.map((a) => a.color),
          borderColor: tokenCSS('--bg-solido', '#ffffff'),
          borderWidth: 3,
          hoverOffset: 10,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        animation: { duration: 700, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((s, n) => s + n, 0) || 1;
                const pct = Math.round((ctx.parsed / total) * 100);
                return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
              },
            },
          },
        },
      },
    });

    // Barras horizontales multicolor: las 18 tecnicaturas
    graficos.carreras = new Chart(dom.canvasCarreras.getContext('2d'), {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Apariciones en Top 3', data: [], backgroundColor: [], borderRadius: 6 }] },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 650, easing: 'easeOutQuart' },
        animations: { x: { from: 0 } },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(148,163,184,0.15)' } },
          y: { grid: { display: false }, ticks: { autoSkip: false, font: { size: 12 } } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => {
                const id = ctx.dataset._ids ? ctx.dataset._ids[ctx.dataIndex] : null;
                const c = id && CARRERA_POR_ID[id];
                return c ? (AREA_POR_ID[c.area] || {}).nombre || '' : '';
              },
            },
          },
        },
      },
    });

    refrescarGraficos(false);
    refrescarLeyendaAreas();
    aplicarTemaAGraficos();
  }

  function refrescarGraficos(animar) {
    const modo = animar ? undefined : 'none';

    if (graficos.areas) {
      graficos.areas.data.datasets[0].data = AREAS.map((a) => agregado.porArea[a.id] || 0);
      graficos.areas.update(modo);
    }

    if (graficos.carreras) {
      // Todas las 18, ordenadas por demanda; cada barra con el color de SU área.
      const filas = CARRERAS
        .map((c, orden) => ({ c, orden, valor: agregado.porCarrera[c.id] || 0 }))
        .sort((a, b) => b.valor - a.valor || a.orden - b.orden);

      graficos.carreras.data.labels = filas.map((f) => nombreCorto(f.c));
      graficos.carreras.data.datasets[0].data = filas.map((f) => f.valor);
      graficos.carreras.data.datasets[0].backgroundColor = filas.map(
        (f) => (AREA_POR_ID[f.c.area] || {}).color || '#64748b'
      );
      graficos.carreras.data.datasets[0]._ids = filas.map((f) => f.c.id);
      graficos.carreras.update(modo);
    }

    refrescarLeyendaAreas();
  }

  function refrescarLeyendaAreas() {
    if (!dom.leyendaAreas) return;
    const total = Object.values(agregado.porArea).reduce((s, n) => s + n, 0) || 1;
    dom.leyendaAreas.innerHTML = AREAS.map((a) => {
      const v = agregado.porArea[a.id] || 0;
      const pct = Math.round((v / total) * 100);
      return `
        <li>
          <span><span class="leyenda-punto" style="background:${a.color}"></span>${a.nombre}</span>
          <span class="tabular-nums">${v} · ${pct}%</span>
        </li>`;
    }).join('');
  }

  // ==========================================================
  // Filtro por jornada
  // ==========================================================
  function poblarSelectorJornada() {
    if (!dom.filtroJornada) return;
    const dias = jornadas();
    const etiquetas = ['Día 1', 'Día 2', 'Día 3'];
    const previo = dom.filtroJornada.value || 'global';

    let html = '<option value="global">Global (Toda la Expo)</option>';
    ['d1', 'd2', 'd3'].forEach((k, i) => {
      const fecha = dias[i];
      const txt = fecha ? new Date(fecha + 'T12:00').toLocaleDateString('es-AR') : 'sin datos';
      html += `<option value="${k}">${etiquetas[i]} · ${txt}</option>`;
    });
    dom.filtroJornada.innerHTML = html;
    dom.filtroJornada.value = previo;
  }

  // ==========================================================
  // Exportar Dataset CSV (protegido por clave)
  // ==========================================================
  function celda(valor) {
    let s = valor == null ? '' : String(valor);
    if (/[";\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function nombreCarreraTop(registro, i) {
    const t = (registro.top3 || [])[i];
    return t ? (t.nombre || t.carreraId || '') : '';
  }

  function construirCSV(lista) {
    const cabecera = [
      'ID', 'Fecha_Hora', 'Nombre', 'Apellido', 'Edad',
      'Localidad', 'Situacion_Educativa',
      'Top1_Carrera', 'Top2_Carrera', 'Top3_Carrera',
    ];
    const filas = lista.map((r) => {
      const p = r.participante || {};
      const fechaHora = r.fechaISO
        ? new Date(r.fechaISO).toLocaleString('es-AR')
        : (r.timestamp ? new Date(r.timestamp).toLocaleString('es-AR') : '');
      return [
        r.id, fechaHora, p.nombre || '', p.apellido || '', p.edad ?? '',
        p.localidad || '', p.situacionEducativa || '',
        nombreCarreraTop(r, 0), nombreCarreraTop(r, 1), nombreCarreraTop(r, 2),
      ].map(celda).join(';');
    });
    // BOM (﻿) + CRLF para compatibilidad con Excel (UTF-8)
    return '﻿' + cabecera.join(';') + '\r\n' + filas.join('\r\n') + '\r\n';
  }

  function exportarCSV() {
    const lista = registrosFiltrados();
    if (!lista.length) {
      alert('No hay registros para exportar' +
        (filtroJornada === 'global' ? '.' : ' en esa jornada.'));
      return;
    }
    const clave = window.prompt('Ingresá la clave para descargar el dataset:');
    if (clave === null) return;
    if (clave !== CLAVE_EXPORT) {
      alert('Clave incorrecta. La descarga fue cancelada.');
      return;
    }

    const blob = new Blob([construirCSV(lista)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const hoy = new Date().toISOString().slice(0, 10);
    const suf = filtroJornada === 'global' ? 'global' : filtroJornada;
    const a = document.createElement('a');
    a.href = url;
    a.download = `dataset-expo-2026_${suf}_${hoy}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  // ==========================================================
  // Reloj + estado de conexión
  // ==========================================================
  function iniciarReloj() {
    if (!dom.reloj) return;
    const tick = () => { dom.reloj.textContent = new Date().toLocaleTimeString('es-AR'); };
    tick();
    window.setInterval(tick, 1000);
  }

  function chequearConexion() {
    if (!dom.estadoConexion) return;
    const pintar = () => {
      const estado = (window.Realtime.estadoRemoto && window.Realtime.estadoRemoto()) || 'local';
      const caido = estado === 'sin-conexion';
      dom.estadoConexion.classList.toggle('hidden', !caido);
      if (caido) dom.estadoConexion.textContent = 'Sin conexión con el servidor · mostrando datos locales';
    };
    pintar();
    window.setInterval(pintar, 4000);
  }

  // ==========================================================
  // Arranque
  // ==========================================================
  function init() {
    dom.contador = document.getElementById('contador-participantes');
    dom.feed = document.getElementById('feed-actividad');
    dom.podio = document.getElementById('podio');
    dom.toasts = document.getElementById('toasts');
    dom.reloj = document.getElementById('reloj');
    dom.estadoConexion = document.getElementById('estado-conexion');
    dom.canvasAreas = document.getElementById('grafico-areas');
    dom.canvasCarreras = document.getElementById('grafico-carreras');
    dom.leyendaAreas = document.getElementById('leyenda-areas');
    dom.filtroJornada = document.getElementById('filtro-jornada');
    dom.btnCsv = document.getElementById('btn-exportar-csv');
    dom.vistaGeneral = document.getElementById('vista-general');
    dom.vistaDetallada = document.getElementById('vista-detallada');
    dom.detalleLista = document.getElementById('detalle-lista');
    dom.detalleTotal = document.getElementById('detalle-total');
    dom.btnsVista = Array.from(document.querySelectorAll('[data-vista]'));

    iniciarReloj();
    chequearConexion();

    if (dom.filtroJornada) {
      dom.filtroJornada.addEventListener('change', () => {
        filtroJornada = dom.filtroJornada.value || 'global';
        recomputar(true);
      });
    }
    dom.btnsVista.forEach((b) => b.addEventListener('click', () => setVista(b.dataset.vista)));
    if (dom.btnCsv) dom.btnCsv.addEventListener('click', exportarCSV);
    document.addEventListener('tema:cambio', aplicarTemaAGraficos);

    initGraficos();
    cargarHistorial();
    suscribirse();

    console.info('[dashboard.js] Pantalla Gigante lista.');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
