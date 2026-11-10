import { Suspense } from "react";

import Encabezado from "@/components/Encabezado";
import NuevoEnsayoVista from "./NuevoEnsayoVista";

// Depende de sesión + searchParams/datos dinámicos; se opta fuera de la
// validación de navegación instantánea de Cache Components.
export const instant = false;

type Props = {
  searchParams: Promise<{ muestra?: string | string[] }>;
};

export default function PaginaNuevoEnsayo({ searchParams }: Props) {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Encabezado activa="ensayos" />
        <div>
          <h1 className="text-2xl font-bold">Nuevo ensayo</h1>
          <p className="text-gray-600">
            Elegí una muestra para guardar un ensayo, o analizá una imagen sin
            muestra para usarla como análisis libre.
          </p>
        </div>
        <Suspense
          fallback={
            <p className="rounded border border-gray-200 bg-white p-5 text-sm text-gray-500">
              Cargando muestra...
            </p>
          }
        >
          <Contenido searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
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
