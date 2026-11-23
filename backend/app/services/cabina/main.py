import csv
from datetime import datetime
import os
import cv2
import numpy as np

from app.services.cabina import config
from app.services.cabina.analisis import procesar_roi
from app.services.cabina.camara import CamaraCalibrada
from app.services.cabina.iluminacion import ControladorIluminacion
from app.services.cabina.interfaz import (
    ControladorROI,
    dibujar_grafica_y_areas,
    dibujar_hud,
)


def guardar_solo_tira(recorte_limpio: np.ndarray) -> tuple[str, str]:
    """Guarda la imagen de la tira recortada en disco."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre = f"tira_{timestamp}.png"
    ruta = os.path.join(config.CARPETA_SALIDA, nombre)
    cv2.imwrite(ruta, recorte_limpio)
    return nombre, ruta


def guardar_completo(
    frame_completo: np.ndarray,
    tincion: str,
    datos_bandas: list,
    relacion_ag: float | None = None,
) -> str:
    """Guarda la captura de la pantalla con HUD y el reporte cuantitativo en CSV."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base = f"reporte_{timestamp}"
    ruta_base = os.path.join(config.CARPETA_SALIDA, base)

    cv2.imwrite(f"{ruta_base}.png", frame_completo)
    with open(f"{ruta_base}.csv", mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow(["Densitometro Celogel - Cabina Integrada"])
        writer.writerow(["Fecha", datetime.now().strftime("%d/%m/%Y %H:%M:%S")])
        writer.writerow(["Tincion Detectada", tincion])
        if relacion_ag is not None:
            writer.writerow(["Relacion A/G", f"{relacion_ag:.2f}"])
        writer.writerow([])
        writer.writerow(["Fraccion / Banda", "Area Relativa", "Porcentaje (%)"])
        for banda, area, pct in datos_bandas:
            writer.writerow([banda, area, pct])
    return base


def ejecutar_cabina(
    modo_inicial: str = "AUTO",
    cerrar_al_capturar: bool = False,
) -> dict:
    """Inicia la interfaz de escaneo/densitometría de la cabina.

    Si cerrar_al_capturar es True (usado al invocar desde la aplicación web),
    al presionar [ESPACIO] o [T] captura el fotograma limpio de la tira,
    cierra la ventana y devuelve los datos con la imagen.
    """
    cam = CamaraCalibrada()
    if not cam.esta_abierta():
        raise RuntimeError(
            f"No se pudo abrir la cámara USB (índice {cam.indice}). "
            "Verificá que el cable de la cabina esté conectado."
        )

    luz = ControladorIluminacion()
    roi_ctrl = ControladorROI(config.ROI_INICIAL)

    nombre_ventana = "Densitometro Celogel - Cabina Integrada"
    cv2.namedWindow(nombre_ventana, cv2.WINDOW_AUTOSIZE)
    cv2.setMouseCallback(nombre_ventana, roi_ctrl.manejar_raton)

    correccion_luz_activa = False
    modo_actual = modo_inicial
    mensaje_captura = ""
    tiempo_mensaje = 0
    resultado_captura = {
        "exito": False,
        "capturado": False,
        "cancelado": False,
    }

    try:
        while True:
            ret, frame = cam.leer_fotograma()
            if not ret or frame is None:
                continue

            x1, y1, x2, y2 = roi_ctrl.box

            # 1. Procesamiento densitométrico REAL del sistema en vivo
            (
                tincion,
                canal_idx,
                perfil,
                picos,
                limites,
                datos_bandas,
                relacion_ag,
            ) = procesar_roi(frame, roi_ctrl.box, modo_actual)

            # 2. Control de iluminación con tira LED por Arduino
            if correccion_luz_activa:
                luz.configurar_espectro_tincion(tincion)
                luz_calibrada, brillo_actual = luz.regular_brillo(
                    frame, roi_ctrl.box, canal_idx
                )
            else:
                luz_calibrada = True
                recorte = frame[y1:y2, x1:x2]
                brillo_actual = (
                    float(recorte[:, :, canal_idx].mean()) if recorte.size > 0 else 0.0
                )

            # 3. Dibujar gráficas, bandas y HUD en el frame
            dibujar_grafica_y_areas(
                frame, roi_ctrl.box, perfil, picos, limites, datos_bandas
            )
            aviso = mensaje_captura if tiempo_mensaje > 0 else ""
            dibujar_hud(
                frame,
                roi_ctrl.box,
                correccion_luz_activa,
                modo_actual,
                tincion,
                len(datos_bandas),
                luz_calibrada,
                brillo_actual,
                luz,
                aviso,
                relacion_ag,
            )

            if tiempo_mensaje > 0:
                tiempo_mensaje -= 1

            cv2.imshow(nombre_ventana, frame)

            # 4. Manejo de eventos de teclado
            tecla = cv2.waitKey(1) & 0xFF

            # [Q] o [ESC] -> Salir sin capturar
            if tecla in (ord("q"), ord("Q"), 27):
                resultado_captura["cancelado"] = True
                break

            # [ESPACIO] o [T] -> Capturar fotograma limpio de la tira
            elif tecla in (ord("t"), ord("T"), ord(" "), 13):
                foto_limpia = cam.capturar_fotograma_limpio(num_frames=10)
                if foto_limpia is not None:
                    recorte_tira = foto_limpia[y1:y2, x1:x2]
                    nombre, ruta = guardar_solo_tira(recorte_tira)
                    mensaje_captura = f"Tira capturada: {nombre}"
                    tiempo_mensaje = 45
                    print(f"[Cabina] Tira guardada en {ruta}")

                    resultado_captura.update(
                        {
                            "exito": True,
                            "capturado": True,
                            "nombre_archivo": nombre,
                            "ruta_archivo": ruta,
                            "tincion": tincion,
                            "recorte_bgr": recorte_tira,
                            "frame_completo_bgr": foto_limpia,
                            "datos_bandas": datos_bandas,
                            "relacion_ag": relacion_ag,
                        }
                    )
                    if cerrar_al_capturar:
                        break

            # [C] -> Guardar reporte completo con frame y CSV
            elif tecla in (ord("c"), ord("C")):
                base_rep = guardar_completo(frame, tincion, datos_bandas, relacion_ag)
                mensaje_captura = f"Reporte guardado: {base_rep}"
                tiempo_mensaje = 45
                print(f"[Cabina] Reporte guardado en {config.CARPETA_SALIDA}/{base_rep}")

            # [L] -> Alternar corrección automática de espectro de luz
            elif tecla in (ord("l"), ord("L")):
                correccion_luz_activa = not correccion_luz_activa
                if not correccion_luz_activa:
                    luz.activar_luz_blanca()
                    print("[Cabina] LEDs -> LUZ BLANCA FIJA")
                else:
                    print("[Cabina] LEDs -> CORRECCIÓN AUTOMÁTICA ACTIVADA")

            # [W] o [1] -> Forzar luz blanca fija
            elif tecla in (ord("w"), ord("W"), ord("1")):
                correccion_luz_activa = False
                luz.activar_luz_blanca()
                print("[Cabina] LEDs -> LUZ BLANCA FIJA")

            # [A] -> Modo automático de tinción
            elif tecla in (ord("a"), ord("A")):
                modo_actual = "AUTO"

            # [R] -> Forzar tinción ROJA
            elif tecla in (ord("r"), ord("R")):
                modo_actual = "ROJA"

            # [B] -> Forzar tinción AZUL
            elif tecla in (ord("b"), ord("B")):
                modo_actual = "AZUL"

    finally:
        cam.liberar()
        try:
            cv2.destroyAllWindows()
        except Exception:
            pass
        luz.apagar_y_cerrar()
        print("[Cabina] Sistema detenido y LEDs apagados.")

    return resultado_captura


def main():
    print("Iniciando Densitometro Celogel - Cabina Integrada...")
    ejecutar_cabina(cerrar_al_capturar=False)


if __name__ == "__main__":
    main()
