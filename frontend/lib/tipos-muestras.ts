// Tipos del módulo de muestras y campañas. Reflejan lo que devuelve la API.

export type Especie = "Llama" | "Vicuña" | "Ovino";

export type EstadoMuestra = "verde" | "amarillo" | "rojo" | "procesada";

export type Provincia = {
  id_provincia: number;
  nombre: string;
};

export type Departamento = {
  id_departamento: number;
  id_provincia: number;
  nombre: string;
  provincia?: string | null;
};

export type Campana = {
  id_campana: number;
  // Texto legible compuesto (compatibilidad con listados).
  localidad_puna: string;
  id_departamento?: number | null;
  departamento?: string | null;
  id_provincia?: number | null;
  provincia?: string | null;
  localidad_detalle?: string | null;
  fecha_salida: string; // YYYY-MM-DD
  convenio_inta: boolean;
  observaciones: string | null;
  total_muestras: number;
};

export type Muestra = {
  id_muestra: number;
  id_campana: number;
  codigo_animal: string;
  especie: Especie;
  fecha_hora_extraccion: string; // ISO con zona horaria
  url_foto_campo: string | null;
  primera_corrida: string | null;
  horas_transcurridas: number;
  estado_48h: EstadoMuestra;
  localidad_puna: string;
  fecha_salida: string; // YYYY-MM-DD
};

export type NuevaCampana = {
  id_departamento?: number | null;
  localidad_detalle?: string;
  // Compatibilidad/fallback si el catálogo geográfico no está disponible.
  localidad_puna?: string;
  fecha_salida: string; // YYYY-MM-DD
  convenio_inta: boolean;
  observaciones: string;
};

export type NuevaMuestra = {
  id_campana: number;
  codigo_animal: string;
  especie: Especie;
  fecha_hora_extraccion: string; // ISO con zona horaria
  url_foto_campo?: string;
};
