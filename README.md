# NUBAPP — AD Nuevo Baztán

## Qué es esto (estado actual)

Base de datos completa (núcleo + cuotas + ejercicios/sesiones/asistencia +
partidos + directo), backend y frontend funcionando de extremo a extremo
para: login y gestión de usuarios, fichas de deportistas (con historial de
altas/bajas por deporte y foto), equipos (personal, plantilla, ficha
técnica con esquema de posiciones, partidos/resultados con marcador en
directo, y sesiones con control de asistencia), gestión económica de
cuotas (altas individuales y grupales, previsión mensual, registro de
pagos y estadística de cobro), un dashboard de Inicio real (cumpleaños,
lesionados, resultados y faltas sin justificar), un banco de ejercicios
por deporte con vídeos vinculados, planificación mensual por equipo,
traspaso de plantillas entre temporadas y una sección de Metodología con
documentos por deporte o generales del club. Todo el listado original de
bloques está construido; queda afinar Directo y Metodología en cuanto
tengamos las capturas de referencia de MísterCoach de esos apartados.

## Estructura

```
nubapp/
├── database/
│   ├── 01_schema_nucleo.sql      -> temporadas, usuarios/roles, deportes, deportistas
│   ├── 02_schema_cuotas.sql      -> cuotas, previsión mensual y pagos
│   ├── 03_schema_ejercicios.sql  -> ejercicios, sesiones, asistencia, planificación
│   ├── 04_seed_deportes_individuales.sql
│   ├── 05_seed_temporada_y_equipos.sql
│   ├── 06_historial_deportes_y_ficha_tecnica.sql
│   ├── 07_schema_partidos.sql    -> partidos y resultados (deportes de equipo)
│   ├── 08_schema_directo.sql     -> marcador en directo (eventos de partido)
│   ├── 09_schema_metodologia.sql -> documentos de metodología por deporte o generales
│   ├── 10_schema_directo_avanzado.sql -> convocatoria, cronómetro y más tipos de evento del directo
│   ├── 11_seed_ejercicios_futbol.sql -> banco inicial de 18 ejercicios reales de fútbol (una tipología por par)
│   ├── 12_schema_competiciones.sql -> catálogo de competiciones (liga/copa/torneo/amistoso) por equipo y temporada
│   ├── 13_seed_ejercicios_otros_deportes.sql -> banco de ejercicios para Baloncesto y deportes individuales (Muay Thai, Pádel, Tenis, Patinaje, Gimnasia Rítmica)
│   ├── 14_permitir_multiples_cuotas.sql -> permite varias cuotas del mismo deporte por deportista (campo "concepto")
│   ├── 15_seed_ejercicios_transiciones_futbol.sql -> 20 ejercicios de fútbol de transiciones en espacio reducido
│   ├── 16_seed_ejercicios_futbol_variado.sql -> 9 ejercicios más de fútbol (rondos, rueda de pase, juego de posición, salida de presión)
│   ├── 17_seed_ejercicios_futbol_variado_2.sql -> 10 ejercicios más de fútbol (posesión, rondos, partido condicionado, rueda de pase, transiciones)
│   ├── 18_seed_ejercicios_futbol_variado_3.sql -> 10 ejercicios más de fútbol (partido condicionado, rondos, rueda de pase, juego de posición)
│   ├── 19_seed_ejercicios_futbol_variado_4.sql -> 10 ejercicios más de fútbol (ataque vs bloque bajo, rondos posicionales, ataque contra defensa)
│   ├── 20_seed_ejercicios_futbol_variado_5.sql -> 10 ejercicios más de fútbol (posesión con comodines, rondos, defensa organizada, ruedas de pase)
│   └── 21_seed_ejercicios_futbol_variado_6.sql -> últimos 2 ejercicios de fútbol de la web de referencia (juego de posesión, salida de presión alta)
├── backend/
│   ├── src/
│   │   ├── config/db.js          -> conexión a PostgreSQL
│   │   ├── middleware/auth.js    -> verifica login (JWT)
│   │   ├── middleware/permisos.js -> control de acceso por rol
│   │   ├── routes/auth.js        -> POST /login, GET /yo
│   │   ├── routes/usuarios.js    -> CRUD de usuarios + asignación de roles (solo admin)
│   │   ├── routes/deportistas.js -> fichas, historial de deportes, foto
│   │   ├── routes/deportes.js    -> catálogo de deportes del club
│   │   ├── routes/temporadas.js  -> temporadas (2026/2027, etc.)
│   │   ├── routes/equipos.js     -> equipos, personal y plantilla por temporada
│   │   ├── routes/cuotas.js      -> cuotas, previsión mensual, pagos y estadística
│   │   ├── routes/partidos.js    -> partidos y resultados por equipo
│   │   ├── routes/sesiones.js    -> sesiones y control de asistencia
│   │   ├── routes/inicio.js      -> resumen del dashboard de Inicio
│   │   ├── routes/ejercicios.js  -> banco de ejercicios y vídeos
│   │   ├── routes/planificaciones.js -> planificación mensual por equipo
│   │   ├── routes/metodologia.js -> documentos de metodología por deporte o generales
│   │   ├── routes/competiciones.js -> catálogo de competiciones por equipo y temporada
│   │   └── server.js
│   ├── scripts/crear_admin.js    -> crea el primer administrador desde terminal
│   ├── package.json
│   └── .env.example
└── frontend/                     -> PWA en React + Vite
    ├── src/
    │   ├── api/client.js         -> fetch con JWT automático
    │   ├── auth/AuthContext.jsx  -> sesión (login/logout, saber el rol)
    │   ├── components/Layout.jsx, RutaProtegida.jsx, BarraCuota.jsx
    │   ├── pages/Login.jsx, Inicio.jsx, Usuarios.jsx, Deportistas.jsx, Equipos.jsx, Cuotas.jsx,
    │   │         Ejercicios.jsx, Metodologia.jsx, Competiciones.jsx
    │   ├── utils/colorEtiqueta.js -> color estable por texto, reutilizado en varias pantallas
    │   └── styles/global.css     -> sistema visual (tokens de color, botones, tarjetas, badges, Directo)
    ├── vite.config.js            -> incluye plugin PWA
    └── package.json
```

