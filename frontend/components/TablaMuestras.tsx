import Link from "next/link";

import Semaforo from "./Semaforo";
import type { Muestra } from "@/lib/tipos-muestras";

function fechaCorta(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
}

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function TablaMuestras({ muestras }: { muestras: Muestra[] }) {
  if (muestras.length === 0) {
    return (
      <p className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
        No hay muestras para mostrar. Creá una campaña y cargá la primera muestra.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2">Código</th>
            <th className="px-3 py-2">Especie</th>
            <th className="px-3 py-2">Campaña</th>
            <th className="px-3 py-2">Extracción</th>
            <th className="px-3 py-2">Horas</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {muestras.map((muestra) => (
            <tr key={muestra.id_muestra} className="border-t border-gray-100">
              <td className="px-3 py-2 font-medium">{muestra.codigo_animal}</td>
              <td className="px-3 py-2">{muestra.especie}</td>
              <td className="px-3 py-2">
                <div>{muestra.localidad_puna}</div>
                <div className="text-xs text-gray-500">
                  {fechaCorta(muestra.fecha_salida)}
                </div>
              </td>
              <td className="px-3 py-2">{fechaHora(muestra.fecha_hora_extraccion)}</td>
              <td className="px-3 py-2">{muestra.horas_transcurridas.toFixed(1)} h</td>
              <td className="px-3 py-2">
                <Semaforo estado={muestra.estado_48h} />
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1.5">
                  <Link
                    href={`/muestras/${muestra.id_muestra}`}
                    className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Ver detalle
                  </Link>
                  <Link
                    href={`/ensayos/nuevo?muestra=${muestra.id_muestra}`}
                    className="rounded border border-blue-300 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                  >
                    {muestra.estado_48h === "procesada"
                      ? "Nuevo ensayo"
                      : "Procesar"}
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
