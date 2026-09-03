# Expo Educativa 2026 · IES N.° 11 (Jujuy, Argentina)

Sistema web para el Test Vocacional de la Expo Educativa.
Tecnicatura Superior en Ciencia de Datos e IA · **Tech & Innovation Team**.

## Componentes

| Archivo | Rol |
|---|---|
| `index.html` | App móvil del estudiante (test tipo tarjetas en el celular). |
| `dashboard.html` | Pantalla Gigante del stand (resultados en vivo). |
| `css/styles.css` | Sistema de tema Glow UI (paleta oficial, claro/oscuro, glow, vidrio) + componentes. |
| `js/theme.js` | Toggle claro/oscuro, preferencia en `localStorage`, evento `tema:cambio`. |
| `js/questions.js` | 5 áreas, 18 tecnicaturas oficiales, 10 preguntas, íconos SVG, matriz de pesos y **fichas de las 18 carreras** (`INFO_CARRERAS`). |
| `js/realtime.js` | Canal en tiempo real **multi-dispositivo** (ntfy.sh) + espejo `localStorage` + `BroadcastChannel`. |
| `js/app.js` | Lógica del test: formulario, tarjetas con ícono, Top 3, modal de carrera, descarga de comprobante, envío. |
| `js/dashboard-auth.js` | Reja de acceso al dashboard (PIN `admin11`). |
| `js/dashboard.js` | Datos en vivo, podio, gráficos, 2 vistas (General / Detallada), CSV. |
| `img/` | `logo-TIT.png` (equipo) y `logo-ies11.png` (escudo — ver `img/LEEME.txt`). |

## Estructura

```
FeriaEducativa-IES11/
├── index.html            · app del estudiante (SEO + Open Graph)
├── dashboard.html        · pantalla gigante (noindex)
├── vercel.json           · config de deploy en Vercel
├── netlify.toml          · config de deploy en Netlify
├── .gitignore
├── css/
│   └── styles.css
├── img/
│   ├── logo-TIT.png      · logo del equipo (optimizado, 256 px)
│   ├── logo-ies11.png    · escudo — FALTA (hay placeholder "11"), ver img/LEEME.txt
│   └── og-cover.png      · portada 1200×630 para redes
├── js/
│   ├── theme.js
│   ├── questions.js
│   ├── realtime.js        · ntfy.sh + localStorage + BroadcastChannel
│   ├── app.js
│   ├── dashboard-auth.js  · PIN de acceso al dashboard
│   └── dashboard.js
└── tools/
    ├── qr.html           · generador de QR en el navegador (sin instalar nada)
    └── generar-qr.mjs    · generador de QR por consola (Node)
```

Chart.js se carga por CDN en `dashboard.html` (`chart.js@4.4.1`, build UMD).
Todo lo demás es 100% estático: **no hay build ni backend**.

## Identidad visual (Glow UI)

- **Tipografía**: Plus Jakarta Sans (Google Fonts, `<link>` en ambos HTML).
- **Paleta oficial** (variables CSS en `css/styles.css`):
  Púrpura `#B78FB6` · Violeta `#7B79B1` · Azul Vivo `#346FB0` · Azul Marino `#02447B` · Azul Profundo `#003467`.
- **Look**: contenedores tipo vidrio (`backdrop-filter`) con **resplandor violeta/azul**
  (`--glow`), bordes de **20 px**, botones con degradado dinámico. Fondo con degradado pastel
  en claro (`#E2E8F0 → #DBEAFE → #E9D5FF`) e invertido profundo en oscuro.
- **Tarjetas de respuesta**: cada opción del test es una tarjeta con **ícono SVG** (set estilo
  Lucide en `js/questions.js` → `ICONOS`). Soporta `imagen` (`.webp`) por opción si se quiere
  usar ilustraciones en vez del ícono.
- **Modo claro / oscuro**: botón sólido de alto contraste en el header (`[data-toggle-tema]`).
  `js/theme.js` pone `data-tema="claro|oscuro"` en `<html>`, lo guarda en `localStorage`
  (`feria_ies11_tema`) y, si el usuario nunca eligió, sigue `prefers-color-scheme`. Emite
  `tema:cambio` en `document` (lo escucha `dashboard.js` para re-colorear los gráficos).
- **Header**: institución (escudo `img/logo-ies11.png` + "IES N.° 11" + leyenda) ·
  título centrado en mayúsculas ("EXPO EDUCATIVA 2026" / "TEST VOCACIONAL") ·
  botón de tema + menú **⋮** (desplegable con acceso a `dashboard.html`). El logo del
  equipo va **sólo en el footer**.
- **Footer institucional**: dirección (link a Google Maps), teléfono, Facebook oficial y
  **una sola línea de crédito**: `logo-TIT.png` + "Desarrollado por Tech & Innovation Team — IES N.° 11".
