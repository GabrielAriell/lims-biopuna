import threading
import time
from typing import Generator
import cv2
import numpy as np

from app.services.cabina import config
from app.services.cabina.analisis import procesar_roi
from app.services.cabina.camara import CamaraCalibrada
from app.services.cabina.iluminacion import ControladorIluminacion
from app.services.cabina.interfaz import dibujar_grafica_y_areas, dibujar_hud
from app.services.cabina.main import guardar_solo_tira


def detectar_camaras_con_nombre() -> list[dict]:
    """Obtiene la lista de cámaras activas en DirectShow exactamente en el orden de OpenCV."""
    nombres_dshow = []
    try:
        from pygrabber.dshow_graph import FilterGraph
        nombres_dshow = FilterGraph().get_input_devices()
    except Exception:
        pass

    camaras = []
    if nombres_dshow:
        for idx, nombre_base in enumerate(nombres_dshow):
            # Identificar la cámara USB física de la cabina
            es_cabina = any(
                k in nombre_base.upper()
                for k in ["USB", "CABINA", "UVC", "MICROSCOPE", "CAM"]
            ) and "IVCAM" not in nombre_base.upper()

            nombre_final = nombre_base
            if es_cabina and "Cabina" not in nombre_base:
                nombre_final = f"{nombre_base} (Cabina Densitométrica)"

            camaras.append(
                {
                    "idx": idx,
                    "nombre": nombre_final,
                    "es_cabina": es_cabina,
                }
            )
    else:
        for idx in range(3):
            camaras.append(
                {
                    "idx": idx,
                    "nombre": f"Cámara {idx}" + (" (Cabina)" if idx == 1 else ""),
                    "es_cabina": (idx == 1),
                }
            )

    return camaras


