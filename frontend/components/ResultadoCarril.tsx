"use client";

import { useMemo, useRef, useState } from "react";

import EditorLimites from "./EditorLimites";
import TablaFracciones from "./TablaFracciones";
import { recalcularLimites } from "@/lib/api";
import { cortesDesdeFracciones, zonasDesdeCortes } from "@/lib/limites";
import type { CalculoLimites, Carril, Fraccion } from "@/lib/tipos";
import type { Especie } from "@/lib/tipos-muestras";

type Props = {
  carril: Carril;
  proteinasTotales: string;
  especie?: Especie | null;
  onAjuste?: (calculo: CalculoLimites | null) => void;
};

type Snapshot = {
  cortes: number[];
  cortesAplicados: number[] | null;
  calculoBase: CalculoLimites | null;
  manual: Fraccion[] | null;
  editadas: boolean[];
};

function numero(valor: string): number | null {
  const n = Number(valor.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function calcularRelacionAGAuto(
  fracciones: Fraccion[],
  proteinasTotales: string,
): number | null {
  if (fracciones.length < 2) return null;

  const normalizar = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  let idxAlb = fracciones.findIndex((f) => normalizar(f.nombre).includes("album"));
  if (idxAlb < 0) {
    let mejor = -1;
    fracciones.forEach((f, i) => {
      const v = f.concentracion_g_dl ?? f.porcentaje ?? f.area;
      if (v > mejor) {
        mejor = v;
        idxAlb = i;
      }
    });
  }
  if (idxAlb < 0) return null;

  const pt = numero(proteinasTotales);
  const gdl = (f: Fraccion): number | null => {
    if (f.concentracion_g_dl != null && Number.isFinite(f.concentracion_g_dl)) {
      return f.concentracion_g_dl;
    }
    if (pt != null && pt > 0) return (pt * f.porcentaje) / 100;
    return null;
  };

  const alb = gdl(fracciones[idxAlb]);
  if (alb == null || alb <= 0) return null;

  let glob: number | null = null;
  if (pt != null && pt > 0) {
    glob = pt - alb;
  } else {
    const suma = fracciones.reduce(
      (acc, f, i) => (i === idxAlb ? acc : acc + (gdl(f) ?? 0)),
      0,
    );
    glob = suma > 0 ? suma : null;
  }
  if (glob == null || glob <= 0) return null;
  return alb / glob;
}

export default function ResultadoCarril({
  carril,
  proteinasTotales,
  especie,
  onAjuste,
}: Props) {
  const cortesIniciales = useMemo(() => cortesDesdeFracciones(carril), [carril]);

  const [cortes, setCortes] = useState<number[]>(cortesIniciales);
  const [cortesAplicados, setCortesAplicados] = useState<number[] | null>(null);
  const [calculoBase, setCalculoBase] = useState<CalculoLimites | null>(null);
  const [manual, setManual] = useState<Fraccion[] | null>(null);
  const [editadas, setEditadas] = useState<boolean[]>([]);
  const [deshacerStack, setDeshacerStack] = useState<Snapshot[]>([]);
  const [recalculando, setRecalculando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const peticion = useRef(0);

  const baseFracciones = calculoBase?.fracciones ?? carril.fracciones;
  const fracciones = manual ?? baseFracciones;
  const advertencias = calculoBase?.advertencias ?? carril.advertencias;
  const relacionAg = calcularRelacionAGAuto(fracciones, proteinasTotales);
  const hayEdicionManual = manual !== null;
  const hayAjuste = calculoBase !== null || hayEdicionManual;

  function emitir(
    sigManual: Fraccion[] | null,
    sigBase: CalculoLimites | null,
    sigFracciones: Fraccion[],
  ) {
    const ajustado = sigBase !== null || sigManual !== null;
    if (!ajustado) {
      onAjuste?.(null);
      return;
    }
    const base = sigBase ?? {
      fracciones: carril.fracciones,
      nombres_asignados: true,
      relacion_ag: carril.relacion_ag,
      advertencias: carril.advertencias,
    };
    onAjuste?.({
      ...base,
      fracciones: sigFracciones,
      nombres_asignados: true,
      relacion_ag: calcularRelacionAGAuto(sigFracciones, proteinasTotales),
    });
  }

  function editar(indice: number, campo: "nombre" | "porcentaje" | "concentracion_g_dl", valor: string) {
    const actual = (manual ?? baseFracciones).map((f) => ({ ...f }));
    const f = actual[indice];
    if (!f) return;

    if (campo === "nombre") {
      f.nombre = valor;
    } else {
      const n = numero(valor);
      if (n === null) return;
      if (campo === "porcentaje") f.porcentaje = n;
      if (campo === "concentracion_g_dl") f.concentracion_g_dl = n;
    }

    const nuevasEditadas = actual.map((_, i) => (i === indice ? true : Boolean(editadas[i] && manual)));
    // si antes no había manual, marcar solo esta; si había, preservar
    const flags = actual.map((_, i) =>
      i === indice ? true : manual ? Boolean(editadas[i]) : false,
    );
    setManual(actual);
    setEditadas(flags);
    emitir(actual, calculoBase, actual);
  }

  async function aplicar(nuevosCortes: number[]) {
    // Si hay ediciones manuales, el recálculo automático las reemplaza:
    // se guarda un punto de deshacer antes de recalcular.
    let baseParaRecalculo = calculoBase;
    let manualAntes: Fraccion[] | null = manual;
    let editadasAntes = editadas;
    if (manual) {
      setDeshacerStack((prev) => [
        ...prev,
        {
          cortes,
          cortesAplicados,
          calculoBase,
          manual,
          editadas,
        },
      ]);
      setManual(null);
      setEditadas([]);
      manualAntes = null;
      editadasAntes = [];
    }

    const id = ++peticion.current;
    setRecalculando(true);
    setError(null);
    try {
      const resultado = await recalcularLimites(
        carril.perfil,
        zonasDesdeCortes(nuevosCortes),
        proteinasTotales,
      );
      if (id !== peticion.current) return;
      setCalculoBase(resultado);
      setCortesAplicados(nuevosCortes);
      setManual(null);
      setEditadas([]);
      // si había manual lo limpiamos arriba; emitir estado recalculado
      onAjuste?.({
        ...resultado,
        nombres_asignados: true,
        relacion_ag: calcularRelacionAGAuto(resultado.fracciones, proteinasTotales),
      });
    } catch (e) {
      if (id === peticion.current) {
        setError(e instanceof Error ? e.message : "No se pudo recalcular");
        // si falló y habíamos limpiado manual para recalcular, no hay forma simple
        // de recuperar aquí sin más estado; el usuario puede deshacer.
      }
    } finally {
      if (id === peticion.current) setRecalculando(false);
    }
  }

  function deshacer() {
    setDeshacerStack((prev) => {
      if (prev.length === 0) return prev;
      const copia = [...prev];
      const snap = copia.pop()!;
      peticion.current += 1;
      setRecalculando(false);
      setError(null);
      setCortes(snap.cortes);
      setCortesAplicados(snap.cortesAplicados);
      setCalculoBase(snap.calculoBase);
      setManual(snap.manual);
      setEditadas(snap.editadas);
      const fr = snap.manual ?? snap.calculoBase?.fracciones ?? carril.fracciones;
      emitir(snap.manual, snap.calculoBase, fr);
      return copia;
    });
  }

  function restablecer() {
    peticion.current += 1;
    setCortes(cortesIniciales);
    setCortesAplicados(null);
    setCalculoBase(null);
    setManual(null);
    setEditadas([]);
    setDeshacerStack([]);
    setError(null);
    setRecalculando(false);
    onAjuste?.(null);
  }

  return (
    <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Carril {carril.indice}</h2>
          {hayEdicionManual && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Edición manual
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {recalculando && <span className="text-sm text-gray-500">Recalculando…</span>}
          {deshacerStack.length > 0 && (
            <button
              type="button"
              onClick={deshacer}
              className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
            >
              Deshacer
            </button>
          )}
        </div>
      </div>

      {hayEdicionManual && (
        <p className="rounded bg-amber-50 p-2 text-sm text-amber-900">
          Hay valores editados manualmente. Si movés los cortes, se recalcularán
          automáticamente y se reemplazarán estas ediciones (podés usar{" "}
          <strong>Deshacer</strong> para volver).
        </p>
      )}

      {carril.error ? (
        <p className="rounded bg-red-50 p-2 text-sm text-red-800">{carril.error}</p>
      ) : (
        <>
          <EditorLimites
            perfil={carril.perfil}
            cortes={cortes}
            nombres={fracciones.map((f) => f.nombre)}
            deshabilitado={recalculando}
            hayAjuste={hayAjuste || deshacerStack.length > 0}
            onCambiar={(nuevos) => {
              setCortes(nuevos);
              setError(null);
            }}
            onSoltar={(nuevos) => void aplicar(nuevos)}
            onRestablecer={restablecer}
          />
          {error && (
            <p className="rounded bg-red-50 p-2 text-sm text-red-800">{error}</p>
          )}
          <TablaFracciones
            fracciones={fracciones}
            relacionAg={relacionAg}
            especie={especie}
            editadas={editadas}
            onEditar={editar}
            deshabilitado={recalculando}
          />
        </>
      )}

      {advertencias.map((a) => (
        <p key={a} className="rounded bg-yellow-50 p-2 text-sm text-yellow-800">
          {a}
        </p>
      ))}
    </section>
  );
}
