"use client";

import { useState, type DragEvent } from "react";
import { Camera, Upload, ChevronDown, FileImage } from "lucide-react";
import type { PixelCrop } from "react-image-crop";

import CamaraTira from "./CamaraTira";
import ModalCabinaDensitometro from "./ModalCabinaDensitometro";
import RecortadorImagen from "./RecortadorImagen";
import { MODOS, SENSIBILIDAD, TIPOS_IMAGEN } from "@/lib/config";
import type { Modo, Parametros } from "@/lib/tipos";

type Props = {
  archivo: File | null;
  urlVista: string | null;
  preparando: boolean;
  cargando: boolean;
  error: string | null;
  parametros: Parametros;
  onArchivo: (archivo: File | null) => void | Promise<void>;
  onParametros: (parametros: Parametros) => void;
  onRecorte: (
    crop: PixelCrop | undefined,
    imagen: HTMLImageElement | null,
  ) => void;
  onTransformar: (tipo: "izq" | "der" | "espejo") => void;
  onAnalizar: () => void;
  onVolver: () => void;
};

const CAMPO =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";

export default function PasoFoto({
  archivo,
  urlVista,
  preparando,
  cargando,
  error,
  parametros,
  onArchivo,
  onParametros,
  onRecorte,
  onTransformar,
  onAnalizar,
  onVolver,
}: Props) {
  const [modalCabinaAbierto, setModalCabinaAbierto] = useState(false);
  const [camaraWebAbierta, setCamaraWebAbierta] = useState(false);
  const [avanzadas, setAvanzadas] = useState(false);

  const cambiar = <K extends keyof Parametros>(clave: K, valor: Parametros[K]) =>
    onParametros({ ...parametros, [clave]: valor });

  function soltar(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    const archivo = evento.dataTransfer.files?.[0];
    if (archivo) void onArchivo(archivo);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Cargá la foto de la tira
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Poné la tira sobre un fondo blanco, con buena luz.
        </p>
      </div>

      {!urlVista ? (
        <div
          onDragOver={(evento) => evento.preventDefault()}
          onDrop={soltar}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <button
            type="button"
            onClick={() => setModalCabinaAbierto(true)}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-10 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            <Camera className="h-8 w-8 text-emerald-700" />
            <span className="text-base font-semibold text-slate-900">
              Sacar una foto
            </span>
            <span className="text-sm text-slate-500">
              Usa la cabina densitométrica o la cámara web
            </span>
          </button>

          <label
            htmlFor="tira-archivo"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-10 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            <Upload className="h-8 w-8 text-emerald-700" />
            <span className="text-base font-semibold text-slate-900">
              Elegir un archivo
            </span>
            <span className="text-sm text-slate-500">
              JPG, PNG, TIFF o BMP · también podés arrastrarla acá
            </span>
          </label>

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
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3.5 py-2.5">
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-800">
              <FileImage className="h-4.5 w-4.5 shrink-0 text-emerald-700" />
              <span className="truncate">{archivo?.name}</span>
            </span>
            <button
              type="button"
              onClick={() => void onArchivo(null)}
              className="shrink-0 text-sm font-semibold text-emerald-700 hover:underline"
            >
              Cambiar imagen
            </button>
          </div>

          <RecortadorImagen
            key={urlVista}
            src={urlVista}
            onRecorte={onRecorte}
            onTransformar={onTransformar}
          />
        </div>
      )}

      <ModalCabinaDensitometro
        abierto={modalCabinaAbierto}
        onCerrar={() => setModalCabinaAbierto(false)}
        onCapturaExitosa={(archivo) => onArchivo(archivo)}
        onUsarCamaraWeb={() => setCamaraWebAbierta(true)}
      />

      <CamaraTira
        abierta={camaraWebAbierta}
        onCerrar={() => setCamaraWebAbierta(false)}
        onCapturar={(archivo) => onArchivo(archivo)}
      />

      {preparando && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Preparando la imagen...
        </p>
      )}

      <div>
        <label
          htmlFor="tira-proteinas"
          className="mb-1.5 block text-[15px] font-semibold text-slate-900"
        >
          Proteínas totales (g/dL)
        </label>
        <input
          id="tira-proteinas"
          type="text"
          inputMode="decimal"
          placeholder="Ej: 6,5"
          value={parametros.proteinasTotales}
          onChange={(e) => cambiar("proteinasTotales", e.target.value)}
          className={`${CAMPO} max-w-xs`}
        />
        <p className="mt-1.5 text-sm text-slate-500">
          Es el valor que mide el laboratorio. Sin este dato el resultado solo
          muestra porcentajes, y no se puede guardar el ensayo.
        </p>
      </div>

      {/* Opciones avanzadas */}
      <div className="rounded-xl border border-slate-200">
        <button
          type="button"
          onClick={() => setAvanzadas((a) => !a)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          aria-expanded={avanzadas}
        >
          <span>
            <span className="block text-[15px] font-semibold text-slate-900">
              Opciones avanzadas
            </span>
            <span className="block text-sm text-slate-500">
              Modo de lectura, sensibilidad y cantidad de fracciones.
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${
              avanzadas ? "rotate-180" : ""
            }`}
          />
        </button>
        {avanzadas && (
          <div className="grid gap-4 border-t border-slate-200 p-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="tira-modo"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
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
                htmlFor="tira-fracciones"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Cantidad de fracciones
              </label>
              <select
                id="tira-fracciones"
                value={parametros.cantidadFracciones ?? ""}
                onChange={(e) =>
                  cambiar(
                    "cantidadFracciones",
                    e.target.value
                      ? (Number(e.target.value) as 5 | 6)
                      : null,
                  )
                }
                className={CAMPO}
              >
                <option value="">Automático (según picos)</option>
                <option value="5">5 fracciones (Alb, α1, α2, β, γ)</option>
                <option value="6">
                  6 fracciones (Alb, α1, α2, β1, β2, γ)
                </option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="tira-prominencia"
                className="mb-1 block text-sm font-medium text-slate-700"
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
                onChange={(e) =>
                  cambiar("prominencia", Number(e.target.value))
                }
                className="w-full accent-emerald-600"
              />
              <p className="text-xs text-slate-500">
                Más bajo detecta más fracciones; más alto, menos.
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* Pie del paso */}
      <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-4 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onVolver}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
        >
          ← Volver
        </button>
        <button
          type="button"
          onClick={onAnalizar}
          disabled={!archivo || cargando || preparando}
          className="w-full rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {cargando
            ? "Analizando..."
            : !archivo
              ? "Cargá una foto para continuar"
              : "Analizar →"}
        </button>
      </div>
    </div>
  );
}
