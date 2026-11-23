"""Módulo de integración de la Cabina Densitométrica para tiras Celogel.

Gestiona:
- Captura de cámara USB panorámica con corrección de lente (camara.py)
- Control de iluminación LED RGB por Arduino con ánodo común (iluminacion.py)
- Análisis densitométrico real conectado al motor de BIOPUNA (analisis.py)
- Interfaz gráfica OpenCV interactiva con ROI móvil y curvas en tiempo real (interfaz.py)
- Rutinas de ejecución y guardado de tiras y reportes (main.py)
"""
from app.services.cabina import config
from app.services.cabina.analisis import detectar_tipo_tincion, procesar_roi
from app.services.cabina.camara import CamaraCalibrada
from app.services.cabina.iluminacion import ControladorIluminacion
from app.services.cabina.main import ejecutar_cabina

__all__ = [
    "config",
    "CamaraCalibrada",
    "ControladorIluminacion",
    "detectar_tipo_tincion",
    "procesar_roi",
    "ejecutar_cabina",
]
