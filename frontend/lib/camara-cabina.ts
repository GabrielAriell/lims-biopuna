/**
 * Utilidades de cámara USB en navegador (WebRTC + corrección de lente + promedio de cuadros)
 * equivalentes a backend/app/services/cabina/camara.py y gestor.py.
 */

export const ANCHO_CAPTURA = 1280;
export const ALTO_CAPTURA = 720;
export const ANCHO_VENTANA = 960;
export const ALTO_VENTANA = 540;
export const DISTORSION_K1 = -0.3;
export const FOCAL_FACTOR = 0.85;

const STORAGE_CAMARA_KEY = "biopuna_cabina_camera_id";

export type CamaraWebInfo = {
  idx: number;
  deviceId: string;
  nombre: string;
  esCabina: boolean;
};

export type MapaUndistort = {
  srcW: number;
  srcH: number;
  dstW: number;
  dstH: number;
  /** Índices enteros rápidos (srcY * srcW + srcX) para vista previa en vivo. */
  nearestIdx: Int32Array;
  /** Coordenadas subpíxel (sx, sy) intercaladas para captura limpia bilineal. */
  srcCoords: Float32Array;
};

/**
 * Clasifica cámaras web detectadas por el navegador usando el mismo criterio
 * que backend/app/services/cabina/gestor.py (priorizando cámara física USB).
 */
export async function listarCamarasWeb(): Promise<CamaraWebInfo[]> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.enumerateDevices
  ) {
    return [];
  }

  const dispositivos = await navigator.mediaDevices.enumerateDevices();
  const videos = dispositivos.filter((d) => d.kind === "videoinput");

  return videos.map((d, idx) => {
    const labelBase = d.label?.trim() || `Cámara ${idx + 1}`;
    const up = labelBase.toUpperCase();
    const esVirtual =
      up.includes("IVCAM") || up.includes("OBS") || up.includes("VIRTUAL");
    const esCabina =
      !esVirtual &&
      ["USB", "CABINA", "UVC", "MICROSCOPE", "CAM"].some((k) =>
        up.includes(k),
      );
    const nombre =
      esCabina && !labelBase.includes("Cabina")
        ? `${labelBase} (Cabina Densitométrica)`
        : labelBase;

    return {
      idx,
      deviceId: d.deviceId,
      nombre,
      esCabina,
    };
  });
}

export function guardarCamaraPreferida(deviceId: string): void {
  try {
    if (typeof window !== "undefined" && deviceId) {
      window.localStorage.setItem(STORAGE_CAMARA_KEY, deviceId);
    }
  } catch {
    // Ignorar errores de almacenamiento
  }
}

export function leerCamaraPreferida(): string | null {
  try {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(STORAGE_CAMARA_KEY);
    }
  } catch {
    // Ignorar
  }
  return null;
}

export function elegirCamaraCabina(
  camaras: CamaraWebInfo[],
  preferidaId?: string | null,
): CamaraWebInfo | null {
  if (camaras.length === 0) return null;
  if (preferidaId) {
    const guardada = camaras.find((c) => c.deviceId === preferidaId);
    if (guardada) return guardada;
  }
  const fisica = camaras.find((c) => c.esCabina);
  if (fisica) return fisica;
  return camaras.length > 1 ? camaras[1] : camaras[0];
}

/**
 * Invierte el modelo radial r_d = r * (1 + k1 * r^2) mediante Newton-Raphson
 * para obtener coordenadas normalizadas sin distorsión.
 */
function undistortNormalizado(
  xd: number,
  yd: number,
  k1: number,
): [number, number] {
  let x = xd;
  let y = yd;
  for (let i = 0; i < 6; i++) {
    const r2 = x * x + y * y;
    const escala = 1 + k1 * r2;
    if (Math.abs(escala) < 1e-6) break;
    x = xd / escala;
    y = yd / escala;
  }
  return [x, y];
}

/**
 * Precalcula el mapeo de corrección de lente (equivalente a
 * cv2.getOptimalNewCameraMatrix(..., alpha=0) + cv2.undistort + resize).
 */
