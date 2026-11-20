"""Exportación de reportes estandarizados (RF-05): Excel y PDF."""
from __future__ import annotations

from datetime import datetime
from io import BytesIO
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.chart import BarChart, PieChart, Reference
from openpyxl.chart.label import DataLabelList
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
) -> tuple[int, int]:
    """Agrega un bloque de conteos y devuelve el rango de filas de datos."""
    filas = _conteo_por(datos, clave)
    ws.append([titulo])
    ws.cell(row=ws.max_row, column=1).font = Font(bold=True)
    total_con = 0
    total_sin = 0
    primera = ws.max_row + 1
    for nombre, c in filas:
        ws.append([nombre, c["con"], c["sin"], c["con"] + c["sin"]])
        total_con += c["con"]
        total_sin += c["sin"]
    ultima = ws.max_row
    ws.append(["Total", total_con, total_sin, total_con + total_sin])
    ws.cell(row=ws.max_row, column=1).font = Font(bold=True)
    ws.append([])
    return primera, ultima


def _grafico_barras(
    ws_origen: Any,
    ws_destino: Any,
    rango: tuple[int, int],
    titulo: str,
    ancla: str,
) -> None:
    """Agrega un gráfico de barras horizontales con el total por categoría."""
    primera, ultima = rango
    if ultima < primera:
        return
    categorias = Reference(ws_origen, min_col=1, min_row=primera, max_row=ultima)
    valores = Reference(ws_origen, min_col=4, min_row=primera, max_row=ultima)
    grafico = BarChart()
    grafico.type = "bar"
    grafico.style = 10
    grafico.title = titulo
    grafico.x_axis.title = "Categoría"
    grafico.y_axis.title = "Muestras"
    grafico.add_data(valores, titles_from_data=False)
    grafico.set_categories(categorias)
    grafico.legend = None
    grafico.dataLabels = DataLabelList()
    grafico.dataLabels.showVal = True
    grafico.height = max(8, 0.5 * (ultima - primera + 1) + 3)
    grafico.width = 18
    ws_destino.add_chart(grafico, ancla)


def _grafico_torta(
    ws_origen: Any,
    ws_destino: Any,
    rango: tuple[int, int],
    titulo: str,
    ancla: str,
) -> None:
    """Agrega un gráfico de torta con el total por categoría."""
    primera, ultima = rango
    if ultima < primera:
        return
    categorias = Reference(ws_origen, min_col=1, min_row=primera, max_row=ultima)
    valores = Reference(ws_origen, min_col=4, min_row=primera, max_row=ultima)
    grafico = PieChart()
    grafico.title = titulo
    grafico.add_data(valores, titles_from_data=False)
    grafico.set_categories(categorias)
    grafico.dataLabels = DataLabelList()
    grafico.dataLabels.showVal = True
    grafico.height = 9
    grafico.width = 18
    ws_destino.add_chart(grafico, ancla)


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
    rango_especie = _bloque_resumen(ws_res, "Por especie", datos, "especie")
    rango_departamento = _bloque_resumen(
        ws_res, "Por departamento", datos, "departamento"
    )
    rango_localidad = _bloque_resumen(
        ws_res, "Por localidad/paraje", datos, "localidad"
    )
    _auto_ancho(ws_res)

    # Hoja de gráficos: refleja exactamente los datos filtrados del export.
    ws_graf = wb.create_sheet("Gráficos")
    ws_graf["A1"] = "Camelia Biotech · Análisis territorial"
    ws_graf["A1"].font = Font(bold=True, size=14)
    ws_graf["A2"] = f"Filtros aplicados: {_resumen_filtros(filtros)}"
    ws_graf["A3"] = (
        f"Muestras incluidas: {len(datos)} · Con convenio INTA: "
        f"{sum(1 for d in datos if d['convenio_inta'])} · Sin convenio INTA: "
        f"{sum(1 for d in datos if not d['convenio_inta'])}"
    )
    _grafico_torta(ws_res, ws_graf, rango_especie, "Muestras por especie", "B5")
    _grafico_barras(
        ws_res,
        ws_graf,
        rango_departamento,
        "Muestras por departamento",
        "B24",
    )
    _grafico_barras(
        ws_res,
        ws_graf,
        rango_localidad,
        "Muestras por localidad/paraje",
        "B44",
    )

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


