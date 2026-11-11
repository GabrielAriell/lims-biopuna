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
from reportlab.graphics.charts.barcharts import HorizontalBarChart
from reportlab.graphics.shapes import Drawing
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


def _conteo_por(
    datos: list[dict[str, Any]], clave: str
) -> list[tuple[str, dict[str, int]]]:
    """Cuenta cada categoría separando con/sin convenio INTA."""
    conteo: dict[str, dict[str, int]] = {}
    for d in datos:
        nombre = str(d.get(clave) or "Sin dato")
        fila = conteo.setdefault(nombre, {"con": 0, "sin": 0})
        fila["con" if d.get("convenio_inta") else "sin"] += 1
    return sorted(
        conteo.items(), key=lambda kv: (-(kv[1]["con"] + kv[1]["sin"]), kv[0])
    )


def _bloque_resumen(
    ws: Any, titulo: str, datos: list[dict[str, Any]], clave: str
) -> None:
    """Agrega un bloque de conteos por categoría y convenio INTA."""
    filas = _conteo_por(datos, clave)
    ws.append([titulo])
    ws.cell(row=ws.max_row, column=1).font = Font(bold=True)
    total_con = 0
    total_sin = 0
    for nombre, c in filas:
        ws.append([nombre, c["con"], c["sin"], c["con"] + c["sin"]])
        total_con += c["con"]
        total_sin += c["sin"]
    ws.append(["Total", total_con, total_sin, total_con + total_sin])
    ws.cell(row=ws.max_row, column=1).font = Font(bold=True)
    ws.append([])


def filtros_exportacion(
    id_campana: int | None = None,
    especie: str | None = None,
    estado: str | None = None,
    departamento: str | None = None,
    convenio: str | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
    busqueda: str | None = None,
    investigador: str | None = None,
) -> dict[str, Any]:
    """Filtros opcionales compartidos por las exportaciones."""
    return {
        "id_campana": id_campana,
        "especie": especie,
        "estado": estado,
        "departamento": departamento,
        "convenio": convenio,
        "fecha_desde": fecha_desde,
        "fecha_hasta": fecha_hasta,
        "busqueda": busqueda,
        "investigador": investigador,
    }


def _resumen_filtros(filtros: dict[str, Any]) -> str:
    """Texto legible con los filtros aplicados a la exportación."""
    etiquetas = (
        ("id_campana", "Campaña"),
        ("especie", "Especie"),
        ("estado", "Estado"),
        ("departamento", "Departamento"),
        ("fecha_desde", "Desde"),
        ("fecha_hasta", "Hasta"),
        ("busqueda", "Búsqueda"),
        ("investigador", "Investigador"),
    )
    partes = []
    for clave, etiqueta in etiquetas:
        valor = filtros.get(clave)
        if valor:
            partes.append(f"{etiqueta}: {valor}")
    convenio = (filtros.get("convenio") or "").strip().lower()
    if convenio == "con":
        partes.append("Convenio INTA: solo con convenio")
    elif convenio == "sin":
        partes.append("Convenio INTA: solo sin convenio")
    else:
        partes.append("Convenio INTA: todos")
    return " · ".join(partes)


def _investigadores_por_muestra(
    lista: list[dict[str, Any]],
) -> dict[int, list[str]]:
    mapa: dict[int, list[str]] = {}
    for e in lista:
        nombre = e.get("investigador_nombre") or str(e.get("id_investigador") or "")
        if not nombre:
            continue
        actuales = mapa.setdefault(e["id_muestra"], [])
        if nombre not in actuales:
            actuales.append(nombre)
    return mapa


def _filtrar_muestras(
    datos: list[dict[str, Any]],
    filtros: dict[str, Any],
    investigadores: dict[int, list[str]] | None = None,
) -> list[dict[str, Any]]:
    id_campana = filtros.get("id_campana")
    especie = (filtros.get("especie") or "").strip()
    estado = (filtros.get("estado") or "").strip()
    departamento = (filtros.get("departamento") or "").strip()
    convenio = (filtros.get("convenio") or "").strip().lower()
    fecha_desde = (filtros.get("fecha_desde") or "").strip()
    fecha_hasta = (filtros.get("fecha_hasta") or "").strip()
    busqueda = (filtros.get("busqueda") or "").strip().lower()
    investigador = (filtros.get("investigador") or "").strip().lower()

    salida = []
    for d in datos:
        if id_campana and int(d["id_campana"]) != int(id_campana):
            continue
        if especie and d.get("especie") != especie:
            continue
        if estado and d.get("estado_48h") != estado:
            continue
        if departamento and d.get("departamento") != departamento:
            continue
        if convenio == "con" and not d.get("convenio_inta"):
            continue
        if convenio == "sin" and d.get("convenio_inta"):
            continue
        dia = str(d.get("fecha_hora_extraccion") or "")[:10]
        if fecha_desde and dia < fecha_desde:
            continue
        if fecha_hasta and dia > fecha_hasta:
            continue
        invs = (investigadores or {}).get(d["id_muestra"], [])
        if investigador and not any(investigador in i.lower() for i in invs):
            continue
        if busqueda:
            campos = [
                d.get("codigo_animal"),
                d.get("especie"),
                d.get("ubicacion_campana"),
                d.get("departamento"),
                d.get("localidad"),
                *invs,
            ]
            if not any(busqueda in str(c).lower() for c in campos if c):
                continue
        salida.append(d)
    return salida


