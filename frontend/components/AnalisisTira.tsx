"use client";

import { useState } from "react";

import FormularioTira from "./FormularioTira";
import PanelGuardarEnsayo from "./PanelGuardarEnsayo";
import RecortadorImagen from "./RecortadorImagen";
import ResultadoCarril from "./ResultadoCarril";
import { useAnalisisTira } from "@/hooks/useAnalisisTira";
import { aplicarAjustes, type AjustesPorCarril } from "@/lib/ajustes";
import { descargarTexto, resultadosACsv } from "@/lib/csv";
import type { CalculoLimites } from "@/lib/tipos";
import type { EnsayoGuardado } from "@/lib/tipos-ensayos";
import type { Especie } from "@/lib/tipos-muestras";

type Props = {
  // Si viene una muestra, al final aparece el panel para guardar el ensayo.
  idMuestra?: number;
  especie?: Especie | null;
  muestraFueraDePlazo?: boolean;
  onGuardado?: (ensayo: EnsayoGuardado) => void;
  // Permite volver a empezar con otra tira sin recargar la página.
  onOtroEnsayo?: () => void;
};

// Toda la pantalla de análisis, sin el encabezado ni el fondo. Vive dentro de
// "Nuevo ensayo": se puede analizar la imagen y, si hay muestra, guardar.
export default function AnalisisTira({
  idMuestra,
  especie,
  muestraFueraDePlazo,
  onGuardado,
  onOtroEnsayo,
}: Props) {
  const t = useAnalisisTira();
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

  return (
    <div className="space-y-6">
      <FormularioTira
        parametros={t.parametros}
        onArchivo={t.elegirArchivo}
        onParametros={t.setParametros}
        nombreArchivo={t.archivo?.name ?? null}
      />

      {t.preparando && (
        <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          Preparando la imagen...
        </div>
      )}

      {t.archivo && t.urlVista && (
        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
          <RecortadorImagen
            key={t.urlVista}
            src={t.urlVista}
            onRecorte={t.fijarRecorte}
          />
          <button
            onClick={t.analizar}
            disabled={t.cargando || t.preparando}
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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Imagen analizada ({t.resultado.carriles.length}{" "}
                {t.resultado.carriles.length === 1 ? "carril" : "carriles"})
              </h2>
              <button
                onClick={exportar}
                className="rounded border border-gray-300 px-3 py-1 text-sm"
              >
                Descargar CSV
              </button>
            </div>
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
              especie={especie}
              onAjuste={(calculo) => registrarAjuste(carril.indice, calculo)}
            />
          ))}

          {idMuestra !== undefined && (
            <PanelGuardarEnsayo
              key={idMuestra}
              analisis={aplicarAjustes(t.resultado, ajustesActuales)}
              proteinasTotales={t.parametros.proteinasTotales}
              idMuestra={idMuestra}
              imagenDataUrl={t.resultado.imagen}
              muestraFueraDePlazo={muestraFueraDePlazo}
              onGuardado={onGuardado}
              onOtroEnsayo={onOtroEnsayo}
            />
          )}
        </>
      )}
    </div>
  );
}
