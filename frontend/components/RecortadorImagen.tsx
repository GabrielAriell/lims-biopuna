// "use client";

// import { useRef, useState } from "react";
// import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
// import "react-image-crop/dist/ReactCrop.css";

// type Props = {
//   src: string;
//   onRecorte: (crop: PixelCrop | undefined, imagen: HTMLImageElement | null) => void;
//   onTransformar: (tipo: "izq" | "der" | "espejo") => void;
// };

// const BOTON =
//   "rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";

// export default function RecortadorImagen({ src, onRecorte, onTransformar }: Props) {
//   const [crop, setCrop] = useState<Crop>();
//   const [noSePuedeMostrar, setNoSePuedeMostrar] = useState(false);
//   const imgRef = useRef<HTMLImageElement>(null);

//   function quitarRecorte() {
//     setCrop(undefined);
//     onRecorte(undefined, null);
//   }

//   function alTerminar(pixeles: PixelCrop) {
//     const valido = pixeles.width >= 5 && pixeles.height >= 5;
//     onRecorte(valido ? pixeles : undefined, valido ? imgRef.current : null);
//   }

//   return (
//     <div className="space-y-3">
//       <div className="flex flex-wrap items-center justify-between gap-2">
//         <h2 className="text-lg font-semibold">Recortar la zona a analizar</h2>
//         <div className="flex flex-wrap gap-2">
//           <button
//             type="button"
//             onClick={() => onTransformar("izq")}
//             disabled={noSePuedeMostrar}
//             className={BOTON}
//             title="Girar 90° a la izquierda"
//           >
//             ↺ Girar izq.
//           </button>
//           <button
//             type="button"
//             onClick={() => onTransformar("der")}
//             disabled={noSePuedeMostrar}
//             className={BOTON}
//             title="Girar 90° a la derecha"
//           >
//             ↻ Girar der.
//           </button>
//           <button
//             type="button"
//             onClick={() => onTransformar("espejo")}
//             disabled={noSePuedeMostrar}
//             className={BOTON}
//             title="Voltear horizontalmente (albúmina a la izquierda)"
//           >
//             ⇄ Voltear horizontal
//           </button>
//           <button
//             type="button"
//             onClick={quitarRecorte}
//             disabled={!crop}
//             className={BOTON}
//           >
//             Quitar recorte
//           </button>
//         </div>
//       </div>
//       <p className="text-sm text-gray-600">
//         Orientá la tira horizontalmente con la albúmina a la izquierda y arrastrá sobre la imagen
//         para elegir solo la tira.
//       </p>

//       {noSePuedeMostrar ? (
//         <p className="rounded bg-yellow-50 p-2 text-sm text-yellow-800">
//           Este formato no se puede mostrar en el navegador (por ejemplo, TIFF). No se puede
//           recortar acá: se analizará la imagen completa.
//         </p>
//       ) : (
//         <div className="flex h-[55vh] items-center justify-center overflow-hidden rounded bg-gray-100 p-2">
//           <ReactCrop
//             crop={crop}
//             onChange={(c) => setCrop(c)}
//             onComplete={alTerminar}
//             minWidth={20}
//             minHeight={20}
//             keepSelection
//           >
//             {/* eslint-disable-next-line @next/next/no-img-element */}
//             <img
//               ref={imgRef}
//               src={src}
//               alt="Imagen original para recortar"
//               onError={() => setNoSePuedeMostrar(true)}
//               style={{ maxHeight: "52vh", maxWidth: "100%" }}
//             />
//           </ReactCrop>
//         </div>
//       )}
//     </div>
//   );
// }

"use client";

import { useRef, useState, type MouseEvent } from "react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

type Props = {
  src: string;
  onRecorte: (crop: PixelCrop | undefined, imagen: HTMLImageElement | null) => void;
  onTransformar: (tipo: "izq" | "der" | "espejo") => void;
};

const BOTON =
  "rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";

