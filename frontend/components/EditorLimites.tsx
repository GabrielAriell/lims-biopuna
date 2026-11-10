"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import GraficoCarril from "./GraficoCarril";
import { agregarCorte, moverCorte, quitarCorte, zonasDesdeCortes } from "@/lib/limites";

// Márgenes de GraficoCarril: así los tiradores caen justo sobre el área de dibujo.
const MARGEN_IZQUIERDO = 48;
const MARGEN_DERECHO = 16;
const MARGEN_SUPERIOR = 16;
const MARGEN_INFERIOR = 8;

type Props = {
  perfil: number[];
  cortes: number[];
  nombres: string[];
  deshabilitado?: boolean;
  hayAjuste: boolean;
  onCambiar: (cortes: number[]) => void;
  onSoltar: (cortes: number[]) => void;
  onRestablecer: () => void;
};

export default function EditorLimites({
  perfil,
  cortes,
  nombres,
  deshabilitado = false,
  hayAjuste,
  onCambiar,
  onSoltar,
  onRestablecer,
}: Props) {
  const areaRef = useRef<HTMLDivElement>(null);
  const cortesRef = useRef(cortes);
  useEffect(() => {
    cortesRef.current = cortes;
  }, [cortes]);
  const arrastrandoRef = useRef<number | null>(null);
  const inicioArrastreRef = useRef<number[] | null>(null);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [arrastrando, setArrastrando] = useState<number | null>(null);

  const ultimo = Math.max(1, perfil.length - 1);

  function columnaDesdePuntero(clientX: number): number {
    const area = areaRef.current;
    if (!area) return 0;
    const rect = area.getBoundingClientRect();
    const proporcion = (clientX - rect.left) / Math.max(1, rect.width);
    return Math.round(proporcion * ultimo);
  }

  function cambiar(nuevos: number[]) {
    if (nuevos === cortesRef.current) return;
    cortesRef.current = nuevos;
    onCambiar(nuevos);
  }

  function soltar() {
    const inicio = inicioArrastreRef.current;
    arrastrandoRef.current = null;
    inicioArrastreRef.current = null;
    setArrastrando(null);
    // Un clic sin movimiento solo selecciona el límite: no hace falta recalcular.
    if (inicio !== null && inicio !== cortesRef.current) onSoltar(cortesRef.current);
  }

  function agregar() {
    const resultado = agregarCorte(cortesRef.current);
    if (resultado.indice < 0) return;
    cortesRef.current = resultado.cortes;
    setSeleccionado(resultado.indice);
    onCambiar(resultado.cortes);
    onSoltar(resultado.cortes);
  }

  function quitar(indice: number | null = seleccionado) {
    if (indice === null) return;
    const nuevos = quitarCorte(cortesRef.current, indice);
    if (nuevos === cortesRef.current) return;
    cortesRef.current = nuevos;
    setSeleccionado(null);
    onCambiar(nuevos);
    onSoltar(nuevos);
  }

  function restablecer() {
    setSeleccionado(null);
    onRestablecer();
  }

  function alTeclear(indice: number, evento: KeyboardEvent<HTMLDivElement>) {
    if (deshabilitado) return;

    if (evento.key === "ArrowLeft" || evento.key === "ArrowRight") {
      evento.preventDefault();
      const paso = evento.shiftKey ? 10 : 1;
      const delta = evento.key === "ArrowLeft" ? -paso : paso;
      const nuevos = moverCorte(cortesRef.current, indice, cortesRef.current[indice] + delta);
      if (nuevos === cortesRef.current) return;
      cambiar(nuevos);
      onSoltar(nuevos);
    } else if (evento.key === "Delete" || evento.key === "Backspace") {
      evento.preventDefault();
      quitar(indice);
    }
  }

  const boton =
    "rounded border border-gray-300 px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={agregar} disabled={deshabilitado} className={boton}>
          Agregar corte
        </button>
        <button
          type="button"
          onClick={() => quitar()}
          disabled={deshabilitado || seleccionado === null}
          className={boton}
        >
          Quitar corte
        </button>
        <button
          type="button"
          onClick={restablecer}
          disabled={deshabilitado || !hayAjuste}
          className={boton}
        >
          Restablecer propuesta
        </button>
        <span className="text-xs text-gray-500">
          Arrastrá las líneas azules para mover los límites. Con ← → se ajusta de a 1 (Shift: 10).
        </span>
      </div>

      <div className="relative">
        <GraficoCarril perfil={perfil} zonas={zonasDesdeCortes(cortes)} nombres={nombres} />
        <div
          ref={areaRef}
          className="pointer-events-none absolute"
          style={{
            left: MARGEN_IZQUIERDO,
            right: MARGEN_DERECHO,
            top: MARGEN_SUPERIOR,
            bottom: MARGEN_INFERIOR,
          }}
        >
          {cortes.slice(1, -1).map((corte, posicion) => {
            const indice = posicion + 1;
            const activo = seleccionado === indice;
            return (
              <div
                key={indice}
                role="slider"
                tabIndex={deshabilitado ? -1 : 0}
                aria-label={`Límite ${indice}`}
                aria-orientation="horizontal"
                aria-valuemin={cortes[indice - 1] + 1}
                aria-valuemax={cortes[indice + 1] - 1}
                aria-valuenow={corte}
                onPointerDown={(evento) => {
                  if (deshabilitado) return;
                  evento.preventDefault();
                  evento.stopPropagation();
                  evento.currentTarget.setPointerCapture(evento.pointerId);
                  arrastrandoRef.current = indice;
                  inicioArrastreRef.current = cortesRef.current;
                  setArrastrando(indice);
                  setSeleccionado(indice);
                }}
                onPointerMove={(evento) => {
                  const actual = arrastrandoRef.current;
                  if (actual === null) return;
                  cambiar(moverCorte(cortesRef.current, actual, columnaDesdePuntero(evento.clientX)));
                }}
                onPointerUp={(evento) => {
                  if (arrastrandoRef.current === null) return;
                  if (evento.currentTarget.hasPointerCapture(evento.pointerId)) {
                    evento.currentTarget.releasePointerCapture(evento.pointerId);
                  }
                  soltar();
                }}
                onPointerCancel={() => {
                  if (arrastrandoRef.current !== null) soltar();
                }}
                onFocus={() => setSeleccionado(indice)}
                onKeyDown={(evento) => alTeclear(indice, evento)}
                className={`pointer-events-auto absolute inset-y-0 -ml-2 w-4 cursor-col-resize touch-none rounded outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  arrastrando === indice ? "bg-blue-100" : ""
                }`}
                style={{ left: `${(corte / ultimo) * 100}%` }}
              >
                <span
                  className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 ${
                    activo ? "bg-blue-700" : "bg-blue-500/60"
                  }`}
                />
                <span
                  className={`absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border border-white ${
                    activo ? "bg-blue-700" : "bg-blue-500"
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
