import DetalleMuestraCliente from "./DetalleMuestraCliente";

// Detalle dinámico por muestra (sesión + datos de cliente). "instant" no se
// puede exportar desde Client Components; el page server delega y se opta fuera.
export const instant = false;

type Props = {
  params: Promise<{ idMuestra: string }> | { idMuestra: string };
};

export default async function PaginaDetalleMuestra({ params }: Props) {
  const resueltos = await Promise.resolve(params);
  const id = Number(resueltos.idMuestra);
  const idValido = Number.isInteger(id) && id > 0 ? id : 0;
  return <DetalleMuestraCliente key={idValido} idMuestra={idValido} />;
}
