import type { Modo, Parametros } from "./tipos";

// Dirección de la API: se cambia en frontend/.env.local, no en el código.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export const PARAMETROS_INICIALES: Parametros = {
  proteinasTotales: "",
  prominencia: 0.05,
  modo: "gris_invertido",
  nCarriles: "",
  vertical: false,
  invertir: false,
};

export const SENSIBILIDAD = { min: 0.02, max: 0.3, paso: 0.01 };

export const TIPOS_IMAGEN = "image/jpeg,image/png,image/tiff,image/bmp";

export const MODOS: { valor: Modo; texto: string }[] = [
  { valor: "gris_invertido", texto: "Gris invertido (general)" },
  { valor: "verde_invertido", texto: "Canal verde (colorante rojo)" },
  { valor: "absorbancia", texto: "Absorbancia" },
];

// Si el recorte en PNG pesa más que esto, se guarda como JPEG de alta calidad.
export const MAX_BYTES_PNG = 12 * 1024 * 1024;
