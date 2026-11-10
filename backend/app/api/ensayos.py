"""Endpoints para guardar y consultar ensayos electroforéticos."""
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import ValidationError

from app.api.deps import UsuarioActual, exigir_escritura, usuario_actual
from app.schemas.ensayos import EnsayoIn, EnsayoOut
from app.services import cloudinary, ensayos, supabase_rest

router = APIRouter(prefix="/ensayos", tags=["ensayos"])

TAMANO_MAXIMO = 15 * 1024 * 1024  # 15 MB
TIPOS_PERMITIDOS = {"image/jpeg", "image/png", "image/webp"}


def _mensaje_validacion(error: ValidationError) -> str:
    partes = []
    for detalle in error.errors():
        campo = ".".join(str(paso) for paso in detalle.get("loc", ())) or "datos"
        partes.append(f"{campo}: {detalle.get('msg')}")
    return "Datos del ensayo inválidos: " + "; ".join(partes)


@router.post("", response_model=EnsayoOut, status_code=201)
async def crear_ensayo(
    usuario: Annotated[UsuarioActual, Depends(exigir_escritura)],
    datos: str = Form(..., description="JSON con el esquema EnsayoIn"),
    imagen: UploadFile | None = File(
        None, description="Recorte de la tira ya analizada"
    ),
):
    """Recalcula las fracciones en el backend y guarda el ensayo.

    El investigador sale del token de sesión; el navegador no puede elegir a
    otra persona. La imagen es opcional para poder probar el flujo sin
    Cloudinary, pero la pantalla de guardado siempre la envía.
    """
    try:
        entrada = EnsayoIn.model_validate_json(datos)
    except ValidationError as error:
        raise HTTPException(422, _mensaje_validacion(error)) from error

    contenido: tuple[bytes, str, str] | None = None
    if imagen is not None:
        tipo = (imagen.content_type or "").lower()
        if tipo not in TIPOS_PERMITIDOS:
            raise HTTPException(415, "La imagen debe ser JPEG, PNG o WebP")
        bytes_imagen = await imagen.read()
        if not bytes_imagen:
            raise HTTPException(422, "La imagen está vacía")
        if len(bytes_imagen) > TAMANO_MAXIMO:
            raise HTTPException(413, "La imagen supera los 15 MB")
        contenido = (bytes_imagen, imagen.filename or "tira.jpg", tipo)

    try:
        return ensayos.guardar(entrada, usuario.id, contenido)
    except ensayos.EnsayoInvalido as error:
        raise HTTPException(422, str(error)) from error
    except cloudinary.CloudinaryNoConfigurado as error:
        raise HTTPException(503, str(error)) from error
    except cloudinary.CloudinaryError as error:
        raise HTTPException(error.status, str(error)) from error
    except supabase_rest.SupabaseNoConfigurado as error:
        raise HTTPException(503, str(error)) from error
    except supabase_rest.SupabaseError as error:
        if error.codigo == "23503":
            raise HTTPException(
                422, "La muestra o el investigador no existen"
            ) from error
        if error.codigo == "23514":
            raise HTTPException(
                422, "Algún valor del ensayo no cumple las reglas de la base"
            ) from error
        raise HTTPException(error.status, str(error)) from error


@router.get("", response_model=list[EnsayoOut])
def listar_ensayos(
    _usuario: Annotated[UsuarioActual, Depends(usuario_actual)],
    id_muestra: int | None = Query(None, gt=0),
):
    """Historial de ensayos, opcionalmente filtrado por muestra."""
    try:
        return ensayos.listar(id_muestra)
    except supabase_rest.SupabaseNoConfigurado as error:
        raise HTTPException(503, str(error)) from error
    except supabase_rest.SupabaseError as error:
        raise HTTPException(error.status, str(error)) from error