### Metricas de salud ###
import math


def _stats_lista(valores: list[float]) -> dict[str, float | int | None]:
    """Calcula n, media, desvío estándar, mínimo y máximo de una lista."""
    n = len(valores)
    if n == 0:
        return {"n": 0, "media": None, "desvio": None, "min": None, "max": None}
    media = sum(valores) / n
    varianza = sum((x - media) ** 2 for x in valores) / (n - 1) if n > 1 else 0.0
    return {
        "n": n,
        "media": round(media, 3),
        "desvio": round(math.sqrt(varianza), 3),
        "min": round(min(valores), 3),
        "max": round(max(valores), 3),
    }


def _normalizar_fraccion(nombre: str | None) -> str:
    """Agrupa variantes de escritura (Alfa 1 / Alfa I / α1) en nombres uniformes."""
    raw = (nombre or "").strip().lower()
    if "alb" in raw:
        return "Albúmina"
    if ("alfa" in raw or "α" in raw) and ("2" in raw or "ii" in raw):
        return "Alfa II"
    if "alfa" in raw or "α" in raw:
        return "Alfa I"
    if "beta" in raw or "β" in raw:
        return "Beta"
    if ("gama" in raw or "gamma" in raw or "γ" in raw) and ("2" in raw or "ii" in raw):
        return "Gama II"
    if "gama" in raw or "gamma" in raw or "γ" in raw:
        return "Gama I"
    return (nombre or "Otra").strip()


def _resumir_registros_salud(registros: list[dict[str, Any]]) -> dict[str, Any]:
    """Resume métricas globales y agrupadas (por especie, departamento y localidad)."""
    ags = [r["relacion_ag"] for r in registros if r["relacion_ag"] is not None]
    pts = [r["proteinas_totales"] for r in registros if r["proteinas_totales"] is not None]

    # Medias por fracción (% y g/dL)
    orden_fracs = ["Albúmina", "Alfa I", "Alfa II", "Beta", "Gama I", "Gama II"]
    fracs_pct: dict[str, list[float]] = {k: [] for k in orden_fracs}
    fracs_gdl: dict[str, list[float]] = {k: [] for k in orden_fracs}

    for r in registros:
        for f in r["fracciones"]:
            clave = _normalizar_fraccion(f.get("nombre_fraccion"))
            if clave not in fracs_pct:
                fracs_pct[clave] = []
                fracs_gdl[clave] = []
            if f.get("porcentaje_relativo") is not None:
                fracs_pct[clave].append(float(f["porcentaje_relativo"]))
            if f.get("concentracion_g_dl") is not None:
                fracs_gdl[clave].append(float(f["concentracion_g_dl"]))

    fracciones_resumen = []
    for nombre in list(fracs_pct.keys()):
        if fracs_pct[nombre] or fracs_gdl[nombre]:
            fracciones_resumen.append(
                {
                    "fraccion": nombre,
                    "porcentaje": _stats_lista(fracs_pct[nombre]),
                    "g_dl": _stats_lista(fracs_gdl[nombre]),
                }
            )

    def _agrupar(campo: str) -> list[dict[str, Any]]:
        grupos: dict[str, list[dict[str, Any]]] = {}
        for r in registros:
            etiqueta = str(r.get(campo) or "Sin dato")
            grupos.setdefault(etiqueta, []).append(r)

        filas = []
        for nombre, items in grupos.items():
            g_ag = [x["relacion_ag"] for x in items if x["relacion_ag"] is not None]
            g_pt = [x["proteinas_totales"] for x in items if x["proteinas_totales"] is not None]
            g_alb = []
            for x in items:
                for f in x["fracciones"]:
                    if _normalizar_fraccion(f.get("nombre_fraccion")) == "Albúmina" and f.get("porcentaje_relativo") is not None:
                        g_alb.append(float(f["porcentaje_relativo"]))
            filas.append(
                {
                    "grupo": nombre,
                    "ensayos": len(items),
                    "animales": len({x["id_muestra"] for x in items}),
                    "relacion_ag": _stats_lista(g_ag),
                    "proteinas_totales": _stats_lista(g_pt),
                    "albumina_pct": _stats_lista(g_alb),
                }
            )
        return sorted(filas, key=lambda x: (-x["ensayos"], x["grupo"]))

    return {
        "total_ensayos": len(registros),
        "total_animales": len({r["id_muestra"] for r in registros}),
        "relacion_ag": _stats_lista(ags),
        "proteinas_totales": _stats_lista(pts),
        "fracciones": fracciones_resumen,
        "por_especie": _agrupar("especie"),
        "por_departamento": _agrupar("departamento"),
        "por_localidad": _agrupar("localidad"),
        "por_campana": _agrupar("ubicacion_campana"),
    }


