"use client"

import * as React from "react"
import { cn } from "cn"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
} from "lucide-react"
import { DayPicker, type DayPickerProps } from "react-day-picker"
import { es } from "react-day-picker/locale"

// Los estados (seleccionado, hoy, fuera del mes) viajan como data-*
// en el <td>: por eso el botón usa variantes group-data-[...].
function Calendar({
  className,
  classNames,
  locale = es,
  showOutsideDays = true,
  ...props
}: DayPickerProps) {
  return (
    <DayPicker
      locale={locale}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: "w-fit",
        months: "flex flex-col",
        month: "flex flex-col gap-3",
        month_caption: "relative flex h-8 items-center justify-center",
        caption_label: "text-sm font-semibold capitalize text-slate-900",
        nav: "contents",
        button_previous:
          "absolute left-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40",
        button_next:
          "absolute right-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-9 py-1 text-center text-[0.7rem] font-medium uppercase tracking-wide text-slate-500",
        weeks: "",
        week: "mt-0.5 flex",
        day: "group h-9 w-9 p-0 text-center",
        day_button: cn(
          "h-9 w-9 rounded-lg text-sm text-slate-800 transition-colors",
          "hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
          "group-data-[selected=true]:bg-emerald-600 group-data-[selected=true]:font-semibold group-data-[selected=true]:text-white group-data-[selected=true]:hover:bg-emerald-700",
          "group-data-[today=true]:border group-data-[today=true]:border-emerald-400",
          "group-data-[outside=true]:text-slate-400 group-data-[outside=true]:opacity-70",
          "group-data-[disabled=true]:text-slate-300 group-data-[disabled=true]:hover:bg-transparent"
        ),
        week_number: "text-xs text-slate-400",
        footer: "pt-2",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: clase, ...rest }) => {
          const Icono =
            orientation === "left"
              ? ChevronLeftIcon
              : orientation === "right"
                ? ChevronRightIcon
                : orientation === "up"
                  ? ChevronUpIcon
                  : ChevronDownIcon
          return <Icono className={cn("size-4", clase)} {...rest} />
        },
      }}
      {...props}
    />
  )
}

export { Calendar }
