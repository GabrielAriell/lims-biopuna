"""Exportación de reportes estandarizados (RF-05): Excel y PDF."""
from __future__ import annotations

from datetime import datetime
from io import BytesIO
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from pydantic import BaseModel, Field
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.api.deps import UsuarioActual, usuario_actual
from app.services import ensayos, supabase_rest

router = APIRouter(prefix="/reportes", tags=["reportes"])

ENCABEZADO = Font(bold=True, color="FFFFFF")
RELLENO = PatternFill("solid", fgColor="1F4E79")


def _fmt_num(valor: Any, decimales: int = 2) -> str:
    if valor is None or valor == "":
        return "-"
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return str(valor)
    texto = f"{n:.{decimales}f}".rstrip("0").rstrip(".")
    return texto if texto else "0"


def _xlsx_respuesta(wb: Workbook, nombre: str) -> StreamingResponse:
    bio = BytesIO()
    wb.save(bio)
    bio.seek(0)
    return StreamingResponse(
        bio,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )


def _pdf_respuesta(bio: BytesIO, nombre: str) -> StreamingResponse:
    bio.seek(0)
    return StreamingResponse(
        bio,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )


def _hoja(wb: Workbook, titulo: str, columnas: list[str]) -> Any:
    ws = wb.active if wb.active.title == "Sheet" else wb.create_sheet()
    ws.title = titulo[:31]
    ws.append(columnas)
    for celda in ws[1]:
        celda.font = ENCABEZADO
        celda.fill = RELLENO
        celda.alignment = Alignment(wrap_text=True)
    ws.freeze_panes = "A2"
    return ws


def _auto_ancho(ws: Any) -> None:
    for col in ws.columns:
        maximo = 10
        letra = col[0].column_letter
        for celda in col:
            valor = "" if celda.value is None else str(celda.value)
            maximo = min(max(maximo, len(valor) + 2), 45)
        ws.column_dimensions[letra].width = maximo


def _muestras_datos() -> list[dict[str, Any]]:
    filas = supabase_rest.seleccionar(
        "muestra_con_estado",
        orden="fecha_hora_extraccion.desc",
        limite=5000,
    )
    campanas = {
        c["id_campana"]: c
        for c in supabase_rest.seleccionar(
            "campana_territorio", columnas="id_campana,localidad_puna,fecha_salida"
        )
    }
    datos = []
    for f in filas:
        c = campanas.get(f["id_campana"], {})
        datos.append(
            {
                "id_muestra": f["id_muestra"],
                "codigo_animal": f["codigo_animal"],
                "especie": f["especie"],
                "id_campana": f["id_campana"],
                "ubicacion_campana": c.get("localidad_puna") or "Sin campaña",
                "fecha_salida": c.get("fecha_salida"),
                "fecha_hora_extraccion": f["fecha_hora_extraccion"],
                "horas_transcurridas": f["horas_transcurridas"],
                "estado_48h": f["estado_48h"],
                "primera_corrida": f.get("primera_corrida"),
            }
        )
    return datos


@router.get("/muestras.xlsx")
def exportar_muestras(
    _usuario: Annotated[UsuarioActual, Depends(usuario_actual)],
):
    try:
        datos = _muestras_datos()
    except (supabase_rest.SupabaseNoConfigurado, supabase_rest.SupabaseError) as e:
        raise HTTPException(getattr(e, "status", 502), str(e)) from e

    wb = Workbook()
    ws = _hoja(
        wb,
        "Muestras",
        [
            "ID muestra",
            "Código animal",
            "Especie",
            "ID campaña",
            "Ubicación campaña",
            "Fecha salida",
            "Fecha/hora extracción",
            "Horas transcurridas",
            "Estado 48 h",
            "Primera corrida",
        ],
    )
    for d in datos:
        ws.append(
            [
                d["id_muestra"],
                d["codigo_animal"],
                d["especie"],
                d["id_campana"],
                d["ubicacion_campana"],
                d["fecha_salida"],
                d["fecha_hora_extraccion"],
                d["horas_transcurridas"],
                d["estado_48h"],
                d["primera_corrida"],
            ]
        )
    _auto_ancho(ws)
    return _xlsx_respuesta(wb, f"muestras_{datetime.now():%Y%m%d}.xlsx")


