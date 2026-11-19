# Diccionario de Datos — LIMS-BioPuna

> Estado del modelo reflejado según migraciones `001` a `011` y esquemas/servicios actuales del repositorio.  
> Nota: migraciones `008`, `009`, `010` y `011` deben estar aplicadas en la base para que el esquema físico coincida plenamente con este diccionario (el código actual ya asume estos cambios).

## 1. Tablas

### 1.1 `investigador`
Perfil de usuario del sistema, vinculado a Supabase Auth.

| Columna | Tipo | Nulo | Default / Restricción | Descripción |
|---|---|---|---|---|
| `id_investigador` | `uuid` | No | PK, FK `auth.users(id)` ON DELETE CASCADE | Identificador del usuario (igual al de Auth). |
| `nombre` | `text` | No |  | Nombre visible del investigador/usuario. |
| `email` | `text` | No | UNIQUE | Correo del usuario. |
| `rol_catedra` | `text` | Sí |  | Rol académico/cátedra (informativo). |
| `rol_sistema` | `text` | No | `lectura`; CHECK `admin|investigador|lectura` | Rol de permisos en la aplicación. |
| `creado_en` | `timestamptz` | No | `now()` | Fecha de creación del perfil. |

**Notas:** trigger `al_crear_usuario` crea el perfil con rol `lectura`. RLS: lectura autenticados; actualización solo `admin` (002).

### 1.2 `provincia`
Catálogo geográfico (Puna).

| Columna | Tipo | Nulo | Default / Restricción | Descripción |
|---|---|---|---|---|
| `id_provincia` | `smallint` | No | PK, identity | Identificador de provincia. |
| `nombre` | `text` | No | UNIQUE | Nombre de la provincia. |

**RLS (010):** lectura autenticados; escritura/actualización/borrado solo `admin`.

### 1.3 `departamento`
Catálogo geográfico dependiente de provincia.

| Columna | Tipo | Nulo | Default / Restricción | Descripción |
|---|---|---|---|---|
| `id_departamento` | `smallint` | No | PK, identity | Identificador de departamento. |
| `id_provincia` | `smallint` | No | FK `provincia(id_provincia)` | Provincia a la que pertenece. |
| `nombre` | `text` | No | UNIQUE `(id_provincia, nombre)` | Nombre del departamento. |

**Índices:** `departamento_provincia_idx` (`id_provincia`). **RLS (010):** igual que provincia.

### 1.4 `campana_territorio`
Campaña/salida de muestreo en territorio.

| Columna | Tipo | Nulo | Default / Restricción | Descripción |
|---|---|---|---|---|
| `id_campana` | `bigint` | No | PK, identity | Identificador de campaña. |
| `localidad_puna` | `text` | Sí | (NOT NULL inicial en 001, relajado en 005) | Texto legible/compatibilidad de ubicación. |
| `fecha_salida` | `date` | No |  | Fecha de salida a terreno. |
| `convenio_inta` | `boolean` | No | `false` | Indica si la campaña es en convenio con INTA. |
| `observaciones` | `text` | Sí |  | Observaciones libres. |
| `id_departamento` | `smallint` | Sí | FK `departamento(id_departamento)` (005) | Departamento de la campaña. |
| `localidad_detalle` | `text` | Sí | (005) | Detalle/paraje/localidad libre. |
| `creado_por` | `uuid` | Sí | FK `investigador(id_investigador)`, default `auth.uid()` (004) | Usuario que registró la campaña. |
| `creado_en` | `timestamptz` | No | `now()` (004) | Fecha de creación del registro. |

**Índices:** `campana_departamento_idx`, `campana_territorio_creado_por_idx`.

### 1.5 `muestra_animal`
Muestra biológica extraída en una campaña.

| Columna | Tipo | Nulo | Default / Restricción | Descripción |
|---|---|---|---|---|
| `id_muestra` | `bigint` | No | PK, identity | Identificador de muestra. |
| `id_campana` | `bigint` | No | FK `campana_territorio(id_campana)` | Campaña a la que pertenece. |
| `codigo_animal` | `text` | No |  | Código/identificador del animal. |
| `especie` | `text` | No | CHECK `Llama|Vicuña|Oveja|Caballo` (007) | Especie del animal. |
| `fecha_hora_extraccion` | `timestamptz` | No |  | Fecha y hora de extracción de la muestra. |
| `creado_por` | `uuid` | Sí | FK `investigador`, default `auth.uid()` (004) | Usuario que registró la muestra. |
| `creado_en` | `timestamptz` | No | `now()` (004) | Fecha de creación del registro. |

**Restricciones:** UNIQUE `(id_campana, codigo_animal)`. **Índices:** por `id_campana`, `muestra_animal_creado_por_idx`.  
**Cambios:** `url_foto_campo` eliminado en 011 (antes: URL opcional de foto de campo, sin flujo de subida en app).

### 1.6 `ensayo_electroforetico`
Ensayo/corrida electroforética asociada a una muestra.

