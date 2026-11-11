"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AnalisisTira from "./AnalisisTira";
import SelectorMuestra from "./SelectorMuestra";
import Semaforo from "./Semaforo";
import { useMuestras } from "@/hooks/useMuestras";
import type { EnsayoGuardado } from "@/lib/tipos-ensayos";
import type { Muestra } from "@/lib/tipos-muestras";

type Props = {
  idMuestraInicial: number | null;
};

export default function NuevoEnsayo({ idMuestraInicial }: Props) {
  const { muestras, cargando, error, recargar } = useMuestras();
  const [idMuestra, setIdMuestra] = useState<number | null>(idMuestraInicial);
  // Cambiar esta clave borra archivo, recorte y resultado del análisis.
  const [reinicio, setReinicio] = useState(0);
  // Resumen del último ensayo guardado. Vive fuera del análisis para que se
  // pueda limpiar la ventana sin perder el mensaje de éxito.
  const [ultimoGuardado, setUltimoGuardado] = useState<EnsayoGuardado | null>(
    null,
  );

  const muestra = useMemo(
    () => muestras.find((actual) => actual.id_muestra === idMuestra) ?? null,
    [muestras, idMuestra],
  );

  function elegir(elegida: Muestra) {
    setIdMuestra(elegida.id_muestra);
    setUltimoGuardado(null);
  }

  function quitarMuestra() {
    setIdMuestra(null);
    setUltimoGuardado(null);
  }

  function alGuardar(ensayo: EnsayoGuardado) {
    setUltimoGuardado(ensayo);
    // Al remontar el análisis se borran imagen, recorte y resultado: la
    // ventana queda lista para cargar otra tira.
    setReinicio((n) => n + 1);
    void recargar();
  }

  function irAlAnalisis() {
    document
      .getElementById("analisis-ensayo")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    if (!ultimoGuardado) return;
    document
      .getElementById("resumen-guardado")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [ultimoGuardado]);

  return (
    <div className="space-y-6">
      <SelectorMuestra
        muestras={muestras}
        cargando={cargando}
        error={error}
        seleccionada={idMuestra}
        onElegir={elegir}
        onDeseleccionar={quitarMuestra}
      />

      {idMuestra !== null && !muestra && !cargando && (
        <p className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          No se encontró la muestra #{idMuestra}. Elegí otra de la lista.
        </p>
      )}

      {ultimoGuardado && (
        <section
          id="resumen-guardado"
          className="space-y-4 rounded-lg border border-green-300 bg-green-50 p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-green-900">
                Ensayo #{ultimoGuardado.id_ensayo} guardado correctamente
              </h2>
              <p className="text-sm text-green-800">
                La ventana de análisis quedó limpia. Podés cargar otra imagen
                abajo para analizar un nuevo ensayo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUltimoGuardado(null)}
              className="rounded px-1 text-xl leading-none text-green-800 hover:bg-green-100"
              aria-label="Cerrar resumen del ensayo guardado"
            >
              ×
            </button>
          </div>

          <dl className="grid gap-2 text-sm text-green-900 sm:grid-cols-2">
            <div>
              <dt className="font-medium">Muestra</dt>
              <dd>
                {muestra?.codigo_animal ?? `#${ultimoGuardado.id_muestra}`}
                {muestra ? ` · ${muestra.especie}` : ""}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Proteínas totales</dt>
              <dd>
                {ultimoGuardado.proteinas_totales_g_dl.toLocaleString("es-AR")}{" "}
                g/dL
              </dd>
            </div>
            <div>
              <dt className="font-medium">Fracciones guardadas</dt>
              <dd>{ultimoGuardado.fracciones.length}</dd>
            </div>
            <div>
              <dt className="font-medium">Fecha de corrida</dt>
              <dd>
                {new Date(ultimoGuardado.fecha_corrida).toLocaleString("es-AR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </dd>
            </div>
          </dl>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-green-900">
              <thead>
                <tr className="border-b border-green-300 text-left">
                  <th className="py-1 pr-4 font-medium">Fracción</th>
                  <th className="py-1 pr-4 font-medium">%</th>
                  <th className="py-1 font-medium">g/dL</th>
                </tr>
              </thead>
              <tbody>
                {ultimoGuardado.fracciones.map((fraccion) => (
                  <tr
                    key={fraccion.nombre_fraccion}
                    className="border-b border-green-200 last:border-0"
                  >
                    <td className="py-1 pr-4">{fraccion.nombre_fraccion}</td>
                    <td className="py-1 pr-4">
                      {fraccion.porcentaje_relativo.toLocaleString("es-AR", {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-1">
                      {fraccion.concentracion_g_dl.toLocaleString("es-AR", {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button
              type="button"
              onClick={irAlAnalisis}
              className="rounded bg-green-700 px-3 py-1.5 font-medium text-white hover:bg-green-800"
            >
              Analizar otra tira
            </button>
            <Link href="/muestras" className="font-medium text-blue-700 underline">
              Volver a muestras
            </Link>
            {ultimoGuardado.url_imagen_tira && (
              <a
                href={ultimoGuardado.url_imagen_tira}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-blue-700 underline"
              >
                Ver imagen en Cloudinary
              </a>
            )}
          </div>
        </section>
      )}

      {muestra && (
        <section className="space-y-2 rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                Muestra seleccionada: {muestra.codigo_animal}
              </h2>
              <p className="text-sm text-gray-600">
                {muestra.especie} · {muestra.localidad_puna} · extraída{" "}
                {new Date(muestra.fecha_hora_extraccion).toLocaleString("es-AR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Semaforo estado={muestra.estado_48h} />
              <button
                type="button"
                onClick={quitarMuestra}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Quitar selección
              </button>
            </div>
          </div>
          {muestra.estado_48h !== "procesada" && muestra.horas_transcurridas > 48 && (
            <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              <strong>Muestra fuera de plazo:</strong> superó las 48 h (
              {muestra.horas_transcurridas.toFixed(1)} h desde la extracción). Podés
              registrar el ensayo para mantener la trazabilidad, pero quedará fuera del
              tiempo recomendado. Se pedirá confirmación antes de guardar.
            </p>
          )}
          <p className="text-sm text-gray-500">
            Al guardar se crea un ensayo asociado a esta muestra. Si es la
            primera corrida, la muestra pasa a &quot;procesada&quot;. Podés
            cargar varias tiras para la misma muestra.
          </p>
        </section>
      )}

      <section
        id="analisis-ensayo"
        className="space-y-4 rounded-lg border border-gray-200 bg-white p-5"
      >
        <div>
          <h2 className="text-lg font-semibold">
            2. {muestra ? "Analizá la tira" : "Análisis libre"}
          </h2>
          <p className="text-sm text-gray-500">
            Cargá la foto o el escaneo, ajustá los límites si hace falta y
            revisá las fracciones.
          </p>
        </div>

        {!muestra && (
          <p className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <strong>Modo análisis libre:</strong> podés analizar la imagen y
            descargar el CSV, pero no se guarda nada. Para guardar el ensayo,
            elegí una muestra en el paso 1.
          </p>
        )}

        <AnalisisTira
          key={reinicio}
          idMuestra={muestra?.id_muestra}
          muestraFueraDePlazo={
            Boolean(muestra && muestra.estado_48h !== "procesada" && muestra.horas_transcurridas > 48)
          }
          onGuardado={alGuardar}
        />
      </section>
    </div>
  );
}
