"use client";

import NuevoEnsayo from "@/components/NuevoEnsayo";

type Props = {
  idMuestraInicial: number | null;
};

export default function NuevoEnsayoVista({ idMuestraInicial }: Props) {
  return <NuevoEnsayo idMuestraInicial={idMuestraInicial} />;
}
