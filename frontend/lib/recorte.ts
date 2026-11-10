import type { PixelCrop } from "react-image-crop";

import { MAX_BYTES_PNG } from "./config";

export type ImagenRecortada = { archivo: File; ancho: number; alto: number };

function aBlob(lienzo: HTMLCanvasElement, tipo: string, calidad?: number) {
  return new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, tipo, calidad));
}

// Recorta la imagen mostrada en pantalla. El recuadro (crop) viene en píxeles
// de lo que se ve; se convierte a píxeles reales de la foto.
export async function recortarArchivo(
  imagen: HTMLImageElement,
  crop: PixelCrop,
  nombreOriginal: string,
): Promise<ImagenRecortada> {
  const escalaX = imagen.naturalWidth / imagen.width;
  const escalaY = imagen.naturalHeight / imagen.height;
  const x = Math.round(crop.x * escalaX);
  const y = Math.round(crop.y * escalaY);
  const ancho = Math.max(1, Math.round(crop.width * escalaX));
  const alto = Math.max(1, Math.round(crop.height * escalaY));

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext("2d");
  if (!contexto) throw new Error("El navegador no permite recortar imágenes");
  contexto.drawImage(imagen, x, y, ancho, alto, 0, 0, ancho, alto);

  // PNG no pierde calidad; si pesa demasiado, JPEG de calidad alta.
  let tipo = "image/png";
  let blob = await aBlob(lienzo, tipo);
  if (blob && blob.size > MAX_BYTES_PNG) {
    tipo = "image/jpeg";
    blob = await aBlob(lienzo, tipo, 0.95);
  }
  if (!blob) throw new Error("No se pudo generar la imagen recortada");

  const base = nombreOriginal.replace(/\.[^.]+$/, "");
  const extension = tipo === "image/png" ? "png" : "jpg";
  const archivo = new File([blob], `${base}_recorte.${extension}`, { type: tipo });
  return { archivo, ancho, alto };
}
