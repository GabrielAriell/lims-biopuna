/**
 * Procesamiento densitométrico en vivo en el navegador sobre el recuadro verde (ROI)
 * y renderizado de gráfica de fracciones sobre canvas.
 * Replica la lógica de backend/app/services/cabina/analisis.py e interfaz.py.
 */

export type BandaCabina = {
  nombre: string;
  area: number;
  porcentaje: number;
};

export type ResultadoRoiEnVivo = {
  tincion: "ROJA" | "AZUL";
  perfil: Float64Array;
  picos: number[];
  limites: Array<[number, number]>;
  datosBandas: BandaCabina[];
  relacionAg: number | null;
};

const MARGEN_VERTICAL = 0.25;
const UMBRAL_VELO_REL = 0.075;
const SIGMA_SUAVIZADO = 3.5;
const SUAVIZADO_REL = 0.004;
const PROMINENCIA_REL = 0.05;
const DISTANCIA_MIN_REL = 0.02;
const FUSION_VALLE = 0.85;

const ESQUEMAS_FRACCIONES: Record<number, readonly string[]> = {
  4: ["Albúmina", "Alfa", "Beta", "Gamma"],
  5: ["Albúmina", "Alfa 1", "Alfa 2", "Beta", "Gamma"],
  6: ["Albúmina", "Alfa I", "Alfa II", "Beta", "Gama I", "Gama II"],
};

const COLORES_BANDAS_CSS = [
  "rgba(0, 150, 255, 0.50)",
  "rgba(100, 220, 0, 0.50)",
  "rgba(255, 100, 200, 0.50)",
  "rgba(255, 200, 0, 0.50)",
  "rgba(255, 150, 100, 0.50)",
  "rgba(50, 180, 255, 0.50)",
  "rgba(255, 120, 180, 0.50)",
];

function kernelGaussiano1D(sigma: number): Float64Array {
  const radio = Math.max(1, Math.ceil(sigma * 3));
  const len = radio * 2 + 1;
  const kernel = new Float64Array(len);
  let suma = 0;
  const dosSigma2 = 2 * sigma * sigma;
  for (let i = -radio; i <= radio; i++) {
    const val = Math.exp(-(i * i) / dosSigma2);
    kernel[i + radio] = val;
    suma += val;
  }
  for (let i = 0; i < len; i++) {
    kernel[i] /= suma;
  }
  return kernel;
}

function suavizar1D(datos: Float64Array, sigma: number): Float64Array {
  const n = datos.length;
  if (n === 0 || sigma <= 0) return datos.slice();
  const kernel = kernelGaussiano1D(sigma);
  const radio = (kernel.length - 1) >> 1;
  const salida = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let k = -radio; k <= radio; k++) {
      const idx = Math.max(0, Math.min(n - 1, i + k));
      acc += datos[idx] * kernel[k + radio];
    }
    salida[i] = acc;
  }
  return salida;
}

function percentil(valores: Float64Array, q: number): number {
  if (valores.length === 0) return 0;
  const copia = Float64Array.from(valores).sort();
  const pos = (q / 100) * (copia.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return copia[lo];
  return copia[lo] + (copia[hi] - copia[lo]) * (pos - lo);
}

function detectarTipoTincion(
  rgba: Uint8ClampedArray,
  frameW: number,
  x1: number,
  y1: number,
  w: number,
  h: number,
): "ROJA" | "AZUL" {
  const total = w * h;
  if (total === 0) return "ROJA";

  const grises = new Float64Array(total);
  const rojos = new Float64Array(total);
  const azules = new Float64Array(total);

  let k = 0;
  for (let row = 0; row < h; row++) {
    const rowOff = (y1 + row) * frameW;
    for (let col = 0; col < w; col++) {
      const idx = (rowOff + x1 + col) * 4;
      const r = rgba[idx];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];
      rojos[k] = r;
      azules[k] = b;
      grises[k] = 0.299 * r + 0.587 * g + 0.114 * b;
      k++;
    }
  }

  const umbral = percentil(grises, 15);
  let sumaR = 0;
  let sumaB = 0;
  let count = 0;
  for (let i = 0; i < total; i++) {
    if (grises[i] <= umbral) {
      sumaR += rojos[i];
      sumaB += azules[i];
      count++;
    }
  }
  if (count === 0) return "ROJA";
  return sumaB / count > sumaR / count + 6 ? "AZUL" : "ROJA";
}