def _serie_estacional(registros: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Agrupa los ensayos automáticamente por estación climática (Hemisferio Sur) en orden cronológico."""
    grupos: dict[tuple[int, int], dict[str, Any]] = {}

    for r in registros:
        fecha = r.get("fecha") or ""
        if len(fecha) < 7:
            continue
        try:
            anio = int(fecha[:4])
            mes = int(fecha[5:7])
        except ValueError:
            continue

        # Hemisferio Sur (Jujuy / Puna):
        # Dic-Feb -> Verano | Mar-May -> Otoño | Jun-Ago -> Invierno | Sep-Nov -> Primavera
        if mes == 12:
            anio_est, orden_est, nombre_est = anio + 1, 1, "Verano"
        elif mes in (1, 2):
            anio_est, orden_est, nombre_est = anio, 1, "Verano"
        elif mes in (3, 4, 5):
            anio_est, orden_est, nombre_est = anio, 2, "Otoño"
        elif mes in (6, 7, 8):
            anio_est, orden_est, nombre_est = anio, 3, "Invierno"
        else:
            anio_est, orden_est, nombre_est = anio, 4, "Primavera"

        clave = (anio_est, orden_est)
        bucket = grupos.setdefault(
            clave,
            {
                "anio": anio_est,
                "orden": orden_est,
                "estacion": nombre_est,
                "items": [],
            },
        )
        bucket["items"].append(r)

    # Numerar correlativamente cada estación que aparece ("1° Verano 2026", "1° Invierno 2026", "2° Verano 2027"...)
    contador_estacion: dict[str, int] = {}
    serie = []
    for clave in sorted(grupos.keys()):
        b = grupos[clave]
        est = b["estacion"]
        contador_estacion[est] = contador_estacion.get(est, 0) + 1
        num = contador_estacion[est]

        items = b["items"]
        ags = [x["relacion_ag"] for x in items if x["relacion_ag"] is not None]
        pts = [x["proteinas_totales"] for x in items if x["proteinas_totales"] is not None]
        albs = []
        for x in items:
            for f in x["fracciones"]:
                if _normalizar_fraccion(f.get("nombre_fraccion")) == "Albúmina" and f.get("porcentaje_relativo") is not None:
                    albs.append(float(f["porcentaje_relativo"]))

        serie.append(
            {
                "clave": f"{b['anio']}-{b['orden']}",
                "etiqueta": f"{num}° {est} {b['anio']}",
                "estacion": est,
                "anio": b["anio"],
                "animales": len({x["id_muestra"] for x in items}),
                "ensayos": len(items),
                "relacion_ag": _stats_lista(ags),
                "proteinas_totales": _stats_lista(pts),
                "albumina_pct": _stats_lista(albs),
            }
        )
    return serie


import logging
import os

logger = logging.getLogger(__name__)


def _sin_credenciales_supabase() -> bool:
    """Detecta si el entorno local no tiene configurada una URL real de Supabase."""
    url = (os.getenv("SUPABASE_URL") or "").strip().lower()
    return (not url) or ("tu-proyecto" in url) or ("localhost" in url)


@router.get("/salud-poblacional")
def obtener_salud_poblacional(
    # En producción con Supabase activo, descomenta la línea de abajo para exigir sesión:
    _usuario: Annotated[UsuarioActual, Depends(usuario_actual)],
    especie: str | None = None,
    departamento: str | None = None,
    localidad: str | None = None,
    id_campana: int | None = None,
    convenio: str | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
    comp_desde: str | None = None,
    comp_hasta: str | None = None,
):
    """Calcula medias de salud animal (Relación A/G, PT y fracciones) y compara temporadas."""
    usar_demo = _sin_credenciales_supabase()

    if not usar_demo:
        try:
            lista_ensayos = ensayos.listar()
            muestras = _muestras_datos()
        except Exception as exc:
            # Si falló por DNS/red local sin Supabase, caemos a demo; si es un error real de BD, mostramos el log completo
            msg = str(exc).lower()
            if "getaddrinfo failed" in msg or "name or service not known" in msg:
                logger.warning("Sin conexión DNS a Supabase; usando dataset local de demostración: %s", exc)
                usar_demo = True
            else:
                logger.exception("Error real consultando ensayos/muestras en Supabase")
                raise

    if usar_demo:
        # 6 temporadas cronológicas (36 muestras) para entorno local sin credenciales
        temporadas_demo = [
            ("2025-07-15", 1, 1.02, 5.45, 50.2),  # 1° Invierno 2025 (Mal estado nutricional)
            ("2025-10-18", 2, 1.24, 5.95, 54.8),  # 1° Primavera 2025 (Recuperación inicial)
            ("2026-02-14", 3, 1.48, 6.45, 59.4),  # 1° Verano 2026 (Buen estado)
            ("2026-04-20", 4, 1.39, 6.28, 57.9),  # 1° Otoño 2026 (Transición)
            ("2026-07-19", 5, 1.31, 6.12, 56.3),  # 2° Invierno 2026 (Baja levemente en seca)
            ("2027-02-12", 6, 1.66, 6.85, 62.5),  # 2° Verano 2027 (Pico máximo en verano lluvioso)
        ]
        animales_base = [
            ("LL-01", "Llama", "Abra Pampa · Cochinoca · Jujuy", "Cochinoca", "Abra Pampa", True, 0.04, 0.15, 0.8),
            ("LL-02", "Llama", "Abra Pampa · Cochinoca · Jujuy", "Cochinoca", "Abra Pampa", True, -0.02, -0.05, -0.4),
            ("OV-10", "Oveja", "Humahuaca · Humahuaca · Jujuy", "Humahuaca", "Humahuaca", False, -0.08, -0.22, -1.5),
            ("OV-11", "Oveja", "Humahuaca · Humahuaca · Jujuy", "Humahuaca", "Humahuaca", False, -0.05, -0.14, -1.0),
            ("VI-04", "Vicuña", "Susques · Susques · Jujuy", "Susques", "Susques", True, 0.09, 0.25, 1.6),
            ("VI-05", "Vicuña", "Susques · Susques · Jujuy", "Susques", "Susques", True, 0.02, 0.06, 0.5),
        ]

        muestras = []
        lista_ensayos = []
        seq = 1
        for fecha_m, id_camp, ag_base, pt_base, alb_base in temporadas_demo:
            for cod, esp, ubic, dep, loc, conv, d_ag, d_pt, d_alb in animales_base:
                ag = round(ag_base + d_ag, 2)
                pt = round(pt_base + d_pt, 2)
                alb_pct = round(alb_base + d_alb, 1)
                resto = round(100.0 - alb_pct, 1)
                a1_pct = round(resto * 0.09, 1)
                a2_pct = round(resto * 0.23, 1)
                be_pct = round(resto * 0.20, 1)
                g1_pct = round(resto * 0.39, 1)
                g2_pct = round(resto - (a1_pct + a2_pct + be_pct + g1_pct), 1)

                muestras.append(
                    {
                        "id_muestra": seq,
                        "codigo_animal": cod,
                        "especie": esp,
                        "id_campana": id_camp,
                        "ubicacion_campana": ubic,
                        "departamento": dep,
                        "localidad": loc,
                        "convenio_inta": conv,
                        "fecha_hora_extraccion": f"{fecha_m}T09:15:00",
                    }
                )
                lista_ensayos.append(
                    {
                        "id_ensayo": seq,
                        "id_muestra": seq,
                        "fecha_corrida": fecha_m,
                        "proteinas_totales_g_dl": pt,
                        "relacion_ag": ag,
                        "fracciones": [
                            {"nombre_fraccion": "Albúmina", "porcentaje_relativo": alb_pct, "concentracion_g_dl": round(pt * alb_pct / 100, 2)},
                            {"nombre_fraccion": "Alfa I", "porcentaje_relativo": a1_pct, "concentracion_g_dl": round(pt * a1_pct / 100, 2)},
                            {"nombre_fraccion": "Alfa II", "porcentaje_relativo": a2_pct, "concentracion_g_dl": round(pt * a2_pct / 100, 2)},
                            {"nombre_fraccion": "Beta", "porcentaje_relativo": be_pct, "concentracion_g_dl": round(pt * be_pct / 100, 2)},
                            {"nombre_fraccion": "Gama I", "porcentaje_relativo": g1_pct, "concentracion_g_dl": round(pt * g1_pct / 100, 2)},
                            {"nombre_fraccion": "Gama II", "porcentaje_relativo": g2_pct, "concentracion_g_dl": round(pt * g2_pct / 100, 2)},
                        ],
                    }
                )
                seq += 1

    mapa_muestras = {m["id_muestra"]: m for m in muestras}

    # Cruzar cada ensayo con los metadatos territoriales y de especie de su muestra
    registros_base: list[dict[str, Any]] = []
    especies_disp: set[str] = set()
    deptos_disp: set[str] = set()
    localidades_disp: set[str] = set()
    campanas_disp: dict[int, str] = {}

    for e in lista_ensayos:
        m = mapa_muestras.get(e["id_muestra"])
        if not m:
            continue

        esp = (m.get("especie") or "").strip()
        dep = (m.get("departamento") or "Sin departamento").strip()
        loc = (m.get("localidad") or "Sin localidad").strip()
        camp_id = int(m["id_campana"])
        camp_nom = m.get("ubicacion_campana") or f"Campaña #{camp_id}"

        if esp:
            especies_disp.add(esp)
        if dep:
            deptos_disp.add(dep)
        if loc:
            localidades_disp.add(loc)
        campanas_disp[camp_id] = camp_nom

        if especie and esp.lower() != especie.strip().lower():
            continue
        if departamento and dep.lower() != departamento.strip().lower():
            continue
        if localidad and loc.lower() != localidad.strip().lower():
            continue
        if id_campana and camp_id != int(id_campana):
            continue
        conv = (convenio or "").strip().lower()
        if conv == "con" and not m.get("convenio_inta"):
            continue
        if conv == "sin" and m.get("convenio_inta"):
            continue

        fecha_ref = str(m.get("fecha_hora_extraccion") or e.get("fecha_corrida") or "")[:10]
        ag_val = float(e["relacion_ag"]) if e.get("relacion_ag") is not None else None
        pt_val = (
            float(e["proteinas_totales_g_dl"])
            if e.get("proteinas_totales_g_dl") is not None
            else None
        )

        registros_base.append(
            {
                "id_ensayo": e["id_ensayo"],
                "id_muestra": e["id_muestra"],
                "codigo_animal": m.get("codigo_animal"),
                "especie": esp or "Sin especie",
                "departamento": dep,
                "localidad": loc,
                "id_campana": camp_id,
                "ubicacion_campana": camp_nom,
                "fecha": fecha_ref,
                "relacion_ag": ag_val,
                "proteinas_totales": pt_val,
                "fracciones": e.get("fracciones") or [],
            }
        )

    def _en_rango(items: list[dict[str, Any]], f_ini: str | None, f_fin: str | None) -> list[dict[str, Any]]:
        ini = (f_ini or "").strip()
        fin = (f_fin or "").strip()
        return [
            r
            for r in items
            if (not ini or r["fecha"] >= ini) and (not fin or r["fecha"] <= fin)
        ]

    reg_principal = _en_rango(registros_base, fecha_desde, fecha_hasta)
    resumen_principal = _resumir_registros_salud(reg_principal)

    tiene_comparacion = bool((comp_desde or "").strip() or (comp_hasta or "").strip())
    resumen_comp = (
        _resumir_registros_salud(_en_rango(registros_base, comp_desde, comp_hasta))
        if tiene_comparacion
        else None
    )

    return {
        "principal": resumen_principal,
        "comparacion": resumen_comp,
        "linea_tiempo": _serie_estacional(registros_base),
        "opciones_filtro": {
            "especies": sorted(especies_disp),
            "departamentos": sorted(deptos_disp),
            "localidades": sorted(localidades_disp),
            "campanas": [
                {"id_campana": k, "nombre": v}
                for k, v in sorted(campanas_disp.items(), key=lambda kv: kv[1])
            ],
        },
    }