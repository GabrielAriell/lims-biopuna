"""Cambia la contraseña de un usuario en Supabase Auth (Admin API).

Útil si un usuario olvidó su contraseña. Usa la secret key de backend/.env
(nunca se ejecuta en el navegador).

Uso:
    python -m scripts.cambiar_clave --email usuario@correo.com --password "NuevaClaveSegura"
    python -m scripts.cambiar_clave --id <UUID_USUARIO> --password "NuevaClaveSegura"

Nota: pasar la contraseña por argumento puede quedar en el historial de la
terminal; podés borrarlo después o cambiar la clave nuevamente desde un lugar
seguro.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import httpx
from dotenv import dotenv_values

RUTA_ENV = Path(__file__).resolve().parents[1] / ".env"
TIEMPO_LIMITE = 20.0


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


def _cabeceras(clave: str) -> dict[str, str]:
    return {
        "apikey": clave,
        "Authorization": f"Bearer {clave}",
        "Content-Type": "application/json",
    }


def _listar(url: str, clave: str) -> list[dict]:
    respuesta = httpx.get(
        f"{url}/auth/v1/admin/users",
        headers=_cabeceras(clave),
        params={"per_page": 200},
        timeout=TIEMPO_LIMITE,
    )
    respuesta.raise_for_status()
    cuerpo = respuesta.json()
    usuarios = cuerpo.get("users", cuerpo if isinstance(cuerpo, list) else [])
    return list(usuarios)


def _buscar_por_email(url: str, clave: str, email: str) -> dict | None:
    email_norm = email.strip().lower()
    for u in _listar(url, clave):
        if (u.get("email") or "").strip().lower() == email_norm:
            return u
    return None


def _cambiar_password(url: str, clave: str, user_id: str, password: str) -> None:
    respuesta = httpx.put(
        f"{url}/auth/v1/admin/users/{user_id}",
        headers=_cabeceras(clave),
        json={"password": password},
        timeout=TIEMPO_LIMITE,
    )
    if respuesta.is_error:
        raise SystemExit(
            f"No se pudo cambiar la contraseña: {respuesta.status_code} {respuesta.text}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    grupo = parser.add_mutually_exclusive_group(required=True)
    grupo.add_argument("--email", help="Correo del usuario")
    grupo.add_argument("--id", help="UUID del usuario (id en Auth / id_investigador)")
    parser.add_argument("--password", required=True, help="Nueva contraseña")
    args = parser.parse_args()

    if not args.password or len(args.password) < 6:
        raise SystemExit("La contraseña debe tener al menos 6 caracteres")

    url, clave = _entorno()

    if args.id:
        user_id = args.id.strip()
        email_mostrar = args.id.strip()
    else:
        usuario = _buscar_por_email(url, clave, args.email)
        if usuario is None:
            raise SystemExit(f"No se encontró un usuario con email: {args.email}")
        user_id = usuario["id"]
        email_mostrar = usuario.get("email") or args.email

    _cambiar_password(url, clave, user_id, args.password)
    print(f"Contraseña actualizada para: {email_mostrar} ({user_id})")
    print("Ya podés iniciar sesión con la nueva contraseña.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