function encontrarPicos(
  suave: Float64Array,
  promMin: number,
  distMin: number,
): number[] {
  const n = suave.length;
  const candidatos: Array<{ idx: number; val: number; prom: number }> = [];

  for (let i = 1; i < n - 1; i++) {
    const val = suave[i];
    if (val > suave[i - 1] && val >= suave[i + 1]) {
      // Calcular prominencia aproximada buscando mínimos a izquierda/derecha hasta un pico mayor
      let minIzq = val;
      for (let l = i - 1; l >= 0; l--) {
        if (suave[l] < minIzq) minIzq = suave[l];
        if (suave[l] > val) break;
      }
      let minDer = val;
      for (let r = i + 1; r < n; r++) {
        if (suave[r] < minDer) minDer = suave[r];
        if (suave[r] > val) break;
      }
      const base = Math.max(minIzq, minDer);
      const prom = val - base;
      if (prom >= promMin) {
        candidatos.push({ idx: i, val, prom });
      }
    }
  }

  // Filtrar por distancia mínima manteniendo picos más altos primero
  const porAltura = [...candidatos].sort((a, b) => b.val - a.val);
  const elegidos: number[] = [];
  for (const cand of porAltura) {
    if (elegidos.every((p) => Math.abs(p - cand.idx) >= distMin)) {
      elegidos.push(cand.idx);
    }
  }
  elegidos.sort((a, b) => a - b);

  // Fusionar muescas superficiales
  let fusionado = true;
  while (fusionado && elegidos.length > 1) {
    fusionado = false;
    for (let i = 0; i < elegidos.length - 1; i++) {
      const a = elegidos[i];
      const b = elegidos[i + 1];
      let valle = suave[a];
      for (let p = a; p <= b; p++) {
        if (suave[p] < valle) valle = suave[p];
      }
      if (valle >= FUSION_VALLE * Math.min(suave[a], suave[b])) {
        elegidos.splice(suave[a] < suave[b] ? i : i + 1, 1);
        fusionado = true;
        break;
      }
    }
  }

  return elegidos;
}

