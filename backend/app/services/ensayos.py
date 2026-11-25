"""Guardado y lectura de ensayos electroforéticos.

El navegador manda el perfil de la tira y las zonas que confirmó el
investigador. Acá se recalculan las fracciones con ``limites.recalcular``:
nunca se confía en los porcentajes que vienen del cliente.

Un ensayo equivale a una sola tira: la base guarda un único juego de fracciones
por ensayo. Si falla la inserción de las fracciones se borra el ensayo recién
creado, porque PostgREST no permite una transacción entre varias llamadas.
"""
from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from app.schemas.ensayos import EnsayoIn
from app.services import cloudinary, limites, supabase_rest


class EnsayoInvalido(ValueError):
    """Los datos del ensayo no permiten guardarlo."""


class EnsayoNoEncontrado(LookupError):
    """El ensayo solicitado no existe."""


# Nombres canonicos aceptados (5 o 6 franjas): una sola Beta; Gamma se subdivide.
_NOMBRES_CANONICOS = {
    "Albumina",
    "Alfa1",
    "Alfa2",
    "Beta",
    "Gamma",
    "Gamma1",
    "Gamma2",
}

# Aliases tolerados -> nombre can?nico (acepta acentos, espacios, I/II, 1/2).
_ALIASES_FRACCION = {
    "albumina": "Albumina",
    "albumina": "Albumina",
    "alfa1": "Alfa1",
    "alfa 1": "Alfa1",
    "alfai": "Alfa1",
    "alfa i": "Alfa1",
    "alfa2": "Alfa2",
    "alfa 2": "Alfa2",
    "alfaii": "Alfa2",
    "alfa ii": "Alfa2",
    "beta": "Beta",
    "gamma": "Gamma",
    "gama": "Gamma",
    "gamma1": "Gamma1",
    "gamma 1": "Gamma1",
    "gammai": "Gamma1",
    "gamma i": "Gamma1",
    "gama1": "Gamma1",
    "gama 1": "Gamma1",
    "gamai": "Gamma1",
    "gama i": "Gamma1",
    "gamma2": "Gamma2",
    "gamma 2": "Gamma2",
    "gammaii": "Gamma2",
    "gamma ii": "Gamma2",
    "gama2": "Gamma2",
    "gama 2": "Gamma2",
    "gamaii": "Gamma2",
    "gama ii": "Gamma2",
}


def _normalizar_nombre_fraccion(nombre: str) -> str | None:
    limpio = " ".join(nombre.strip().split())
    canonico = _ALIASES_FRACCION.get(limpio.casefold())
    if canonico:
        return canonico
    return limpio if limpio in _NOMBRES_CANONICOS else None


def _nombre_fraccion_valido(nombre: str) -> bool:
    return _normalizar_nombre_fraccion(nombre) is not None


def _fracciones_desde_entrada(
    datos: EnsayoIn,
) -> tuple[list[dict[str, Any]], float | None]:
    """Valida la tira y devuelve sus fracciones finales y la relación A/G.

    Un ensayo equivale a una sola tira (el esquema lo garantiza). Recalcula
    siempre desde perfil/zonas para validar el perfil y los límites. Si el
    investigador envió fracciones editadas, se guardan esas (validadas) en
    lugar de las calculadas automáticamente.
    """
    carril = datos.carriles[0]
    try:
        calculo = limites.recalcular(
            carril.perfil, carril.zonas, datos.proteinas_totales
        )
    except ValueError as error:
        raise EnsayoInvalido(f"Tira: {error}") from error

    if len(carril.zonas) not in (5, 6):
        raise EnsayoInvalido("El ensayo debe tener 5 o 6 franjas")

    if carril.fracciones is not None:
        if len(carril.fracciones) != len(carril.zonas):
            raise EnsayoInvalido(
                "La cantidad de fracciones no coincide con las zonas"
            )
        filas = []
        for f in carril.fracciones:
            canonico = _normalizar_nombre_fraccion(f.nombre_fraccion)
            if not canonico:
                raise EnsayoInvalido(
                    "Nombre de fraccion invalido. Us?: Albumina, Alfa1, Alfa2, Beta, Gamma "
                    "y, solo en 6 franjas, Gamma1/Gamma2 (tambi?n se aceptan Alfa I/II, Gamma I/II)"
                )
            filas.append(
                {
                    "nombre_fraccion": canonico,
                    "area_integrada": round(float(f.area_integrada), 6),
                    "porcentaje_relativo": round(float(f.porcentaje_relativo), 2),
                    "concentracion_g_dl": round(float(f.concentracion_g_dl), 2),
                }
            )
    else:
        filas = []
        for fraccion in calculo.fracciones:
            canonico = _normalizar_nombre_fraccion(fraccion.nombre) or fraccion.nombre
            filas.append(
                {
                    "nombre_fraccion": canonico,
                    "area_integrada": round(float(fraccion.area), 6),
                    "porcentaje_relativo": round(float(fraccion.porcentaje), 2),
                    "concentracion_g_dl": round(
                        float(fraccion.concentracion_g_dl or 0), 2
                    ),
                }
            )

    if len(filas) not in (5, 6):
        raise EnsayoInvalido("El ensayo debe tener 5 o 6 franjas")

    relacion_ag = _relacion_ag_desde_fracciones(filas, datos.proteinas_totales)
    return filas, relacion_ag

