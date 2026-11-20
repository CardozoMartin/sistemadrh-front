# Estado de la migración HTML → React

Bitácora de dónde estamos parados. Se actualiza al terminar cada trámite o pantalla.
La documentación técnica de la app (stack, capas, convenciones) está en `README.md`;
las reglas de negocio de cada circuito, en `../infotecnica.md` (sección 6).

**Última actualización:** 30/09/2026 — Cambio de Titularidad completo (sin commitear todavía).
**Verificado:** `npx tsc -b` y `npm run build` pasan. Circuito completo del cambio probado por la UI
(navegador headless): inicio → nuevo titular → Recaudación → Distrito → Jurídico → Secretaría → cierre,
con la concesión actualizada al final. El Alta se volvió a probar después de la refactorización.

---

## 1. Resumen rápido

| Área | Estado |
| --- | --- |
| Base de la app (layout, sidebar, topnav, rutas, tema claro/oscuro, breadcrumbs) | ✅ Hecho |
| API simulada (json-server + `dominio.json` + verificación de integridad) | ✅ Hecho |
| Pases entre oficinas (bandejas, derivar, observar, historial) | ✅ Hecho |
| Avisos en vivo (SSE, campana, toasts, contadores en sidebar) | ✅ Hecho |
| **Alta de Concesión** — circuito completo de punta a punta | ✅ Hecho |
| Bloques de formulario compartidos (`features/tramites/shared/`) | ✅ Hecho |
| **Etapas del circuito compartidas** (`tramites/shared/etapas/`) | ✅ Hecho |
| **Concesiones vigentes** (buscador + ficha, `features/concesiones/`) | ✅ Hecho |
| **Cambio de Titularidad** — circuito completo de punta a punta | ✅ Hecho |
| **Anulación** — circuito completo, baja lógica de la concesión | ✅ Hecho |
| **Reducción / Ampliación** — editor de polígono, recálculo de caudal, circuito y cierre | ✅ Hecho |
| **Subdivisión** — editor de fracciones, datos por fracción, N° por fracción y concesiones nuevas al cierre | ✅ Hecho |
| Reubicación | ⏳ **Próximo** (placeholder) |
| Permisos | ⏳ Placeholder |
| **Pozo — Empresas perforadoras** (alta, modificación, baja/reactivación; alta/baja/modificación de máquinas) | ✅ Hecho |
| **Pozo — Alta de pozo de oficio** (8 pestañas del prototipo, coordenadas unificadas, monitoreos con fecha) — PROTOTIPO en modo demo (`npm run demo`) | 🟡 Prototipo |
| **Pozo — Pozos registrados** (padrón por origen: de oficio / con autorización / padrón anterior; marca «De oficio» en listas, ficha y visor) — PROTOTIPO en modo demo | 🟡 Prototipo |
| **Pozo — Circuito del registro** (Pozos → Catastro: concesión, N° y caudales → Distrito → Recaudación → Jurídico → Secretaría: resolución → Pozos: cierre y concesión vigente) — PROTOTIPO en modo demo | 🟡 Prototipo |
| **Pozo — Historial de monitoreos** (hidráulicos y químicos por fecha, cambios contra el anterior, informe por fecha, evolución hidráulica) — PROTOTIPO en modo demo | 🟡 Prototipo |
| Pozo (autorización, consulta) | ⏳ Placeholder |
| **Búsqueda Catastro + historial de expedientes y concesiones** | ✅ Hecho |
| **Modo demo** (`npm run demo`): backend emulado en el navegador para Alta de Concesión, Baja de Pozo, visor y alta de pozo | ✅ Hecho |
| Búsqueda general, Visor, Configuración | ⏳ Placeholder |
| Login / roles | ❌ No empezado (preparado con `TODO(login)`) |
| Dashboard con KPIs | ❌ Hoy solo accesos a módulos |

---

## 2. Lo que ya está hecho

### 2.1 Pases entre oficinas (genérico, sirve para todos los trámites)

- **Circuito**: sale de `/etapas` (`mock-server/seed/dominio.json`), ordenado por `orden`:
  `pre_carga_datos (Catastro) → verificacion_deuda (Recaudación) → inspeccion_tecnica (Distrito) → dictamen_juridico (Jurídico) → resolucion (Sec. General) → cierre (Catastro)`.
- **Reglas**: `features/expedientes/circuito.ts` — la etapa actual = cantidad de revisiones *aprobadas* del historial.
  `observado` deja el expediente detenido en la oficina con estado *Observado*.
- **Registrar revisión**: `expedientesApi.registrarRevision` (`features/expedientes/api.ts`) — mueve `oficinaId`, cambia `estadoId` y agrega el paso al historial.
- **Bandejas**: `BandejaOficina` (una por oficina; Recaudación/Distrito/Jurídico/Sec. General ya la usan). Si el trámite tiene pantalla de gestión (`RUTA_GESTION`) muestra **Revisar**; si no, **Derivar** directo.
- **Tiempo real**: `mock-server/events.mjs` (SSE) + `services/realtime.ts` + `features/notificaciones/`.
- **Componentes**: `CircuitoProgreso` (barra del circuito), `HistorialExpediente`, `EstadoBadge`, `TablaExpedientes`.

