"use client";

import { useState } from "react";

import FormularioTira from "./FormularioTira";
import PanelGuardarEnsayo from "./PanelGuardarEnsayo";
import RecortadorImagen from "./RecortadorImagen";
import ResultadoCarril from "./ResultadoCarril";
import { useAnalisisTira } from "@/hooks/useAnalisisTira";
import { aplicarAjustes, type AjustesPorCarril } from "@/lib/ajustes";
import { descargarReporteLibre } from "@/lib/api";
import { descargarTexto, resultadosACsv } from "@/lib/csv";
import type { CalculoLimites } from "@/lib/tipos";
import type { EnsayoGuardado } from "@/lib/tipos-ensayos";

type Props = {
  // Si viene una muestra, al final aparece el panel para guardar el ensayo.
  idMuestra?: number;
  onGuardado?: (ensayo: EnsayoGuardado) => void;
  // Permite volver a empezar con otra tira sin recargar la página.
  onOtroEnsayo?: () => void;
  // Modo público (sin login): usa endpoints libres y permite exportar sin guardar.
  publico?: boolean;
};

// Toda la pantalla de análisis, sin el encabezado ni el fondo. Vive dentro de
// "Nuevo ensayo": se puede analizar la imagen y, si hay muestra, guardar.
export default function AnalisisTira({
  idMuestra,
  onGuardado,
  onOtroEnsayo,
  publico = false,
}: Props) {
  const t = useAnalisisTira(publico);
  const [descargando, setDescargando] = useState<"xlsx" | "pdf" | null>(null);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  const [ajustes, setAjustes] = useState<{
    version: number;
    porCarril: AjustesPorCarril;
  }>({
    version: -1,
    porCarril: {},
  });

  // Solo valen los ajustes del análisis actual; al analizar otra tira se ignoran.
  const ajustesActuales = ajustes.version === t.version ? ajustes.porCarril : {};

  function registrarAjuste(indice: number, calculo: CalculoLimites | null) {
    setAjustes((prev) => {
      const porCarril =
        prev.version === t.version ? { ...prev.porCarril } : {};
      if (calculo) porCarril[indice] = calculo;
      else delete porCarril[indice];
      return { version: t.version, porCarril };
    });
  }

  function exportar() {
    if (!t.archivo || !t.resultado) return;
    const base = t.archivo.name.replace(/\.[^.]+$/, "");
    const resultado = aplicarAjustes(t.resultado, ajustesActuales);
    descargarTexto(`${base}.csv`, resultadosACsv(t.archivo.name, resultado));
  }

  async function exportarLibre(formato: "xlsx" | "pdf") {
    if (!t.resultado) return;
    setDescargando(formato);
    setErrorDescarga(null);
    try {
      const resultado = aplicarAjustes(t.resultado, ajustesActuales);
      const ptTxt = t.parametros.proteinasTotales.trim().replace(",", ".");
      const pt = ptTxt ? Number(ptTxt) : null;
      const datos = {
        nombre_archivo: t.archivo?.name ?? null,
        proteinas_totales_g_dl: Number.isFinite(pt) ? pt : null,
        carriles: resultado.carriles.map((c) => ({
          indice: c.indice,
          relacion_ag: c.relacion_ag,
          advertencias: c.advertencias,
          fracciones: c.fracciones.map((f) => ({
            nombre_fraccion: f.nombre,
            porcentaje_relativo: f.porcentaje,
            concentracion_g_dl: f.concentracion_g_dl,
            area_integrada: f.area,
          })),
        })),
      };
      await descargarReporteLibre(
        formato === "xlsx" ? "analisis-libre.xlsx" : "analisis-libre.pdf",
        datos,
        `analisis_libre.${formato}`,
      );
    } catch (e) {
      setErrorDescarga(e instanceof Error ? e.message : "No se pudo descargar");
    } finally {
      setDescargando(null);
    }
  }

  return (
    <div className="space-y-6">
      <FormularioTira
        parametros={t.parametros}
        onArchivo={t.elegirArchivo}
        onParametros={t.setParametros}
        nombreArchivo={t.archivo?.name ?? null}
      />

      {t.archivo && t.urlVista && (
        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
          <RecortadorImagen
            key={t.urlVista}
            src={t.urlVista}
            onRecorte={t.fijarRecorte}
          />
          <button
            onClick={t.analizar}
            disabled={t.cargando}
            className="rounded bg-blue-600 px-5 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.cargando ? "Analizando..." : "Analizar"}
          </button>
        </section>
      )}

      {t.error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
          {t.error}
        </div>
      )}

      {t.resultado && (
        <>
          <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">
                Imagen analizada ({t.resultado.carriles.length}{" "}
                {t.resultado.carriles.length === 1 ? "carril" : "carriles"})
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={exportar}
                  className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
                >
                  Descargar CSV
                </button>
                {publico && (
                  <>
                    <button
                      onClick={() => void exportarLibre("xlsx")}
                      disabled={descargando !== null}
                      className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {descargando === "xlsx" ? "Generando..." : "Descargar Excel"}
                    </button>
                    <button
                      onClick={() => void exportarLibre("pdf")}
                      disabled={descargando !== null}
                      className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {descargando === "pdf" ? "Generando..." : "Descargar PDF"}
                    </button>
                  </>
                )}
              </div>
            </div>
            {errorDescarga && (
              <p className="rounded bg-red-50 p-2 text-sm text-red-800">{errorDescarga}</p>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={t.resultado.imagen}
              alt="Recorte analizado de la tira"
              className="max-w-full rounded border border-gray-200"
            />
            <p className="text-sm text-gray-500">
              {t.resultado.recorte_automatico
                ? "El recorte se detectó automáticamente."
                : "Se usó el recorte indicado."}
            </p>
            {t.resultado.advertencias.map((a) => (
              <p
                key={a}
                className="rounded bg-yellow-50 p-2 text-sm text-yellow-800"
              >
                {a}
              </p>
            ))}
          </section>

          {t.resultado.carriles.map((carril) => (
            <ResultadoCarril
              key={`${t.version}-${carril.indice}`}
              carril={carril}
              proteinasTotales={t.parametros.proteinasTotales}
              onAjuste={(calculo) => registrarAjuste(carril.indice, calculo)}
              publico={publico}
            />
          ))}

          {!publico && idMuestra !== undefined && (
            <PanelGuardarEnsayo
              key={idMuestra}
              analisis={aplicarAjustes(t.resultado, ajustesActuales)}
              proteinasTotales={t.parametros.proteinasTotales}
              idMuestra={idMuestra}
              imagenDataUrl={t.resultado.imagen}
              onGuardado={onGuardado}
              onOtroEnsayo={onOtroEnsayo}
            />
          )}
        </>
      )}
    </div>
  );
}
