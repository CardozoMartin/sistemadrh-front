# Sistema DRH — Frontend (React + TypeScript)

Migración del prototipo HTML de la Dirección de Recursos Hídricos de Tucumán a una app React.

**Stack:** Vite · React 19 · TypeScript (strict) · React Router · Tailwind CSS v4 · react-hook-form + zod · TanStack Query + axios · json-server (API simulada) · Leaflet

```bash
npm install
npm run dev         # front (:5173) contra el backend real (backend/: npm run start:dev, :3000)  ← usar siempre este
                    # todo sale de la base: las pantallas que aún usan json-server avisan «pendiente de migrar»
npm run dev:mock    # como antes de la migración: json-server (:3001) + eventos (:3002) + front
npm run demo        # MODO DEMO: sin el backend real (ver «Modo demo» abajo)
npm run mock        # solo la API simulada (json-server)
npm run mock:events # solo el servidor de avisos en vivo (SSE)
npm run mock:reset  # vuelve la base de la demo a su estado inicial (con el servidor frenado)
node mock-server/build-db.mjs --out=otra.json  # genera la semilla en otro archivo, para probarla
npm run build       # typecheck + build de producción
```

Copiar `.env.example` a `.env.local` para cambiar la URL de la API o la demora simulada.

## Estructura

```
src/
├── main.tsx                  Punto de entrada
├── app/
│   ├── App.tsx               Providers + RouterProvider
│   ├── router.tsx            Ensambla las rutas de todos los módulos
│   ├── lazyPage.ts           Helper de carga diferida por ruta
│   └── providers/            Contextos globales (tema; a futuro: auth)
├── config/
│   ├── routes.ts             ★ Todas las URLs de la app
│   ├── navigation.ts         ★ Menú lateral (secciones, ítems, submenús, roles)
│   └── tramites.ts           Catálogo de trámites y circuito de oficinas
├── components/
│   ├── layout/               AppLayout, Sidebar, SidebarItem, Topnav
│   ├── form/                 Controles de formulario (ver "Formularios")
│   └── ui/                   Componentes reutilizables (Icon, Button, Card, Stepper, PageHeader…)
├── features/                 Un módulo por área de negocio
│   ├── expedientes/          api.ts + hooks.ts + TablaExpedientes (bandejas, búsquedas, visor)
│   ├── concesiones/          Concesiones vigentes: buscador y ficha (trámites sobre una concesión)
│   ├── catastro/             routes.tsx + pages/
│   ├── recaudacion/ distrito/ juridico/ secretaria-general/
│   ├── tramites/
│   │   ├── routes.tsx        Ensambla las rutas de cada trámite
│   │   ├── shared/           Piezas comunes a todos los trámites (bloques de formulario + etapas/ del circuito)
│   │   ├── AltaDeConcesion/  Un trámite = una carpeta (ver abajo)
│   │   ├── CambioDeTitularidad/ Anulacion/ ReduccionAmpliacion/
│   │   └── Subdivision/ Reubicacion/ Permisos/
│   ├── pozo/
│   ├── busqueda/ visor/ configuracion/
│   ├── oficinas.routes.tsx   Rutas de las 4 oficinas intermedias
│   └── herramientas.routes.tsx
├── pages/                    Páginas que no pertenecen a un módulo (Dashboard, 404, error)
├── components/feedback/      LoadingState, ErrorState, EmptyState, Alert
├── hooks/                    useTheme, useBreadcrumbs, useCatalogos
├── services/
│   ├── api/client.ts         ★ Cliente axios único (URL base, demora simulada, errores)
│   ├── api/errors.ts         ApiError + mensajes para el usuario
│   ├── api/jsonServer.ts     Particularidades de json-server (filtros)
│   └── catalogos.ts          Peticiones de catálogos (localidades, suministro)
├── lib/                      Utilidades (cn, storage, validaciones, geo, queryClient)
├── types/                    Tipos de dominio (Expediente, Titular…) y de navegación
└── styles/index.css          Tailwind + tema (colores del prototipo)
```