- **Contraste en modo oscuro**: `input`, `select` y sus `<option>` se fuerzan a fondo
  `--c-blue-dark` (#003467) con texto blanco (`css/styles.css`), y el `<select>` lleva
  `color-scheme: dark` para que el desplegable nativo también sea oscuro.
- **Campo "Localidad"**: `<select>` con 12 localidades de Jujuy (antes era texto libre).

## Decisiones de arquitectura

- **Estilos**: Tailwind CSS vía CDN + `css/styles.css` para variables de marca y componentes propios.
- **Tiempo real multi-dispositivo** (`js/realtime.js`, interfaz `window.Realtime`):
  - **Transporte principal: [ntfy.sh](https://ntfy.sh)** — bus público en tiempo real, **sin registrarse**.
    - Publicar = `POST https://ntfy.sh/<TOPIC>` (texto plano).
    - Escuchar = `EventSource` (SSE) a `/<TOPIC>/sse?since=<ts>`; los reintentos usan `Last-Event-ID`.
    - Relleno inicial = `GET /<TOPIC>/json?poll=1&since=all`.
    - El celular del alumno (4G/WiFi) publica → la netbook del stand, suscripta al mismo tópico, recibe al instante.
  - **Espejo `localStorage`**: el historial completo sobrevive recargas y cortes de internet
    (ntfy sólo cachea ~12 h). Deduplica por `id` contra el espejo.
  - **`BroadcastChannel`**: sincronización instantánea entre pestañas del mismo equipo y respaldo offline.
  - **`Realtime.estadoRemoto()`** → `'conectado' | 'sin-conexion' | 'local'` (el dashboard muestra un aviso si cae).
  - ⚠️ El **tópico ntfy es público**: `expo-ies11-2026-vocacional-<sufijo>` (`TOPIC_BASE` + `SUFIJO_DEFECTO`
    en `realtime.js`; el sufijo se puede sobrescribir localmente con `Realtime.rotarCanal()`).
    Cualquiera que sepa el nombre puede leer/escribir. Cambiá el sufijo para "resetear" el canal de raíz.
    **No enviar datos sensibles.**
  - Interfaz estable (`publicar` / `suscribirse` / `suscribirseAReinicio` / `obtenerHistorial` /
    `reiniciar` / `estadoRemoto`): migrar a Firebase/Supabase más adelante no toca `app.js` ni `dashboard.js`.

- **Acceso al dashboard** (`js/dashboard-auth.js`): PIN **`admin11`** (constante `PIN`). Sin PIN,
  el contenido queda oculto (`data-dash-locked` en `<html>`); a los 3 intentos fallidos redirige a
  `index.html`. Una vez validado, el equipo queda recordado (`localStorage`). Es una **barrera para el
  stand, no seguridad real** (código y datos viven en el navegador).

## Modelo de datos del test (`js/questions.js`)

- **5 Áreas Vocacionales oficiales**: `salud` (Salud y Bienestar) · `tecnologia`
  (Tecnología e Innovación) · `turismo` (Gastronomía, Turismo y Patrimonio) ·
  `industria` (Industria, Ambiente y Seguridad) · `diseno` (Diseño y Arte Aplicado).
  Cada área tiene un color propio (usado en el gráfico de barras multicolor).
- **18 tecnicaturas del IES N.° 11**: Salud (7) · Tecnología (2) · Turismo (5) ·
  Industria (3) · Diseño (1). Cada una con `id`, `nombre`, `area`.
- **10 preguntas** de opción única (5 tarjetas con ícono). Q1–Q6 y Q10 mapean área
  directa (peso 3); Q7–Q9 son "afinadores" (peso de área 2 + bonus fuerte de carrera)
  para distinguir dentro de un área con muchas tecnicaturas (sobre todo Salud).
- **`MATRIZ_PESOS[preguntaId][opcionId] = { areas:{...}, carreras:{...} }`** — escala 1–3.
- **Cálculo del Top 3** (`app.js`): `puntajeCarrera = puntajeArea[area] + bonusCarrera`,
  se normaliza a % de afinidad, se ordena y se toman las 3 primeras.
- **`INFO_CARRERAS`**: ficha de cada tecnicatura (`descripcion`, `perfil`, `campoLaboral`).
  Se muestra en el modal "ℹ Ver información de la carrera" de la pantalla final.
  **Textos orientativos y editables** por el Instituto — no son el plan de estudios oficial.

## Panel analítico del dashboard

Estructura modular por tarjetas — **todo reacciona al filtro por Jornada** (Global / Día 1-3):

- **Fila KPI** (siempre visible): *Encuestados totales* · *Edad promedio* (calculada sobre quienes
  indicaron su edad) · *Carrera más elegida* (la N.° 1 del ranking, con el color de su área).
- **Vista General**:
  - *Ranking de las 18 tecnicaturas* — barras horizontales por total de apariciones, color por área.
  - *Presencia en las 3 afinidades principales* — barras apiladas 1.ª / 2.ª / 3.ª opción por carrera.
  - *Áreas vocacionales* — anillo + leyenda **expandible**: al tocar un área lista sus carreras.
  - *Podio Top 3* (🥇🥈🥉) y *Feed* de actividad.
- **Vista Detallada**:
  - *Desglose por tecnicatura* — las 18 de más a menos votada, votos exactos y % sobre el total.
  - **Demografía**: *Situación educativa* · *Origen / localidad* (top localidades) ·
    *Por género y edad* (distribución por género y por rango etario `<18 / 18-24 / 25-34 / 35+`).
- **Textos explicativos** bajo cada rótulo de panel indicando qué se está analizando.

### Datos del formulario

El test recoge nombre, apellido, edad, **género (opcional)**, localidad (`<select>` de Jujuy) y
situación educativa (`<select>`: cursando 3.°/4.°, último año, egresado, estudiando y trabajando, otra).

### Exportar / limpiar

- **Exportar Dataset CSV** (footer): PIN `admin11`, `;` + UTF-8 con BOM. Columnas:
  `ID; Fecha_Hora; Nombre; Apellido; Edad; Genero; Localidad; Situacion_Educativa;
  Top1_Carrera; Top2_Carrera; Top3_Carrera`. Exporta la jornada seleccionada.
- **🧹 Limpiar datos de prueba** (footer, modo administrador): PIN `admin11` + confirmación →
  `Realtime.reiniciar()`. Deja los contadores en cero **en todos los equipos conectados al canal**
  (publica un marcador de reinicio por ntfy). Para un canal 100% nuevo para la jornada oficial:
  cambiar `SUFIJO_DEFECTO` en `js/realtime.js` y volver a subir (o `Realtime.rotarCanal()` por consola).

## Estado del proyecto

- [x] **Paso 1 — Arquitectura base**: estructura de carpetas y archivos boilerplate con comentarios.
- [x] **Paso 2 — Banco de preguntas y pesos**: 5 áreas, 18 tecnicaturas, 8 preguntas y matriz de pesos.
- [x] **Paso 3 — Lógica del test**: formulario + sanitización, navegación de tarjetas, motor de scoring, Top 3 y publicación al canal en vivo.
- [x] **Paso 4 — Canal en vivo**: adaptador `localStorage` + `BroadcastChannel` en `realtime.js` (probado cross-tab).
- [x] **Paso 5 — Pantalla Gigante**: `dashboard.js` consume `Realtime` (historial + suscripción), contador,
      podio, feed + toasts y 2 gráficos Chart.js (dona por área + barras multicolor de las 18 tecnicaturas).
- [x] **Rediseño visual**: identidad IES N.° 11, paleta oficial, header de 3 bloques, toggle claro/oscuro y footer institucional.
- [x] **Preparación para deploy**: meta SEO/Open Graph, `vercel.json` / `netlify.toml`, generador de QR y guía (abajo).
- [x] **Rediseño juvenil (Glow UI)**: tipografía Plus Jakarta Sans, contenedores con resplandor, fondos con degradado
      pastel/profundo, toggle de tema sólido, logo del equipo movido al footer.
- [x] **Catálogo oficial**: 18 tecnicaturas del IES N.° 11 en 5 áreas · 10 preguntas con íconos SVG ·
      fichas de carrera (modal) · pantalla final con frases institucionales + comprobante PNG ·
      dashboard con Podio Top 3, barras multicolor y filtro por Jornada.
- [x] **Sincronización multi-dispositivo**: `js/realtime.js` sobre **ntfy.sh** (celular 4G → netbook del stand),
      con espejo `localStorage` y dedupe por `id`. Probado: publicación externa → SSE → dashboard en vivo.
- [x] **Acceso protegido al dashboard**: PIN `admin11` (`js/dashboard-auth.js`); sin clave redirige a `index.html`.
- [x] **Dashboard con 2 vistas**: General (Podio + áreas) y Detallada (18 tecnicaturas por votos + %).
      CSV protegido por PIN.
- [ ] **Ajustes finales**: agregar `img/logo-ies11.png` (escudo real); revisar redacción de preguntas y de las
      fichas `INFO_CARRERAS` con el Instituto; poner la URL real en los `<meta>` de `index.html`; prueba en la TV real.

## Cómo probar en local

Serví los archivos por HTTP (SSE, `fetch` y `BroadcastChannel` no funcionan con `file://`).
Desde la carpeta del proyecto:

```bash
python -m http.server 4173
```

- App del estudiante: <http://localhost:4173/index.html>
- Dashboard (otra pestaña/ventana, o **otro dispositivo en la misma red**): <http://localhost:4173/dashboard.html>
  (PIN de acceso: `admin11`)

Completar el formulario, responder las 10 preguntas y ver el Top 3. El resultado viaja por
`window.Realtime.publicar()` → ntfy.sh → el dashboard lo refleja al instante (contador, podio, feed, toasts, gráficos).
Probar la sincronización real: abrir el dashboard en el celular y el test en otro navegador.

### Pantalla final del alumno

- Top 3 de tecnicaturas con % de afinidad + perfil por área.
- Frases destacadas: *"¡Espero que puedas decidir…"* y, prominente, *"¡Te esperamos en el Instituto!"*.
- Botón **"Descargar / Guardar mi Resultado"** → genera un **PNG** (canvas, sin conexión) con el Top 3
  para que el alumno se lo lleve. Botón **"Volver a hacer el test"** reinicia el flujo.

### Dashboard: acceso

- **Acceso con PIN**: al abrir `dashboard.html` pide la clave **`admin11`**. Sin clave (3 intentos)
  redirige a `index.html`. El equipo del stand queda recordado tras validar una vez.
- La estructura completa del panel (KPI, vistas, demografía, export, limpiar) está descrita más
  arriba en **"Panel analítico del dashboard"**.
- El dataset se arma del historial acumulado en **ese navegador** (espejo `localStorage`), que
  incluye todo lo recibido por ntfy mientras el dashboard estuvo abierto. La netbook del stand
  debe quedar abierta durante la Expo para no perder registros más viejos que la caché de ntfy (~12 h).

---

## Despliegue a un servidor público

El sitio es estático: se sube tal cual, sin compilar. **Antes de publicar**:
1. Poné la URL real en `index.html` (`<link rel="canonical">` y `og:*` / `twitter:*` — hoy tienen el
   placeholder `https://expo-educativa-ies11.vercel.app/`).
2. Cambiá `SUFIJO_DEFECTO` en `js/realtime.js` por uno nuevo y privado, así arrancás con el canal
   limpio. No agregues `Content-Security-Policy`: bloquearía las conexiones a `ntfy.sh`.
3. Confirmá el PIN del dashboard en `js/dashboard-auth.js` (por defecto `admin11`).

### Opción A · Vercel (CLI)

```bash
npm i -g vercel
cd FeriaEducativa-IES11
vercel          # primera vez: crea el proyecto y da una URL de preview
vercel --prod   # publica la versión final (URL definitiva)
```

`vercel.json` ya deja configurado: URLs limpias (`/` en vez de `/index.html`), cache larga
para imágenes y cabeceras de seguridad básicas.

### Opción B · Netlify (arrastrar carpeta)

1. Entrar a <https://app.netlify.com/drop>.
2. Arrastrar la **carpeta `FeriaEducativa-IES11` completa** a la ventana.
3. Netlify sube y publica; entrega una URL tipo `https://random-name.netlify.app`.
4. (Opcional) *Site settings → Change site name* para dejarla más linda, p. ej.
   `expo-educativa-ies11.netlify.app`.

`netlify.toml` fija `publish = "."` (sin build) y las cabeceras de cache.

### Opción C · GitHub Pages

Subir el repo a GitHub → *Settings → Pages → Deploy from a branch → `main` / `root`*.
La URL queda `https://<usuario>.github.io/<repo>/`. (En este caso el QR debe apuntar a esa
ruta con subcarpeta.)

---

## Código QR para folletos y banners

El QR debe apuntar a la **URL pública final** (la del deploy), no a `localhost`.

### Forma recomendada · `tools/qr.html` (sin instalar nada)

1. Abrir `tools/qr.html` en el navegador (doble clic, o servido por HTTP).
2. Pegar la URL final, elegir tamaño (**2048 px para banners**) y *Generar QR*.
3. Descargar **PNG** (folletos) o **SVG** (imprenta / gran formato).

Usa corrección de errores **nivel H** (~30%): el QR se sigue leyendo impreso chico o con el
logo del IES encima.

### Alternativa · consola

```bash
# rápido, sin instalar (PNG chico):
npx --yes qrcode "https://TU-URL-FINAL/" -o tools/qr-expo-educativa-2026.png

# con colores institucionales + SVG (necesita el paquete):
npm i -D qrcode
node tools/generar-qr.mjs "https://TU-URL-FINAL/"
```

### Checklist antes de imprimir

- [ ] La URL del QR abre el **test** (`index.html`), no el dashboard.
- [ ] Probado escaneando desde 2–3 celulares distintos (Android e iPhone).
- [ ] Tamaño impreso ≥ 3 × 3 cm en folleto; ≥ 20 × 20 cm en banner.
- [ ] Contraste alto y zona blanca (quiet zone) alrededor del código.
