"""Subida de imágenes a Cloudinary desde el backend.

La firma se calcula acá para que ``api_secret`` nunca llegue al navegador.
No se usa el SDK oficial: la API REST alcanza y evita agregar una dependencia.

Las credenciales se leen de ``backend/.env`` en cada llamada, igual que en
``supabase_rest``: así se pueden cargar sin reiniciar el servidor.
"""
from __future__ import annotations

import hashlib
import os
import time
from pathlib import Path
from typing import Any

import httpx
from dotenv import dotenv_values

RUTA_ENV = Path(__file__).resolve().parents[2] / ".env"
TIEMPO_LIMITE = 30.0
CARPETA = "lims-biopuna/tiras"

VARIABLES = (
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
)


class CloudinaryNoConfigurado(RuntimeError):
    """Faltan las credenciales de Cloudinary."""


class CloudinaryError(RuntimeError):
    """Cloudinary respondió con un error."""

    def __init__(self, mensaje: str, status: int = 502) -> None:
        super().__init__(mensaje)
        self.status = status


def _entorno() -> dict[str, str]:
    valores = dotenv_values(RUTA_ENV) if RUTA_ENV.exists() else {}
    return {
        clave: (valores.get(clave) or os.getenv(clave) or "").strip()
        for clave in VARIABLES
    }


def configurado() -> bool:
    return all(_entorno().values())


def aviso_configuracion() -> str | None:
    """Mensaje claro para /health o para el error de guardado."""
    faltantes = [clave for clave, valor in _entorno().items() if not valor]
    if not faltantes:
        return None
    return (
        "Faltan las credenciales de Cloudinary en backend/.env: "
        + ", ".join(faltantes)
    )


def _credenciales() -> tuple[str, str, str]:
    entorno = _entorno()
    faltantes = [clave for clave in VARIABLES if not entorno[clave]]
    if faltantes:
        raise CloudinaryNoConfigurado(
            "Faltan las credenciales de Cloudinary en backend/.env: "
            + ", ".join(faltantes)
        )
    return (
        entorno["CLOUDINARY_CLOUD_NAME"],
        entorno["CLOUDINARY_API_KEY"],
        entorno["CLOUDINARY_API_SECRET"],
    )


def _firmar(parametros: dict[str, str], secreto: str) -> str:
    """Firma de Cloudinary: parámetros ordenados + secreto, en SHA-1."""
    cadena = "&".join(
        f"{clave}={valor}"
        for clave, valor in sorted(parametros.items())
        if valor is not None and valor != ""
    )
    return hashlib.sha1((cadena + secreto).encode("utf-8")).hexdigest()


def _mensaje_error(respuesta: httpx.Response) -> str:
    try:
        cuerpo = respuesta.json()
    except ValueError:
        return respuesta.text or f"Error {respuesta.status_code}"
    error = cuerpo.get("error")
    if isinstance(error, dict):
        return str(error.get("message") or error)
    return str(error or cuerpo.get("message") or respuesta.text)


def subir_imagen(
    datos: bytes,
    *,
    tipo_contenido: str,
    nombre: str,
    carpeta: str = CARPETA,
) -> dict[str, Any]:
    """Sube una imagen y devuelve ``url``, ``public_id`` y metadatos."""
    nube, clave, secreto = _credenciales()
    timestamp = str(int(time.time()))
    parametros = {"folder": carpeta, "timestamp": timestamp}
    firma = _firmar(parametros, secreto)

    url = f"https://api.cloudinary.com/v1_1/{nube}/image/upload"
    try:
        respuesta = httpx.post(
            url,
            data={**parametros, "api_key": clave, "signature": firma},
            files={"file": (nombre, datos, tipo_contenido)},
            timeout=TIEMPO_LIMITE,
        )
    except httpx.HTTPError as error:
        raise CloudinaryError(
            f"No se pudo conectar con Cloudinary: {error}"
        ) from error

    if respuesta.is_error:
        raise CloudinaryError(
            f"Cloudinary rechazó la imagen: {_mensaje_error(respuesta)}",
            respuesta.status_code if 400 <= respuesta.status_code < 500 else 502,
        )

    cuerpo = respuesta.json()
    secure_url = cuerpo.get("secure_url") or cuerpo.get("url")
    if not secure_url:
        raise CloudinaryError("Cloudinary no devolvió la URL de la imagen")
    return {
        "url": secure_url,
        "public_id": cuerpo.get("public_id"),
        "ancho": cuerpo.get("width"),
        "alto": cuerpo.get("height"),
        "formato": cuerpo.get("format"),
    }


def eliminar_imagen(public_id: str) -> None:
    """Borra una imagen recién subida cuando el guardado en la base falla.

    Es una limpieza de mejor esfuerzo: si falla, no se interrumpe el error
    original que se está informando al usuario.
    """
    if not public_id:
        return
    try:
        nube, clave, secreto = _credenciales()
        timestamp = str(int(time.time()))
        parametros = {"public_id": public_id, "timestamp": timestamp}
        firma = _firmar(parametros, secreto)
        httpx.post(
            f"https://api.cloudinary.com/v1_1/{nube}/image/destroy",
            data={**parametros, "api_key": clave, "signature": firma},
            timeout=TIEMPO_LIMITE,
        )
    except (CloudinaryNoConfigurado, httpx.HTTPError):
        pass
