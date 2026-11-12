import { Suspense } from "react";

import MarcoDashboard from "@/components/MarcoDashboard";
import NuevoEnsayoVista from "./NuevoEnsayoVista";

// Depende de sesión + searchParams/datos dinámicos; se opta fuera de la
// validación de navegación instantánea de Cache Components.
export const instant = false;

type Props = {
  searchParams: Promise<{ muestra?: string | string[] }>;
};

export default function PaginaNuevoEnsayo({ searchParams }: Props) {
  return (
    <MarcoDashboard
      activa="ensayos"
      titulo="Nuevo Ensayo Electroforético"
      subtitulo="Seleccioná una muestra registrada para asociar los resultados, o analizá una tira libremente para control rápido."
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-xs">
              Cargando estación de ensayo...
            </div>
          }
        >
          <Contenido searchParams={searchParams} />
        </Suspense>
      </div>
    </MarcoDashboard>
  );
}

// searchParams es una API de tiempo de petición: se lee dentro de un
// <Suspense> para que el resto de la página se pueda prerenderizar.
async function Contenido({ searchParams }: Props) {
  const parametros = await searchParams;
  const crudo = Array.isArray(parametros.muestra)
    ? parametros.muestra[0]
    : parametros.muestra;
  const numero = Number(crudo);
  const idMuestraInicial =
    Number.isInteger(numero) && numero > 0 ? numero : null;

  return <NuevoEnsayoVista idMuestraInicial={idMuestraInicial} />;
}