@router.get("/ensayos.xlsx")
def exportar_ensayos(
    _usuario: Annotated[UsuarioActual, Depends(usuario_actual)],
):
    try:
        lista = ensayos.listar()
        muestras = {m["id_muestra"]: m for m in _muestras_datos()}
    except (supabase_rest.SupabaseNoConfigurado, supabase_rest.SupabaseError) as e:
        raise HTTPException(getattr(e, "status", 502), str(e)) from e

    wb = Workbook()
    ws_res = _hoja(
        wb,
        "Resumen ensayos",
        [
            "ID ensayo",
            "ID muestra",
            "Código animal",
            "Especie",
            "Ubicación campaña",
            "Fecha corrida",
            "Investigador",
            "Proteínas totales g/dL",
            "N° fracciones",
            "URL imagen tira",
        ],
    )
    for e in lista:
        m = muestras.get(e["id_muestra"], {})
        ws_res.append(
            [
                e["id_ensayo"],
                e["id_muestra"],
                m.get("codigo_animal"),
                m.get("especie"),
                m.get("ubicacion_campana"),
                e["fecha_corrida"],
                e.get("investigador_nombre") or str(e["id_investigador"]),
                e["proteinas_totales_g_dl"],
                len(e.get("fracciones") or []),
                e.get("url_imagen_tira"),
            ]
        )
    _auto_ancho(ws_res)

    ws = _hoja(
        wb,
        "Detalle fracciones",
        [
            "ID ensayo",
            "ID muestra",
            "Código animal",
            "Especie",
            "Ubicación campaña",
            "Fecha corrida",
            "Investigador",
            "Proteínas totales g/dL",
            "Fracción",
            "% relativo",
            "g/dL",
            "Área integrada",
            "URL imagen tira",
        ],
    )
    for e in lista:
        m = muestras.get(e["id_muestra"], {})
        base = [
            e["id_ensayo"],
            e["id_muestra"],
            m.get("codigo_animal"),
            m.get("especie"),
            m.get("ubicacion_campana"),
            e["fecha_corrida"],
            e.get("investigador_nombre") or str(e["id_investigador"]),
            e["proteinas_totales_g_dl"],
        ]
        # Una fila por fracción: repite el contexto del ensayo/muestra para
        # poder filtrar y hacer tablas dinámicas en Excel.
        fracciones = e.get("fracciones") or [{}]
        for f in fracciones:
            ws.append(
                base
                + [
                    f.get("nombre_fraccion"),
                    f.get("porcentaje_relativo"),
                    f.get("concentracion_g_dl"),
                    f.get("area_integrada"),
                    e.get("url_imagen_tira"),
                ]
            )
    _auto_ancho(ws)
    return _xlsx_respuesta(wb, f"ensayos_{datetime.now():%Y%m%d}.xlsx")


@router.get("/muestra/{id_muestra}.xlsx")
def exportar_muestra_excel(
    id_muestra: int,
    _usuario: Annotated[UsuarioActual, Depends(usuario_actual)],
):
    try:
        lista = ensayos.listar(id_muestra=id_muestra)
        muestra = _muestra_unica(id_muestra)
    except HTTPException:
        raise
    except (supabase_rest.SupabaseNoConfigurado, supabase_rest.SupabaseError) as e:
        raise HTTPException(getattr(e, "status", 502), str(e)) from e

    wb = Workbook()
    ws = _hoja(
        wb,
        "Muestra",
        ["Campo", "Valor"],
    )
    for k, v in muestra.items():
        ws.append([k, v])
    _auto_ancho(ws)
    ws2 = _hoja(
        wb,
        "Ensayos",
        [
            "ID ensayo",
            "Fecha corrida",
            "Investigador",
            "PT g/dL",
            "Fracción",
            "%",
            "g/dL",
            "Área",
        ],
    )
    for e in lista:
        for f in e.get("fracciones") or [{}]:
            ws2.append(
                [
                    e["id_ensayo"],
                    e["fecha_corrida"],
                    e.get("investigador_nombre") or str(e["id_investigador"]),
                    e["proteinas_totales_g_dl"],
                    f.get("nombre_fraccion"),
                    f.get("porcentaje_relativo"),
                    f.get("concentracion_g_dl"),
                    f.get("area_integrada"),
                ]
            )
    _auto_ancho(ws2)
    return _xlsx_respuesta(wb, f"muestra_{id_muestra}_{datetime.now():%Y%m%d}.xlsx")