### 2.2 Alta de Concesión (`features/tramites/AltaDeConcesion/`)

| Paso | Pantalla | Archivo |
| --- | --- | --- |
| Catastro 1 — N° expediente + situación legal + checklist | `InicioAltaPage` | crea un borrador en `/borradoresAlta` |
| Catastro 2 — Pre carga (6 secciones: titular, ubicación+KML, catastral, registral, usos, suministro) | `PreCargaDatosPage` + `components/secciones/` | guarda por sección; al enviar crea el expediente en Recaudación |
| Altas en curso (retomar borradores) | `AltasEnCurso` | |
| Recaudación / Distrito / Jurídico / Sec. General | etapas compartidas (ver 2.4) | Sec. General pide el N° de concesión a Catastro (`SolicitudesNumeroPanel`) |
| Catastro cierre — otorgamiento + revisión de las 6 secciones + checks | `etapas/EtapaFinalizacion` | |

Todo entra por `/tramites/alta-concesion/expediente/:id` → `GestionExpedientePage` → `<GestionExpediente>` con `CONFIG_ALTA` (`etapas/config.ts`).

### 2.3 Bloques compartidos listos para reutilizar (`features/tramites/shared/`)

`TitularFields`, `DomicilioFields`, `CascadaUbicacionFields`, `KmlUploadField`, `DatosCatastralesFields`,
`DatosRegistralesFields`, `UsosFields`, `SuministroFields` + sus schemas zod y `dotacion.ts` / `suministro.ts`.

---

### 2.4 Etapas compartidas (`features/tramites/shared/etapas/`)

Recaudación, Distrito, Jurídico y Secretaría General son las mismas pantallas para todos los trámites.

| Pieza | Qué hace |
| --- | --- |
| `GestionExpediente` | Página de gestión genérica: carga el expediente, elige la pantalla según la etapa, redirige si el expediente es de otro trámite y provee la `ConfigTramite`. |
| `config.ts` → `ConfigTramite` | Lo que aporta cada trámite: `personas(expediente)` (verificación de deuda y avisos) y `datosResumen(expediente)` (filas del resumen). |
| `EtapaRecaudacion` | Con varias personas (cambio: actual + nuevo) muestra una tarjeta por persona y pide marcar quién debe. |
| `EtapaSecretaria` | Si el expediente ya tiene N° de concesión (trámites sobre una concesión) no lo pide a Catastro. |
| `useAccionEtapa` | Ahora acepta `antes` (tarea previa a registrar; si falla, el expediente no avanza). |
| `ChecksCircuito` | Visto bueno de cada oficina, para las pantallas de cierre. |

Cada trámite tiene `etapas/config.ts` + su cierre, y una `pages/GestionXxxPage.tsx` de 10 líneas.

### 2.5 Concesiones vigentes (`features/concesiones/`)

- **Concesión vigente = alta `finalizado` con `numeroConcesion`.** Está encapsulado en `concesiones/api.ts` y `datos.ts`:
  cuando exista `GET /concesiones` en el backend real, solo cambian esos archivos.
- `Expediente.concesionOrigenId` vincula un trámite con su concesión. Una concesión con un trámite pendiente
  no admite otro (el buscador la muestra "en curso" y la API lo valida al iniciar).
- `BuscadorConcesion`: filtros por N° de concesión, DNI, CUIL/CUIT, distrito y fecha de otorgamiento; selección por radio; ficha con mapa (carga a demanda).
- **Búsqueda en el servidor, nunca la lista completa** (en la migración son +30.000 concesiones): el buscador no pide nada
  hasta que se busca con al menos un criterio, y `concesionesApi.buscarVigentes` trae de a 20 (paginado). Los
  "en curso" se piden solo para la página visible (`tramitesEnCurso`). Reducción/Ampliación pide las vecinas del departamento.
- Como json-server no filtra dentro de arrays, la concesión lleva dos índices: `fechaOtorgamiento` y `documentosTitulares`
  (los setea el cierre del Alta y `cambiarTitulares`; `build-db` los completa en un `db.json` existente sin regenerarlo).
- `concesionesApi.cambiarTitulares` guarda los titulares anteriores en `datos.titularesAnteriores` (no se borran).

### 2.6 Cambio de Titularidad (`features/tramites/CambioDeTitularidad/`)

| Paso | Pantalla | Prototipo |
| --- | --- | --- |
| Catastro 1: búsqueda de la concesión → «Iniciar trámite» → diálogo para asignar el N° de expediente | `InicioCambioTitularidadPage` (+ `CambiosEnCurso`) | `inicioTramite.html` |
| Catastro 2: pre-carga del nuevo titular (datos del titular + domicilio legal) | `NuevoTitularPage` | `preCargaTitular.html` |
| Recaudación / Distrito / Jurídico / Sec. General | etapas compartidas | `recaudacion.html`, `distrito.html`, `juridico.html`, `secretariaGenral.html` |
| Catastro cierre: **carga final del titular** con N° de resolución (correo y teléfono obligatorios) | `etapas/EtapaCierreCambio` | `CatastroFinalizacion.html` («Paso 8 de 8») |

