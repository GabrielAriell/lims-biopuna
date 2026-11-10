# Textos y ubicación de elementos

## 1) Cambiar textos (títulos, botones, etiquetas)
Los textos están escritos directamente en los componentes/páginas (`.tsx`). Para cambiarlos:
1. Abrí el archivo indicado.
2. Buscá el texto exacto (Ctrl+F en VS Code) y editálo.
3. Guardá y recargá el frontend.

### Textos globales / muy visibles
| Texto / elemento | Archivo | Qué editar |
|---|---|---|
| Título de pestaña del navegador y descripción | `frontend/app/layout.tsx` | `metadata.title`, `metadata.description` |
| Nombre principal "LIMS-BioPuna" y subtítulo del encabezado | `frontend/components/Encabezado.tsx` | `<h1>...</h1>` y `<p>...</p>` |
| Textos del login (título, "Iniciar sesión", etiquetas, ayuda) | `frontend/app/login/page.tsx` | Strings dentro del JSX |
| "Exploración de datos" y descripción | `frontend/app/exploracion/ExploracionCliente.tsx` | `<h1>` y `<p>` iniciales |
| Títulos de secciones en Muestras y campañas | `frontend/app/muestras/PaginaMuestrasCliente.tsx` | "Semáforo de 48 horas", textos de aviso/enlace, etc. |
| Títulos en formularios | `frontend/components/FormularioCampana.tsx`, `frontend/components/FormularioMuestra.tsx` | `<h2>`, labels, placeholders, ayudas |
| "Nuevo ensayo" / "Análisis libre" y textos del flujo | `frontend/components/NuevoEnsayo.tsx`, `frontend/app/ensayos/nuevo/page.tsx`, `frontend/components/PanelGuardarEnsayo.tsx`, `frontend/components/SelectorMuestra.tsx` | Títulos, descripciones, botones |
| Detalle de muestra (títulos, etiquetas de tabla) | `frontend/app/muestras/[idMuestra]/DetalleMuestraCliente.tsx` | `<h1>`, `<h2>`, `<th>`, `<dt>`, textos de botones |
| Encabezados de tablas en exploración | `frontend/app/exploracion/ExploracionCliente.tsx` | `<th>...</th>` en ambas tablas |
| Estados/etiquetas del semáforo y avisos | `frontend/components/Semaforo.tsx`, `frontend/components/PanelAvisos.tsx`, `frontend/components/BotonAvisos.tsx` | Textos mostrados |

**Ejemplo:** si querés acortar "Muestras y campañas" a "Muestras" en el menú, cambiá el texto del `<Link>` en `frontend/components/Encabezado.tsx` (sección `nav`).

### Buscar cualquier texto rápido
- En VS Code: `Ctrl+Shift+F` y escribí la frase exacta (ej. `Muestras y campañas`).
- Limitá la búsqueda a `frontend/` para ir más rápido.

## 2) Cambiar ubicación/posición y orden
La posición se controla con **el orden del JSX** y las **clases de Tailwind** (flex, grid, alineación, márgenes).

### Mover elementos cambiando el orden
En React/JSX, lo que está primero en el código aparece primero en la pantalla. Ejemplo:
```tsx
<div>
  <Titulo />
  <Descripcion />
  <Botones />
</div>
```
Si querés los botones arriba del título, mové `<Botones />` antes de `<Titulo />`.

### Clases útiles (Tailwind) para ubicar
- **Alineación de texto:** `text-left`, `text-center`, `text-right`
- **Flex (fila/columna):** `flex`, `flex-col`, `flex-row`, `flex-wrap`
- **Distribución:** `justify-start`, `justify-center`, `justify-between`, `justify-end`
- **Alineación vertical:** `items-start`, `items-center`, `items-end`
- **Separación:** `gap-2`, `gap-4`, `space-y-4`
- **Márgenes/padding:** `m-*`, `mt-*`, `mb-*`, `p-*`, `px-*`, `py-*`
- **Ancho/contenedor:** `max-w-6xl`, `mx-auto`, `w-full`
- **Responsive:** prefijos `sm:`, `md:`, `lg:` (ej. `flex-col sm:flex-row`)
- **Grid:** `grid`, `grid-cols-1`, `sm:grid-cols-2`, `lg:grid-cols-4`

### Ejemplos prácticos
- **Centrar el título del encabezado:** en `Encabezado.tsx` cambiar el contenedor a `items-center text-center` o agregar `text-center` al bloque del título.
- **Poner el menú debajo del título (otra disposición):** ajustar `header` a `flex-col` y el orden/alineación de los `<div>`.
- **Mover el semáforo antes/después de los formularios:** en `app/muestras/PaginaMuestrasCliente.tsx` cortar y pegar el `<section>` del semáforo y el `<div>` de formularios en el orden deseado.
- **Cambiar tarjetas de resumen de lado:** en `app/exploracion/ExploracionCliente.tsx` modificar el `grid` (columnas, orden) o reubicar el `<section>` de resumen.
- **Botones a la izquierda/derecha:** usar `justify-start` / `justify-end` / `justify-between` en el contenedor `flex` que los agrupa.

## 3) Dónde está cada "zona" principal
| Zona | Archivo(s) |
|---|---|
| Estructura HTML base, idioma, fuentes, título pestaña | `app/layout.tsx` |
| Estilos globales y fondo | `app/globals.css`, `estilos-personalizables/colores-y-fondos.css` |
| Barra superior (logo, nombre, menú, usuario/salir) | `components/Encabezado.tsx` |
| Pantalla de acceso | `app/login/page.tsx` |
| Página Muestras y campañas (semáforo, formularios, enlace a exploración) | `app/muestras/PaginaMuestrasCliente.tsx` |
| Página Exploración (resumen, filtros, tablas) | `app/exploracion/ExploracionCliente.tsx` |
| Página Detalle de muestra | `app/muestras/[idMuestra]/DetalleMuestraCliente.tsx` |
| Página Nuevo ensayo | `app/ensayos/nuevo/page.tsx`, `app/ensayos/nuevo/NuevoEnsayoVista.tsx`, `components/NuevoEnsayo.tsx` |

> Consejo: hacé cambios pequeños, guardá y recargá para ver el resultado. Si algo se rompe, podés deshacer con Ctrl+Z o revisar el cambio en git.