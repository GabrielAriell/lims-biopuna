"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import ExitoGuardado from "./ExitoGuardado";
import PasoFoto from "./PasoFoto";
import PasoMuestra from "./PasoMuestra";
import PasoResultado from "./PasoResultado";
import PasosProgreso from "./PasosProgreso";
import ResultadoCarril from "./ResultadoCarril";
import { useAnalisisTira } from "@/hooks/useAnalisisTira";
import { useMuestras } from "@/hooks/useMuestras";
import { aplicarAjustes, type AjustesPorCarril } from "@/lib/ajustes";
import { descargarTexto, resultadosACsv } from "@/lib/csv";
import type { CalculoLimites } from "@/lib/tipos";
import type { EnsayoGuardado } from "@/lib/tipos-ensayos";
import type { Muestra } from "@/lib/tipos-muestras";

type Props = {
  idMuestraInicial: number | null;
};

const TARJETA =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-7";

export default function NuevoEnsayo({ idMuestraInicial }: Props) {
  const { muestras, cargando, error, recargar } = useMuestras();
  const t = useAnalisisTira();

  const [paso, setPaso] = useState(1);
  const [idMuestra, setIdMuestra] = useState<number | null>(idMuestraInicial);
  // Remonta los pasos 2-4 después de guardar: borra recorte y ediciones.
  const [reinicio, setReinicio] = useState(0);
  const [ultimoGuardado, setUltimoGuardado] = useState<EnsayoGuardado | null>(
    null,
  );
  const [ajustes, setAjustes] = useState<{
    version: number;
    porCarril: AjustesPorCarril;
  }>({ version: -1, porCarril: {} });

  const muestra = useMemo(
    () => muestras.find((actual) => actual.id_muestra === idMuestra) ?? null,
    [muestras, idMuestra],
  );

  const muestraFueraDePlazo = Boolean(
    muestra &&
      muestra.estado_48h !== "procesada" &&
      muestra.horas_transcurridas > 48,
  );

  // Solo valen los ajustes del análisis actual; al analizar otra tira se ignoran.
  const ajustesActuales =
    ajustes.version === t.version ? ajustes.porCarril : {};
  const carrilAnalizado = t.resultado?.carriles[0] ?? null;

  // Al cambiar de paso se vuelve arriba de la ventana.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [paso]);

  // Al salir de la pantalla se libera la imagen temporal; al volver, el
  // componente se monta de cero y todos los campos arrancan limpios.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  useEffect(() => () => tRef.current.reiniciar(), []);

  function elegir(elegida: Muestra | null) {
    setIdMuestra(elegida ? elegida.id_muestra : null);
    setUltimoGuardado(null);
  }

  function registrarAjuste(indice: number, calculo: CalculoLimites | null) {
    setAjustes((prev) => {
      const porCarril =
        prev.version === t.version ? { ...prev.porCarril } : {};
      if (calculo) porCarril[indice] = calculo;
      else delete porCarril[indice];
      return { version: t.version, porCarril };
    });
  }

  function descargar() {
    if (!t.archivo || !t.resultado) return;
    const base = t.archivo.name.replace(/\.[^.]+$/, "");
    const resultado = aplicarAjustes(t.resultado, ajustesActuales);
    descargarTexto(`${base}.csv`, resultadosACsv(t.archivo.name, resultado));
  }

  function alGuardar(ensayo: EnsayoGuardado) {
    setUltimoGuardado(ensayo);
    // Se reinician los campos al terminar: quedan solo los datos de éxito.
    t.reiniciar();
    setReinicio((n) => n + 1);
    setAjustes({ version: -1, porCarril: {} });
    void recargar();
  }

  function otraTira() {
    setUltimoGuardado(null);
    setIdMuestra(null);
    setPaso(1);
  }

  return (
    <div className="space-y-5">
      <section className={TARJETA}>
        <PasosProgreso paso={paso} onIrA={setPaso} />
      </section>

      {/* Paso 1: elegir muestra */}
      <section className={TARJETA} hidden={paso !== 1}>
        <PasoMuestra
          muestras={muestras}
          cargando={cargando}
          error={error}
          seleccionada={idMuestra}
          onElegir={elegir}
        />
        {idMuestra !== null && !muestra && !cargando && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No se encontró la muestra #{idMuestra}. Elegí otra de la lista.
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2.5 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setPaso(2)}
            className="w-full rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 sm:w-auto"
          >
            Siguiente →
          </button>
        </div>
      </section>

      {/* Pasos 2 a 4: quedan montados una vez visitados para no perder el
          recorte ni las ediciones de bandas entre ida y vuelta. */}
      <div key={reinicio}>
        {/* Paso 2: cargar foto */}
        {paso >= 2 && (
          <section className={TARJETA} hidden={paso !== 2}>
            <PasoFoto
              archivo={t.archivo}
              urlVista={t.urlVista}
              preparando={t.preparando}
              cargando={t.cargando}
              error={t.error}
              parametros={t.parametros}
              onArchivo={t.elegirArchivo}
              onParametros={t.setParametros}
              onRecorte={t.fijarRecorte}
              onTransformar={t.transformarImagen}
              onAnalizar={async () => {
                // Con el análisis listo se avanza solo a revisar bandas.
                if (await t.analizar()) setPaso(3);
              }}
              onVolver={() => setPaso(1)}
            />
          </section>
        )}

        {/* Paso 3: revisar bandas (dos tarjetas: imagen + edición) */}
        {paso >= 3 && t.resultado && (
          <div hidden={paso !== 3} className="space-y-5">
            <section className={TARJETA}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Imagen analizada
                </h2>
                <button
                  type="button"
                  onClick={descargar}
                  className="shrink-0 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Descargar CSV
                </button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.resultado.imagen}
                alt="Recorte analizado de la tira"
                className="mt-4 w-full rounded-lg border border-slate-200 bg-slate-50 object-contain"
              />
              <p className="mt-2 text-sm text-slate-500">
                {t.resultado.recorte_automatico
                  ? "El recorte se detectó automáticamente."
                  : "Se usó el recorte indicado."}
              </p>
            </section>

            <section className={TARJETA}>
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">
                    Tira analizada
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    El sistema separó la tira en{" "}
                    {carrilAnalizado?.fracciones.length ?? 0} partes. Si se ve
                    bien, seguí; si no, mové las líneas de la curva.
                  </p>
                </div>

                {t.resultado.advertencias.map((a) => (
                  <p
                    key={a}
                    className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                  >
                    {a}
                  </p>
                ))}

                {carrilAnalizado && (
                  <ResultadoCarril
                    key={`${t.version}-${carrilAnalizado.indice}`}
                    carril={carrilAnalizado}
                    proteinasTotales={t.parametros.proteinasTotales}
                    especie={muestra?.especie}
                    onAjuste={(calculo) =>
                      registrarAjuste(carrilAnalizado.indice, calculo)
                    }
                  />
                )}

                <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-4 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setPaso(2)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
                  >
                    ← Volver
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaso(4)}
                    className="w-full rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 sm:w-auto"
                  >
                    Ver resultado →
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Paso 4: resultado y guardado */}
        {paso >= 4 && t.resultado && (
          <section className={TARJETA} hidden={paso !== 4}>
            <PasoResultado
              analisis={aplicarAjustes(t.resultado, ajustesActuales)}
              proteinasTotales={t.parametros.proteinasTotales}
              onProteinas={(valor) =>
                t.setParametros({ ...t.parametros, proteinasTotales: valor })
              }
              muestra={muestra}
              muestraFueraDePlazo={muestraFueraDePlazo}
              onGuardado={alGuardar}
              onVolver={() => setPaso(3)}
              onDescargar={descargar}
              onElegirMuestra={() => setPaso(1)}
            />
          </section>
        )}
      </div>

      {/* Confirmación final: aparece sobre el paso 4 ya vacío. */}
      {ultimoGuardado && (
        <section className={TARJETA}>
          <ExitoGuardado
            ensayo={ultimoGuardado}
            muestra={muestra}
            onOtraTira={otraTira}
          />
        </section>
      )}
    </div>
  );
}