Reglas implementadas:
- Flujo fiel al prototipo enlazado: `tramites.html → inicioTramite.html → preCargaTitular.html`. Primero se busca la concesión;
  recién con la concesión elegida se asigna el expediente y comienza el trámite.
- Búsqueda: N° de concesión, DNI, CUIL/CUIT, distrito, fecha desde/hasta (de otorgamiento) y botón «Buscar»; estado «Activa / Regular».
- Barra «Paso N de 7» (`shared/components/PasosTramite`): Búsqueda → oficinas del circuito → Catastro Finalización.
- `verificacionInicial.html` (checklist de papeles) **no se migró**: no está enlazado desde ninguna pantalla del prototipo.
  Si se quiere, va como paso entre la búsqueda y la pre-carga.
- N° de expediente único (contra expedientes y cambios en carga); un solo cambio en carga por concesión.
- El nuevo titular no puede ser el actual (compara DNI contra CUIL/CUIT con `mismaPersona`); puede quedar un cotitular.
- La ubicación, el polígono, el uso y el caudal se copian de la concesión (no cambian).
- **Regla clave: el nuevo titular es solo una propuesta hasta el final.** La pre-carga del inicio sirve para que
  Recaudación verifique su deuda y las oficinas lo vean, pero la concesión **sigue a nombre del titular actual** durante
  todo el circuito. Recién cuando el trámite tiene resolución y pasó por todas las oficinas, Catastro hace la
  **carga final del titular** (`CatastroFinalizacion.html`) y ahí la concesión cambia de titular.
- La carga final se bloquea si falta la aprobación de alguna oficina o la resolución. El N° de resolución que se
  transcribe tiene que coincidir con el que registró Secretaría General (se guarda el oficial).
- Mientras tanto se muestra «Nuevo titular (propuesto)» en Recaudación y en el resumen, y el historial de la
  concesión avisa «Cambio de titularidad en curso… sigue a nombre de X».
- Se guardan los dos: lo pre-cargado (`datos.cargaFinal.propuesto`) y lo definitivo (`datos.titulares`).
- Al finalizar: la concesión cambia de titular (el anterior queda en su historial), el expediente queda finalizado y
  pendiente de padrón de Rentas.
- `CierredeTramite.html` no está enlazado en el prototipo (alternativa de diseño): no se migró.

`mensajeDeExito.html` no se migró como pantalla: el aviso de éxito queda en la bandeja (como en el Alta).

### 2.7 Trazabilidad: «tomó el expediente», historial y búsqueda

Pedido: que internamente, en las búsquedas, cada trámite muestre su expediente y todo su historial (quién lo
inició, quién lo tomó en cada oficina…), y que una concesión conserve todos sus cambios a lo largo de los años.
Basado en `Documentacion/ModeloDeDatos.md` (`exp_movimiento`, `con_titular.vigente`).

| Pieza | Qué hace |
| --- | --- |
| `Expediente.recepciones` + `expedientesApi.tomar` | La oficina **toma** el expediente antes de revisarlo (usuario + fecha). |
| Bandeja | Botón **Tomar** (registra y abre) o **Revisar** si ya fue tomado; muestra «Tomado por…». |
| `TomarExpediente` | Si se entra por URL a un expediente sin tomar, se pide tomarlo antes de ver el formulario. |
| `expedientes/movimientos.ts` | Historial legible: inició / tomó / completó y derivó / observó / cerró. |
| `busqueda/BusquedaPage` | Búsqueda general (Herramientas, `/busqueda`): expedientes de todos los trámites contra `GET /expedientes/buscar`. Ya no hay buscador propio en Catastro. |
| `ExpedienteDetallePage` | Consulta de un expediente (solo lectura) con su historial completo. |
| `HistorialConcesionPage` | Cadena de titulares (desde/hasta + expediente), trámites de la concesión y línea de tiempo única. |

Accesos: «Ver» en la búsqueda, N° de expediente en Seguimiento, «Ver historial completo» en la ficha de la concesión.
No se migraron los filtros «Tipo de concesión», «Tomas» (de agua) y «Coordenadas» del prototipo: los datos demo no los tienen.

### 2.8 Anulación de Concesión (`features/tramites/Anulacion/`)

Es una **baja lógica**: se sigue todo el circuito y recién con la resolución, en el cierre de Catastro, la
concesión pasa a estado **Anulado**. Nunca se borra: queda con `bajaConcesion` (fecha, expediente, resolución,
motivo), deja de aparecer como vigente y se sigue viendo en búsquedas e historial.

| Paso | Pantalla | Prototipo |
| --- | --- | --- |
| Catastro 1: búsqueda de la concesión → «Iniciar trámite» → asignar expediente | `InicioAnulacionPage` (usa `InicioSobreConcesion`) | `inicioTramite.html` |
| Catastro 2: verificación de datos (ficha) + **motivo** + «documentación completa» → Iniciar anulación | `VerificacionAnulacionPage` | `tramiteAnulacion.html` |
| Recaudación / Distrito / Jurídico / Sec. General | etapas compartidas | `recaudacion.html` … `secretariaGenral.html` |
| Catastro cierre: ficha + resolución + motivo + «no se podrá revertir» → Finalizar anulación | `etapas/EtapaCierreAnulacion` | `FinalizarAnulacion.html` |

