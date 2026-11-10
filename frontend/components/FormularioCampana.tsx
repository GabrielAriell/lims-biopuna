"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  crearCampana,
  listarDepartamentos,
  listarProvincias,
} from "@/lib/api-muestras";
import type {
  Campana,
  Departamento,
  NuevaCampana,
  Provincia,
} from "@/lib/tipos-muestras";

const CAMPO =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900";

type Props = {
  // Recibe la campaña creada para que el formulario de muestra pueda
  // seleccionarla automáticamente.
  onCreada: (campana: Campana) => Promise<void> | void;
  // Sugerencias de autocompletado (localidades/parajes ya usados).
  sugerenciasLocalidad?: string[];
};

export default function FormularioCampana({
  onCreada,
  sugerenciasLocalidad = [],
}: Props) {
  const [provincias, setProvincias] = useState<Provincia[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [idProvincia, setIdProvincia] = useState("");
  const [idDepartamento, setIdDepartamento] = useState("");
  const [localidadDetalle, setLocalidadDetalle] = useState("");
  const [localidadLegacy, setLocalidadLegacy] = useState("");
  const [fechaSalida, setFechaSalida] = useState("");
  const [convenioInta, setConvenioInta] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [cargandoGeo, setCargandoGeo] = useState(true);
  const [geoDisponible, setGeoDisponible] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    listarProvincias()
      .then((filas) => {
        if (!activo) return;
        setProvincias(filas);
        setGeoDisponible(filas.length > 0);
      })
      .catch(() => {
        if (!activo) return;
        // Si la migración 005 no se ejecutó, se usa el campo libre legacy.
        setGeoDisponible(false);
      })
      .finally(() => {
        if (activo) setCargandoGeo(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (!idProvincia) return;
    let activo = true;
    listarDepartamentos(Number(idProvincia))
      .then((filas) => {
        if (activo) setDepartamentos(filas);
      })
      .catch(() => {
        if (activo) setDepartamentos([]);
      });
    return () => {
      activo = false;
    };
  }, [idProvincia]);

  const ubicacionValida = useMemo(() => {
    if (geoDisponible) return Boolean(idDepartamento) || Boolean(localidadLegacy.trim());
    return Boolean(localidadLegacy.trim());
  }, [geoDisponible, idDepartamento, localidadLegacy]);

  function limpiar() {
    setIdProvincia("");
    setIdDepartamento("");
    setLocalidadDetalle("");
    setLocalidadLegacy("");
    setFechaSalida("");
    setConvenioInta(false);
    setObservaciones("");
    setDepartamentos([]);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    if (!ubicacionValida) {
      setError("Indicá un departamento o, al menos, una localidad de referencia.");
      return;
    }
    setEnviando(true);
    try {
      const datos: NuevaCampana = {
        fecha_salida: fechaSalida,
        convenio_inta: convenioInta,
        observaciones,
      };
      if (geoDisponible && idDepartamento) {
        datos.id_departamento = Number(idDepartamento);
      }
      if (localidadDetalle.trim()) datos.localidad_detalle = localidadDetalle.trim();
      if (localidadLegacy.trim()) datos.localidad_puna = localidadLegacy.trim();

      const campana = await crearCampana(datos);
      limpiar();
      await onCreada(campana);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la campaña");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-5"
    >
      <div>
        <h2 className="text-lg font-semibold">Nueva campaña</h2>
        <p className="text-sm text-gray-500">
          Agrupa las muestras extraídas en una salida a territorio. Al guardarla,
          queda elegida automáticamente para cargar sus muestras.
        </p>
      </div>

      {geoDisponible ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Provincia (Puna)</label>
              <select
                value={idProvincia}
                onChange={(e) => {
                  setIdProvincia(e.target.value);
                  setIdDepartamento("");
                  setDepartamentos([]);
                }}
                disabled={cargandoGeo}
                className={CAMPO}
              >
                <option value="">
                  {cargandoGeo ? "Cargando..." : "Seleccionar provincia"}
                </option>
                {provincias.map((p) => (
                  <option key={p.id_provincia} value={p.id_provincia}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Departamento</label>
              <select
                value={idDepartamento}
                onChange={(e) => setIdDepartamento(e.target.value)}
                disabled={!idProvincia}
                className={CAMPO}
              >
                <option value="">
                  {idProvincia ? "Seleccionar departamento" : "Elegí una provincia primero"}
                </option>
                {departamentos.map((d) => (
                  <option key={d.id_departamento} value={d.id_departamento}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Localidad / paraje (texto libre)
            </label>
            <input
              type="text"
              list="localidades-campana"
              placeholder="Ej: Puesto El Cóndor, Abra Pampa, paraje..."
              value={localidadDetalle}
              onChange={(e) => setLocalidadDetalle(e.target.value)}
              className={CAMPO}
            />
            <datalist id="localidades-campana">
              {sugerenciasLocalidad.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-gray-500">
              Opcional, pero recomendado para el punto exacto de muestreo. Podés
              elegir una sugerencia ya cargada.
            </p>
          </div>
        </>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium">Localidad / referencia</label>
          <input
            type="text"
            required
            list="localidades-campana-legacy"
            placeholder="Ej: Abra Pampa"
            value={localidadLegacy}
            onChange={(e) => setLocalidadLegacy(e.target.value)}
            className={CAMPO}
          />
          <datalist id="localidades-campana-legacy">
            {sugerenciasLocalidad.map((loc) => (
              <option key={loc} value={loc} />
            ))}
          </datalist>
          {!cargandoGeo && (
            <p className="mt-1 text-xs text-amber-700">
              El catálogo provincia/departamento no está disponible (falta ejecutar
              migración 005). Se guarda como texto libre.
            </p>
          )}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Fecha de salida</label>
        <input
          type="date"
          required
          value={fechaSalida}
          onChange={(e) => setFechaSalida(e.target.value)}
          className={CAMPO}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={convenioInta}
          onChange={(e) => setConvenioInta(e.target.checked)}
        />
        La campaña tiene convenio con INTA
      </label>

      <div>
        <label className="mb-1 block text-sm font-medium">Observaciones (opcional)</label>
        <textarea
          rows={2}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
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
        {enviando ? "Guardando..." : "Guardar campaña"}
      </button>
    </form>
  );
}