| Columna | Tipo | Nulo | Default / Restricción | Descripción |
|---|---|---|---|---|
| `id_ensayo` | `bigint` | No | PK, identity | Identificador de ensayo. |
| `id_muestra` | `bigint` | No | FK `muestra_animal(id_muestra)` | Muestra analizada. |
| `id_investigador` | `uuid` | No | FK `investigador(id_investigador)` | Investigador responsable (asignado desde sesión). |
| `fecha_corrida` | `timestamptz` | No | `now()` | Fecha/hora de la corrida. |
| `proteinas_totales_g_dl` | `numeric(4,2)` | No | CHECK `> 0 AND <= 20` | Proteínas totales ingresadas (g/dL). |
| `url_imagen_tira` | `text` | Sí |  | URL de la imagen de la tira en Cloudinary. |
| `metodo_lectura` | `text` | No | `digital_opencv`; CHECK `digital_opencv|espectrofotometro` | Método de lectura/análisis. |
| `relacion_ag` | `double precision` | Sí | (006) | Relación Albúmina/Globulina (derivada). |
| `creado_por` | `uuid` | Sí | FK `investigador`, default `auth.uid()` (004) | Usuario que registró el ensayo. |
| `creado_en` | `timestamptz` | No | `now()` (004) | Fecha de creación del registro. |

**Índices:** por `id_muestra`, `id_investigador`, `ensayo_electroforetico_creado_por_idx`.  
**Reglas:** trigger `trg_validar_fecha_corrida_ensayo` (009) exige `fecha_corrida >= fecha_hora_extraccion` de la muestra. En backend se valida lo mismo y se limita a una sola tira/carril por ensayo.

### 1.7 `fraccion_proteica`
Fracciones proteicas resultantes de un ensayo.

| Columna | Tipo | Nulo | Default / Restricción | Descripción |
|---|---|---|---|---|
| `id_fraccion` | `bigint` | No | PK, identity | Identificador de fracción. |
| `id_ensayo` | `bigint` | No | FK `ensayo_electroforetico(id_ensayo)` ON DELETE CASCADE | Ensayo al que pertenece. |
| `nombre_fraccion` | `text` | No | CHECK nombres clásicos o `Fracción 1..20` (008) | Nombre de la fracción. |
| `area_integrada` | `numeric` | No |  | Área integrada de la fracción. |
| `porcentaje_relativo` | `numeric(5,2)` | No | CHECK `[0,100]` | Porcentaje relativo. |
| `concentracion_g_dl` | `numeric(5,2)` | No |  | Concentración estimada (g/dL). |

**Restricciones:** UNIQUE `(id_ensayo, nombre_fraccion)`. **Índice:** por `id_ensayo`.  
**Nombres válidos (008):** `Albumina, Alfa1, Alfa2, Beta, Beta1, Beta2, Gamma` o patrón `^Fracción (?:[1-9]|1[0-9]|20)$`.

## 2. Vistas

### 2.1 `muestra_con_estado`
Vista de apoyo para el semáforo de 48 h (definida en 001, ajustada en 004 y 011). `security_invoker = true`.

| Columna | Tipo | Descripción |
|---|---|---|
| `id_muestra` | `bigint` | Identificador de muestra. |
| `id_campana` | `bigint` | Campaña asociada. |
| `codigo_animal` | `text` | Código del animal. |
| `especie` | `text` | Especie. |
| `fecha_hora_extraccion` | `timestamptz` | Momento de extracción. |
| `primera_corrida` | `timestamptz` | Mínima `fecha_corrida` de sus ensayos (si existe). |
| `horas_transcurridas` | `numeric` | Horas entre extracción y primera corrida (o `now()` si no hay). |
| `estado_48h` | `text` | `procesada` si hay corrida; si no: `verde` (<24 h), `amarillo` (24–40 h), `rojo` (>40 h). |
| `creado_por` | `uuid` | Auditoría de la muestra. |
| `creado_en` | `timestamptz` | Auditoría de la muestra. |

## 3. Funciones y triggers relevantes

| Objeto | Tipo | Descripción |
|---|---|---|
| `public.rol_actual()` | función (002) | Devuelve `rol_sistema` del usuario autenticado (`auth.uid()`), `security definer`. Usada por políticas RLS. |
| `public.crear_perfil_investigador()` | función + trigger (002) | Crea perfil en `investigador` al insertar en `auth.users` (rol inicial `lectura`). |
| `public.validar_fecha_corrida_ensayo()` | función + trigger (009) | Impide `fecha_corrida < fecha_hora_extraccion` de la muestra asociada (insert/update). |

## 4. Roles y seguridad (resumen)

- **Roles de sistema (`investigador.rol_sistema`):** `admin`, `investigador`, `lectura`.
- **RLS:** habilitado en tablas de negocio y, desde 010, en `provincia` y `departamento`. Políticas base en 002 (lectura autenticados; creación/edición operativa admin/investigador según tabla; borrado admin). Geografía: solo `admin` modifica.
- **Backend (control adicional):** `exigir_escritura` permite `admin|investigador` y bloquea `lectura`; `exigir_admin` restringe operaciones administrativas (gestión de usuarios, borrado de ensayos).
- **Borrado de ensayos:** endpoint admin elimina en DB (fracciones por cascade) y luego intenta limpiar imagen en Cloudinary (best effort, `public_id` derivado de URL).

## 5. Enumeraciones / dominios lógicos

| Dominio | Valores | Uso |
|---|---|---|
| `rol_sistema` | `admin`, `investigador`, `lectura` | Permisos de usuario. |
| `especie` | `Llama`, `Vicuña`, `Oveja`, `Caballo` | `muestra_animal.especie`. |
| `metodo_lectura` | `digital_opencv`, `espectrofotometro` | `ensayo_electroforetico.metodo_lectura`. |
| `estado_48h` | `verde`, `amarillo`, `rojo`, `procesada` | Calculado en `muestra_con_estado`. |
| `nombre_fraccion` | Clásicos o `Fracción 1..20` | `fraccion_proteica.nombre_fraccion`. |