- **Motivo obligatorio** (no está en el HTML, sí en la documentación: RN-A04 y RN-A09): mínimo 10 caracteres y sin
  texto de relleno («s/d», «—»).
- Sin borrador: el paso 1 solo valida (`validarInicio`) y pasa concesión + expediente por la URL; el expediente se
  crea en «Iniciar anulación» (vuelve a validar).
- Durante el circuito la concesión **sigue vigente**. El cierre se bloquea sin todas las aprobaciones o sin resolución
  (`shared/etapas/cierre.ts → bloqueoDeCierre`, lo usa también el cambio de titularidad).
- Al finalizar: concesión `anulado` + `bajaConcesion`; el expediente de anulación queda finalizado y pendiente de baja
  en el padrón de Rentas. El historial de la concesión muestra «Concesión anulada el … por el expediente …».

### 2.9 Reducción / Ampliación (`features/tramites/ReduccionAmpliacion/`)

| Paso | Pantalla | Prototipo |
| --- | --- | --- |
| Catastro 1: búsqueda de la concesión → asignar expediente | `InicioReduccionAmpliacionPage` (`InicioSobreConcesion`) | `inicioTramite.html` |
| Catastro 2: **Definición de superficie** en el mapa → Guardar y siguiente | `DefinicionSuperficiePage` + `components/map/EditorPoligonoMap` | `reducionampliacion.html` |
| Recaudación / Distrito / Jurídico / Sec. General | etapas compartidas + panel `ComparacionSuperficie` (mapa actual vs. propuesta) | `recaudacion.html` … `secretariaGenral.html` |
| Catastro cierre: comparación + confirmar → la concesión pasa a la nueva superficie | `etapas/EtapaCierreModificacion` | sin pantalla en el prototipo (infotecnica 6.5: cierre en Catastro) |

- Editor fiel al prototipo: tipo (Reducción / Ampliación), superficie actual y nueva, **escala 60–140 %** con ±10 %,
  vértices arrastrables, «Cargar reducción / ampliación» (ejemplos), «Restablecer polígono original», superficie
  permitida, estado geométrico (Válido / Revisar), perímetro, vértices, forma de servicio, caudal recalculado y
  diferencia estimada. Polígono original punteado y concesiones vecinas en gris.
- Reglas (`superficie.ts`): **reducción** = todos los vértices dentro del polígono original y menor superficie;
  **ampliación** = mayor superficie y sin superponerse con concesiones vecinas (reemplaza el «corredor permitido»
  ficticio del prototipo). La superficie sale del polígono (no se tipea).
- **Recálculo del caudal**: los usos que se miden por superficie (unidad «ha…») escalan su magnitud; el caudal
  asignado se ajusta en la misma proporción que la dotación total (módulos de `/usos`).
- La concesión **no cambia hasta el cierre** (con resolución y todas las aprobaciones). Al cerrar se actualizan
  polígono, superficie, caudal, usos y suministro, y la superficie anterior queda en `datos.superficiesAnteriores`
  (el historial de la concesión la muestra en «Cambios de superficie»). Queda pendiente actualizar el padrón de Rentas.
- `ConfigTramite.Detalle`: panel propio del trámite debajo del resumen en las oficinas y en la consulta del expediente.
- `lib/geo.ts`: centroide, escala, perímetro, punto en polígono y superposición de polígonos.

### 2.10 Subdivisión (`features/tramites/Subdivision/`)

| Paso | Pantalla | Prototipo |
| --- | --- | --- |
| Catastro 1: búsqueda de la concesión → asignar expediente (crea la carga en `/borradoresSubdivision`) | `InicioSubdivisionPage` (`InicioSobreConcesion` + `SubdivisionesEnCurso`) | `busquedasubdivision.html` |
| Catastro 2: **definir fracciones** en el mapa (2 a 8, nombre y superficie objetivo de cada una) | `DefinicionFraccionesPage` + `components/map/SubdivisionMap` | `comienzoTramite.html` |
| Catastro 3: **datos por fracción** (las 6 secciones del Alta, una pestaña por fracción) → Enviar a Recaudación | `DatosFraccionesPage` | `preCargaDeNuevaSubdivision.html` |
| Recaudación / Distrito / Jurídico | etapas compartidas + panel `FraccionesDetalle` (mapa + tabla) | `recaudacion.html`, `distrito.html`, `juridico.html` |
| Sec. General: pide **un N° de concesión por fracción** a Catastro y registra la resolución | `EtapaSecretaria` compartida (modo varios números) | `secretaria.html` |
| Catastro cierre: resolución (confirmar N°) + N° por fracción + «irreversible» → otorga las nuevas | `etapas/EtapaCierreSubdivision` | `resumenFinalizacion.html` |

- **Editor de fracciones**: cantidad con − / +, superficie objetivo por lote con barra y «✓ Correcto / Faltan x ha»,
  «Distribuir equitativamente» y **«Dividir automáticamente»** (corta el polígono madre en franjas con esas superficies,
  `lib/geo.ts → dividirPoligono`). En el mapa: **Dibujar** (clic agrega vértice, doble clic o «Cerrar polígono»
  cierra; los clics se pegan a vértices cercanos para compartir bordes), **Editar vértices** (arrastrar) y borrar.