## Decisiones clave que hemos tomado (para que quede constancia)

1. **Todo lleva `temporada_id`** donde puede variar de un año a otro
   (equipos, cuotas, fichas técnicas, sesiones...). Esto es lo que permite
   cambiar de temporada y ver el histórico sin mezclar datos, como en tu
   sistema actual.

2. **Ficha general vs. ficha técnica separadas.** La ficha general del
   deportista (nombre, DNI, teléfonos...) no cambia por temporada. La
   ficha técnica (dorsal, posición, valoraciones) sí, y además es
   independiente por deporte gracias a un campo JSONB flexible.

3. **Banco de ejercicios independiente por deporte.** Una sola tabla
   `ejercicios`, pero SIEMPRE filtrada por `deporte_id`. Añadir un
   ejercicio de baloncesto nunca toca ni afecta al banco de fútbol.

4. **Permisos en dos capas**: el middleware `permisos.js` decide si un
   rol puede entrar a una ruta; dentro de cada ruta, la consulta SQL
   decide QUÉ FILAS ve ese usuario (mira `routes/deportistas.js` para
   ver el patrón — así se hará en cuotas, asistencia, etc.).

## Login y gestión de usuarios (nuevo)

- `POST /api/auth/login` — email + password, devuelve JWT y datos del usuario.
- `GET /api/auth/yo` — devuelve el usuario autenticado a partir del token.
- `GET /api/usuarios` y `GET /api/usuarios/:id` — listar/ver (admin y dirección deportiva).
- `POST /api/usuarios` — crear usuario y asignarle roles (solo admin). Puede
  no tener email/password si es un deportista sin login propio.
- `PUT /api/usuarios/:id` — editar datos básicos (solo admin).
- `PUT /api/usuarios/:id/password` — cambiar contraseña (el propio usuario o un admin).
- `PUT /api/usuarios/:id/roles` — reemplazar los roles de un usuario (solo admin;
  así es como se añaden nuevos administradores).
- `DELETE /api/usuarios/:id` — baja lógica, nunca se borra a nadie físicamente.