export function construirMapaUndistort(
  srcW: number,
  srcH: number,
  dstW = ANCHO_VENTANA,
  dstH = ALTO_VENTANA,
  k1 = DISTORSION_K1,
  focalFactor = FOCAL_FACTOR,
): MapaUndistort {
  const f = srcW * focalFactor;
  const cx = srcW / 2;
  const cy = srcH / 2;

  // Equivalente a icvGetRectangles(alpha=0) muestreando bordes en grilla 9x9
  let x0 = -Infinity;
  let x1 = Infinity;
  let y0 = -Infinity;
  let y1 = Infinity;

  const pasos = 8;
  for (let i = 0; i <= pasos; i++) {
    const u = (i / pasos) * (srcW - 1);
    const v = (i / pasos) * (srcH - 1);

    const [, yt] = undistortNormalizado((u - cx) / f, (0 - cy) / f, k1);
    if (yt > y0) y0 = yt;

    const [, yb] = undistortNormalizado(
      (u - cx) / f,
      (srcH - 1 - cy) / f,
      k1,
    );
    if (yb < y1) y1 = yb;

    const [xl] = undistortNormalizado((0 - cx) / f, (v - cy) / f, k1);
    if (xl > x0) x0 = xl;

    const [xr] = undistortNormalizado((srcW - 1 - cx) / f, (v - cy) / f, k1);
    if (xr < x1) x1 = xr;
  }

  const fxNew = (srcW - 1) / Math.max(1e-5, x1 - x0);
  const cxNew = -x0 * fxNew;
  const fyNew = (srcH - 1) / Math.max(1e-5, y1 - y0);
  const cyNew = -y0 * fyNew;

  const total = dstW * dstH;
  const nearestIdx = new Int32Array(total);
  const srcCoords = new Float32Array(total * 2);

  const scaleX = srcW / dstW;
  const scaleY = srcH / dstH;
  const usarDistorsion = Math.abs(k1) >= 0.001;

  for (let dy = 0; dy < dstH; dy++) {
    const uy = (dy + 0.5) * scaleY - 0.5;
    for (let dx = 0; dx < dstW; dx++) {
      const ux = (dx + 0.5) * scaleX - 0.5;
      let sx = ux;
      let sy = uy;

      if (usarDistorsion) {
        const xn = (ux - cxNew) / fxNew;
        const yn = (uy - cyNew) / fyNew;
        const r2 = xn * xn + yn * yn;
        const dist = 1 + k1 * r2;
        sx = f * (xn * dist) + cx;
        sy = f * (yn * dist) + cy;
      }

      const outOffset = dy * dstW + dx;
      srcCoords[outOffset * 2] = sx;
      srcCoords[outOffset * 2 + 1] = sy;

      const ix = Math.round(sx);
      const iy = Math.round(sy);
      if (ix >= 0 && ix < srcW && iy >= 0 && iy < srcH) {
        nearestIdx[outOffset] = iy * srcW + ix;
      } else {
        nearestIdx[outOffset] = -1;
      }
    }
  }

  return { srcW, srcH, dstW, dstH, nearestIdx, srcCoords };
}

/**
 * Remapea un fotograma RGBA crudo a un buffer RGBA corregido de 960x540 (vecino más cercano).
 */
export function aplicarUndistortRapido(
  srcData: Uint8ClampedArray,
  dstData: Uint8ClampedArray,
  mapa: MapaUndistort,
): void {
  const { nearestIdx } = mapa;
  const total = nearestIdx.length;
  for (let i = 0; i < total; i++) {
    const srcPix = nearestIdx[i];
    const dOff = i * 4;
    if (srcPix < 0) {
      dstData[dOff] = 0;
      dstData[dOff + 1] = 0;
      dstData[dOff + 2] = 0;
      dstData[dOff + 3] = 255;
    } else {
      const sOff = srcPix * 4;
      dstData[dOff] = srcData[sOff];
      dstData[dOff + 1] = srcData[sOff + 1];
      dstData[dOff + 2] = srcData[sOff + 2];
      dstData[dOff + 3] = 255;
    }
  }
}

/**
 * Acumula un fotograma con interpolación bilineal sobre un acumulador Float32 RGB
 * para promediar N cuadros limpios sin parpadeo ni líneas horizontales.
 */
export function acumularUndistortBilineal(
  srcData: Uint8ClampedArray,
  acumuladorRgb: Float32Array,
  mapa: MapaUndistort,
): void {
  const { srcW, srcH, srcCoords, dstW, dstH } = mapa;
  const total = dstW * dstH;

  for (let i = 0; i < total; i++) {
    const sx = srcCoords[i * 2];
    const sy = srcCoords[i * 2 + 1];
    if (sx < 0 || sy < 0 || sx >= srcW - 1 || sy >= srcH - 1) {
      const ix = Math.max(0, Math.min(srcW - 1, Math.round(sx)));
      const iy = Math.max(0, Math.min(srcH - 1, Math.round(sy)));
      const sOff = (iy * srcW + ix) * 4;
      const aOff = i * 3;
      acumuladorRgb[aOff] += srcData[sOff];
      acumuladorRgb[aOff + 1] += srcData[sOff + 1];
      acumuladorRgb[aOff + 2] += srcData[sOff + 2];
      continue;
    }

    const x0 = Math.floor(sx);
    const y0 = Math.floor(sy);
    const fx = sx - x0;
    const fy = sy - y0;
    const w00 = (1 - fx) * (1 - fy);
    const w10 = fx * (1 - fy);
    const w01 = (1 - fx) * fy;
    const w11 = fx * fy;

    const p00 = (y0 * srcW + x0) * 4;
    const p10 = p00 + 4;
    const p01 = p00 + srcW * 4;
    const p11 = p01 + 4;

    const aOff = i * 3;
    acumuladorRgb[aOff] +=
      srcData[p00] * w00 +
      srcData[p10] * w10 +
      srcData[p01] * w01 +
      srcData[p11] * w11;
    acumuladorRgb[aOff + 1] +=
      srcData[p00 + 1] * w00 +
      srcData[p10 + 1] * w10 +
      srcData[p01 + 1] * w01 +
      srcData[p11 + 1] * w11;
    acumuladorRgb[aOff + 2] +=
      srcData[p00 + 2] * w00 +
      srcData[p10 + 2] * w10 +
      srcData[p01 + 2] * w01 +
      srcData[p11 + 2] * w11;
  }
}
