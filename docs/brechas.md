# Brechas técnicas — LIMS-BioPuna

Documento de seguimiento de las 7 brechas técnicas abordadas en la rama `modificaciones` y su estado.  
**Nota:** los cambios de código fueron integrados a `main` (commit de merge `b99bd26`); el despliegue efectivo depende de Vercel/Render y de la aplicación de migraciones pendientes en la base compartida (Supabase).

## Resumen

| # | Brecha | Estado | Implementación principal | Migración | Observaciones |
|---|---|---|---|---|---|
| 1 | Catálogo de especies incorrecto/incompleto | Resuelto y publicado (previo) | Reemplazo `Ovino`→`Oveja`, agregado `Caballo`, CHECK estático | `007_especies_oveja_caballo.sql` | Publicado en `main` (`007fd26`) y verificado; especies finales: `Llama, Vicuña, Oveja, Caballo`. |
| 2 | Un ensayo debía corresponder a una sola tira/carril | Resuelto (integrado) | Validación/guardado limitado a 1 carril, UI ajustada, sin `n_carriles` | — | Sin cambio de esquema; aviso si se detectan varias tiras. |
| 3 | Nombres de fracciones rígidos/no genéricos | Resuelto (integrado) | 5–6 zonas → nombres clásicos automáticos; otros casos → `Fracción N` (1..20); nombres editables; cálculo A/G tolerante | `008_fracciones_nombre_generico.sql` | **Pendiente aplicar en Supabase.** |
| 4 | `fecha_corrida` podía ser anterior a la extracción | Resuelto (integrado) | Validación en backend/servicio y trigger en DB (`>=` extracción) | `009_fecha_corrida_no_antes_extraccion.sql` | **Pendiente aplicar en Supabase.** Rechaza corrida anterior; permite igual. |
| 5 | Falta de RLS en geografía y control de roles en backend | Resuelto (integrado) | RLS/políticas en `provincia`/`departamento`; `exigir_escritura` (admin/investigador) y `exigir_admin` | `010_rls_geografia_roles.sql` | **Pendiente aplicar en Supabase.** Rol `lectura` bloqueado para escrituras (403). |
| 6 | Sin administración de usuarios/roles desde la app | Resuelto (integrado) | Pantalla `/admin/usuarios` (listar, crear, editar nombre/rol) con Auth Admin + perfil; guardias de rol y rol visible en UI | — | Solo `admin`; salvaguardas (no auto-degradarse / no dejar sistema sin admin). |
| 7 | Inconsistencia en borrado PostgREST + Cloudinary | Resuelto (integrado) | `DELETE /ensayos/{id}` (admin) y UI de borrado: borra en DB (fracciones por cascade) y limpia imagen Cloudinary derivando `public_id` (best effort) | — | DB como fuente de verdad; `public_id` no persistido (derivado desde URL). |

## Ajuste adicional realizado (fuera de las 7 brechas originales)

| Cambio | Estado | Implementación | Migración | Observaciones |
|---|---|---|---|---|
| Eliminación de `url_foto_campo` en muestras | Resuelto (integrado) | Campo quitado de UI, esquemas, API y tipos (referencia URL externa sin uso/flujo de subida) | `011_quitar_foto_campo_muestra.sql` | **Pendiente aplicar en Supabase.** 0 muestras con valor previo; la migración recrea `muestra_con_estado`. |

## Pendientes operativos

1. **Aplicar migraciones en Supabase (base compartida), en orden:** `008`, `009`, `010`, `011`.
2. **Verificar despliegue** (Vercel/Render) con el código en `main` y las migraciones aplicadas.
3. **Documentación académica adicional:** diagramas PlantUML y diccionario de datos incorporados en `docs/` (este trabajo). Revisar/ajustar si la cátedra exige un formato o contenido específico distinto.
4. **Pedidos posteriores (analizados, no implementados):** foto del lugar en “Nueva campaña” con coordenadas (captura/subida y obtención por EXIF y/o geolocalización) — requiere Fase A de diseño y migración.

## Trazabilidad de commits relevantes (rama `modificaciones` → `main`)

- `81b118d` feat: limitar análisis y guardado a una sola tira por ensayo (P2)
- `1a28ded` feat: usar nombres genéricos de fracciones por defecto (P3)
- `0e89158` fix: clasificar automáticamente fracciones en 5 o 6 zonas (P3)
- `ff3e0b5` feat: validar que la fecha de corrida no sea anterior a la extracción (P4)
- `fa68b24` feat: reforzar RLS de geografía y control de roles en backend (P5)
- `4e559e4` feat: agregar administración de usuarios y roles para admin (P6)
- `7300373` feat: agregar borrado de ensayos para admin con limpieza en Cloudinary (P7)
- `96c22ca` refactor: quitar `url_foto_campo` de muestras y agregar migración 011
- `b99bd26` merge: integrar puntos 2-7 y ajustes en main