- **Validación** (`fracciones.ts → evaluarSubdivision`): 2 a 8 fracciones con nombre sin repetir, todas dibujadas,
  vértices dentro de la madre (tolerancia 3 m), sin superponerse y cubriendo toda la madre (tolerancia 1 %).
  Superposición / fuera / sin asignar se estiman con una grilla de puntos (`analizarCobertura`), que tolera bordes
  compartidos. «Siguiente» queda deshabilitado mientras no sea válida.
- **Superficie y caudal**: la superficie de cada fracción sale de su polígono; el caudal y los usos se reparten en
  proporción (`recalcularCaudal` de Reducción/Ampliación). Si se edita un polígono con datos ya cargados, se ajustan.
- **Datos de cada fracción**: arrancan con los de la concesión madre (titular, domicilio, ubicación, registro,
  suministro); padrón, matrícula, parcela y orden quedan en blanco (son de la parcela nueva). La ubicación no pide
  KML: muestra el polígono de la fracción (solo lectura).
- Recaudación ve una persona por titular: si el mismo titular está en la madre y en varios lotes, aparece una vez
  con todos sus roles.
- **Cierre** (`concesionesApi.subdividir`): crea una concesión vigente por fracción (con su N°, titular, polígono,
  caudal, resolución e índices de búsqueda; `datos.origen` apunta a la madre) y la madre pasa a **`subdividido`**
  (estado nuevo en `/estados`) con `subdivisionConcesion` (fecha, expediente, resolución y las nuevas). Nada se
  borra. Si se reintenta no duplica las ya creadas. Queda pendiente el padrón de Rentas.
- **Historial**: la madre muestra «Concesión subdividida» con enlaces a las nuevas; cada nueva, «otorgada por
  subdivisión de la N° …». La madre deja de aparecer en el buscador de vigentes; las nuevas aparecen.

**Cambios compartidos que hizo falta:**
- `ConfigTramite.concesionesNuevas` / `aplicarNumerosConcesion`: Secretaría pide varios números en un solo pedido
  (`SolicitudNumero.etiquetas` / `numerosConcesion`) y el panel de Catastro muestra un campo por fracción. Al asignar
  se valida que no haya números repetidos ni ya usados.
- `PasosTramite.carga` (renombra el paso de carga: «Datos por fracción») y `InicioSobreConcesion.pasos`.
- **Arreglos**: `FormSelectField` vuelve a aplicar el valor cuando las opciones llegan después (un formulario
  precargado mostraba el placeholder del suministro); el panel de números de Catastro sugería «1» si se abría antes
  de conocer el próximo número libre.
- `build-db`: `borradoresSubdivision` en `COLECCIONES_VACIAS`; en una base existente agrega los datos de referencia
  nuevos del seed (ej: el estado «Subdividida») sin pisar nada; subdivisión de ejemplo (2 lotes, el B con otro titular).

Probado de punta a punta con Playwright (búsqueda → fracciones → datos → todas las oficinas → cierre → historial y
buscador), más el dibujo a mano y el arrastre de vértices.

### 2.10 bis Pozo — Empresas perforadoras (`features/pozo/EmpresasPerforadoras/`)

**El alta es un trámite por pasos con circuito propio** (pedido del usuario, 01/10/2026):

`1. Datos de la empresa → 2. Máquinas` (Planificación) `→ 3. Jurídico` (dictamen) `→ 4. Secretaría General`
(resolución que la habilita). No pasa por Recaudación ni Distrito, así que no usa `/etapas` ni `/expedientes`:
el estado del trámite vive en la empresa (`estado` + `tramite.oficina`) y cada actuación en `/movimientosEmpresas`.

- **Jurídico** (`/juridico`, panel «Empresas perforadoras — alta pendiente de dictamen» en su bandeja): control
  legal (4 puntos, todos obligatorios para aprobar), dictamen e informe opcional → pasa a Secretaría General.
- **Secretaría General** (`/secretaria-general`, panel «pendientes de resolución»): ve el dictamen, control previo
  (3 puntos), N° / año / fecha de firma de la resolución y la resolución firmada (PDF) → la empresa queda **ACTIVA**.
- Las dos pueden **Observar** (vuelve a Planificación con el motivo; se corrige y se **reenvía a la misma oficina**)
  o **Rechazar** (fin del trámite; la empresa queda registrada como rechazada).
- Mientras está en revisión o rechazada, sus datos y máquinas no se modifican (la ficha muestra el resumen).
  La baja lógica es solo para empresas habilitadas.
- Pantalla de revisión: `/pozo/empresas/:id/revision` (`RevisionEmpresaPage`); barra de pasos `CircuitoEmpresa`.
- Prototipos de referencia del circuito: `pozo/Circuito/juridicoPozo.html` y `secretariaPozo.html`.
- Actuaciones a nombre del usuario de cada oficina (`/usuarios`, `TODO(login)`).

