import cv2
import numpy as np
from app.services.cabina import config


class ControladorROI:
    """Permite mover y redimensionar el recuadro verde con el ratón."""

    def __init__(self, box_inicial):
        self.box = list(box_inicial)
        self.accion = None
        self.offset_x = 0
        self.offset_y = 0
        self.ancho = 0
        self.alto = 0

    def manejar_raton(self, event, x, y, flags, param):
        x1, y1, x2, y2 = self.box
        margen = 20

        if event == cv2.EVENT_LBUTTONDOWN:
            if abs(x - x2) <= margen and abs(y - y2) <= margen:
                self.accion = "REDIMENSIONAR"
            elif x1 <= x <= x2 and y1 <= y <= y2:
                self.accion = "MOVER"
                self.offset_x = x - x1
                self.offset_y = y - y1
                self.ancho = x2 - x1
                self.alto = y2 - y1

        elif event == cv2.EVENT_MOUSEMOVE:
            if self.accion == "MOVER":
                nx1 = max(0, min(config.ANCHO_VENTANA - self.ancho, x - self.offset_x))
                ny1 = max(0, min(config.ALTO_VENTANA - self.alto, y - self.offset_y))
                self.box = [nx1, ny1, nx1 + self.ancho, ny1 + self.alto]
            elif self.accion == "REDIMENSIONAR":
                nx2 = max(x1 + 40, min(config.ANCHO_VENTANA, x))
                ny2 = max(y1 + 20, min(config.ALTO_VENTANA, y))
                self.box = [x1, y1, nx2, ny2]

        elif event == cv2.EVENT_LBUTTONUP:
            self.accion = None


def dibujar_grafica_y_areas(frame, box, perfil, picos, limites, datos_bandas):
    """Dibuja la curva densitométrica, el relleno por banda y los porcentajes."""
    if len(perfil) == 0:
        return

    x1, y1, _, _ = box
    base_y = frame.shape[0] - 25
    escala_y = 1.15

    for idx, ((ini, fin), (nombre, _, porcentaje)) in enumerate(zip(limites, datos_bandas)):
        color_b = config.COLORES_BANDAS[idx % len(config.COLORES_BANDAS)]
        for px_rel in range(ini, fin):
            px_abs = x1 + px_rel
            py_abs = int(base_y - perfil[px_rel] * escala_y)
            cv2.line(frame, (px_abs, base_y), (px_abs, py_abs), color_b, 1)

        cv2.line(frame, (x1 + ini, y1), (x1 + ini, base_y), (160, 160, 160), 1, cv2.LINE_AA)
        cv2.line(frame, (x1 + fin, y1), (x1 + fin, base_y), (160, 160, 160), 1, cv2.LINE_AA)

        if idx < len(picos) and picos[idx] < len(perfil):
            pico_x = x1 + picos[idx]
            pico_y = int(base_y - perfil[picos[idx]] * escala_y)
            cv2.circle(frame, (pico_x, pico_y), 4, (0, 0, 255), -1)

            # Abreviar nombre clínico si es largo para legibilidad
            nom_corto = nombre
            if nom_corto.lower().startswith("albumina"):
                nom_corto = "Alb"
            elif nom_corto.lower().startswith("alfa"):
                nom_corto = "a" + nom_corto[4:]
            elif nom_corto.lower().startswith("beta"):
                nom_corto = "b" + nom_corto[4:]
            elif nom_corto.lower().startswith("gamma"):
                nom_corto = "g"

            cv2.putText(
                frame,
                f"{nom_corto}: {porcentaje:.1f}%",
                (pico_x - 25, max(30, pico_y - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.46,
                (255, 255, 255),
                1,
                cv2.LINE_AA,
            )

    puntos = [(x1 + i, int(base_y - val * escala_y)) for i, val in enumerate(perfil)]
    if len(puntos) > 1:
        cv2.polylines(frame, [np.array(puntos)], False, (255, 255, 255), 2, cv2.LINE_AA)


def dibujar_hud(
    frame,
    box,
    correccion_luz_activa,
    modo,
    tincion,
    num_bandas,
    luz_calibrada,
    brillo_actual,
    luz_ctrl,
    mensaje_alerta="",
    relacion_ag=None,
    modo_web=False,
):
    x1, y1, x2, y2 = box

    color_roi = (0, 255, 0) if luz_calibrada else (0, 165, 255)
    if luz_ctrl.conectado:
        estado_luz = f"LUZ {luz_ctrl.color_activo} ({luz_ctrl.intensidad}/255)"
    else:
        estado_luz = "SIN ARDUINO"

    # Recuadro ROI (en modo web se dibuja un recuadro interactivo encima, pero dejamos la guía sutil)
    if not modo_web:
        cv2.rectangle(frame, (x1, y1), (x2, y2), color_roi, 2)
        cv2.rectangle(frame, (x2 - 10, y2 - 10), (x2, y2), (255, 255, 255), -1)

    ag_txt = f" | Relacion A/G: {relacion_ag:.2f}" if relacion_ag is not None else ""

    if modo_web:
        # Panel superior limpio y 100% veraz para la interfaz web
        cv2.rectangle(frame, (10, 10), (950, 76), (15, 15, 15), -1)
        cv2.rectangle(frame, (10, 10), (950, 76), (70, 70, 70), 1)
        cv2.putText(
            frame,
            f"Densitometro Celogel | Tincion: {modo} | Fracciones: {num_bandas}{ag_txt} | {estado_luz}",
            (20, 36),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.52,
            color_roi,
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            frame,
            "Arrastra el recuadro verde sobre la tira  |  [ESPACIO] Capturar tira  |  [ESC] Cerrar",
            (20, 62),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.47,
            (0, 255, 255),
            1,
            cv2.LINE_AA,
        )
    else:
        # Panel completo para ventana de escritorio OpenCV
        cv2.rectangle(frame, (10, 10), (950, 115), (15, 15, 15), -1)
        cv2.rectangle(frame, (10, 10), (950, 115), (70, 70, 70), 1)
        cv2.putText(
            frame,
            f"Densitometro Celogel - Cabina | Modo: {modo} ({tincion}) | Fracciones: {num_bandas}{ag_txt} | {estado_luz}",
            (20, 36),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.52,
            color_roi,
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            frame,
            "Capturar: [ESPACIO] o [T] Enviar tira al sistema  |  [C] Guardar Reporte CSV  |  [Q] Salir",
            (20, 64),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.48,
            (0, 255, 255),
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            frame,
            "LEDs: [L] Correccion color  [W] Luz blanca fija  |  Tincion: [R] Roja  [B] Azul",
            (20, 92),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (220, 220, 220),
            1,
            cv2.LINE_AA,
        )

    if mensaje_alerta:
        cv2.rectangle(frame, (220, 230), (740, 280), (0, 140, 0), -1)
        cv2.rectangle(frame, (220, 230), (740, 280), (255, 255, 255), 1)
        cv2.putText(
            frame,
            mensaje_alerta,
            (235, 262),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )
