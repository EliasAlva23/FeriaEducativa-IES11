# Docker + Base de datos (guía paso a paso)

Esta guía es para aprender a levantar, usar y apagar la infraestructura de
Docker que se agregó al proyecto. Está pensada para alguien que nunca usó
Docker.

**Importante, antes de arrancar:** todo esto es infraestructura **nueva y
separada**. El Test Vocacional (`index.html`) y el Dashboard
(`dashboard.html`) siguen funcionando exactamente igual que hasta ahora,
con `localStorage` + [ntfy.sh](https://ntfy.sh) y publicados en Netlify.
Nada de lo que vas a levantar acá está conectado todavía a esos archivos:
podés hacer `docker-compose up`, romper algo, o borrar todo, y el sitio en
vivo (Netlify) **no se entera ni se ve afectado**.

## ¿Qué levanta esto?

`docker-compose.yml` define 3 contenedores:

| Servicio  | Qué es                                                | URL local              |
|-----------|--------------------------------------------------------|-------------------------|
| `web`     | Espejo del sitio estático (nginx), para probarlo con Docker en vez de `python -m http.server` | http://localhost:8888  |
| `db`      | Base de datos PostgreSQL, con las tablas de `db/schema.sql` ya cargadas | localhost:5432 |
| `adminer` | Panel web para ver y editar las tablas sin usar la terminal | http://localhost:8080  |

## 0. Requisito: instalar Docker Desktop

Si todavía no lo tenés: descargá e instalá **Docker Desktop** desde
https://www.docker.com/products/docker-desktop/ y abrilo (tiene que quedar
corriendo en segundo plano — vas a ver su ícono en la barra de tareas).

## 1. Levantar todo

Desde la carpeta del proyecto (donde está `docker-compose.yml`):

```bash
docker-compose up -d
```

(`-d` = "detached", corre en segundo plano y te devuelve la terminal). La
primera vez va a tardar un par de minutos: descarga las imágenes de
Postgres, Adminer y arma la imagen del sitio.

Si tu Docker es más nuevo y `docker-compose` no existe como comando
separado, usá:

```bash
docker compose up -d
```

## 2. Verificar que quedó todo arriba

```bash
docker-compose ps
```

Deberías ver `feria_ies11_web`, `feria_ies11_db` y `feria_ies11_adminer`
con estado `Up` (o `healthy` para la base). Después abrí en el navegador:

- http://localhost:8888 → el sitio (test vocacional).
- http://localhost:8080 → Adminer (panel de la base).

## 3. Entrar a la base de datos con Adminer

En http://localhost:8080, completá el formulario de login así:

- **Sistema:** PostgreSQL
- **Servidor:** `db`
- **Usuario:** `feria_admin`
- **Contraseña:** `cambiar_esta_clave` (la que está en `docker-compose.yml`)
- **Base de datos:** `feria_ies11`

Una vez adentro vas a ver 5 tablas, ya creadas automáticamente por
`db/schema.sql`:

- `areas` — las 5 Áreas Vocacionales (ya viene con los datos cargados).
- `carreras` — las 18 tecnicaturas, cada una ligada a su área (ya viene cargada).
- `participantes` — un test completado = una fila (vacía hasta que cargues datos).
- `elecciones` — el Top 3 de cada participante (3 filas por persona).
- `encuestas_raw` — espejo plano del CSV que exporta el dashboard (para importar rápido, ver paso 5).

## 4. Volver a correr `schema.sql` a mano (opcional)

`schema.sql` sólo se ejecuta solo la **primera vez** que Docker crea el
volumen de la base. Si después lo modificás y querés volver a aplicarlo
sin perder lo que ya cargaste, corré:

```bash
docker exec -i feria_ies11_db psql -U feria_admin -d feria_ies11 < db/schema.sql
```

(Es seguro repetirlo: las tablas usan `CREATE TABLE IF NOT EXISTS` y los
`INSERT` de áreas/carreras usan `ON CONFLICT DO NOTHING`, así que no
duplica nada.)

## 5. Importar el CSV que exporta el Dashboard

El botón **"🔒 Exportar Dataset CSV"** del dashboard genera un archivo con
estas columnas, separadas por `;`:

```
ID;Fecha_Hora;Nombre;Apellido;Edad;Genero;Localidad;Situacion_Educativa;Top1_Carrera;Top2_Carrera;Top3_Carrera
```

La tabla `encuestas_raw` tiene esas mismas columnas, así que se puede
importar tal cual, sin transformar nada:

```bash
# 1) Copiá el CSV descargado adentro del contenedor de la base
docker cp "C:\ruta\a\dataset-expo-2026_global_2026-09-04.csv" feria_ies11_db:/tmp/dataset.csv

# 2) Importalo a la tabla encuestas_raw
docker exec -it feria_ies11_db psql -U feria_admin -d feria_ies11 -c "\copy encuestas_raw FROM '/tmp/dataset.csv' WITH (FORMAT csv, DELIMITER ';', HEADER true, ENCODING 'UTF8')"
```

Ajustá la ruta del paso 1 a donde se haya descargado tu CSV. También podés
importarlo visualmente desde Adminer: entrá a la tabla `encuestas_raw` →
"Importar" → elegí el archivo → formato CSV, separador `;`.

## 6. Ver qué está pasando (logs)

```bash
docker-compose logs -f db        # sólo la base, en vivo (Ctrl+C para salir)
docker-compose logs -f           # todos los servicios
```

## 7. Apagar

```bash
docker-compose down
```

Esto **apaga los contenedores pero conserva los datos** (quedan guardados
en el volumen `feria_ies11_pgdata`). La próxima vez que hagas
`docker-compose up -d`, vas a encontrar todo tal cual lo dejaste.

## 8. Borrar todo, incluidos los datos (con cuidado)

```bash
docker-compose down -v
```

El `-v` borra también el volumen de Postgres — es decir, **perdés todo lo
que hayas cargado en la base** (`participantes`, `elecciones`,
`encuestas_raw`; `areas`/`carreras` se vuelven a crear solas la próxima
vez). Usalo sólo si querés arrancar de cero. **Esto nunca toca
`localStorage` del navegador ni el tópico de ntfy.sh** — son sistemas
completamente aparte.

## 9. Si cambiás el código del sitio y usás el servicio `web`

```bash
docker-compose up -d --build web
```

(Reconstruye sólo la imagen del sitio con los archivos nuevos.)

## Problemas comunes

- **"port is already allocated"**: ya tenés algo corriendo en el 8888,
  5432 u 8080 (por ejemplo, `python -m http.server` o un Postgres local).
  Cerralo, o cambiá el número de puerto a la izquierda en
  `docker-compose.yml` (ej. `"8889:80"`).
- **Docker Desktop no está corriendo**: abrilo y esperá a que el ícono
  deje de "cargando" antes de correr los comandos.
- **`docker-compose: command not found`**: probá `docker compose`
  (sin guión), es el mismo comando en versiones nuevas de Docker.

## Próximo paso (fuera de esta entrega)

Hoy esta base de datos es infraestructura standalone: nadie le escribe
todavía en vivo. Si más adelante quieren que el dashboard guarde los
resultados acá además de (o en vez de) ntfy.sh, hace falta un pequeño
backend/API intermedio (el navegador no puede hablarle a Postgres
directamente) — no es parte de esta entrega, pero el esquema de
`db/schema.sql` ya está pensado para eso.
