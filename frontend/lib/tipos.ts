export type Modo = "gris_invertido" | "verde_invertido" | "absorbancia";

export type Fraccion = {
  nombre: string;
  inicio: number;
  fin: number;
  pico: number;
  area: number;
  porcentaje: number;
  concentracion_g_dl: number | null;
};

export type Carril = {
  indice: number;
  fila_ini: number;
  fila_fin: number;
  perfil: number[];
  fracciones: Fraccion[];
  nombres_asignados: boolean;
  relacion_ag: number | null;
  advertencias: string[];
  error: string | null;
};

export type AnalisisTira = {
  region: [number, number, number, number];
  recorte_automatico: boolean;
  ancho: number;
  alto: number;
  imagen: string;
  advertencias: string[];
  carriles: Carril[];
};

// Lo que el investigador configura en el formulario.
export type Parametros = {
  proteinasTotales: string;
  prominencia: number;
  modo: Modo;
  nCarriles: string;
  vertical: boolean;
  invertir: boolean;
};

// (inicio, fin) inclusivos, en columnas del perfil.
export type Zona = [number, number];

// Respuesta de POST /ensayos/recalcular: los límites ya confirmados.
export type CalculoLimites = {
  fracciones: Fraccion[];
  nombres_asignados: boolean;
  relacion_ag: number | null;
  advertencias: string[];
};
