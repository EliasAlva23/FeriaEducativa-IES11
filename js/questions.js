/* ============================================================
   BANCO DE PREGUNTAS Y MATRIZ DE PESOS  (js/questions.js)
   ============================================================
   Proyecto: Expo Educativa 2026 · IES N.° 11 (Jujuy, Argentina)

   Provee (global window.TEST_VOCACIONAL):
     - AREAS        -> las 5 Áreas Vocacionales oficiales.
     - CARRERAS     -> las 18 tecnicaturas del IES N.° 11 (por área).
     - PREGUNTAS    -> 10 ítems rápidos de opción única (< 2 min).
     - MATRIZ_PESOS -> aporte de cada respuesta a cada ÁREA y CARRERA.
     - ICONOS       -> set de íconos SVG (estilo Lucide) para las tarjetas
                       de respuesta. Cada opción referencia uno por nombre;
                       opcionalmente puede traer `imagen` (.webp) en su lugar.

   CÁLCULO DEL TOP 3 (js/app.js):
     puntajeCarrera = puntajeArea[carrera.area] + bonusCarrera
     -> se normaliza a % de afinidad y se toman las 3 más altas.
     Escala de pesos: 1 (leve) · 2 (medio) · 3 (fuerte).
   ============================================================ */

/* -----------------------------------------------------------
   1. Áreas Vocacionales (5) — colores diferenciados para el dashboard
   ----------------------------------------------------------- */
const AREAS = [
  { id: 'salud',      nombre: 'Salud y Bienestar',                    descripcion: 'Cuidado de personas, análisis clínicos y gestión sanitaria.', color: '#22C55E' },
  { id: 'tecnologia', nombre: 'Tecnología e Innovación',              descripcion: 'Desarrollo de software, datos e inteligencia artificial.',    color: '#6366F1' },
  { id: 'turismo',    nombre: 'Gastronomía, Turismo y Patrimonio',    descripcion: 'Turismo, hotelería, cocina regional y patrimonio cultural.',  color: '#F59E0B' },
  { id: 'industria',  nombre: 'Industria, Ambiente y Seguridad',      descripcion: 'Tecnología de alimentos, seguridad e higiene y energías.',    color: '#0EA5E9' },
  { id: 'diseno',     nombre: 'Diseño y Arte Aplicado',              descripcion: 'Diseño de indumentaria y creación visual.',                  color: '#EC4899' },
];

/* -----------------------------------------------------------
   2. Catálogo oficial de tecnicaturas (18)
   ----------------------------------------------------------- */
const CARRERAS = [
  // --- Salud y Bienestar (7) ---
  { id: 'enfermeria',              nombre: 'Tecnicatura Superior en Enfermería',                                   area: 'salud' },
  { id: 'asistente-odontologico',  nombre: 'Tecnicatura Superior en Asistente Odontológico',                       area: 'salud' },
  { id: 'laboratorio-clinico',     nombre: 'Tecnicatura Superior en Laboratorio de Análisis Clínico',              area: 'salud' },
  { id: 'agente-sanitario',        nombre: 'Tecnicatura Superior en Agente Sanitario',                             area: 'salud' },
  { id: 'admin-servicios-salud',   nombre: 'Tecnicatura Superior en Administración en Servicios de Salud',         area: 'salud' },
  { id: 'estadisticas-salud',      nombre: 'Tecnicatura Superior en Estadísticas de Salud',                        area: 'salud' },
  { id: 'gerontologia',            nombre: 'Tecnicatura Superior en Gerontología',                                 area: 'salud' },

  // --- Tecnología e Innovación (2) ---
  { id: 'desarrollo-software',     nombre: 'Tecnicatura Superior en Desarrollo de Software',                       area: 'tecnologia' },
  { id: 'ciencia-datos-ia',        nombre: 'Tecnicatura Superior en Ciencias de Datos e Inteligencia Artificial',  area: 'tecnologia' },

  // --- Gastronomía, Turismo y Patrimonio (5) ---
  { id: 'turismo',                 nombre: 'Tecnicatura Superior en Turismo',                                      area: 'turismo' },
  { id: 'guia-turismo',            nombre: 'Tecnicatura Superior en Guía de Turismo',                              area: 'turismo' },
  { id: 'hoteleria',               nombre: 'Tecnicatura Superior en Hotelería',                                    area: 'turismo' },
  { id: 'cocinas-regionales',      nombre: 'Tecnicatura Superior en Cocinas Regionales y Cultura Alimentaria',     area: 'turismo' },
  { id: 'museologia',              nombre: 'Tecnicatura Superior en Museología y Gestión Patrimonial',             area: 'turismo' },

  // --- Industria, Ambiente y Seguridad (3) ---
  { id: 'tecnologia-alimentos',    nombre: 'Tecnicatura Superior en Tecnología de los Alimentos',                  area: 'industria' },
  { id: 'seguridad-higiene',       nombre: 'Tecnicatura Superior en Seguridad e Higiene Laboral',                  area: 'industria' },
  { id: 'energias-renovables',     nombre: 'Tecnicatura Superior en Gestión de Energías Renovables',               area: 'industria' },

  // --- Diseño y Arte Aplicado (1) ---
  { id: 'diseno-indumentaria',     nombre: 'Tecnicatura Superior en Diseño de Indumentaria',                       area: 'diseno' },
];