def _relacion_ag_desde_fracciones(
    fracciones: list[dict[str, Any]], proteinas_totales_g_dl: float | None = None
) -> float | None:
    """Calcula A/G automáticamente desde fracciones.

    Se considera Albúmina la fracción nombrada como tal; si no hay, se toma la
    de mayor concentración/porcentaje (franja más intensa).
    """
    if not fracciones:
        return None

    def _num(valor: Any) -> float | None:
        try:
            n = float(valor)
        except (TypeError, ValueError):
            return None
        return n

    idx_albumina: int | None = None
    for i, f in enumerate(fracciones):
        nombre = str(f.get("nombre_fraccion") or "").lower()
        if "album" in nombre:
            idx_albumina = i
            break

    if idx_albumina is None:
        mejor = -1.0
        for i, f in enumerate(fracciones):
            v = _num(f.get("concentracion_g_dl"))
            if v is None:
                v = _num(f.get("porcentaje_relativo"))
            if v is None:
                v = _num(f.get("area_integrada"))
            if v is not None and v > mejor:
                mejor = v
                idx_albumina = i
        if mejor <= 0:
            idx_albumina = None

    if idx_albumina is None:
        return None

    albumina = _num(fracciones[idx_albumina].get("concentracion_g_dl"))
    if albumina is None or albumina <= 0:
        # fallback por porcentaje si no hay g/dL
        pct_alb = _num(fracciones[idx_albumina].get("porcentaje_relativo"))
        if pct_alb is not None and proteinas_totales_g_dl is not None:
            albumina = float(proteinas_totales_g_dl) * pct_alb / 100.0
    if albumina is None or albumina <= 0:
        return None

    globulinas = None
    try:
        if proteinas_totales_g_dl is not None:
            globulinas = float(proteinas_totales_g_dl) - albumina
    except (TypeError, ValueError):
        globulinas = None
    if globulinas is None or globulinas <= 0:
        suma = 0.0
        for i, f in enumerate(fracciones):
            if i == idx_albumina:
                continue
            v = _num(f.get("concentracion_g_dl"))
            if v is None and proteinas_totales_g_dl is not None:
                pct = _num(f.get("porcentaje_relativo"))
                if pct is not None:
                    v = float(proteinas_totales_g_dl) * pct / 100.0
            if v is not None:
                suma += v
        globulinas = suma if suma > 0 else None

    if globulinas is None or globulinas <= 0:
        return None
    return round(albumina / globulinas, 4)


