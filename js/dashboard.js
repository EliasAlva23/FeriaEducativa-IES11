/* ============================================================
   PANEL ANALÍTICO DEL DASHBOARD  (js/dashboard.js)
   ============================================================
   Proyecto: Expo Educativa 2026 · IES N.° 11 (Jujuy, Argentina)

   - Carga el historial (Realtime.obtenerHistorial()) y se suscribe
     a los tests nuevos (Realtime.suscribirse()).
   - Todo reacciona al filtro por Jornada (Global / Día 1-3).
   - Fila KPI: encuestados · edad promedio · carrera más elegida.
   - Vista General: ranking 18 · presencia 1ª/2ª/3ª · áreas · podio · feed.
   - Vista Detallada: desglose 18 + demografía (situación · localidad · sexo/edad).
   - Exportar CSV y "Limpiar datos de prueba" (ambos con PIN admin11).

   Depende de: js/questions.js, js/realtime.js, Chart.js
   ============================================================ */

(function () {
  'use strict';

  const { AREAS = [], CARRERAS = [], ICONOS = {} } = window.TEST_VOCACIONAL || {};
  const AREA_POR_ID = Object.fromEntries(AREAS.map((a) => [a.id, a]));
  const CARRERA_POR_ID = Object.fromEntries(CARRERAS.map((c) => [c.id, c]));
  const CARRERAS_POR_AREA = AREAS.reduce((acc, a) => {
    acc[a.id] = CARRERAS.filter((c) => c.area === a.id);
    return acc;
  }, {});

  const MAX_FEED = 8;
  const MAX_LOCALIDADES = 8;
  const TOAST_MS = 5000;
  const PIN = 'admin11';                 // CSV + limpiar datos
  const CLAVE_EXPORT = PIN;
  const URL_TEST = 'https://test-vocacional-ies11.netlify.app'; // destino del QR
  const COLORES_POS = ['#EAB308', '#94A3B8', '#C2703D']; // 1.ª / 2.ª / 3.ª opción

  // ----------------------------------------------------------
  // Estado
  // ----------------------------------------------------------
  let historial = [];
  let filtroJornada = 'global';

  const agregado = {
    total: 0,
    porArea: Object.fromEntries(AREAS.map((a) => [a.id, 0])),
    porCarrera: Object.fromEntries(CARRERAS.map((c) => [c.id, 0])),
    porPosicion: Object.fromEntries(CARRERAS.map((c) => [c.id, [0, 0, 0]])),
    sumaEdad: 0,
    conEdad: 0,
    porSituacion: {},
    porLocalidad: {},
    porGenero: {},
    porRango: { '<18': 0, '18-24': 0, '25-34': 0, '35+': 0 },
    recientes: [],
  };

  const graficos = { areas: null, carreras: null, posiciones: null };
  const dom = {};
  let areasAbiertas = new Set(); // áreas expandidas en la leyenda

  // ==========================================================
  // Utilidades
  // ==========================================================
  function nombreCorto(carrera) {
    return (carrera.nombre || '').replace(/^Tecnicatura Superior en\s+/i, '');
  }

  function iconoSVG(nombre) {
    const inner = ICONOS[nombre] || ICONOS.estrella || '';
    // width/height explícitos: el ícono nunca puede volverse gigante aunque
    // no cargue el CSS que lo dimensiona.
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              style="max-width:100%;max-height:100%" aria-hidden="true">${inner}</svg>`;
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

  function rangoEtario(edad) {
    if (!Number.isFinite(edad)) return null;
    if (edad < 18) return '<18';
    if (edad <= 24) return '18-24';
    if (edad <= 34) return '25-34';
    return '35+';
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

  function jornadas() {
    return [...new Set(historial.map(fechaDe).filter(Boolean))].sort();
  }

  /** Barras de distribución HTML reutilizables (situación, localidad, género, edad). */
  function filasDistribucion(conteo, total, color) {
    const pares = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
    if (!pares.length || !total) return '<p class="texto-suave text-sm">Sin datos todavía.</p>';
    return pares.map(([etiqueta, v]) => {
      const pct = Math.round((v / total) * 100);
      return `
        <div class="demo-fila">
          <span class="demo-label" title="${etiqueta}">${etiqueta}</span>
          <span class="demo-barra"><span style="width:${pct}%;background:${color}"></span></span>
          <span class="demo-valor">${v}</span>
          <span class="demo-pct">${pct}%</span>
        </div>`;
    }).join('');
  }

  // ==========================================================
  // Carga + suscripción
  // ==========================================================
  function cargarHistorial() {
    let bruto = [];
    try { bruto = window.Realtime.obtenerHistorial() || []; }
    catch (e) { console.error('[dashboard.js] No se pudo leer el historial:', e); }
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
    Object.keys(agregado.porPosicion).forEach((k) => { agregado.porPosicion[k] = [0, 0, 0]; });
    agregado.sumaEdad = 0;
    agregado.conEdad = 0;
    agregado.porSituacion = {};
    agregado.porLocalidad = {};
    agregado.porGenero = {};
    agregado.porRango = { '<18': 0, '18-24': 0, '25-34': 0, '35+': 0 };

    lista.forEach((r) => {
      const p = r.participante || {};

      const area = areaDominante(r);
      if (area && area in agregado.porArea) agregado.porArea[area] += 1;

      (r.top3 || []).forEach((c, i) => {
        if (c.carreraId in agregado.porCarrera) agregado.porCarrera[c.carreraId] += 1;
        if (c.carreraId in agregado.porPosicion && i < 3) agregado.porPosicion[c.carreraId][i] += 1;
      });

      if (Number.isFinite(p.edad)) {
        agregado.sumaEdad += p.edad;
        agregado.conEdad += 1;
        const rango = rangoEtario(p.edad);
        if (rango) agregado.porRango[rango] += 1;
      }

      const sit = p.situacionEducativa || 'Sin especificar';
      agregado.porSituacion[sit] = (agregado.porSituacion[sit] || 0) + 1;

      const loc = p.localidad || 'Sin especificar';
      agregado.porLocalidad[loc] = (agregado.porLocalidad[loc] || 0) + 1;

      const gen = p.genero || 'Sin especificar';
      agregado.porGenero[gen] = (agregado.porGenero[gen] || 0) + 1;
    });

    agregado.recientes = lista.slice(-MAX_FEED).reverse();

    refrescarKPIs(animar);
    refrescarFeed();
    refrescarPodio();
    refrescarGraficos(animar);
    refrescarVistaDetallada();
    refrescarDemografia();
  }

  // ==========================================================
  // Conmutador de vista
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
    // Los canvas ocultos no se miden bien: forzar re-layout al mostrarlos
    window.setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
  }

  // ==========================================================
  // Fila KPI
  // ==========================================================
  function refrescarKPIs(animar) {
    dom.contador.textContent = String(agregado.total);
    if (animar) {
      dom.contador.classList.remove('kpi-pulse');
      void dom.contador.offsetWidth;
      dom.contador.classList.add('kpi-pulse');
    }

    if (dom.kpiEdad) {
      dom.kpiEdad.textContent = agregado.conEdad
        ? (agregado.sumaEdad / agregado.conEdad).toFixed(1).replace('.', ',') + ' años'
        : '—';
    }

    if (dom.kpiCarrera) {
      const top = CARRERAS
        .map((c, orden) => ({ c, orden, v: agregado.porCarrera[c.id] || 0 }))
        .sort((a, b) => b.v - a.v || a.orden - b.orden)[0];
      if (top && top.v > 0) {
        const area = AREA_POR_ID[top.c.area] || { nombre: '', color: '#64748b' };
        dom.kpiCarrera.textContent = nombreCorto(top.c);
        if (dom.kpiCarreraSub) dom.kpiCarreraSub.textContent = `${area.nombre} · ${top.v} apariciones en el Top 3`;
        if (dom.kpiCarreraCard) dom.kpiCarreraCard.style.setProperty('--acento-card', area.color);
        if (dom.kpiIcoCarrera) dom.kpiIcoCarrera.style.color = area.color;
      } else {
        dom.kpiCarrera.textContent = '—';
        if (dom.kpiCarreraSub) dom.kpiCarreraSub.textContent = 'La N.° 1 del ranking de afinidades';
        if (dom.kpiCarreraCard) dom.kpiCarreraCard.style.removeProperty('--acento-card');
      }
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
    [graficos.carreras, graficos.posiciones].forEach((g) => {
      if (!g) return;
      const ejes = g.options.scales;
      ejes.x.grid.color = grilla;
      ejes.x.ticks.color = texto;
      ejes.y.ticks.color = texto;
      g.update('none');
    });
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

    // Dona: participación por área
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

    // Barras horizontales multicolor: ranking de las 18 tecnicaturas
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

    // Barras apiladas: presencia como 1.ª / 2.ª / 3.ª opción
    graficos.posiciones = new Chart(dom.canvasPosiciones.getContext('2d'), {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          { label: '1.ª opción', data: [], backgroundColor: COLORES_POS[0], borderRadius: 4 },
          { label: '2.ª opción', data: [], backgroundColor: COLORES_POS[1], borderRadius: 4 },
          { label: '3.ª opción', data: [], backgroundColor: COLORES_POS[2], borderRadius: 4 },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        scales: {
          x: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(148,163,184,0.15)' } },
          y: { stacked: true, grid: { display: false }, ticks: { autoSkip: false, font: { size: 11 } } },
        },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, boxHeight: 12, padding: 12 } },
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

    // Orden común (por total) para ranking y posiciones
    const filas = CARRERAS
      .map((c, orden) => ({ c, orden, valor: agregado.porCarrera[c.id] || 0 }))
      .sort((a, b) => b.valor - a.valor || a.orden - b.orden);

    if (graficos.carreras) {
      graficos.carreras.data.labels = filas.map((f) => nombreCorto(f.c));
      graficos.carreras.data.datasets[0].data = filas.map((f) => f.valor);
      graficos.carreras.data.datasets[0].backgroundColor = filas.map(
        (f) => (AREA_POR_ID[f.c.area] || {}).color || '#64748b'
      );
      graficos.carreras.data.datasets[0]._ids = filas.map((f) => f.c.id);
      graficos.carreras.update(modo);
    }

    if (graficos.posiciones) {
      graficos.posiciones.data.labels = filas.map((f) => nombreCorto(f.c));
      [0, 1, 2].forEach((pos) => {
        graficos.posiciones.data.datasets[pos].data =
          filas.map((f) => (agregado.porPosicion[f.c.id] || [0, 0, 0])[pos]);
      });
      graficos.posiciones.update(modo);
    }

    refrescarLeyendaAreas();
  }

  // Áreas: leyenda expandible con las carreras que componen cada área
  function refrescarLeyendaAreas() {
    if (!dom.leyendaAreas) return;
    const total = Object.values(agregado.porArea).reduce((s, n) => s + n, 0) || 1;

    dom.leyendaAreas.innerHTML = AREAS.map((a) => {
      const v = agregado.porArea[a.id] || 0;
      const pct = Math.round((v / total) * 100);
      const abierta = areasAbiertas.has(a.id);
      const carreras = (CARRERAS_POR_AREA[a.id] || [])
        .map((c) => `<li><span>${nombreCorto(c)}</span><span class="tabular-nums">${agregado.porCarrera[c.id] || 0}</span></li>`)
        .join('');
      return `
        <li class="leyenda-area ${abierta ? 'abierta' : ''}">
          <button type="button" class="leyenda-area__cab" data-area="${a.id}" aria-expanded="${abierta}">
            <span><span class="leyenda-punto" style="background:${a.color}"></span>${a.nombre}</span>
            <span class="tabular-nums">${v} · ${pct}% <span class="leyenda-area__flecha">▾</span></span>
          </button>
          <ul class="leyenda-area__carreras">${carreras}</ul>
        </li>`;
    }).join('');

    dom.leyendaAreas.querySelectorAll('[data-area]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.area;
        if (areasAbiertas.has(id)) areasAbiertas.delete(id);
        else areasAbiertas.add(id);
        refrescarLeyendaAreas();
      });
    });
  }

  // ==========================================================
  // Vista Detallada: desglose de las 18
  // ==========================================================
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
  // Demografía
  // ==========================================================
  function refrescarDemografia() {
    const total = agregado.total || 0;

    if (dom.demoSituacion) {
      dom.demoSituacion.innerHTML = filasDistribucion(agregado.porSituacion, total, tokenCSS('--highlight', '#346FB0'));
    }

    if (dom.demoLocalidad) {
      const top = Object.entries(agregado.porLocalidad)
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_LOCALIDADES);
      const resto = Object.entries(agregado.porLocalidad).sort((a, b) => b[1] - a[1]).slice(MAX_LOCALIDADES)
        .reduce((s, [, n]) => s + n, 0);
      const conteo = Object.fromEntries(top);
      if (resto > 0) conteo['Otras'] = resto;
      dom.demoLocalidad.innerHTML = filasDistribucion(conteo, total, tokenCSS('--acento', '#B78FB6'));
    }

    if (dom.demoGenero) {
      dom.demoGenero.innerHTML = filasDistribucion(agregado.porGenero, total, tokenCSS('--secundario', '#7B79B1'));
    }

    if (dom.demoEdad) {
      // rangos en orden fijo, no por frecuencia
      const orden = ['<18', '18-24', '25-34', '35+'];
      const conEdad = agregado.conEdad || 0;
      if (!conEdad) {
        dom.demoEdad.innerHTML = '<p class="texto-suave text-sm">Sin datos todavía.</p>';
      } else {
        dom.demoEdad.innerHTML = orden.map((r) => {
          const v = agregado.porRango[r] || 0;
          const pct = Math.round((v / conEdad) * 100);
          const etiqueta = { '<18': 'Menos de 18', '18-24': '18 a 24', '25-34': '25 a 34', '35+': '35 o más' }[r];
          return `
            <div class="demo-fila">
              <span class="demo-label">${etiqueta}</span>
              <span class="demo-barra"><span style="width:${pct}%;background:${tokenCSS('--highlight', '#346FB0')}"></span></span>
              <span class="demo-valor">${v}</span>
              <span class="demo-pct">${pct}%</span>
            </div>`;
        }).join('');
      }
    }
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
  // Exportar Dataset CSV (protegido por PIN)
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
      'ID', 'Fecha_Hora', 'Nombre', 'Apellido', 'Edad', 'Genero',
      'Localidad', 'Situacion_Educativa',
      'Top1_Carrera', 'Top2_Carrera', 'Top3_Carrera',
    ];
    const filas = lista.map((r) => {
      const p = r.participante || {};
      const fechaHora = r.fechaISO
        ? new Date(r.fechaISO).toLocaleString('es-AR')
        : (r.timestamp ? new Date(r.timestamp).toLocaleString('es-AR') : '');
      return [
        r.id, fechaHora, p.nombre || '', p.apellido || '', p.edad ?? '', p.genero || '',
        p.localidad || '', p.situacionEducativa || '',
        nombreCarreraTop(r, 0), nombreCarreraTop(r, 1), nombreCarreraTop(r, 2),
      ].map(celda).join(';');
    });
    return '﻿' + cabecera.join(';') + '\r\n' + filas.join('\r\n') + '\r\n';
  }

  function exportarCSV() {
    const lista = registrosFiltrados();
    if (!lista.length) {
      alert('No hay registros para exportar' + (filtroJornada === 'global' ? '.' : ' en esa jornada.'));
      return;
    }
    const clave = window.prompt('Ingresá la clave para descargar el dataset:');
    if (clave === null) return;
    if (clave !== CLAVE_EXPORT) { alert('Clave incorrecta. La descarga fue cancelada.'); return; }

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
  // Limpiar datos de prueba (modo administrador)
  // ==========================================================
  function limpiarDatosPrueba() {
    const clave = window.prompt('Modo administrador — ingresá la clave para LIMPIAR todos los datos:');
    if (clave === null) return;
    if (clave !== PIN) { alert('Clave incorrecta.'); return; }
    if (!window.confirm(
      'Vas a borrar TODOS los registros de este canal (incluye los de otros equipos conectados).\n\n' +
      'Usalo para dejar los contadores en cero antes de la jornada oficial. ¿Continuar?'
    )) return;

    try { window.Realtime.reiniciar(); } catch (e) { console.error(e); }
    historial = [];
    areasAbiertas = new Set();
    poblarSelectorJornada();
    recomputar(true);
    alert('Listo. Los contadores quedaron en cero en todos los equipos conectados a este canal.\n\n' +
      'Para un canal completamente nuevo, cambiá el sufijo de TOPIC en js/realtime.js y volvé a subir.');
  }

  // ==========================================================
  // Código QR de acceso al test
  // ==========================================================
  function initQR() {
    const cont = document.getElementById('dash-qr-codigo');
    if (!cont) return;
    if (typeof window.QRCode !== 'function') {
      // Sin la librería (sin internet): mostrar sólo la URL, sin romper nada.
      cont.innerHTML = '<span class="dash-qr__fallback">Abrí el link de abajo 👇</span>';
      return;
    }
    cont.innerHTML = '';
    /* global QRCode */
    try {
      new QRCode(cont, {
        text: URL_TEST,
        width: 200,
        height: 200,
        colorDark: '#02447B',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M, // ~15% de tolerancia, buen equilibrio a distancia
      });
    } catch (e) {
      cont.innerHTML = '<span class="dash-qr__fallback">Abrí el link de abajo 👇</span>';
      return;
    }
    // qrcodejs alterna entre <canvas> y <img>; el CSS los dimensiona a 156px.
    const img = cont.querySelector('img');
    if (img) img.alt = 'Código QR para hacer el Test Vocacional';
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
      dom.estadoConexion.hidden = !caido;
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
    dom.kpiEdad = document.getElementById('kpi-edad');
    dom.kpiCarrera = document.getElementById('kpi-carrera');
    dom.kpiCarreraSub = document.getElementById('kpi-carrera-sub');
    dom.kpiCarreraCard = document.getElementById('kpi-carrera-card');
    dom.kpiIcoTotal = document.getElementById('kpi-ico-total');
    dom.kpiIcoEdad = document.getElementById('kpi-ico-edad');
    dom.kpiIcoCarrera = document.getElementById('kpi-ico-carrera');
    dom.feed = document.getElementById('feed-actividad');
    dom.podio = document.getElementById('podio');
    dom.toasts = document.getElementById('toasts');
    dom.reloj = document.getElementById('reloj');
    dom.estadoConexion = document.getElementById('estado-conexion');
    dom.canvasAreas = document.getElementById('grafico-areas');
    dom.canvasCarreras = document.getElementById('grafico-carreras');
    dom.canvasPosiciones = document.getElementById('grafico-posiciones');
    dom.leyendaAreas = document.getElementById('leyenda-areas');
    dom.filtroJornada = document.getElementById('filtro-jornada');
    dom.btnCsv = document.getElementById('btn-exportar-csv');
    dom.btnLimpiar = document.getElementById('btn-limpiar-datos');
    dom.vistaGeneral = document.getElementById('vista-general');
    dom.vistaDetallada = document.getElementById('vista-detallada');
    dom.detalleLista = document.getElementById('detalle-lista');
    dom.detalleTotal = document.getElementById('detalle-total');
    dom.demoSituacion = document.getElementById('demo-situacion');
    dom.demoLocalidad = document.getElementById('demo-localidad');
    dom.demoGenero = document.getElementById('demo-genero');
    dom.demoEdad = document.getElementById('demo-edad');
    dom.btnsVista = Array.from(document.querySelectorAll('[data-vista]'));

    if (dom.kpiIcoTotal) dom.kpiIcoTotal.innerHTML = iconoSVG('personas');
    if (dom.kpiIcoEdad) dom.kpiIcoEdad.innerHTML = iconoSVG('grafico');
    if (dom.kpiIcoCarrera) dom.kpiIcoCarrera.innerHTML = iconoSVG('estrella');

    iniciarReloj();
    chequearConexion();
    initQR();

    if (dom.filtroJornada) {
      dom.filtroJornada.addEventListener('change', () => {
        filtroJornada = dom.filtroJornada.value || 'global';
        recomputar(true);
      });
    }
    dom.btnsVista.forEach((b) => b.addEventListener('click', () => setVista(b.dataset.vista)));
    if (dom.btnCsv) dom.btnCsv.addEventListener('click', exportarCSV);
    if (dom.btnLimpiar) dom.btnLimpiar.addEventListener('click', limpiarDatosPrueba);
    document.addEventListener('tema:cambio', aplicarTemaAGraficos);

    initGraficos();
    cargarHistorial();
    suscribirse();

    console.info('[dashboard.js] Panel analítico listo.');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