/* -----------------------------------------------------------
   3. Íconos SVG (estilo Lucide) — sólo el contenido interno del <svg>
   -----------------------------------------------------------
   js/app.js los envuelve en:
     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ...>
   ----------------------------------------------------------- */
const ICONOS = {
  corazon:      '<path d="M12 21C12 21 4 14 4 8.5C4 5.5 6.5 3 9.5 3C11 3 12 4 12 4C12 4 13 3 14.5 3C17.5 3 20 5.5 20 8.5C20 14 12 21 12 21Z"/>',
  pulso:        '<path d="M3 12H7L9 5L13 19L15 12H21"/>',
  matraz:       '<path d="M9 3H15M10 3V9L4.5 19C4 20.4 5 21 6.5 21H17.5C19 21 20 20.4 19.5 19L14 9V3"/><path d="M7 15H17"/>',
  diente:       '<path d="M12 5C10 3 6.5 3.5 6 7C5.5 10 6.5 12 7 16C7.3 18.5 9 19.5 10 17L11 13C11.4 11.8 12.6 11.8 13 13L14 17C15 19.5 16.7 18.5 17 16C17.5 12 18.5 10 18 7C17.5 3.5 14 3 12 5Z"/>',
  personas:     '<circle cx="9" cy="8" r="3"/><path d="M3 20C3 16.5 5.5 14 9 14C12.5 14 15 16.5 15 20"/><path d="M16 5.5C17.6 5.7 19 7.2 19 9C19 10.6 18 12 16.6 12.4"/><path d="M17.5 20C17.5 17.4 19 15.5 21.5 14.7"/>',
  codigo:       '<path d="M8 6L2 12L8 18"/><path d="M16 6L22 12L16 18"/><path d="M13.5 4L10.5 20"/>',
  cpu:          '<rect x="6" y="6" width="12" height="12" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5" rx="0.5"/><path d="M9 3V6M15 3V6M9 18V21M15 18V21M3 9H6M3 15H6M18 9H21M18 15H21"/>',
  brujula:      '<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4L13.4 13.4L8.4 15.6L10.6 10.6L15.6 8.4Z"/>',
  mapa:         '<path d="M9 3L3 5.5V21L9 18.5L15 21L21 18.5V3L15 5.5L9 3Z"/><path d="M9 3V18.5M15 5.5V21"/>',
  cama:         '<path d="M3 6V20M3 12H18C19.7 12 21 13.3 21 15V20M3 16H21"/><path d="M6.5 12V9.5C6.5 8.7 7.2 8 8 8H12.5C13.3 8 14 8.7 14 9.5V12"/>',
  gorro:        '<path d="M7 21H17V14C19 13.6 20 11.6 19 9.6C18 7.6 15.5 7.2 14 8.7C13.6 6.1 10.4 6.1 10 8.7C8.5 7.2 6 7.6 5 9.6C4 11.6 5 13.6 7 14V21Z"/><path d="M7.5 17.5H16.5"/>',
  templo:       '<path d="M3 21H21M4.5 21V10.5M19.5 21V10.5M9 21V14H15V21M2.5 10.5L12 4.5L21.5 10.5"/>',
  trigo:        '<path d="M12 22V8M12 8C12 5 10 3 8 3C8 6 10 8 12 8ZM12 8C12 5 14 3 16 3C16 6 14 8 12 8ZM12 15C12 12 10 10 8 10C8 13 10 15 12 15ZM12 15C12 12 14 10 16 10C16 13 14 15 12 15Z"/>',
  casco:        '<path d="M2 18H22M4.5 18V14C4.5 9.9 7.9 6.5 12 6.5C16.1 6.5 19.5 9.9 19.5 14V18"/><path d="M9 6.5V4.5C9 3.7 9.7 3 10.5 3H13.5C14.3 3 15 3.7 15 4.5V6.5"/>',
  sol:          '<circle cx="12" cy="12" r="4"/><path d="M12 2V5M12 19V22M2 12H5M19 12H22M5 5L7 7M17 17L19 19M19 5L17 7M7 17L5 19"/>',
  tijeras:      '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8 8.5L20 19M8 15.5L20 5M9.5 12L13 14.5"/>',
  grafico:      '<path d="M4 4V20H20"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8.5" width="3" height="9.5"/><rect x="17" y="5.5" width="3" height="12.5"/>',
  portapapeles: '<rect x="7" y="4" width="10" height="18" rx="2"/><path d="M9 4V3C9 2.4 9.4 2 10 2H14C14.6 2 15 2.4 15 3V4"/><path d="M10 10H14M10 14H14M10 18H12"/>',
  lampara:      '<path d="M9 18H15M10 21H14M12 3C8.7 3 6 5.7 6 9C6 11.4 7.3 13.4 9 14.4V16H15V14.4C16.7 13.4 18 11.4 18 9C18 5.7 15.3 3 12 3Z"/>',
  estrella:     '<path d="M12 3L14.5 9L21 9.5L16 13.5L17.5 20L12 16.5L6.5 20L8 13.5L3 9.5L9.5 9L12 3Z"/>',
};

