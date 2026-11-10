import { textoAlerta, type AlertaMuestra } from "@/lib/alertas";

type Props = {
  alertas: AlertaMuestra[];
  enAtencion: number;
  onDescartar: (clave: string) => void;
  onCerrar: () => void;
};

// Panel flotante que cuelga de la campanita. No ocupa lugar en la página:
// solo se monta cuando el usuario abre los avisos.
export default function PanelAvisos({
  alertas,
  enAtencion,
  onDescartar,
  onCerrar,
}: Props) {
  return (
    <section
      aria-labelledby="titulo-avisos"
      className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-red-300 bg-red-50 p-4 shadow-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="titulo-avisos" className="text-base font-semibold text-red-900">
          Avisos de muestras
        </h2>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded px-1 text-lg leading-none text-red-700 hover:bg-red-100"
          aria-label="Cerrar avisos"
        >
          ×
        </button>
      </div>

      {alertas.length === 0 ? (
        <p className="mt-2 text-sm text-gray-700">
          No hay alertas urgentes en este momento.
        </p>
      ) : (
        <>
          <p className="text-sm text-red-800">
            Estas muestras están cerca o pasaron el límite de 48 h.
          </p>

          <ul className="mt-3 space-y-2">
            {alertas.map((alerta) => {
              const vencida = alerta.nivel === "vencida";
              return (
                <li
                  key={alerta.clave}
                  className={`flex items-start justify-between gap-3 rounded border px-3 py-2 ${
                    vencida
                      ? "border-red-300 bg-white"
                      : "border-amber-300 bg-white"
                  }`}
                >
                  <div className="text-sm">
                    <p className="font-medium">
                      {alerta.muestra.codigo_animal}
                      <span className="font-normal text-gray-600">
                        {" "}
                        · {alerta.muestra.localidad_puna}
                      </span>
                    </p>
                    <p className={vencida ? "text-red-800" : "text-amber-800"}>
                      {textoAlerta(alerta)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDescartar(alerta.clave)}
                    className="rounded px-2 py-0.5 text-lg leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    aria-label={`Descartar aviso de ${alerta.muestra.codigo_animal}`}
                    title="Descartar hasta que cambie de estado"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {enAtencion > 0 && (
        <p className="mt-3 text-xs text-red-800">
          Además, {enAtencion}{" "}
          {enAtencion === 1
            ? "muestra está en atención (24 a 40 h)."
            : "muestras están en atención (24 a 40 h)."}
        </p>
      )}
    </section>
  );
}
