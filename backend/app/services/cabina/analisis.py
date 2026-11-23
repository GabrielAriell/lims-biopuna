"""Módulo de análisis de tira para la Cabina de Densitometría Celogel.

IMPORTANTE: Integra el motor densitométrico real del sistema (app.services.densitometria)
reemplazando el archivo preliminar/de prueba original.
"""
import cv2
import numpy as np

from app.services.cabina import config
from app.services.densitometria.densidad import a_densidad_optica
from app.services.densitometria.fracciones import calcular_fracciones
from app.services.densitometria.perfil import perfil_carril
from app.services.densitometria.picos import detectar_picos, proponer_limites


def detectar_tipo_tincion(roi: np.ndarray) -> str:
    """Determina si las bandas oscuras de la tira son ROJAS o AZULES."""
    if roi.size == 0:
        return "ROJA"
    b, g, r = cv2.split(roi)
    gris = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    umbral_bandas = np.percentile(gris, 15)
    mascara_bandas = gris <= umbral_bandas

    if np.sum(mascara_bandas) == 0:
        return "ROJA"

    promedio_r = np.mean(r[mascara_bandas])
    promedio_b = np.mean(b[mascara_bandas])

    if promedio_b > promedio_r + 6:
        return "AZUL"
    return "ROJA"


def procesar_roi(
    frame: np.ndarray,
    box: list[int] | tuple[int, int, int, int],
    modo: str = "ROJA",
    prominencia: float = config.PROMINENCIA_PICO_DEFECTO,
    proteinas_totales: float | None = None,
):
    """Calcula perfil densitométrico, picos, valles, fracciones y relación A/G.

    Usa el motor matemático real del sistema:
    - app.services.densitometria.densidad (a_densidad_optica)
    - app.services.densitometria.perfil (perfil_carril)
    - app.services.densitometria.picos (detectar_picos, proponer_limites)
    - app.services.densitometria.fracciones (calcular_fracciones)

    Retorna:
    (tincion, canal_idx, perfil, picos, limites, datos_bandas, relacion_ag)
    """
    x1, y1, x2, y2 = box
    roi = frame[y1:y2, x1:x2]

    if roi.size == 0 or roi.shape[0] < 5 or roi.shape[1] < 10:
        return "ROJA", 1, np.array([]), [], [], [], None

    tincion = detectar_tipo_tincion(roi) if modo == "AUTO" else modo

    # Para hardware/iluminación LED:
    # Si tinción roja: luz verde (canal 1 en BGR)
    # Si tinción azul: luz roja (canal 2 en BGR)
    canal_idx = 1 if tincion == "ROJA" else 2

    # Modo de densidad óptica según tinción:
    modo_densidad = "verde_invertido" if tincion == "ROJA" else "gris_invertido"

    # 1. Densidad óptica relativa usando el servicio real
    try:
        od = a_densidad_optica(roi, modo=modo_densidad)
    except Exception:
        od = a_densidad_optica(roi, modo="gris_invertido")

    # 2. Perfil densitométrico a lo largo de la tira
    perfil = perfil_carril(od, 0, od.shape[0])
    if len(perfil) == 0 or np.max(perfil) <= 0:
        return tincion, canal_idx, perfil, [], [], [], None

    # 3. Detección de picos y propuesta de zonas (cortes por valles)
    limites = proponer_limites(perfil, prominencia_rel=prominencia)
    picos_detectados = detectar_picos(perfil, prominencia_rel=prominencia)

    # 4. Cálculo de fracciones reales con nombres clínicos
    datos_bandas = []
    picos_resultado = []
    relacion_ag = None

    if len(limites) > 0:
        try:
            calculo = calcular_fracciones(perfil, limites, proteinas_totales=proteinas_totales)
            relacion_ag = calculo.relacion_ag
            for f in calculo.fracciones:
                picos_resultado.append(f.pico)
                datos_bandas.append((f.nombre, round(f.area, 2), round(f.porcentaje, 2)))
        except Exception:
            # Fallback en caso de señal baja o límites no válidos para el esquema
            area_total = sum(float(np.sum(perfil[ini:fin + 1])) for ini, fin in limites) or 1.0
            for idx, (ini, fin) in enumerate(limites):
                area = float(np.sum(perfil[ini:fin + 1]))
                pct = (area / area_total) * 100.0
                pico = ini + int(np.argmax(perfil[ini:fin + 1]))
                picos_resultado.append(pico)
                datos_bandas.append((f"Banda {idx + 1}", round(area, 2), round(pct, 2)))
    else:
        picos_resultado = picos_detectados

    return tincion, canal_idx, perfil, picos_resultado, limites, datos_bandas, relacion_ag