| Pantalla | Ruta | Prototipo |
| --- | --- | --- |
| Padrón: estadísticas, búsqueda (nombre, CUIT, localidad, director técnico, código de máquina), filtros Activas / Pendientes de resolución / De baja / Todas; dar de baja y reactivar | `/pozo/empresas` → `EmpresasPage` | `GestionEmpresas.html` |
| Alta **por pasos**: 1. datos (tipo de persona, domicilio fiscal, convenio multilateral, dirección técnica, documentación), 2. **parque de máquinas** → Enviar a Jurídico | `/pozo/empresas/nueva` → `NuevaEmpresaPage` | `AgregarEmpresa.html` |
| Revisión de Jurídico / Secretaría General | `/pozo/empresas/:id/revision` → `RevisionEmpresaPage` | `pozo/Circuito/juridicoPozo.html`, `secretariaPozo.html` |
| Ficha: pestañas **Datos** (modificación), **Máquinas** (alta / modificación / baja / reactivación de cada una) e **Historial** | `/pozo/empresas/:id` → `EmpresaPage` | `AgregarEmpresa.html?id=` |

**API (json-server), un recurso por entidad** como en el modelo (`emp_empresa`, `emp_maquina`, auditoría):

| Recurso | Contenido | Relación |
| --- | --- | --- |
| `/empresas` | datos de la empresa, estado, baja, autoría (`creado`/`creadoPor`, `modificado`/`modificadoPor`) | — |
| `/maquinas` | cada máquina (código, datos técnicos, foto, `activa`, baja) | `empresaId` |
| `/movimientosEmpresas` | historial: tipo, fecha, usuario, motivo y campos cambiados | `empresaId`, `maquinaId` |

- Lecturas: padrón `GET /empresas?_embed=maquinas`; ficha `GET /empresas/:id?_embed=maquinas&_embed=movimientosEmpresas`.
- Escrituras: alta = `POST /empresas` + `POST /maquinas` (una por máquina) + `POST /movimientosEmpresas`;
  modificación / baja / reactivación = `PATCH /empresas/:id` + movimiento; máquina = `POST` o `PATCH /maquinas/:id` +
  movimiento (y la autoría de la empresa). Nunca `DELETE` (baja lógica).
- Unicidad consultada al servidor: `GET /empresas?_where={cuit}` y `GET /maquinas?_where={codigo in}&_embed=empresa`.
- Con el backend real cada operación es una transacción y el 409 lo responde el servidor.
- `build-db` separa en estos tres recursos una base que tenía la colección vieja `empresasPerforadoras` (todo embebido).

Reglas (DRF «Documentacion PH», `ModeloDeDatos.md` §5 y `DRF_Usuarios_Permisos_Auditoria.md`):
- **Estados**: `EN_TRAMITE` (en Jurídico o en Secretaría General; en Secretaría es la «pendiente de resolución» del
  flujo 16.1.1), `OBSERVADA`, `RECHAZADA`, `ACTIVA` (con resolución) y `BAJA` (baja lógica con motivo; RN-A04
  reemplaza el «eliminar» del CU). La reactivación conserva la baja anterior en `bajasPrevias`. La resolución la carga
  Secretaría General (no está en el formulario de alta).
- **CUIT/CUIL**: 11 dígitos con dígito verificador (flujo 6.1) y único (flujo 10.1: «La empresa ya se encuentra
  registrada con esta CUIT»). Persona jurídica → razón social; física → nombre y apellido (flujo 5.1).
- **Máquinas** (`emp_maquina`): código de referencia de la DRH (ej. `EQP-001-A`) **único en todo el sistema** y
  que no se reutiliza aunque la máquina esté de baja; modelo, diámetro, profundidad, torre, vehículo y **foto**
  obligatoria (RN-07; JPG/PNG/WEBP hasta 5 MB, flujo 7.2). En la demo la foto se guarda reducida (800 px) dentro del
  registro; con el backend real se sube el archivo.
- **RN-11**: el alta exige al menos una máquina con código y foto. **RN-10**: solo puede solicitar autorizaciones
  una empresa activa, con resolución y al menos una máquina activa con código y foto; el padrón y la ficha avisan
  el motivo si no puede (y al dar de baja la última máquina válida).
- **Historial (RF22)**: cada alta, modificación (qué campo cambió, de qué valor a cuál, y el motivo), baja y
  reactivación —de la empresa y de cada máquina— queda con fecha y usuario.
- Departamento / localidad salen del catálogo oficial si la provincia es Tucumán; otras provincias, texto libre.
- Datos demo: `mock-server/empresasDemo.mjs` (5 empresas: activas, una pendiente de resolución, una con convenio
  multilateral, una con máquina de baja y una dada de baja). `build-db` la agrega a una base existente.
- Pendiente: «Buscar resolución» (vincular contra un registro de resoluciones de Secretaría General: hoy se tipea
  N° y año), usuario real (`USUARIO_ACTUAL`, `TODO(login)`) y usar el padrón en la Autorización de pozo.
- Componente nuevo compartido: `components/ui/Modal` (ventana para formularios).

### 2.11 Piezas compartidas nuevas para trámites sobre una concesión

