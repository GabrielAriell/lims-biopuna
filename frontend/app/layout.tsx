import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ProveedorSesion } from "@/components/ProveedorSesion";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LIMS-BioPuna - Laboratorio Biofísico-Químico (FCA-UNJu)",
  description: "Sistema de Información Web y Densitometría Óptica Digital para perfiles metabólicos de camélidos y ovinos de la Puna.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Aplica la clase .dark antes del primer paint: sin flash claro.
            Lee la preferencia guardada; si no hay, sigue al sistema. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("lims-tema");if(t==="oscuro"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}',
          }}
        />
        <ProveedorSesion>{children}</ProveedorSesion>
      </body>
    </html>
  );
}
