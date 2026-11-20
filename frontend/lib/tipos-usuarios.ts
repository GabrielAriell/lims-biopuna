// Tipos de administración de usuarios/investigadores.

export type RolSistema = "admin" | "investigador" | "lectura";

export type UsuarioAdmin = {
  id_investigador: string;
  nombre: string;
  email: string;
  rol_sistema: RolSistema | string;
};

export type NuevoUsuarioAdmin = {
  nombre: string;
  email: string;
  password: string;
  rol_sistema: RolSistema;
};

export type ActualizacionUsuarioAdmin = {
  nombre?: string;
  rol_sistema?: RolSistema;
};
