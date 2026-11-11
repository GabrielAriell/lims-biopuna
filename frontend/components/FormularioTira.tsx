"use client";

import { useState, type DragEvent } from "react";

import CamaraTira from "./CamaraTira";
import { MODOS, SENSIBILIDAD, TIPOS_IMAGEN } from "@/lib/config";
import type { Modo, Parametros } from "@/lib/tipos";

type Props = {
  parametros: Parametros;
  onArchivo: (archivo: File | null) => void | Promise<void>;
  onParametros: (parametros: Parametros) => void;
  // Nombre del archivo ya elegido, para mostrarlo debajo del selector.
  nombreArchivo?: string | null;
};

const CAMPO = "w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900";

export default function FormularioTira({
  parametros,
  onArchivo,
  onParametros,
  nombreArchivo,
}: Props) {
  const [camaraAbierta, setCamaraAbierta] = useState(false);

  const cambiar = <K extends keyof Parametros>(clave: K, valor: Parametros[K]) =>
    onParametros({ ...parametros, [clave]: valor });

  function soltar(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    const archivo = evento.dataTransfer.files?.[0];
    if (archivo) void onArchivo(archivo);
  }

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
      <div>
        <p className="mb-1 block text-sm font-medium">Foto o escaneo de la tira</p>
        <div
          onDragOver={(evento) => evento.preventDefault()}
          onDrop={soltar}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 px-4 py-4 text-blue-900"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              Elegí una imagen, arrastrala acá o usá la cámara integrada
            </span>
            <span className="block text-xs text-blue-700">
              JPG, PNG, TIFF o BMP. “Abrir cámara” muestra la vista en vivo con guías.
            </span>
          </span>
          <span className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCamaraAbierta(true)}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Abrir cámara
            </button>
            <label
              htmlFor="tira-archivo"
              className="cursor-pointer rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Seleccionar archivo
            </label>
          </span>
          <input
            id="tira-archivo"
            type="file"
            accept={TIPOS_IMAGEN}
            onChange={(e) => {
              void onArchivo(e.target.files?.[0] ?? null);
              e.currentTarget.value = "";
            }}
            className="sr-only"
          />
        </div>
        <CamaraTira
          abierta={camaraAbierta}
          onCerrar={() => setCamaraAbierta(false)}
          onCapturar={(archivo) => onArchivo(archivo)}
        />
        <p className="mt-2 text-sm text-gray-600">
          {nombreArchivo
            ? `Archivo elegido: ${nombreArchivo}`
            : "Todavía no elegiste ninguna imagen."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="tira-proteinas"
            className="mb-1 block text-sm font-medium"
          >
            Proteínas totales (g/dL)
          </label>
          <input
            id="tira-proteinas"
            type="text"
            inputMode="decimal"
            placeholder="Ej: 6,5 (opcional)"
            value={parametros.proteinasTotales}
            onChange={(e) => cambiar("proteinasTotales", e.target.value)}
            className={CAMPO}
          />
        </div>
        <div>
          <label
            htmlFor="tira-carriles"
            className="mb-1 block text-sm font-medium"
          >
            Cantidad de carriles
          </label>
          <input
            id="tira-carriles"
            type="number"
            min={1}
            max={20}
            placeholder="Automático"
            value={parametros.nCarriles}
            onChange={(e) => cambiar("nCarriles", e.target.value)}
            className={CAMPO}
          />
        </div>
        <div>
          <label htmlFor="tira-modo" className="mb-1 block text-sm font-medium">
            Modo de lectura
          </label>
          <select
            id="tira-modo"
            value={parametros.modo}
            onChange={(e) => cambiar("modo", e.target.value as Modo)}
            className={CAMPO}
          >
            {MODOS.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.texto}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="tira-prominencia"
            className="mb-1 block text-sm font-medium"
          >
            Sensibilidad de picos: {parametros.prominencia.toFixed(2)}
          </label>
          <input
            id="tira-prominencia"
            type="range"
            min={SENSIBILIDAD.min}
            max={SENSIBILIDAD.max}
            step={SENSIBILIDAD.paso}
            value={parametros.prominencia}
            onChange={(e) => cambiar("prominencia", Number(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-gray-500">Más bajo detecta más fracciones; más alto, menos.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={parametros.invertir}
            onChange={(e) => cambiar("invertir", e.target.checked)}
          />
          Invertir izquierda/derecha (albúmina a la derecha)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={parametros.vertical}
            onChange={(e) => cambiar("vertical", e.target.checked)}
          />
          La tira está parada (vertical)
        </label>
      </div>
    </section>
  );
}
