import type { EstadoMuestra } from "@/lib/tipos-muestras";

const ESTILOS: Record<
  EstadoMuestra,
  { etiqueta: string; clase: string; punto: string }
> = {
  verde: {
    etiqueta: "En plazo",
    clase: "border-green-300 bg-green-50 text-green-800",
    punto: "bg-green-500",
  },
  amarillo: {
    etiqueta: "Atención",
    clase: "border-yellow-300 bg-yellow-50 text-yellow-800",
    punto: "bg-yellow-500",
  },
  rojo: {
    etiqueta: "Fuera de plazo",
    clase: "border-red-300 bg-red-50 text-red-800",
    punto: "bg-red-500",
  },
  procesada: {
    etiqueta: "Procesada",
    clase: "border-gray-300 bg-gray-100 text-gray-700",
    punto: "bg-gray-400",
  },
};

export default function Semaforo({ estado }: { estado: EstadoMuestra }) {
  const estilo = ESTILOS[estado] ?? ESTILOS.rojo;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${estilo.clase}`}
    >
      <span className={`h-2 w-2 rounded-full ${estilo.punto}`} />
      {estilo.etiqueta}
    </span>
  );
}
