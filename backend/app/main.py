import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    admin_usuarios,
    auth,
    cabina,
    ensayos,
    geografia,
    health,
    investigadores,
    muestras,
    reportes,
    tiras,
)

app = FastAPI(title="Camelia Biotech API")


def _origenes_cors() -> list[str]:
    
    base = ["http://localhost:3000", "http://127.0.0.1:3000"]
    extra = os.getenv("CORS_ORIGINS", "")
    for origen in extra.split(","):
        limpio = origen.strip().rstrip("/")
        if limpio and limpio not in base:
            base.append(limpio)
    return base


# Permite abrir la app desde la IP de la red local (por ejemplo
# http://192.168.0.124:3000) sin bloquear las llamadas a la API. Solo habilita
# direcciones locales/privadas, así que no amplía el acceso desde internet.
_ORIGENES_RED_LOCAL = (
    r"^https?://(localhost|127\.0\.0\.1|"
    r"192\.168\.\d{1,3}\.\d{1,3}|"
    r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
    r"172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=_origenes_cors(),
    allow_origin_regex=_ORIGENES_RED_LOCAL,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(admin_usuarios.router)
app.include_router(geografia.router)
app.include_router(tiras.router)
app.include_router(cabina.router)
app.include_router(ensayos.router)
app.include_router(investigadores.router)
app.include_router(muestras.router)
app.include_router(reportes.router)
