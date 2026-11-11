"""Crea usuarios de prueba en Supabase Auth y sus perfiles de investigador.

Se usa mientras no hay pantalla de registro: los usuarios se crean con la
Admin API usando la secret key del backend (nunca se ejecuta en el navegador).

Uso:
    # Definí CLAVE_PRUEBA en backend/.env o como variable de entorno.
    python -m scripts.crear_usuarios_prueba

Los usuarios y contraseñas son de prueba. Se pueden borrar desde el panel de
Supabase o con ``python -m scripts.crear_usuarios_prueba --borrar``.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import httpx
from dotenv import dotenv_values

RUTA_ENV = Path(__file__).resolve().parents[1] / ".env"
TIEMPO_LIMITE = 20.0
MINIMO_CLAVE = 8

USUARIOS = [
    {
        "email": "investigador.uno@biopuna.test",
        "nombre": "Investigador Uno",
        "rol": "investigador",
    },
    {
        "email": "investigadora.dos@biopuna.test",
        "nombre": "Investigadora Dos",
        "rol": "investigador",
    },
    {
        "email": "lectura@biopuna.test",
        "nombre": "Usuario de Lectura",
        "rol": "lectura",
    },
]


def _entorno() -> tuple[str, str]:
    valores = dotenv_values(RUTA_ENV) if RUTA_ENV.exists() else {}
    url = (valores.get("SUPABASE_URL") or "").strip().rstrip("/")
    clave = (valores.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not clave:
        raise SystemExit(
            "Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en backend/.env"
        )
    if clave.startswith("sb_publishable_"):
        raise SystemExit("La clave cargada es pública; se necesita la secret key")
    return url, clave


def _clave_prueba() -> str:
    """Lee la contraseña de prueba sin guardarla en el repositorio."""
    valores = dotenv_values(RUTA_ENV) if RUTA_ENV.exists() else {}
    clave = (os.getenv("CLAVE_PRUEBA") or valores.get("CLAVE_PRUEBA") or "").strip()
    if len(clave) < MINIMO_CLAVE:
        raise SystemExit(
            f"Definí CLAVE_PRUEBA (mínimo {MINIMO_CLAVE} caracteres) en "
            "backend/.env o como variable de entorno antes de crear las cuentas."
        )
    return clave


def _cabeceras(clave: str) -> dict[str, str]:
    return {
        "apikey": clave,
        "Authorization": f"Bearer {clave}",
        "Content-Type": "application/json",
    }


def _listar(url: str, clave: str) -> dict[str, dict]:
    respuesta = httpx.get(
        f"{url}/auth/v1/admin/users",
        headers=_cabeceras(clave),
        params={"per_page": 200},
        timeout=TIEMPO_LIMITE,
    )
    respuesta.raise_for_status()
    cuerpo = respuesta.json()
    usuarios = cuerpo.get("users", cuerpo if isinstance(cuerpo, list) else [])
    return {u["email"].lower(): u for u in usuarios if u.get("email")}


def _crear(url: str, clave: str, usuario: dict, clave_prueba: str) -> dict:
    respuesta = httpx.post(
        f"{url}/auth/v1/admin/users",
        headers=_cabeceras(clave),
        json={
            "email": usuario["email"],
            "password": clave_prueba,
            "email_confirm": True,
            "user_metadata": {"nombre": usuario["nombre"]},
        },
        timeout=TIEMPO_LIMITE,
    )
    if respuesta.is_error:
        raise SystemExit(
            f"No se pudo crear {usuario['email']}: "
            f"{respuesta.status_code} {respuesta.text}"
        )
    return respuesta.json()


def _guardar_perfil(
    url: str, clave: str, usuario: dict, id_usuario: str
) -> None:
    """Actualiza el perfil que creó el trigger; lo crea si no existe."""
    cuerpo = {
        "nombre": usuario["nombre"],
        "email": usuario["email"],
        "rol_sistema": usuario["rol"],
    }
    respuesta = httpx.patch(
        f"{url}/rest/v1/investigador",
        headers={**_cabeceras(clave), "Prefer": "return=representation"},
        params={"id_investigador": f"eq.{id_usuario}"},
        json=cuerpo,
        timeout=TIEMPO_LIMITE,
    )
    respuesta.raise_for_status()
    if respuesta.json():
        return

    respuesta = httpx.post(
        f"{url}/rest/v1/investigador",
        headers={**_cabeceras(clave), "Prefer": "return=representation"},
        json={"id_investigador": id_usuario, **cuerpo},
        timeout=TIEMPO_LIMITE,
    )
    respuesta.raise_for_status()


def _borrar(url: str, clave: str, usuario: dict, id_usuario: str) -> None:
    respuesta = httpx.delete(
        f"{url}/auth/v1/admin/users/{id_usuario}",
        headers=_cabeceras(clave),
        timeout=TIEMPO_LIMITE,
    )
    if respuesta.is_error:
        raise SystemExit(
            f"No se pudo borrar {usuario['email']}: "
            f"{respuesta.status_code} {respuesta.text}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--borrar",
        action="store_true",
        help="Elimina los usuarios de prueba en vez de crearlos",
    )
    args = parser.parse_args()

    url, clave = _entorno()
    clave_prueba = "" if args.borrar else _clave_prueba()
    existentes = _listar(url, clave)

    for usuario in USUARIOS:
        correo = usuario["email"].lower()
        actual = existentes.get(correo)
        if args.borrar:
            if actual is None:
                print(f"= {usuario['email']}: no existía")
                continue
            _borrar(url, clave, usuario, actual["id"])
            print(f"- {usuario['email']}: borrado")
            continue

        if actual is None:
            creado = _crear(url, clave, usuario, clave_prueba)
            id_usuario = creado["id"]
            print(f"+ {usuario['email']}: creado ({usuario['rol']})")
        else:
            id_usuario = actual["id"]
            print(f"= {usuario['email']}: ya existía ({usuario['rol']})")

        _guardar_perfil(url, clave, usuario, id_usuario)

    if not args.borrar:
        print()
        print("Cuentas de prueba (contraseña común):", clave_prueba)
        for usuario in USUARIOS:
            print(f"  {usuario['email']} · {usuario['rol']} · {usuario['nombre']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
