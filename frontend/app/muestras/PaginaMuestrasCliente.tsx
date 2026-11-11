"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import Encabezado from "@/components/Encabezado";
import BotonAvisos from "@/components/BotonAvisos";
import FormularioCampana from "@/components/FormularioCampana";
import FormularioMuestra from "@/components/FormularioMuestra";
import PanelAvisos from "@/components/PanelAvisos";
import { useAlertasMuestras } from "@/hooks/useAlertasMuestras";
import { useMuestras } from "@/hooks/useMuestras";

export default function PaginaMuestrasCliente() {
  const { campanas, muestras, actualizando, error, recargar } = useMuestras();
  const { visibles: avisos, enAtencion, descartar } =
    useAlertasMuestras(muestras);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [campanaReciente, setCampanaReciente] = useState<number | null>(null);

  const sugerenciasLocalidad = useMemo(() => {
    const valores = campanas
      .map((c) => c.localidad_detalle?.trim())
      .filter((v): v is string => Boolean(v));
    return Array.from(new Set(valores)).sort((a, b) => a.localeCompare(b, "es"));
  }, [campanas]);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <Encabezado activa="muestras" />

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
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
