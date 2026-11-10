// Tipos del guardado y la consulta de ensayos.

export type CarrilParaGuardar = {
  perfil: number[];
  // Zonas (inicio, fin) inclusivas, en columnas del perfil.
  zonas: [number, number][];
};

export type NuevoEnsayo = {
  id_muestra: number;
  proteinas_totales: number;
  fecha_corrida?: string;
  metodo_lectura?: "digital_opencv" | "espectrofotometro";
  carriles: CarrilParaGuardar[];
};

export type FraccionGuardada = {
  nombre_fraccion: string;
  area_integrada: number;
  porcentaje_relativo: number;
  concentracion_g_dl: number;
};

export type EnsayoGuardado = {
  id_ensayo: number;
  id_muestra: number;
  id_investigador: string;
  investigador_nombre?: string | null;
  fecha_corrida: string;
  proteinas_totales_g_dl: number;
  url_imagen_tira: string | null;
  metodo_lectura: string;
  creado_por?: string | null;
  creado_en?: string | null;
  fracciones: FraccionGuardada[];
};