def _muestra_unica(id_muestra: int) -> dict[str, Any]:
    filas = supabase_rest.seleccionar(
        "muestra_con_estado",
        filtros=[("id_muestra", f"eq.{id_muestra}")],
        limite=1,
    )
    if not filas:
        raise HTTPException(404, "La muestra no existe")
    f = filas[0]
    campanas = {
        c["id_campana"]: c
        for c in supabase_rest.seleccionar(
            "campana_territorio", columnas="id_campana,localidad_puna,fecha_salida"
        )
    }
    c = campanas.get(f["id_campana"], {})
    return {
        "ID muestra": f["id_muestra"],
        "Código animal": f["codigo_animal"],
        "Especie": f["especie"],
        "Ubicación campaña": c.get("localidad_puna") or "Sin campaña",
        "Fecha salida": c.get("fecha_salida"),
        "Fecha/hora extracción": f["fecha_hora_extraccion"],
        "Horas transcurridas": f["horas_transcurridas"],
        "Estado 48 h": f["estado_48h"],
        "Primera corrida": f.get("primera_corrida"),
    }


@router.get("/muestra/{id_muestra}.pdf")
def exportar_muestra_pdf(
    id_muestra: int,
    _usuario: Annotated[UsuarioActual, Depends(usuario_actual)],
):
    try:
        lista = ensayos.listar(id_muestra=id_muestra)
        muestra = _muestra_unica(id_muestra)
    except HTTPException:
        raise
    except (supabase_rest.SupabaseNoConfigurado, supabase_rest.SupabaseError) as e:
        raise HTTPException(getattr(e, "status", 502), str(e)) from e

    bio = BytesIO()
    doc = SimpleDocTemplate(bio, pagesize=A4, leftMargin=36, rightMargin=36)
    estilos = getSampleStyleSheet()
    story = [
        Paragraph("Camelia Biotech · Reporte de muestra", estilos["Title"]),
        Paragraph(f"Generado: {datetime.now():%Y-%m-%d %H:%M}", estilos["Normal"]),
        Spacer(1, 12),
        Paragraph("Datos de la muestra", estilos["Heading2"]),
    ]
    tabla_m = Table(
        [["Campo", "Valor"]] + [[str(k), str(v)] for k, v in muestra.items()],
        colWidths=[170, 320],
    )
    tabla_m.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F4E79")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story += [tabla_m, Spacer(1, 14), Paragraph("Ensayos y fracciones", estilos["Heading2"])]

    if not lista:
        story.append(Paragraph("Sin ensayos guardados.", estilos["Normal"]))
    for e in lista:
        story.append(
            Paragraph(
                f"Ensayo #{e['id_ensayo']} · {e['fecha_corrida']} · "
                f"PT {e['proteinas_totales_g_dl']} g/dL · "
                f"{e.get('investigador_nombre') or e['id_investigador']}",
                estilos["Heading3"],
            )
        )
        filas = [["Fracción", "%", "g/dL", "Área"]] + [
            [
                f.get("nombre_fraccion") or "-",
                _fmt_num(f.get("porcentaje_relativo")),
                _fmt_num(f.get("concentracion_g_dl")),
                _fmt_num(f.get("area_integrada")),
            ]
            for f in e.get("fracciones") or []
        ]
        t = Table(filas, colWidths=[170, 75, 75, 120], repeatRows=1)
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D9EAF7")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
                ]
            )
        )
        story += [t, Spacer(1, 10)]

    doc.build(story)
    return _pdf_respuesta(bio, f"muestra_{id_muestra}_{datetime.now():%Y%m%d}.pdf")

class FraccionLibreIn(BaseModel):
    nombre_fraccion: str
    porcentaje_relativo: float | None = None
    concentracion_g_dl: float | None = None
    area_integrada: float | None = None

