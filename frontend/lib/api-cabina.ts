import { API_URL } from "./config";
import { pedirJson } from "./api";

export function obtenerUrlCabina(): string {
  if (process.env.NEXT_PUBLIC_CABINA_URL) {
    return process.env.NEXT_PUBLIC_CABINA_URL.replace(/\/$/, "");
  }
  if (API_URL.includes("localhost") || API_URL.includes("127.0.0.1")) {
    return API_URL;
  }
  return "http://127.0.0.1:8000";
}

export type CamaraInfo = {
  idx: number;
  nombre: string;
  es_cabina?: boolean;
};

export type EstadoCabina = {
  disponible: boolean;
  camara_conectada: boolean;
  camara_actual?: number;
  camaras_disponibles?: CamaraInfo[];
  roi_actual?: number[];
  ancho_ventana?: number;
  alto_ventana?: number;
  modo_tincion?: string;
  color_luz_activo?: string;
  arduino_conectado?: boolean;
  puerto_arduino?: string;
};

export type ResultadoCapturaCabina = {
  exito: boolean;
  capturado: boolean;
  cancelado?: boolean;
  mensaje?: string;
  nombre_archivo?: string;
  imagen_data_url?: string;
  tincion?: string;
  relacion_ag?: number | null;
  datos_bandas?: Array<{
    nombre: string;
    area: number;
    porcentaje: number;
  }>;
};

export function urlStreamVideo(): string {
  return `${obtenerUrlCabina()}/cabina/video_feed?t=${Date.now()}`;
}

export async function consultarEstadoCabina(): Promise<EstadoCabina | null> {
  const baseUrl = obtenerUrlCabina();
  try {
    return await pedirJson<EstadoCabina>(
      `${baseUrl}/cabina/estado`,
      { method: "GET" },
      { conSesion: false },
    );
  } catch {
    return null;
  }
}

export async function ajustarCabina(ajustes: {
  camara_idx?: number;
  roi?: number[];
  modo_tincion?: string;
  color_luz_manual?: string;
  correccion_luz?: boolean;
}): Promise<boolean> {
  const baseUrl = obtenerUrlCabina();
  try {
    await pedirJson(
      `${baseUrl}/cabina/ajustar`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ajustes),
      },
      { conSesion: false },
    );
    return true;
  } catch {
    return false;
  }
}

export async function capturaLimpiaCabina(): Promise<{
  archivo: File | null;
  resultado?: ResultadoCapturaCabina;
}> {
  const baseUrl = obtenerUrlCabina();
  const data = await pedirJson<ResultadoCapturaCabina>(
    `${baseUrl}/cabina/captura-limpia`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { conSesion: false },
  );

  if (!data.capturado || !data.imagen_data_url) {
    throw new Error("No se pudo obtener la imagen capturada.");
  }

  const res = await fetch(data.imagen_data_url);
  const blob = await res.blob();
  const nombre = data.nombre_archivo || `tira_cabina_${Date.now()}.png`;
  const archivo = new File([blob], nombre, { type: "image/png" });

  return { archivo, resultado: data };
}
