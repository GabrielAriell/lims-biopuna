"""Endpoints para el control, streaming en vivo y captura desde la Cabina Densitométrica."""
import base64
import cv2
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.cabina import config
from app.services.cabina.gestor import gestor_cabina, detectar_camaras_con_nombre
from app.services.cabina.main import ejecutar_cabina

router = APIRouter(prefix="/cabina", tags=["cabina"])


class AjustesCabina(BaseModel):
    camara_idx: int | None = None
    roi: list[int] | None = None
    modo_tincion: str | None = None
    color_luz_manual: str | None = None
    correccion_luz: bool | None = None


@router.get("/estado")
def obtener_estado_cabina():
    """Consulta el estado del hardware, cámaras reales detectadas y color de luces."""
    camaras = gestor_cabina.camaras_disponibles
    if not camaras:
        camaras = detectar_camaras_con_nombre()
        gestor_cabina.camaras_disponibles = camaras

    cam_actual_ok = gestor_cabina.cam is not None and gestor_cabina.cam.esta_abierta()
    luz = gestor_cabina.obtener_iluminacion()

    return {
        "disponible": True,
        "camara_conectada": cam_actual_ok,
        "camara_actual": gestor_cabina.camara_idx,
        "camaras_disponibles": camaras,
        "roi_actual": gestor_cabina.roi,
        "ancho_ventana": config.ANCHO_VENTANA,
        "alto_ventana": config.ALTO_VENTANA,
        "modo_tincion": gestor_cabina.modo_tincion,
        "color_luz_activo": luz.color_activo if luz else "BLANCO",
        "arduino_conectado": luz.conectado if luz else False,
        "puerto_arduino": config.PUERTO_ARDUINO,
    }


@router.get("/video_feed")
def stream_video_cabina():
    """Transmite en tiempo real el video calibrado con la gráfica densitométrica y fracciones."""
    return StreamingResponse(
        gestor_cabina.generar_mjpeg(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.post("/ajustar")
def ajustar_cabina(ajustes: AjustesCabina):
    """Permite cambiar la cámara activa, el recuadro verde (ROI) o el modo de tinción / iluminación."""
    if ajustes.camara_idx is not None:
        gestor_cabina.cambiar_camara(ajustes.camara_idx)
    if ajustes.roi is not None and len(ajustes.roi) == 4:
        gestor_cabina.actualizar_roi(*ajustes.roi)
    if ajustes.modo_tincion is not None:
        gestor_cabina.set_modo_tincion(ajustes.modo_tincion)
    if ajustes.color_luz_manual is not None:
        gestor_cabina.set_color_led_directo(ajustes.color_luz_manual)
    if ajustes.correccion_luz is not None:
        gestor_cabina.correccion_luz = ajustes.correccion_luz

    luz = gestor_cabina.obtener_iluminacion()
    return {
        "ok": True,
        "camara_idx": gestor_cabina.camara_idx,
        "roi": gestor_cabina.roi,
        "modo_tincion": gestor_cabina.modo_tincion,
        "color_luz_activo": luz.color_activo if luz else "APAGADO",
        "arduino_conectado": luz.conectado if luz else False,
    }


@router.post("/captura-limpia")
def captura_limpia():
    """Captura un fotograma limpio (10 cuadros promediados) de la tira y lo envía al frontend."""
    try:
        res = gestor_cabina.capturar_limpio()
        data_url = "data:image/png;base64," + base64.b64encode(res["buffer"]).decode("ascii")

        bandas = [
            {"nombre": b[0], "area": b[1], "porcentaje": b[2]}
            for b in res.get("datos_bandas", [])
        ]

        return {
            "exito": True,
            "capturado": True,
            "nombre_archivo": res["nombre_archivo"],
            "imagen_data_url": data_url,
            "tincion": res["tincion"],
            "relacion_ag": res["relacion_ag"],
            "datos_bandas": bandas,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/capturar")
def iniciar_captura_cabina_ventana():
    """Abre la ventana OpenCV interactiva tradicional en el escritorio local."""
    try:
        resultado = ejecutar_cabina(cerrar_al_capturar=True)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al ejecutar la ventana de la cabina: {str(e)}",
        )

    if resultado.get("cancelado") or not resultado.get("capturado"):
        return {
            "exito": False,
            "capturado": False,
            "cancelado": True,
            "mensaje": "Captura cancelada.",
        }

    recorte_bgr = resultado.get("recorte_bgr")
    if recorte_bgr is None or recorte_bgr.size == 0:
        raise HTTPException(status_code=500, detail="No se obtuvo imagen.")

    ok, buffer = cv2.imencode(".png", recorte_bgr)
    if not ok:
        raise HTTPException(status_code=500, detail="Error al codificar imagen.")

    data_url = "data:image/png;base64," + base64.b64encode(buffer).decode("ascii")
    bandas = [
        {"nombre": b[0], "area": b[1], "porcentaje": b[2]}
        for b in resultado.get("datos_bandas", [])
    ]

    return {
        "exito": True,
        "capturado": True,
        "nombre_archivo": resultado.get("nombre_archivo", "captura_tira.png"),
        "imagen_data_url": data_url,
        "tincion": resultado.get("tincion", "ROJA"),
        "relacion_ag": resultado.get("relacion_ag"),
        "datos_bandas": bandas,
    }