/* -----------------------------------------------------------
   4. Banco de preguntas (10) — opción única, 5 tarjetas con ícono
   -----------------------------------------------------------
   Formato de opción: { id, texto, icono }  ó  { id, texto, imagen }
   (si `imagen` está, app.js muestra el .webp en vez del ícono)
   ----------------------------------------------------------- */
const PREGUNTAS = [
  {
    id: 'q1',
    texto: 'Cuando tenés tiempo libre, ¿qué te tienta más hacer?',
    tipo: 'opcion-unica',
    opciones: [
      { id: 'a', texto: 'Cuidar y ayudar a otras personas', icono: 'pulso' },
      { id: 'b', texto: 'Usar la compu para crear o resolver algo', icono: 'codigo' },
      { id: 'c', texto: 'Recibir gente, cocinar o mostrar lugares', icono: 'gorro' },
      { id: 'd', texto: 'Entender cómo se produce algo y cuidar el ambiente', icono: 'trigo' },
      { id: 'e', texto: 'Dibujar, diseñar y crear cosas con tus manos', icono: 'tijeras' },
    ],
  },
  {
    id: 'q2',
    texto: 'En un grupo, ¿qué rol tomás naturalmente?',
    tipo: 'opcion-unica',
    opciones: [
      { id: 'a', texto: 'El que contiene y escucha a todos', icono: 'corazon' },
      { id: 'b', texto: 'El que arma la parte técnica o digital', icono: 'cpu' },
      { id: 'c', texto: 'El que organiza la salida y atiende a la gente', icono: 'mapa' },
      { id: 'd', texto: 'El que se fija en la seguridad y los detalles', icono: 'casco' },
      { id: 'e', texto: 'El que le pone estética al resultado', icono: 'estrella' },
    ],
  },
  {
    id: 'q3',
    texto: '¿Qué tema te engancha más en clase?',
    tipo: 'opcion-unica',
    opciones: [
      { id: 'a', texto: 'Biología y cuerpo humano', icono: 'matraz' },
      { id: 'b', texto: 'Matemática, lógica y programación', icono: 'codigo' },
      { id: 'c', texto: 'Historia, geografía y culturas', icono: 'templo' },
      { id: 'd', texto: 'Química, ambiente y procesos', icono: 'sol' },
      { id: 'e', texto: 'Arte y expresión visual', icono: 'tijeras' },
    ],
  },
  {
    id: 'q4',
    texto: '¿Cómo te gustaría trabajar?',
    tipo: 'opcion-unica',
    opciones: [
      { id: 'a', texto: 'En contacto directo con las personas', icono: 'personas' },
      { id: 'b', texto: 'Con una computadora, incluso a distancia', icono: 'cpu' },
      { id: 'c', texto: 'Viajando y conociendo lugares', icono: 'brujula' },
      { id: 'd', texto: 'En una planta, un campo o un laboratorio', icono: 'trigo' },
      { id: 'e', texto: 'En un taller creando prototipos', icono: 'tijeras' },
    ],
  },
  {
    id: 'q5',
    texto: 'Un logro que te haría muy feliz:',
    tipo: 'opcion-unica',
    opciones: [
      { id: 'a', texto: 'Que un paciente se recupere gracias a vos', icono: 'pulso' },
      { id: 'b', texto: 'Que tu programa lo use un montón de gente', icono: 'codigo' },
      { id: 'c', texto: 'Que un turista se lleve un recuerdo inolvidable', icono: 'mapa' },
      { id: 'd', texto: 'Que un proceso sea más limpio y seguro', icono: 'sol' },
      { id: 'e', texto: 'Que tu diseño se vea puesto por la calle', icono: 'estrella' },
    ],
  },
  {
    id: 'q6',
    texto: '¿Qué herramienta te representa?',
    tipo: 'opcion-unica',
    opciones: [
      { id: 'a', texto: 'Un estetoscopio y un guardapolvo', icono: 'corazon' },
      { id: 'b', texto: 'Una notebook y código', icono: 'codigo' },
      { id: 'c', texto: 'Un mapa y una cámara', icono: 'brujula' },
      { id: 'd', texto: 'Un casco y guantes de trabajo', icono: 'casco' },
      { id: 'e', texto: 'Tijeras, telas y bocetos', icono: 'tijeras' },
    ],
  },
  {
    id: 'q7',
    texto: 'Dentro del área de la salud, ¿qué te atrae más?',
    tipo: 'opcion-unica',
    opciones: [
      { id: 'a', texto: 'Cuidar al paciente: tomar signos, aplicar cuidados', icono: 'pulso' },
      { id: 'b', texto: 'Analizar muestras y sangre en el laboratorio', icono: 'matraz' },
      { id: 'c', texto: 'Asistir en el consultorio odontológico', icono: 'diente' },
      { id: 'd', texto: 'Acompañar y cuidar adultos mayores', icono: 'personas' },
      { id: 'e', texto: 'Ordenar turnos, historias clínicas y estadísticas', icono: 'portapapeles' },
    ],
  },
  {
    id: 'q8',
    texto: '¿Cuál de estas tareas te suena mejor?',
    tipo: 'opcion-unica',
    opciones: [
      { id: 'a', texto: 'Programar aplicaciones y sistemas', icono: 'codigo' },
      { id: 'b', texto: 'Analizar datos y entrenar modelos de IA', icono: 'cpu' },
      { id: 'c', texto: 'Controlar la calidad y seguridad de un alimento', icono: 'matraz' },
      { id: 'd', texto: 'Prevenir accidentes y cuidar la salud laboral', icono: 'casco' },
      { id: 'e', texto: 'Impulsar la energía solar y renovable', icono: 'sol' },
    ],
  },
  {
    id: 'q9',
    texto: 'Te ves trabajando…',
    tipo: 'opcion-unica',
    opciones: [
      { id: 'a', texto: 'Guiando recorridos por la Quebrada y los cerros', icono: 'brujula' },
      { id: 'b', texto: 'En la recepción y la gestión de un hotel', icono: 'cama' },
      { id: 'c', texto: 'En una cocina rescatando recetas jujeñas', icono: 'gorro' },
      { id: 'd', texto: 'En un museo cuidando el patrimonio', icono: 'templo' },
      { id: 'e', texto: 'En un taller diseñando indumentaria', icono: 'tijeras' },
    ],
  },
  {
    id: 'q10',
    texto: 'Lo que más valorás de un trabajo:',
    tipo: 'opcion-unica',
    opciones: [
      { id: 'a', texto: 'Ayudar a que la gente esté sana', icono: 'corazon' },
      { id: 'b', texto: 'Crear tecnología útil e innovadora', icono: 'lampara' },
      { id: 'c', texto: 'Generar experiencias y mostrar la cultura', icono: 'mapa' },
      { id: 'd', texto: 'Cuidar el ambiente y mejorar la producción', icono: 'sol' },
      { id: 'e', texto: 'Expresar identidad a través del diseño', icono: 'estrella' },
    ],
  },
];

