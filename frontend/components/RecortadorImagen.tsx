"use client";

import { useRef, useState } from "react";
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
  const imgRef = useRef<HTMLImageElement>(null);

  function quitarRecorte() {
    setCrop(undefined);
    onRecorte(undefined, null);
  }

  function alTerminar(pixeles: PixelCrop) {
    const valido = pixeles.width >= 5 && pixeles.height >= 5;
    onRecorte(valido ? pixeles : undefined, valido ? imgRef.current : null);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Recortar la zona a analizar</h2>
        <div className="flex flex-wrap gap-2">
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
            onClick={quitarRecorte}
            disabled={!crop}
            className={BOTON}
          >
            Quitar recorte
          </button>
        </div>
      </div>
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
        <div className="flex h-[55vh] items-center justify-center overflow-hidden rounded bg-gray-100 p-2">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={alTerminar}
            minWidth={20}
            minHeight={20}
            keepSelection
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt="Imagen original para recortar"
              onError={() => setNoSePuedeMostrar(true)}
              style={{ maxHeight: "52vh", maxWidth: "100%" }}
            />
          </ReactCrop>
        </div>
      )}
    </div>
  );
}