def _filas_fracciones(
    id_ensayo: int, fracciones: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    return [{"id_ensayo": id_ensayo, **fraccion} for fraccion in fracciones]


def _a_datetime_aware(valor: Any) -> datetime | None:
    if valor is None:
        return None
    if isinstance(valor, datetime):
        dt = valor
    else:
        try:
            dt = datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _validar_fecha_corrida(datos: EnsayoIn) -> datetime | None:
    """Valida que la corrida no sea anterior a la extracción de la muestra.

    Devuelve la fecha efectiva (aware) a guardar, o None para usar el default
    now() de la base (que también se valida contra la extracción).
    """
    filas = supabase_rest.seleccionar(
        "muestra_animal",
        columnas="id_muestra,fecha_hora_extraccion",
        filtros=[("id_muestra", f"eq.{datos.id_muestra}")],
        limite=1,
    )
    if not filas:
        raise EnsayoInvalido("La muestra indicada no existe")

    extraccion = _a_datetime_aware(filas[0].get("fecha_hora_extraccion"))
    if extraccion is None:
        raise EnsayoInvalido("La muestra no tiene una fecha de extracción válida")

    efectiva = (
        _a_datetime_aware(datos.fecha_corrida)
        if datos.fecha_corrida is not None
        else datetime.now(timezone.utc)
    )
    if efectiva is None:
        raise EnsayoInvalido("La fecha de corrida no es válida")
    if efectiva < extraccion:
        raise EnsayoInvalido(
            "La fecha de corrida no puede ser anterior a la fecha de extracción de la muestra"
        )
    return _a_datetime_aware(datos.fecha_corrida) if datos.fecha_corrida is not None else None


def _salida(
    ensayo: dict[str, Any],
    fracciones: list[dict[str, Any]],
    investigadores: dict[str, str] | None = None,
) -> dict[str, Any]:
    inv = str(ensayo["id_investigador"])
    pt = float(ensayo["proteinas_totales_g_dl"]) if ensayo.get("proteinas_totales_g_dl") is not None else None
    relacion_ag = ensayo.get("relacion_ag")
    try:
        relacion_ag = float(relacion_ag) if relacion_ag is not None else None
    except (TypeError, ValueError):
        relacion_ag = None
    if relacion_ag is None:
        relacion_ag = _relacion_ag_desde_fracciones(fracciones, pt)
    return {
        "id_ensayo": ensayo["id_ensayo"],
        "id_muestra": ensayo["id_muestra"],
        "id_investigador": ensayo["id_investigador"],
        "investigador_nombre": (investigadores or {}).get(inv),
        "fecha_corrida": ensayo["fecha_corrida"],
        "proteinas_totales_g_dl": float(ensayo["proteinas_totales_g_dl"]),
        "relacion_ag": relacion_ag,
        "url_imagen_tira": ensayo.get("url_imagen_tira"),
        "metodo_lectura": ensayo.get("metodo_lectura", "digital_opencv"),
        "creado_por": ensayo.get("creado_por"),
        "creado_en": ensayo.get("creado_en"),
        "fracciones": [
            {
                "nombre_fraccion": fila["nombre_fraccion"],
                "area_integrada": float(fila["area_integrada"]),
                "porcentaje_relativo": float(fila["porcentaje_relativo"]),
                "concentracion_g_dl": float(fila["concentracion_g_dl"]),
            }
            for fila in fracciones
        ],
    }


def guardar(
    datos: EnsayoIn,
    id_investigador: str,
    imagen: tuple[bytes, str, str] | None = None,
) -> dict[str, Any]:
    """Valida, sube la imagen (si hay) e inserta ensayo + fracciones.

    Se recalcula desde perfil/zonas para validar; si el investigador envió
    fracciones editadas se guardan esas (validadas) como resultado final.
    La fecha de corrida no puede ser anterior a la extracción de la muestra.
    """
    fracciones, relacion_ag = _fracciones_desde_entrada(datos)
    fecha_corrida = _validar_fecha_corrida(datos)

    subida: dict[str, Any] | None = None
    if imagen is not None:
        contenido, nombre, tipo = imagen
        subida = cloudinary.subir_imagen(
            contenido, tipo_contenido=tipo, nombre=nombre
        )

    fila: dict[str, Any] = {
        "id_muestra": datos.id_muestra,
        "id_investigador": id_investigador,
        "proteinas_totales_g_dl": datos.proteinas_totales,
        "metodo_lectura": datos.metodo_lectura,
        "url_imagen_tira": subida["url"] if subida else None,
    }
    if relacion_ag is not None:
        try:
            cols = supabase_rest.columnas("ensayo_electroforetico")
        except supabase_rest.SupabaseError:
            cols = set()
        # Guardar A/G solo si la migración 006 ya fue aplicada (columna existente).
        # Si no existe, se omite para no romper el guardado y se calcula al mostrar.
        if not cols or "relacion_ag" in cols:
            fila["relacion_ag"] = relacion_ag
    supabase_rest.con_auditoria("ensayo_electroforetico", fila, id_investigador)
    if fecha_corrida is not None:
        fila["fecha_corrida"] = fecha_corrida.isoformat()

    try:
        creados = supabase_rest.insertar("ensayo_electroforetico", [fila])
    except Exception:
        if subida is not None:
            cloudinary.eliminar_imagen(str(subida.get("public_id") or ""))
        raise

    if not creados:
        raise supabase_rest.SupabaseError("Supabase no devolvió el ensayo creado")

    ensayo = creados[0]
    # Si la migración 006 no se aplicó aún, la columna relacion_ag no se devuelve.
    if relacion_ag is not None and ensayo.get("relacion_ag") is None:
        ensayo["relacion_ag"] = relacion_ag
    id_ensayo = ensayo["id_ensayo"]
    filas = _filas_fracciones(id_ensayo, fracciones)

    try:
        guardadas = supabase_rest.insertar("fraccion_proteica", filas)
    except Exception:
        # Deshacer el ensayo para no dejarlo sin fracciones.
        supabase_rest.eliminar(
            "ensayo_electroforetico", [("id_ensayo", f"eq.{id_ensayo}")]
        )
        if subida is not None:
            cloudinary.eliminar_imagen(str(subida.get("public_id") or ""))
        raise

    return _salida(ensayo, guardadas or filas)


def listar(id_muestra: int | None = None) -> list[dict[str, Any]]:
    """Ensayos con sus fracciones, del más reciente al más antiguo."""
    filtros = [("id_muestra", f"eq.{id_muestra}")] if id_muestra else []
    ensayos = supabase_rest.seleccionar(
        "ensayo_electroforetico",
        filtros=filtros,
        orden="fecha_corrida.desc",
        limite=500,
    )
    if not ensayos:
        return []

    ids = ",".join(str(ensayo["id_ensayo"]) for ensayo in ensayos)
    fracciones = supabase_rest.seleccionar(
        "fraccion_proteica",
        filtros=[("id_ensayo", f"in.({ids})")],
        orden="id_fraccion.asc",
    )
    investigadores: dict[str, str] = {}
    ids_inv = sorted({str(e["id_investigador"]) for e in ensayos})
    if ids_inv:
        filas_inv = supabase_rest.seleccionar(
            "investigador",
            columnas="id_investigador,nombre",
            filtros=[("id_investigador", f"in.({','.join(ids_inv)})")],
        )
        investigadores = {
            str(f["id_investigador"]): f["nombre"] for f in filas_inv
        }

    por_ensayo: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for fraccion in fracciones:
        por_ensayo[fraccion["id_ensayo"]].append(fraccion)

    return [
        _salida(ensayo, por_ensayo.get(ensayo["id_ensayo"], []), investigadores)
        for ensayo in ensayos
    ]


def eliminar(id_ensayo: int) -> dict[str, Any]:
    """Elimina un ensayo y sus fracciones, y limpia su imagen en Cloudinary.

    Orden: se borra primero en la base (fuente de verdad, fracciones por cascade)
    y luego se intenta borrar la imagen de forma best effort. Si no se puede
    derivar/borrar la imagen remota, la base queda consistente.
    """
    filas = supabase_rest.seleccionar(
        "ensayo_electroforetico",
        columnas="id_ensayo,url_imagen_tira",
        filtros=[("id_ensayo", f"eq.{id_ensayo}")],
        limite=1,
    )
    if not filas:
        raise EnsayoNoEncontrado("El ensayo no existe")

    url_imagen = filas[0].get("url_imagen_tira")
    supabase_rest.eliminar(
        "ensayo_electroforetico", [("id_ensayo", f"eq.{id_ensayo}")]
    )

    public_id = cloudinary.public_id_desde_url(url_imagen)
    if public_id:
        cloudinary.eliminar_imagen(public_id)
    return {"id_ensayo": id_ensayo, "imagen_limpieza_intentada": bool(public_id)}