export default function RecortadorImagen({ src, onRecorte, onTransformar }: Props) {
  const [crop, setCrop] = useState<Crop>();
  const [noSePuedeMostrar, setNoSePuedeMostrar] = useState(false);

  const [anguloFino, setAnguloFino] = useState(0);
  const [srcRotado, setSrcRotado] = useState<string | null>(null);
  const [srcAnterior, setSrcAnterior] = useState(src);
  const [ajustandoAngulo, setAjustandoAngulo] = useState(false);
  const [modoGirarMouse, setModoGirarMouse] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const arrastreMouseRef = useRef({ activo: false, xInicial: 0, anguloInicial: 0 });

  // Si cambia la imagen original (archivo nuevo o giro 90°), resetea el ángulo fino
  if (src !== srcAnterior) {
    setSrcAnterior(src);
    setAnguloFino(0);
    setSrcRotado(null);
    setNoSePuedeMostrar(false);
  }

  function actualizarAngulo(grados: number) {
    const limpio = Number(Math.max(-15, Math.min(15, grados)).toFixed(1));
    setAnguloFino(limpio);

    if (Math.abs(limpio) < 0.05) {
      setSrcRotado(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Rellena bordes nuevos con gris claro para no meter negro en las esquinas
      ctx.fillStyle = "#f3f4f6";
      ctx.fillRect(0, 0, w, h);

      ctx.translate(w / 2, h / 2);
      ctx.rotate((limpio * Math.PI) / 180);
      ctx.drawImage(img, -w / 2, -h / 2);

      setSrcRotado(canvas.toDataURL("image/png"));
    };
    img.src = src;
  }

  function quitarRecorte() {
    setCrop(undefined);
    onRecorte(undefined, null);
  }

  function alTerminar(pixeles: PixelCrop) {
    const valido = pixeles.width >= 5 && pixeles.height >= 5;
    onRecorte(valido ? pixeles : undefined, valido ? imgRef.current : null);
  }

  function iniciarGiroMouse(e: MouseEvent<HTMLDivElement>) {
    if (!modoGirarMouse && !e.shiftKey) return;
    e.preventDefault();
    e.stopPropagation();
    setAjustandoAngulo(true);
    arrastreMouseRef.current = {
      activo: true,
      xInicial: e.clientX,
      anguloInicial: anguloFino,
    };
  }

  function moverGiroMouse(e: MouseEvent<HTMLDivElement>) {
    if (!arrastreMouseRef.current.activo) return;
    const deltaX = e.clientX - arrastreMouseRef.current.xInicial;
    actualizarAngulo(arrastreMouseRef.current.anguloInicial + deltaX * 0.05);
  }

  function terminarGiroMouse() {
    if (arrastreMouseRef.current.activo) {
      arrastreMouseRef.current.activo = false;
      setAjustandoAngulo(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Recortar la zona a analizar</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onTransformar("izq")}
            disabled={noSePuedeMostrar}
            className={BOTON}
            title="Girar 90° a la izquierda"
          >
            ↺ Girar izq.
          </button>
          <button
            type="button"
            onClick={() => onTransformar("der")}
            disabled={noSePuedeMostrar}
            className={BOTON}
            title="Girar 90° a la derecha"
          >
            ↻ Girar der.
          </button>
          <button
            type="button"
            onClick={() => onTransformar("espejo")}
            disabled={noSePuedeMostrar}
            className={BOTON}
            title="Voltear horizontalmente (albúmina a la izquierda)"
          >
            ⇄ Voltear horizontal
          </button>
          <button
            type="button"
            onClick={() => setModoGirarMouse((v) => !v)}
            disabled={noSePuedeMostrar}
            className={`${BOTON} ${
              modoGirarMouse ? "!border-blue-600 !bg-blue-50 !text-blue-700" : ""
            }`}
            title="Activa el giro libre arrastrando con el mouse"
          >
            🧭 {modoGirarMouse ? "Listo (recortar)" : "Girar con mouse"}
          </button>
          <button
            type="button"
            onClick={quitarRecorte}
            disabled={!crop}
            className={BOTON}
          >
            Quitar recorte
          </button>
        </div>
      </div>

      {!noSePuedeMostrar && (
        <div className="flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm">
          <label htmlFor="angulo-fino" className="font-medium text-gray-700">
            Inclinación:{" "}
            <span className="tabular-nums text-blue-700">
              {anguloFino > 0 ? `+${anguloFino.toFixed(1)}` : anguloFino.toFixed(1)}°
            </span>
          </label>
          <input
            id="angulo-fino"
            type="range"
            min={-15}
            max={15}
            step={0.2}
            value={anguloFino}
            onMouseDown={() => setAjustandoAngulo(true)}
            onMouseUp={() => setAjustandoAngulo(false)}
            onChange={(e) => actualizarAngulo(Number(e.target.value))}
            className="w-36 accent-blue-600"
          />
          {anguloFino !== 0 && (
            <button
              type="button"
              onClick={() => actualizarAngulo(0)}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              0°
            </button>
          )}
          <span className="text-xs text-gray-500">
            (o mantené <b>Shift + arrastrar</b> con el mouse sobre la foto)
          </span>
        </div>
      )}

      <p className="text-sm text-gray-600">
        Orientá la tira horizontalmente con la albúmina a la izquierda y arrastrá sobre la imagen
        para elegir solo la tira.
      </p>

      {noSePuedeMostrar ? (
        <p className="rounded bg-yellow-50 p-2 text-sm text-yellow-800">
          Este formato no se puede mostrar en el navegador (por ejemplo, TIFF). No se puede
          recortar acá: se analizará la imagen completa.
        </p>
      ) : (
        <div
          onMouseDownCapture={iniciarGiroMouse}
          onMouseMove={moverGiroMouse}
          onMouseUp={terminarGiroMouse}
          onMouseLeave={terminarGiroMouse}
          className={`relative flex h-[55vh] items-center justify-center overflow-hidden rounded bg-gray-100 p-2 select-none ${
            modoGirarMouse ? "cursor-ew-resize" : ""
          }`}
        >
          {(ajustandoAngulo || modoGirarMouse) && (
            <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-evenly">
              <div className="w-full border-t border-dashed border-cyan-500/80" />
              <div className="w-full border-t border-cyan-500" />
              <div className="w-full border-t border-dashed border-cyan-500/80" />
            </div>
          )}

          <ReactCrop
            crop={crop}
            onChange={(c) => {
              if (!modoGirarMouse && !arrastreMouseRef.current.activo) setCrop(c);
            }}
            onComplete={alTerminar}
            minWidth={20}
            minHeight={20}
            keepSelection
            disabled={modoGirarMouse}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={srcRotado ?? src}
              alt="Imagen original para recortar"
              onLoad={() => {
                if (crop && crop.width >= 5 && crop.height >= 5 && imgRef.current) {
                  onRecorte(
                    {
                      unit: "px",
                      x: crop.x,
                      y: crop.y,
                      width: crop.width,
                      height: crop.height,
                    },
                    imgRef.current,
                  );
                }
              }}
              onError={() => setNoSePuedeMostrar(true)}
              style={{ maxHeight: "52vh", maxWidth: "100%" }}
            />
          </ReactCrop>
        </div>
      )}
    </div>
  );
}