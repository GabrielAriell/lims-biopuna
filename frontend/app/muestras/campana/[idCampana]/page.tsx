import DetalleCampanaCliente from "./DetalleCampanaCliente";

// Detalle dinámico por campaña (sesión + datos de cliente). "instant" no se
// puede exportar desde Client Components; el page server delega y se opta fuera.
export const instant = false;

type Props = {
  params: Promise<{ idCampana: string }> | { idCampana: string };
};

export default async function PaginaDetalleCampana({ params }: Props) {
  const resueltos = await Promise.resolve(params);
  const id = Number(resueltos.idCampana);
  const idValido = Number.isInteger(id) && id > 0 ? id : 0;
  return <DetalleCampanaCliente key={idValido} idCampana={idValido} />;
}
