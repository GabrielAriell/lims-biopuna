"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useGuardarEnsayo } from "@/hooks/useGuardarEnsayo";
import { useSesion } from "@/components/ProveedorSesion";
import {
  dataUrlABlob,
  prepararCarriles,
  proteinasTotalesNumero,
} from "@/lib/ensayos";
import type { AnalisisTira } from "@/lib/tipos";
import type { EnsayoGuardado } from "@/lib/tipos-ensayos";

type Props = {
  analisis: AnalisisTira;
  proteinasTotales: string;
  idMuestra: number;
  imagenDataUrl: string;
  muestraFueraDePlazo?: boolean;
  onGuardado?: (ensayo: EnsayoGuardado) => void;
  onOtroEnsayo?: () => void;
};

export default function PanelGuardarEnsayo({
  analisis,
  proteinasTotales,
  idMuestra,
  imagenDataUrl,
  muestraFueraDePlazo,
  onGuardado,
  onOtroEnsayo,
}: Props) {
  const { usuario } = useSesion();
  const { guardar, guardando, error, guardado } = useGuardarEnsayo();
  const [errorImagen, setErrorImagen] = useState<string | null>(null);

  const { carriles, problemas } = useMemo(
    () => prepararCarriles(analisis),
    [analisis],
  );
  const proteinas = proteinasTotalesNumero(proteinasTotales);
  // Cualquier usuario autenticado puede guardar (el backend valida la sesión).
  const puedeEscribir = Boolean(usuario);
  const listo =
    carriles.length > 0 &&
    problemas.length === 0 &&
    proteinas !== null &&
    puedeEscribir;

  async function enviar() {
    if (!listo || proteinas === null) return;
    if (muestraFueraDePlazo) {
      const confirmar = window.confirm(
        "Esta muestra está fuera de plazo (superó las 48 h). ¿Deseás guardar el ensayo igualmente para mantener la trazabilidad?"
      );
      if (!confirmar) return;
    }
    setErrorImagen(null);
    try {
      const imagen = await dataUrlABlob(imagenDataUrl);
      const ensayo = await guardar(
        {
          id_muestra: idMuestra,
          proteinas_totales: proteinas,
          carriles,
        },
        imagen,
      );
      if (ensayo) onGuardado?.(ensayo);
    } catch (e) {
      setErrorImagen(
        e instanceof Error ? e.message : "No se pudo preparar la imagen",
      );
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/40 p-5">
      <div>
        <h2 className="text-lg font-semibold">Guardar ensayo</h2>
        <p className="max-w-3xl text-sm text-gray-600">
          Se guarda el análisis de la muestra #{idMuestra}. El backend vuelve a
          calcular las fracciones con los límites que ajustaste y sube la imagen
          a Cloudinary. La muestra pasa a &quot;procesada&quot; cuando el
          guardado termina bien.
        </p>
      </div>

      {muestraFueraDePlazo && !guardado && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <strong>Aviso:</strong> esta muestra está fuera de plazo (superó las 48 h).
          Al guardar se pedirá confirmación para registrar el ensayo igualmente.
        </p>
      )}

      {guardado ? (
        <div className="space-y-3 rounded border border-green-300 bg-green-50 p-4">
          <p className="font-medium text-green-900">
            Ensayo #{guardado.id_ensayo} guardado correctamente.
          </p>
          <ul className="space-y-1 text-sm text-green-900">
            <li>
              Proteínas totales:{" "}
              {guardado.proteinas_totales_g_dl.toLocaleString("es-AR")} g/dL
            </li>
            <li>Fracciones guardadas: {guardado.fracciones.length}</li>
            <li>
              Fecha de corrida:{" "}
              {new Date(guardado.fecha_corrida).toLocaleString("es-AR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </li>
          </ul>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {onOtroEnsayo && (
              <button
                type="button"
                onClick={onOtroEnsayo}
                className="rounded border border-green-400 bg-white px-3 py-1 font-medium text-green-900 hover:bg-green-100"
              >
                Cargar otra tira
              </button>
            )}
            <Link href="/muestras" className="font-medium text-blue-700 underline">
              Volver a muestras
            </Link>
            {guardado.url_imagen_tira && (
              <a
                href={guardado.url_imagen_tira}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-blue-700 underline"
              >
                Ver imagen en Cloudinary
              </a>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 block text-sm font-medium">
                Investigador que corre el ensayo
              </p>
              <p className="rounded border border-gray-200 bg-white px-3 py-2 text-gray-900">
                {usuario
                  ? `${usuario.nombre} (${usuario.rol_sistema})`
                  : "Sin sesión"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Se toma del usuario logueado; no se elige en el formulario.
              </p>
            </div>

            <div>
              <p className="mb-1 block text-sm font-medium">
                Proteínas totales
              </p>
              <p className="rounded border border-gray-200 bg-white px-3 py-2 text-gray-900">
                {proteinas !== null
                  ? `${proteinas.toLocaleString("es-AR")} g/dL`
                  : "Sin completar"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Se toma del formulario de análisis (arriba). Es obligatoria para
                guardar.
              </p>
            </div>
          </div>

          {proteinas === null && (
            <p className="rounded bg-yellow-50 p-2 text-sm text-yellow-800">
              Completá las proteínas totales con un valor entre 0 y 20 g/dL en
              el formulario de análisis.
            </p>
          )}

          {problemas.length > 0 && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-medium">No se puede guardar todavía:</p>
              <ul className="mt-1 list-disc pl-5">
                {problemas.map((problema) => (
                  <li key={problema}>{problema}</li>
                ))}
              </ul>
            </div>
          )}

          {(error || errorImagen) && (
            <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              {error ?? errorImagen}
            </p>
          )}

          {!usuario && (
            <p className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
              Iniciá sesión para guardar el ensayo.
            </p>
          )}

          <button
            type="button"
            onClick={enviar}
            disabled={!listo || guardando}
            className="rounded bg-blue-600 px-5 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? "Guardando ensayo..." : "Guardar ensayo"}
          </button>
        </>
      )}
    </section>
  );
}
