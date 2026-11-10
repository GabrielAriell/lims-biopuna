import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, ensayos, geografia, health, investigadores, muestras, reportes, tiras

app = FastAPI(title="Camelia Biotech API")


def _origenes_cors() -> list[str]:
    # Desarrollo local + orígenes extra para despliegue (separados por coma).
    # Ej.: CORS_ORIGINS=https://miapp.vercel.app,https://midominio.com
    base = ["http://localhost:3000", "http://127.0.0.1:3000"]
    extra = os.getenv("CORS_ORIGINS", "")
    for origen in extra.split(","):
        limpio = origen.strip().rstrip("/")
        if limpio and limpio not in base:
            base.append(limpio)
    return base


# El frontend (Next.js) corre en otro origen: hay que permitirlo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origenes_cors(),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(geografia.router)
app.include_router(tiras.router)
app.include_router(tiras.router_publico)
app.include_router(ensayos.router)
app.include_router(investigadores.router)
app.include_router(muestras.router)
app.include_router(reportes.router)