## Modo demo (sin el backend real)

Algunos módulos ya hablan con el **backend real** (`/backend`, NestJS + PostGIS): Alta de Concesión, Baja de
Pozo, el visor y la carga de KML (`/api/sig/*`) y el selector de usuario. Para mostrar la app sin levantar
el backend, `npm run demo` (usa `.env.demo`: `VITE_MODO_DEMO=true`) los responde con un **backend emulado
en el navegador** (`src/services/demo/`):

- **Cómo:** solo cambia el *adaptador* de axios de los clientes `backend` y `api` (`services/api/*.ts`).
  Las pantallas, los hooks y los `api.ts` no se tocan: al apagar el modo demo, todo vuelve al backend real.
- **Qué emula:** las mismas rutas, la misma forma de las respuestas y las reglas principales del backend
  (cada acción en su etapa, tomar antes de actuar, solo la oficina donde está, expediente único, deuda →
  espera → pago, observado → corrección → vuelve a la oficina que observó, número y resolución, padrón,
  polígono duplicado ≥ 90 %, coordenadas en POSGAR o lat/long, baja de pozo con clausura y aviso a Distrito).
  Lo geográfico (superficie, superposiciones, cauce más cercano) se calcula en el navegador.
- **Datos de ejemplo:** el padrón demo del backend (159 concesiones con polígono, 46 pozos), los ríos y
  canales de OpenStreetMap, y trámites en distintas etapas armados recorriendo el circuito (altas en Catastro,
  Recaudación, Jurídico y Secretaría; bajas de pozo en mesa de entrada, en Jurídico y una de oficio).
- **Dónde quedan:** en el navegador (`localStorage`). El botón **«Modo demo»** de la barra superior los
  reinicia. Lo que va a json-server (los demás trámites) sigue igual.
- **Al agregar una ruta al backend real** que use el front, sumarla al emulador (`services/demo/servidor/`);
  si falta, el modo demo responde 404 «El modo demo todavía no emula …».

## API simulada y capa de datos

La demo usa **json-server** como backend: `mock-server/db.json` guarda todo lo que se carga y persiste
entre recargas y reinicios. Se genera con `mock-server/build-db.mjs` a partir de `mock-server/seed/`
(catálogos normalizados + 16 expedientes de ejemplo en el circuito y 8 concesiones vigentes, con polígono).
Las altas finalizadas son las **concesiones vigentes**; los cambios de titularidad de ejemplo apuntan a una.
`db.json` no se versiona; `npm run mock:reset` lo vuelve al estado inicial.

| Recurso                | Uso                                                         |
| ---------------------- | ----------------------------------------------------------- |
| `/oficinas`, `/etapas`, `/tramites`, `/estados`… | Datos de referencia (ver sección siguiente) |
| `/catalogoLocalidades` | Departamento → localidad → distritos                        |
| `/catalogoSuministro`  | Fuentes, sistemas y cascada de canales por ubicación        |
| `/expedientes`         | Expedientes en el circuito de oficinas (con polígono)       |
| `/borradoresAlta`      | Altas en carga en Catastro, antes de enviarse a Recaudación |
| `/borradoresCambioTitularidad` | Cambios de titularidad en carga en Catastro         |

> ⚠️ No regenerar `db.json` (`mock:reset`) con `npm run dev` corriendo: json-server tiene la base en memoria y
> en la próxima escritura pisa el archivo. Frenar el servidor, regenerar y volver a levantar.

El front siempre llama a `/api/...`; el proxy de Vite lo redirige a `localhost:3001`. Para pasar al
backend real cambia el target del proxy (o `VITE_API_URL`) y, si hiciera falta, las funciones de
`api.ts` de cada módulo — los hooks y las pantallas no se tocan.