export function procesarRoiEnVivo(
  rgba: Uint8ClampedArray,
  frameW: number,
  frameH: number,
  roi: [number, number, number, number],
  modo: string,
): ResultadoRoiEnVivo {
  const x1 = Math.max(0, Math.min(frameW - 1, Math.round(roi[0])));
  const y1 = Math.max(0, Math.min(frameH - 1, Math.round(roi[1])));
  const x2 = Math.max(x1, Math.min(frameW, Math.round(roi[2])));
  const y2 = Math.max(y1, Math.min(frameH, Math.round(roi[3])));

  const w = x2 - x1;
  const h = y2 - y1;
  if (w < 10 || h < 5) {
    return {
      tincion: "ROJA",
      perfil: new Float64Array(0),
      picos: [],
      limites: [],
      datosBandas: [],
      relacionAg: null,
    };
  }

  const m = modo.toUpperCase();
  const tincion: "ROJA" | "AZUL" =
    m === "AUTO"
      ? detectarTipoTincion(rgba, frameW, x1, y1, w, h)
      : m === "AZUL" || m === "AZULES"
        ? "AZUL"
        : "ROJA";

  const margen = Math.floor(h * MARGEN_VERTICAL);
  const filaIni = margen;
  const filaFin = Math.max(filaIni + 1, h - margen);
  const filasUtiles = filaFin - filaIni;

  const perfilOd = new Float64Array(w);

  if (tincion === "ROJA") {
    // verde_invertido sobre la franja central
    const valores = new Float64Array(w * filasUtiles);
    let idx = 0;
    for (let row = filaIni; row < filaFin; row++) {
      const rowOff = (y1 + row) * frameW;
      for (let col = 0; col < w; col++) {
        const pOff = (rowOff + x1 + col) * 4;
        valores[idx++] = rgba[pOff + 1];
      }
    }
    const i0 = percentil(valores, 99);
    for (let col = 0; col < w; col++) {
      let suma = 0;
      for (let row = 0; row < filasUtiles; row++) {
        const val = Math.max(0, i0 - valores[row * w + col]);
        suma += val;
      }
      perfilOd[col] = suma / filasUtiles;
    }
  } else {
    // gris_invertido: mezcla 0.78*G + 0.22*R + blanco i0
    const mezcla = new Float64Array(w * filasUtiles);
    let idx = 0;
    for (let row = filaIni; row < filaFin; row++) {
      const rowOff = (y1 + row) * frameW;
      for (let col = 0; col < w; col++) {
        const pOff = (rowOff + x1 + col) * 4;
        const r = rgba[pOff];
        const g = rgba[pOff + 1];
        mezcla[idx++] = Math.max(1.0, 0.78 * g + 0.22 * r);
      }
    }
    const i0 = Math.max(180.0, percentil(mezcla, 99));
    for (let col = 0; col < w; col++) {
      let suma = 0;
      for (let row = 0; row < filasUtiles; row++) {
        const norm = Math.max(
          1.0,
          Math.min(255.0, (mezcla[row * w + col] / i0) * 255.0),
        );
        suma += Math.log10(255.0 / norm) * 100.0;
      }
      perfilOd[col] = suma / filasUtiles;
    }
  }

  // Resta de línea base lineal entre 4% izquierdo y 4% derecho
  const nIzq = Math.max(3, Math.floor(w * 0.04));
  let baseIzq = 0;
  for (let i = 0; i < nIzq; i++) baseIzq += perfilOd[i];
  baseIzq /= nIzq;

  const idxDer = Math.floor(w * 0.96);
  let baseDer = baseIzq;
  if (idxDer < w) {
    let sumaDer = 0;
    for (let i = idxDer; i < w; i++) sumaDer += perfilOd[i];
    baseDer = sumaDer / (w - idxDer);
  }

  const sinFondo = new Float64Array(w);
  let maxSinFondo = 0;
  for (let i = 0; i < w; i++) {
    const t = w > 1 ? i / (w - 1) : 0;
    const base = baseIzq + t * (baseDer - baseIzq);
    const val = Math.max(0, perfilOd[i] - base);
    sinFondo[i] = val;
    if (val > maxSinFondo) maxSinFondo = val;
  }

  if (maxSinFondo <= 0) {
    return {
      tincion,
      perfil: new Float64Array(w),
      picos: [],
      limites: [],
      datosBandas: [],
      relacionAg: null,
    };
  }

  // Umbral de velo (7.5%) + corrección de reflectancia + suavizado Gaussiano
  const umbralVelo = maxSinFondo * UMBRAL_VELO_REL;
  const curva = new Float64Array(w);
  for (let i = 0; i < w; i++) {
    const limpia = Math.max(0, sinFondo[i] - umbralVelo);
    curva[i] = Math.pow(limpia / 10.0, 2.05) * 10.0;
  }
  const perfil = suavizar1D(curva, SIGMA_SUAVIZADO);

  const suavePicos = suavizar1D(perfil, Math.max(1.0, w * SUAVIZADO_REL));
  let maxSuave = 0;
  for (let i = 0; i < w; i++) {
    if (suavePicos[i] > maxSuave) maxSuave = suavePicos[i];
  }
  if (maxSuave <= 0) {
    return {
      tincion,
      perfil,
      picos: [],
      limites: [],
      datosBandas: [],
      relacionAg: null,
    };
  }

  const picos = encontrarPicos(
    suavePicos,
    PROMINENCIA_REL * maxSuave,
    Math.max(1, Math.floor(w * DISTANCIA_MIN_REL)),
  );

  const ultimo = w - 1;
  const cortes: number[] = [0];
  for (let i = 0; i < picos.length - 1; i++) {
    const a = picos[i];
    const b = picos[i + 1];
    let posMin = a;
    let valMin = suavePicos[a];
    for (let p = a + 1; p <= b; p++) {
      if (suavePicos[p] < valMin) {
        valMin = suavePicos[p];
        posMin = p;
      }
    }
    cortes.push(posMin);
  }
  cortes.push(ultimo);

  const limites: Array<[number, number]> = [];
  for (let i = 0; i < cortes.length - 1; i++) {
    if (cortes[i] < cortes[i + 1]) {
      limites.push([cortes[i], cortes[i + 1]]);
    }
  }

  if (limites.length === 0) {
    return {
      tincion,
      perfil,
      picos,
      limites: [],
      datosBandas: [],
      relacionAg: null,
    };
  }

  const areas = limites.map(([ini, fin]) => {
    let suma = 0;
    for (let p = ini; p < fin; p++) {
      suma += (perfil[p] + perfil[p + 1]) * 0.5;
    }
    return suma;
  });

  const areaTotal = areas.reduce((acc, a) => acc + a, 0);
  if (areaTotal <= 0) {
    return {
      tincion,
      perfil,
      picos,
      limites,
      datosBandas: [],
      relacionAg: null,
    };
  }

  const esquema = ESQUEMAS_FRACCIONES[limites.length];
  const nombres = esquema
    ? [...esquema]
    : limites.map((_, idx) => `Fracción ${idx + 1}`);

  const picosResultado: number[] = [];
  const datosBandas: BandaCabina[] = limites.map(([ini, fin], idx) => {
    let bestPos = ini;
    let bestVal = perfil[ini];
    for (let p = ini + 1; p <= fin; p++) {
      if (perfil[p] > bestVal) {
        bestVal = perfil[p];
        bestPos = p;
      }
    }
    picosResultado.push(bestPos);
    const area = areas[idx];
    return {
      nombre: nombres[idx],
      area: Math.round(area * 100) / 100,
      porcentaje: Math.round((area / areaTotal) * 10000) / 100,
    };
  });

  let relacionAg: number | null = null;
  if (areas.length >= 2) {
    let idxAlb = 0;
    if (!esquema) {
      for (let i = 1; i < areas.length; i++) {
        if (areas[i] > areas[idxAlb]) idxAlb = i;
      }
    }
    const globulinas = areaTotal - areas[idxAlb];
    if (globulinas > 0) {
      relacionAg = areas[idxAlb] / globulinas;
    }
  }

  return {
    tincion,
    perfil,
    picos: picosResultado,
    limites,
    datosBandas,
    relacionAg,
  };
}