No hay registro público: los usuarios los da de alta siempre un
administrador. Para crear el primer administrador (el "huevo o la
gallina" de quién crea al primero) hay un script de terminal:

```
cd backend
npm install
npm run crear-admin -- "Nombre Apellidos" email@club.com contraseñaSegura
```

## Fichas de deportistas (nuevo)

Ficha general (datos personales) construida de extremo a extremo, incluido
el deporte (o deportes) que practica cada uno — fútbol, baloncesto, muay
thai, patinaje, pádel, tenis y gimnasia rítmica ya están en el catálogo.

- `GET /api/deportes` — catálogo de deportes. `POST /api/deportes` para
  añadir uno nuevo (administrador, dirección deportiva o coordinador).
- `GET /api/deportistas?q=&deporteId=&estado=` — administrador y dirección
  deportiva ven todos; coordinador/entrenador solo los de sus equipos.
  Admite buscador por nombre/apellidos/nº de socio (`q`), filtro por
  deporte (`deporteId`) y por estado (`activo` por defecto, `inactivo` o
  `todos`). Cada deportista devuelve ya su lista de deportes.
- `GET /api/deportistas/:id` — ficha de un deportista concreto.
- `POST /api/deportistas` — alta de ficha (+ deportes que practica,
  opcional). Solo administrador, dirección deportiva o coordinador.
- `PUT /api/deportistas/:id` — editar ficha (incluido reactivar: mandando
  `inactivo: false`). Mismos roles que el alta.
- `PUT /api/deportistas/:id/deportes` — fija qué deportes practica
  ACTUALMENTE. No borra nada: a los que ya no están en la lista se les
  cierra su periodo (`fecha_baja` = hoy) y a los nuevos se les abre uno
  (`fecha_alta` = hoy), así queda guardado el historial completo debajo.
- `PUT /api/deportistas/:id/lesion` — marcar/quitar lesión. También lo
  puede hacer el entrenador de ESE deportista, no solo administración.
- `POST /api/deportistas/:id/foto` — sube/reemplaza la foto (campo
  `foto`, `multipart/form-data`, máx. 5 MB, solo imágenes). Se sirve
  luego en `/uploads/deportistas/...`.
- `DELETE /api/deportistas/:id` — baja lógica: NUNCA se borra ni se toca
  ningún dato (nº de socio incluido), solo se marca `inactivo = true`.
  Se puede dar de alta otra vez sin perder nada de su historial.

### Historial de deportes practicados (nuevo)

Antes, "practica este deporte" era un simple sí/no. Ahora cada deportista
puede tener varios periodos de alta/baja por deporte a lo largo de los
años (para saber desde cuándo hasta cuándo practicó cada uno).

- `GET /api/deportistas/:id/historial-deportes` — todos los periodos
  (con su fecha de alta y de baja, o "actual" si sigue abierto).
- `POST /api/deportistas/:id/historial-deportes` — añade un periodo con
  fechas concretas (`deporteId`, `fechaAlta`, `fechaBaja` opcional =
  hasta ahora). Útil para dar de alta con una fecha pasada.
- `PUT .../historial-deportes/:historialId` — corrige las fechas de un
  periodo (p.ej. cerrarlo con una fecha de baja).
- `DELETE .../historial-deportes/:historialId` — elimina un periodo mal
  metido.

Solo puede haber un periodo abierto (sin fecha de baja) a la vez por
deportista y deporte — si lo intentas duplicar, la base de datos lo
rechaza con un mensaje claro.

Si ya habías ejecutado `01_schema_nucleo.sql` antes de este cambio,
ejecuta también `04_seed_deportes_individuales.sql`, `05_seed_temporada_y_equipos.sql`
y `06_historial_deportes_y_ficha_tecnica.sql` en ese orden (son seguros,
no duplican nada).

Frontend: pantalla "Deportistas" con buscador, filtro por deporte y por
estado, etiquetas de deporte editables por fila, marcar lesión, dar de
baja/alta, y el alta con selección de deportes. Cada fila tiene un botón
"Ver ficha" que abre la ficha completa: datos generales editables, el
historial de deportes (añadir periodos con fechas, corregirlas o
eliminarlos) y, para quien tiene acceso a información económica
(administrador/dirección deportiva), un resumen de su histórico de cuotas
(ver sección "Cuotas" más abajo).

## Equipos (nuevo)

Cada equipo es de un deporte y una temporada concretos (ej: "Cadete" de
fútbol en 2026/2027). Se le asigna personal (entrenador, coordinador,
monitor) y una plantilla de deportistas con dorsal y ficha técnica
(lateralidad, posiciones, valoraciones 0-10), independiente por temporada
para poder ver el histórico sin mezclar datos de un año con otro.

- `GET /api/temporadas` — todas las temporadas. `POST /api/temporadas` para
  crear una nueva (administrador, dirección deportiva o coordinador).
  `PUT /api/temporadas/:id/principal` la marca como la temporada por
  defecto al crear equipos; `PUT /api/temporadas/:id/cerrar` la cierra
  (queda de solo consulta, para histórico).
- `GET /api/equipos?temporadaId=&deporteId=&estado=` — administrador y
  dirección deportiva ven todos; coordinador/entrenador/monitor solo los
  suyos (donde están asignados como personal).
- `GET /api/equipos/:id` — ficha del equipo con su personal y su plantilla
  completa (deportistas, dorsal y ficha técnica).
- `POST /api/equipos` — crear equipo (administrador, dirección deportiva o
  coordinador). Si no se indica `temporadaId` usa la temporada principal.
- `PUT /api/equipos/:id` — editar nombre/categoría/club. `DELETE
  /api/equipos/:id` — baja lógica.
- `POST /api/equipos/:id/personal` y `DELETE
  /api/equipos/:id/personal/:usuarioId/:rolEnEquipo` — asignar/quitar
  entrenador, coordinador o monitor.
- `POST /api/equipos/:id/deportistas` — fichar a un deportista por el
  equipo (dorsal opcional). `PUT .../deportistas/:deportistaId` cambia el
  dorsal; `DELETE .../deportistas/:deportistaId` lo quita del equipo esa
  temporada (no toca su ficha general).
- `PUT /api/equipos/:id/deportistas/:deportistaId/ficha-tecnica` — crea o
  actualiza la ficha técnica (lateralidad, posición principal/secundaria,
  valoraciones). También la puede editar el entrenador/coordinador/monitor
  de ESE equipo, no solo dirección deportiva.

Si ya tenías el proyecto instalado antes de este cambio, ejecuta
`05_seed_temporada_y_equipos.sql` (añade la baja lógica a equipos y crea
la temporada 2026/2027 si todavía no tienes ninguna).

### Posiciones sobre el campo/pista y foto del jugador (nuevo)

En fútbol y baloncesto, la ficha técnica ya no usa texto libre para la
posición: son posiciones fijas que se marcan haciendo clic sobre un
esquema del campo o de la pista, directamente en el frontend
(`frontend/src/pages/Equipos.jsx`, componente `EsquemaPosiciones`). El
primer clic marca la posición principal, el segundo la secundaria; volver
a hacer clic en una ya marcada la quita.

- Fútbol: portero, central, lateral, medio centro, interior, extremo,
  delantero.
- Baloncesto: base, escolta, alero, ala-pívot, pívot.
- El resto de deportes no tienen esquema (no se les pide posición).

El backend valida que la posición mandada esté en el catálogo del
deporte del equipo, y las guarda en `fichas_tecnicas.posicion_principal`
/ `posicion_secundaria` (las columnas antiguas `posiciones_principales`/
`posiciones_alternativas` en JSON quedan sin usar, por compatibilidad).

También se puede subir la foto del deportista desde la propia ficha
técnica (botón "Cambiar foto"): se guarda al momento con
`POST /api/deportistas/:id/foto` y se ve como miniatura en la fila de la
plantilla y en grande al editar su ficha técnica.

Si ya tenías el proyecto instalado antes de este cambio, ejecuta
`06_historial_deportes_y_ficha_tecnica.sql`.

Frontend: pantalla "Equipos" con filtro por temporada/deporte/estado,
alta de equipo, y una ficha por equipo para gestionar su personal y su
plantilla (fichar/quitar deportistas, dorsal editable en línea, y edición
de la ficha técnica con lateralidad, posiciones y valoraciones).

## Cuotas (nuevo — Gestión Económica)

El esquema (`cuotas`, `cuotas_prevision_mensual`, `cuotas_pagos` y la vista
`v_cuotas_resumen`) ya estaba desde el principio en
`02_schema_cuotas.sql`; ahora está conectado de extremo a extremo. Es
información sensible: solo administrador y dirección deportiva pueden
CONSULTARLA (incluido el resumen dentro de la ficha de cada deportista);
darla de alta, editarla o registrar pagos es solo de administrador.

- `GET /api/cuotas?temporadaId=&deporteId=` — listado con el resumen de
  cobro (total a pagar, pagado, pendiente) de cada cuota.
- `GET /api/cuotas/estadisticas?temporadaId=` — totales facturado/cobrado/
  pendiente y desglose por deporte, para la vista general.
- `GET /api/cuotas/deportista/:deportistaId` — histórico de cuotas de un
  deportista concreto (todas las temporadas); es lo que se ve dentro de su
  ficha.
- `GET /api/cuotas/:id` — detalle completo: importes, previsión mensual y
  pagos.
- `POST /api/cuotas` — dar de alta una cuota de un deportista en un
  deporte/temporada (concepto, importe de cuota, equipación, otros
  importes, descuentos, notas).
- `POST /api/cuotas/grupal` — edición/alta grupal: aplica el mismo importe
  y descuento a varios deportistas de un deporte de golpe, bajo un mismo
  concepto (crea la cuota si no existía con ese concepto, la actualiza si
  ya la tenía).
- `PUT /api/cuotas/:id` — editar importes/descuentos/concepto/notas.
  `PUT /api/cuotas/:id/prevision` — fija la previsión de cobro mes a mes
  (los 12 meses, como el "Enero...Diciembre" del sistema anterior).
- `POST /api/cuotas/:id/pagos` — registrar un pago real (fecha, importe,
  forma de pago: efectivo/domiciliado/tpv/transferencia).
  `DELETE /api/cuotas/pagos/:pagoId` — corregir un pago mal metido.
- `DELETE /api/cuotas/:id` — eliminar una cuota completa (con sus pagos y
  previsión), solo para corregir un alta hecha por error.

Un mismo deportista puede tener varias cuotas del mismo deporte y
temporada a la vez (ej. "Septiembre", "Octubre", "Segundo trimestre",
"Liga de pádel"), siempre que cada una tenga un concepto distinto
(`14_permitir_multiples_cuotas.sql`); reutilizar el mismo concepto (a
mano o desde la edición grupal) actualiza esa cuota en vez de duplicarla.

Frontend: pantalla "Cuotas" con selector de temporada/deporte, tarjeta de
estadística (facturado/cobrado/pendiente/cuotas al día, con desglose por
deporte), alta individual (con su concepto), edición grupal, y una ficha
por cuota para editar concepto/importes, la previsión mensual y los
pagos. Dentro de cada ficha de deportista se ve además un resumen de sus
cuotas (deporte, concepto y barra de progreso de cobro, de un vistazo, sin
gestión) para quien tenga acceso económico.

## Partidos y asistencia (nuevo)

Ya está la primera versión de "Estadísticas de equipo (partidos, resultados)
para los deportes de equipo; control de asistencia para los deportes
individuales" del listado de próximos pasos. Vive dentro de la ficha de
cada equipo (`frontend/src/pages/Equipos.jsx`), no como pantalla aparte,
porque un partido o una sesión siempre son de un equipo concreto.

**Partidos** (solo se muestra si el deporte del equipo es de tipo
"equipo", ej. fútbol/baloncesto — esquema nuevo en
`07_schema_partidos.sql`):

- `GET /api/partidos?equipoId=&temporadaId=` — listado. `GET
  /api/partidos/estadisticas?equipoId=&temporadaId=` — jugados/ganados/
  empatados/perdidos y goles (o puntos) a favor y en contra, calculado con
  la vista `v_partidos_resumen`.
- `POST /api/partidos` — crear partido (con o sin resultado: se puede
  meter en el calendario antes de jugarse). `PUT /api/partidos/:id` —
  editar datos o cargar el resultado (pasa a "jugado" en cuanto tiene los
  dos marcadores). `DELETE /api/partidos/:id` — corregir un alta errónea.
- Mismo criterio de acceso que en equipos: administrador/dirección
  deportiva/coordinador gestionan cualquier equipo; entrenador/monitor
  solo el suyo.

**Sesiones y asistencia** (para cualquier equipo, pero es la métrica clave
en deportes individuales sin partidos — esquema ya existía en
`03_schema_ejercicios.sql`, ahora conectado):

- `GET /api/sesiones?equipoId=&temporadaId=` — listado. `POST
  /api/sesiones` — crear sesión (fecha/hora/título). `PUT
  /api/sesiones/:id` — editar o cancelar (con motivo). `DELETE
  /api/sesiones/:id` — eliminar.
- `GET /api/sesiones/:id/asistencia` — toda la plantilla del equipo, con
  su asistencia a esa sesión si ya está marcada. `PUT
  /api/sesiones/:id/asistencia/:deportistaId` — marcar asistió/faltó y si
  la falta está justificada.
- `GET /api/sesiones/resumen-asistencia?equipoId=&temporadaId=` — por
  deportista: sesiones convocado, asistidas y faltas SIN justificar. Con
  3 o más faltas sin justificar aparece un aviso destacado en la ficha del
  equipo — es la base del futuro aviso de faltas en el dashboard de Inicio.

## Frontend (nuevo)

PWA en React + Vite. Pantallas hechas: login, gestión de usuarios,
deportistas, equipos (con partidos y asistencia dentro de cada ficha) y
cuotas, con navegación y rutas protegidas por rol. El resto de pantallas
(Inicio con el dashboard real, banco de ejercicios, Metodología,
Directo...) se construyen igual, módulo a módulo.

Para arrancarlo en local:

```
cd frontend
npm install
cp .env.example .env      # ajusta VITE_API_URL si el backend no está en local
npm run dev
```

Necesita el backend corriendo (`cd backend && npm run dev`) y al menos un
administrador creado (`npm run crear-admin`, ver arriba) para poder entrar.

## Inicio (nuevo — dashboard real)

- `GET /api/inicio/resumen` — cumpleaños de la próxima semana, deportistas
  lesionados, últimos resultados jugados y deportistas con 3 o más faltas
  sin justificar, todo en una sola llamada. Administrador/dirección
  deportiva ven todo el club; coordinador/entrenador/monitor solo lo suyo
  (sus equipos vía `equipo_personal`, y los deportistas fichados en ellos).
- Frontend: pantalla "Inicio" con una tarjeta por bloque
  (`frontend/src/pages/Inicio.jsx`). Es de solo lectura — cada dato se
  gestiona desde su pantalla correspondiente (Deportistas, Equipos).

## Banco de ejercicios (nuevo)

Independiente por deporte (siempre se filtra por `deporteId`), con vídeos
vinculados (Instagram/TikTok/otro). Es un recurso compartido: cualquier
rol técnico (administrador, dirección deportiva, coordinador, entrenador,
monitor) puede consultarlo y aportar ejercicios nuevos; un deportista no
lo ve. Editar o borrar el ejercicio de un compañero es solo para quien lo
creó o para dirección deportiva/administrador/coordinador, para que nadie
borre por error el trabajo de otro entrenador.

- `GET /api/ejercicios?deporteId=&tipologia=&naturaleza=&q=` — listado
  filtrado. `GET /api/ejercicios/:id` — detalle con sus vídeos.
- `POST /api/ejercicios` — crear (título, descripción, tipología —texto
  libre, ampliable: rondo, calentamiento, posesión...—, naturaleza
  —física/técnica/táctica—, categoría de edad, espacio, nº de jugadores,
  duración). `PUT /api/ejercicios/:id` / `DELETE /api/ejercicios/:id`.
- `POST /api/ejercicios/:id/videos` — vincular un vídeo. `DELETE
  /api/ejercicios/videos/:videoId` — quitarlo.

Frontend: pantalla "Ejercicios" con selector de deporte (obligatorio) y
filtros de naturaleza/tipología/texto, alta de ejercicio, y una ficha por
ejercicio para gestionar sus vídeos vinculados. El listado es una
cuadrícula de tarjetas (no tabla) con etiquetas de color por
tipología/naturaleza/edad — el color se calcula de forma estable a partir
del propio texto, así que cualquier etiqueta nueva ya tiene un color
consistente sin tocar código.

Banco inicial poblado con ejercicios reales por deporte
(`11_seed_ejercicios_futbol.sql`, `13_seed_ejercicios_otros_deportes.sql`,
`15_seed_ejercicios_transiciones_futbol.sql`,
`16_seed_ejercicios_futbol_variado.sql`,
`17_seed_ejercicios_futbol_variado_2.sql`,
`18_seed_ejercicios_futbol_variado_3.sql`,
`19_seed_ejercicios_futbol_variado_4.sql`,
`20_seed_ejercicios_futbol_variado_5.sql`,
`21_seed_ejercicios_futbol_variado_6.sql`): 18 de fútbol + 20 de
transiciones/contraataque en espacio reducido + 51 más variados (rondos,
rueda de pase, juego de posición, salida de presión, partido condicionado,
ataque contra defensa, defensa organizada) — estos 71 últimos redactados
de nuevo a partir de referencias que pasó Sergio (un ebook y una web de
ejercicios de fútbol), no copiados literalmente — y 33 repartidos entre
Baloncesto, Muay Thai, Pádel, Tenis, Patinaje y Gimnasia Rítmica (122 en
total), como punto de partida para que cada entrenador amplíe con los
suyos. Con la tanda 21 se ha terminado de procesar toda la web de
referencia (sus 6 páginas de archivo de ejercicios).

## Planificación mensual (nuevo)

Una fila por equipo/temporada/año/mes con el contenido en texto libre
(objetivos, foco del mes...). La fija el coordinador (o dirección
deportiva/administrador); el entrenador de ese equipo solo la consulta —
mismo criterio de acceso que en partidos/asistencia.

- `GET /api/planificaciones?equipoId=&temporadaId=` — meses ya fijados.
- `PUT /api/planificaciones` — crea o actualiza el contenido de un mes
  concreto (upsert por equipo/temporada/año/mes). `DELETE
  /api/planificaciones/:id` — vaciar un mes.

Frontend: vive dentro de la ficha de cada equipo, debajo de "Sesiones y
asistencia" — selector de año/mes y un cuadro de texto con los objetivos.

## Traspaso de temporada (nuevo)

Para el cambio de curso: copia los equipos ACTIVOS de una temporada de
origen a otra de destino, con su personal (entrenador/coordinador/monitor)
y los deportistas de su plantilla que sigan activos — sin tocar la
temporada de origen ni duplicar nada si se repite por error. Deliberadamente
NO copia fichas técnicas (cada temporada empieza la valoración en blanco)
ni el dorsal si se pide así.

- `POST /api/temporadas/:id/traspaso` — `:id` es la temporada DESTINO;
  en el body va `{ temporadaOrigenId, incluirDorsales }`. Solo
  administrador, dirección deportiva o coordinador. Devuelve cuántos
  equipos se crearon, cuántos ya existían, y cuántos deportistas y
  asignaciones de personal se copiaron.

Frontend: botón "Traspasar de otra temporada" en la pantalla de Equipos
(cuando hay una temporada concreta seleccionada en el filtro), con
selector de temporada de origen y la opción de mantener o no el dorsal.

## Directo — marcador en directo (v2, con referencia real)

Reconstruido a partir de una captura de referencia que pasó Sergio (app
"Picco"): ya no es solo un feed manual, ahora hay convocatoria previa,
cronómetro real y el minuto de cada acción se calcula solo — nunca se
escribe a mano. Esquema en `08_schema_directo.sql` (base) y
`10_schema_directo_avanzado.sql` (v2: tabla `partidos_alineacion`,
columnas de cronómetro/partes en `partidos`, más tipos de evento y
`ocasion_clara` en `partidos_eventos`).

Flujo, en orden:

1. **Convocatoria.** Antes de arrancar, se marca qué jugadores de la
   plantilla juegan ese partido (titular/suplente, dorsal). Es lo que
   permite luego atribuir cada acción a un jugador concreto.
2. **Partes del partido.** El entrenador define cuántas partes tiene el
   partido y la duración de cada una (por defecto 2 partes de 25 min,
   editable línea a línea, y se puede añadir alguna más — p.ej. una
   prórroga — sobre la marcha).
3. **En directo.** Al pulsar "Iniciar directo" arranca el cronómetro de
   verdad (con pausa/reanudar) y aparecen los botones de acción: gol
   propio/rival, tiro propio/rival (con un check para marcarlo como
   "ocasión clara" antes de pulsar), córner a favor/en contra, falta a
   favor/en contra, tarjetas amarilla/roja propia/rival, y dos botones
   de posesión (nuestra / rival). Se puede elegir el jugador de la
   próxima acción tocando su chip en la convocatoria — se aplica solo a
   las acciones propias y se resetea tras cada acción. El minuto de cada
   evento sale del cronómetro del servidor (parte actual + duración
   configurada de las partes anteriores), no de un campo manual. "Siguiente
   parte" cierra la parte actual (contabilizando lo jugado) y dispara el
   resumen automáticamente; si no quedan más partes configuradas, el
   partido pasa a "Finalizado" y cuenta como jugado en las estadísticas.
4. **Resumen.** Botón "Ver resumen" (o automático al pasar de parte):
   recuento de goles, tiros (con ocasiones claras), córners, faltas y
   tarjetas, nosotros vs. rival.

Un gol sigue sumando al momento en el marcador; borrar un evento de gol
lo resta — `resultado_propio`/`resultado_rival` siempre coincide con la
suma de los goles registrados.

**Visual (v3):** rediseñado para parecerse a Picco de verdad, no solo
funcionalmente — cabecera oscura con marcador y cronómetro grandes,
botones de acción grandes con icono y color por categoría (gol verde,
tiro azul, córner morado, falta naranja, amarilla/roja con su color),
organizados en dos columnas (Nosotros / Rival) para no tener que leer
texto durante un partido real. Clases nuevas en `global.css`:
`.marcador-directo`, `.directo-cabecera`, `.boton-accion-directo` y
variantes `.accion-*` por categoría.

- `GET/PUT /api/partidos/:id/alineacion` — convocatoria del partido.
- `PUT /api/partidos/:id/directo/iniciar` — fija las partes y arranca el
  cronómetro. `.../pausar`, `.../reanudar`, `.../siguiente-parte`,
  `.../anadir-parte` — controlan el cronómetro y las partes.
  `.../posesion` — fija quién tiene la posesión ahora.
- `GET /api/partidos/:id/eventos` — feed cronológico. `POST
  /api/partidos/:id/eventos` — registrar evento (tipo, jugador opcional,
  ocasión clara si aplica; el minuto lo calcula el servidor). `DELETE
  /api/partidos/eventos/:eventoId` — corregir uno mal metido.
- `GET /api/partidos/:id/resumen` — recuento agregado por tipo de evento.

Frontend: botón "Directo" en cada partido (dentro de la ficha del
equipo), que va guiando por convocatoria → configurar partes → marcador
en directo con cronómetro y botones de acción → feed y resumen.

Pendiente de afinar cuando Sergio confirme detalles concretos sobre el
terreno (p. ej. si quiere sustituciones dentro de la convocatoria, o
ajustar qué acciones exactamente llevan jugador asociado).

## Metodología (nuevo)

Documentos de texto libre (principios de juego, objetivos por categoría,
sistema de entrenamiento...) organizados por deporte, o generales para
todo el club si no se indica deporte. Primera versión sin capturas de
referencia de MísterCoach — mismo criterio de visibilidad que el banco de
ejercicios: cualquier rol técnico (administrador, dirección deportiva,
coordinador, entrenador, monitor) puede consultarlos; solo dirección
deportiva/administrador/coordinador puede crear, editar o eliminar.
Esquema nuevo en `09_schema_metodologia.sql` (tabla
`metodologia_documentos`, con `deporte_id` nulo para los generales).

- `GET /api/metodologia?deporteId=` — documentos generales del club, más
  los de ese deporte si se indica `deporteId`. `GET /api/metodologia/:id`
  — detalle de un documento.
- `POST /api/metodologia` — crear (título obligatorio; deporte opcional).
  `PUT /api/metodologia/:id` — editar título/contenido/orden. `DELETE
  /api/metodologia/:id` — eliminar.

Frontend: pantalla "Metodología" con filtro por deporte (o solo
generales), listado, y detalle con edición de título/contenido en un
`textarea` de texto largo, en el mismo estilo que el resto de
formularios.

## Competición (nuevo)

Catálogo de competiciones (liga, copa, torneo o amistoso) por equipo y
temporada — antes un partido solo tenía un campo de texto libre
"competición". Esquema en `12_schema_competiciones.sql` (tabla
`competiciones`, y `partidos.competicion_id` como referencia opcional;
el campo de texto antiguo se mantiene por compatibilidad).

- `GET /api/competiciones?equipoId=&temporadaId=` — listar. `POST
  /api/competiciones` — crear (nombre + tipo). `PUT
  /api/competiciones/:id` / `DELETE /api/competiciones/:id` — editar o
  eliminar (dirección deportiva/admin/coordinador, o el propio personal
  del equipo para crear). Al eliminar una competición, los partidos que
  la usaban se quedan sin competición, no se borran.

Frontend: pantalla nueva "Competición" en el menú, con selector de
temporada + equipo y tarjetas por competición (con etiqueta de color
según el tipo). Al crear un partido desde la ficha del equipo, ahora se
elige la competición de esta lista (o "Amistoso, sin competición").

## Sistema visual (rediseño grande)

`global.css` tiene ahora una base de diseño mucho más cuidada y coherente
en toda la app: sombras y radios suaves, navegación superior con iconos y
estado activo, botones con feedback al pulsar, y un conjunto de
utilidades reutilizables en cualquier pantalla nueva:

- **Avatares de iniciales** (`avatar-circulo`, con variante mini/grande) y
  **badges de estado** (`badge-activo`/`badge-inactivo`) para personas y
  equipos.
- **Color estable por texto** (`frontend/src/utils/colorEtiqueta.js`):
  cualquier etiqueta libre (un deporte, una tipología de ejercicio, una
  categoría de edad...) sale siempre pintada del mismo color en toda la
  app, sin mantener una lista cerrada — se usa ya en Ejercicios,
  Deportistas, Equipos, Cuotas y Metodología.
- **Fichas en bloques** (`bloque-ficha`): las pantallas de detalle
  (ficha de deportista, ficha de equipo) están organizadas en tarjetas
  separadas con icono por sección, en vez de un bloque de texto corrido.

Con esa base se ha hecho una pasada visual grande por pantalla:

- **Deportistas**: el listado pasó de tabla a cuadrícula de tarjetas
  (avatar con iniciales, deportes con etiqueta de color, estado, botón
  grande de lesión) y la ficha individual se reorganiza en bloques
  (datos generales, historial de deportes, cuotas).
- **Inicio**: las 4 tarjetas del dashboard tienen ahora icono, contador y
  un color de acento por tipo de aviso (dorado cumpleaños, rojo
  lesionados/faltas, azul resultados), con el resultado de cada partido
  en una insignia verde/roja/gris según victoria, derrota o empate.
- **Equipos**: el listado también pasó a tarjetas (icono por deporte,
  etiquetas de color, nº de deportistas destacado) y la ficha de equipo
  se organiza en bloques (personal, plantilla, partidos, asistencia,
  planificación).
- **Metodología**: los documentos se muestran como tarjetas con icono en
  vez de una lista de enlaces.
- **Login**: pantalla de acceso más grande y centrada, con el escudo del
  club y el nombre de la app como elemento principal.

Pendiente: seguir afinando el interior de Directo y de la ficha técnica
de Equipos contra las capturas de referencia de Sergio a medida que las
vaya concretando, y la integración del calendario de la federación
(enlace del club).

## Próximos pasos

Todo el listado original de bloques está construido: login/usuarios,
fichas de deportistas, equipos (personal/plantilla/ficha técnica),
cuotas (con barra de progreso y varias cuotas por deporte), partidos/
asistencia, competición, Inicio, banco de ejercicios, planificación
mensual, traspaso de temporada, Directo (v3 visual) y Metodología — ver
las secciones correspondientes más arriba. Pendiente: integración del
calendario de la federación (enlace del club), banco de ejercicios que
Sergio quiera aportar en su propio formato, y seguir afinando detalles
visuales puntuales contra las referencias de Sergio.

## Cómo desplegarlo en tu VPS (cuando lo subamos)

1. Crear la base de datos en PostgreSQL y ejecutar los archivos SQL de
   `database/` en orden numérico (01 a 10 por ahora; cada bloque nuevo
   añade el siguiente número). Todos son seguros de re-ejecutar sobre una
   base ya creada: usan `IF NOT EXISTS`/`WHERE NOT EXISTS` donde hace falta.
2. Copiar `.env.example` a `.env` y rellenar con tus credenciales reales.
3. `npm install` dentro de `backend/`.
4. `npm start` (o mejor, un contenedor Docker junto a los que ya tienes
   para Jarvis, con nginx haciendo de proxy con SSL, igual que ahora).

Esto lo automatizamos del todo en cuanto conectemos directamente contra
tu servidor con Claude Code.
