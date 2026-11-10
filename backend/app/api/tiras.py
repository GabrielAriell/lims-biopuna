"""Endpoints para analizar tiras de celo-gel (capa web delgada)."""
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.api.deps import UsuarioActual, usuario_actual
from app.schemas.tiras import AnalisisTiraOut, RecalculoIn, RecalculoOut
from app.services import analisis_tira, limites

router = APIRouter(prefix="/ensayos", tags=["ensayos"])
router_publico = APIRouter(prefix="/tiras", tags=["tiras-publico"])

TAMANO_MAXIMO = 15 * 1024 * 1024  # 15 MB
TIPOS_PERMITIDOS = {"image/jpeg", "image/png", "image/tiff", "image/bmp"}


def _leer_region(texto: str | None) -> tuple[int, int, int, int] | None:
    """Convierte 'x,y,ancho,alto' en una tupla; None si viene vacío."""
    if not texto or not texto.strip():
        return None
    try:
        x, y, ancho, alto = (int(v) for v in texto.split(","))
    except ValueError:
        raise HTTPException(422, "region debe ser 'x,y,ancho,alto' con números enteros")
    if ancho <= 0 or alto <= 0 or x < 0 or y < 0:
        raise HTTPException(422, "region tiene valores inválidos")
    return x, y, ancho, alto


def _ejecutar_analisis(
    imagen: UploadFile,
    proteinas_totales: float | None,
    prominencia: float,
    modo: Literal["gris_invertido", "verde_invertido", "absorbancia"],
    n_carriles: int | None,
    region: str | None,
    vertical: bool,
    invertir: bool,
) -> AnalisisTiraOut:
    if imagen.content_type not in TIPOS_PERMITIDOS:
        raise HTTPException(415, "Subí una imagen JPG, PNG, TIFF o BMP")
    datos = imagen.file.read(TAMANO_MAXIMO + 1)
    if len(datos) > TAMANO_MAXIMO:
        raise HTTPException(413, "La imagen supera los 15 MB")
    if not datos:
        raise HTTPException(422, "El archivo está vacío")

    try:
        analisis = analisis_tira.analizar(
            datos,
            proteinas_totales=proteinas_totales,
            prominencia=prominencia,
            modo=modo,
            n_carriles=n_carriles,
            region=_leer_region(region),
            vertical=vertical,
            invertir=invertir,
        )
        return AnalisisTiraOut.desde_analisis(analisis)
    except ValueError as error:
        raise HTTPException(422, str(error))


@router.post("/analizar-tira", response_model=AnalisisTiraOut)
def analizar_tira(
    usuario: Annotated[UsuarioActual, Depends(usuario_actual)],
    imagen: UploadFile = File(..., description="Foto o escaneo de la tira"),
    proteinas_totales: float | None = Form(None, gt=0, le=20, description="g/dL"),
    prominencia: float = Form(0.05, gt=0, le=1, description="Sensibilidad de picos"),
    modo: Literal["gris_invertido", "verde_invertido", "absorbancia"] = Form("gris_invertido"),
    n_carriles: int | None = Form(None, ge=1, le=20),
    region: str | None = Form(None, description="Recorte 'x,y,ancho,alto'"),
    vertical: bool = Form(False),
    invertir: bool = Form(False),
):
    """Analiza la tira y propone carriles, picos y fracciones. No guarda nada."""
    return _ejecutar_analisis(
        imagen, proteinas_totales, prominencia, modo, n_carriles, region, vertical, invertir
    )


@router_publico.post("/analizar-libre", response_model=AnalisisTiraOut)
def analizar_tira_libre(
    imagen: UploadFile = File(..., description="Foto o escaneo de la tira"),
    proteinas_totales: float | None = Form(None, gt=0, le=20, description="g/dL"),
    prominencia: float = Form(0.05, gt=0, le=1, description="Sensibilidad de picos"),
    modo: Literal["gris_invertido", "verde_invertido", "absorbancia"] = Form("gris_invertido"),
    n_carriles: int | None = Form(None, ge=1, le=20),
    region: str | None = Form(None, description="Recorte 'x,y,ancho,alto'"),
    vertical: bool = Form(False),
    invertir: bool = Form(False),
):
    """Análisis libre público (sin login). No guarda nada."""
    return _ejecutar_analisis(
        imagen, proteinas_totales, prominencia, modo, n_carriles, region, vertical, invertir
    )


def _ejecutar_recalculo(datos: RecalculoIn) -> RecalculoOut:
    try:
        resultado = limites.recalcular(datos.perfil, datos.zonas, datos.proteinas_totales)
    except ValueError as error:
        raise HTTPException(422, str(error))
    return RecalculoOut.desde_resultado(resultado)


@router.post("/recalcular", response_model=RecalculoOut)
def recalcular_tira(
    datos: RecalculoIn,
    _usuario: Annotated[UsuarioActual, Depends(usuario_actual)],
):
    """Recalcula % y g/dL con los límites que confirmó el investigador.

    No guarda nada: recibe el perfil de un carril y las zonas elegidas, y
    devuelve las fracciones con los mismos nombres y la relación A/G.
    """
    return _ejecutar_recalculo(datos)


@router_publico.post("/recalcular-libre", response_model=RecalculoOut)
def recalcular_tira_libre(datos: RecalculoIn):
    """Recalculo libre público (sin login). No guarda nada."""
    return _ejecutar_recalculo(datos)
