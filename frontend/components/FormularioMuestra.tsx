"use client";

import { useState, type FormEvent } from "react";

import { crearMuestra } from "@/lib/api-muestras";
import type { Campana, Especie, NuevaMuestra } from "@/lib/tipos-muestras";

const CAMPO = "w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900";
const ESPECIES: Especie[] = ["Llama", "Vicuña", "Ovino"];

type Props = {
  campanas: Campana[];
  // Campaña recién creada: queda elegida sin que el usuario la busque.
  idCampanaInicial?: number | null;
  onCreada: () => Promise<void> | void;
};

export default function FormularioMuestra({
  campanas,
  idCampanaInicial,
  onCreada,
}: Props) {
  const [idCampana, setIdCampana] = useState(
    idCampanaInicial != null ? String(idCampanaInicial) : "",
  );
  const [codigo, setCodigo] = useState("");
  const [especie, setEspecie] = useState<Especie>("Llama");
  const [fechaLocal, setFechaLocal] = useState("");
  const [urlFoto, setUrlFoto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!idCampana) {
      setError("Elegí una campaña antes de guardar la muestra");
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
        codigo_animal: codigo,
        especie,
        // datetime-local no trae zona horaria: el navegador la interpreta
        // como hora local y toISOString() la convierte a UTC.
        fecha_hora_extraccion: new Date(fechaLocal).toISOString(),
        url_foto_campo: urlFoto.trim() || undefined,
      };
      await crearMuestra(datos);
      setCodigo("");
      setFechaLocal("");
      setUrlFoto("");
      await onCreada();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la muestra");
    } finally {
      setEnviando(false);
    }
  }

  if (campanas.length === 0) {
    return (
      <section className="space-y-2 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Nueva muestra</h2>
        <p className="text-sm text-gray-500">
          Primero creá una campaña. La muestra necesita pertenecer a una salida a
          territorio.
        </p>
      </section>
    );
  }

  return (
    <form
      onSubmit={enviar}
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-5"
    >
      <div>
        <h2 className="text-lg font-semibold">Nueva muestra</h2>
        <p className="text-sm text-gray-500">
          El semáforo empieza a correr desde la fecha y hora de extracción. Una
          campaña puede agrupar muchas muestras, por eso se cargan por separado.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Campaña</label>
        <select
          required
          value={idCampana}
          onChange={(e) => setIdCampana(e.target.value)}
          className={CAMPO}
        >
          <option value="">Elegí una campaña</option>
          {campanas.map((c) => (
            <option key={c.id_campana} value={c.id_campana}>
              {c.localidad_puna} · {c.fecha_salida}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Código del animal</label>
          <input
            type="text"
            required
            placeholder="Ej: LL-042"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className={CAMPO}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Especie</label>
          <select
            value={especie}
            onChange={(e) => setEspecie(e.target.value as Especie)}
            className={CAMPO}
          >
            {ESPECIES.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Fecha y hora de extracción
        </label>
        <input
          type="datetime-local"
          required
          value={fechaLocal}
          onChange={(e) => setFechaLocal(e.target.value)}
          className={CAMPO}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          URL de la foto de campo (opcional)
        </label>
        <input
          type="url"
          placeholder="https://..."
          value={urlFoto}
          onChange={(e) => setUrlFoto(e.target.value)}
          className={CAMPO}
        />
      </div>

      {error && (
        <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enviando ? "Guardando..." : "Guardar muestra"}
      </button>
    </form>
  );
}