El visor muestra además capas WMS de otros organismos (`features/visor/capasWms.ts`). Las del Ministerio
de Producción se piden directo (https, con CORS). Las de **Catastro** (`http://200.49.89.203/geoserver/dgct`)
son solo http y sin CORS, así que van por el proxy **`/ext/catastro`** de `vite.config.ts`.
**En producción el servidor web tiene que tener ese mismo proxy** (`/ext/catastro/*` → `http://200.49.89.203/geoserver/dgct/*`);
sin él no se ven las capas de Catastro ni funciona la consulta de parcelas con un clic.

**Capas, siempre en este orden:**

1. `services/api/client.ts` — instancia axios. Todos los errores salen como `ApiError` con un mensaje listo para mostrar.
2. `features/<modulo>/api.ts` — funciones de petición puras (`listar`, `obtener`, `crear`…), sin estado.
3. `features/<modulo>/hooks.ts` — `useQuery` / `useMutation` + claves de caché (`expedienteKeys`, `altaKeys`).
   Las mutaciones invalidan lo que afectan (ej: enviar un alta refresca `expedientes`).
4. Pantallas — usan solo los hooks y muestran `LoadingState` / `ErrorState` / `EmptyState`;
   los botones de acción usan `loading={mutation.isPending}`.

En desarrollo cada petición demora 400 ms (`VITE_API_DELAY_MS`) para que se vean los estados de carga,
y el panel de TanStack Query (abajo a la izquierda) muestra cada consulta y su estado.

## Datos de referencia (dominio) y relaciones

Nada de lo que es dato del negocio está fijo en el código: vive en `mock-server/seed/dominio.json`
(editable a mano) y la API lo sirve como colecciones. `npm run mock:reset` lo vuelca a `db.json`
y **verifica la integridad referencial** (falla si un id apunta a algo que no existe).

| Colección              | Qué define                                                      |
| ---------------------- | --------------------------------------------------------------- |
| `oficinas`             | Nombre y descripciones de cada oficina                          |
| `etapas`               | **El circuito**: etapa → `oficinaId`, ordenadas por `orden`     |
| `tramites`             | Tipos de trámite (nombre, descripción, ícono)                   |
| `estados`              | Estados de expediente, color y si cuentan como `pendiente`      |
| `situacionesLegales`   | Situación del solicitante y la documentación que exige          |
| `usos`                 | Módulo de dotación, unidad y si `requierePuntoEntrega`          |
| `circunscripciones`, `seccionesCatastrales`, `caracteres`, `codigosServicio` | Opciones de formularios |
| `usuarios`             | Responsables por oficina (base para el login)                   |

Los expedientes se relacionan por id: `oficinaId`, `tramiteId`, `estadoId`, `usoId`, y cada paso del
historial con `oficinaId`, `etapaId` y `usuarioId`. Como siguen la convención de json-server, se pueden
pedir embebidos: `/expedientes/demo-04?_embed=oficina&_embed=tramite` o `/oficinas/juridico?_embed=expedientes`.

En el front, `DominioProvider` carga todo al iniciar y `useDominio()` lo expone con búsquedas por id
(`nombreOficina(id)`, `estado(id)`, `circuito`, `estadosPendientes`…). Solo quedan en el código las
**rutas** de cada pantalla (`config/tramites.ts`) y las **reglas de validación** (ej: DNI/CUIL/CUIT).

## Circuito de oficinas (todos los trámites)

`Catastro (inicio + carga) → Recaudación → Distrito → Jurídico → Secretaría General → Catastro (cierre)`

Desde la bandeja de cada oficina, **Revisar** abre `/tramites/<tramite>/expediente/:id` (`RUTA_GESTION` en
`config/tramites.ts`), que muestra la pantalla de la etapa donde está el expediente. Las pantallas de las
oficinas intermedias son **compartidas** (`features/tramites/shared/etapas/`); cada trámite aporta solo:

- su **`ConfigTramite`** (`etapas/config.ts`): las personas del expediente (a quién se le verifica deuda y a
  quién se avisa) y las filas propias del resumen. Las pantallas no leen `expediente.datos` directamente.
