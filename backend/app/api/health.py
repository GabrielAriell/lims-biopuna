from fastapi import APIRouter

from app.services import supabase_rest

router = APIRouter(tags=["sistema"])


@router.get("/health")
def health():
    return {
        "status": "ok",
        "supabase_configurado": supabase_rest.configurado(),
        "supabase_aviso": supabase_rest.aviso_configuracion(),
    }