- `shared/components/InicioSobreConcesion` — paso 1 completo (búsqueda + asignar expediente). Lo usan Cambio y Anulación.
- **N° de expediente = número / repartición / año** (`shared/schemas/expediente.ts` + `NumeroExpedienteFields`): tres campos,
  repartición precargada con la de la DRH (332, editable) y año fijo en el año en curso. Se guarda como `"123/332-2026"`
  (sin ceros a la izquierda); los esquemas de inicio lo arman con `transform`, así las APIs siguen recibiendo `numeroExpediente`.
  Lo usan el inicio del Alta y el de los trámites sobre una concesión. `build-db` migra los números viejos de 6 dígitos.
- `shared/inicioSobreConcesion.ts` — schema del paso 1 + `validarInicioSobreConcesion` (expediente libre, concesión
  vigente, sin trámite en curso).
- `shared/etapas/cierre.ts` — `bloqueoDeCierre`.
- `concesionesApi.anular` — baja lógica.

### 2.12 Arreglos hechos de paso

- `formatearFecha` mostraba un día menos en fechas `AAAA-MM-DD` (las tomaba como UTC). Afectaba también al Alta.
- `PolygonPreviewMap` tiraba `_leaflet_pos` en desarrollo (doble montaje de StrictMode).
- Datos demo: antes no había ninguna concesión vigente (los finalizados eran de otros trámites).
- Datos demo: los trámites sobre una concesión apuntaban a concesiones otorgadas *después* de que empezara el trámite.
  Ahora cada uno toma una concesión otorgada antes (y si no hay, se corren sus fechas). Hay una anulación terminada
  de ejemplo con su concesión anulada.
- `build-db.mjs --out=<archivo>` genera la base en otro archivo, para probar la semilla sin pisar el `db.json` en uso.

---

## 3. Decisiones pendientes / deuda conocida

### Cambio de Titularidad con el backend real (revisado el 20/11/2026)

El circuito completo ya usa el backend (inicio → nuevo titular → Recaudación → Distrito → Jurídico → Secretaría →
verificación final). La lista detallada de pendientes está en el backend:
`backend/src/tramites/cambio-titularidad/README.md`, sección «Pendiente». Lo que toca al frontend:

- **Historial de dueños en la ficha de la concesión**: el backend lo guarda, falta exponerlo y mostrarlo.
- **Observar y corregir**: Distrito y Jurídico solo ofrecen «Apto / No apto»; no hay `reenviar` ni panel de
  CORRECCIÓN en `CircuitoCambioPage` (a definir con la oficina).
- **Cierre**: completar correo y teléfono del nuevo titular en la verificación final.
- **Acoplamiento**: `CambioDeTitularidad` importa `DondeEsta`, `HistorialAlta`, `AvisoDeuda`, `Campo`, `altaKeys` y
  `titularesADto` desde `AltaDeConcesion/`. Moverlos a `features/tramites/shared/`.
- **Sacar lo viejo de json-server**: `GestionCambioTitularidadPage`, `etapas/` y la ruta `cambio-titularidad/expediente/:id`.

### Notas de la etapa json-server (anteriores al backend real)

1. **Sin transacción en el cierre del cambio**: primero se actualiza la concesión y después se cierra el expediente.
   Si lo segundo falla y se reintenta, los titulares anteriores quedarían duplicados. Con el backend real: una sola operación.
2. **"Observar y devolver" en el cierre** (de `CierredeTramite.html`, no enlazado) no está implementado, ni en el Alta.
3. **Cancelar un trámite ya enviado** (no un borrador): no existe todavía en ningún trámite.
4. El N° de expediente del Alta no se valida contra los cambios de titularidad en carga (al revés sí).
5. Los demás trámites de ejemplo (anulación, reubicación, etc.) todavía no tienen `concesionOrigenId` ni `datos`.
6. La vista de solo lectura dentro del circuito (expediente finalizado) muestra el historial pero no los datos propios
   del trámite; para eso está la consulta `/catastro/busqueda/expediente/:id`.
7. **La concesión es el expediente de alta**: al cambiar de titular se actualiza ese expediente, así que la consulta del
   alta muestra el titular *actual*. La cadena completa está en el historial de la concesión. Con el backend real
   (`con_concesion` + `con_titular`) se separa.
8. Las fechas de los movimientos las pone el navegador; en el backend real las fija el servidor (RN-A11).
9. Sin login, «tomó» lo firma el primer usuario de cada oficina (`TODO(login)`).
10. **Subdivisión**: las concesiones nuevas se guardan como altas finalizadas y comparten el N° de expediente de la
    subdivisión (aparecen en Seguimiento como «Alta de Concesión»). Con el backend real la concesión es un recurso propio.
11. **Subdivisión, pendiente del prototipo**: dictamen *por fracción* en Distrito y Jurídico (hoy es uno general, como en
    los demás trámites), cargar un KML del lote madre en el editor (hoy el polígono sale de la concesión), exportar
    GeoJSON e imán a aristas (hoy solo a vértices).

---

## 4. Próximo: Reubicación

