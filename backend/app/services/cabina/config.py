import os

# --- HARDWARE ---
PUERTO_ARDUINO = os.getenv("PUERTO_ARDUINO", "COM6")
URL_CAMARA = int(os.getenv("URL_CAMARA", "0"))
ACTIVAR_ARDUINO = os.getenv("ACTIVAR_ARDUINO", "True").lower() in ("true", "1", "yes")

# --- ÓPTICA Y VENTANA (16:9 Panorámico) ---
ANCHO_CAPTURA = int(os.getenv("CABINA_ANCHO_CAPTURA", "1280"))
ALTO_CAPTURA = int(os.getenv("CABINA_ALTO_CAPTURA", "720"))
ANCHO_VENTANA = int(os.getenv("CABINA_ANCHO_VENTANA", "960"))
ALTO_VENTANA = int(os.getenv("CABINA_ALTO_VENTANA", "540"))

DISTORSION_K1 = float(os.getenv("CABINA_DISTORSION_K1", "-0.30"))
FOCAL_FACTOR = float(os.getenv("CABINA_FOCAL_FACTOR", "0.85"))

# --- ILUMINACIÓN ---
BRILLO_BLANCO_INICIAL = int(os.getenv("CABINA_BRILLO_BLANCO_INICIAL", "180"))
BRILLO_OBJETIVO = int(os.getenv("CABINA_BRILLO_OBJETIVO", "140"))
TOLERANCIA_BRILLO = int(os.getenv("CABINA_TOLERANCIA_BRILLO", "8"))

# --- ANÁLISIS DE TIRA ---
# [x1, y1, x2, y2]
ROI_INICIAL = [140, 130, 820, 220]
PROMINENCIA_PICO_DEFECTO = 0.05

# --- EXPORTACIÓN ---
CARPETA_SALIDA = os.getenv("CABINA_CARPETA_SALIDA", "capturas_celogel")
os.makedirs(CARPETA_SALIDA, exist_ok=True)

COLORES_BANDAS = [
    (255, 150, 0),
    (0, 220, 100),
    (200, 100, 255),
    (0, 200, 255),
    (100, 150, 255),
    (255, 180, 50),
    (180, 120, 255),
]
