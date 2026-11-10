"use client";

import { useRef, useState } from "react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

type Props = {
  src: string;
  onRecorte: (crop: PixelCrop | undefined, imagen: HTMLImageElement | null) => void;
};

export default function RecortadorImagen({ src, onRecorte }: Props) {
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
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Recortar la zona a analizar</h2>
        <button
          onClick={quitarRecorte}
          disabled={!crop}
          className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
        >
          Quitar recorte
        </button>
      </div>
      <p className="text-sm text-gray-600">
        Arrastrá sobre la imagen para elegir solo la tira (sin bordes ni texto). Podés mover el
        recuadro y estirarlo desde las esquinas. Si no recortás, se analiza la imagen completa.
      </p>

      {noSePuedeMostrar ? (
        <p className="rounded bg-yellow-50 p-2 text-sm text-yellow-800">
          Este formato no se puede mostrar en el navegador (por ejemplo, TIFF). No se puede
          recortar acá: se analizará la imagen completa.
        </p>
      ) : (
        <div className="flex justify-center rounded bg-gray-100 p-2">
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
              style={{ maxHeight: "70vh", maxWidth: "100%" }}
            />
          </ReactCrop>
        </div>
      )}
    </div>
  );
}
