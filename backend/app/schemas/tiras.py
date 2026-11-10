"""Formato JSON de la respuesta del análisis de tiras."""
from pydantic import BaseModel, Field

from app.services.analisis_tira import AnalisisTira, imagen_a_data_url
from app.services.densitometria import Fraccion, ResultadoFracciones


class FraccionOut(BaseModel):
    nombre: str
    inicio: int  # columna donde empieza la zona en el perfil
    fin: int  # columna donde termina
    pico: int
    area: float
    porcentaje: float
    concentracion_g_dl: float | None

    @classmethod
    def desde_fraccion(cls, fraccion: Fraccion) -> "FraccionOut":
        return cls(
            nombre=fraccion.nombre,
            inicio=fraccion.inicio,
            fin=fraccion.fin,
            pico=fraccion.pico,
            area=fraccion.area,
            porcentaje=fraccion.porcentaje,
            concentracion_g_dl=fraccion.concentracion_g_dl,
        )


class CarrilOut(BaseModel):
    indice: int  # 1, 2, 3...
    fila_ini: int
    fila_fin: int
    perfil: list[float]  # una densidad óptica por columna
    fracciones: list[FraccionOut]
    nombres_asignados: bool
    relacion_ag: float | None
    advertencias: list[str]
    error: str | None


class AnalisisTiraOut(BaseModel):
    region: tuple[int, int, int, int]  # (x, y, ancho, alto)
    recorte_automatico: bool
    ancho: int
    alto: int
    imagen: str  # data URL (JPEG) del recorte analizado
    advertencias: list[str]
    carriles: list[CarrilOut]

    @classmethod
    def desde_analisis(cls, analisis: AnalisisTira) -> "AnalisisTiraOut":
        tira = analisis.tira
        alto, ancho = tira.imagen.shape[:2]
        carriles = []
        for i, c in enumerate(analisis.carriles, start=1):
            calculo = c.calculo
            carriles.append(
                CarrilOut(
                    indice=i,
                    fila_ini=c.fila_ini,
                    fila_fin=c.fila_fin,
                    perfil=[round(float(v), 4) for v in c.perfil],
                    fracciones=[
                        FraccionOut.desde_fraccion(f)
                        for f in (calculo.fracciones if calculo else [])
                    ],
                    nombres_asignados=calculo.nombres_asignados if calculo else False,
                    relacion_ag=calculo.relacion_ag if calculo else None,
                    advertencias=calculo.advertencias if calculo else [],
                    error=c.error,
                )
            )
        return cls(
            region=tira.region,
            recorte_automatico=tira.recorte_automatico,
            ancho=ancho,
            alto=alto,
            imagen=imagen_a_data_url(tira.imagen),
            advertencias=tira.advertencias,
            carriles=carriles,
        )


class RecalculoIn(BaseModel):
    """Perfil de un carril y los límites confirmados por el investigador."""

    perfil: list[float] = Field(min_length=2, max_length=20_000)
    zonas: list[tuple[int, int]] = Field(min_length=1, max_length=20)
    proteinas_totales: float | None = Field(None, gt=0, le=20)


class RecalculoOut(BaseModel):
    fracciones: list[FraccionOut]
    nombres_asignados: bool
    relacion_ag: float | None
    advertencias: list[str]

    @classmethod
    def desde_resultado(cls, resultado: ResultadoFracciones) -> "RecalculoOut":
        return cls(
            fracciones=[FraccionOut.desde_fraccion(f) for f in resultado.fracciones],
            nombres_asignados=resultado.nombres_asignados,
            relacion_ag=resultado.relacion_ag,
            advertencias=resultado.advertencias,
        )
