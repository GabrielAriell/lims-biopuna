"use client";

import { useEffect, useState } from "react";
import { DotLottieReact, setWasmUrl } from "@lottiefiles/dotlottie-react";

// El motor WASM se sirve local (la PC del laboratorio no depende de CDN).
setWasmUrl("/dotlottie-player.wasm");

// La animación se descarga una sola vez para toda la app. Al pasar los
// bytes como `data`, el reproductor no hace su propio fetch: desmontar
// el componente no dispara un AbortError en consola.
let datosPromesa: Promise<ArrayBuffer> | null = null;
function obtenerDatos(): Promise<ArrayBuffer> {
  if (!datosPromesa) {
    datosPromesa = fetch("/animaciones/llama.lottie")
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo descargar la animación");
        return r.arrayBuffer();
      })
      .catch((e) => {
        datosPromesa = null;
        throw e;
      });
  }
  return datosPromesa;
}

type Props = {
  texto?: string;
  tamano?: number;
};

// Llama caminando: animación "Moody Llama" de Bashir (LottieFiles,
// licencia Lottie Simple). Archivo local en /public/animaciones.
export default function Cargando({ texto = "Cargando...", tamano = 120 }: Props) {
  const textoLimpio = texto.replace(/[.\s…]+$/, "");
  const [datos, setDatos] = useState<ArrayBuffer | null>(null);

  useEffect(() => {
    let activo = true;
    obtenerDatos()
      .then((d) => {
        if (activo) setDatos(d);
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[55vh] w-full flex-col items-center justify-center gap-2"
    >
      {/* Caja de tamaño fijo: el canvas aparece sin empujar el texto. */}
      <div style={{ width: tamano, height: tamano }}>
        {datos && (
          <DotLottieReact
            data={datos}
            autoplay
            loop
            style={{ width: "100%", height: "100%" }}
          />
        )}
      </div>
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {textoLimpio}
        <span className="flex gap-1" aria-hidden>
          <span className="size-1.5 animate-bounce rounded-full bg-emerald-500" />
          <span className="size-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:150ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:300ms]" />
        </span>
      </p>
    </div>
  );
}
