import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ProveedorSesion } from "@/components/ProveedorSesion";

const geistSans = Geist({
  variable: "--font-geist-sans",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ProveedorSesion>{children}</ProveedorSesion>
      </body>
    </html>
  );
}