function abreviarNombre(nombre: string): string {
  const low = nombre.toLowerCase();
  if (low.startsWith("alb")) return "Alb";
  if (low.startsWith("alfa")) return "a" + nombre.slice(4);
  if (low.startsWith("beta")) return "b" + nombre.slice(4);
  if (low.startsWith("gam")) return "g" + nombre.slice(low.startsWith("gamma") ? 5 : 4);
  return nombre;
}

export function dibujarGraficaYAreasCanvas(
  ctx: CanvasRenderingContext2D,
  frameH: number,
  roi: [number, number, number, number],
  analisis: ResultadoRoiEnVivo,
): void {
  const { perfil, picos, limites, datosBandas } = analisis;
  if (perfil.length === 0) return;

  const [x1, y1] = roi;
  const baseY = frameH - 25;

  let maxVal = 0;
  for (let i = 0; i < perfil.length; i++) {
    if (perfil[i] > maxVal) maxVal = perfil[i];
  }
  // Escalar automáticamente si el pico supera la altura disponible
  const alturaDisp = Math.max(80, baseY - 95);
  const escalaY = maxVal * 1.15 > alturaDisp ? alturaDisp / maxVal : 1.15;

  for (let idx = 0; idx < limites.length; idx++) {
    const [ini, fin] = limites[idx];
    const banda = datosBandas[idx];
    if (!banda) continue;

    ctx.fillStyle = COLORES_BANDAS_CSS[idx % COLORES_BANDAS_CSS.length];
    ctx.beginPath();
    ctx.moveTo(x1 + ini, baseY);
    for (let px = ini; px <= fin; px++) {
      ctx.lineTo(x1 + px, baseY - perfil[px] * escalaY);
    }
    ctx.lineTo(x1 + fin, baseY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(180, 180, 180, 0.75)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1 + ini, y1);
    ctx.lineTo(x1 + ini, baseY);
    ctx.moveTo(x1 + fin, y1);
    ctx.lineTo(x1 + fin, baseY);
    ctx.stroke();

    if (idx < picos.length && picos[idx] < perfil.length) {
      const picoX = x1 + picos[idx];
      const picoY = baseY - perfil[picos[idx]] * escalaY;

      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(picoX, picoY, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(
        `${abreviarNombre(banda.nombre)}: ${banda.porcentaje.toFixed(1)}%`,
        picoX - 24,
        Math.max(24, picoY - 8),
      );
    }
  }

  // Curva densitométrica blanca
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < perfil.length; i++) {
    const px = x1 + i;
    const py = baseY - perfil[i] * escalaY;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}
