import cv2
import numpy as np
from app.services.cabina import config


class CamaraCalibrada:
    """Gestiona la captura USB panorámica, anti-parpadeo y corrección de lente."""

    def __init__(self, indice: int = config.URL_CAMARA):
        self.indice = indice
        self.cap = None
        self._inicializar_camara(indice)

        self._matriz_cam = None
        self._nueva_matriz = None
        self._dist_coeffs = np.array(
            [config.DISTORSION_K1, 0.0, 0.0, 0.0, 0.0], dtype=np.float32
        )

    def _inicializar_camara(self, indice: int):
        try:
            # DirectShow es más estable para cámaras USB en Windows
            backend = getattr(cv2, "CAP_DSHOW", cv2.CAP_ANY)
            cap = cv2.VideoCapture(indice, backend)
            if not cap.isOpened() and backend != cv2.CAP_ANY:
                cap = cv2.VideoCapture(indice)
        except Exception:
            cap = None

        if cap is not None and cap.isOpened():
            try:
                cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, config.ANCHO_CAPTURA)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, config.ALTO_CAPTURA)
            except Exception:
                pass

        self.cap = cap

    def esta_abierta(self) -> bool:
        try:
            return self.cap is not None and self.cap.isOpened()
        except Exception:
            return False

    def _preparar_matrices(self, w: int, h: int):
        focal = w * config.FOCAL_FACTOR
        self._matriz_cam = np.array(
            [[focal, 0, w / 2.0], [0, focal, h / 2.0], [0, 0, 1]], dtype=np.float32
        )
        self._nueva_matriz, _ = cv2.getOptimalNewCameraMatrix(
            self._matriz_cam, self._dist_coeffs, (w, h), alpha=0.0, newImgSize=(w, h)
        )

    def leer_fotograma(self):
        if not self.esta_abierta():
            return False, None

        try:
            ret, frame = self.cap.read()
            if not ret or frame is None:
                return False, None

            if abs(config.DISTORSION_K1) >= 0.001:
                h, w = frame.shape[:2]
                if self._matriz_cam is None:
                    self._preparar_matrices(w, h)
                frame = cv2.undistort(
                    frame, self._matriz_cam, self._dist_coeffs, None, self._nueva_matriz
                )

            frame = cv2.resize(frame, (config.ANCHO_VENTANA, config.ALTO_VENTANA))
            return True, frame
        except Exception:
            return False, None

    def capturar_fotograma_limpio(self, num_frames: int = 10):
        """Promedia varios fotogramas para eliminar líneas horizontales e interferencias al guardar."""
        acumulador = None
        validos = 0
        for _ in range(num_frames):
            ret, frame = self.leer_fotograma()
            if ret and frame is not None:
                if acumulador is None:
                    acumulador = np.zeros_like(frame, dtype=np.float32)
                acumulador += frame.astype(np.float32)
                validos += 1
        if validos == 0:
            return None
        return np.clip(acumulador / validos, 0, 255).astype(np.uint8)

    def liberar(self):
        if self.cap is not None:
            self.cap.release()
            self.cap = None
