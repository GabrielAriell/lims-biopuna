"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { obtenerPerfil } from "@/lib/auth";
import {
  cerrarSesionRemota,
  guardarSesion,
  leerSesion,
  type Sesion,
  type Usuario,
} from "@/lib/sesion";

type ContextoSesion = {
  usuario: Usuario | null;
  cargando: boolean;
  // La llama el login después de guardar los tokens.
  iniciar: (sesion: Sesion) => void;
  salir: () => Promise<void>;
};

const Contexto = createContext<ContextoSesion | null>(null);

// Mantiene el usuario logueado disponible para toda la app. Los tokens viven
// en localStorage; al arrancar se valida la sesión contra el backend.
export function ProveedorSesion({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const sesion = leerSesion();
    let activo = true;

    if (!sesion) {
      // Se difiere al próximo tick para no actualizar estado durante el
      // montaje (misma razón que en useMuestras).
      const inicio = window.setTimeout(() => {
        if (activo) setCargando(false);
      }, 0);
      return () => {
        activo = false;
        window.clearTimeout(inicio);
      };
    }

    obtenerPerfil()
      .then((perfil) => {
        if (!activo) return;
        setUsuario(perfil);
        const actual = leerSesion();
        if (actual) guardarSesion({ ...actual, usuario: perfil });
      })
      .catch(() => {
        if (!activo) return;
        // Si pedirJson borró la sesión, el token ya no sirve. Si sigue
        // guardada, fue un problema de red: mantenemos el usuario cacheado.
        if (leerSesion()) setUsuario(sesion.usuario);
        else setUsuario(null);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  // pedirJson avisa por este evento cuando el token dejó de servir.
  useEffect(() => {
    function alExpirar() {
      setUsuario(null);
      router.replace("/login");
    }
    window.addEventListener("lims:sesion-expirada", alExpirar);
    return () => {
      window.removeEventListener("lims:sesion-expirada", alExpirar);
    };
  }, [router]);

  const iniciar = useCallback((sesion: Sesion) => {
    setUsuario(sesion.usuario);
  }, []);

  const salir = useCallback(async () => {
    await cerrarSesionRemota();
    setUsuario(null);
    router.replace("/login");
  }, [router]);

  const valor = useMemo(
    () => ({ usuario, cargando, iniciar, salir }),
    [usuario, cargando, iniciar, salir],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ContextoSesion {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error("useSesion debe usarse dentro de ProveedorSesion");
  }
  return contexto;
}