class CarrilLibreIn(BaseModel):
    indice: int
    fracciones: list[FraccionLibreIn] = Field(default_factory=list)
    relacion_ag: float | None = None
    advertencias: list[str] = Field(default_factory=list)

class AnalisisLibreIn(BaseModel):
    proteinas_totales_g_dl: float | None = None
    nombre_archivo: str | None = None
    carriles: list[CarrilLibreIn] = Field(default_factory=list)

@router.post("/analisis-libre.xlsx")
def exportar_analisis_libre_excel(datos: AnalisisLibreIn):
    wb = Workbook()
    ws = _hoja(
        wb,
        "Análisis libre",
        ["Carril", "Fracción", "% relativo", "g/dL", "Área integrada", "Relación A/G"],
    )
    for c in datos.carriles:
        fracciones = c.fracciones or [FraccionLibreIn(nombre_fraccion="(sin fracciones)")]
        for f in fracciones:
            ws.append([
                c.indice,
                f.nombre_fraccion,
                f.porcentaje_relativo,
                f.concentracion_g_dl,
                f.area_integrada,
                c.relacion_ag,
            ])
    _auto_ancho(ws)
    ws2 = _hoja(wb, "Resumen", ["Campo", "Valor"])
    ws2.append(["Tipo", "Análisis libre (sin guardar)"])
    ws2.append(["Generado", datetime.now().strftime("%Y-%m-%d %H:%M")])
    ws2.append(["Archivo origen", datos.nombre_archivo or ""])
    ws2.append(["Proteínas totales g/dL", datos.proteinas_totales_g_dl])
    ws2.append(["Cantidad de carriles", len(datos.carriles)])
    _auto_ancho(ws2)
    return _xlsx_respuesta(wb, f"analisis_libre_{datetime.now():%Y%m%d_%H%M}.xlsx")

@router.post("/analisis-libre.pdf")
def exportar_analisis_libre_pdf(datos: AnalisisLibreIn):
    bio = BytesIO()
    doc = SimpleDocTemplate(bio, pagesize=A4, leftMargin=36, rightMargin=36)
    estilos = getSampleStyleSheet()
    story = [
        Paragraph("Camelia Biotech · Análisis libre de tira", estilos["Title"]),
        Paragraph(f"Generado: {datetime.now():%Y-%m-%d %H:%M}", estilos["Normal"]),
        Paragraph("Resultado no guardado en el sistema.", estilos["Italic"]),
        Spacer(1, 12),
    ]
    info = [["Campo", "Valor"],
            ["Archivo origen", datos.nombre_archivo or "-"],
            ["Proteínas totales g/dL", _fmt_num(datos.proteinas_totales_g_dl) if datos.proteinas_totales_g_dl is not None else "-"],
            ["Carriles", str(len(datos.carriles))]]
    tinfo = Table(info, colWidths=[170, 320])
    tinfo.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F4E79")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
    ]))
    story += [tinfo, Spacer(1, 14)]

    if not datos.carriles:
        story.append(Paragraph("Sin carriles analizados.", estilos["Normal"]))
    for c in datos.carriles:
        ag = f" · A/G: {_fmt_num(c.relacion_ag)}" if c.relacion_ag is not None else ""
        story.append(Paragraph(f"Carril {c.indice}{ag}", estilos["Heading3"]))
        filas = [["Fracción", "%", "g/dL", "Área"]] + [
            [
                f.nombre_fraccion or "-",
                _fmt_num(f.porcentaje_relativo),
                _fmt_num(f.concentracion_g_dl),
                _fmt_num(f.area_integrada),
            ]
            for f in (c.fracciones or [])
        ]
        if len(filas) == 1:
            filas.append(["(sin fracciones)", "-", "-", "-"])
        t = Table(filas, colWidths=[170, 75, 75, 120], repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D9EAF7")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
        ]))
        story.append(t)
        for a in c.advertencias:
            story.append(Paragraph(f"⚠ {a}", estilos["Normal"]))
        story.append(Spacer(1, 10))

    doc.build(story)
    return _pdf_respuesta(bio, f"analisis_libre_{datetime.now():%Y%m%d_%H%M}.pdf")