/* -----------------------------------------------------------
   5. Matriz de pesos
   -----------------------------------------------------------
   Q1–Q6 y Q10: mapeo directo de área (peso 3).
   Q7–Q9: "afinadores" — peso de área menor (2) + bonus fuerte de carrera
   para distinguir el Top 3 dentro de una misma área.
   ----------------------------------------------------------- */
const MATRIZ_PESOS = {
  q1: {
    a: { areas: { salud: 3 } },
    b: { areas: { tecnologia: 3 }, carreras: { 'desarrollo-software': 1 } },
    c: { areas: { turismo: 3 }, carreras: { 'cocinas-regionales': 1 } },
    d: { areas: { industria: 3 }, carreras: { 'tecnologia-alimentos': 1 } },
    e: { areas: { diseno: 3 }, carreras: { 'diseno-indumentaria': 1 } },
  },
  q2: {
    a: { areas: { salud: 3 }, carreras: { enfermeria: 1, gerontologia: 1 } },
    b: { areas: { tecnologia: 3 }, carreras: { 'ciencia-datos-ia': 1 } },
    c: { areas: { turismo: 3 }, carreras: { turismo: 1, hoteleria: 1 } },
    d: { areas: { industria: 3 }, carreras: { 'seguridad-higiene': 1 } },
    e: { areas: { diseno: 3 }, carreras: { 'diseno-indumentaria': 1 } },
  },
  q3: {
    a: { areas: { salud: 3 }, carreras: { 'laboratorio-clinico': 1 } },
    b: { areas: { tecnologia: 3 }, carreras: { 'desarrollo-software': 1 } },
    c: { areas: { turismo: 3 }, carreras: { museologia: 1, 'guia-turismo': 1 } },
    d: { areas: { industria: 3 }, carreras: { 'tecnologia-alimentos': 1 } },
    e: { areas: { diseno: 3 }, carreras: { 'diseno-indumentaria': 1 } },
  },
  q4: {
    a: { areas: { salud: 3 }, carreras: { enfermeria: 1, 'agente-sanitario': 1 } },
    b: { areas: { tecnologia: 3 }, carreras: { 'desarrollo-software': 1, 'ciencia-datos-ia': 1 } },
    c: { areas: { turismo: 3 }, carreras: { 'guia-turismo': 1 } },
    d: { areas: { industria: 3 }, carreras: { 'tecnologia-alimentos': 1, 'energias-renovables': 1 } },
    e: { areas: { diseno: 3 }, carreras: { 'diseno-indumentaria': 1 } },
  },
  q5: {
    a: { areas: { salud: 3 }, carreras: { enfermeria: 1 } },
    b: { areas: { tecnologia: 3 }, carreras: { 'desarrollo-software': 1 } },
    c: { areas: { turismo: 3 }, carreras: { turismo: 1 } },
    d: { areas: { industria: 3 }, carreras: { 'energias-renovables': 1 } },
    e: { areas: { diseno: 3 }, carreras: { 'diseno-indumentaria': 1 } },
  },
  q6: {
    a: { areas: { salud: 3 }, carreras: { enfermeria: 1, 'asistente-odontologico': 1 } },
    b: { areas: { tecnologia: 3 }, carreras: { 'ciencia-datos-ia': 1 } },
    c: { areas: { turismo: 3 }, carreras: { 'guia-turismo': 1 } },
    d: { areas: { industria: 3 }, carreras: { 'seguridad-higiene': 1 } },
    e: { areas: { diseno: 3 }, carreras: { 'diseno-indumentaria': 1 } },
  },

  // --- Afinadores ---
  q7: {
    a: { areas: { salud: 2 }, carreras: { enfermeria: 3, 'agente-sanitario': 2 } },
    b: { areas: { salud: 2 }, carreras: { 'laboratorio-clinico': 3 } },
    c: { areas: { salud: 2 }, carreras: { 'asistente-odontologico': 3 } },
    d: { areas: { salud: 2 }, carreras: { gerontologia: 3, 'agente-sanitario': 1 } },
    e: { areas: { salud: 2 }, carreras: { 'admin-servicios-salud': 3, 'estadisticas-salud': 3 } },
  },
  q8: {
    a: { areas: { tecnologia: 2 }, carreras: { 'desarrollo-software': 3 } },
    b: { areas: { tecnologia: 2 }, carreras: { 'ciencia-datos-ia': 3, 'estadisticas-salud': 1 } },
    c: { areas: { industria: 2 }, carreras: { 'tecnologia-alimentos': 3 } },
    d: { areas: { industria: 2 }, carreras: { 'seguridad-higiene': 3, 'agente-sanitario': 1 } },
    e: { areas: { industria: 2 }, carreras: { 'energias-renovables': 3 } },
  },
  q9: {
    a: { areas: { turismo: 2 }, carreras: { 'guia-turismo': 3, turismo: 1 } },
    b: { areas: { turismo: 2 }, carreras: { hoteleria: 3, turismo: 1 } },
    c: { areas: { turismo: 2 }, carreras: { 'cocinas-regionales': 3 } },
    d: { areas: { turismo: 2 }, carreras: { museologia: 3 } },
    e: { areas: { diseno: 2 }, carreras: { 'diseno-indumentaria': 3 } },
  },

  q10: {
    a: { areas: { salud: 3 }, carreras: { 'agente-sanitario': 1 } },
    b: { areas: { tecnologia: 3 } },
    c: { areas: { turismo: 3 }, carreras: { turismo: 1 } },
    d: { areas: { industria: 3 } },
    e: { areas: { diseno: 3 }, carreras: { 'diseno-indumentaria': 1 } },
  },
};