- su pantalla de **cierre** en Catastro.

```tsx
// pages/GestionXxxPage.tsx
<GestionExpediente tramiteId="cambio_titularidad" titulo="…" config={CONFIG_CAMBIO} cierre={EtapaCierreCambio} />
```

| Etapa (`/etapas`)    | Pantalla             | Qué registra                                                                 |
| -------------------- | -------------------- | ---------------------------------------------------------------------------- |
| `verificacion_deuda` | `EtapaRecaudacion`   | Con / sin deuda, detalle, aviso por email al titular                          |
| `inspeccion_tecnica` | `EtapaDistrito`      | APTO / NO APTO (motivo), informes PDF, observaciones técnicas                 |
| `dictamen_juridico`  | `EtapaJuridico`      | Apto / No apto, documentos faltantes (`/documentosJuridicos`), adjuntos, dictamen |
| `resolucion`         | `EtapaSecretaria`    | Pide el N° de concesión a Catastro, N° y fecha de resolución, PDF             |
| `cierre`             | propia del trámite   | Alta: `EtapaFinalizacion` (otorgamiento + 6 secciones). Cambio: `EtapaCierreCambio` |

- Si un expediente se abre con la ruta de otro trámite, `GestionExpediente` redirige a la correcta.
- Todas comparten `EtapaLayout` (barra del circuito + resumen del expediente con la nota de la oficina
  anterior) y `useAccionEtapa` (confirmar → registrar → volver a la bandeja con aviso).
- **Aprobado** avanza a la siguiente oficina; **observado** (deuda, no apto, falta documentación) deja el
  expediente en la oficina con estado *Observado* y el motivo en el historial. Se puede volver a revisar.
- **Número de concesión:** en un alta, Secretaría crea un pedido en `/solicitudesNumero`; Catastro lo ve en su
  bandeja (aviso en vivo), asigna el número y Secretaría lo recibe al instante. Los trámites sobre una
  concesión existente ya traen el número y no lo piden.

## Concesiones vigentes y Cambio de Titularidad

**Concesión vigente** = expediente de alta `finalizado` con número de concesión (`features/concesiones/`).
Con el backend real será `GET /concesiones` y solo cambia `concesiones/api.ts`. Los trámites sobre una
concesión guardan `concesionOrigenId`; mientras uno está en curso, la concesión no admite otro.

**Cambio de Titularidad** (`features/tramites/CambioDeTitularidad/`):

1. `InicioCambioTitularidadPage` (prototipo `inicioTramite.html`) — `BuscadorConcesion` (N° de concesión, DNI,
   CUIL/CUIT, distrito, fechas + «Buscar»). Con la concesión elegida, «Iniciar trámite» pide el N° de expediente y comienza.
2. `NuevoTitularPage` (`preCargaTitular.html`) — datos del titular + domicilio legal; al menos un titular tiene que ser nuevo.
   «Anterior» guarda y vuelve a la búsqueda; «Siguiente» envía a Recaudación.
3. Circuito compartido. Recaudación verifica la deuda del titular actual **y** del nuevo.
4. `EtapaCierreCambio` (`CatastroFinalizacion.html`) — **carga final del titular** con el N° de resolución. Solo se
   habilita si todas las oficinas aprobaron y hay resolución. Hasta acá la concesión sigue a nombre del titular
   actual (el nuevo es «propuesto»); al finalizar cambia y los anteriores quedan en `datos.titularesAnteriores`.
- Adjuntos y emails son simulados: se guardan metadatos de archivos y los emails quedan en `/emails`.

## Trazabilidad: recepciones, historial y búsqueda

Todo trámite es un **expediente con número** y su **historial** queda completo y legible:

- **Recepción** (`Expediente.recepciones`): antes de revisar, la oficina **toma** el expediente (botón «Tomar»
  en la bandeja o pantalla `TomarExpediente`). Queda quién y cuándo. La carga inicial en Catastro no se toma.
