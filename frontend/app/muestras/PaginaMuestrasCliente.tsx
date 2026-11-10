"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import Encabezado from "@/components/Encabezado";
import BotonAvisos from "@/components/BotonAvisos";
import FormularioCampana from "@/components/FormularioCampana";
import FormularioMuestra from "@/components/FormularioMuestra";
import PanelAvisos from "@/components/PanelAvisos";
import { useSesion } from "@/components/ProveedorSesion";
import { useAlertasMuestras } from "@/hooks/useAlertasMuestras";
import { useMuestras } from "@/hooks/useMuestras";
import type { EstadoMuestra } from "@/lib/tipos-muestras";

const TARJETAS: {
  clave: EstadoMuestra;
  titulo: string;
  detalle: string;
  clase: string;
}[] = [
  {
    clave: "verde",
    titulo: "En plazo",
    detalle: "menos de 24 h",
    clase: "border-green-300 bg-green-50 text-green-900",
  },
  {
    clave: "amarillo",
    titulo: "Atención",
    detalle: "entre 24 y 40 h",
    clase: "border-yellow-300 bg-yellow-50 text-yellow-900",
  },
  {
    clave: "rojo",
    titulo: "Fuera de plazo",
    detalle: "más de 40 h",
    clase: "border-red-300 bg-red-50 text-red-900",
  },
  {
    clave: "procesada",
    titulo: "Procesadas",
    detalle: "ya tienen ensayo",
    clase: "border-gray-300 bg-gray-100 text-gray-800",
  },
];

export default function PaginaMuestrasCliente() {
  const { usuario } = useSesion();
  const soloLectura = usuario?.rol_sistema === "lectura";
  const { campanas, muestras, actualizando, error, recargar } = useMuestras();
  const { visibles: avisos, enAtencion, descartar } =
    useAlertasMuestras(muestras);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [semaforoAbierto, setSemaforoAbierto] = useState(false);
  const [campanaReciente, setCampanaReciente] = useState<number | null>(null);

  const sugerenciasLocalidad = useMemo(() => {
    const valores = campanas
      .map((c) => c.localidad_detalle?.trim())
      .filter((v): v is string => Boolean(v));
    return Array.from(new Set(valores)).sort((a, b) => a.localeCompare(b, "es"));
  }, [campanas]);

  const resumen = useMemo(() => {
    const cuenta: Record<EstadoMuestra, number> = {
      verde: 0,
      amarillo: 0,
      rojo: 0,
      procesada: 0,
    };
    for (const muestra of muestras) cuenta[muestra.estado_48h] += 1;
    return cuenta;
  }, [muestras]);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <Encabezado activa="muestras" />

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
            {error}
          </div>
        )}

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setSemaforoAbierto((v) => !v)}
              className="flex items-center gap-2 text-left"
              aria-expanded={semaforoAbierto}
            >
              <span className="text-lg font-semibold">Semáforo de 48 horas</span>
              <span className="text-sm text-gray-500">
                {semaforoAbierto ? "▲ ocultar" : "▼ mostrar"}
              </span>
            </button>
            <div className="flex items-center gap-2">
              <div className="relative">
                <BotonAvisos
                  cantidad={avisos.length}
                  abierto={panelAbierto}
                  onToggle={() => setPanelAbierto((abierto) => !abierto)}
                />
                {panelAbierto && (
                  <PanelAvisos
                    alertas={avisos}
                    enAtencion={enAtencion}
                    onDescartar={descartar}
                    onCerrar={() => setPanelAbierto(false)}
                  />
                )}
              </div>
              <button
                onClick={recargar}
                disabled={actualizando}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actualizando ? "Actualizando..." : "Actualizar"}
              </button>
            </div>
          </div>

          {semaforoAbierto && (
            <div className="mt-3 space-y-3">
              <p className="max-w-2xl text-sm text-gray-500">
                El plazo máximo para procesar la muestra es de 48 h. Para
                avisarte antes, la base calcula tres colores desde la extracción
                hasta la corrida: verde &lt; 24 h, amarillo 24–40 h y rojo &gt; 40 h.
                Cuando la muestra ya tiene un ensayo, pasa a &quot;procesada&quot; y
                deja de contar para el semáforo.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {TARJETAS.map((tarjeta) => (
                  <div
                    key={tarjeta.clave}
                    className={`rounded-lg border p-4 ${tarjeta.clase}`}
                  >
                    <p className="text-sm font-medium">{tarjeta.titulo}</p>
                    <p className="text-2xl font-bold">{resumen[tarjeta.clave]}</p>
                    <p className="text-xs">{tarjeta.detalle}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {soloLectura ? (
          <section className="rounded-lg border border-blue-200 bg-blue-50 p-5">
            <h2 className="text-lg font-semibold text-blue-900">
              Vista de solo lectura
            </h2>
            <p className="mt-1 text-sm text-blue-800">
              Tu usuario no puede crear campañas ni muestras. Podés consultar el
              estado operativo y revisar todos los datos en Exploración.
            </p>
            <Link
              href="/exploracion"
              className="mt-3 inline-flex rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Ir a Exploración
            </Link>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <FormularioCampana
              sugerenciasLocalidad={sugerenciasLocalidad}
              onCreada={async (campana) => {
                setCampanaReciente(campana.id_campana);
                await recargar();
              }}
            />
            <FormularioMuestra
              key={campanaReciente ?? "sin-campana"}
              campanas={campanas}
              idCampanaInicial={campanaReciente}
              onCreada={recargar}
            />
          </div>
        )}

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Consulta y listado de muestras</h2>
          <p className="mt-1 text-sm text-gray-600">
            Para buscar, filtrar, revisar resultados por especie/animal/investigador
            y exportar datos, usá la pestaña de exploración.
          </p>
          <Link
            href="/exploracion"
            className="mt-3 inline-flex rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Ir a Exploración
          </Link>
        </section>
      </div>
    </main>
  );
}