/* -----------------------------------------------------------
   6. Validación mínima de consistencia (solo desarrollo)
   ----------------------------------------------------------- */
(function validarCatalogo() {
  const idsAreas = new Set(AREAS.map((a) => a.id));
  const idsCarreras = new Set(CARRERAS.map((c) => c.id));

  CARRERAS.forEach((c) => {
    if (!idsAreas.has(c.area)) console.warn(`[questions.js] carrera "${c.id}" → área inexistente "${c.area}"`);
  });

  Object.entries(MATRIZ_PESOS).forEach(([qId, opciones]) => {
    Object.entries(opciones).forEach(([opId, peso]) => {
      Object.keys(peso.areas || {}).forEach((a) => {
        if (!idsAreas.has(a)) console.warn(`[questions.js] ${qId}.${opId} → área inexistente "${a}"`);
      });
      Object.keys(peso.carreras || {}).forEach((c) => {
        if (!idsCarreras.has(c)) console.warn(`[questions.js] ${qId}.${opId} → carrera inexistente "${c}"`);
      });
    });
  });

  const sinPeso = PREGUNTAS.filter((p) => !MATRIZ_PESOS[p.id]);
  if (sinPeso.length) console.warn('[questions.js] preguntas sin fila en MATRIZ_PESOS:', sinPeso.map((p) => p.id));

  const carrerasConCamino = new Set();
  Object.values(MATRIZ_PESOS).forEach((ops) =>
    Object.values(ops).forEach((p) => Object.keys(p.carreras || {}).forEach((c) => carrerasConCamino.add(c))));
  const huerfanas = CARRERAS.filter((c) => !carrerasConCamino.has(c.id));
  if (huerfanas.length) {
    console.info('[questions.js] carreras que dependen sólo del puntaje de área:',
      huerfanas.map((c) => c.id));
  }
})();