**Flujo (infotecnica 6.7):** búsqueda → selección → visualización de datos actuales (ubicación, padrón, forma de
servicio) → checklist documental → **motivo de reubicación** → ajuste del polígono y forma de servicio → **historial de
ubicación anterior conservado** → Recaudación → Distrito → Jurídico → Secretaría General → cierre en Catastro.

**Prototipo** (`../reubicacion/`): `inicioTramite.html`, `nuevoPoligono.html`, `revision.html`, `finalizarCarga.html`,
`recaudacion.html`, `distrito.html`, `juridico.html`, `secretariaGenral.html`.

**Qué se reutiliza:** `InicioSobreConcesion`, `EditorPoligonoMap` (ahora con un polígono nuevo, no escalado),
`KmlUploadField`, `CascadaUbicacionFields` (nueva ubicación), `SuministroFields` (forma de servicio), etapas
compartidas, `bloqueoDeCierre`, `ConfigTramite.Detalle` y el patrón de historial (`ubicacionesAnteriores`, como
`superficiesAnteriores`).

**Orden sugerido después:** Permisos → Pozo. (Subdivisión ya está: ver 2.10.)

---

## 5. Otros pendientes (fuera de los trámites)

- **Login y roles**: buscar `TODO(login)` (Sidebar, Topnav, BandejaOficina, hooks, NotificacionesProvider, api client). `NavItem.roles` ya está cargado.
- **Bandeja de Catastro** (`BandejaCatastroPage`) sigue en placeholder (las devoluciones a Catastro para cierre hoy se ven en Seguimiento).
- **Bandeja de Catastro**: funciona (pedidos de N° de concesión + expedientes para cierre).
- **Búsqueda general** (`/busqueda`, prototipos `../busqueda/`): sigue en placeholder. La de Catastro ya está (ver 2.7).
- **Visor**: unificar `../visor.html` y `../visor2.html`; los expedientes demo ya tienen polígono.
- **Carga en padrón de Rentas**: existe el flag `padronRentasPendiente`; falta la pantalla (`../busqueda/cargaPadronDeRentas.html`).
- **Dashboard** con KPIs.

---

## 6. Checklist para migrar un trámite

- [ ] Leer infotecnica (sección 6.x) y los HTML del prototipo.
- [ ] Rutas en `config/routes.ts` + `RUTA_TRAMITE` / `RUTA_GESTION` en `config/tramites.ts`.
- [ ] Carpeta `features/tramites/<Tramite>/` con `routes.tsx`, `pages/`, `schemas.ts`, `api.ts`, `hooks.ts`, `types.ts`.
- [ ] Reusar bloques de `tramites/shared/` (no duplicar campos).
- [ ] `etapas/config.ts` con la `ConfigTramite` + cierre propio + `pages/GestionXxxPage.tsx` con `<GestionExpediente>`.
- [ ] Si parte de una concesión: `BuscadorConcesion`, `concesionOrigenId`, validar que no tenga otro trámite en curso.
- [ ] Datos de referencia nuevos → `seed/dominio.json` (no hardcodear), y `npm run mock:reset`.
- [ ] Datos demo en `build-db.mjs`.
- [ ] Modo claro/oscuro, estados de carga/error/vacío.
- [ ] `npm run typecheck`.
- [ ] Probar el circuito completo y actualizar **este archivo**.

---

## 7. Historial de avances

| Fecha | Commit | Avance |
| --- | --- | --- |
| 30/09/2026 | `b67e9b4` | Proyecto React creado. Pases entre oficinas + avisos en vivo + Alta de Concesión completa. |
| 30/09/2026 | — | Etapas del circuito compartidas, módulo de concesiones vigentes y **Cambio de Titularidad** completo. |
| 30/09/2026 | — | Cambio de Titularidad fiel al prototipo (búsqueda → asignar expediente → pre-carga). |
| 30/09/2026 | — | Trazabilidad: recepciones («tomó el expediente»), historial legible, buscador general e historial de la concesión. |
| 30/09/2026 | — | Cambio de Titularidad: carga final del titular al terminar el circuito (con resolución); hasta ahí sigue el titular actual. |
| 01/10/2026 | — | **Anulación** completa (baja lógica al cierre). Inicio y reglas de cierre compartidos entre trámites sobre una concesión. |
| 01/10/2026 | — | **Reducción / Ampliación** completa: editor de polígono, recálculo del caudal e historial de superficies. |
| 01/10/2026 | — | Inicio de trámites sobre una concesión: la búsqueda arranca vacía y se hace en el servidor, paginada. |
| 01/10/2026 | — | N° de expediente en tres partes (número / repartición / año en curso) en todos los inicios de trámite. |
| 01/10/2026 | — | **Subdivisión** completa: editor de fracciones, datos por fracción, N° de concesión por fracción y cierre con concesiones nuevas. |
| 01/10/2026 | — | **Pozo — Empresas perforadoras**: padrón, alta, modificación con historial, baja/reactivación y ABM de máquinas (RN-10/RN-11). |
| 20/11/2026 | — | Unidas en `dev` las ramas `alta-concecion` (Distrito/Jurídico, número a Catastro, pendientes de padrón) y `cambioTitularidad` (circuito completo con el backend real). Pendientes anotados en la sección 3. |
