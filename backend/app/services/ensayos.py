"""Guardado y lectura de ensayos electroforéticos.

El navegador manda el perfil de cada carril y las zonas que confirmó el
investigador. Acá se recalculan las fracciones con ``limites.recalcular``:
nunca se confía en los porcentajes que vienen del cliente.

Si falla la inserción de las fracciones se borra el ensayo recién creado,
porque PostgREST no permite una transacción entre varias llamadas.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from app.schemas.ensayos import EnsayoIn
from app.services import cloudinary, limites, supabase_rest


class EnsayoInvalido(ValueError):
    """Los datos del ensayo no permiten guardarlo."""


def _calcular_fracciones(datos: EnsayoIn) -> list[Any]:
    """Recalcula cada carril y exige que tenga un esquema de 5 o 6 nombres."""
    calculos = []
    for indice, carril in enumerate(datos.carriles, start=1):
        try:
            calculo = limites.recalcular(
                carril.perfil, carril.zonas, datos.proteinas_totales
            )
        except ValueError as error:
            raise EnsayoInvalido(f"Carril {indice}: {error}") from error

        if not calculo.nombres_asignados:
            raise EnsayoInvalido(
                f"Carril {indice}: se detectaron {len(calculo.fracciones)} "
                "fracciones y se esperaban 5 o 6. Ajustá los límites antes de "
                "guardar."
            )
        calculos.append(calculo)
    return calculos


def _filas_fracciones(id_ensayo: int, calculos: list[Any]) -> list[dict[str, Any]]:
    filas = []
    for calculo in calculos:
        for fraccion in calculo.fracciones:
            filas.append(
                {
                    "id_ensayo": id_ensayo,
                    "nombre_fraccion": fraccion.nombre,
                    "area_integrada": round(float(fraccion.area), 6),
                    "porcentaje_relativo": round(float(fraccion.porcentaje), 2),
                    "concentracion_g_dl": round(
                        float(fraccion.concentracion_g_dl or 0), 2
                    ),
                }
            )
    return filas


def _salida(
    ensayo: dict[str, Any],
    fracciones: list[dict[str, Any]],
    investigadores: dict[str, str] | None = None,
) -> dict[str, Any]:
    inv = str(ensayo["id_investigador"])
    return {
        "id_ensayo": ensayo["id_ensayo"],
        "id_muestra": ensayo["id_muestra"],
        "id_investigador": ensayo["id_investigador"],
        "investigador_nombre": (investigadores or {}).get(inv),
        "fecha_corrida": ensayo["fecha_corrida"],
        "proteinas_totales_g_dl": float(ensayo["proteinas_totales_g_dl"]),
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
    """Recalcula, sube la imagen (si hay) e inserta ensayo + fracciones.

    El investigador lo decide el endpoint a partir del token de sesión.
    """
    calculos = _calcular_fracciones(datos)

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
    supabase_rest.con_auditoria(
        "ensayo_electroforetico", fila, id_investigador
    )
    if datos.fecha_corrida is not None:
        fila["fecha_corrida"] = datos.fecha_corrida.isoformat()

    try:
        creados = supabase_rest.insertar("ensayo_electroforetico", [fila])
    except Exception:
        if subida is not None:
            cloudinary.eliminar_imagen(str(subida.get("public_id") or ""))
        raise

    if not creados:
        raise supabase_rest.SupabaseError(
            "Supabase no devolvió el ensayo creado"
        )

    ensayo = creados[0]
    id_ensayo = ensayo["id_ensayo"]
    filas = _filas_fracciones(id_ensayo, calculos)

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
