/* ============================================================
   LÓGICA DE LA APP MÓVIL DEL ESTUDIANTE  (js/app.js)
   ============================================================
   Proyecto: Feria Educativa · IES N.° 11 (Jujuy, Argentina)
   Paso 3 — Lógica de interacción y scoring.

   Flujo:
     1) Formulario inicial -> sanitizar + validar -> estado.participante
     2) Test por tarjetas   -> una pregunta por vez, barra de progreso,
                               avance automático + botones Anterior/Siguiente
     3) Motor de puntuación -> Top 3 de tecnicaturas con % de afinidad
     4) Pantalla de resultados + window.Realtime.publicar(registro)

   Depende de:
     - js/questions.js -> window.TEST_VOCACIONAL { AREAS, CARRERAS, PREGUNTAS, MATRIZ_PESOS }
     - js/realtime.js  -> window.Realtime.publicar()
   ============================================================ */

(function () {
  'use strict';

  const {
    AREAS, CARRERAS, PREGUNTAS, MATRIZ_PESOS,
    ICONOS = {}, INFO_CARRERAS = {},
  } = window.TEST_VOCACIONAL || {};

  // Índices rápidos
  const AREA_POR_ID = Object.fromEntries((AREAS || []).map((a) => [a.id, a]));
  const CARRERA_POR_ID = Object.fromEntries((CARRERAS || []).map((c) => [c.id, c]));

  const AUTO_AVANCE_MS = 300; // demora antes de pasar a la siguiente tarjeta

  // Auto-guardado del progreso del test (para retomar tras minimizar el
  // navegador, cambiar de pestaña o apagar la pantalla en el celular).
  const CLAVE_PROGRESO = 'feria_ies11_progreso_test';
  const PROGRESO_VENTANA_MS = 30 * 60 * 1000; // 30 min: pasado ese lapso se descarta

  function guardarProgreso() {
    if (!estado.participante || estado.resultado) return; // sólo con un test en curso
    try {
      window.localStorage.setItem(CLAVE_PROGRESO, JSON.stringify({
        participante: estado.participante,
        indiceActual: estado.indiceActual,
        respuestas: estado.respuestas,
        guardadoEn: Date.now(),
      }));
    } catch (e) { /* incógnito / sin espacio: el test sigue, sólo no persiste */ }
  }

  function limpiarProgreso() {
    try { window.localStorage.removeItem(CLAVE_PROGRESO); } catch (e) { /* noop */ }
  }

  /** Si hay progreso reciente guardado, lo restaura y abre la pantalla del
      test en la pregunta donde quedó. Devuelve true si retomó algo. */
  function restaurarProgreso() {
    let datos = null;
    try { datos = JSON.parse(window.localStorage.getItem(CLAVE_PROGRESO) || 'null'); }
    catch (e) { datos = null; }

    const valido = datos && datos.participante &&
      datos.respuestas && typeof datos.respuestas === 'object' &&
      Number.isFinite(datos.guardadoEn) &&
      (Date.now() - datos.guardadoEn) <= PROGRESO_VENTANA_MS;

    if (!valido) { limpiarProgreso(); return false; }

    const idx = Number.isInteger(datos.indiceActual) ? datos.indiceActual : 0;
    estado.participante = datos.participante;
    estado.respuestas = datos.respuestas;
    estado.indiceActual = Math.min(Math.max(idx, 0), PREGUNTAS.length - 1);
    estado.resultado = null;

    dom.bienvenida.classList.add('hidden');
    dom.resultado.classList.add('hidden');
    dom.test.classList.remove('hidden');
    renderPregunta();
    mostrarAvisoReanudado();
    return true;
  }

  function mostrarAvisoReanudado() {
    const aviso = document.getElementById('test-reanudado');
    if (!aviso) return;
    aviso.hidden = false;
    window.clearTimeout(mostrarAvisoReanudado._t);
    mostrarAvisoReanudado._t = window.setTimeout(() => { aviso.hidden = true; }, 4500);
  }

  /** Envuelve el contenido de un ícono (questions.js → ICONOS) en un <svg>. */
  function iconoSVG(nombre) {
    const inner = ICONOS[nombre] || ICONOS.estrella || '';
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              style="max-width:100%;max-height:100%" aria-hidden="true">${inner}</svg>`;
  }

  // ----------------------------------------------------------
  // Estado de la sesión del estudiante
  // ----------------------------------------------------------
  const estado = {
    participante: null,      // { nombre, apellido, edad, localidad, situacionEducativa }
    indiceActual: 0,
    respuestas: {},          // { q1: 'a', q2: 'c', ... }
    resultado: null,         // ver calcularResultado()
  };

  // ----------------------------------------------------------
  // Referencias al DOM
  // ----------------------------------------------------------
  const dom = {};

  // ==========================================================
  // 1. FORMULARIO: sanitización + validación
  // ==========================================================

  /** Colapsa espacios y recorta. */
  function limpiarTexto(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  /**
   * Capitaliza cada palabra: "juAN  pérEZ" -> "Juan Pérez".
   * Respeta guiones y apóstrofes. Deja en minúscula los conectores
   * ("de", "del", "la"…) salvo que sean la primera palabra.
   */
  const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);
  function capitalizarNombre(v) {
    const base = limpiarTexto(v).toLocaleLowerCase('es-AR');
    return base.replace(/(^|[\s\-'’])([\p{L}][\p{L}’']*)/gu, (m, sep, palabra, offset) => {
      if (offset !== 0 && sep === ' ' && CONECTORES.has(palabra)) return sep + palabra;
      return sep + palabra.charAt(0).toLocaleUpperCase('es-AR') + palabra.slice(1);
    });
  }

  /**
   * Lee el formulario, sanitiza y valida.
   * @returns {{ok:true, participante:object} | {ok:false, error:string}}
   */
  function procesarFormulario(form) {
    const nombre = capitalizarNombre(form.nombre.value);
    const apellido = capitalizarNombre(form.apellido.value);
    // 'localidad' y 'genero' son <select> con valores ya normalizados.
    const localidad = limpiarTexto(form.localidad.value);
    const situacionEducativa = limpiarTexto(form.situacionEducativa.value);
    const genero = form.genero ? limpiarTexto(form.genero.value) : '';
    const edadNum = parseInt(limpiarTexto(form.edad.value), 10);

    // Limpiar marcas de error previas
    [form.nombre, form.apellido, form.edad, form.localidad, form.situacionEducativa]
      .forEach((el) => el.classList.remove('campo--error'));

    const faltantes = [];
    if (!nombre) faltantes.push([form.nombre, 'nombre']);
    if (!apellido) faltantes.push([form.apellido, 'apellido']);
    if (!localidad) faltantes.push([form.localidad, 'localidad']);
    if (!situacionEducativa) faltantes.push([form.situacionEducativa, 'situación educativa']);
    if (!Number.isFinite(edadNum)) faltantes.push([form.edad, 'edad']);

    if (faltantes.length) {
      faltantes.forEach(([el]) => el.classList.add('campo--error'));
      const nombres = faltantes.map(([, n]) => n).join(', ');
      return { ok: false, error: `Completá: ${nombres}.` };
    }

    if (edadNum < 10 || edadNum > 99) {
      form.edad.classList.add('campo--error');
      return { ok: false, error: 'Ingresá una edad válida (entre 10 y 99).' };
    }

    return {
      ok: true,
      participante: {
        nombre, apellido, edad: edadNum, localidad, situacionEducativa,
        genero: genero || 'Sin especificar',
      },
    };
  }

  function mostrarErrorFormulario(msg) {
    dom.formError.textContent = msg;
    dom.formError.classList.toggle('hidden', !msg);
  }

  // ==========================================================
  // 2. NAVEGACIÓN POR TARJETAS
  // ==========================================================

  function iniciarTest() {
    estado.indiceActual = 0;
    estado.respuestas = {};
    dom.bienvenida.classList.add('hidden');
    dom.resultado.classList.add('hidden');
    dom.test.classList.remove('hidden');
    renderPregunta();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderPregunta() {
    const total = PREGUNTAS.length;
    const idx = estado.indiceActual;
    const pregunta = PREGUNTAS[idx];
    const elegida = estado.respuestas[pregunta.id];

    const opcionesHTML = pregunta.opciones.map((op) => {
      const activa = elegida === op.id;
      const visual = op.imagen
        ? `<img class="opcion-card__img" src="${op.imagen}" alt="" loading="lazy" />`
        : `<span class="opcion-card__icono">${iconoSVG(op.icono)}</span>`;
      return `
        <button type="button" class="opcion-card ${activa ? 'opcion-card--activa' : ''}"
                data-opcion="${op.id}">
          ${visual}
          <span class="opcion-card__texto">${op.texto}</span>
          <span class="opcion-card__check" aria-hidden="true">${activa ? '✓' : ''}</span>
        </button>`;
    }).join('');

    dom.contenedorTarjeta.innerHTML = `
      <article class="tarjeta tarjeta--entrando">
        <p class="tarjeta__paso">Pregunta ${idx + 1} de ${total}</p>
        <h2 class="tarjeta__pregunta">${pregunta.texto}</h2>
        <div class="opcion-grid">${opcionesHTML}</div>
      </article>`;

    // Listeners de las opciones
    dom.contenedorTarjeta.querySelectorAll('[data-opcion]').forEach((btn) => {
      btn.addEventListener('click', () => seleccionarOpcion(pregunta.id, btn.dataset.opcion));
    });

    actualizarProgreso();
    actualizarBotonesNavegacion();
    guardarProgreso();
  }

  function seleccionarOpcion(preguntaId, opcionId) {
    estado.respuestas[preguntaId] = opcionId;

    // Feedback visual inmediato
    dom.contenedorTarjeta.querySelectorAll('[data-opcion]').forEach((btn) => {
      const activa = btn.dataset.opcion === opcionId;
      btn.classList.toggle('opcion-card--activa', activa);
      const check = btn.querySelector('.opcion-card__check');
      if (check) check.textContent = activa ? '✓' : '';
    });

    actualizarProgreso();
    actualizarBotonesNavegacion();
    guardarProgreso();

    // Avance automático (excepto en la última, que espera el botón "Ver resultado")
    if (estado.indiceActual < PREGUNTAS.length - 1) {
      window.clearTimeout(seleccionarOpcion._t);
      seleccionarOpcion._t = window.setTimeout(avanzar, AUTO_AVANCE_MS);
    }
  }

  function avanzar() {
    if (!estado.respuestas[PREGUNTAS[estado.indiceActual].id]) return; // requiere respuesta
    if (estado.indiceActual < PREGUNTAS.length - 1) {
      estado.indiceActual += 1;
      renderPregunta();
    } else {
      finalizarTest();
    }
  }

  function retroceder() {
    if (estado.indiceActual === 0) return;
    estado.indiceActual -= 1;
    renderPregunta();
  }

  function actualizarProgreso() {
    const total = PREGUNTAS.length;
    const respondidas = Object.keys(estado.respuestas).length;
    const pct = Math.round((respondidas / total) * 100);
    dom.barraFill.style.width = pct + '%';
    dom.progresoTexto.textContent = `${respondidas}/${total}`;
  }

  function actualizarBotonesNavegacion() {
    const idx = estado.indiceActual;
    const esUltima = idx === PREGUNTAS.length - 1;
    const respondioActual = Boolean(estado.respuestas[PREGUNTAS[idx].id]);

    dom.btnAnterior.disabled = idx === 0;
    dom.btnSiguiente.disabled = !respondioActual;
    dom.btnSiguiente.textContent = esUltima ? 'Ver resultado' : 'Siguiente →';
  }

  // ==========================================================
  // 3. MOTOR DE PUNTUACIÓN
  // ==========================================================

  /**
   * Puntaje máximo teórico por área: por cada pregunta, el mayor
   * peso de área alcanzable. Sirve para normalizar a porcentaje.
   */
  function calcularMaximosPorArea() {
    const max = Object.fromEntries((AREAS || []).map((a) => [a.id, 0]));
    Object.values(MATRIZ_PESOS || {}).forEach((opciones) => {
      const mejorPorArea = {};
      Object.values(opciones).forEach((peso) => {
        Object.entries(peso.areas || {}).forEach(([areaId, pts]) => {
          mejorPorArea[areaId] = Math.max(mejorPorArea[areaId] || 0, pts);
        });
      });
      Object.entries(mejorPorArea).forEach(([areaId, pts]) => {
        if (areaId in max) max[areaId] += pts;
      });
    });
    return max;
  }

  /** Bonus máximo acumulable por carrera (suma de mejores bonus por pregunta). */
  function calcularMaximosBonusCarrera() {
    const max = Object.fromEntries((CARRERAS || []).map((c) => [c.id, 0]));
    Object.values(MATRIZ_PESOS || {}).forEach((opciones) => {
      const mejorPorCarrera = {};
      Object.values(opciones).forEach((peso) => {
        Object.entries(peso.carreras || {}).forEach(([carreraId, pts]) => {
          mejorPorCarrera[carreraId] = Math.max(mejorPorCarrera[carreraId] || 0, pts);
        });
      });
      Object.entries(mejorPorCarrera).forEach(([carreraId, pts]) => {
        if (carreraId in max) max[carreraId] += pts;
      });
    });
    return max;
  }

  const MAX_AREA = calcularMaximosPorArea();
  const MAX_BONUS_CARRERA = calcularMaximosBonusCarrera();

  /**
   * Acumula puntajes y devuelve el ranking completo + Top 3.
   * @returns {{
   *   puntajesArea: object,
   *   ranking: Array<{carreraId,nombre,area,areaNombre,puntaje,afinidad,bonus}>,
   *   top3: Array<...>
   * }}
   */
  function calcularResultado() {
    const puntajesArea = Object.fromEntries((AREAS || []).map((a) => [a.id, 0]));
    const bonusCarrera = Object.fromEntries((CARRERAS || []).map((c) => [c.id, 0]));

    Object.entries(estado.respuestas).forEach(([preguntaId, opcionId]) => {
      const peso = (MATRIZ_PESOS[preguntaId] || {})[opcionId];
      if (!peso) return;
      Object.entries(peso.areas || {}).forEach(([areaId, pts]) => {
        if (areaId in puntajesArea) puntajesArea[areaId] += pts;
      });
      Object.entries(peso.carreras || {}).forEach(([carreraId, pts]) => {
        if (carreraId in bonusCarrera) bonusCarrera[carreraId] += pts;
      });
    });

    const ranking = (CARRERAS || []).map((c, orden) => {
      const bonus = bonusCarrera[c.id] || 0;
      const puntaje = (puntajesArea[c.area] || 0) + bonus;
      const maxCarrera = (MAX_AREA[c.area] || 0) + (MAX_BONUS_CARRERA[c.id] || 0);
      const afinidad = maxCarrera > 0 ? Math.round((puntaje / maxCarrera) * 100) : 0;
      return {
        carreraId: c.id,
        nombre: c.nombre,
        area: c.area,
        areaNombre: (AREA_POR_ID[c.area] || {}).nombre || c.area,
        puntaje,
        bonus,
        afinidad: Math.min(afinidad, 100),
        _orden: orden,
      };
    });

    // Orden: afinidad desc -> puntaje desc -> bonus desc -> orden de catálogo
    ranking.sort((a, b) =>
      b.afinidad - a.afinidad ||
      b.puntaje - a.puntaje ||
      b.bonus - a.bonus ||
      a._orden - b._orden
    );

    return { puntajesArea, ranking, top3: ranking.slice(0, 3) };
  }

  // ==========================================================
  // 4. RESULTADO + ENVÍO
  // ==========================================================

  function finalizarTest() {
    const calculo = calcularResultado();

    const registro = {
      id: (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      timestamp: Date.now(),
      fechaISO: new Date().toISOString(),
      participante: estado.participante,
      respuestas: { ...estado.respuestas },
      puntajesArea: calculo.puntajesArea,
      top3: calculo.top3.map((t) => ({
        carreraId: t.carreraId,
        nombre: t.nombre,
        area: t.area,
        areaNombre: t.areaNombre,
        afinidad: t.afinidad,
        puntaje: t.puntaje,
      })),
    };

    estado.resultado = registro;
    limpiarProgreso(); // el test terminó: ya no hay progreso temporal que retomar

    // Publicar al dashboard (tiempo real). No bloquear la UI si falla.
    try {
      window.Realtime.publicar(registro);
    } catch (e) {
      console.error('[app.js] No se pudo publicar el resultado:', e);
    }

    mostrarResultado(registro);
  }

  function mostrarResultado(registro) {
    const medallas = ['🥇', '🥈', '🥉'];

    const tarjetas = registro.top3.map((c, i) => {
      const area = AREA_POR_ID[c.area] || { color: '#94a3b8' };
      const hayInfo = INFO_CARRERAS[c.carreraId];
      return `
      <div class="resultado-card p-4" style="border-left:4px solid ${area.color}">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-2xl">${medallas[i] || ''}</p>
            <h3 class="mt-1 font-bold leading-snug">${c.nombre}</h3>
            <p class="texto-suave text-xs">${c.areaNombre}</p>
          </div>
          <div class="text-right">
            <p class="resultado-afinidad text-2xl">${c.afinidad}%</p>
            <p class="texto-suave text-[10px] uppercase">afinidad</p>
          </div>
        </div>
        <div class="mini-barra mt-3"><span style="width:${c.afinidad}%"></span></div>
        ${hayInfo ? `
        <button type="button" class="btn btn--fantasma w-full mt-3" style="padding:0.55rem 0.9rem;font-size:0.85rem"
                data-info-carrera="${c.carreraId}">
          ℹ Ver información de la carrera
        </button>` : ''}
      </div>`;
    }).join('');

    // Mini-desglose por área (ordenado)
    const totalArea = Object.values(registro.puntajesArea).reduce((s, n) => s + n, 0) || 1;
    const desglose = Object.entries(registro.puntajesArea)
      .sort((a, b) => b[1] - a[1])
      .map(([areaId, pts]) => {
        const area = AREA_POR_ID[areaId] || { nombre: areaId, color: '#94a3b8' };
        const pct = Math.round((pts / totalArea) * 100);
        return `
          <div>
            <div class="flex justify-between text-xs">
              <span>${area.nombre}</span><span class="texto-suave tabular-nums">${pct}%</span>
            </div>
            <div class="mini-barra mt-1" style="height:0.375rem">
              <span style="width:${pct}%;background:${area.color}"></span>
            </div>
          </div>`;
      }).join('');

    dom.contenedorResultado.innerHTML = `
      <div class="resultado-card p-5">
        <h2 class="titulo-seccion text-lg">¡Listo, ${registro.participante.nombre}!</h2>
        <p class="texto-suave mt-1 text-sm">
          Estas son las 3 tecnicaturas del IES N.° 11 con más afinidad según tus respuestas.
        </p>
      </div>
      <div class="mt-4 space-y-3">${tarjetas}</div>
      <div class="resultado-card mt-4 p-5 space-y-3">
        <p class="dash-rotulo" style="letter-spacing:.08em">Tu perfil por área</p>
        ${desglose}
      </div>
      <div class="resultado-cierre mt-4">
        <p class="resultado-cierre__frase">
          ¡Muchos éxitos en la elección de tu futura carrera!
        </p>
        <p class="resultado-cierre__cta">¡Te esperamos en el Instituto!</p>
      </div>`;

    dom.contenedorResultado.querySelectorAll('[data-info-carrera]').forEach((btn) => {
      btn.addEventListener('click', () => abrirModalCarrera(btn.dataset.infoCarrera));
    });

    dom.test.classList.add('hidden');
    dom.bienvenida.classList.add('hidden');
    dom.resultado.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================================
  // Modal: información de la carrera
  // ==========================================================
  function abrirModalCarrera(carreraId) {
    const modal = document.getElementById('modal-carrera');
    if (!modal) return;
    const carrera = CARRERA_POR_ID[carreraId];
    const info = INFO_CARRERAS[carreraId];
    if (!carrera || !info) return;
    const area = AREA_POR_ID[carrera.area] || { nombre: '', color: '#94a3b8' };

    modal.querySelector('[data-modal-titulo]').textContent = carrera.nombre;
    const chip = modal.querySelector('[data-modal-area]');
    chip.textContent = area.nombre;
    chip.style.background = area.color;

    modal.querySelector('[data-modal-descripcion]').textContent = info.descripcion;
    modal.querySelector('[data-modal-perfil]').textContent = info.perfil;
    modal.querySelector('[data-modal-campo]').textContent = info.campoLaboral;

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal.querySelector('[data-modal-cerrar]').focus();
  }

  function cerrarModalCarrera() {
    const modal = document.getElementById('modal-carrera');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  function inicializarModalCarrera() {
    const modal = document.getElementById('modal-carrera');
    if (!modal) return;
    modal.querySelectorAll('[data-modal-cerrar]').forEach((b) => b.addEventListener('click', cerrarModalCarrera));
    modal.addEventListener('click', (ev) => {
      if (ev.target === modal || ev.target.hasAttribute('data-modal-fondo')) cerrarModalCarrera();
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !modal.hidden) cerrarModalCarrera();
    });
  }

  function reiniciarApp() {
    limpiarProgreso();
    estado.participante = null;
    estado.indiceActual = 0;
    estado.respuestas = {};
    estado.resultado = null;
    dom.form.reset();
    mostrarErrorFormulario('');
    dom.resultado.classList.add('hidden');
    dom.test.classList.add('hidden');
    dom.bienvenida.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Comprobante liviano: dibuja el Top 3 en un canvas y lo descarga como PNG.
   * Funciona sin conexión y sirve para que el alumno se lo guarde/comparta.
   */
  function descargarResultado() {
    const r = estado.resultado;
    if (!r) return;

    const W = 1000;
    const H = 1350;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d');
    const F = 'Plus Jakarta Sans, Arial, sans-serif';

    // Fondo degradado institucional
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#02447B');
    g.addColorStop(0.55, '#346FB0');
    g.addColorStop(1, '#7B79B1');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);

    // Tarjeta blanca interior
    x.fillStyle = 'rgba(255,255,255,0.97)';
    redondeado(x, 60, 60, W - 120, H - 120, 28);
    x.fill();

    const cx = W / 2;
    x.textAlign = 'center';
    x.fillStyle = '#02447B';
    x.font = `800 44px ${F}`;
    x.fillText('EXPO EDUCATIVA 2026', cx, 150);
    x.fillStyle = '#7B79B1';
    x.font = `700 30px ${F}`;
    x.fillText('Test Vocacional · IES N.° 11', cx, 195);

    x.fillStyle = '#1a2340';
    x.font = `800 40px ${F}`;
    const alumno = `${r.participante.nombre} ${r.participante.apellido}`.trim();
    x.fillText(recortar(x, alumno, W - 220), cx, 285);

    x.fillStyle = '#59668a';
    x.font = `600 26px ${F}`;
    x.fillText('Tus 3 tecnicaturas con más afinidad', cx, 340);

    const medallas = ['🥇', '🥈', '🥉'];
    let y = 400;
    r.top3.forEach((t, i) => {
      const area = (window.TEST_VOCACIONAL.AREAS || []).find((a) => a.id === t.area) || { color: '#346FB0' };
      redondeado(x, 110, y, W - 220, 175, 20);
      x.fillStyle = '#f4f6fb';
      x.fill();
      x.fillStyle = area.color;
      x.fillRect(110, y, 10, 175);

      x.textAlign = 'left';
      x.fillStyle = '#1a2340';
      x.font = `800 34px ${F}`;
      x.fillText(`${medallas[i]}  ${t.afinidad}%`, 150, y + 55);
      x.font = `700 27px ${F}`;
      envolver(x, t.nombre, 150, y + 100, W - 320, 33);
      x.fillStyle = '#59668a';
      x.font = `600 22px ${F}`;
      x.fillText(t.areaNombre, 150, y + 155);
      x.textAlign = 'center';
      y += 200;
    });

    x.fillStyle = '#02447B';
    x.font = `800 38px ${F}`;
    x.fillText('¡Te esperamos en el Instituto!', cx, y + 55);

    x.fillStyle = '#59668a';
    x.font = `500 22px ${F}`;
    const fecha = new Date(r.timestamp).toLocaleDateString('es-AR');
    x.fillText(`Gral. Alvear 1145 · San Salvador de Jujuy · ${fecha}`, cx, y + 100);
    x.fillText('Desarrollado por Tech & Innovation Team', cx, y + 132);

    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mi-resultado-expo-2026_${(r.participante.apellido || 'alumno').toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, 'image/png');
  }

  function redondeado(ctx, px, py, w, h, radio) {
    ctx.beginPath();
    ctx.moveTo(px + radio, py);
    ctx.arcTo(px + w, py, px + w, py + h, radio);
    ctx.arcTo(px + w, py + h, px, py + h, radio);
    ctx.arcTo(px, py + h, px, py, radio);
    ctx.arcTo(px, py, px + w, py, radio);
    ctx.closePath();
  }

  function recortar(ctx, texto, maxW) {
    if (ctx.measureText(texto).width <= maxW) return texto;
    let t = texto;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  function envolver(ctx, texto, px, py, maxW, lh) {
    const palabras = texto.split(' ');
    let linea = '';
    let yy = py;
    palabras.forEach((p) => {
      const prueba = linea ? linea + ' ' + p : p;
      if (ctx.measureText(prueba).width > maxW && linea) {
        ctx.fillText(linea, px, yy);
        linea = p;
        yy += lh;
      } else {
        linea = prueba;
      }
    });
    if (linea) ctx.fillText(linea, px, yy);
  }

  // ==========================================================
  // 5. ARRANQUE
  // ==========================================================

  function init() {
    dom.bienvenida = document.getElementById('pantalla-bienvenida');
    dom.test = document.getElementById('pantalla-test');
    dom.resultado = document.getElementById('pantalla-resultado');
    dom.form = document.getElementById('form-participante');
    dom.formError = document.getElementById('form-error');
    dom.contenedorTarjeta = document.getElementById('contenedor-tarjeta');
    dom.contenedorResultado = document.getElementById('contenedor-resultado');
    dom.barraFill = document.getElementById('barra-progreso-fill');
    dom.progresoTexto = document.getElementById('progreso-texto');
    dom.btnAnterior = document.getElementById('btn-anterior');
    dom.btnSiguiente = document.getElementById('btn-siguiente');
    dom.btnReiniciar = document.getElementById('btn-reiniciar');
    dom.btnDescargar = document.getElementById('btn-descargar');

    if (!PREGUNTAS || !PREGUNTAS.length) {
      mostrarErrorFormulario('No se cargó el banco de preguntas (js/questions.js).');
      return;
    }

    dom.form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const r = procesarFormulario(dom.form);
      if (!r.ok) { mostrarErrorFormulario(r.error); return; }
      mostrarErrorFormulario('');
      estado.participante = r.participante;
      iniciarTest();
    });

    dom.btnAnterior.addEventListener('click', retroceder);
    dom.btnSiguiente.addEventListener('click', avanzar);
    dom.btnReiniciar.addEventListener('click', reiniciarApp);
    if (dom.btnDescargar) dom.btnDescargar.addEventListener('click', descargarResultado);

    inicializarMenuOpciones();
    inicializarModalCarrera();

    // Auto-guardado: si el celular pasa a segundo plano (minimizar, cambiar
    // de pestaña, apagar la pantalla) guardamos el progreso al instante.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') guardarProgreso();
    });
    window.addEventListener('pagehide', guardarProgreso);

    // Al abrir la página: si hay un test a medias reciente, lo retomamos.
    restaurarProgreso();

    console.info('[app.js] Listo.',
      PREGUNTAS.length, 'preguntas ·', (CARRERAS || []).length, 'tecnicaturas.');
  }

  // ==========================================================
  // Menú de opciones (⋮) del header → acceso a la Pantalla Gigante
  // ==========================================================
  function inicializarMenuOpciones() {
    const btn = document.getElementById('btn-menu');
    const panel = document.getElementById('menu-panel');
    if (!btn || !panel) return;

    const abrir = (v) => {
      panel.hidden = !v;
      btn.setAttribute('aria-expanded', String(v));
    };

    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      abrir(panel.hidden);
    });
    document.addEventListener('click', (ev) => {
      if (!panel.hidden && !panel.contains(ev.target) && ev.target !== btn) abrir(false);
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') abrir(false);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