- **Movimientos** (`features/expedientes/movimientos.ts`): junta historial + recepciones en frases como
  «S. Herrera (Recaudación) tomó el expediente 240100» o «…completó «Verificación de deuda» y derivó a Distrito».
  `HistorialExpediente` / `LineaDeTiempo` los muestran en bandejas, resúmenes y consultas.
- **Buscador general** (`/catastro/busqueda`, prototipo `busquedaCatastro.html`): todos los expedientes de
  cualquier circuito, con vista rápida y filtros avanzados (incluye datos catastrales de la concesión).
- **Consulta de expediente** (`/catastro/busqueda/expediente/:id`): datos + historial completo (solo lectura).
- **Historial de la concesión** (`/catastro/busqueda/concesion/:id`): ficha, **cadena de titulares** con
  desde/hasta y el expediente que los hizo titulares, todos sus trámites y una línea de tiempo única.

**Anulación** (`features/tramites/Anulacion/`): mismo inicio (`InicioSobreConcesion`) → verificación de datos con
motivo obligatorio → circuito → cierre con **baja lógica**: la concesión pasa a `anulado` con `bajaConcesion`
(fecha, expediente, resolución, motivo). No se borra; deja de ser vigente y se sigue viendo en el historial.

**Reducción / Ampliación** (`features/tramites/ReduccionAmpliacion/`): mismo inicio → «Definición de superficie»
con `EditorPoligonoMap` (escala, vértices arrastrables, reglas de reducción/ampliación y recálculo del caudal) →
circuito (las oficinas ven el mapa actual vs. propuesta por `ConfigTramite.Detalle`) → cierre: la concesión pasa a la
nueva superficie y la anterior queda en `datos.superficiesAnteriores`.

## Bandejas por oficina y avisos en vivo

Cada oficina tiene su **bandeja** (`BandejaOficina`): los expedientes pendientes que están en ella, con su
historial y la acción **Derivar** al siguiente paso del circuito (reglas en `features/expedientes/circuito.ts`).
El historial guarda los pasos **completados**; la oficina actual todavía no figura.

**Tiempo real:** `mock-server/events.mjs` vigila `db.json` y emite eventos **SSE** (`nuevo`, `derivado`,
`finalizado`) cuando un expediente aparece o cambia de oficina, desde cualquier pestaña o equipo.
En el front:

- `services/realtime.ts` — conexión (EventSource, con reconexión). Si el backend real usa WebSocket, cambia solo este archivo.
- `features/notificaciones/NotificacionesProvider` — ante cada evento refresca las consultas de expedientes,
  guarda la notificación (campana del topnav) y muestra un aviso emergente.
- Sidebar — contador de pendientes por bandeja; late cuando llegó algo que no se vio.
- Sin conexión en vivo, bandejas y contadores se refrescan cada 30 s como respaldo.

Para mostrarlo en la demo: abrir dos pestañas (ej: Recaudación y Distrito), derivar desde una y ver el aviso en la otra.

`TODO(login)`: hoy se avisa de todas las oficinas; con usuarios, solo de la oficina del usuario.

## Estructura de un trámite

```
features/tramites/AltaDeConcesion/
├── routes.tsx          Rutas del trámite (se registran en tramites/routes.tsx)
├── pages/              Una página por paso (InicioAltaPage, PreCargaDatosPage…)
├── components/         Componentes propios del trámite
│   └── secciones/      Secciones del formulario de pre carga + su configuración
├── schemas.ts          Schemas zod = reglas de validación + tipos del formulario
├── api.ts              Peticiones HTTP (solo hablan con la API)
├── hooks.ts            useQuery / useMutation + claves de caché (lo que usan las pantallas)
├── types.ts            Tipos propios (ej: BorradorAlta)
└── etapas/             config.ts (ConfigTramite) + pantalla de cierre propia
```

Lo que se repite entre trámites va en `features/tramites/shared/` y se importa desde `'../shared'`:

