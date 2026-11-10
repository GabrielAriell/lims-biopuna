type Props = {
  cantidad: number;
  abierto: boolean;
  onToggle: () => void;
};

export default function BotonAvisos({ cantidad, abierto, onToggle }: Props) {
  const hayAvisos = cantidad > 0;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={abierto}
      aria-label={
        hayAvisos
          ? `Avisos: ${cantidad} ${cantidad === 1 ? "muestra requiere" : "muestras requieren"} atención`
          : "Avisos: sin alertas urgentes"
      }
      className={`relative rounded border px-3 py-1.5 text-sm ${
        hayAvisos
          ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
          : "border-gray-300 text-gray-500 hover:bg-gray-100"
      }`}
    >
      <span className="flex items-center gap-1.5">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-4 w-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        Avisos
      </span>
      {hayAvisos && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
          {cantidad}
        </span>
      )}
    </button>
  );
}