def _tabla_territorial_pdf(
    filas: list[tuple[str, dict[str, int]]], total: int
) -> Table:
    datos = [["Categoría", "Con convenio", "Sin convenio", "Total", "%"]]
    total_con = 0
    total_sin = 0
    for nombre, c in filas:
        subtotal = c["con"] + c["sin"]
        total_con += c["con"]
        total_sin += c["sin"]
        porcentaje = f"{(subtotal / total * 100):.0f}%" if total else "0%"
        datos.append([nombre, str(c["con"]), str(c["sin"]), str(subtotal), porcentaje])
    datos.append(
        [
            "Total",
            str(total_con),
            str(total_sin),
            str(total_con + total_sin),
            "100%" if total else "0%",
        ]
    )
    tabla = Table(datos, colWidths=[190, 70, 70, 55, 45], repeatRows=1)
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F4E79")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    return tabla


def _grafico_territorial_pdf(
    filas: list[tuple[str, dict[str, int]]], ancho: float = 480
) -> Drawing:
    visibles = filas[:14]
    alto = max(120, 20 * len(visibles) + 30)
    dibujo = Drawing(ancho, alto)
    grafico = HorizontalBarChart()
    grafico.x = 125
    grafico.y = 10
    grafico.width = ancho - 140
    grafico.height = alto - 25
    grafico.data = [[c["con"] + c["sin"] for _, c in visibles]]
    grafico.categoryAxis.categoryNames = [
        (nombre[:24] + "…") if len(nombre) > 25 else nombre
        for nombre, _ in visibles
    ]
    grafico.categoryAxis.labels.fontSize = 7
    grafico.categoryAxis.labels.dx = -3
    grafico.valueAxis.labels.fontSize = 7
    grafico.valueAxis.valueMin = 0
    grafico.bars[0].fillColor = colors.HexColor("#1F4E79")
    grafico.barWidth = 7
    dibujo.add(grafico)
    return dibujo

@router.get("/muestras.xlsx")
def exportar_muestras(
    _usuario: Annotated[UsuarioActual, Depends(usuario_actual)],
    filtros: Annotated[dict[str, Any], Depends(filtros_exportacion)],
):
    try:
        datos = _muestras_datos()
        necesita_ensayos = bool(filtros.get("investigador") or filtros.get("busqueda"))
        investigadores = (
            _investigadores_por_muestra(ensayos.listar())
            if necesita_ensayos
            else {}
        )
        datos = _filtrar_muestras(datos, filtros, investigadores)
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
    filtros: Annotated[dict[str, Any], Depends(filtros_exportacion)],
):
    try:
        lista = ensayos.listar()
        investigadores = _investigadores_por_muestra(lista)
        datos = _filtrar_muestras(_muestras_datos(), filtros, investigadores)
        ids = {d["id_muestra"] for d in datos}
        lista = [e for e in lista if e["id_muestra"] in ids]
        muestras = {m["id_muestra"]: m for m in datos}
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


@router.get("/territorial.pdf")
def exportar_territorial_pdf(
    _usuario: Annotated[UsuarioActual, Depends(usuario_actual)],
    filtros: Annotated[dict[str, Any], Depends(filtros_exportacion)],
):
    try:
        datos = _muestras_datos()
        necesita_ensayos = bool(filtros.get("investigador") or filtros.get("busqueda"))
        investigadores = (
            _investigadores_por_muestra(ensayos.listar())
            if necesita_ensayos
            else {}
        )
        datos = _filtrar_muestras(datos, filtros, investigadores)
    except (supabase_rest.SupabaseNoConfigurado, supabase_rest.SupabaseError) as e:
        raise HTTPException(getattr(e, "status", 502), str(e)) from e

    bio = BytesIO()
    doc = SimpleDocTemplate(bio, pagesize=A4, leftMargin=36, rightMargin=36)
    estilos = getSampleStyleSheet()
    total = len(datos)
    con_convenio = sum(1 for d in datos if d.get("convenio_inta"))
    story = [
        Paragraph("Camelia Biotech · Análisis territorial", estilos["Title"]),
        Paragraph(
            f"Convenio INTA · Generado: {datetime.now():%Y-%m-%d %H:%M}",
            estilos["Normal"],
        ),
        Paragraph(
            f"Muestras incluidas: {total} · Con convenio INTA: {con_convenio} "
            f"· Sin convenio INTA: {total - con_convenio}",
            estilos["Normal"],
        ),
        Paragraph(f"Filtros aplicados: {_resumen_filtros(filtros)}", estilos["Normal"]),
        Spacer(1, 12),
    ]

    if not datos:
        story.append(
            Paragraph("No hay muestras que coincidan con los filtros.", estilos["Normal"])
        )
    else:
        secciones = (
            ("Muestras por especie", "especie"),
            ("Muestras por departamento", "departamento"),
            ("Muestras por localidad/paraje", "localidad"),
        )
        for titulo, clave in secciones:
            filas = _conteo_por(datos, clave)
            if not filas:
                continue
            story.append(Paragraph(titulo, estilos["Heading2"]))
            story.append(_tabla_territorial_pdf(filas, total))
            story.append(Spacer(1, 6))
            story.append(_grafico_territorial_pdf(filas))
            if len(filas) > 14:
                story.append(
                    Paragraph(
                        "El gráfico muestra las 14 categorías con más muestras.",
                        estilos["Normal"],
                    )
                )
            story.append(Spacer(1, 14))

    doc.build(story)
    return _pdf_respuesta(bio, f"analisis_territorial_{datetime.now():%Y%m%d}.pdf")


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
