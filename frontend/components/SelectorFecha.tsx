"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Props = {
  // "YYYY-MM-DD" o "YYYY-MM-DDTHH:mm" (compatible con input datetime-local).
  value: string;
  onChange: (valor: string) => void;
  conHora?: boolean;
  placeholder?: string;
  disabled?: boolean;
};

// "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm" → Date local (sin corrimiento UTC).
function parsear(valor: string): Date | undefined {
  const [fecha, hora] = valor.split("T");
  const [anio, mes, dia] = (fecha ?? "").split("-").map(Number);
  if (!anio || !mes || !dia) return undefined;
  const [hh, mm] = (hora ?? "00:00").split(":").map(Number);
  return new Date(anio, mes - 1, dia, hh || 0, mm || 0);
}

function aIso(dia: Date, hora: string, conHora: boolean): string {
  const f = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, "0")}-${String(dia.getDate()).padStart(2, "0")}`;
  return conHora ? `${f}T${hora}` : f;
}

const formatoFecha = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default function SelectorFecha({
  value,
  onChange,
  conHora = false,
  placeholder,
  disabled = false,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const fecha = parsear(value);
  const hora = value.includes("T") ? value.split("T")[1]?.slice(0, 5) : "";

  function elegirDia(dia: Date | undefined) {
    if (!dia) return;
    // Si todavía no hay hora, propone la actual: queda visible en el campo
    // de hora para que la ajuste antes de guardar.
    const h =
      hora ||
      `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;
    onChange(aIso(dia, h, conHora));
    if (!conHora) setAbierto(false);
  }

  function elegirHora(nueva: string) {
    if (!nueva || !fecha) return;
    onChange(aIso(fecha, nueva, true));
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-[15px] transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={fecha ? "text-slate-900" : "text-slate-400"}>
            {fecha
              ? conHora
                ? `${formatoFecha.format(fecha)} · ${hora || "hh:mm"}`
                : formatoFecha.format(fecha)
              : (placeholder ??
                (conHora ? "Elegí fecha y hora" : "Elegí una fecha"))}
          </span>
          <CalendarIcon className="size-4 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto">
        <Calendar
          mode="single"
          selected={fecha}
          onSelect={elegirDia}
          defaultMonth={fecha}
        />
        {conHora && (
          <div className="flex items-center gap-2 border-t border-slate-200 px-3 py-2.5">
            <label
              htmlFor="selector-fecha-hora"
              className="text-sm font-medium text-slate-700"
            >
              Hora
            </label>
            <input
              id="selector-fecha-hora"
              type="time"
              value={hora}
              disabled={!fecha}
              onChange={(e) => elegirHora(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[15px] text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50"
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
