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
  /** Bandeja de reclamos (rol USER). */
  ticketAreaCodigo?: string | null;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  ticketAreaCodigo?: string | null;
}

export interface UpdateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  enabled: boolean;
  password?: string;
  ticketAreaCodigo?: string | null;
}

export interface UpdateProfileRequest {
  email: string;
  firstName: string;
  lastName: string;
  password?: string; // Opcional para cambios de contraseña
} 