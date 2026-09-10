export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
  message: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  enabled: boolean;
  createdAt?: string;
  password?: string;
  /** True si el usuario tiene foto de perfil. */
  hasAvatar?: boolean;
  /** Bandeja de reclamos (compat). */
  ticketAreaCodigo?: string | null;
  areaId?: number | null;
  areaCodigo?: string | null;
  areaNombre?: string | null;
  areaColor?: string | null;
  permisos?: AreaPermiso[];
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  ticketAreaCodigo?: string | null;
  areaId?: number | null;
}

export interface UpdateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  enabled: boolean;
  password?: string;
  ticketAreaCodigo?: string | null;
  areaId?: number | null;
}

export interface UpdateProfileRequest {
  email: string;
  firstName: string;
  lastName: string;
  password?: string; // Opcional para cambios de contraseña
}

export interface AreaPermiso {
  componente: string;
  grupo?: string;
  nombre?: string;
  puedeVer: boolean;
  puedeEditar: boolean;
  puedeEliminar: boolean;
}

/** Datos públicos de un usuario de la app (guía de contactos). */
export interface ContactoUsuario {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  hasAvatar: boolean;
  areaId?: number | null;
  areaCodigo?: string | null;
  areaNombre?: string | null;
  areaColor?: string | null;
} 