class GestorCabina:
    """Gestiona el hardware, auto-selección de cámara USB, iluminación LED fija y transmisión."""

    def __init__(self):
        self.camaras_disponibles = detectar_camaras_con_nombre()

        # Seleccionar automáticamente la cámara que sea la Cabina física (ej. índice 1)
        cam_auto = next(
            (c["idx"] for c in self.camaras_disponibles if c.get("es_cabina")),
            1 if len(self.camaras_disponibles) > 1 else 0,
        )
        self.camara_idx = cam_auto
        self.modo_tincion = "ROJA"  # Modos limpios: "ROJA", "AZUL", "BLANCA"
        self.roi = list(config.ROI_INICIAL)
        self.cam: CamaraCalibrada | None = None
        self.luz: ControladorIluminacion | None = None
        self._lock_luz = threading.Lock()
        self._ultimo_analisis = {
            "tincion": "ROJA",
            "relacion_ag": None,
            "datos_bandas": [],
        }

    def obtener_camara(self, indice: int | None = None) -> CamaraCalibrada:
        target_idx = self.camara_idx if indice is None else indice
        if self.cam is None or not self.cam.esta_abierta() or self.cam.indice != target_idx:
            if self.cam is not None:
                self.cam.liberar()
            self.camara_idx = target_idx
            self.cam = CamaraCalibrada(indice=target_idx)
        return self.cam

    def obtener_iluminacion(self) -> ControladorIluminacion:
        with self._lock_luz:
            if self.luz is None or not self.luz.conectado:
                nueva_luz = ControladorIluminacion()
                if nueva_luz.conectado:
                    self.luz = nueva_luz
                    # Aplicar la luz inicial según modo_tincion
                    if self.modo_tincion == "ROJA":
                        self.luz.configurar_espectro_tincion("ROJA")
                    elif self.modo_tincion == "AZUL":
                        self.luz.configurar_espectro_tincion("AZUL")
                    else:
                        self.luz.activar_luz_blanca()
                elif self.luz is None:
                    self.luz = nueva_luz
            return self.luz

    def cambiar_camara(self, indice: int):
        self.camara_idx = indice
        if self.cam is not None:
            self.cam.liberar()
            self.cam = None

    def actualizar_roi(self, x1: int, y1: int, x2: int, y2: int):
        w_max = config.ANCHO_VENTANA
        h_max = config.ALTO_VENTANA
        x1 = max(0, min(w_max - 50, int(x1)))
        y1 = max(0, min(h_max - 30, int(y1)))
        x2 = max(x1 + 40, min(w_max, int(x2)))
        y2 = max(y1 + 20, min(h_max, int(y2)))
        self.roi = [x1, y1, x2, y2]

    def set_modo_tincion(self, modo: str):
        """Cambia a luz fija y estable correspondiente a la tira, sin oscilaciones."""
        m = modo.upper()
        if m in ("ROJA", "ROJO"):
            self.modo_tincion = "ROJA"
            luz = self.obtener_iluminacion()
            luz.configurar_espectro_tincion("ROJA")  # Luz Verde fija de alto contraste
        elif m in ("AZUL", "AZULES"):
            self.modo_tincion = "AZUL"
            luz = self.obtener_iluminacion()
            luz.configurar_espectro_tincion("AZUL")  # Luz Roja fija de alto contraste
        elif m in ("BLANCA", "BLANCO"):
            self.modo_tincion = "BLANCA"
            luz = self.obtener_iluminacion()
            luz.activar_luz_blanca()

    def set_color_led_directo(self, color: str):
        luz = self.obtener_iluminacion()
        luz.activar_color_manual(color)

    def generar_mjpeg(self) -> Generator[bytes, None, None]:
        cam = self.obtener_camara()
        luz = self.obtener_iluminacion()

        while True:
            try:
                if not cam.esta_abierta():
                    placeholder = np.zeros(
                        (config.ALTO_VENTANA, config.ANCHO_VENTANA, 3), dtype=np.uint8
                    )
                    cv2.putText(
                        placeholder,
                        f"Conectando camara {self.camara_idx}...",
                        (int(config.ANCHO_VENTANA / 4), int(config.ALTO_VENTANA / 2)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.8,
                        (0, 200, 255),
                        2,
                    )
                    _, jpeg = cv2.imencode(".jpg", placeholder)
                    yield (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n\r\n" + jpeg.tobytes() + b"\r\n"
                    )
                    time.sleep(0.5)
                    cam = self.obtener_camara()
                    continue

                ret, frame = cam.leer_fotograma()
                if not ret or frame is None:
                    time.sleep(0.04)
                    continue

                x1, y1, x2, y2 = self.roi

                # Procesamiento densitométrico con el motor real
                (
                    tincion,
                    canal_idx,
                    perfil,
                    picos,
                    limites,
                    datos_bandas,
                    relacion_ag,
                ) = procesar_roi(frame, self.roi, self.modo_tincion)

                self._ultimo_analisis = {
                    "tincion": tincion,
                    "relacion_ag": relacion_ag,
                    "datos_bandas": datos_bandas,
                }

                # Luz fija y estable: NO oscila PWM cuadro a cuadro
                recorte = frame[y1:y2, x1:x2]
                brillo_actual = (
                    float(recorte[:, :, canal_idx].mean()) if recorte.size > 0 else 0.0
                )

                # Dibujar gráfica de picos, límites y HUD
                dibujar_grafica_y_areas(
                    frame, self.roi, perfil, picos, limites, datos_bandas
                )
                dibujar_hud(
                    frame,
                    self.roi,
                    True,
                    self.modo_tincion,
                    tincion,
                    len(datos_bandas),
                    True,
                    brillo_actual,
                    luz,
                    "",
                    relacion_ag,
                    modo_web=True,
                )

                ok, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                if not ok:
                    continue

                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + jpeg.tobytes() + b"\r\n"
                )
                time.sleep(0.035)
            except GeneratorExit:
                break
            except Exception:
                time.sleep(0.05)

    def capturar_limpio(self) -> dict:
        cam = self.obtener_camara()
        if not cam.esta_abierta():
            raise RuntimeError(f"Cámara {self.camara_idx} no disponible.")

        foto_limpia = cam.capturar_fotograma_limpio(num_frames=10)
        if foto_limpia is None:
            raise RuntimeError("No se pudo obtener un fotograma limpio.")

        x1, y1, x2, y2 = self.roi
        recorte_tira = foto_limpia[y1:y2, x1:x2]
        nombre, ruta = guardar_solo_tira(recorte_tira)

        tincion, _, _, _, _, datos_bandas, relacion_ag = procesar_roi(
            foto_limpia, self.roi, self.modo_tincion
        )

        ok, buffer = cv2.imencode(".png", recorte_tira)
        if not ok:
            raise RuntimeError("Error al codificar imagen de la tira.")

        return {
            "nombre_archivo": nombre,
            "ruta_archivo": ruta,
            "buffer": buffer,
            "tincion": tincion,
            "relacion_ag": relacion_ag,
            "datos_bandas": datos_bandas,
        }


gestor_cabina = GestorCabina()
