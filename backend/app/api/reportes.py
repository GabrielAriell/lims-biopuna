"""Exportación de reportes estandarizados (RF-05): Excel y PDF."""
from __future__ import annotations

from datetime import datetime
from io import BytesIO
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
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


def _campanas_datos() -> dict[int, dict[str, Any]]:
    """Campañas con ubicación legible y convenio, para exportar y agregar."""
    from app.api.muestras import (
        _columnas_campana,
        _mapa_geo,
        _ubicacion_legible,
    )

    campanas = supabase_rest.seleccionar(
        "campana_territorio", columnas=_columnas_campana()
    )
    departamentos, provincias = _mapa_geo()
    salida: dict[int, dict[str, Any]] = {}
    for c in campanas:
        legible, detalle, _id_dep, dep, _id_prov, prov = _ubicacion_legible(
            c, departamentos, provincias
        )
        salida[c["id_campana"]] = {
            "localidad_puna": legible,
            "departamento": dep or "Sin departamento",
            "localidad": detalle
            or (legible.split(" · ")[0] if legible else "Sin localidad"),
            "provincia": prov,
            "convenio_inta": bool(c.get("convenio_inta")),
            "fecha_salida": c.get("fecha_salida"),
        }
    return salida


def _muestras_datos() -> list[dict[str, Any]]:
    filas = supabase_rest.seleccionar(
        "muestra_con_estado",
        orden="fecha_hora_extraccion.desc",
        limite=5000,
    )
    campanas = _campanas_datos()
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
                "departamento": c.get("departamento") or "Sin departamento",
                "localidad": c.get("localidad") or "Sin localidad",
                "provincia": c.get("provincia"),
                "convenio_inta": bool(c.get("convenio_inta")),
                "fecha_salida": c.get("fecha_salida"),
                "fecha_hora_extraccion": f["fecha_hora_extraccion"],
                "horas_transcurridas": f["horas_transcurridas"],
                "estado_48h": f["estado_48h"],
                "primera_corrida": f.get("primera_corrida"),
            }
        )
    return datos


def _bloque_resumen(
    ws: Any, titulo: str, datos: list[dict[str, Any]], clave: str
) -> None:
    """Agrega un bloque de conteos por categoría y convenio INTA."""
    conteo: dict[str, dict[str, int]] = {}
    for d in datos:
        nombre = str(d.get(clave) or "Sin dato")
        fila = conteo.setdefault(nombre, {"con": 0, "sin": 0})
        fila["con" if d.get("convenio_inta") else "sin"] += 1

    ws.append([titulo])
    ws.cell(row=ws.max_row, column=1).font = Font(bold=True)
    total_con = 0
    total_sin = 0
    for nombre, c in sorted(
        conteo.items(), key=lambda kv: (-(kv[1]["con"] + kv[1]["sin"]), kv[0])
    ):
        ws.append([nombre, c["con"], c["sin"], c["con"] + c["sin"]])
        total_con += c["con"]
        total_sin += c["sin"]
    ws.append(["Total", total_con, total_sin, total_con + total_sin])
    ws.cell(row=ws.max_row, column=1).font = Font(bold=True)
    ws.append([])

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
            "Departamento",
            "Localidad/paraje",
            "Provincia",
            "Convenio INTA",
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
                d["departamento"],
                d["localidad"],
                d["provincia"],
                "Sí" if d["convenio_inta"] else "No",
                d["fecha_salida"],
                d["fecha_hora_extraccion"],
                d["horas_transcurridas"],
                d["estado_48h"],
                d["primera_corrida"],
            ]
        )
    _auto_ancho(ws)

    ws_res = _hoja(
        wb,
        "Resumen territorial",
        ["Categoría", "Con convenio INTA", "Sin convenio INTA", "Total"],
    )
    _bloque_resumen(ws_res, "Por especie", datos, "especie")
    _bloque_resumen(ws_res, "Por departamento", datos, "departamento")
    _bloque_resumen(ws_res, "Por localidad/paraje", datos, "localidad")
    _auto_ancho(ws_res)

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
            "Departamento",
            "Convenio INTA",
            "Fecha corrida",
            "Investigador",
            "Proteínas totales g/dL",
            "A/G",
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
                m.get("departamento"),
                "Sí" if m.get("convenio_inta") else "No",
                e["fecha_corrida"],
                e.get("investigador_nombre") or str(e["id_investigador"]),
                e["proteinas_totales_g_dl"],
                e.get("relacion_ag"),
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
            "Departamento",
            "Convenio INTA",
            "Fecha corrida",
            "Investigador",
            "Proteínas totales g/dL",
            "A/G",
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
            m.get("departamento"),
            "Sí" if m.get("convenio_inta") else "No",
            e["fecha_corrida"],
            e.get("investigador_nombre") or str(e["id_investigador"]),
            e["proteinas_totales_g_dl"],
            e.get("relacion_ag"),
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
            "A/G",
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
                    e.get("relacion_ag"),
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
    c = _campanas_datos().get(f["id_campana"], {})
    return {
        "ID muestra": f["id_muestra"],
        "Código animal": f["codigo_animal"],
        "Especie": f["especie"],
        "Ubicación campaña": c.get("localidad_puna") or "Sin campaña",
        "Departamento": c.get("departamento") or "Sin departamento",
        "Localidad/paraje": c.get("localidad") or "Sin localidad",
        "Provincia": c.get("provincia") or "Sin provincia",
        "Convenio INTA": "Sí" if c.get("convenio_inta") else "No",
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
        ag = e.get("relacion_ag")
        ag_txt = f" · A/G {_fmt_num(ag, 3)}" if ag is not None else ""
        story.append(
            Paragraph(
                f"Ensayo #{e['id_ensayo']} · {e['fecha_corrida']} · "
                f"PT {e['proteinas_totales_g_dl']} g/dL{ag_txt} · "
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
