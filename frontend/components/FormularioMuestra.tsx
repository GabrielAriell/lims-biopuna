"use client";

import { useMemo, useState, type FormEvent } from "react";

import SelectorFecha from "@/components/SelectorFecha";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSesion } from "./ProveedorSesion";
import { crearMuestra } from "@/lib/api-muestras";
import { puedeEscribir } from "@/lib/sesion";
import type { Campana, Especie, Muestra, NuevaMuestra } from "@/lib/tipos-muestras";

const CAMPO =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";
const ESPECIES: Especie[] = ["Llama", "Vicuña", "Oveja", "Caballo"];

// Prefijo del código por especie: O-01 para ovejas, L-03 para llamas, etc.
const PREFIJOS: Record<Especie, string> = {
  Llama: "L",
  Vicuña: "V",
  Oveja: "O",
  Caballo: "C",
};

// Siguiente código libre de la especie dentro de la campaña elegida.
// Solo cuenta códigos que ya respetan el patrón PREFIJO-número; los
// códigos escritos a mano con otro formato no interfieren.
function sugerirCodigo(
  muestras: Muestra[],
  idCampana: number,
  especie: Especie,
): string {
  const prefijo = PREFIJOS[especie];
  const patron = new RegExp(`^${prefijo}-(\\d+)$`, "i");
  let mayor = 0;
  for (const m of muestras) {
    if (m.id_campana !== idCampana || m.especie !== especie) continue;
    const coincide = m.codigo_animal.trim().match(patron);
    if (coincide) mayor = Math.max(mayor, parseInt(coincide[1], 10));
  }
  return `${prefijo}-${String(mayor + 1).padStart(2, "0")}`;
}

type Props = {
  campanas: Campana[];
  muestras: Muestra[];
  // Si viene fijada (formulario dentro de una campaña), no hay selector:
  // la muestra solo puede ir a esa campaña.
  idCampanaFija?: number | null;
  onCreada: () => Promise<void> | void;
  onCerrar?: () => void;
};

export default function FormularioMuestra({
  campanas,
  muestras,
  idCampanaFija,
  onCreada,
  onCerrar,
}: Props) {
  const { usuario } = useSesion();
  const bloqueado = !puedeEscribir(usuario);
  const [idCampana, setIdCampana] = useState(
    idCampanaFija != null ? String(idCampanaFija) : "",
  );
  // null = todavía no escribió nada a mano: se muestra el código sugerido.
  // Al borrar el campo vuelve a null y la sugerencia reaparece sola.
  const [codigoManual, setCodigoManual] = useState<string | null>(null);
  const [especie, setEspecie] = useState<Especie>("Llama");
  const [fechaLocal, setFechaLocal] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const campanaFijada =
    idCampanaFija != null
      ? campanas.find((c) => c.id_campana === idCampanaFija)
      : undefined;

  const sugerido = useMemo(
    () =>
      idCampana ? sugerirCodigo(muestras, Number(idCampana), especie) : "",
    [muestras, idCampana, especie],
  );
  const codigo = codigoManual ?? sugerido;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (bloqueado) {
      setError("Tu cuenta es de solo lectura: no puede registrar muestras.");
      return;
    }
    if (!idCampana) {
      setError("Elegí una campaña antes de guardar la muestra");
      return;
    }
    if (!codigo.trim()) {
      setError("Escribí el código del animal");
      return;
    }
    if (!fechaLocal) {
      setError("Elegí la fecha y hora de extracción");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const datos: NuevaMuestra = {
        id_campana: Number(idCampana),
        codigo_animal: codigo.trim(),
        especie,
        // datetime-local no trae zona horaria: el navegador la interpreta
        // como hora local y toISOString() la convierte a UTC.
        fecha_hora_extraccion: new Date(fechaLocal).toISOString(),
      };
      await crearMuestra(datos);
      // Listo para la siguiente del lote: conserva campaña y especie.
      setCodigoManual(null);
      setFechaLocal("");
      await onCreada();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la muestra");
    } finally {
      setEnviando(false);
    }
  }

  if (campanas.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="text-base font-bold text-slate-900">Nueva muestra</h3>
        <p className="mt-1 text-sm text-slate-600">
          Primero creá una campaña. La muestra necesita pertenecer a una salida
          a territorio.
        </p>
      </section>
    );
  }

  return (
    <form
      onSubmit={enviar}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
    >
      <div>
        <h3 className="text-base font-bold text-slate-900">Nueva muestra</h3>
        <p className="mt-1 text-sm text-slate-600">
          El semáforo empieza a correr desde la fecha y hora de extracción. Al
          guardar, el formulario queda listo para cargar la siguiente.
        </p>
      </div>

      {campanaFijada ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
          Se guarda en: {campanaFijada.localidad_puna} ·{" "}
          {campanaFijada.fecha_salida}
        </p>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Campaña
          </label>
          <Select value={idCampana} onValueChange={setIdCampana}>
            <SelectTrigger>
              <SelectValue placeholder="Elegí una campaña" />
            </SelectTrigger>
            <SelectContent>
              {campanas.map((c) => (
                <SelectItem key={c.id_campana} value={String(c.id_campana)}>
                  {c.localidad_puna} · {c.fecha_salida}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Especie
          </label>
          <Select
            value={especie}
            onValueChange={(v) => setEspecie(v as Especie)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESPECIES.map((nombre) => (
                <SelectItem key={nombre} value={nombre}>
                  {nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Código del animal
          </label>
          <input
            type="text"
            required
            placeholder={sugerido || "Ej: L-04"}
            value={codigo}
            onChange={(e) =>
              setCodigoManual(e.target.value === "" ? null : e.target.value)
            }
            className={CAMPO}
          />
          {idCampana && codigoManual === null && (
            <p className="mt-1 text-xs text-slate-500">
              Sugerido según los {PREFIJOS[especie]}-# ya cargados en esta
              campaña. Podés escribir otro si hace falta.
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Fecha y hora de extracción
        </label>
        <SelectorFecha
          conHora
          value={fechaLocal}
          onChange={setFechaLocal}
          placeholder="Elegí fecha y hora de extracción"
        />
      </div>

      {bloqueado && (
        <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          Tu cuenta es de solo lectura: no puede registrar muestras.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={enviando || bloqueado}
          className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {enviando ? "Guardando..." : "Guardar muestra"}
        </button>
        {onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            disabled={enviando}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