/* -----------------------------------------------------------
   7. Catálogo explicativo de las 18 tecnicaturas
   -----------------------------------------------------------
   Se muestra en la pantalla final del alumno (modal "Ver información
   de la carrera"). Textos EDITABLES por el Instituto: son un resumen
   orientativo, no el plan de estudios oficial.
   Formato: { descripcion, perfil, campoLaboral }
   ----------------------------------------------------------- */
const INFO_CARRERAS = {
  'enfermeria': {
    descripcion: 'Forma profesionales para el cuidado integral de la salud de personas, familias y comunidades, en todas las etapas de la vida.',
    perfil: 'Persona empática, responsable y con capacidad de trabajo en equipo, que puede actuar con calma en situaciones críticas y sostener el cuidado del paciente.',
    campoLaboral: 'Hospitales, centros de salud, clínicas, geriátricos, atención domiciliaria, emergencias y campañas sanitarias.',
  },
  'asistente-odontologico': {
    descripcion: 'Prepara para asistir al odontólogo en la atención clínica: instrumental, esterilización, preparación del paciente y registro de historias clínicas.',
    perfil: 'Persona prolija, ordenada, con buen trato y atención al detalle, cómoda trabajando en un consultorio.',
    campoLaboral: 'Consultorios y clínicas odontológicas privadas, obras sociales, hospitales y centros de salud con servicio de odontología.',
  },
  'laboratorio-clinico': {
    descripcion: 'Capacita para tomar y procesar muestras biológicas (sangre, orina, etc.) y realizar los análisis que ayudan a diagnosticar enfermedades.',
    perfil: 'Persona metódica y precisa, con interés por la biología y la química y buen manejo de instrumental y protocolos.',
    campoLaboral: 'Laboratorios de análisis clínicos, hospitales, bancos de sangre, laboratorios de investigación y control de calidad.',
  },
  'agente-sanitario': {
    descripcion: 'Forma promotores de salud que trabajan en el territorio: visitan hogares, hacen prevención, seguimiento de pacientes y vinculan a la gente con el sistema de salud.',
    perfil: 'Persona comunicativa, comprometida con su comunidad, con facilidad para el trato y para caminar el barrio.',
    campoLaboral: 'Centros de atención primaria (CAPS), programas provinciales y municipales de salud, ONG y campañas de prevención.',
  },
  'admin-servicios-salud': {
    descripcion: 'Prepara para organizar y administrar instituciones de salud: turnos, recursos, personal, insumos, facturación a obras sociales y circuitos administrativos.',
    perfil: 'Persona organizada, con capacidad de gestión, manejo de sistemas informáticos y trato con el público.',
    campoLaboral: 'Áreas administrativas de hospitales, clínicas, sanatorios, obras sociales, farmacias y centros de diagnóstico.',
  },
  'estadisticas-salud': {
    descripcion: 'Forma técnicos que recopilan, cargan, controlan y analizan los datos de salud (nacimientos, enfermedades, atenciones) para producir estadísticas confiables.',
    perfil: 'Persona con afinidad por los números, atenta al detalle, ordenada y con manejo de planillas y bases de datos.',
    campoLaboral: 'Departamentos de estadística de hospitales y ministerios de salud, sistemas de vigilancia epidemiológica y áreas de información sanitaria.',
  },
  'gerontologia': {
    descripcion: 'Capacita para acompañar y cuidar a las personas mayores promoviendo su autonomía, su bienestar físico, emocional y social.',
    perfil: 'Persona paciente, respetuosa y afectuosa, con vocación de servicio y escucha activa.',
    campoLaboral: 'Residencias y centros de día para personas mayores, cuidados domiciliarios, programas municipales para la tercera edad y obras sociales.',
  },
  'desarrollo-software': {
    descripcion: 'Forma programadores capaces de analizar, diseñar, construir y mantener aplicaciones web y móviles, y de trabajar con bases de datos.',
    perfil: 'Persona lógica, curiosa y perseverante, que disfruta resolver problemas y aprender tecnologías nuevas de forma autónoma.',
    campoLaboral: 'Empresas de software, áreas de sistemas de organizaciones, trabajo freelance y remoto, startups y emprendimientos propios.',
  },
  'ciencia-datos-ia': {
    descripcion: 'Prepara para recolectar, limpiar y analizar grandes volúmenes de datos, crear visualizaciones y entrenar modelos de inteligencia artificial y machine learning.',
    perfil: 'Persona analítica, con gusto por la matemática y la estadística, atención al detalle y pensamiento crítico.',
    campoLaboral: 'Áreas de analítica y business intelligence, empresas de tecnología, organismos públicos, banca, salud y consultoras de datos.',
  },
  'turismo': {
    descripcion: 'Forma técnicos para planificar, comercializar y gestionar servicios y productos turísticos, valorando el patrimonio natural y cultural de Jujuy.',
    perfil: 'Persona sociable, organizada, con interés por otras culturas y, preferentemente, con manejo de idiomas.',
    campoLaboral: 'Agencias de viajes, hoteles, organismos de turismo, empresas de transporte, eventos y emprendimientos turísticos regionales.',
  },
  'guia-turismo': {
    descripcion: 'Capacita para conducir y acompañar grupos de turistas, interpretar el patrimonio y garantizar una experiencia segura y memorable en cada recorrido.',
    perfil: 'Persona comunicativa, dinámica, con buena memoria, resistencia física y pasión por contar la historia y la naturaleza del lugar.',
    campoLaboral: 'Guiado en la Quebrada, Puna y Yungas, agencias receptivas, museos y sitios históricos, turismo de aventura y cultural.',
  },
  'hoteleria': {
    descripcion: 'Forma para la organización y operación de establecimientos de alojamiento: recepción, reservas, atención al huésped, pisos y coordinación de áreas.',
    perfil: 'Persona amable, resolutiva, con vocación de servicio, prolijidad y capacidad de trabajar bajo presión y en distintos turnos.',
    campoLaboral: 'Hoteles, hosterías, cabañas, hostels, complejos turísticos y áreas de alojamiento de empresas de eventos.',
  },
  'cocinas-regionales': {
    descripcion: 'Prepara en técnicas de cocina con foco en la identidad alimentaria del NOA: productos andinos, recetas tradicionales y puesta en valor de la cultura gastronómica.',
    perfil: 'Persona creativa, ordenada, con buen paladar, interés por la cultura local y capacidad de trabajo en equipo en la cocina.',
    campoLaboral: 'Restaurantes y peñas, hoteles, catering y eventos, emprendimientos gastronómicos, turismo rural y comunitario.',
  },
  'museologia': {
    descripcion: 'Forma técnicos para conservar, documentar, exhibir y difundir el patrimonio cultural y natural en museos, archivos y sitios históricos.',
    perfil: 'Persona cuidadosa, con sensibilidad por la historia y el arte, capacidad de investigación y de comunicar al público.',
    campoLaboral: 'Museos provinciales y municipales, archivos, sitios arqueológicos e históricos, centros culturales y proyectos de puesta en valor del patrimonio.',
  },
  'tecnologia-alimentos': {
    descripcion: 'Capacita para intervenir en la elaboración, conservación y control de calidad e inocuidad de alimentos, aplicando normas bromatológicas.',
    perfil: 'Persona metódica, con interés por la química y la biología, atenta a la higiene y a los procesos productivos.',
    campoLaboral: 'Industrias y pymes alimentarias, plantas de producción, laboratorios de control de calidad, organismos de bromatología y emprendimientos.',
  },
  'seguridad-higiene': {
    descripcion: 'Forma para prevenir riesgos laborales: identificar peligros, proponer mejoras, capacitar al personal y colaborar en el cumplimiento de la normativa de higiene y seguridad.',
    perfil: 'Persona observadora, responsable, con capacidad de comunicación y de hacer cumplir procedimientos.',
    campoLaboral: 'Empresas industriales, de la construcción, minería, comercio y servicios; aseguradoras de riesgos del trabajo (ART) y consultoras.',
  },
  'energias-renovables': {
    descripcion: 'Prepara para instalar, operar y mantener sistemas de energía solar y otras fuentes renovables, y para asesorar en eficiencia energética.',
    perfil: 'Persona práctica, con interés por la tecnología y el ambiente, y facilidad para el trabajo técnico y de campo.',
    campoLaboral: 'Empresas de energía solar, cooperativas eléctricas, organismos públicos de energía, proyectos rurales y mantenimiento de parques solares (Jujuy es referente).',
  },
  'diseno-indumentaria': {
    descripcion: 'Forma para diseñar y desarrollar prendas y colecciones: bocetado, moldería, elección de materiales y confección, con mirada de identidad regional.',
    perfil: 'Persona creativa, con sensibilidad estética, habilidad manual y capacidad de llevar una idea desde el boceto al producto.',
    campoLaboral: 'Talleres y marcas de indumentaria, producción textil, emprendimientos propios, vestuario para espectáculos y proyectos con identidad local.',
  },
};

(function validarInfo() {
  const sinInfo = CARRERAS.filter((c) => !INFO_CARRERAS[c.id]);
  if (sinInfo.length) console.warn('[questions.js] carreras sin ficha en INFO_CARRERAS:', sinInfo.map((c) => c.id));
})();

/* -----------------------------------------------------------
   8. Exportación
   ----------------------------------------------------------- */
window.TEST_VOCACIONAL = { AREAS, CARRERAS, PREGUNTAS, MATRIZ_PESOS, ICONOS, INFO_CARRERAS };
