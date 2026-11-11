import type { PixelCrop } from "react-image-crop";

import { MAX_BYTES_PNG } from "./config";

export type ImagenRecortada = { archivo: File; ancho: number; alto: number };

const MAX_DIMENSION_ANALISIS = 2400;
const CALIDAD_JPEG = 0.9;

function aBlob(lienzo: HTMLCanvasElement, tipo: string, calidad?: number) {
  return new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, tipo, calidad));
}

function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolver(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}

// Reduce imágenes muy grandes antes de mostrarlas/analizarlas para evitar
// problemas de memoria en celulares y en el servidor.
export async function prepararImagenParaAnalisis(archivo: File): Promise<File> {
  const imagen = await cargarImagen(archivo);
  const { naturalWidth: ancho, naturalHeight: alto } = imagen;
  const escala = Math.min(1, MAX_DIMENSION_ANALISIS / Math.max(ancho, alto));
  const destinoAncho = Math.max(1, Math.round(ancho * escala));
  const destinoAlto = Math.max(1, Math.round(alto * escala));

  // Si ya es pequeña, conservar el archivo original.
  if (escala === 1) return archivo;

  const lienzo = document.createElement("canvas");
  lienzo.width = destinoAncho;
  lienzo.height = destinoAlto;
  const contexto = lienzo.getContext("2d");
  if (!contexto) throw new Error("El navegador no permite procesar imágenes");
  contexto.drawImage(imagen, 0, 0, destinoAncho, destinoAlto);

  const blob = await aBlob(lienzo, "image/jpeg", CALIDAD_JPEG);
  if (!blob) throw new Error("No se pudo preparar la imagen");

  const base = archivo.name.replace(/\.[^.]+$/, "") || "imagen";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
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
