"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import SelectorFecha from "@/components/SelectorFecha";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";

type Props = {
  // Recibe la campaña creada para que el formulario de muestra pueda
  // seleccionarla automáticamente.
  onCreada: (campana: Campana) => Promise<void> | void;
  // Sugerencias de autocompletado (localidades/parajes ya usados).
  sugerenciasLocalidad?: string[];
  onCerrar?: () => void;
};

export default function FormularioCampana({
  onCreada,
  sugerenciasLocalidad = [],
  onCerrar,
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
    if (!fechaSalida) {
      setError("Elegí la fecha de salida.");
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
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
    >
      <div>
        <h3 className="text-base font-bold text-slate-900">Nueva campaña</h3>
        <p className="mt-1 text-sm text-slate-600">
          Agrupa las muestras extraídas en una salida a territorio. Al
          guardarla, queda lista para cargar sus muestras.
        </p>
      </div>

      {geoDisponible ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Provincia (Puna)</label>
              <Select
                value={idProvincia}
                onValueChange={(v) => {
                  setIdProvincia(v);
                  setIdDepartamento("");
                  setDepartamentos([]);
                }}
                disabled={cargandoGeo}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      cargandoGeo ? "Cargando..." : "Seleccionar provincia"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {provincias.map((p) => (
                    <SelectItem key={p.id_provincia} value={String(p.id_provincia)}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Departamento</label>
              <Select
                value={idDepartamento}
                onValueChange={setIdDepartamento}
                disabled={!idProvincia}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      idProvincia
                        ? "Seleccionar departamento"
                        : "Elegí una provincia primero"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {departamentos.map((d) => (
                    <SelectItem
                      key={d.id_departamento}
                      value={String(d.id_departamento)}
                    >
                      {d.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
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
            <p className="mt-1 text-xs text-slate-500">
              Opcional, pero recomendado para el punto exacto de muestreo. Podés
              elegir una sugerencia ya cargada.
            </p>
          </div>
        </>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Localidad / referencia</label>
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
        <label className="mb-1 block text-sm font-medium text-slate-700">Fecha de salida</label>
        <SelectorFecha value={fechaSalida} onChange={setFechaSalida} />
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
        <label className="mb-1 block text-sm font-medium text-slate-700">Observaciones (opcional)</label>
        <textarea
          rows={2}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          className={CAMPO}
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {enviando ? "Guardando..." : "Guardar campaña"}
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