| Bloque                   | Schema                          | Qué hace                                                        |
| ------------------------ | ------------------------------- | --------------------------------------------------------------- |
| `TitularFields`          | `titularSchema`                 | Persona física/jurídica, DNI/CUIL/CUIT con dígito verificador   |
| `DomicilioFields`        | `domicilioSchema`               | Calle + cascada de ubicación                                    |
| `CascadaUbicacionFields` | `ubicacionSchema`               | Departamento → Localidad → Distrito (catálogo de Tucumán)       |
| `KmlUploadField`         | `poligonoSchema`                | Carga de KML/GeoJSON, superficie en ha y vista previa en mapa   |
| `DatosCatastralesFields` | `catastralSchema`               | Padrón, matrícula, circunscripción, sección, parcela…           |
| `DatosRegistralesFields` | `registralSchema`               | Libro, folio, año, matrícula, serie                             |
| `UsosFields`             | `usosSchema`                    | Carácter, período, desagüe, tabla de usos con caudal, pecuario  |
| `SuministroFields`       | `suministroSchema`              | Fuentes, sistema, canales en cascada (hasta quinto), desagüe    |

Reglas de negocio compartidas: `dotacion.ts` (módulos de dotación y cálculo de caudal) y
`suministro.ts` (recorrido de la cascada de canales). Los schemas se importan desde su archivo
(`../shared/schemas/usos`) cuando se quiere evitar cargar componentes pesados como el mapa.

## Formularios

Se usa **react-hook-form** + **zod** (`@hookform/resolvers/zod`):

- El schema zod define reglas y mensajes; el tipo del formulario sale de `z.infer<typeof schema>`.
- El formulario se envuelve en `<FormProvider>` y los campos se conectan solos por `name`:

```tsx
<FormTextField name="titulares.0.apellido" label="Apellido" required />
<FormNumericField name="documento" label="DNI" maxLength={8} />
<FormSelectField name="departamento" label="Departamento" options={opciones} onValueChange={...} />
<FormRadioCardGroup name="situacionLegal" options={SITUACIONES_LEGALES} />
```

- Los bloques reutilizables (`TitularFields`, `DomicilioFields`) reciben un `prefix`
  (ej: `titulares.1`) y funcionan dentro de cualquier formulario que tenga esa forma.
- Para formularios en pasos: cada sección declara sus `campos` y se valida con
  `form.trigger(campos)` antes de avanzar (ver `AltaDeConcesion/components/secciones/index.ts`).

## Cómo agregar una pantalla

1. Agregar la URL en `config/routes.ts`.
2. Crear la página en `features/<modulo>/pages/MiPantallaPage.tsx` (export default).
3. Registrarla en `features/<modulo>/routes.tsx` con su `handle: { crumb: '...' }`
   (el crumb arma los breadcrumbs y el `<title>` automáticamente).
4. Si va en el menú, agregarla en `config/navigation.ts`.

Las pantallas todavía no migradas usan `PlaceholderPage`, que indica el HTML del prototipo de referencia.

## Convenciones

- Imports con alias `@/` → `src/`.
- Nunca escribir URLs a mano: usar `ROUTES`.
- Toda llamada al backend pasa por `services/api/client.ts`; cada módulo tiene su `features/<modulo>/api.ts`.
- Todo elemento nuevo debe verse bien en modo claro y oscuro (`dark:`).
- Un módulo que crece se organiza así: `features/<modulo>/{pages,components,hooks,api.ts,types.ts,routes.tsx}`.

## Preparado para el login (pendiente)

- `NavItem.roles` en `config/navigation.ts` ya indica qué rol ve cada opción; falta filtrar en `Sidebar.tsx` (marcado con `TODO(login)`).
- `/login` irá como ruta hermana de `AppLayout` en `app/router.tsx`, y `AppLayout` quedará detrás de una ruta protegida.
- El topnav muestra un usuario de prueba (`TODO(login)` en `Topnav.tsx`).
