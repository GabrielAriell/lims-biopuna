# Personalización de estilos (LIMS-BioPuna)

Esta carpeta reúne los puntos principales para cambiar colores, fondos, botones e imágenes **sin buscar en todo el proyecto**.

## Cómo se aplica
- `frontend/app/globals.css` importa `../estilos-personalizables/colores-y-fondos.css` y `../estilos-personalizables/botones.css`.
- Los cambios en esos archivos afectan a toda la app (después de recargar el frontend).

## 1) Cambiar colores y fondo
Archivo: `colores-y-fondos.css`
- Variables en `:root`: `--fondo-app`, `--texto-app`, `--color-primario`, etc.
- **Fondo de color:** cambiá `--fondo-app`.
- **Fondo con imagen:**
  1. Colocá la imagen en `frontend/public/` (ejemplo: `frontend/public/fondo.jpg`).
  2. Descomentá el bloque `body { background-image: url("/fondo.jpg"); ... }` y ajustá la ruta/tamaño.
- **Degradado:** descomentá el ejemplo de `linear-gradient`.

> Nota: muchas pantallas usan `bg-gray-50`/`bg-white` en clases de Tailwind. Si querés que el fondo global se vea detrás de todo, habrá que reemplazar esos fondos por variables o clases personalizadas en los componentes/páginas (ver sección 4).

## 2) Cambiar estilo de botones
Archivo: `botones.css`
- Ajustá `.btn-primario`, `.btn-secundario`, `.btn-peligro` (colores, bordes, radios, hover).
- Podés crear nuevas clases (ej. `.btn-mi-estilo`) y usarlas en los componentes.

### Dónde se usan botones hoy (clases Tailwind directas)
Los botones están definidos en cada componente/página con clases como `bg-blue-600 text-white ...`. Para unificar estilos:
- buscá `bg-blue-600` (botón primario más común) y `border border-gray-300` (secundarios),
- o reemplazá por clases de `botones.css` (ej. `className="btn-primario px-4 py-2"`).

Archivos con muchos botones/acciones:
- `frontend/app/login/page.tsx`
- `frontend/app/muestras/PaginaMuestrasCliente.tsx`
- `frontend/app/exploracion/ExploracionCliente.tsx`
- `frontend/app/muestras/[idMuestra]/DetalleMuestraCliente.tsx`
- `frontend/components/FormularioCampana.tsx`, `FormularioMuestra.tsx`, `FormularioTira.tsx`
- `frontend/components/PanelGuardarEnsayo.tsx`, `SelectorMuestra.tsx`, `Encabezado.tsx`, `NuevoEnsayo.tsx`
- `frontend/components/AnalisisTira.tsx`

## 3) Imágenes (fondos, logos, etc.)
- **Imágenes públicas:** `frontend/public/` → se referencian como `/nombre.ext` (ej. `/logo.png`, `/fondo.jpg`).
- **Logo/título:** editar `frontend/components/Encabezado.tsx` y `frontend/app/login/page.tsx`.
- **Fondo de toda la app:** `colores-y-fondos.css` (sección body) + imagen en `public/`.

## 4) Dónde tocar para cambios específicos
| Qué querés cambiar | Dónde |
|---|---|
| Fondo global, colores base, variables | `estilos-personalizables/colores-y-fondos.css`, `app/globals.css` |
| Estilos de botones reutilizables | `estilos-personalizables/botones.css` |
| Tipografía global | `app/layout.tsx` (fuentes Geist) y `app/globals.css` (`body font-family`) |
| Encabezado/menú y textos | `components/Encabezado.tsx` |
| Login (diseño/cuentas de prueba visibles) | `app/login/page.tsx` |
| Exploración (filtros/tablas/tarjetas) | `app/exploracion/ExploracionCliente.tsx` |
| Muestras y campañas (semáforo/formularios) | `app/muestras/PaginaMuestrasCliente.tsx`, `components/FormularioCampana.tsx`, `components/FormularioMuestra.tsx` |
| Detalle de muestra | `app/muestras/[idMuestra]/DetalleMuestraCliente.tsx` |
| Nuevo ensayo / análisis | `components/NuevoEnsayo.tsx`, `components/AnalisisTira.tsx`, `components/PanelGuardarEnsayo.tsx`, `components/SelectorMuestra.tsx`, `components/FormularioTira.tsx` |
| Componentes UI pequeños | `components/Semaforo.tsx`, `components/BotonAvisos.tsx`, `components/PanelAvisos.tsx`, `components/TablaMuestras.tsx` |

## 5) Cambiar textos y mover elementos de lugar
Ver **`textos-y-ubicacion.md`** en esta misma carpeta:
- dónde editar títulos, etiquetas, botones y mensajes,
- cómo cambiar el orden/posición (JSX + clases Tailwind como `flex`, `justify-*`, `items-*`, `text-center`, `grid`, etc.),
- ejemplos (acortar textos, centrar, reordenar secciones).

## 6) Tailwind
El proyecto usa **Tailwind CSS** (v4) con `@import "tailwindcss"` en `globals.css`. Podés:
- usar clases utilitarias en los componentes (`bg-*`, `text-*`, `rounded-*`, `p-*`, etc.),
- o definir estilos/CSS variables en esta carpeta e importarlos desde `globals.css`.

Sugerencia: para cambios grandes y consistentes, centralizá colores en `colores-y-fondos.css` y luego reemplazá clases fijas (`bg-blue-600`, `bg-gray-50`, etc.) por clases que usen esas variables.
